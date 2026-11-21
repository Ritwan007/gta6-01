// VELORA HEAT — 100% synthesized WebAudio. No audio files, no network.
// Engine hum by speed, two-tone VBPD siren, per-class gunshots, thud, cha-ching,
// mission stings, UI clicks, and a small bassline music loop.
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null;
  let musicTimer = null, musicStep = 0, enabled = true;
  const MUSIC = [55, 0, 55, 65.41, 0, 55, 49, 58.27, 55, 0, 55, 65.41, 73.42, 65.41, 58.27, 49];

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 60;
      engineGain = ctx.createGain(); engineGain.gain.value = 0; engineOsc.connect(engineGain); engineGain.connect(master); engineOsc.start();
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0; sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
      return true;
    } catch { ctx = null; return false; }
  }
  function unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); startMusic(); }
  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ensure() || !enabled) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, freq, when = 0) {
    if (!ensure() || !enabled) return;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start(t0);
  }
  function startMusic() {
    if (musicTimer || !ctx) return;
    musicTimer = setInterval(() => {
      if (!enabled || document.hidden) return;
      const f = MUSIC[musicStep % MUSIC.length];
      musicStep++;
      if (f) tone(f, 0.22, 'triangle', 0.10);
      if (musicStep % 4 === 0) tone(110, 0.1, 'sine', 0.08);
    }, 240);
  }
  let sirenPhase = 0;
  return {
    unlock,
    setEnabled(v) { enabled = v; if (master) master.gain.value = v ? 0.35 : 0; },
    engine(speed01, inCar) {
      if (!ctx || !enabled) return;
      engineGain.gain.value = inCar ? 0.05 + speed01 * 0.10 : 0;
      engineOsc.frequency.value = 55 + speed01 * 130;
    },
    siren(on, dt) {
      if (!ctx || !enabled) { if (sirenGain) sirenGain.gain.value = 0; return; }
      sirenPhase += dt;
      if (on) { sirenGain.gain.value = 0.045; sirenOsc.frequency.value = (Math.floor(sirenPhase * 2.2) % 2 === 0) ? 660 : 880; }
      else sirenGain.gain.value = 0;
    },
    shot(kind) {
      if (kind === 'pistol') { noise(0.09, 0.5, 2400); tone(180, 0.07, 'square', 0.22, 0, 60); }
      else if (kind === 'smg') { noise(0.06, 0.38, 3000); tone(220, 0.05, 'square', 0.16, 0, 80); }
      else if (kind === 'shotgun') { noise(0.28, 0.7, 1400); tone(120, 0.22, 'square', 0.3, 0, 40); }
      else if (kind === 'thud') { noise(0.08, 0.4, 500); tone(90, 0.1, 'sine', 0.3, 0, 45); }
      else if (kind === 'enemy') { noise(0.07, 0.28, 2000); }
    },
    crash() { noise(0.25, 0.55, 900); tone(70, 0.25, 'sine', 0.3, 0, 35); },
    click() { tone(880, 0.05, 'sine', 0.15); },
    chaChing() { tone(1320, 0.09, 'sine', 0.2); tone(1760, 0.14, 'sine', 0.2, 0.09); },
    stingGood() { [523, 659, 784].forEach((f, i) => tone(f, 0.22, 'triangle', 0.2, i * 0.11)); },
    stingBad() { [330, 262, 196].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.14, i * 0.12)); },
    reload() { tone(500, 0.05, 'square', 0.12); tone(700, 0.05, 'square', 0.12, 0.12); },
    busted() { tone(440, 0.4, 'sawtooth', 0.2, 0, 220); },
  };
}
