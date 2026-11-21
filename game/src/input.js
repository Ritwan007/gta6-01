// VELORA HEAT — keyboard + mouse input. Keys tracked by e.code.
export class Input {
  constructor() {
    this.keys = new Set();
    this.mouse = { x: 640, y: 360, down: false };
    this.clickQueued = false; // a real click that a 60 Hz poll must not miss
    this.pressed = new Set(); // edge-triggered keys, consumed each frame
    this.handlers = {};
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      const h = this.handlers[e.code];
      if (h) { h(); e.preventDefault(); }
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
    window.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    window.addEventListener('mousedown', (e) => { if (e.button === 0) { this.mouse.down = true; this.clickQueued = true; } });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  down(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  endFrame() { this.pressed.clear(); }
  on(code, fn) { this.handlers[code] = fn; }
  axis(neg, pos) { return (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0); }
}
