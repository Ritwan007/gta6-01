// Keyboard + mouse input. Held keys are read every fixed step; one-shot presses
// (interact, reload, weapon keys, jump) are queued as edges and taken once, so a press
// between two frames is never lost and never counted twice.
//
// M and Escape are NOT handled here: the screen manager owns them in a synchronous
// DOM keydown handler, so a map toggle can never be re-consumed by a later fixed step
// (the round-10 bug where M would not close the map).
export function createInput(canvas) {
  const down = new Set();
  const edges = new Set();
  let mouseDown = false;
  let mouseDownEdge = false;
  let dragDX = 0;
  let dragDY = 0;
  let dragging = false;
  // Click vs drag: a left-drag rotates the camera, a left-click fires. Before
  // this, every camera drag also fired the equipped gun (the test's walk
  // steering shot a police car and stacked wanted to 3 — and a real player
  // would spray bullets every time they looked around).
  let downX = 0;
  let downY = 0;
  let downT = 0;
  let downDist = 0;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    down.add(event.code);
    edges.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    down.delete(event.code);
  });
  window.addEventListener('blur', () => {
    down.clear();
    edges.clear();
    mouseDown = false;
    mouseDownEdge = false;
    dragging = false;
  });

  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouseDown = true;
      dragging = true;
      downX = event.clientX;
      downY = event.clientY;
      downT = performance.now();
      downDist = 0;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) {
      mouseDown = false;
      dragging = false;
      // A click (short, barely moved) fires once; a drag only rotated the camera.
      if (downDist <= 6 && performance.now() - downT < 400) mouseDownEdge = true;
    }
  });
  window.addEventListener('mousemove', (event) => {
    if (dragging) {
      dragDX += event.movementX || 0;
      dragDY += event.movementY || 0;
      downDist += Math.abs(event.movementX || 0) + Math.abs(event.movementY || 0);
      if (downDist > 6) mouseDown = false; // dragging — not a held trigger
    }
  });

  return {
    down(code) { return down.has(code); },
    // Take a queued edge once; returns true only on the first read after the press.
    take(code) {
      if (edges.has(code)) { edges.delete(code); return true; }
      return false;
    },
    hasEdge(code) { return edges.has(code); },
    // Discard a queued edge (used by the screen manager for M / Escape).
    discard(code) { edges.delete(code); },
    clearEdges() { edges.clear(); },
    mouseDown() { return mouseDown; },
    takeMouseDown() {
      if (mouseDownEdge) { mouseDownEdge = false; return true; }
      return false;
    },
    // Accumulated mouse-drag deltas since the last read; the camera consumes them.
    takeDrag() {
      const d = { dx: dragDX, dy: dragDY };
      dragDX = 0;
      dragDY = 0;
      return d;
    },
    // WASD / arrows steering, camera-relative: forward, strafe, plus sprint + jump state.
    moveVector() {
      let f = 0;
      let s = 0;
      if (down.has('KeyW') || down.has('ArrowUp')) f += 1;
      if (down.has('KeyS') || down.has('ArrowDown')) f -= 1;
      if (down.has('KeyA') || down.has('ArrowLeft')) s -= 1;
      if (down.has('KeyD') || down.has('ArrowRight')) s += 1;
      return { f, s, sprint: down.has('ShiftLeft') || down.has('ShiftRight') };
    },
  };
}
