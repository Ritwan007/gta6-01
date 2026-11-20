// HUD: DOM readouts (health, cash, stars, weapon, speed), the live canvas minimap,
// the full-city map overlay, the radio feed, toasts and mission cards. The minimap
// draws blips for the player, objective, police, shops, garage, hideouts and sun coins.
import { WEAPONS, WORLD } from './config.js';
import { dist2d } from './random.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const hud = {
    shakeT: 0,
    shakeMag: 0,
    feedLines: [],
  };

  hud.show = () => $('hud').classList.remove('hidden');
  hud.hide = () => $('hud').classList.add('hidden');

  hud.setStars = (n, searching) => {
    const el = $('stars');
    let html = '';
    for (let i = 0; i < 5; i += 1) html += `<span class="${i < n ? 'star-on' : 'star-off'}">★</span>`;
    el.innerHTML = html;
    el.classList.toggle('searching', searching && n > 0);
  };

  hud.feed = (msg, kind) => {
    const box = $('feed');
    const div = document.createElement('div');
    if (kind) div.className = kind;
    div.textContent = msg;
    box.prepend(div);
    while (box.children.length > 4) box.removeChild(box.lastChild);
    hud.feedLines.unshift(msg);
    if (hud.feedLines.length > 20) hud.feedLines.pop();
  };

  hud.toast = (msg) => {
    const el = $('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    window.clearTimeout(hud._toastT);
    hud._toastT = window.setTimeout(() => el.classList.add('hidden'), 2600);
  };

  hud.shake = (mag) => {
    hud.shakeMag = Math.max(hud.shakeMag, mag);
    hud.shakeT = 0.35;
  };

  hud.hitMarker = () => {
    const el = $('crosshair');
    el.textContent = '✕';
    el.style.color = '#ffd23e';
    window.setTimeout(() => { el.textContent = '+'; el.style.color = '#fff'; }, 120);
  };

  hud.showMissionCard = (title, body, btnText) => {
    $('mission-card-title').textContent = title;
    $('mission-card-body').textContent = body;
    $('mission-card-btn').textContent = btnText || 'CONTINUE';
    $('mission-card').classList.remove('hidden');
    G.missionCardOpen = true;
  };

  hud.hideMissionCard = () => {
    $('mission-card').classList.add('hidden');
    G.missionCardOpen = false;
  };

  hud.showEnding = () => {
    $('ending-body').textContent = 'Hale\'s crew scatters into the night. The garage is yours, the debt is burned, and Caldera Bay is wide open.\n\nFree roam continues — every job, shop and street is still yours.';
    $('ending-card').classList.remove('hidden');
  };

  hud.setInteractPrompt = (text) => {
    const el = $('interact-prompt');
    if (!text) {
      el.classList.add('hidden');
      el.textContent = ''; // never leave a stale prompt readable via the debug state
      return;
    }
    el.textContent = text;
    el.classList.remove('hidden');
  };

  function drawMapCanvas(canvas, big) {
    const g = canvas.getContext('2d');
    const S = canvas.width;
    const W = WORLD.size;
    const toPx = (v) => ((v + W / 2) / W) * S;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#101018';
    g.fillRect(0, 0, S, S);
    // Blocks.
    g.fillStyle = '#2e2e3a';
    for (let bx = -360; bx <= 240; bx += 120) {
      for (let bz = -360; bz <= 240; bz += 120) {
        g.fillRect(toPx(bx + 9), toPx(bz + 9), (102 / W) * S, (102 / W) * S);
      }
    }
    // Roads.
    g.strokeStyle = '#55555f';
    g.lineWidth = big ? 10 : 5;
    for (const s of WORLD.streets) {
      g.beginPath(); g.moveTo(0, toPx(s)); g.lineTo(S, toPx(s)); g.stroke();
      g.beginPath(); g.moveTo(toPx(s), 0); g.lineTo(toPx(s), S); g.stroke();
    }
    // Beach + sea on the east edge.
    g.fillStyle = '#3f7fa8';
    g.fillRect(toPx(408), 0, S - toPx(408), S);
    g.fillStyle = '#d9c48f';
    g.fillRect(toPx(396), 0, toPx(408) - toPx(396), S);

    const dot = (x, z, color, r, shape) => {
      g.fillStyle = color;
      g.beginPath();
      if (shape === 'diamond') {
        g.moveTo(toPx(x), toPx(z) - r);
        g.lineTo(toPx(x) + r, toPx(z));
        g.lineTo(toPx(x), toPx(z) + r);
        g.lineTo(toPx(x) - r, toPx(z));
        g.closePath();
        g.fill();
      } else {
        g.arc(toPx(x), toPx(z), r, 0, Math.PI * 2);
        g.fill();
      }
    };
    const R = big ? 9 : 5;
    // Sun coins.
    for (const s of G.city.shards) if (!s.taken) dot(s.x, s.z, '#ffd23e', R * 0.6, 'circle');
    // Shops.
    for (const s of G.city.points.shops) dot(s.x, s.z, '#7dff9a', R * 0.8, 'circle');
    // Garage + hideouts.
    dot(G.city.points.garage.x, G.city.points.garage.z, '#37d67a', R, 'diamond');
    dot(G.city.points.hideout1.x, G.city.points.hideout1.z, '#4db2ff', R * 0.8, 'circle');
    dot(G.city.points.hideout2.x, G.city.points.hideout2.z, '#4db2ff', R * 0.8, 'circle');
    // Police.
    for (const car of G.police.pursuit) dot(car.x, car.z, '#ff4d4d', R, 'circle');
    // Objective.
    const obj = G.missions.objectivePoint();
    dot(obj.x, obj.z, '#ffd23e', R * 1.6, 'diamond');
    // Player (always on top).
    dot(G.player.x, G.player.z, '#ffffff', R * 1.1, 'circle');
    g.strokeStyle = '#ff7a1a';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(toPx(G.player.x), toPx(G.player.z), R * 1.1 + 3, 0, Math.PI * 2);
    g.stroke();
  }

  hud.drawMinimap = () => {
    drawMapCanvas($('minimap'), false);
  };

  hud.drawBigMap = () => {
    drawMapCanvas($('bigmap'), true);
  };

  hud.update = () => {
    const p = G.player;
    $('health-fill').style.width = `${Math.max(0, p.health)}%`;
    $('cash').textContent = `$${G.cash}`;
    $('shards').textContent = `${G.shardsTaken} / ${WORLD.shardCount}`;
    const w = G.weapons.weapon();
    $('weapon-name').textContent = w.name;
    $('ammo').textContent = Number.isFinite(w.mag)
      ? `${G.weapons.mag[G.weapons.index]} / ${G.weapons.reserve[G.weapons.index]}${G.weapons.reloading > 0 ? ' — reloading…' : ''}`
      : '—';
    const speed = p.inCar && p.car ? Math.abs(p.car.speed) * 3.6 : p.speed * 3.6;
    $('speed').textContent = String(Math.round(speed));
    $('objective-text').textContent = G.missions.objectiveText();
    $('crosshair').classList.toggle('hidden', p.inCar || G.weapons.index === 0);
    hud.drawMinimap();
    // Screen shake decays.
    if (hud.shakeT > 0) hud.shakeT -= 1 / 60;
    else hud.shakeMag = 0;
  };

  hud.shakeOffset = () => {
    if (hud.shakeT <= 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * hud.shakeMag,
      y: (Math.random() - 0.5) * hud.shakeMag,
    };
  };

  return hud;
}
