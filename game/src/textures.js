// textures.js — every texture in Port Meridian is painted on a canvas at boot:
// lit tower windows, asphalt, road markings, palm fronds, neon signs and the
// soft round glow sprites behind every light. No image files, no network —
// the painter functions here are the game's whole art department for surfaces.

import * as THREE from 'three';

function canvasOf(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext('2d')];
}

function toTexture(canvas, repeat) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  texture.anisotropy = 4;
  return texture;
}

/**
 * A tower facade: dark glass and concrete with a grid of windows, a seeded
 * share of them lit. `palette` shifts the lit windows (warm homes, cool
 * offices, one neon-tinted variant for the entertainment blocks).
 */
export function buildingFacade(rng, palette) {
  const [canvas, ctx] = canvasOf(256, 512);
  const base = ctx.createLinearGradient(0, 0, 0, 512);
  base.addColorStop(0, '#232838');
  base.addColorStop(1, '#141824');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 512);
  // Ground floor: a brighter band of lobby glass.
  ctx.fillStyle = '#2d3850';
  ctx.fillRect(0, 470, 256, 42);
  const cols = 8;
  const rows = 16;
  const cellW = 256 / cols;
  const cellH = 470 / rows;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const lit = rng.chance(palette.litShare);
      const px = x * cellW + 5;
      const py = y * cellH + 5;
      if (lit) {
        ctx.fillStyle = rng.pick(palette.lit);
        ctx.globalAlpha = rng.range(0.55, 1);
      } else {
        ctx.fillStyle = '#0d1017';
        ctx.globalAlpha = 1;
      }
      ctx.fillRect(px, py, cellW - 10, cellH - 9);
      ctx.globalAlpha = 1;
    }
  }
  // Lobby windows.
  ctx.fillStyle = '#ffd9a0';
  for (let x = 0; x < 6; x += 1) {
    ctx.globalAlpha = rng.range(0.5, 0.95);
    ctx.fillRect(10 + x * 42, 478, 30, 26);
  }
  ctx.globalAlpha = 1;
  return toTexture(canvas);
}

export const FACADE_PALETTES = [
  { litShare: 0.5, lit: ['#ffd9a0', '#ffe9c4', '#ffb46b', '#cfe4ff'] },
  { litShare: 0.38, lit: ['#bcd8ff', '#e8f2ff', '#9fd0ff', '#ffe2b0'] },
  { litShare: 0.58, lit: ['#ff9ff3', '#ffd9a0', '#7ef0ff', '#ffe9c4', '#ff7eb6'] },
];

/** Asphalt with a little noise, tiled small so it never looks flat. */
export function asphaltTexture(rng) {
  const [canvas, ctx] = canvasOf(128, 128);
  ctx.fillStyle = '#232836';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i += 1) {
    ctx.fillStyle = rng.chance(0.5) ? '#1e222e' : '#14161f';
    ctx.fillRect(rng.int(0, 127), rng.int(0, 127), 2, 2);
  }
  return toTexture(canvas, true);
}

/**
 * One road segment texture, drawn across its width: kerb lines at the edges
 * and a dashed centre line. Roads repeat it along their length; the segment
 * is 16 m long so the dashes land at a believable spacing.
 */
export function roadTexture() {
  const [canvas, ctx] = canvasOf(128, 128);
  ctx.fillStyle = '#1b1f2c';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#e8e4da';
  ctx.fillRect(3, 0, 3, 128);
  ctx.fillRect(122, 0, 3, 128);
  ctx.fillStyle = '#f7c948';
  ctx.fillRect(62, 8, 4, 48);
  return toTexture(canvas, true);
}

/** Pale concrete for the block islands (sidewalks) the towers stand on. */
export function concreteTexture(rng) {
  const [canvas, ctx] = canvasOf(128, 128);
  ctx.fillStyle = '#3a3f4d';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i += 1) {
    ctx.fillStyle = rng.chance(0.5) ? '#424857' : '#333845';
    ctx.fillRect(rng.int(0, 127), rng.int(0, 127), 2, 2);
  }
  ctx.strokeStyle = '#2c303c';
  ctx.strokeRect(0, 0, 128, 128);
  return toTexture(canvas, true);
}

/** Beach sand, warm even under a night sky. */
export function sandTexture(rng) {
  const [canvas, ctx] = canvasOf(128, 128);
  ctx.fillStyle = '#8a6f4d';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i += 1) {
    ctx.fillStyle = rng.chance(0.5) ? '#97805c' : '#7d6443';
    ctx.fillRect(rng.int(0, 127), rng.int(0, 127), 2, 2);
  }
  return toTexture(canvas, true);
}

/** One palm frond, drawn as tapering leaflets on a stem, with alpha. */
export function palmFrondTexture() {
  const [canvas, ctx] = canvasOf(128, 128);
  ctx.clearRect(0, 0, 128, 128);
  ctx.strokeStyle = '#1d5c38';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(4, 120);
  ctx.quadraticCurveTo(50, 60, 124, 30);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 15; i += 1) {
    const t = i / 15;
    const x = 10 + t * 105;
    const y = 112 - t * 78 - Math.sin(t * Math.PI) * 8;
    ctx.strokeStyle = i % 2 ? '#267347' : '#1d5c38';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 8, y + 20 + t * 8);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A soft radial glow, the sprite behind headlights, lamps and neon. */
export function glowTexture() {
  const [canvas, ctx] = canvasOf(128, 128);
  const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

/**
 * A neon sign: the text drawn twice, blurred wide in its colour and sharp in
 * near-white, the way a real tube sign blooms. Returns a texture sized to the
 * text so signs keep their proportions on any building.
 */
export function neonSignTexture(text, color) {
  const font = 'bold 64px Arial, sans-serif';
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const width = Math.ceil(measure.measureText(text).width) + 48;
  const [canvas, ctx] = canvasOf(width, 110);
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 26;
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, 56);
  ctx.fillText(text, width / 2, 56);
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.9;
  ctx.fillText(text, width / 2, 56);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, aspect: width / 110 };
}
