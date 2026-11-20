// HUD — health, cash, heat stars, weapon/ammo, speed, objective banner, radio feed,
// live canvas minimap with blips, and the full-city map (M).
import { CITY, WEAPONS } from './config.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'), health: $('healthfill'), healthText: $('healthtext'), cash: $('cash'),
    stars: $('stars'), weapon: $('weapon'), objective: $('objective'), feed: $('feed'),
    speedo: $('speedo'), minimap: $('minimap'), prompt: $('prompt'),
    wantedLabel: $('wantedlabel'), mapwrap: $('mapwrap'), bigmap: $('bigmap'),
  };
  const mm = el.minimap.getContext('2d');
  const bm = el.bigmap.getContext('2d');

  function setStars(n) {
    el.stars.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    el.stars.style.color = n >= 3 ? '#ff5a3c' : '#ffd23c';
  }

  function feed(msg) {
    const div = document.createElement('div');
    div.textContent = msg;
    el.feed.prepend(div);
    while (el.feed.children.length > 5) el.feed.lastChild.remove();
  }

  function setObjective(text) {
    if (text) { el.objective.hidden = false; el.objective.textContent = text; }
    else el.objective.hidden = true;
  }

  function flashDamage() {
    el.health.style.background = 'linear-gradient(90deg, #ff2222, #ff8844)';
    setTimeout(() => { el.health.style.background = ''; }, 180);
  }

  function drawMap(ctx, size, full) {
    const scale = size / 840;
    const to = (v) => (v + 420) * scale;
    ctx.fillStyle = '#241019'; ctx.fillRect(0, 0, size, size);
    // District washes.
    for (const d of CITY.districts) {
      ctx.fillStyle = d.palette[0] + '44';
      ctx.fillRect(to(d.x0), to(d.z0), (d.x1 - d.x0) * scale, (d.z1 - d.z0) * scale);
    }
    // Streets.
    ctx.fillStyle = '#3a3a42';
    for (const s of CITY.streets) {
      ctx.fillRect(0, to(s) - 7 * scale, size, 14 * scale);
      ctx.fillRect(to(s) - 7 * scale, 0, 14 * scale, size);
    }
    // Buildings.
    ctx.fillStyle = '#8a7a6a';
    for (const b of G.city.buildings) {
      ctx.fillRect(to(b.minX), to(b.minZ), (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);
    }
    // Named places.
    const P = G.player;
    const dot = (x, z, color, r) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(to(x), to(z), r, 0, 7); ctx.fill(); };
    dot(CITY.points.garage.x, CITY.points.garage.z, '#ffb03c', full ? 7 : 4); // garage
    dot(CITY.points.hideout1.x, CITY.points.hideout1.z, '#7dff8a', full ? 6 : 3);
    dot(CITY.points.hideout2.x, CITY.points.hideout2.z, '#7dff8a', full ? 6 : 3);
    for (const s of G.city.shards) if (!s.taken) dot(s.x, s.z, '#ffd23c', full ? 4 : 2);
    // Mission beacon.
    if (G.city.beacon.visible) {
      ctx.strokeStyle = '#ffd23c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(to(G.city.beacon.position.x), to(G.city.beacon.position.z), full ? 12 : 7, 0, 7); ctx.stroke();
    }
    // Police blips.
    for (const u of G.police.units) dot(u.x, u.z, '#2244ff', full ? 5 : 3);
    // Player.
    dot(P.inCar && P.car ? P.car.x : P.x, P.inCar && P.car ? P.car.z : P.z, '#ffffff', full ? 7 : 4);
    if (full) {
      ctx.fillStyle = '#ffe9b0'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText('SORREN MOTORS (garage)', to(CITY.points.garage.x) + 10, to(CITY.points.garage.z));
      ctx.fillText('HIDEOUT', to(CITY.points.hideout2.x) - 70, to(CITY.points.hideout2.z) - 8);
      ctx.fillText('YOU', to(P.x) + 10, to(P.z) - 8);
    }
  }

  function update(dt) {
    const P = G.player;
    el.health.style.width = `${Math.max(0, P.hp)}%`;
    el.healthText.textContent = `${Math.max(0, Math.ceil(P.hp))}`;
    el.cash.textContent = `$${P.cash}`;
    const w = P.weapons[P.weapon];
    const def = WEAPONS[P.weapon];
    el.weapon.textContent = def.mag === Infinity ? def.name : `${def.name} · ${w.ammo}/${w.reserve}`;
    if (P.inCar && P.car) {
      el.speedo.hidden = false;
      el.speedo.textContent = `${Math.round(Math.abs(P.car.speed) * 3.6)} KM/H`;
    } else el.speedo.hidden = true;
    // Wanted label.
    const pol = G.police;
    if (pol.wanted > 0) {
      el.wantedLabel.hidden = false;
      el.wantedLabel.textContent = pol.searching ? 'SEARCHING — stay out of sight' : `WANTED · ${pol.wanted}★`;
    } else el.wantedLabel.hidden = true;
    // Interact prompt.
    const t = G.playerApi ? G.playerApi.interactTarget() : null;
    if (t) { el.prompt.hidden = false; el.prompt.textContent = t.label; }
    else el.prompt.hidden = true;
    drawMap(mm, 180, false);
    if (!el.mapwrap.hidden) drawMap(bm, 640, true);
  }

  return {
    setStars, feed, setObjective, flashDamage, update, el,
    showHud(v) { el.hud.hidden = !v; },
  };
}
