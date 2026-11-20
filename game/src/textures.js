// Procedural canvas textures: building facades with lit windows, the ground with roads
// and sidewalks, shop signs and billboards. No image files anywhere — every texture is
// drawn by code, so the whole look is authored.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { range } from './random.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(c, repeatX, repeatY) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  if (repeatX) t.repeat.set(repeatX, repeatY || 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// A facade: base colour, a darker ground floor, rows of windows — some lit gold
// (golden hour), some dark — plus a cornice line at the top.
export function makeFacadeTexture(rng, baseColor, floors) {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 256, 256);
  // subtle vertical shading
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.18)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  // ground floor: shopfront band
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.fillRect(0, 224, 256, 32);
  const rows = Math.max(2, Math.min(9, floors));
  const cols = 5;
  const cellW = 256 / cols;
  const cellH = 224 / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let col = 0; col < cols; col += 1) {
      const lit = rng() < 0.45;
      g.fillStyle = lit ? '#ffd88a' : (rng() < 0.5 ? '#2a2f3d' : '#3d4a63');
      g.fillRect(col * cellW + 7, r * cellH + 8, cellW - 14, cellH - 16);
      if (lit) {
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(col * cellW + 7, r * cellH + 8, cellW - 14, 4);
      }
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 0, 256, 6);
  return toTexture(c);
}

// The ground: one big texture for the whole city. Asphalt roads on the street grid,
// pale sidewalks beside them, district-tinted block interiors, lane dashes.
export function makeGroundTexture(rng) {
  const S = 1024;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const W = WORLD.size;
  const toPx = (v) => ((v + W / 2) / W) * S;
  const roadHalfPx = (WORLD.roadHalf / W) * S;

  g.fillStyle = '#5a5148';
  g.fillRect(0, 0, S, S);
  // block interiors: district ground tints
  for (let bx = -360; bx <= 240; bx += 120) {
    for (let bz = -360; bz <= 240; bz += 120) {
      const cx = bx + 60;
      const cz = bz + 60;
      const shade = 0.85 + rng() * 0.3;
      g.fillStyle = `rgb(${Math.floor(96 * shade)},${Math.floor(88 * shade)},${Math.floor(76 * shade)})`;
      g.fillRect(toPx(bx + 9), toPx(bz + 9), (102 / W) * S, (102 / W) * S);
    }
  }
  // roads
  g.fillStyle = '#33333a';
  for (const s of WORLD.streets) {
    g.fillRect(0, toPx(s - WORLD.roadHalf), S, roadHalfPx * 2);
    g.fillRect(toPx(s - WORLD.roadHalf), 0, roadHalfPx * 2, S);
  }
  // sidewalks: pale bands along every road edge
  g.fillStyle = '#8a8378';
  for (const s of WORLD.streets) {
    g.fillRect(0, toPx(s - WORLD.roadHalf - 3), S, 3);
    g.fillRect(0, toPx(s + WORLD.roadHalf), S, 3);
    g.fillRect(toPx(s - WORLD.roadHalf - 3), 0, 3, S);
    g.fillRect(toPx(s + WORLD.roadHalf), 0, 3, S);
  }
  // centre dashes
  g.fillStyle = '#d8c94a';
  g.setLineDash([14, 18]);
  g.lineWidth = 3;
  for (const s of WORLD.streets) {
    g.beginPath(); g.moveTo(0, toPx(s)); g.lineTo(S, toPx(s)); g.stroke();
    g.beginPath(); g.moveTo(toPx(s), 0); g.lineTo(toPx(s), S); g.stroke();
  }
  g.setLineDash([]);
  // beach strip along the east edge (Marina Sol waterfront)
  g.fillStyle = '#d9c48f';
  g.fillRect(toPx(396), 0, S - toPx(396), S);
  g.fillStyle = '#3f7fa8';
  g.fillRect(toPx(408), 0, S - toPx(408), S);
  return toTexture(c);
}

// A shop sign: bold text on a coloured board, drawn once and stuck on a building face.
export function makeSignTexture(text, bg, fg) {
  const c = canvas(512, 128);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.fillRect(0, 0, 512, 10);
  g.fillStyle = fg;
  g.font = '900 64px "Segoe UI", Verdana, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  return toTexture(c);
}

// A tall billboard: two lines, big type, warm gradient.
export function makeBillboardTexture(line1, line2) {
  const c = canvas(512, 256);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#ff7a1a');
  grad.addColorStop(1, '#c22a6e');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#ffffff';
  g.font = '900 72px "Segoe UI", Verdana, sans-serif';
  g.textAlign = 'center';
  g.fillText(line1, 256, 100);
  g.font = '700 44px "Segoe UI", Verdana, sans-serif';
  g.fillText(line2, 256, 180);
  return toTexture(c);
}

// Soft round sprite used for dust puffs and muzzle flashes.
export function makeGlowTexture() {
  const c = canvas(64, 64);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,220,140,0.7)');
  grad.addColorStop(1, 'rgba(255,180,60,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return toTexture(c);
}

export function shadeColor(hex, f) {
  const r = Math.min(255, Math.floor(((hex >> 16) & 255) * f));
  const g2 = Math.min(255, Math.floor(((hex >> 8) & 255) * f));
  const b = Math.min(255, Math.floor((hex & 255) * f));
  return (r << 16) | (g2 << 8) | b;
}

export { range };
