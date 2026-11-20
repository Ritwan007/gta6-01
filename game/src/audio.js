// 100% synthesised WebAudio — no audio files. Engine hum by speed, two-tone siren,
// per-class gunshots, thuds, cha-ching, mission stings and a small music loop.
// Everything is guarded: if the browser has no AudioContext (or it is blocked) the game
// simply plays silent.
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null, sirenTimer = 0;
  let musicTimer = null, musicStep = 0, muted = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(engineGain); engineGain.connect(master); engineOsc.start();
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
    } catch { ctx = null; }
    return ctx;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur + 0.02);
    } catch { /* silent */ }
  }

  function noise(dur, vol, filterFreq, type = 'lowpass') {
    if (!ensure() || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
      const g = ctx.createGain(); g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(master); src.start();
    } catch { /* silent */ }
  }

  const MELODY = [220, 0, 277, 330, 0, 262, 294, 0, 330, 392, 0, 330, 294, 262, 220, 0];
  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    setMuted(m) { muted = m; if (engineGain) engineGain.gain.value = 0; if (sirenGain) sirenGain.gain.value = 0; },
    shot(kind) {
      if (kind === 'pistol') { noise(0.09, 0.5, 1800); blip(220, 0.06, 'square', 0.25, 60); }
      else if (kind === 'smg') { noise(0.06, 0.35, 2600); blip(320, 0.04, 'square', 0.18, 90); }
      else if (kind === 'shotgun') { noise(0.22, 0.8, 900); blip(120, 0.16, 'square', 0.4, 40); }
    },
    thud() { noise(0.12, 0.5, 300); blip(90, 0.1, 'sine', 0.4, 45); },
    chaChing() { blip(880, 0.09, 'sine', 0.3); setTimeout(() => blip(1318, 0.16, 'sine', 0.3), 90); },
    click() { blip(600, 0.05, 'square', 0.15); },
    sting(kind) {
      if (kind === 'good') { [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.3), i * 110)); }
      else if (kind === 'bad') { [330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'sawtooth', 0.22), i * 130)); }
      else { blip(440, 0.12, 'triangle', 0.25); setTimeout(() => blip(587, 0.18, 'triangle', 0.25), 120); }
    },
    setEngine(speed01, on) {
      if (!ensure() || muted) return;
      engineGain.gain.value = on ? 0.03 + speed01 * 0.06 : 0;
      engineOsc.frequency.value = 45 + speed01 * 110;
    },
    setSiren(on, dt) {
      if (!ensure() || muted) return;
      sirenGain.gain.value = on ? 0.045 : 0;
      if (on) {
        sirenTimer += dt;
        sirenOsc.frequency.value = (Math.floor(sirenTimer * 2) % 2 === 0) ? 660 : 880;
      }
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = setInterval(() => {
        if (muted || !ctx) return;
        const f = MELODY[musicStep % MELODY.length]; musicStep++;
        if (f) blip(f, 0.22, 'triangle', 0.08);
      }, 240);
    },
    stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
  };
}
