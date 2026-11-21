// VELORA HEAT — HUD: DOM readouts, live canvas minimap, full-city map, mission
// cards, shop overlay, message feed and toasts.
import { WEAPONS, SHOPS, POINTS, GARAGE_SLOTS, DISTRICTS } from './config.js';
import { dist } from './random.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const els = {
    hud: $('hud'), healthfill: $('healthfill'), healthtext: $('healthtext'), cash: $('cash'),
    stars: $('stars'), objective: $('objective'), objTitle: $('obj-title'), objText: $('obj-text'),
    objTimer: $('obj-timer'), weaponname: $('weaponname'), ammo: $('ammo'), speed: $('speed'),
    feed: $('feed'), prompt: $('prompt'), toast: $('toast'),
    minimap: $('minimap'), bigmap: $('bigmap'), card: $('card'),
    cardKicker: $('card-kicker'), cardTitle: $('card-title'), cardText: $('card-text'),
    cardReward: $('card-reward'), btnCard: $('btn-card'),
  };
  let toastT = null;
  let cardCb = null;
  els.btnCard.addEventListener('click', () => {
    els.card.classList.add('hidden');
    if (cardCb) { const cb = cardCb; cardCb = null; cb(); }
  });

  // Shop overlay, built once and reused.
  const shopDiv = document.createElement('div');
  shopDiv.id = 'shopov';
  shopDiv.className = 'overlay hidden';
  shopDiv.innerHTML = '<div class="menu-panel"><h2 id="shop-name"></h2><div id="shop-items" class="menu"></div><div class="menu"><button id="shop-close">CLOSE</button></div></div>';
  document.getElementById('wrap').appendChild(shopDiv);
  shopDiv.querySelector('#shop-close').addEventListener('click', () => {
    shopDiv.classList.add('hidden');
    if (G.mode === 'shop') G.mode = 'play';
  });

  function showHud(v) { els.hud.classList.toggle('hidden', !v); }
  function updateStars() {
    const stars = els.stars.querySelectorAll('.star');
    stars.forEach((s, i) => s.classList.toggle('lit', i < G.wanted));
    els.stars.classList.toggle('searching', G.searching);
  }
  function updateVitals() {
    const p = G.player;
    els.healthfill.style.width = Math.max(0, p.hp) + '%';
    els.healthtext.textContent = Math.ceil(Math.max(0, p.hp));
    els.cash.textContent = p.cash;
    const w = p.weapons[p.weapon];
    els.weaponname.textContent = WEAPONS[p.weapon].name;
    els.ammo.textContent = w.mag === Infinity ? '' : (w.reloading ? 'RELOADING…' : `${w.mag} / ${w.reserve}`);
    const pc = G.cars.find((c) => c.id === p.inCar);
    els.speed.textContent = pc ? Math.round(Math.abs(pc.speed) * 3.6) : 0;
  }
  function updateObjective() {
    const o = G.mission.objectiveText();
    els.objective.classList.remove('hidden');
    els.objTitle.textContent = o.title;
    els.objText.textContent = o.text;
    els.objTimer.textContent = o.timer ? `⏱ ${Math.floor(o.timer / 60)}:${String(Math.floor(o.timer % 60)).padStart(2, '0')}` : '';
  }
  function feed(msg, cls = '') {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.textContent = msg;
    els.feed.appendChild(d);
    while (els.feed.children.length > 5) els.feed.removeChild(els.feed.firstChild);
    setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 9000);
  }
  function toast(msg, ms = 2600) {
    els.toast.textContent = msg;
    els.toast.classList.remove('hidden');
    if (toastT) clearTimeout(toastT);
    toastT = setTimeout(() => els.toast.classList.add('hidden'), ms);
  }
  function setPrompt(text) {
    if (!text) { els.prompt.classList.add('hidden'); return; }
    els.prompt.innerHTML = text;
    els.prompt.classList.remove('hidden');
  }
  function showCard(kicker, title, text, reward, cb) {
    els.cardKicker.textContent = kicker;
    els.cardTitle.textContent = title;
    els.cardText.textContent = text;
    els.cardReward.textContent = reward || '';
    els.card.classList.remove('hidden');
    cardCb = cb || null;
  }
  function showEnding() {
    document.getElementById('ending').classList.remove('hidden');
  }
  function hideEnding() {
    document.getElementById('ending').classList.add('hidden');
  }
  function showShop(shop) {
    const p = G.player;
    shopDiv.querySelector('#shop-name').textContent = shop.name;
    const box = shopDiv.querySelector('#shop-items');
    box.innerHTML = '';
    for (const item of shop.items) {
      const b = document.createElement('button');
      b.textContent = `${item.name} — $${item.price}`;
      b.addEventListener('click', () => {
        if (p.cash < item.price) { toast(`Not enough cash ($${p.cash}).`); return; }
        p.cash -= item.price;
        if (item.hp) p.hp = Math.min(p.maxHp, p.hp + item.hp);
        if (item.w != null) p.weapons[item.w].reserve += item.ammo;
        G.audio.chaChing();
        toast(`Purchased: ${item.name}`);
        shopDiv.classList.add('hidden');
        if (G.mode === 'shop') G.mode = 'play';
      });
      box.appendChild(b);
    }
    shopDiv.classList.remove('hidden');
    G.mode = 'shop';
  }
  function drawMapCanvas(ctx, size, scale, withLabels) {
    const S = size, sc = scale;
    const toX = (x) => (x + 317) * sc;
    const toZ = (z) => (z + 317) * sc;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#2a2e38'; ctx.fillRect(0, 0, S, S);
    // District ground tints.
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.ground;
      ctx.fillRect(toX(d.x0), toZ(d.z0), (d.x1 - d.x0) * sc, (d.z1 - d.z0) * sc);
    }
    // Streets.
    ctx.fillStyle = '#3a3f4a';
    for (let i = 0; i <= 7; i++) {
      const s = -308 + i * 88;
      ctx.fillRect(toX(s - 9), 0, 18 * sc, S);
      ctx.fillRect(0, toZ(s - 9), S, 18 * sc);
    }
    // Buildings.
    ctx.fillStyle = '#1d212b';
    for (const b of G.city.buildings) ctx.fillRect(toX(b.x0), toZ(b.z0), (b.x1 - b.x0) * sc, (b.z1 - b.z0) * sc);
    const dot = (x, z, color, r = 4) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(toX(x), toZ(z), r, 0, Math.PI * 2); ctx.fill(); };
    // Hideouts, shops, garage.
    dot(POINTS.hideout1.x, POINTS.hideout1.z, '#c59bff', 5);
    dot(POINTS.hideout2.x, POINTS.hideout2.z, '#c59bff', 5);
    for (const s of SHOPS) dot(s.x, s.z, '#ffa94d', 4);
    dot(POINTS.garage.x, POINTS.garage.z, '#7dff9a', 6);
    // Objective / mission target.
    const obj = currentObjectivePoint();
    if (obj) { dot(obj.x, obj.z, '#ffcf5c', 7); ctx.strokeStyle = '#ffcf5c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(toX(obj.x), toZ(obj.z), 10, 0, Math.PI * 2); ctx.stroke(); }
    // Cars + peds (faint).
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (const c of G.cars) if (c.driver !== 'player') ctx.fillRect(toX(c.x) - 1.5, toZ(c.z) - 1.5, 3, 3);
    // Police blips.
    for (const c of G.cars) if (c.driver === 'police') dot(c.x, c.z, '#ff4d4d', 5);
    for (const o of G.police.officers) dot(o.x, o.z, '#ff4d4d', 4);
    // Player.
    const p = G.player;
    const pc = G.cars.find((c) => c.id === p.inCar);
    dot(pc ? pc.x : p.x, pc ? pc.z : p.z, '#4da3ff', 6);
    if (withLabels) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('VELORA BAY', 10, 18);
      ctx.font = '11px sans-serif';
      ctx.fillText('Lestari Motors (garage / save)', toX(POINTS.garage.x) + 10, toZ(POINTS.garage.z) + 4);
      ctx.fillText('VBPD station', toX(POINTS.station.x) + 10, toZ(POINTS.station.z) + 4);
    }
  }
  function currentObjectivePoint() {
    if (G.mission.active) {
      const s = G.mission.stepDef();
      if (!s) return null;
      if (s.t === 'race') { const cp = G.mission.raceCps[G.mission.playerCp]; return cp || null; }
      if (s.x != null) return { x: s.x, z: s.z };
      if (s.t === 'steal') return { x: 220, z: 132 };
      if (s.t === 'enter') return { x: -44, z: 220 };
      if (s.t === 'defend') return { x: POINTS.garage.x, z: POINTS.garage.z };
      return null;
    }
    if (G.mission.index < 6) return { x: POINTS.garage.x, z: POINTS.garage.z };
    return null;
  }
  function drawMinimap() {
    const ctx = els.minimap.getContext('2d');
    const S = 190, sc = S / 634;
    // Circular clip for the round minimap.
    ctx.save();
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.clip();
    drawMapCanvas(ctx, S, sc, false);
    ctx.restore();
  }
  function drawBigMap() {
    const ctx = els.bigmap.getContext('2d');
    // Canvas is 760x560; the world is square, so fit by height and centre.
    const S = 560, sc = S / 634;
    ctx.save();
    ctx.translate((760 - S) / 2, 0);
    drawMapCanvas(ctx, S, sc, true);
    ctx.restore();
  }
  return {
    showHud, updateStars, updateVitals, updateObjective, feed, toast, setPrompt,
    showCard, showEnding, hideEnding, showShop, drawMinimap, drawBigMap,
  };
}
