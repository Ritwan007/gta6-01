// Procedural canvas textures — no image assets anywhere. Facades with lit windows,
// road markings, shop signs and billboards, all drawn once at boot from a seeded RNG.
import * as THREE from 'three';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function makeTextures(rng) {
  // One facade per district palette, reused across its buildings.
  const facades = {};
  const palettes = {
    pier: ['#7a5a44', '#8a6a52', '#6a4a3a'],
    neon: ['#c25a7a', '#7a5ac2', '#3c8ab2'],
    terrace: ['#b28a5a', '#a07a4a', '#c2a06a'],
    marina: ['#5ab2c2', '#4a9ab2', '#6ac2d2'],
    crown: ['#8a7ab2', '#7a6aa2', '#9a8ac2'],
  };
  for (const [key, colors] of Object.entries(palettes)) {
    const base = colors[Math.floor(rng.next() * colors.length)];
    facades[key] = canvasTexture(128, 256, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      // Subtle vertical shading + a darker ground floor.
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(255,220,160,0.25)'); grad.addColorStop(1, 'rgba(0,0,0,0.35)');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, h - 26, w, 26);
      // Lit windows: golden-hour glow, some dark.
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 4; col++) {
          const lit = rng.next() < 0.55;
          g.fillStyle = lit ? (rng.next() < 0.7 ? '#ffd27a' : '#ffe9b0') : 'rgba(10,10,20,0.55)';
          g.fillRect(10 + col * 30, 12 + row * 26, 20, 16);
        }
      }
    });
  }

  // Asphalt with a centre dash, tiled along streets.
  const road = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#33333a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3d3d44';
    for (let i = 0; i < 40; i++) g.fillRect(rng.next() * w, rng.next() * h, 3, 3);
    g.fillStyle = '#d8c25a'; g.fillRect(w / 2 - 3, 0, 6, 34);
    g.fillStyle = '#d8c25a'; g.fillRect(w / 2 - 3, 64, 6, 34);
    g.fillStyle = '#e8e8e8'; g.fillRect(4, 0, 3, h); g.fillRect(w - 7, 0, 3, h);
  });
  road.wrapS = THREE.RepeatWrapping; road.wrapT = THREE.RepeatWrapping;

  const sidewalk = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#8a7a6a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke();
      g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke();
    }
  });
  sidewalk.wrapS = THREE.RepeatWrapping; sidewalk.wrapT = THREE.RepeatWrapping;

  // Shop signs: bold text on a bright board, one per shop.
  function signTexture(text, bg, fg) {
    return canvasTexture(256, 64, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = fg; g.font = 'bold 34px Trebuchet MS, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2 + 1);
      g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6);
    });
  }
  const signs = {
    sunmart: signTexture('SUNMART', '#e8b13c', '#201408'),
    noodle: signTexture('NOODLE HOUSE', '#c23c2a', '#ffe9b0'),
    ammo: signTexture('AMMO DEPOT', '#3c5a2a', '#d2ffb0'),
    clinic: signTexture('CASA PALMA', '#2a7a8a', '#ffffff'),
    garage: signTexture('SORREN MOTORS', '#1a1a2a', '#ffb03c'),
    pier: signTexture('OLD PIER', '#5a3a2a', '#ffd27a'),
    hideout: signTexture('HIDEOUT', '#2a3a2a', '#7dff8a'),
  };

  // Golden-hour sky gradient for the scene background.
  const sky = canvasTexture(16, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2a3a6a'); grad.addColorStop(0.45, '#c25a6a');
    grad.addColorStop(0.7, '#ff9a4a'); grad.addColorStop(1, '#ffd27a');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });

  return { facades, road, sidewalk, signs, sky };
}
