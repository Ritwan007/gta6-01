// Tiny WebAudio synth — all sounds generated, no audio assets.
export class Sfx {
  constructor() { this.ctx = null; this.muted = false; this._rain = null; }
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }
  tone(freq, dur, type = 'sine', vol = 0.08, slide = 0) {
    if (this.muted) return;
    const ctx = this.ensure(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  }
  click() { this.tone(660, 0.06, 'square', 0.04); }
  pickup() { this.tone(880, 0.12, 'sine', 0.07, 440); }
  cash() { this.tone(990, 0.1, 'sine', 0.07); setTimeout(() => this.tone(1320, 0.14, 'sine', 0.07), 90); }
  shot() { this.tone(180, 0.09, 'sawtooth', 0.09, -120); }
  siren() { this.tone(700, 0.5, 'sine', 0.03, 300); }
  fail() { this.tone(220, 0.3, 'sawtooth', 0.06, -80); }
  engine(on) { /* engine hum is approximated by a low looped tone on start */ if (on) this.tone(55, 0.4, 'sawtooth', 0.03, 25); }
}
