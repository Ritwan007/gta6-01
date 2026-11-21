// main.js — boot and frame loop. Parses the URL (?shot=<name>&seed=<n> is the
// screenshot harness mode), wires the title screen buttons and the global
// keys (Enter to resume, P/Esc pause, M big map), and drives the Game with a
// fixed-step accumulator so physics behaves the same at any frame rate.

import { Game } from './game.js';
import { prepareShot, poseShotCamera } from './shots.js';
import { AVENUES, STREETS, LANDMARKS as L } from './cityplan.js';

const params = new URLSearchParams(window.location.search);
const canvas = document.getElementById('game');
const status = document.getElementById('status');
const game = new Game(canvas, Number(params.get('seed') ?? 1) || 1);
window.__game = game;

const STEP = 1 / 60;
let accumulator = 0;
let lastTime = performance.now();

function frame(now) {
  const dtReal = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dtReal;
  let steps = 0;
  game.pressLive = true;
  while (accumulator >= STEP && steps < 4) {
    game.step(STEP);
    accumulator -= STEP;
    steps += 1;
  }
  if (steps === 4) accumulator = 0;
  game.input.endFrame();
  game.render();
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------ title screen
const continueBtn = document.getElementById('btn-continue');
if (!game.hasSave()) continueBtn.style.display = 'none';
document.getElementById('btn-new').addEventListener('click', () => {
  game.audio.unlock();
  game.startGame(false);
  status.textContent = 'Night started. Job 1: Neon Welcome.';
});
continueBtn.addEventListener('click', () => {
  game.audio.unlock();
  game.startGame(true);
  status.textContent = 'Night resumed from the last save.';
});

// ------------------------------------------------------------ global keys
const bigmap = document.getElementById('bigmap');
let bigmapOpen = false;

function drawBigMap() {
  const ctx = document.getElementById('bigmap-canvas').getContext('2d');
  const W = 760;
  const H = 600;
  const s = 1.28;
  const px = (x) => (x + 256) * s;
  const py = (z) => (z + 190) * s;
  ctx.fillStyle = '#0d2b26';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#123a5e';
  ctx.fillRect(px(252), 0, W - px(252), H);
  ctx.fillStyle = '#c2a878';
  ctx.fillRect(px(224), 0, px(252) - px(224), H);
  ctx.strokeStyle = '#2c2c38';
  ctx.lineWidth = 15;
  for (const x of AVENUES) {
    ctx.beginPath();
    ctx.moveTo(px(x), py(-176));
    ctx.lineTo(px(x), py(176));
    ctx.stroke();
  }
  for (const z of STREETS) {
    ctx.beginPath();
    ctx.moveTo(px(-240), py(z));
    ctx.lineTo(px(240), py(z));
    ctx.stroke();
  }
  ctx.fillStyle = '#f2ecff';
  ctx.font = '700 13px "Segoe UI", sans-serif';
  const label = (text, x, z) => ctx.fillText(text, px(x), py(z));
  label('PALMS ROYALE', L.hotelFront.x - 34, L.hotelFront.z - 26);
  label('CASINO CIELO', 62, -108);
  label('DOCKYARD', -196, 76);
  label("ZARA'S", -64, 88);
  label('SAFEHOUSE', -64, 122);
  label('THE PIER', 238, -152);
  label('MARINA', -196, 122);
  const focus = game.onFoot ? game.playerPos : game.car.pos;
  const target = game.director.stageTarget();
  if (target) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(px(target.x), py(target.z), 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#2e6fc2';
  for (const p of game.police.positions()) {
    ctx.beginPath();
    ctx.arc(px(p.x), py(p.z), 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#3dff8f';
  ctx.beginPath();
  ctx.arc(px(focus.x), py(focus.z), 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px(focus.x), py(focus.z), 10, 0, Math.PI * 2);
  ctx.stroke();
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'Enter') {
    if (game.mode === 'busted' || game.mode === 'complete') {
      game.mode = 'play';
      game.hud.hideBanner();
      status.textContent = 'Back to work.';
    }
  }
  if (event.code === 'KeyP' || event.code === 'Escape') {
    if (game.mode === 'play') {
      game.mode = 'paused';
      game.hud.banner('PAUSED', 'The city holds its breath. Press P to keep going.');
    } else if (game.mode === 'paused') {
      game.mode = 'play';
      game.hud.hideBanner();
    }
  }
  if (event.code === 'KeyM' && (game.mode === 'play' || bigmapOpen)) {
    bigmapOpen = !bigmapOpen;
    bigmap.style.display = bigmapOpen ? 'flex' : 'none';
    if (bigmapOpen) drawBigMap();
  }
});

// ------------------------------------------------------------ shot mode
const shot = params.get('shot');
if (shot) {
  document.getElementById('title-screen').style.display = 'none';
  const steps = prepareShot(game, shot);
  for (let i = 0; i < steps; i += 1) {
    game.pressLive = true;
    game.step(STEP);
  }
  game.input.endFrame();
  poseShotCamera(game, shot);
  game.updateHud(null);
  game.render();
  status.textContent = `Shot scene ready: ${shot}`;
  requestAnimationFrame(() => {
    game.render();
    window.__shotReady = true;
  });
} else {
  status.textContent = 'Leonida After Dark. Press New Night to start.';
  requestAnimationFrame(frame);
}
