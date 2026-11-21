// game.js — the Game: owns the renderer, the player (on foot and in cars),
// the camera, collisions, the wanted loop, the mission wiring, the save, and
// every screen state from title to busted. city.js builds the world,
// vehicles.js the traffic, police.js the hunt, missions.js the story; this
// file is where they all meet the player.

import * as THREE from 'three';
import { buildCity } from './city.js';
import { LANDMARKS as L, STAR_CACHE_POINTS } from './cityplan.js';
import { MissionDirector, DEBT } from './missions.js';
import { WantedLevel } from './wanted.js';
import { createCarMesh, Traffic, forwardOf } from './vehicles.js';
import { Police } from './police.js';
import { Pedestrians, PlayerFigure } from './people.js';
import { Hud } from './hud.js';
import { GameAudio } from './audio.js';
import { Input } from './input.js';
import { clamp, createRng, groundDistance, turnToward } from './rng.js';
import { glowTexture } from './textures.js';

const SAVE_KEY = 'leonida-after-dark-save';
const CAR_MAX_SPEED = 26;
const SPORT_MAX_SPEED = 30;

export class Game {
  constructor(canvas, seed = 1) {
    this.canvas = canvas;
    this.rng = createRng(seed);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 3200);
    this.city = buildCity(this.scene, this.rng);
    this.colliders = this.city.colliders;

    this.input = new Input(canvas);
    this.hud = new Hud();
    this.audio = new GameAudio();
    this.wanted = new WantedLevel();
    this.traffic = new Traffic(this.scene, this.rng.fork(), 12);
    this.police = new Police(this.scene);
    this.peds = new Pedestrians(this.scene, this.rng.fork(), 18);
    this.figure = new PlayerFigure(this.scene);

    this.mode = 'title'; // title | play | paused | busted | complete
    this.onFoot = true;
    this.playerPos = { x: L.playerSpawn.x, z: L.playerSpawn.z };
    this.playerHeading = Math.PI; // face the street (north, toward -z is PI? heading PI faces -z)
    this.playerSpeed = 0;
    this.car = null;
    this.cash = 0;
    this.time = 0;
    this.heatCooldown = 0;
    this.speedingCooldown = 0;
    this.shoveCooldown = 0;
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camDist = 8;
    this.lastDragAt = -10;
    this.cameraOverride = null;
    this.titleOrbit = 0;
    this.pressLive = false;

    this.buildDrivables();
    this.buildMissionProps();
    this.wireDirector();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ---------------------------------------------------------------- setup
  buildDrivables() {
    this.drivables = [];
    const add = (mesh, x, z, heading, kind) => {
      mesh.position.set(x, 0, z);
      mesh.rotation.y = heading;
      this.scene.add(mesh);
      const car = { mesh, pos: { x, z }, heading, speed: 0, kind, stolen: false, maxSpeed: kind === 'sport' ? SPORT_MAX_SPEED : CAR_MAX_SPEED };
      this.drivables.push(car);
      return car;
    };
    // Zara's coupe, waiting by her garage.
    this.coupe = add(createCarMesh(0x0f766e), L.zaraCoupe.x, L.zaraCoupe.z, Math.PI / 2, 'coupe');
    // The gold Vortex GT at the casino valet — mission 7's target.
    this.vortex = add(createCarMesh(0xd4af37, { sport: true }), L.casinoValet.x, L.casinoValet.z, -Math.PI / 2, 'sport');
    this.vortex.isVortex = true;
    // The silver Comet the player tails in mission 3 (drives itself then).
    this.comet = add(createCarMesh(0xd8d8dc, { sport: true }), 84, -70, -Math.PI / 2, 'sport');
    this.cometDriver = { target: null, speed: 0, active: false };
    // Parked cars on the two car-park blocks and along Ocean Drive.
    const rng = this.rng.fork();
    const spots = [];
    for (const [bx, bz] of [[-96, -32], [96, 96]]) {
      for (let i = 0; i < 6; i += 1) spots.push({ x: bx - 15 + (i % 3) * 15, z: bz - 10 + Math.floor(i / 3) * 20, h: Math.PI / 2 });
    }
    for (let i = 0; i < 5; i += 1) spots.push({ x: 186, z: -120 + i * 52, h: 0 });
    for (const spot of spots) {
      add(createCarMesh(rng.pick([0xc23b4e, 0x2e6fc2, 0xd8d8dc, 0x22242a, 0x3fae6a, 0xe07b2a, 0x7a4fd0, 0xb8b0a4]), { sport: rng.chance(0.2) }), spot.x, spot.z, spot.h, 'parked');
    }
  }

