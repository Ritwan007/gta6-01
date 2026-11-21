// VELORA HEAT — 100% synthesized WebAudio: engine hum, sirens, gunshots per
// weapon class, thuds, cha-ching, mission stings and a small ambient loop.
// No audio files, no network. Created lazily on first user gesture; every
// call is guarded so a headless browser without audio never throws.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }
  function unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {}); }
  window.addEventListener('pointerdown', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g); g.connect(master);
      osc.start(t); osc.stop(t + dur + 0.02);
    } catch { /* audio is decoration, never fatal */ }
  }
  function noise(dur, vol, filterFreq) {
    if (!ensure()) return;
    try {
      const t = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = filterFreq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter); filter.connect(g); g.connect(master);
      src.start(t);
    } catch { /* ignore */ }
  }

  return {
    unlock,
    shot(kind) {
      if (kind === 'pistol') { noise(0.12, 0.5, 3200); tone(220, 0.08, 'square', 0.25, 90); }
      else if (kind === 'smg') { noise(0.07, 0.35, 4200); tone(300, 0.05, 'square', 0.18, 120); }
      else if (kind === 'shotgun') { noise(0.3, 0.7, 1400); tone(140, 0.2, 'sawtooth', 0.35, 50); }
      else { noise(0.09, 0.3, 900); tone(120, 0.08, 'sine', 0.3, 60); }
    },
    melee() { tone(110, 0.12, 'sine', 0.4, 55); },
    click() { tone(880, 0.05, 'sine', 0.15); },
    chaChing() { tone(1320, 0.12, 'sine', 0.25); setTimeout(() => tone(1760, 0.18, 'sine', 0.25), 90); },
    stingGood() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.3), i * 110)); },
    stingBad() { [330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sawtooth', 0.2), i * 130)); },
    siren(on) {
      if (!ensure()) return;
      try {
        if (on && !this._siren) {
          const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 700;
          const g = ctx.createGain(); g.gain.value = 0.05;
          const lfo = ctx.createOscillator(); lfo.frequency.value = 0.6;
          const lg = ctx.createGain(); lg.gain.value = 250;
          lfo.connect(lg); lg.connect(osc.frequency);
          osc.connect(g); g.connect(master);
          osc.start(); lfo.start();
          this._siren = { osc, lfo, g };
        } else if (!on && this._siren) {
          this._siren.osc.stop(); this._siren.lfo.stop();
          this._siren.g.disconnect();
          this._siren = null;
        }
      } catch { /* ignore */ }
    },
    engine(speed01) {
      if (!ensure()) return;
      try {
        if (!engineOsc) {
          engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
          engineGain = ctx.createGain(); engineGain.gain.value = 0;
          const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
          engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
          engineOsc.start();
        }
        engineOsc.frequency.value = 60 + speed01 * 160;
        engineGain.gain.value = speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0;
      } catch { /* ignore */ }
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      const bass = [110, 110, 131, 98, 110, 147, 131, 98];
      musicTimer = setInterval(() => {
        if (!ctx) return;
        const f = bass[musicStep % bass.length];
        tone(f, 0.5, 'triangle', 0.12);
        if (musicStep % 4 === 0) tone(f * 2, 0.3, 'sine', 0.06);
        musicStep += 1;
      }, 420);
    },
  };
}
