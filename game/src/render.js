// VELORA HEAT — top-down 2D renderer: golden-hour city, procedural everything.
// Camera follows the player (or their car) at 14 px/m; the canvas is 1280x720.
import { WORLD, VEHICLES, GARAGE, GARAGE_SLOTS, HIDEOUT, SHOP, MARINA, RACE_CHECKPOINTS } from './config.js';
import { dist } from './random.js';

const SCALE = WORLD.camScale;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let shakeT = 0;

  function w2s(G, x, z) {
    const cx = G.cam.x, cz = G.cam.z;
    return {
      x: (x - cx) * SCALE + canvas.width / 2,
      y: (z - cz) * SCALE + canvas.height / 2,
    };
  }

  function drawCar(G, car, t) {
    const s = w2s(G, car.x, car.z);
    const v = VEHICLES[car.kind];
    const len = v.len * SCALE, wid = v.wid * SCALE;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.roundRect(-len / 2 + 3, -wid / 2 + 4, len, wid, 6); ctx.fill();
    // Body.
    ctx.fillStyle = car.wrecked ? '#3a3a3a' : v.color;
    ctx.beginPath(); ctx.roundRect(-len / 2, -wid / 2, len, wid, 6); ctx.fill();
    // Roof + windshield.
    ctx.fillStyle = v.roof;
    ctx.beginPath(); ctx.roundRect(-len * 0.28, -wid * 0.36, len * 0.5, wid * 0.72, 4); ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.75)';
    ctx.fillRect(len * 0.24, -wid * 0.36, len * 0.08, wid * 0.72);
    ctx.fillRect(-len * 0.36, -wid * 0.36, len * 0.07, wid * 0.72);
    // Headlights.
    if (!car.wrecked) {
      ctx.fillStyle = '#fff8c9';
      ctx.fillRect(len / 2 - 2, -wid / 2 + 2, 3, 5);
      ctx.fillRect(len / 2 - 2, wid / 2 - 7, 3, 5);
    }
    // Police light bar, alternating.
    if (car.police) {
      ctx.fillStyle = Math.floor(t * 4) % 2 === 0 ? '#ff2e2e' : '#2e6bff';
      ctx.fillRect(-6, -wid / 2 - 2, 12, 4);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VBPD', 0, 3);
    }
    // Mission target ring.
    if (car.target) {
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, len * 0.75, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    // Damage smoke.
    if (car.hp > 0 && car.hp < car.maxHp * 0.4) {
      ctx.fillStyle = 'rgba(120,120,120,0.5)';
      ctx.beginPath(); ctx.arc(s.x + (G.rng() - 0.5) * 8, s.y - len * 0.3, 5, 0, Math.PI * 2); ctx.fill();
    }
    if (car.wrecked) {
      ctx.fillStyle = 'rgba(60,60,60,0.55)';
      ctx.beginPath(); ctx.arc(s.x, s.y - 6, 9, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPed(G, ped, t) {
    const s = w2s(G, ped.x, ped.z);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(s.x + 2, s.y + 3, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.state === 'call' ? '#ffd23f' : ped.shirt;
    ctx.beginPath(); ctx.arc(s.x, s.y, ped.state === 'cower' ? 5 : 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath(); ctx.arc(s.x + Math.cos(ped.angle) * 3, s.y + Math.sin(ped.angle) * 3, 3.5, 0, Math.PI * 2); ctx.fill();
    if (ped.state === 'call') {
      ctx.fillStyle = '#111';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', s.x, s.y - 12);
    }
  }

  function draw(G, t) {
    const W = canvas.width, H = canvas.height;
    shakeT = G.shake;
    const shx = shakeT > 0 ? (G.rng() - 0.5) * shakeT * 24 : 0;
    const shy = shakeT > 0 ? (G.rng() - 0.5) * shakeT * 24 : 0;
    ctx.save();
    ctx.translate(shx, shy);
    // Ground: warm dry grass + sand.
    ctx.fillStyle = '#b5a67e';
    ctx.fillRect(-20, -20, W + 40, H + 40);
    // Water: marina south + east edges.
    ctx.fillStyle = '#3f7fb8';
    const wS = w2s(G, 0, 330);
    ctx.fillRect(0, wS.y, W, H - wS.y + 20);
    const wE = w2s(G, 330, 0);
    ctx.fillRect(wE.x, 0, W - wE.x + 20, H);
    // City blocks (sidewalk tint).
    for (const b of G.city.buildings) {
      const a = w2s(G, b.x0, b.z0), c = w2s(G, b.x1, b.z1);
      if (c.x < -40 || a.x > W + 40 || c.y < -40 || a.y > H + 40) continue;
      ctx.fillStyle = '#cbb98f';
      ctx.fillRect(a.x - 6, a.y - 6, (c.x - a.x) + 12, (c.y - a.y) + 12);
    }
    // Roads.
    ctx.fillStyle = '#3a3f4a';
    for (const s of WORLD.streets) {
      const h = w2s(G, -352, s);
      ctx.fillRect(0, h.y - 7 * SCALE, W, 14 * SCALE);
      const v = w2s(G, s, -352);
      ctx.fillRect(v.x - 7 * SCALE, 0, 14 * SCALE, H);
    }
    // Centre dashes.
    ctx.strokeStyle = '#e8d44d';
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 18]);
    for (const s of WORLD.streets) {
      const h = w2s(G, -352, s);
      ctx.beginPath(); ctx.moveTo(0, h.y); ctx.lineTo(W, h.y); ctx.stroke();
      const v = w2s(G, s, -352);
      ctx.beginPath(); ctx.moveTo(v.x, 0); ctx.lineTo(v.x, H); ctx.stroke();
    }
    ctx.setLineDash([]);
    // Palms.
    for (const palm of G.city.palms) {
      const s = w2s(G, palm.x, palm.z);
      if (s.x < -20 || s.x > W + 20 || s.y < -20 || s.y > H + 20) continue;
      ctx.fillStyle = '#2f7a4d';
      ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f9a5f';
      ctx.beginPath(); ctx.arc(s.x - 3, s.y - 3, 6, 0, Math.PI * 2); ctx.fill();
    }
    // Garage slots.
    for (const slot of GARAGE_SLOTS) {
      const s = w2s(G, slot.x, slot.z);
      ctx.strokeStyle = '#2fae5f';
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x - 32, s.y - 16, 64, 32);
    }
    // Buildings: shadow, body, roof, name.
    for (const b of G.city.buildings) {
      const a = w2s(G, b.x0, b.z0), c = w2s(G, b.x1, b.z1);
      if (c.x < -60 || a.x > W + 60 || c.y < -60 || a.y > H + 60) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(a.x + 5, a.y + 6, c.x - a.x, c.y - a.y);
      ctx.fillStyle = b.color;
      ctx.fillRect(a.x, a.y, c.x - a.x, c.y - a.y);
      ctx.fillStyle = b.roof;
      ctx.fillRect(a.x + 6, a.y + 6, c.x - a.x - 12, c.y - a.y - 12);
      if (b.landmark) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.name, (a.x + c.x) / 2, (a.y + c.y) / 2 + 4);
      }
    }
    // Hideout ring + marina marker.
    const ho = w2s(G, HIDEOUT.x, HIDEOUT.z);
    ctx.strokeStyle = '#2fae5f';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ho.x, ho.y, HIDEOUT.r * SCALE, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#2fae5f';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HIDEOUT', ho.x, ho.y - HIDEOUT.r * SCALE - 6);
    // Race checkpoints.
    if (G.mission.active && G.mission.index === 4) {
      for (let i = 0; i < RACE_CHECKPOINTS.length; i += 1) {
        const [x, z] = RACE_CHECKPOINTS[i];
        const s = w2s(G, x, z);
        const next = i === G.mission.playerCp;
        ctx.fillStyle = next ? '#ffd23f' : 'rgba(255,210,63,0.35)';
        ctx.beginPath(); ctx.arc(s.x, s.y, next ? 14 : 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), s.x, s.y + 4);
      }
    }
    // Objective beacon: gold diamond + light column.
    const obj = G.objective;
    if (obj) {
      const s = w2s(G, obj.x, obj.z);
      ctx.fillStyle = 'rgba(255,210,63,0.18)';
      ctx.fillRect(s.x - 8, 0, 16, H);
      ctx.fillStyle = '#ffd23f';
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(Math.PI / 4 + t * 0.5);
      ctx.fillRect(-9, -9, 18, 18);
      ctx.restore();
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, 16 + Math.sin(t * 3) * 3, 0, Math.PI * 2); ctx.stroke();
    }
    // Peds, enemies, cars (sorted: cars last so they sit on top).
    for (const ped of G.peds) {
      if (ped.hp <= 0) continue;
      const s = w2s(G, ped.x, ped.z);
      if (s.x < -30 || s.x > W + 30 || s.y < -30 || s.y > H + 30) continue;
      drawPed(G, ped, t);
    }
    for (const e of G.enemies) {
      if (e.hp <= 0) continue;
      const s = w2s(G, e.x, e.z);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(s.x + 2, s.y + 3, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c22f2f';
      ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillRect(s.x - 12, s.y - 18, 24, 4);
      ctx.fillStyle = '#ff5a4d';
      ctx.fillRect(s.x - 12, s.y - 18, 24 * (e.hp / 45), 4);
    }
    // Foot officers.
    for (const o of G.police.state.officers) {
      const s = w2s(G, o.x, o.z);
      ctx.fillStyle = '#1d2f4a';
      ctx.beginPath(); ctx.arc(s.x, s.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4da3ff';
      ctx.beginPath(); ctx.arc(s.x, s.y - 2, 3, 0, Math.PI * 2); ctx.fill();
    }
    for (const car of G.cars) {
      if (car.hp <= 0 && !car.wrecked) continue;
      drawCar(G, car, t);
    }
    // Player on foot.
    const p = G.player;
    if (!p.inCar && p.hp > 0) {
      const s = w2s(G, p.x, p.z);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(s.x + 2, s.y + 3, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(s.x + Math.cos(p.angle) * 4, s.y + Math.sin(p.angle) * 4, 4.5, 0, Math.PI * 2); ctx.fill();
      // Gun in hand + aim line.
      if (p.weapon !== 'fists') {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + Math.cos(p.aimAngle) * 26, s.y + Math.sin(p.aimAngle) * 26);
        ctx.stroke();
        ctx.fillStyle = '#333';
        ctx.fillRect(s.x + Math.cos(p.aimAngle) * 10 - 3, s.y + Math.sin(p.aimAngle) * 10 - 2, 7, 4);
      }
      // Muzzle flash.
      if (G.muzzle > 0) {
        ctx.fillStyle = '#ffe66d';
        ctx.beginPath();
        ctx.arc(s.x + Math.cos(p.aimAngle) * 20, s.y + Math.sin(p.aimAngle) * 20, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Tracers.
    for (const tr of G.tracers) {
      const a = w2s(G, tr.x1, tr.z1), b = w2s(G, tr.x2, tr.z2);
      ctx.strokeStyle = tr.hit ? '#ffe66d' : 'rgba(255,230,109,0.6)';
      ctx.lineWidth = tr.hit ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // Golden-hour vignette.
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95);
    grad.addColorStop(0, 'rgba(255,190,90,0)');
    grad.addColorStop(1, 'rgba(255,150,50,0.14)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // Aim reticle at the mouse (on foot only).
    if (!p.inCar && G.mode === 'play') {
      const m = G.input.mouse();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(m.x, m.y, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(m.x - 13, m.y); ctx.lineTo(m.x - 5, m.y);
      ctx.moveTo(m.x + 5, m.y); ctx.lineTo(m.x + 13, m.y);
      ctx.moveTo(m.x, m.y - 13); ctx.lineTo(m.x, m.y - 5);
      ctx.moveTo(m.x, m.y + 5); ctx.lineTo(m.x, m.y + 13);
      ctx.stroke();
    }
  }

  return { draw, w2s };
}
