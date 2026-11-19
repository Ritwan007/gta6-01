// Input: held keys + a pressed-edge set consumed via take(), cleared ONLY
// in endFrame() after all fixed steps have run. E registers held AND edge:
// a keydown queues EDGE_INTERACT first so an interact can never be lost
// between the poll and the fixed steps.
export class Input {
  constructor() {
    this.held = new Set();
    this.pressed = new Set();
    this.edgeQueue = [];
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseDown = false;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.held.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'KeyE') this.edgeQueue.unshift('EDGE_INTERACT');
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => { this.held.delete(e.code); };
    this._onMouseMove = (e) => { this.mouseDX += e.movementX || 0; this.mouseDY += e.movementY || 0; };
    this._onMouseDown = (e) => { if (e.button === 0) { this.mouseDown = true; this.pressed.add('Mouse0'); } };
    this._onMouseUp = (e) => { if (e.button === 0) this.mouseDown = false; };
    this._onBlur = () => { this.held.clear(); };
  }
  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }
  // Consume one queued edge (EDGE_INTERACT) or a pressed code. Returns bool.
  take(code) {
    if (code === 'EDGE_INTERACT') {
      const i = this.edgeQueue.indexOf('EDGE_INTERACT');
      if (i >= 0) { this.edgeQueue.splice(i, 1); return true; }
      return false;
    }
    if (this.pressed.has(code)) { this.pressed.delete(code); return true; }
    return false;
  }
  isHeld(code) { return this.held.has(code); }
  axis() {
    let x = 0, z = 0;
    if (this.held.has('KeyW') || this.held.has('ArrowUp')) z -= 1;
    if (this.held.has('KeyS') || this.held.has('ArrowDown')) z += 1;
    if (this.held.has('KeyA') || this.held.has('ArrowLeft')) x -= 1;
    if (this.held.has('KeyD') || this.held.has('ArrowRight')) x += 1;
    return { x, z };
  }
  consumeMouse() { const dx = this.mouseDX, dy = this.mouseDY; this.mouseDX = 0; this.mouseDY = 0; return { dx, dy }; }
  // ONLY place the pressed-edge set is cleared: end of frame, after every
  // fixed step has had its chance to take() edges.
  endFrame() { this.pressed.clear(); this.edgeQueue.length = 0; }
}
