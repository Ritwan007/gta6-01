// Keyboard + mouse input for Sunset Heist.
// Two rules learned from real play-test bugs:
//  - M / Escape are handled SYNCHRONOUSLY in the DOM keydown handler (via onEdge), never
//    through the fixed-step loop, so a press is never lost or double-counted.
//  - Click vs drag: a mouse drag rotates the camera and must NEVER fire the gun. A shot
//    only happens on a short (<=6 px, <400 ms) click; dragging clears the held trigger.
export function createInput(canvas) {
  const keys = new Set();
  const edges = [];
  const edgeHandlers = new Map();
  const mouse = { x: 0, y: 0, dx: 0, dy: 0, down: false, downX: 0, downY: 0, downAt: 0, moved: 0, held: false, fireEdge: false };
  let wheelDelta = 0;

  function onEdge(code, fn) {
    if (!edgeHandlers.has(code)) edgeHandlers.set(code, []);
    edgeHandlers.get(code).push(fn);
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    edges.push(event.code);
    const fns = edgeHandlers.get(event.code);
    if (fns) for (const fn of fns) fn();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => { keys.delete(event.code); });
  window.addEventListener('blur', () => { keys.clear(); mouse.held = false; mouse.down = false; });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const nx = event.clientX - rect.left, ny = event.clientY - rect.top;
    mouse.dx += nx - mouse.x; mouse.dy += ny - mouse.y;
    mouse.x = nx; mouse.y = ny;
    if (mouse.down) {
      mouse.moved += Math.abs(nx - mouse.downX) + Math.abs(ny - mouse.downY);
      if (mouse.moved > 6) mouse.held = false; // a drag is a look-around, not a trigger pull
    }
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    mouse.down = true; mouse.downX = mouse.x; mouse.downY = mouse.y; mouse.downAt = performance.now(); mouse.moved = 0;
    mouse.held = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button !== 0 || !mouse.down) return;
    mouse.down = false; mouse.held = false;
    const quick = performance.now() - mouse.downAt < 400;
    if (quick && mouse.moved <= 6) mouse.fireEdge = true;
  });
  canvas.addEventListener('wheel', (event) => { wheelDelta += Math.sign(event.deltaY); event.preventDefault(); }, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    keys, mouse,
    down(code) { return keys.has(code); },
    onEdge,
    // One-shot key presses since the last call (E, R, digits, ...).
    takeEdges() { const out = edges.splice(0, edges.length); return out; },
    // Mouse look deltas since the last call, in pixels.
    takeLook() { const d = { dx: mouse.dx, dy: mouse.dy }; mouse.dx = 0; mouse.dy = 0; return d; },
    takeWheel() { const w = wheelDelta; wheelDelta = 0; return w; },
    takeFireEdge() { const f = mouse.fireEdge; mouse.fireEdge = false; return f; },
    // Steering: -1 (A / left) .. +1 (D / right). D DECREASES the world heading.
    steer() { return (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0); },
    throttle() { return (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0); },
    sprint() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
  };
}
