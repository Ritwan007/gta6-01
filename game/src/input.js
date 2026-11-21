// input.js — keyboard and mouse state for the game loop: held keys by code,
// edge-triggered presses (for E to enter a car, M for the map, P to pause),
// and drag-to-orbit mouse deltas with wheel zoom. The loop polls; nothing
// here knows what any key means.

export class Input {
  constructor(element) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.dragging = false;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    element.addEventListener('mousedown', (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      this.mouseDX += e.clientX - this.lastX;
      this.mouseDY += e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => {
      this.dragging = false;
    });
    element.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.wheel += Math.sign(e.deltaY);
      },
      { passive: false },
    );
  }

  down(code) {
    return this.keys.has(code);
  }

  /** True once per physical press; the loop clears presses every frame. */
  wasPressed(code) {
    return this.pressed.has(code);
  }

  /** Read and reset the accumulated mouse movement. */
  takeMouse() {
    const out = { dx: this.mouseDX, dy: this.mouseDY, wheel: this.wheel };
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    return out;
  }

  endFrame() {
    this.pressed.clear();
  }

  /** Movement axes from the held keys: x = strafe right, y = forward. */
  axes() {
    const x = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
    const y = (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0) - (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0);
    return { x, y };
  }
}
