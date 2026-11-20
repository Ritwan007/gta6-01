// The city of Caldera Bay: a 7x7 street grid, 36 blocks, 5 districts with distinct
// palettes and heights, landmark buildings (Sorren Motors garage, SunMart, Casa Palma,
// Ammo Depot, Noodle House, hideouts), palms, lamps, billboards and sun coins.
//
// Every gameplay point sits ON a street centreline in open ground — the reachability
// report at the bottom proves it: every point clears every building AABB by >= 3 m.
import * as THREE from 'three';
import { WORLD, DISTRICTS, POINTS, SHOPS, districtAt } from './config.js';
import { createRandom, pick, range, dist2d } from './random.js';
import { makeFacadeTexture, makeGroundTexture, makeSignTexture, makeBillboardTexture } from './textures.js';

const LANDMARKS = [
  // Sorren Motors: the garage. Block (-300, 180); forecourt point is on street z=120.
  { id: 'garage', cx: -300, cz: 180, hw: 26, hd: 20, h: 10, color: '#b8452a', sign: 'SORREN MOTORS', signBg: '#7a1e08', signFg: '#ffd23e' },
  // Casa Palma hotel. Block (-180, -180); front point on street x=-240.
  { id: 'casa', cx: -180, cz: -180, hw: 22, hd: 22, h: 26, color: '#e8dcc0', sign: 'CASA PALMA', signBg: '#1e5a6e', signFg: '#ffffff' },
  // SunMart. Block (180, -60); front point on street x=120.
  { id: 'sunmart', cx: 180, cz: -60, hw: 24, hd: 20, h: 9, color: '#2a7a4a', sign: 'SUNMART', signBg: '#0e5a2e', signFg: '#ffffff' },
  // Ammo Depot. Block (300, 180); front point on street x=240.
  { id: 'ammo', cx: 300, cz: 180, hw: 20, hd: 18, h: 9, color: '#4a4a52', sign: 'AMMO DEPOT', signBg: '#22222a', signFg: '#ffd23e' },
  // Noodle House. Block (-60, 180); front point on street x=-120.
  { id: 'noodle', cx: -60, cz: 180, hw: 18, hd: 16, h: 8, color: '#8a2a2a', sign: 'NOODLE HOUSE', signBg: '#5a1010', signFg: '#ffe9c9' },
];

