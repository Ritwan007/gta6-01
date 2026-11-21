// audio.js — all sound is synthesized WebAudio: an engine whose pitch follows
// speed, a two-tone siren that swells as a cruiser closes in, chimes for
// pickups and gates, a sting for a paid job, and a quiet synth pad under the
// whole night. No audio files exist; the context opens on the first click or
// key, the way browsers require.

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenFlip = 0;
  }

  /** Open the context (call from a user gesture) and start the ambient pad. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    const padGain = ctx.createGain();
    padGain.gain.value = 0.016;
    padGain.connect(ctx.destination);
    for (const freq of [110, 164.8, 220.5]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      osc.connect(g).connect(padGain);
      osc.start();
    }

    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 40;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(engineFilter).connect(this.engineGain).connect(ctx.destination);
    this.engineOsc.start();

    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(ctx.destination);
    this.sirenOsc.start();
  }

  /** Per-frame levels: engine by speed, siren by the nearest cruiser. */
  update(dt, { driving, speedNorm, nearestPolice }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const engineTarget = driving ? 0.028 + speedNorm * 0.03 : 0;
    this.engineGain.gain.setTargetAtTime(engineTarget, t, 0.09);
    this.engineOsc.frequency.setTargetAtTime(42 + speedNorm * 165, t, 0.08);

    let sirenTarget = 0;
    if (nearestPolice !== null && nearestPolice < 60) {
      sirenTarget = 0.012 + (1 - nearestPolice / 60) * 0.03;
      this.sirenFlip += dt;
      if (this.sirenFlip > 0.42) {
        this.sirenFlip = 0;
        this.sirenOsc.frequency.setValueAtTime(this.sirenOsc.frequency.value > 760 ? 660 : 880, t);
      }
    }
    this.sirenGain.gain.setTargetAtTime(sirenTarget, t, 0.15);
  }

  blip(freq, seconds = 0.12, type = 'sine', gain = 0.06, when = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    const start = ctx.currentTime + when;
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(g).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  chime() {
    this.blip(880, 0.14, 'sine', 0.07);
    this.blip(1318, 0.2, 'sine', 0.06, 0.07);
  }

  success() {
    this.blip(523, 0.16, 'triangle', 0.08);
    this.blip(659, 0.16, 'triangle', 0.08, 0.11);
    this.blip(784, 0.3, 'triangle', 0.09, 0.22);
  }

  fail() {
    this.blip(220, 0.25, 'sawtooth', 0.05);
    this.blip(174, 0.4, 'sawtooth', 0.05, 0.16);
  }

  thud() {
    this.blip(72, 0.16, 'sine', 0.16);
  }

  click() {
    this.blip(1200, 0.05, 'square', 0.03);
  }
}
