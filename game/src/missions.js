// missions.js — the debt arc, run live in the world.
//
// A MissionRunner watches the save for the next unfinished mission, plants
// a pillar of gold light on its start point, and walks the player through
// its objectives: fares, timed runs, package collects, a checkpoint dash,
// a follow job, two steals and a final escape. Everything the runner needs
// from the rest of the game comes in through hooks, so the rules it
// enforces stay the ones in logic.js.

import * as THREE from "three";
import { MISSIONS, nextMission } from "./logic.js";

const GOLD = 0xffc93c;

function labelSprite(text) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 96;
  const g = c.getContext("2d");
  g.font = "bold 44px Arial, sans-serif";
  g.textAlign = "center";
  g.shadowColor = "#000";
  g.shadowBlur = 10;
  g.fillStyle = "#ffd76a";
  g.fillText(text.toUpperCase(), 256, 58);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(17, 3.2, 1);
  return sprite;
}

/** One glowing objective marker: pillar, ring and a floating label. */
class Marker {
  constructor(scene, label) {
    this.group = new THREE.Group();
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 15, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.30, side: THREE.DoubleSide, depthWrite: false }),
    );
    pillar.position.y = 7.5;
    this.group.add(pillar);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.1, 0.16, 8, 28),
      new THREE.MeshBasicMaterial({ color: GOLD }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    this.group.add(ring);
    this.ring = ring;
    if (label) {
      const s = labelSprite(label);
      s.position.y = 16.5;
      this.group.add(s);
    }
    scene.add(this.group);
  }
  set(x, z) { this.group.position.set(x, 0, z); }
  show(v) { this.group.visible = v; }
  pulse(t) {
    const s = 1 + Math.sin(t * 3.2) * 0.10;
    this.ring.scale.set(s, s, 1);
  }
  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }
}

/** Drive a car along grid waypoints at a steady cruise (the follow target). */
class RouteDriver {
  constructor(car, waypoints) {
    this.car = car;
    this.points = waypoints;
    this.i = 0;
    this.done = false;
  }
  update(dt) {
    const car = this.car;
    if (this.done) { car.speed = Math.max(0, car.speed - 10 * dt); return; }
    const target = this.points[this.i];
    const dx = target.x - car.x, dz = target.z - car.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 5) {
      this.i++;
      if (this.i >= this.points.length) { this.done = true; return; }
      return;
    }
    const targetHeading = Math.atan2(dx, dz);
    let turn = targetHeading - car.heading;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    car.heading += Math.max(-1.7 * dt, Math.min(1.7 * dt, turn));
    car.speed += Math.max(-8 * dt, Math.min(5 * dt, 9.5 - car.speed));
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
  }
}

function gridRoute(from, to) {
  return [{ x: to.x, z: from.z }, { x: to.x, z: to.z }];
}

export class MissionRunner {
  constructor(scene, fleet, save, hooks) {
    this.scene = scene;
    this.fleet = fleet;
    this.save = save;
    this.hooks = hooks;
    this.phase = "offer"; // offer | active | done
    this.mission = null;
    this.step = 0;
    this.remaining = [];
    this.timeLeft = 0;
    this.specialCar = null;
    this.followDriver = null;
    this.followCar = null;
    this.lostTimer = 0;
    this.spookTimer = 0;
    this.offerMarker = new Marker(scene, "");
    this.targetMarkers = [new Marker(scene, null), new Marker(scene, null), new Marker(scene, null),
      new Marker(scene, null), new Marker(scene, null), new Marker(scene, null)];
    this.offerMarker.show(false);
    this.targetMarkers.forEach((m) => m.show(false));
    this.refreshOffer();
  }

  refreshOffer() {
    this.mission = nextMission(this.save);
    this.phase = this.mission ? "offer" : "done";
    this.step = 0;
    if (this.mission) {
      const start = this.mission.points[0];
      this.offerMarker.set(start.x, start.z);
      this.offerMarker.show(true);
      this.spawnSpecialCar();
    } else {
      this.offerMarker.show(false);
    }
    this.hideTargets();
  }

