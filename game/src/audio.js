// audio.js — the sounds of Port Meridian, synthesised with WebAudio.
// No audio files ship with the game: the engine is a detuned saw, the siren
// a two-tone square, and every blip, thud and jingle is built from
// oscillators and a noise buffer at play time.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.noise = null;
  }

  /** Must be called from a user gesture (the Start button). */
  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.42;
    this.master.connect(this.ctx.destination);
    // Engine: a saw through a lowpass, gain driven by throttle.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = "sawtooth";
    this.engineOsc.frequency.value = 55;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(engineFilter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();
    // Siren: a square wave whose pitch the update loop wobbles.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = "triangle";
    this.sirenOsc.frequency.value = 800;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();
    // A shared noise buffer for thuds.
    const len = this.ctx.sampleRate * 0.5;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }

  /** Per-frame engine voice. speed in m/s, throttle boolean. */
  engine(speed, throttle) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    const rpm = 55 + Math.abs(speed) * 6.5;
    this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.06);
    const target = throttle ? 0.16 : Math.abs(speed) > 0.4 ? 0.07 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.09);
  }

  /** Per-frame siren voice: on while a cruiser is close and hunting. */
  siren(on, elapsed) {
    if (!this.ctx || !this.sirenOsc) return;
    const t = this.ctx.currentTime;
    if (on) {
      this.sirenOsc.frequency.setTargetAtTime(720 + Math.sin(elapsed * 5.2) * 190, t, 0.03);
      this.sirenGain.gain.setTargetAtTime(0.045, t, 0.1);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, t, 0.15);
    }
    this.sirenOn = on;
  }

  tone(freq, dur, type = "sine", gain = 0.16, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  blip(freq = 760, dur = 0.08) {
    this.tone(freq, dur, "sine", 0.14);
  }

  cash() {
    this.tone(1180, 0.09, "square", 0.08);
    this.tone(1560, 0.14, "square", 0.08, 0.07);
  }

  jingle() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, "triangle", 0.15, i * 0.11));
  }

  enter() {
    this.tone(190, 0.1, "sine", 0.12);
    this.tone(320, 0.08, "sine", 0.08, 0.05);
  }

  thud(strength = 0.6) {
    if (!this.ctx || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const g = this.ctx.createGain();
    g.gain.value = Math.min(0.5, 0.16 + strength * 0.05);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 300;
    src.connect(filter).connect(g).connect(this.master);
    src.start();
    src.stop(this.ctx.currentTime + 0.22);
  }
}
