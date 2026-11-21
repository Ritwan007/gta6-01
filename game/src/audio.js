// VELORA HEAT — 100% synthesised WebAudio: engine, siren, gunshots, stings.
// No audio files, no network. Everything is guarded so a missing AudioContext
// (headless test runs) never breaks the game.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sirenOn = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.musicTimer = 0;
    this.musicStep = 0;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 50;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch { this.ctx = null; }
  }
  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + dur);
      g.gain.value = vol || 0.2;
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g); g.connect(this.master);
      o.start(); o.stop(this.ctx.currentTime + dur);
    } catch { /* ignore */ }
  }
  noise(dur, vol, lowpass) {
    if (!this.ctx) return;
    try {
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = vol || 0.3;
      if (lowpass) {
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = lowpass;
        src.connect(f); f.connect(g); g.connect(this.master);
      } else { src.connect(g); g.connect(this.master); }
      src.start();
    } catch { /* ignore */ }
  }
  shot(kind) {
    if (kind === 'pistol') { this.noise(0.09, 0.4, 3000); this.blip(180, 0.08, 'square', 0.15, 60); }
    else if (kind === 'smg') { this.noise(0.06, 0.3, 4000); this.blip(240, 0.05, 'square', 0.1, 90); }
    else if (kind === 'shotgun') { this.noise(0.22, 0.55, 1200); this.blip(90, 0.18, 'sawtooth', 0.25, 40); }
    else this.blip(120, 0.08, 'sine', 0.2, 60);
  }
  thud() { this.blip(70, 0.12, 'sine', 0.3, 40); }
  click() { this.blip(800, 0.05, 'square', 0.08); }
  chaChing() { this.blip(880, 0.12, 'sine', 0.2); setTimeout(() => this.blip(1320, 0.2, 'sine', 0.2), 90); }
  sting(win) {
    const seq = win ? [523, 659, 784, 1046] : [392, 330, 262, 196];
    seq.forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.18), i * 110));
  }
  setEngine(speed, top) {
    if (!this.ctx || !this.engineOsc) return;
    const r = Math.abs(speed) / Math.max(1, top);
    this.engineOsc.frequency.value = 45 + r * 130;
    this.engineGain.gain.value = speed !== 0 ? 0.03 + r * 0.05 : 0;
  }
  siren(on) {
    this.sirenOn = on;
    if (!this.ctx) return;
    if (on && !this._sirenTimer) {
      let hi = false;
      this._sirenTimer = setInterval(() => { hi = !hi; this.blip(hi ? 950 : 700, 0.28, 'sine', 0.05); }, 300);
    } else if (!on && this._sirenTimer) {
      clearInterval(this._sirenTimer);
      this._sirenTimer = null;
    }
  }
  music(dt) {
    // Sparse bassline loop on the title screen, one note per beat.
    if (!this.ctx) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.42;
    const scale = [55, 55, 65.4, 49];
    this.blip(scale[this.musicStep % 4], 0.36, 'triangle', 0.07);
    this.musicStep += 1;
  }
}
