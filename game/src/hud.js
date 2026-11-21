// hud.js — everything the player reads: cash, wanted stars, the objective
// line with its distance, the speedometer, the bust meter, message toasts,
// mission cards, and the live minimap. The DOM lives in index.html; this
// class owns it after boot and draws the minimap on its 2D canvas.

import { AVENUES, STREETS, WATER_X } from './cityplan.js';

const MAP_RANGE = 135; // metres from the player to the minimap's edge

export class Hud {
  constructor() {
    this.el = {};
    for (const id of [
      'hud', 'cash', 'stars', 'objective', 'objective-dist', 'speedo', 'timer',
      'bust-wrap', 'bust-fill', 'toast', 'card', 'card-title', 'card-body',
      'banner', 'banner-title', 'banner-body',
    ]) {
      this.el[id] = document.getElementById(id);
    }
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.toastUntil = 0;
    this.cardUntil = 0;
  }

  showHud() {
    this.el.hud.style.display = 'block';
  }

  hideHud() {
    this.el.hud.style.display = 'none';
  }

  setCash(amount) {
    this.el.cash.textContent = `$${amount.toLocaleString('en-US')}`;
  }

  setStars(stars) {
    const lit = '★★★★★'.slice(0, stars);
    const dim = '☆☆☆☆☆'.slice(0, 5 - stars);
    this.el.stars.textContent = lit + dim;
    this.el.stars.style.opacity = stars > 0 ? '1' : '0.35';
  }

  setObjective(text, distance) {
    this.el.objective.textContent = text;
    this.el['objective-dist'].textContent =
      distance === null || distance === undefined ? '' : `${Math.round(distance)} m`;
  }

  setSpeed(speedMs, inCar) {
    this.el.speedo.style.display = inCar ? 'block' : 'none';
    if (inCar) this.el.speedo.textContent = `${Math.round(Math.abs(speedMs) * 3.6)} km/h`;
  }

  setTimer(seconds) {
    if (seconds === null || seconds === undefined) {
      this.el.timer.style.display = 'none';
      return;
    }
    this.el.timer.style.display = 'block';
    const s = Math.max(0, Math.ceil(seconds));
    this.el.timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.el.timer.style.color = s <= 20 ? '#ff5468' : '#ffe9a8';
  }

  setBust(fraction) {
    this.el['bust-wrap'].style.display = fraction > 0.02 ? 'block' : 'none';
    this.el['bust-fill'].style.width = `${Math.round(fraction * 100)}%`;
  }

  toast(text, seconds = 3.2) {
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    this.toastUntil = performance.now() + seconds * 1000;
  }

  missionCard(title, body, seconds = 5) {
    this.el['card-title'].textContent = title;
    this.el['card-body'].textContent = body;
    this.el.card.style.opacity = '1';
    this.cardUntil = performance.now() + seconds * 1000;
  }

  banner(title, body) {
    this.el['banner-title'].textContent = title;
    this.el['banner-body'].textContent = body;
    this.el.banner.style.display = 'flex';
  }

  hideBanner() {
    this.el.banner.style.display = 'none';
  }

  tick() {
    const now = performance.now();
    if (now > this.toastUntil) this.el.toast.style.opacity = '0';
    if (now > this.cardUntil) this.el.card.style.opacity = '0';
  }

  /**
   * Draw the minimap: north-up, player-centred. view = { player:{x,z,heading},
   * target:{x,z}|null, police:[{x,z}], traffic:[{x,z}], peds:[{x,z}] }.
   */
  drawMinimap(view) {
    const ctx = this.mapCtx;
    const size = this.map.width;
    const centre = size / 2;
    const scale = centre / MAP_RANGE;
    const px = view.player.x;
    const pz = view.player.z;
    const toMap = (x, z) => [centre + (x - px) * scale, centre + (z - pz) * scale];

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(centre, centre, centre - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#232838';
    ctx.fillRect(0, 0, size, size);

    // The bay, when in range.
    const [waterX] = toMap(WATER_X, pz);
    if (waterX < size) {
      ctx.fillStyle = '#0d3a5c';
      ctx.fillRect(Math.max(0, waterX), 0, size, size);
    }
    // Roads.
    ctx.strokeStyle = '#454e66';
    ctx.lineWidth = 3;
    for (const ax of AVENUES) {
      const [x] = toMap(ax, pz);
      if (x < -4 || x > size + 4) continue;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (const sz of STREETS) {
      const [, y] = toMap(px, sz);
      if (y < -4 || y > size + 4) continue;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
    const dot = (x, z, color, r) => {
      const [mx, my] = toMap(x, z);
      const dx = mx - centre;
      const dy = my - centre;
      const d = Math.hypot(dx, dy);
      if (d > centre - 5) {
        const k = (centre - 5) / d;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(centre + dx * k, centre + dy * k, r, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const t of view.traffic) dot(t.x, t.z, '#8b93a7', 2);
    for (const p of view.peds) dot(p.x, p.z, '#c9cede', 1.6);
    for (const c of view.police) dot(c.x, c.z, '#ff4040', 3);
    if (view.target) {
      const pulse = 3.4 + Math.sin(performance.now() / 240) * 1.1;
      dot(view.target.x, view.target.z, '#ffd23e', pulse);
    }
    // Player arrow: the map is north-up with +z drawn downward, so the
    // heading's screen angle is atan2(sin h, -cos h).
    ctx.translate(centre, centre);
    ctx.rotate(Math.atan2(Math.sin(view.player.heading), -Math.cos(view.player.heading)));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(4.6, 5.5);
    ctx.lineTo(0, 2.6);
    ctx.lineTo(-4.6, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centre, centre, centre - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
