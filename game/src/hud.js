// hud.js — everything the player reads: cash and debt, wanted stars, the
// objective line, banners and toasts, the bust meter, the speedo, and the
// minimap — a 2D canvas that draws the city from the same layout data the
// world is built from, so the map can never lie about the streets.

import {
  AVENUES_X, OCEAN_DRIVE_X, STREETS_Z, BEACH_X, WATER_X, PIER_Z,
  DOCKYARD, IMPOUND, DEBT,
} from "./logic.js";

const MAP_WORLD = { minX: -245, maxX: 255, minZ: -160, maxZ: 165 };

export class Hud {
  constructor(els) {
    this.els = els;
    this.mapCtx = els.minimap.getContext("2d");
    this.bigMapCtx = els.bigmap ? els.bigmap.getContext("2d") : null;
    this.bannerTimer = 0;
    this.toastTimer = 0;
  }

  setCash(cash, debtPaid) {
    this.els.cash.textContent = `$${Math.floor(cash).toLocaleString()}`;
    const due = Math.max(0, DEBT - debtPaid);
    this.els.debt.textContent = due > 0 ? `DEBT $${due.toLocaleString()}` : "DEBT CLEARED";
    this.els.debt.classList.toggle("cleared", due === 0);
  }

  setWanted(level) {
    this.els.stars.textContent = "★★★★★".slice(0, level) + "☆☆☆☆☆".slice(0, 5 - level);
    this.els.stars.classList.toggle("hot", level > 0);
  }

  setObjective(text) {
    if (this.els.objective.textContent !== text) this.els.objective.textContent = text;
  }

  setClock(seconds) {
    if (seconds === null || seconds === undefined) {
      this.els.clock.style.display = "none";
      return;
    }
    this.els.clock.style.display = "block";
    const s = Math.ceil(seconds);
    this.els.clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    this.els.clock.classList.toggle("urgent", s <= 15);
  }

  setSpeed(speed, inCar) {
    this.els.speed.style.display = inCar ? "block" : "none";
    if (inCar) this.els.speed.textContent = `${Math.round(Math.abs(speed) * 3.6)} km/h`;
  }

  setBust(frac) {
    this.els.bustWrap.style.display = frac > 0.02 ? "block" : "none";
    this.els.bustFill.style.width = `${Math.round(frac * 100)}%`;
  }

  setHint(text) {
    this.els.hint.style.display = text ? "block" : "none";
    if (text && this.els.hint.textContent !== text) this.els.hint.textContent = text;
  }

  banner(title, sub, seconds = 4.2) {
    this.els.bannerTitle.textContent = title;
    this.els.bannerSub.textContent = sub ?? "";
    this.els.banner.style.display = "block";
    this.bannerTimer = seconds;
  }

  toast(msg, seconds = 3) {
    this.els.toast.textContent = msg;
    this.els.toast.style.display = "block";
    this.toastTimer = seconds;
  }

  update(dt) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.els.banner.style.display = "none";
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.els.toast.style.display = "none";
    }
  }

  /** Draw the city + actors onto a map canvas, centred on `centre`. */
  drawMap(ctx, size, view, centre = view.player, span = 150) {
    const { player, markers, police, traffic, pulse } = view;
    const scale = size / span; // world metres across the map
    const toX = (x) => size / 2 + (x - centre.x) * scale;
    const toY = (z) => size / 2 + (z - centre.z) * scale;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#0d1526";
    ctx.fillRect(0, 0, size, size);
    // Sea and beach.
    ctx.fillStyle = "#123650";
    ctx.fillRect(toX(WATER_X), 0, size, size);
    ctx.fillStyle = "#6e5f3d";
    ctx.fillRect(toX(BEACH_X), 0, Math.max(0, toX(WATER_X) - toX(BEACH_X)), size);
    // Blocks.
    ctx.fillStyle = "#1d2739";
    const roadsX = [...AVENUES_X, OCEAN_DRIVE_X];
    for (let i = 0; i + 1 < roadsX.length; i++) {
      for (let j = 0; j + 1 < STREETS_Z.length; j++) {
        const x0 = roadsX[i] + 6, x1 = roadsX[i + 1] - 6;
        const z0 = STREETS_Z[j] + 6, z1 = STREETS_Z[j + 1] - 6;
        ctx.fillRect(toX(x0), toY(z0), (x1 - x0) * scale, (z1 - z0) * scale);
      }
    }
    // Yards.
    ctx.fillStyle = "#27334a";
    for (const r of [DOCKYARD, IMPOUND]) {
      ctx.fillRect(toX(r.minX), toY(r.minZ), (r.maxX - r.minX) * scale, (r.maxZ - r.minZ) * scale);
    }
    // Roads.
    ctx.strokeStyle = "#3d4c68";
    ctx.lineWidth = Math.max(1.4, 12 * scale * 0.32);
    ctx.beginPath();
    for (const ax of roadsX) { ctx.moveTo(toX(ax), 0); ctx.lineTo(toX(ax), size); }
    for (const sz of STREETS_Z) { ctx.moveTo(0, toY(sz)); ctx.lineTo(size, toY(sz)); }
    ctx.moveTo(toX(WATER_X), toY(PIER_Z)); ctx.lineTo(toX(246), toY(PIER_Z));
    ctx.stroke();
    // Traffic as pale dots.
    ctx.fillStyle = "rgba(220,228,245,0.75)";
    for (const car of traffic) {
      const x = toX(car.x), y = toY(car.z);
      if (x < -4 || y < -4 || x > size + 4 || y > size + 4) continue;
      ctx.fillRect(x - 1.4, y - 1.4, 2.8, 2.8);
    }
    // Police as flashing blue dots.
    ctx.fillStyle = pulse ? "#4da3ff" : "#ff4d6a";
    for (const car of police) {
      const x = toX(car.x), y = toY(car.z);
      if (x < -5 || y < -5 || x > size + 5 || y > size + 5) continue;
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mission markers as gold diamonds.
    for (const mk of markers) {
      const x = toX(mk.x), y = toY(mk.z);
      const cx = Math.max(8, Math.min(size - 8, x));
      const cy = Math.max(8, Math.min(size - 8, y));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#ffc93c";
      const r = 4.6 + Math.sin(pulse * Math.PI) * 0.8;
      ctx.fillRect(-r / 1.4, -r / 1.4, r * 1.42, r * 1.42);
      ctx.restore();
    }
    // The player: a white arrow on the facing (drawn pointing down-map,
    // which is +z, then turned by the heading).
    ctx.save();
    ctx.translate(toX(player.x), toY(player.z));
    ctx.rotate(-player.heading);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(4.6, -5.4);
    ctx.lineTo(0, -2.8);
    ctx.lineTo(-4.6, -5.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Frame.
    ctx.strokeStyle = "rgba(140,170,230,0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);
  }

  renderMinimap(view) {
    const size = this.els.minimap.width;
    this.drawMap(this.mapCtx, size, view);
  }

  renderBigMap(view) {
    if (!this.bigMapCtx) return;
    const size = this.els.bigmap.width;
    // The big map frames the whole city: centre on Port Meridian's middle
    // and span the full width of the world.
    this.drawMap(this.bigMapCtx, size, view, { x: 5, z: 2 }, MAP_WORLD.maxX - MAP_WORLD.minX);
  }
}