export function buildCity(scene, seed) {
  const rng = createRandom(seed);
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  // Golden-hour sky + fog.
  scene.background = new THREE.Color(0xffb36b);
  scene.fog = new THREE.Fog(0xffc07a, 220, 780);

  const sun = new THREE.DirectionalLight(0xffd9a0, 2.6);
  sun.position.set(-180, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 800;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffd9b0, 0x4a3a52, 1.1));
  const city = { sun, buildings: [], colliders: [], group };

  // Ground.
  const groundTex = makeGroundTexture(rng);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size + 60, WORLD.size + 60),
    new THREE.MeshLambertMaterial({ map: groundTex }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  group.add(ground);

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function addBuilding(cx, cz, hw, hd, h, color, facade) {
    const mat = new THREE.MeshLambertMaterial({ map: facade || null, color: facade ? 0xffffff : color });
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(hw * 2, h, hd * 2);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'building';
    group.add(mesh);
    const rec = { x: cx, z: cz, hw, hd, h, mesh };
    city.buildings.push(rec);
    city.colliders.push({ minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd });
    return rec;
  }

  // Landmark buildings first, with signs on their street-facing side.
  const signMat = new THREE.MeshBasicMaterial({ transparent: false });
  for (const lm of LANDMARKS) {
    const d = districtAt(lm.cx, lm.cz);
    const facade = makeFacadeTexture(rng, lm.color, Math.max(2, Math.round(lm.h / 5)));
    addBuilding(lm.cx, lm.cz, lm.hw, lm.hd, lm.h, lm.color, facade);
    const signTex = makeSignTexture(lm.sign, lm.signBg, lm.signFg);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(34, lm.hw * 1.6), 8),
      new THREE.MeshBasicMaterial({ map: signTex }),
    );
    // Face the shop's street: the garage faces south (-z), the rest face west (-x).
    if (lm.id === 'garage') {
      sign.position.set(lm.cx, lm.h - 1.5, lm.cz - lm.hd - 0.2);
      sign.rotation.y = Math.PI;
    } else {
      sign.position.set(lm.cx - lm.hw - 0.2, lm.h - 1.5, lm.cz);
      sign.rotation.y = -Math.PI / 2;
    }
    group.add(sign);
    void d;
    void signMat;
  }

  // Fill the remaining blocks with district buildings (1-2 per block, set back from roads).
  const landmarkBlocks = new Set(LANDMARKS.map((l) => `${l.cx},${l.cz}`));
  const facadeCache = new Map();
  function facadeFor(color, floors) {
    const key = `${color}|${floors}`;
    if (!facadeCache.has(key)) facadeCache.set(key, makeFacadeTexture(rng, color, floors));
    return facadeCache.get(key);
  }
  for (let bx = -300; bx <= 300; bx += 120) {
    for (let bz = -300; bz <= 300; bz += 120) {
      if (landmarkBlocks.has(`${bx},${bz}`)) continue;
      const d = districtAt(bx, bz);
      const count = rng() < 0.55 ? 2 : 1;
      for (let i = 0; i < count; i += 1) {
        const w = range(rng, 22, 34);
        const dep = range(rng, 20, 32);
        const ox = count === 1 ? 0 : (i === 0 ? -14 : 14);
        const oz = count === 1 ? 0 : (i === 0 ? -12 : 12);
        const cx = bx + ox + range(rng, -6, 6);
        const cz = bz + oz + range(rng, -6, 6);
        const h = range(rng, d.tall[0], d.tall[1]);
        const color = pick(rng, d.palette);
        addBuilding(cx, cz, w / 2, dep / 2, h, color, facadeFor(color, Math.max(2, Math.round(h / 5))));
      }
    }
  }

  // Billboards on Neon Row.
  const bb1 = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), new THREE.MeshBasicMaterial({ map: makeBillboardTexture('CALDERA BAY', 'SUN • SEA • SPEED') }));
  bb1.position.set(60, 34, -129);
  group.add(bb1);
  const bb2 = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), new THREE.MeshBasicMaterial({ map: makeBillboardTexture('SORREN MOTORS', 'WE FIX ANYTHING') }));
  bb2.position.set(-180, 30, 129);
  bb2.rotation.y = Math.PI;
  group.add(bb2);

  // Palms along the Marina Sol waterfront + a few on Neon Row.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2a7a3a });
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 9, 6);
  const leafGeo = new THREE.SphereGeometry(3.2, 8, 6);
  for (let z = -360; z <= 360; z += 60) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 4.5;
    trunk.castShadow = true;
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.y = 9.5;
    leaves.scale.y = 0.55;
    leaves.castShadow = true;
    palm.add(trunk);
    palm.add(leaves);
    palm.position.set(384, 0, z + range(rng, -12, 12));
    group.add(palm);
  }

  // Lampposts at intersections (instanced, no colliders).
  const lampGeo = new THREE.CylinderGeometry(0.18, 0.22, 7, 6);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
  const lampHeadGeo = new THREE.SphereGeometry(0.7, 8, 6);
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const lampPositions = [];
  for (const sx of WORLD.streets) {
    for (const sz of WORLD.streets) lampPositions.push([sx + 11, sz + 11]);
  }
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampPositions.length);
  const heads = new THREE.InstancedMesh(lampHeadGeo, lampHeadMat, lampPositions.length);
  const m4 = new THREE.Matrix4();
  lampPositions.forEach(([x, z], i) => {
    m4.makeTranslation(x, 3.5, z);
    lamps.setMatrixAt(i, m4);
    m4.makeTranslation(x, 7.2, z);
    heads.setMatrixAt(i, m4);
  });
  lamps.castShadow = true;
  group.add(lamps);
  group.add(heads);

  // Sun coins (collectibles): 12, on street centrelines, clear of buildings by construction.
  const coinGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.25, 16);
  const coinMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  const coinSpots = [
    [-360, 0], [-240, 240], [-120, -240], [0, 120], [120, 360], [240, -240],
    [360, -60], [0, -360], [-360, -300], [120, 0], [240, 300], [-120, 60],
  ];
  city.shards = coinSpots.map(([x, z], i) => {
    const mesh = new THREE.Mesh(coinGeo, coinMat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, 1.2, z);
    mesh.name = `shard${i}`;
    group.add(mesh);
    return { id: i, x, z, mesh, taken: false };
  });

  // Objective beacon: a tall column of light the missions move around.
  const beaconGeo = new THREE.CylinderGeometry(1.6, 1.6, 90, 12, 1, true);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.y = 45;
  beacon.visible = false;
  beacon.name = 'beacon';
  group.add(beacon);
  city.beacon = beacon;

  city.points = {
    garage: POINTS.garage,
    hideout1: POINTS.hideout1,
    hideout2: POINTS.hideout2,
    missionCar: POINTS.missionCar,
    vanSpot: POINTS.vanSpot,
    dropCasa: POINTS.dropCasa,
    robDrop: POINTS.robDrop,
    finale: POINTS.finale,
    shops: SHOPS.map((s) => ({ ...s, radius: 8 })),
    spawn: WORLD.spawn,
  };

  // Race checkpoints (M5): a loop of street intersections, every leg axis-aligned
  // on a street so both the player and the AI racers can drive it without cutting
  // through blocks.
  city.racePoints = [
    [0, 0], [240, 0], [360, 0], [360, 120], [360, 360], [120, 360], [-120, 360],
    [-360, 360], [-360, 240], [-360, 0], [-360, -240], [-240, -240], [0, -240],
    [120, -240], [120, -120], [120, 0], [0, 0],
  ];

  city.setBeacon = (x, z, visible) => {
    beacon.position.x = x;
    beacon.position.z = z;
    beacon.visible = visible;
  };

  // --- Collision helpers -------------------------------------------------
  city.collides = (x, z, r) => {
    for (const c of city.colliders) {
      const nx = Math.max(c.minX, Math.min(x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
      if ((x - nx) ** 2 + (z - nz) ** 2 < r * r) return c;
    }
    return null;
  };
  // Push a circle out of every building AABB it overlaps.
  city.resolveCollision = (pos, r) => {
    for (const c of city.colliders) {
      const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - nx;
      const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * r;
          pos.z = nz + (dz / d) * r;
        } else {
          // Centre inside the box: push out along the smallest penetration axis.
          const px = Math.min(pos.x - c.minX, c.maxX - pos.x);
          const pz = Math.min(pos.z - c.minZ, c.maxZ - pos.z);
          if (px < pz) pos.x = pos.x - c.minX < c.maxX - pos.x ? c.minX - r : c.maxX + r;
          else pos.z = pos.z - c.minZ < c.maxZ - pos.z ? c.minZ - r : c.maxZ + r;
        }
      }
    }
    pos.x = Math.max(-415, Math.min(415, pos.x));
    pos.z = Math.max(-415, Math.min(415, pos.z));
  };
  // 2D segment vs building AABBs: true when the line of sight is blocked.
  city.losBlocked = (x1, z1, x2, z2) => {
    for (const c of city.colliders) {
      // Slab test on the segment.
      let tmin = 0;
      let tmax = 1;
      const dx = x2 - x1;
      const dz = z2 - z1;
      let ok = true;
      for (const [p, d, mn, mx] of [[x1, dx, c.minX, c.maxX], [z1, dz, c.minZ, c.maxZ]]) {
        if (Math.abs(d) < 1e-9) {
          if (p < mn || p > mx) { ok = false; break; }
        } else {
          let t1 = (mn - p) / d;
          let t2 = (mx - p) / d;
          if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
          tmin = Math.max(tmin, t1);
          tmax = Math.min(tmax, t2);
          if (tmin > tmax) { ok = false; break; }
        }
      }
      if (ok) return true;
    }
    return false;
  };

  // --- Road clearance report ----------------------------------------------
  // The reachability table checks gameplay points; this checks the roads
  // themselves: no building may overlap any street centreline (a building
  // centred on a street, like the old Ammo Depot at (300,120), blocks driving
  // while passing every point check). Samples every 10 m along every street.
  city.roadReport = () => {
    const bad = [];
    for (const s of WORLD.streets) {
      for (let v = -410; v <= 410; v += 10) {
        if (city.collides(s, v, 1)) bad.push({ street: `x=${s}`, at: v });
        if (city.collides(v, s, 1)) bad.push({ street: `z=${s}`, at: v });
      }
    }
    return bad;
  };

  // --- Reachability report ------------------------------------------------
  // Every gameplay point must sit outside every building AABB with >= 3 m clearance,
  // and its interact radius must reach from open ground. Mirrors the r12 37/37 table.
  city.reachabilityReport = () => {
    const rows = [];
    const check = (name, x, z, radius) => {
      let clearance = Infinity;
      for (const c of city.colliders) {
        const nx = Math.max(c.minX, Math.min(x, c.maxX));
        const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
        clearance = Math.min(clearance, dist2d(x, z, nx, nz));
      }
      const inside = city.colliders.some((c) => x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ);
      rows.push({ point: name, x, z, clearance: inside ? 0 : Math.round(clearance * 100) / 100, radius, result: !inside && clearance >= 3 ? 'PASS' : 'FAIL' });
    };
    check('garage', POINTS.garage.x, POINTS.garage.z, POINTS.garage.radius);
    check('hideout1', POINTS.hideout1.x, POINTS.hideout1.z, POINTS.hideout1.radius);
    check('hideout2', POINTS.hideout2.x, POINTS.hideout2.z, POINTS.hideout2.radius);
    check('missionCar', POINTS.missionCar.x, POINTS.missionCar.z, POINTS.missionCar.radius);
    check('vanSpot', POINTS.vanSpot.x, POINTS.vanSpot.z, POINTS.vanSpot.radius);
    check('dropCasa', POINTS.dropCasa.x, POINTS.dropCasa.z, POINTS.dropCasa.radius);
    check('robDrop', POINTS.robDrop.x, POINTS.robDrop.z, POINTS.robDrop.radius);
    check('finale', POINTS.finale.x, POINTS.finale.z, POINTS.finale.radius);
    check('spawn', WORLD.spawn.x, WORLD.spawn.z, 2);
    for (const s of SHOPS) check(`shop-${s.id}`, s.x, s.z, 8);
    city.shards.forEach((s) => check(`shard${s.id}`, s.x, s.z, 4));
    for (const [x, z] of city.racePoints) check(`race-${x},${z}`, x, z, 10);
    return rows;
  };

  return city;
}