  /** Steal missions keep their target car parked in the world, waiting. */
  spawnSpecialCar() {
    const m = this.mission;
    if (!m || (m.kind !== "steal" && m.kind !== "escape")) return;
    if (this.specialCar && !this.specialCar.dead) return;
    const p = m.points[0];
    this.specialCar = this.fleet.addCar({
      x: p.x, z: p.z, heading: m.kind === "steal" ? 0.4 : -0.5,
      color: m.kind === "steal" ? 0xc22e3e : 0xd8b13c,
      kind: "sport",
    });
    if (this.specialCar) this.specialCar.parked = true;
  }

  hideTargets() {
    this.targetMarkers.forEach((m) => m.show(false));
  }

  start() {
    const m = this.mission;
    this.phase = "active";
    this.step = 0;
    this.offerMarker.show(false);
    this.hooks.banner(m.title, m.brief);
    this.hooks.blip(660, 0.09);
    if (m.heatOnStart) this.hooks.setHeat(m.heatOnStart);
    if (m.timeLimit) this.timeLeft = m.timeLimit;
    if (m.kind === "collect") {
      this.remaining = m.points.map((p, i) => ({ ...p, i }));
      this.remaining.forEach((p, i) => {
        this.targetMarkers[i].set(p.x, p.z);
        this.targetMarkers[i].show(true);
      });
    } else if (m.kind === "follow") {
      const f = m.follow;
      this.followCar = this.fleet.addCar({ x: f.from.x, z: f.from.z, heading: Math.PI, color: 0x8a93a5, kind: "sedan" });
      this.followDriver = new RouteDriver(this.followCar, gridRoute(f.from, f.to));
      this.lostTimer = 0;
      this.spookTimer = 0;
    } else if (m.kind === "steal" || m.kind === "escape") {
      this.targetMarkers[0].set(m.points[1].x, m.points[1].z);
      this.targetMarkers[0].show(false); // lights up once the car is taken
    } else {
      this.showStepTarget();
    }
  }

  showStepTarget() {
    this.hideTargets();
    const p = this.mission.points[this.step];
    if (!p) return;
    this.targetMarkers[0].set(p.x, p.z);
    this.targetMarkers[0].show(true);
  }

  get objectiveText() {
    const m = this.mission;
    if (!m) return this.save.finished ? "Debt cleared. Port Meridian is yours." : "Story complete — pay Venn Loans to close the book.";
    if (this.phase === "offer") return `New work: ${m.title} — head for the gold light`;
    if (m.kind === "collect") return `${m.title}: ${this.remaining.length} envelope(s) left`;
    if (m.kind === "follow") return `${m.title}: stay on the grey sedan — not too close, not too far`;
    if ((m.kind === "steal" || m.kind === "escape") && this.step === 0) return `${m.title}: ${m.points[0].label}`;
    const p = m.points[this.step];
    return p ? `${m.title}: ${p.label}` : m.title;
  }

  /** World positions the minimap should mark right now. */
  markerPositions() {
    if (!this.mission) return [];
    if (this.phase === "offer") return [{ x: this.mission.points[0].x, z: this.mission.points[0].z }];
    if (this.mission.kind === "collect") return this.remaining.map((p) => ({ x: p.x, z: p.z }));
    if (this.mission.kind === "follow") return this.followCar ? [{ x: this.followCar.x, z: this.followCar.z }] : [];
    if ((this.mission.kind === "steal" || this.mission.kind === "escape") && this.step === 0) {
      return [{ x: this.mission.points[0].x, z: this.mission.points[0].z }];
    }
    const p = this.mission.points[this.step];
    return p ? [{ x: p.x, z: p.z }] : [];
  }

  complete() {
    const m = this.mission;
    this.hideTargets();
    if (this.followCar) { this.fleet.removeCar(this.followCar); this.followCar = null; this.followDriver = null; }
    this.hooks.completeMission(m);
    this.hooks.banner("Mission complete", `${m.title} — $${m.reward.toLocaleString()} earned`);
    this.hooks.jingle();
    this.refreshOffer();
  }