  buildMissionProps() {
    // The objective beacon: a soft pillar of gold light at the current target.
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.7, 1.7, 30, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    this.beacon.position.y = 15;
    this.scene.add(this.beacon);
    // Star caches for mission 4.
    this.caches = STAR_CACHE_POINTS.map((point) => {
      const star = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), new THREE.MeshBasicMaterial({ color: 0xffd23e, fog: false }));
      star.position.set(point.x, 1.6, point.z);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd23e, transparent: true, depthWrite: false }));
      glow.scale.setScalar(6);
      star.add(glow);
      star.visible = false;
      this.scene.add(star);
      return star;
    });
    // The ledger crate glows faintly in the dockyard during mission 6.
    this.ledger = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.8), new THREE.MeshBasicMaterial({ color: 0x3dff8f, fog: false }));
    this.ledger.position.set(L.ledgerCrate.x, 0.65, L.ledgerCrate.z);
    this.ledger.visible = false;
    this.scene.add(this.ledger);
  }

  wireDirector() {
    this.director = new MissionDirector({
      onMissionStart: (mission) => {
        this.hud.missionCard(`Job ${this.director.index + 1} — ${mission.title}`, mission.brief, 6);
        this.audio.chime();
      },
      onStage: (stage) => {
        if (stage && stage.heatStars) {
          this.wanted.setMinimumStars(stage.heatStars);
          this.hud.toast('Meridian PD is rolling — lose them!', 3.5);
        }
        if (stage && stage.kind === 'tail') this.cometDriver.active = true;
        if (!stage || stage.kind !== 'tail') this.cometDriver.active = false;
      },
      onMessage: (text) => this.hud.toast(text),
      onMissionComplete: (mission) => {
        this.cash += mission.reward;
        this.hud.setCash(this.cash);
        this.hud.missionCard('Job done', `${mission.title} — +$${mission.reward.toLocaleString('en-US')}. Debt paid: $${Math.min(this.cash, DEBT).toLocaleString('en-US')} of $${DEBT.toLocaleString('en-US')}.`, 5);
        this.audio.success();
        this.saveGame();
      },
      onMissionFailed: (mission, reason) => {
        this.hud.toast(`${reason} — ${mission.title} starts again.`, 4);
        this.audio.fail();
      },
      onAllComplete: () => {
        this.mode = 'complete';
        this.hud.banner('Dawn breaks over Serena Bay', `Debt paid. Nico keeps $${this.cash.toLocaleString('en-US')} and the city. Free roam — the night is yours. Press Enter to keep driving.`);
        this.saveGame();
      },
    });
  }

  // ---------------------------------------------------------------- save
  saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: this.cash, missionIndex: Math.min(this.director.index, 8) }));
    } catch {
      /* private mode: the night is simply not remembered */
    }
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  hasSave() {
    const save = this.loadSave();
    return !!save && (save.cash > 0 || save.missionIndex > 0);
  }

  // ---------------------------------------------------------------- flow
  startGame(fromSave) {
    const save = fromSave ? this.loadSave() : null;
    this.cash = save ? save.cash : 0;
    this.hud.setCash(this.cash);
    this.wanted.clear();
    this.mode = 'play';
    this.hud.showHud();
    this.hud.hideBanner();
    document.getElementById('title-screen').style.display = 'none';
    this.director.startAt(save ? save.missionIndex : 0);
  }

  busted() {
    this.mode = 'busted';
    const fine = Math.max(150, Math.round(this.cash * 0.15));
    this.cash = Math.max(0, this.cash - fine);
    this.hud.setCash(this.cash);
    this.wanted.clear();
    this.exitCar(true);
    this.playerPos = { x: L.safehouse.x, z: L.safehouse.z + 4 };
    this.hud.banner('BUSTED', `Meridian PD takes its cut: $${fine.toLocaleString('en-US')}. The crew walks you home. Press Enter to get back to work.`);
    this.audio.fail();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- helpers
  /** Push a ground position out of every building collider; returns push depth. */
  pushOut(pos, radius) {
    let pushed = 0;
    for (const c of this.colliders) {
      const nx = clamp(pos.x, c.minX, c.maxX);
      const nz = clamp(pos.z, c.minZ, c.maxZ);
      const dx = pos.x - nx;
      const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 > radius * radius) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
        pushed = Math.max(pushed, radius - d);
      } else {
        // Centre inside the box: leave by the nearest face.
        const left = pos.x - c.minX;
        const right = c.maxX - pos.x;
        const top = pos.z - c.minZ;
        const bottom = c.maxZ - pos.z;
        const min = Math.min(left, right, top, bottom);
        if (min === left) pos.x = c.minX - radius;
        else if (min === right) pos.x = c.maxX + radius;
        else if (min === top) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
        pushed = Math.max(pushed, radius);
      }
    }
    return pushed;
  }

  /** Keep a ground position inside the island (the pier is the one way over water). */
  clampToWorld(pos) {
    const onPier = pos.z > -150 && pos.z < -138 && pos.x > 236;
    pos.x = clamp(pos.x, -246, onPier ? 300 : 258);
    pos.z = clamp(pos.z, -182, 182);
    if (!onPier && pos.x > 252 && pos.z > -138) pos.x = 252;
  }

  nearestDrivable(maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const car of this.drivables) {
      if (car === this.car) continue;
      const d = groundDistance(this.playerPos, car.pos);
      if (d < bestDist) {
        bestDist = d;
        best = car;
      }
    }
    return best;
  }

  enterCar(car) {
    this.car = car;
    this.onFoot = false;
    car.speed = 0;
    this.figure.group.visible = false;
    if (car.isVortex) this.director.notify('enteredTargetCar');
    if (!car.stolen && car.kind !== 'coupe') {
      car.stolen = true;
      this.wanted.addHeat('stealCar');
      this.hud.toast('Car taken. Someone may have noticed.', 2.4);
    }
    this.audio.click();
  }

  exitCar(silent = false) {
    if (!this.car) return;
    const car = this.car;
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    this.playerPos = { x: car.pos.x + side.x * 2.2, z: car.pos.z + side.z * 2.2 };
    this.pushOut(this.playerPos, 0.5);
    this.playerHeading = car.heading;
    this.car = null;
    this.onFoot = true;
    this.figure.group.visible = true;
    if (!silent) this.audio.click();
  }

  // ---------------------------------------------------------------- update
  /** One fixed step of the whole world. dt in seconds. */
  step(dt) {
    this.time += dt;
    this.city.update(dt);
    if (this.mode === 'title') {
      this.titleOrbit += dt * 0.05;
      const cx = 150 + Math.cos(this.titleOrbit) * 120;
      const cz = 40 + Math.sin(this.titleOrbit) * 120;
      this.camera.position.set(cx, 42, cz);
      this.camera.lookAt(120, 8, 20);
      this.figure.group.visible = false;
      this.traffic.update(dt, { x: 150, z: 20 }, []);
      this.peds.update(dt);
      return;
    }
    if (this.mode !== 'play') return;

    this.heatCooldown = Math.max(0, this.heatCooldown - dt);
    this.speedingCooldown = Math.max(0, this.speedingCooldown - dt);
    this.shoveCooldown = Math.max(0, this.shoveCooldown - dt);

    const mouse = this.input.takeMouse();
    if (mouse.dx || mouse.dy) this.lastDragAt = this.time;
    this.camYaw -= mouse.dx * 0.0048;
    this.camPitch = clamp(this.camPitch + mouse.dy * 0.003, 0.06, 1.05);
    this.camDist = clamp(this.camDist + mouse.wheel * 1.2, 5, 16);

    if (this.onFoot) this.stepOnFoot(dt);
    else this.stepDriving(dt);

    // Traffic, police, pedestrians.
    const focus = this.onFoot ? this.playerPos : this.car.pos;
    const blockers = this.police.positions().map((p) => ({ x: p.x, z: p.z }));
    for (const car of this.drivables) if (car !== this.car) blockers.push({ x: car.pos.x, z: car.pos.z });
    blockers.push({ x: focus.x, z: focus.z });
    this.traffic.update(dt, focus, blockers);
    this.stepComet(dt);
    this.peds.update(dt);

    const playerSpeed = this.onFoot ? this.playerSpeed : Math.abs(this.car.speed);
    const policeReport = this.police.update(dt, { pos: focus, speed: playerSpeed }, this.wanted.stars, this.rng, (p, r) => this.pushOut(p, r));
    const bustedNow = this.wanted.update(dt, policeReport.seen, policeReport.nearest !== null ? { distance: policeReport.nearest, playerSpeed } : null);
    if (bustedNow === 'busted') {
      this.busted();
      return;
    }

    this.checkCarCollisions(dt);
    this.director.update(dt, {
      pos: focus,
      onFoot: this.onFoot,
      stars: this.wanted.stars,
      targetDistance: this.cometDriver.active ? groundDistance(focus, this.comet.pos) : null,
    });
    this.updateProps();
    this.updateHud(policeReport.nearest);
    this.audio.update(dt, {
      driving: !this.onFoot,
      speedNorm: this.onFoot ? 0 : Math.abs(this.car.speed) / SPORT_MAX_SPEED,
      nearestPolice: policeReport.nearest,
    });
    this.updateCamera(dt);
    this.hud.tick();
    this.pressLive = false;
  }

  /** Edge-triggered press, live only on the first fixed step of a frame. */
  pressed(code) {
    return this.pressLive && this.input.wasPressed(code);
  }

  stepOnFoot(dt) {
    const axes = this.input.axes();
    const sprint = this.input.down('ShiftLeft') || this.input.down('ShiftRight');
    const maxSpeed = sprint ? 7.2 : 4.3;
    const fwd = { x: Math.sin(this.camYaw), z: Math.cos(this.camYaw) };
    const right = { x: -fwd.z, z: fwd.x };
    let mx = fwd.x * axes.y + right.x * axes.x;
    let mz = fwd.z * axes.y + right.z * axes.x;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      const targetHeading = Math.atan2(mx, mz);
      this.playerHeading = turnToward(this.playerHeading, targetHeading, 11 * dt);
      this.playerSpeed = Math.min(maxSpeed, this.playerSpeed + 26 * dt);
    } else {
      this.playerSpeed = Math.max(0, this.playerSpeed - 30 * dt);
    }
    const f = forwardOf(this.playerHeading);
    const blend = this.playerSpeed > 0.1 ? clamp(this.playerSpeed / maxSpeed, 0, 1) : 0;
    this.playerPos.x += (f.x * blend + mx * (1 - blend)) * this.playerSpeed * dt * (len > 0.01 ? 1 : 0);
    this.playerPos.z += (f.z * blend + mz * (1 - blend)) * this.playerSpeed * dt * (len > 0.01 ? 1 : 0);
    if (len <= 0.01) {
      this.playerPos.x += f.x * this.playerSpeed * dt;
      this.playerPos.z += f.z * this.playerSpeed * dt;
    }
    this.pushOut(this.playerPos, 0.5);
    this.clampToWorld(this.playerPos);
    this.figure.group.position.set(this.playerPos.x, 0, this.playerPos.z);
    this.figure.group.rotation.y = this.playerHeading;
    this.figure.update(dt, this.playerSpeed);

    // Shove: Space near a pedestrian.
    if (this.pressed('Space') && this.shoveCooldown <= 0) {
      this.shoveCooldown = 0.7;
      this.figure.shovePose();
      const reach = { x: this.playerPos.x + f.x * 1.3, z: this.playerPos.z + f.z * 1.3 };
      const fell = this.peds.knockAt(reach, 1.5);
      if (fell > 0) {
        this.wanted.addHeat('shovePedestrian');
        this.audio.thud();
        this.hud.toast('That was seen.', 1.6);
      }
    }
    // Enter a car.
    const near = this.nearestDrivable(3.4);
    if (near && this.pressed('KeyE')) this.enterCar(near);
  }

  stepDriving(dt) {
    const car = this.car;
    const axes = this.input.axes();
    const handbrake = this.input.down('Space');
    const throttle = axes.y;
    if (throttle > 0) car.speed += (car.speed < 0 ? 22 : 13.5) * dt;
    else if (throttle < 0) car.speed -= (car.speed > 0 ? 24 : 8) * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 3.2 * dt);
    if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 9 * dt);
    car.speed = clamp(car.speed, -9, car.maxSpeed);
    const steer = -axes.x;
    const speedFactor = clamp(Math.abs(car.speed) / 7, 0, 1) * (car.speed < 0 ? -1 : 1);
    const turnRate = (handbrake ? 2.5 : 1.65) * speedFactor;
    car.heading += steer * turnRate * dt;
    const f = forwardOf(car.heading);
    car.pos.x += f.x * car.speed * dt;
    car.pos.z += f.z * car.speed * dt;
    const impact = this.pushOut(car.pos, 1.75);
    if (impact > 0.02) {
      if (Math.abs(car.speed) > 9 && this.heatCooldown <= 0) {
        this.wanted.addHeat('hitProp');
        this.heatCooldown = 1.2;
      }
      if (Math.abs(car.speed) > 4) this.audio.thud();
      car.speed *= impact > 0.4 ? -0.22 : 0.55;
    }
    this.clampToWorld(car.pos);
    car.mesh.position.set(car.pos.x, 0, car.pos.z);
    car.mesh.rotation.y = car.heading;
    car.mesh.rotation.z = steer * clamp(Math.abs(car.speed) / car.maxSpeed, 0, 1) * 0.045;

    // Pedestrians: near misses scatter them; contact at speed puts them down.
    if (Math.abs(car.speed) > 5) this.peds.scareAt(car.pos, 8);
    if (Math.abs(car.speed) > 6.5) {
      const fell = this.peds.knockAt(car.pos, 2.1);
      if (fell > 0 && this.heatCooldown <= 0) {
        this.wanted.addHeat('hitPedestrian');
        this.heatCooldown = 1;
        this.audio.thud();
        car.speed *= 0.8;
      }
    }
    // Speeding past a cruiser is noticed.
    if (Math.abs(car.speed) > 20 && this.speedingCooldown <= 0) {
      const near = this.police.positions().some((p) => groundDistance(p, car.pos) < 42);
      if (near) {
        this.wanted.addHeat('speedingNearPolice');
        this.speedingCooldown = 2;
      }
    }
    if (this.pressed('KeyE') && Math.abs(car.speed) < 1.2) this.exitCar();
  }

  /** The Comet's own little driver for the tail mission: loops the grid. */
  stepComet(dt) {
    const driver = this.cometDriver;
    const comet = this.comet;
    if (this.car === comet) {
      driver.active = false;
      return;
    }
    if (!driver.active) return;
    if (!driver.target || groundDistance(comet.pos, driver.target) < 7) {
      const avenues = [-192, -128, -64, 0, 64, 128, 192];
      const streets = [-128, -64, 0, 64, 128];
      driver.target = {
        x: avenues[this.rng.int(0, avenues.length - 1)],
        z: streets[this.rng.int(0, streets.length - 1)],
      };
    }
    const desired = Math.atan2(driver.target.x - comet.pos.x, driver.target.z - comet.pos.z);
    comet.heading = turnToward(comet.heading, desired, 1.5 * dt);
    driver.speed = Math.min(driver.speed + 6 * dt, 10.5);
    comet.speed = driver.speed;
    const f = forwardOf(comet.heading);
    comet.pos.x += f.x * comet.speed * dt;
    comet.pos.z += f.z * comet.speed * dt;
    this.pushOut(comet.pos, 1.75);
    comet.mesh.position.set(comet.pos.x, 0, comet.pos.z);
    comet.mesh.rotation.y = comet.heading;
  }

  checkCarCollisions(dt) {
    if (this.onFoot || !this.car) return;
    const car = this.car;
    const hitOther = (otherPos, radius, onHit) => {
      const d = groundDistance(car.pos, otherPos);
      if (d < radius && Math.abs(car.speed) > 3) {
        onHit();
        car.speed *= 0.55;
        this.audio.thud();
      }
    };
    for (const t of this.traffic.positions()) {
      hitOther(t, 3.3, () => {
        if (this.heatCooldown <= 0) {
          this.wanted.addHeat('hitCar');
          this.heatCooldown = 1.1;
        }
      });
    }
    for (const other of this.drivables) {
      if (other === car) continue;
      hitOther(other.pos, 3.3, () => {
        if (this.heatCooldown <= 0) {
          this.wanted.addHeat('hitCar');
          this.heatCooldown = 1.1;
        }
      });
    }
    for (const p of this.police.positions()) {
      const d = groundDistance(car.pos, p);
      if (d < 3.5) {
        // Shove the cruiser off line a little; it costs speed and draws heat.
        const away = { x: (p.x - car.pos.x) / (d || 1), z: (p.z - car.pos.z) / (d || 1) };
        p.cruiser.pos.x += away.x * (3.5 - d) * 0.6;
        p.cruiser.pos.z += away.z * (3.5 - d) * 0.6;
        if (Math.abs(car.speed) > 3) {
          car.speed *= 0.6;
          this.audio.thud();
          if (this.heatCooldown <= 0) {
            this.wanted.addHeat('hitPoliceCar');
            this.heatCooldown = 1.4;
          }
        }
      }
    }
    void dt;
  }

  updateProps() {
    const stage = this.director.stage;
    const target = this.director.stageTarget();
    const tailTarget = stage && stage.kind === 'tail' ? this.comet.pos : null;
    const markAt = tailTarget ?? target;
    if (markAt && this.mode === 'play') {
      this.beacon.visible = true;
      this.beacon.position.x = markAt.x;
      this.beacon.position.z = markAt.z;
    } else {
      this.beacon.visible = false;
    }
    const collectActive = !!stage && stage.kind === 'collect';
    this.caches.forEach((star, i) => {
      star.visible = collectActive && !this.director.collected.has(i);
      if (star.visible) {
        star.rotation.y += 0.03;
        star.position.y = 1.6 + Math.sin(this.time * 2.4 + i) * 0.25;
      }
    });
    this.ledger.visible = !!stage && this.director.mission && this.director.mission.id === 'dockside-ghost' && this.director.stageIndex === 0;
  }

  updateHud(nearestPolice) {
    const stage = this.director.stage;
    const target = stage && stage.kind === 'tail' ? this.comet.pos : this.director.stageTarget();
    const focus = this.onFoot ? this.playerPos : this.car.pos;
    this.hud.setStars(this.wanted.stars);
    this.hud.setObjective(this.director.objectiveText(), target ? groundDistance(focus, target) : null);
    this.hud.setSpeed(this.onFoot ? 0 : this.car.speed, !this.onFoot);
    this.hud.setTimer(this.director.timeLeft);
    this.hud.setBust(this.wanted.bustMeter);
    const prompt = document.getElementById('prompt');
    if (this.onFoot) {
      const near = this.nearestDrivable(3.4);
      prompt.textContent = near ? 'E — get in' : '';
    } else {
      prompt.textContent = Math.abs(this.car.speed) < 1.2 ? 'E — get out' : '';
    }
    this.hud.drawMinimap({
      player: { x: focus.x, z: focus.z, heading: this.onFoot ? this.playerHeading : this.car.heading },
      target,
      police: this.police.positions(),
      traffic: this.traffic.positions(),
      peds: [],
    });
    void nearestPolice;
  }

  updateCamera(dt) {
    if (this.cameraOverride) {
      this.camera.position.copy(this.cameraOverride.pos);
      this.camera.lookAt(this.cameraOverride.look);
      return;
    }
    const focus = this.onFoot ? this.playerPos : this.car.pos;
    const heading = this.onFoot ? this.playerHeading : this.car.heading;
    if (!this.onFoot && Math.abs(this.car.speed) > 4 && this.time - this.lastDragAt > 2.5) {
      this.camYaw = turnToward(this.camYaw, heading, 1.6 * dt);
    }
    const dist = this.camDist * (this.onFoot ? 0.85 : 1.25);
    const back = { x: Math.sin(this.camYaw), z: Math.cos(this.camYaw) };
    const wantedPos = new THREE.Vector3(
      focus.x - back.x * dist * Math.cos(this.camPitch),
      1.6 + Math.sin(this.camPitch) * dist,
      focus.z - back.z * dist * Math.cos(this.camPitch),
    );
    this.camera.position.lerp(wantedPos, 1 - Math.pow(0.0001, dt));
    this.camera.lookAt(focus.x, 1.5, focus.z);
    void heading;
  }

  /** Render one frame (the loop in main.js calls step() then this). */
  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
