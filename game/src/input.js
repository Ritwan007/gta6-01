// Keyboard + mouse input for VELORA HEAT (top-down).
// One-shot keys (E, M, Esc, R, digits) are handled SYNCHRONOUSLY in the DOM
// keydown listener by the callback the game registers — this is the fix for the
// classic "M does not close the map" bug: no queued edge can be re-consumed by a
// later fixed step. Held keys are read per frame.
export function createInput(canvas, hooks) {
  const keys = {};
  const mouse = { x: 0, y: 0, down: false, clicked: false, clickX: 0, clickY: 0 };
  let lastKeyAt = 0;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys[e.code] = true;
    lastKeyAt = performance.now();
    // Synchronous one-shot dispatch — never queued, never stale.
    if (e.code === 'KeyM') { hooks.onMap(); e.preventDefault(); return; }
    if (e.code === 'Escape') { hooks.onEscape(); e.preventDefault(); return; }
    if (e.code === 'KeyE') { hooks.onInteract(); e.preventDefault(); return; }
    if (e.code === 'KeyR') { hooks.onReload(); e.preventDefault(); return; }
    if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4') {
      hooks.onWeapon(Number(e.code.slice(5)) - 1);
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  }
  function onKeyUp(e) { keys[e.code] = false; }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  }
  function onMouseDown(e) {
    if (e.button !== 0) return;
    mouse.down = true; mouse.clicked = true;
    const r = canvas.getBoundingClientRect();
    mouse.clickX = e.clientX - r.left; mouse.clickY = e.clientY - r.top;
  }
  function onMouseUp() { mouse.down = false; }
  function onBlur() { for (const k in keys) keys[k] = false; mouse.down = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    keys, mouse,
    axis() {
      const x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      const z = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
      return { x, z };
    },
    sprint() { return !!(keys.ShiftLeft || keys.ShiftRight); },
    brake() { return !!keys.Space; },
    takeClick() { const c = mouse.clicked; mouse.clicked = false; return c; },
    lastKeyAt() { return lastKeyAt; },
  };
}
