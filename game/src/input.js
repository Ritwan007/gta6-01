// VELORA HEAT — keyboard + mouse input.
//
// Design decision from the round-10 failure (M would not close the map):
// M and Escape are handled SYNCHRONOUSLY in the DOM keydown handler through a
// callback registered by main.js. They are never queued as edges for the fixed
// step to consume later, so a stale edge can never re-open a screen that was
// just closed. All other keys are plain held-state.
export function createInput(canvas, onKey) {
  const keys = new Set(); // held keys (movement, driving)
  const pressed = new Set(); // one-shot edges: keydown adds, keyup NEVER removes;
  // press() consumes. A quick down+up between two slow frames is never lost.
  let mouseX = 640;
  let mouseY = 360;
  let mouseDown = false;
  let mouseClicked = false; // one-shot, consumed by the loop

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'KeyM' || event.code === 'Escape') {
      onKey(event.code);
      event.preventDefault();
      return;
    }
    keys.add(event.code);
    pressed.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    mouseDown = true;
    mouseClicked = true;
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  window.addEventListener('mouseup', (event) => { if (event.button === 0) mouseDown = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    held(code) { return keys.has(code); },
    axis() {
      // Screen axes: W = north (-z), S = south (+z), A = west (-x), D = east (+x).
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const z = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      return { x, z };
    },
    drive() {
      const fwd = keys.has('KeyW') || keys.has('ArrowUp');
      const back = keys.has('KeyS') || keys.has('ArrowDown');
      const left = keys.has('KeyA') || keys.has('ArrowLeft');
      const right = keys.has('KeyD') || keys.has('ArrowRight');
      return { fwd, back, steer: (right ? 1 : 0) - (left ? 1 : 0), brake: keys.has('Space') };
    },
    run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    takeClick() { const c = mouseClicked; mouseClicked = false; return c; },
    // One-shot edge for E / R / digit keys: true once per physical press.
    // Consumed from the edge queue, so a press between frames is never lost.
    press(code) {
      if (!pressed.has(code)) return false;
      pressed.delete(code);
      return true;
    },
  };
}
