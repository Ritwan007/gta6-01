// 100% synthesised WebAudio: no audio files anywhere. Engine hum by speed, a two-tone
// siren, one shot sound per weapon class, thuds, cha-ching, mission stings, UI clicks and
// a small oscillator music loop. Everything is guarded: no AudioContext exists until the
// first user gesture, and a failure anywhere silences the system instead of throwing.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenOn = false;
  let sirenHigh = false;
  let sirenTimer = 0;
  let muted = false;
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
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted || !ctx) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(master);
      o.start();
      o.stop(ctx.currentTime + dur + 0.02);
    } catch { /* silence on any audio failure */ }
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted || !ctx) return;
    try {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq || 1200;
      const g = ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start();
    } catch { /* silence */ }
  }

  // A tiny sun-soaked bass line + pluck loop, 8 steps, ~100 BPM.
  const BASS = [110, 0, 130.8, 0, 98, 0, 146.8, 0];
  const PLUCK = [440, 0, 523.25, 659.25, 0, 523.25, 392, 0];

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.35; },

    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = window.setInterval(() => {
        if (muted || !ctx) return;
        const b = BASS[musicStep % BASS.length];
        const p = PLUCK[musicStep % PLUCK.length];
        if (b) tone(b, 0.22, 'triangle', 0.10);
        if (p) tone(p, 0.14, 'square', 0.045);
        musicStep += 1;
      }, 300);
    },
    stopMusic() {
      if (musicTimer) { window.clearInterval(musicTimer); musicTimer = null; }
    },

    engine(speed01) {
      if (!ensure() || muted) { if (engineGain) engineGain.gain.value = 0; return; }
      try {
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineOsc.type = 'sawtooth';
          engineGain = ctx.createGain();
          engineGain.gain.value = 0;
          const f = ctx.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = 500;
          engineOsc.connect(f);
          f.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        engineOsc.frequency.value = 55 + speed01 * 130;
        engineGain.gain.value = 0.02 + speed01 * 0.05;
      } catch { /* silence */ }
    },
    engineOff() { if (engineGain) engineGain.gain.value = 0; },

    siren(dt, wanted) {
      if (!ensure() || muted) return;
      try {
        if (wanted <= 0) {
          sirenOn = false;
          if (sirenGain) sirenGain.gain.value = 0;
          return;
        }
        if (!sirenOsc) {
          sirenOsc = ctx.createOscillator();
          sirenOsc.type = 'sine';
          sirenGain = ctx.createGain();
          sirenGain.gain.value = 0;
          sirenOsc.connect(sirenGain);
          sirenGain.connect(master);
          sirenOsc.start();
        }
        sirenTimer += dt;
        if (sirenTimer > 0.42) {
          sirenTimer = 0;
          sirenHigh = !sirenHigh;
          sirenOn = true;
        }
        sirenOsc.frequency.value = sirenHigh ? 880 : 660;
        sirenGain.gain.value = 0.035;
      } catch { /* silence */ }
    },

    shot(kind) {
      if (kind === 'pistol') { noise(0.09, 0.5, 2600); tone(180, 0.07, 'square', 0.18, 60); }
      else if (kind === 'smg') { noise(0.06, 0.4, 3200); tone(220, 0.05, 'square', 0.12, 90); }
      else if (kind === 'shotgun') { noise(0.22, 0.7, 900); tone(110, 0.18, 'sine', 0.3, 40); }
      else if (kind === 'thud') { noise(0.12, 0.5, 400); tone(90, 0.1, 'sine', 0.25, 45); }
    },
    click() { tone(700, 0.05, 'square', 0.08); },
    chaChing() { tone(880, 0.09, 'sine', 0.16); window.setTimeout(() => tone(1320, 0.16, 'sine', 0.16), 90); },
    sting(kind) {
      if (kind === 'mission') { [523, 659, 784].forEach((f, i) => window.setTimeout(() => tone(f, 0.22, 'triangle', 0.16), i * 110)); }
      else if (kind === 'fail') { [330, 262, 196].forEach((f, i) => window.setTimeout(() => tone(f, 0.25, 'sawtooth', 0.12), i * 130)); }
      else if (kind === 'complete') { [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => tone(f, 0.28, 'triangle', 0.18), i * 120)); }
      else if (kind === 'busted') { tone(220, 0.5, 'sawtooth', 0.15, 110); }
    },
    crash() { noise(0.25, 0.6, 700); },
    skid() { noise(0.15, 0.15, 1800); },
    pickup() { tone(1046, 0.1, 'sine', 0.14); window.setTimeout(() => tone(1568, 0.14, 'sine', 0.12), 70); },
    reload() { tone(500, 0.05, 'square', 0.1); window.setTimeout(() => tone(650, 0.05, 'square', 0.1), 120); },
  };
}
