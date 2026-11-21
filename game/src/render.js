// VELORA HEAT — drawing only: the world state in, pixels out. Top-down 2D,
// camera centred on the player, 14 px per metre, procedural everything.
import { DISTRICTS, GARAGE, HIDEOUT, MARINA, MART, SHOPS, STREETS } from './config.js';
import { playerCar } from './player.js';

const SCALE = 14;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 1280, H = 720;
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * ratio);
    canvas.height = Math.round(H * ratio);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function w2s(G, x, z) {
    return { x: (x - G.cam.x) * SCALE + W / 2, y: (z - G.cam.z) * SCALE + H / 2 };
  }
  function onScreen(x, y, m) {
    return x > -m && x < W + m && y > -m && y < H + m;
  }

  function drawCar(G, car) {
    const p = w2s(G, car.x, car.z);
    if (!onScreen(p.x, p.y, 80)) return;
    const L = car.len * SCALE, Wd = car.wid * SCALE;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-L / 2 + 3, -Wd / 2 + 3, L, Wd);
    // Body.
    ctx.fillStyle = car.hp <= 0 ? '#3a3a3a' : car.color;
    ctx.beginPath();
    ctx.roundRect(-L / 2, -Wd / 2, L, Wd, 6);
    ctx.fill();
    // Windshield + rear window.
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    ctx.fillRect(L * 0.08, -Wd / 2 + 2, L * 0.16, Wd - 4);
    ctx.fillRect(-L * 0.32, -Wd / 2 + 2, L * 0.12, Wd - 4);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(L / 2 - 2, -Wd / 2 + 2, 3, 5);
    ctx.fillRect(L / 2 - 2, Wd / 2 - 7, 3, 5);
    // Police light bar.
    if (car.kind === 'police') {
      const t = Math.floor(G.time * 4) % 2;
      ctx.fillStyle = t ? '#ff2020' : '#2080ff';
      ctx.fillRect(-4, -Wd / 2 - 1, 8, 5);
      ctx.fillStyle = t ? '#2080ff' : '#ff2020';
      ctx.fillRect(-4, Wd / 2 - 4, 8, 5);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VBPD', 0, 3);
    }
    // Owned / player car outline.
    if (G.player.inCar === car.id) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-L / 2 - 2, -Wd / 2 - 2, L + 4, Wd + 4, 8);
      ctx.stroke();
    }
    // Damage smoke.
    if (car.hp > 0 && car.hp < car.maxHp * 0.4) {
      ctx.fillStyle = 'rgba(120,120,120,0.6)';
      ctx.beginPath();
      ctx.arc(-L / 4 + (G.rng() - 0.5) * 8, 0, 5 + G.rng() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function draw(G) {
    ctx.fillStyle = '#20261f';
    ctx.fillRect(0, 0, W, H);
    const view = { x0: G.cam.x - W / 2 / SCALE, x1: G.cam.x + W / 2 / SCALE, z0: G.cam.z - H / 2 / SCALE, z1: G.cam.z + H / 2 / SCALE };
    // Ground blocks (grass/sidewalk between streets).
    ctx.fillStyle = '#46503f';
    for (let i = 0; i < STREETS.length - 1; i++) {
      for (let j = 0; j < STREETS.length - 1; j++) {
        const x0 = STREETS[i] + 9, x1 = STREETS[i + 1] - 9;
        const z0 = STREETS[j] + 9, z1 = STREETS[j + 1] - 9;
        const a = w2s(G, x0, z0), b = w2s(G, x1, z1);
        ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      }
    }
    // Roads.
    ctx.fillStyle = '#2c2f33';
    for (const s of STREETS) {
      const a = w2s(G, -352, s - 9), b = w2s(G, 352, s + 9);
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      const c = w2s(G, s - 9, -352), d = w2s(G, s + 9, 352);
      ctx.fillRect(c.x, c.y, d.x - c.x, d.y - c.y);
    }
    // Centre dashes.
    ctx.strokeStyle = '#c8b860';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 14]);
    for (const s of STREETS) {
      const a = w2s(G, -352, s), b = w2s(G, 352, s);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const c = w2s(G, s, -352), d = w2s(G, s, 352);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    // Marina water (east edge) + docks.
    const wA = w2s(G, 330, -352), wB = w2s(G, 352, 352);
    ctx.fillStyle = '#1d4e6e';
    ctx.fillRect(wA.x, wA.y, wB.x - wA.x, wB.y - wA.y);
    // District labels.
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (const d of DISTRICTS) {
      const c = w2s(G, (d.x0 + d.x1) / 2, (d.z0 + d.z1) / 2);
      if (onScreen(c.x, c.y, 100)) ctx.fillText(d.name.toUpperCase(), c.x, c.y);
    }
    // Buildings.
    for (const b of G.city.buildings) {
      const a = w2s(G, b.x, b.z);
      const bw = b.w * SCALE, bd = b.d * SCALE;
      if (!onScreen(a.x, a.y, Math.max(bw, bd))) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(a.x + 5, a.y + 5, bw, bd);
      ctx.fillStyle = b.wall;
      ctx.fillRect(a.x, a.y, bw, bd);
      ctx.fillStyle = b.roof;
      ctx.fillRect(a.x + 3, a.y + 3, bw - 6, bd - 6);
      ctx.fillStyle = 'rgba(255,220,120,0.75)';
      const cols = Math.max(2, Math.floor(b.w / 10));
      const rows = Math.max(2, Math.floor(b.d / 10));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if ((i * 7 + j * 13 + b.windows) % 3 === 0) {
            ctx.fillRect(a.x + 6 + (i * (bw - 12)) / cols, a.y + 6 + (j * (bd - 12)) / rows, 4, 4);
          }
        }
      }
    }
    // Garage lot.
    {
      const a = w2s(G, -308, -132), b = w2s(G, -220, -44);
      ctx.fillStyle = '#3d3a2e';
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = 2;
      ctx.strokeRect(a.x + 2, a.y + 2, b.x - a.x - 4, b.y - a.y - 4);
      const g = w2s(G, GARAGE.x, GARAGE.z);
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillStyle = '#f2c94c';
      ctx.textAlign = 'center';
      ctx.fillText('BENGKEL SARI', g.x, g.y - 34);
      // Garage slots.
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      for (const [sx, sz] of [[-244, -44], [-264, -44], [-284, -44], [-244, -64]]) {
        const s = w2s(G, sx, sz);
        ctx.strokeRect(s.x - 26, s.y - 16, 52, 32);
      }
    }
    // Shops.
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const s of SHOPS) {
      const p = w2s(G, s.x, s.z);
      if (!onScreen(p.x, p.y, 100)) continue;
      ctx.fillStyle = '#7a4a8e';
      ctx.fillRect(p.x - 42, p.y - 22, 84, 30);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(s.name, p.x, p.y - 4);
      ctx.fillStyle = '#f2c94c';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(s.rob ? 'TOKO — BISA DIRAMPOK' : 'TOKO', p.x, p.y + 12);
      ctx.font = 'bold 13px system-ui, sans-serif';
    }
    // Hideout containers.
    {
      const h = w2s(G, HIDEOUT.x, HIDEOUT.z);
      ctx.fillStyle = '#8a4a2a';
      ctx.fillRect(h.x - 30, h.y - 18, 60, 36);
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(h.x - 30, h.y - 18, 60, 8);
      ctx.fillStyle = '#f2c94c';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText('GUDANG', h.x, h.y - 24);
    }
    // Objective beacon: gold diamond + light column.
    const op = G.hud.objectivePoint();
    if (op && G.mode === 'play') {
      const p = w2s(G, op.x, op.z);
      if (onScreen(p.x, p.y, 60)) {
        ctx.fillStyle = 'rgba(255,215,0,0.18)';
        ctx.fillRect(p.x - 14, p.y - 130, 28, 130);
        ctx.fillStyle = '#ffd700';
        ctx.save();
        ctx.translate(p.x, p.y - 8);
        ctx.rotate(Math.PI / 4 + Math.sin(G.time * 2) * 0.15);
        ctx.fillRect(-8, -8, 16, 16);
        ctx.restore();
      }
    }
    // Race checkpoints.
    if (G.mission.active && G.mission.index === 4) {
      const cp = G.mission.raceCps[G.mission.playerCp];
      if (cp) {
        const p = w2s(G, cp[0], cp[1]);
        ctx.strokeStyle = '#00e0ff';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#00e0ff';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillText(`${G.mission.playerCp + 1}/12`, p.x, p.y - 22);
      }
    }
    // Peds.
    for (const ped of G.peds) {
      if (ped.hp <= 0) continue;
      const p = w2s(G, ped.x, ped.z);
      if (!onScreen(p.x, p.y, 20)) continue;
      ctx.fillStyle = ped.shirt;
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8c8a0';
      ctx.beginPath(); ctx.arc(p.x, p.y - 2, 3, 0, Math.PI * 2); ctx.fill();
      if (ped.state === 'flee') {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText('!', p.x, p.y - 12);
      } else if (ped.state === 'call') {
        ctx.fillStyle = '#ff8080';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText('☎', p.x, p.y - 12);
      }
    }
    // Enemies.
    for (const e of G.enemies) {
      if (e.hp <= 0) continue;
      const p = w2s(G, e.x, e.z);
      if (!onScreen(p.x, p.y, 30)) continue;
      ctx.fillStyle = '#c02020';
      ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#202020';
      ctx.beginPath(); ctx.arc(p.x, p.y - 2, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#400000';
      ctx.fillRect(p.x - 12, p.y - 16, 24, 4);
      ctx.fillStyle = '#ff4040';
      ctx.fillRect(p.x - 12, p.y - 16, 24 * Math.max(0, e.hp / e.maxHp), 4);
    }
    // Cars.
    for (const car of G.cars) drawCar(G, car);
    // Tracers.
    for (const t of G.tracers) {
      const a = w2s(G, t.x1, t.z1), b = w2s(G, t.x2, t.z2);
      ctx.strokeStyle = t.enemy ? 'rgba(255,80,80,0.9)' : 'rgba(255,230,120,0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // Player on foot.
    if (G.player.inCar == null) {
      const p = w2s(G, G.player.x, G.player.z);
      ctx.fillStyle = '#ffd75e';
      ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#202020';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(G.player.angle) * 14, p.y + Math.sin(G.player.angle) * 14);
      ctx.stroke();
      if (G.player.weapon !== 'fists') {
        ctx.strokeStyle = '#c8c8c8';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(p.x + Math.cos(G.player.angle) * 8, p.y + Math.sin(G.player.angle) * 8);
        ctx.lineTo(p.x + Math.cos(G.player.angle) * 20, p.y + Math.sin(G.player.angle) * 20);
        ctx.stroke();
      }
      if (G.muzzle > 0) {
        ctx.fillStyle = 'rgba(255,220,100,0.95)';
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(G.player.angle) * 24, p.y + Math.sin(G.player.angle) * 24, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Interaction prompt.
    if (G.mode === 'play' && G.prompt) {
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(G.prompt).width;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(W / 2 - tw / 2 - 12, H - 92, tw + 24, 30);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(G.prompt, W / 2, H - 70);
    }
  }
  return { draw, resize };
}