  fail(reason) {
    this.hideTargets();
    if (this.followCar) { this.fleet.removeCar(this.followCar); this.followCar = null; this.followDriver = null; }
    this.hooks.toast(`Mission failed: ${reason} — the offer still stands`);
    this.phase = "offer";
    this.offerMarker.show(true);
  }

  update(dt, t) {
    this.offerMarker.pulse(t);
    this.targetMarkers.forEach((m) => m.pulse(t));
    const player = this.hooks.getPlayer();
    const m = this.mission;
    if (!m) return;

    if (this.phase === "offer") {
      const p = m.points[0];
      const nearSpecial = (m.kind === "steal" || m.kind === "escape")
        ? player.car && this.specialCar && player.car === this.specialCar
        : false;
      if (nearSpecial) {
        this.start();
        this.onStole();
        return;
      }
      if (Math.hypot(player.x - p.x, player.z - p.z) < 7) this.start();
      return;
    }
    if (this.phase !== "active") return;

    // Timers that can kill a run.
    if (m.timeLimit) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) return this.fail("out of time");
    }

    switch (m.kind) {
      case "fare":
      case "timed":
      case "escape":
      case "steal": {
        if (m.kind === "steal" || m.kind === "escape") {
          if (this.step === 0) {
            if (player.car && this.specialCar && player.car === this.specialCar) this.onStole();
            break;
          }
        }
        const p = m.points[this.step];
        const radius = player.car ? 7 : 5;
        if (Math.hypot(player.x - p.x, player.z - p.z) < radius) {
          this.step++;
          this.hooks.blip(880, 0.07);
          if (this.step >= m.points.length) this.complete();
          else this.showStepTarget();
        }
        break;
      }
      case "collect": {
        const hit = this.remaining.findIndex((p) => Math.hypot(player.x - p.x, player.z - p.z) < 5.5);
        if (hit >= 0) {
          this.remaining.splice(hit, 1);
          this.hooks.blip(990, 0.07);
          this.hooks.toast(`Envelope collected — ${this.remaining.length} to go`);
          this.hideTargets();
          this.remaining.forEach((p, i) => {
            this.targetMarkers[i].set(p.x, p.z);
            this.targetMarkers[i].show(true);
          });
          if (this.remaining.length === 0) this.complete();
        }
        break;
      }
      case "checkpoints": {
        const p = m.points[this.step];
        if (Math.hypot(player.x - p.x, player.z - p.z) < 9.5) {
          this.step++;
          this.hooks.blip(990, 0.07);
          if (this.step >= m.points.length) this.complete();
          else this.showStepTarget();
        }
        break;
      }
      case "follow": {
        if (!this.followDriver || !this.followCar) break;
        this.followDriver.update(dt);
        const d = Math.hypot(player.x - this.followCar.x, player.z - this.followCar.z);
        if (this.followDriver.done) {
          if (d < m.follow.maxDist + 14) this.complete();
          else this.fail("you lost him at the drop");
          break;
        }
        if (d > m.follow.maxDist) {
          this.lostTimer += dt;
          if (this.lostTimer > 2) this.hooks.toast("You're losing him — close the gap!");
          if (this.lostTimer > 6.5) return this.fail("you lost the courier");
        } else this.lostTimer = Math.max(0, this.lostTimer - dt * 2);
        if (d < m.follow.minDist) {
          this.spookTimer += dt;
          if (this.spookTimer > 2) this.hooks.toast("Too close — he'll make you!");
          if (this.spookTimer > 5) return this.fail("you spooked the courier");
        } else this.spookTimer = Math.max(0, this.spookTimer - dt * 2);
        break;
      }
    }
  }

  onStole() {
    const m = this.mission;
    this.step = 1;
    if (m.heatOnSteal) this.hooks.setHeat(m.heatOnSteal);
    this.hooks.toast(m.kind === "escape" ? "That's her car. Now run." : "Got it — get it to the yard");
    this.hooks.crime("theft");
    this.showStepTarget();
  }

  /** Seconds left for the HUD, or null when no clock is running. */
  get clockLeft() {
    return this.phase === "active" && this.mission?.timeLimit ? Math.max(0, this.timeLeft) : null;
  }
}

export { MISSIONS };
