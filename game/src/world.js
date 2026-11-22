// world.js — Port Meridian itself: the streets, the towers, the neon
// and the sea.
//
// buildWorld(scene) raises the whole city from the street plan in
// logic.js — avenues, streets, blocks, beach, pier, dockyard, impound —
// and returns the collider set every mover resolves against, plus an
// update() that keeps the water, the lighthouse beam and the beacons
// alive. Everything is MeshBasicMaterial: the night is lit by colour,
// not by lamps, and sixty extra draw calls of glow cost nothing.
//
// resolveCollisions lives here too: a circle against the city's AABBs,
// pushed out along the shallowest axis. Police and the player share it,
// so a wall is a wall whoever meets it.

import * as THREE from "three";
import {
  AVENUES_X, OCEAN_DRIVE_X, STREETS_Z, ROAD_HALF, BEACH_X, WATER_X,
  PIER_Z, DOCKYARD, IMPOUND, LANDMARKS, WORLD, blockCenters, isWater,
} from "./logic.js";

// A private, seeded rain of numbers: the city is the same city on every
// load, so a screenshot taken tonight matches the one taken tomorrow.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();

function instance(mesh, i, x, y, z, yaw = 0, tiltX = 0, tiltZ = 0) {
  _e.set(tiltX, yaw, tiltZ);
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(1, 1, 1);
  _m.compose(_p, _q, _s);
  mesh.setMatrixAt(i, _m);
}

/** Push a circle at `pos` out of every AABB it touches. Returns {x, z}. */
export function resolveCollisions(pos, radius, colliders) {
  let x = pos.x;
  let z = pos.z;
  for (const c of colliders) {
    const minX = c.minX - radius;
    const maxX = c.maxX + radius;
    const minZ = c.minZ - radius;
    const maxZ = c.maxZ + radius;
    if (x > minX && x < maxX && z > minZ && z < maxZ) {
      const pushL = x - minX;
      const pushR = maxX - x;
      const pushB = z - minZ;
      const pushF = maxZ - z;
      const m = Math.min(pushL, pushR, pushB, pushF);
      if (m === pushL) x = minX;
      else if (m === pushR) x = maxX;
      else if (m === pushB) z = minZ;
      else z = maxZ;
    }
  }
  return { x, z };
}

function signTexture(text, fg, sub) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 192;
  const g = c.getContext("2d");
  g.clearRect(0, 0, 1024, 192);
  g.font = "900 118px Arial, sans-serif";
  g.textAlign = "center";
  g.shadowColor = fg;
  g.shadowBlur = 34;
  g.fillStyle = fg;
  g.fillText(text, 512, 128);
  g.shadowBlur = 12;
  g.fillText(text, 512, 128);
  if (sub) {
    g.font = "700 44px Arial, sans-serif";
    g.shadowBlur = 10;
    g.fillStyle = sub;
    g.fillText(sub, 512, 182);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function signMesh(text, fg, w, sub) {
  const mat = new THREE.MeshBasicMaterial({
    map: signTexture(text, fg, sub),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.1875), mat);
}

const NEON_WORDS = [
  ["HOTEL", "#ff5da2"], ["BAR", "#22d3ee"], ["24H", "#ffb84d"], ["LIQUOR", "#ff5252"],
  ["TATTOO", "#c77dff"], ["DINER", "#8aff5a"], ["CLUB NOVA", "#ff2e88"], ["PAWN", "#ffd76a"],
  ["MOTEL", "#7fe7ff"], ["GYROS", "#ffa726"], ["NO VACANCY", "#ff6a5e"], ["LOUNGE", "#4dd0e1"],
  ["KARAOKE", "#ff8ad8"], ["PHARMACY", "#7dffb0"], ["CINEMA", "#ffe082"], ["BODEGA", "#f48fb1"],
];

const FACADE_COLORS = [0x1a2030, 0x232038, 0x1c2a33, 0x2a1e2e, 0x20242e, 0x2e2118];
const WINDOW_COLORS = [
  0xffd9a0, 0xffd9a0, 0xffc98a, 0xbfe0ff, 0xbfe0ff, 0xff9fd0,
  0x9ff2ff, 0x39415a, 0x39415a, 0x2a3049, 0xffe9b0, 0x141824,
];

export function buildWorld(scene) {
  const rng = mulberry32(20261122);
  const colliders = [];
  const animated = { beacons: [], flicker: [] };
  const addCollider = (cx, cz, w, d) => {
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  };
  const basic = (color, opts = {}) => new THREE.MeshBasicMaterial({ color, ...opts });
  const box = (w, h, d, color, x, y, z, opts) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic(color, opts));
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };

  // -------------------------------------------------------------------------
  // Sky, haze, stars, moon.
  // -------------------------------------------------------------------------

  scene.background = new THREE.Color(0x070a18);
  scene.fog = new THREE.Fog(0x0a0e20, 170, 640);
  {
    const starGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(700 * 3);
    for (let i = 0; i < 700; i++) {
      const a = rng() * Math.PI * 2;
      const el = 0.12 + rng() * 1.3;
      const r = 880;
      pos[i * 3] = Math.cos(a) * Math.cos(el) * r;
      pos[i * 3 + 1] = Math.sin(el) * r * 0.55 + 30;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(el) * r;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xcfe0ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.85, fog: false,
    }));
    scene.add(stars);
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(30, 24),
      new THREE.MeshBasicMaterial({ color: 0xe9edff, fog: false }),
    );
    moon.position.set(-420, 330, -760);
    moon.lookAt(0, 0, 0);
    scene.add(moon);
  }

  // -------------------------------------------------------------------------
  // Ground and the street plan: dark earth, lighter tarmac, dashed paint,
  // and a raised slab for every block the grid cuts out.
  // -------------------------------------------------------------------------

  {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(820, 620), basic(0x0b0e14));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    scene.add(ground);
  }
  const roadMat = basic(0x161a24);
  const slabMat = basic(0x202635);
  const roadsX = [...AVENUES_X, OCEAN_DRIVE_X];
  for (const ax of roadsX) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 348), roadMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(ax, 0, 0);
    scene.add(strip);
  }
  for (const sz of STREETS_Z) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(398, ROAD_HALF * 2), roadMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(-52, 0.005, sz);
    scene.add(strip);
  }
  { // dashed centre lines, one instanced mesh for the whole grid
    const spots = [];
    for (const ax of roadsX) for (let z = -166; z <= 166; z += 9) spots.push([ax, z, 0]);
    for (const sz of STREETS_Z) for (let x = -244; x <= 138; x += 9) spots.push([x, sz, Math.PI / 2]);
    const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.28, 3.1), basic(0x59637c), spots.length);
    spots.forEach(([x, z, yaw], i) => {
      _e.set(-Math.PI / 2, 0, yaw);
      _q.setFromEuler(_e);
      _p.set(x, 0.02, z);
      _s.set(1, 1, 1);
      _m.compose(_p, _q, _s);
      dashes.setMatrixAt(i, _m);
    });
    dashes.instanceMatrix.needsUpdate = true;
    scene.add(dashes);
  }
  // Neon kerbs down Ocean Drive: pink on the city side, cyan on the sea side.
  box(0.35, 0.1, 336, 0xff2e88, OCEAN_DRIVE_X - ROAD_HALF - 0.5, 0.05, 0);
  box(0.35, 0.1, 336, 0x22d3ee, OCEAN_DRIVE_X + ROAD_HALF + 0.5, 0.05, 0);

  const blocks = blockCenters();
  for (const b of blocks) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(30, 0.22, 27), slabMat);
    slab.position.set(b.x, 0.11, b.z);
    scene.add(slab);
  }

  // -------------------------------------------------------------------------
  // Buildings: a packed sub-grid on every block, lit windows instanced by
  // the thousand, neon on the street faces, furniture on the roofs.
  // -------------------------------------------------------------------------

  const windowXforms = [];
  const facadeMats = FACADE_COLORS.map((c) => basic(c));
  const roofMat = basic(0x11141c);
  const propMat = basic(0x0f1219);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xff3548, transparent: true, opacity: 0.9,
  });
  animated.beacons.push(beaconMat);
  const beaconGeo = new THREE.SphereGeometry(0.22, 6, 6);

  function windowsFor(cx, cz, w, d, h) {
    const faces = [
      { yaw: Math.PI / 2, fixed: cx + w / 2 + 0.07, along: cz, span: d, axis: "z" },
      { yaw: -Math.PI / 2, fixed: cx - w / 2 - 0.07, along: cz, span: d, axis: "z" },
      { yaw: 0, fixed: cz + d / 2 + 0.07, along: cx, span: w, axis: "x" },
      { yaw: Math.PI, fixed: cz - d / 2 - 0.07, along: cx, span: w, axis: "x" },
    ];
    for (const f of faces) {
      for (let y = 2.6; y < h - 1.4; y += 3.1) {
        for (let off = -f.span / 2 + 1.7; off < f.span / 2 - 1.2; off += 2.4) {
          const col = WINDOW_COLORS[Math.floor(rng() * WINDOW_COLORS.length)];
          if (f.axis === "z") windowXforms.push([f.fixed, y, f.along + off, f.yaw, col]);
          else windowXforms.push([f.along + off, y, f.fixed, f.yaw, col]);
        }
      }
    }
  }

  function tower(cx, cz, w, d, h, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(cx, 0.22 + h / 2, cz);
    scene.add(mesh);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.5, d * 0.92), roofMat);
    roof.position.set(cx, 0.22 + h + 0.25, cz);
    scene.add(roof);
    windowsFor(cx, cz, w, d, h);
    addCollider(cx, cz, w, d);
    if (rng() < 0.5) { // rooftop clutter: a tank or an AC block
      const pw = 2 + rng() * 2;
      const prop = new THREE.Mesh(new THREE.BoxGeometry(pw, 1.1 + rng(), pw), propMat);
      prop.position.set(cx + (rng() - 0.5) * (w - 4), 0.22 + h + 1, cz + (rng() - 0.5) * (d - 4));
      scene.add(prop);
    }
    if (h > 33) {
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(cx, 0.22 + h + 0.9, cz);
      scene.add(beacon);
    }
    return mesh;
  }

  const landmarkBlocks = new Set(["110,-50", "110,30", "-22,30"]);
  let signCount = 0;
  for (const b of blocks) {
    if (landmarkBlocks.has(`${b.x},${b.z}`)) continue;
    const east = b.x > 60; // the Ocean Drive blocks grow taller
    for (let i = 0; i < 4; i++) {
      if (rng() < 0.14) continue; // the odd courtyard keeps the grid honest
      const ox = (i % 2 === 0 ? -1 : 1) * (5.4 + rng() * 1.2);
      const oz = (i < 2 ? -1 : 1) * (5.2 + rng() * 1.2);
      const w = 8 + rng() * 3.5;
      const d = 8.5 + rng() * 3;
      const h = 9 + Math.pow(rng(), 1.6) * 30 + (east ? 9 : 0) + (Math.abs(b.x) < 30 ? 5 : 0);
      const mat = facadeMats[Math.floor(rng() * facadeMats.length)];
      tower(b.x + ox, b.z + oz, w, d, h, mat);
      // Neon on the avenue face of the corner-most building per block.
      if (i === 0 && signCount < NEON_WORDS.length * 2) {
        const [word, color] = NEON_WORDS[signCount % NEON_WORDS.length];
        signCount++;
        const sign = signMesh(word, color, 7.5 + rng() * 3);
        const faceEast = b.x + ox < 100 && rng() < 0.6;
        if (faceEast) {
          sign.position.set(b.x + ox + w / 2 + 0.35, 3.6 + rng() * 3, b.z + oz);
          sign.rotation.y = Math.PI / 2;
        } else {
          sign.position.set(b.x + ox, 3.6 + rng() * 3, b.z + oz + d / 2 + 0.35);
        }
        scene.add(sign);
        if (signCount % 5 === 0) animated.flicker.push(sign.material);
      }
    }
  }
  { // one instanced mesh carries every lit window in the city
    const geo = new THREE.PlaneGeometry(1.15, 1.55);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), windowXforms.length);
    windowXforms.forEach(([x, y, z, yaw, col], i) => {
      instance(mesh, i, x, y, z, yaw);
      mesh.setColorAt(i, _c.setHex(col));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
  }

  // -------------------------------------------------------------------------
  // The landmarks: Palms Royale, Casino Cielo, Venn Loans.
  // -------------------------------------------------------------------------

  { // Palms Royale — the pink tower on Ocean Drive.
    const { x, z } = LANDMARKS.hotel;
    tower(x, z, 16, 15, 54, basic(0x3a2438));
    box(16.6, 1.1, 15.6, 0x22d3ee, x, 55.4, z); // the cyan crown
    box(10, 1.6, 6, 0x14161d, x + 4, 0.8, z);   // entrance canopy
    const sign = signMesh("PALMS ROYALE", "#ff5da2", 15);
    sign.position.set(x + 8.6, 34, z);
    sign.rotation.y = Math.PI / 2;
    scene.add(sign);
    const sign2 = signMesh("HOTEL · POOL · ROOF BAR", "#7fe7ff", 11);
    sign2.position.set(x + 8.6, 12, z);
    sign2.rotation.y = Math.PI / 2;
    scene.add(sign2);
  }
  { // Casino Cielo — wide, gold, and awake all night.
    const { x, z } = LANDMARKS.casino;
    tower(x, z, 20, 17, 21, basic(0x2e2416));
    box(20.8, 0.8, 17.8, 0xd8a928, x, 21.6, z); // gold cornice
    box(20.8, 0.5, 17.8, 0xd8a928, x, 6.2, z);  // gold belt line
    const sign = signMesh("CASINO CIELO", "#ffd76a", 17);
    sign.position.set(x + 10.6, 10.8, z);
    sign.rotation.y = Math.PI / 2;
    scene.add(sign);
    animated.flicker.push(sign.material);
    // The marquee: a chase of warm bulbs over the door.
    const bulbs = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.17, 6, 6), basic(0xffc93c), 26,
    );
    for (let i = 0; i < 26; i++) {
      instance(bulbs, i, x + 10.9, 4.6, z - 8 + i * 0.64);
    }
    bulbs.instanceMatrix.needsUpdate = true;
    scene.add(bulbs);
  }
  { // Venn Loans — small, green, patient.
    const { x, z } = LANDMARKS.loans;
    tower(x, z, 11, 10, 11, basic(0x1e2b22));
    const sign = signMesh("VENN LOANS", "#51ff7a", 9.5, "CASH · TERMS · NO QUESTIONS");
    sign.position.set(x + 5.6, 7.6, z);
    sign.rotation.y = Math.PI / 2;
    scene.add(sign);
  }

  // -------------------------------------------------------------------------
  // Palms and lampposts: the green and the sodium of the night streets.
  // -------------------------------------------------------------------------

  const palmSpots = [];
  for (let z = -148; z <= 148; z += 8.6) {
    palmSpots.push([OCEAN_DRIVE_X - ROAD_HALF - 2.4, z + (rng() - 0.5) * 2]);
    if (rng() < 0.8) palmSpots.push([OCEAN_DRIVE_X + ROAD_HALF + 2.6, z + 4]);
  }
  for (const ax of [-44, 0, 44]) {
    for (let z = -140; z <= 140; z += 17) {
      if (rng() < 0.75) palmSpots.push([ax + ROAD_HALF + 2.2, z + (rng() - 0.5) * 3]);
      if (rng() < 0.5) palmSpots.push([ax - ROAD_HALF - 2.2, z + 8]);
    }
  }
  for (let i = 0; i < blocks.length; i += 2) {
    const b = blocks[i];
    palmSpots.push([b.x - 13.5, b.z - 12]);
    if (rng() < 0.6) palmSpots.push([b.x + 13.5, b.z + 12]);
  }
  for (let x = 150; x <= 240; x += 12) palmSpots.push([x, PIER_Z - 5.6], [x, PIER_Z + 5.6]);
  {
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.13, 0.21, 5.8, 5), basic(0x4a3826), palmSpots.length,
    );
    const fronds = new THREE.InstancedMesh(
      new THREE.ConeGeometry(2.5, 1.7, 6), basic(0x1e6b3c), palmSpots.length,
    );
    palmSpots.forEach(([x, z], i) => {
      const tilt = 0.05 + rng() * 0.07;
      const dir = rng() * Math.PI * 2;
      instance(trunks, i, x, 2.9, z, 0, Math.sin(dir) * tilt, Math.cos(dir) * tilt);
      instance(fronds, i, x + Math.sin(dir) * 0.35, 6.1, z + Math.cos(dir) * 0.35, rng() * Math.PI, Math.PI);
      if (!isWater(x, z)) addCollider(x, z, 0.55, 0.55);
    });
    trunks.instanceMatrix.needsUpdate = true;
    fronds.instanceMatrix.needsUpdate = true;
    scene.add(trunks, fronds);
  }
  {
    const spots = [];
    for (const ax of roadsX) for (let z = -156; z <= 156; z += 26) spots.push([ax + ROAD_HALF + 0.9, z], [ax - ROAD_HALF - 0.9, z + 13]);
    for (const sz of STREETS_Z) for (let x = -200; x <= 120; x += 26) spots.push([x, sz + ROAD_HALF + 0.9]);
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.1, 5.4, 5), basic(0x14161d), spots.length);
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 6, 6), basic(0xffd9a0), spots.length);
    spots.forEach(([x, z], i) => {
      instance(poles, i, x, 2.7, z);
      instance(heads, i, x, 5.5, z);
    });
    poles.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    scene.add(poles, heads);
  }

  // Billboards over the Drive.
  const ADS = [
    ["VISIT LEONIDA", "#7fe7ff"], ["CIELO — PLAY TONIGHT", "#ffd76a"],
    ["VENN LOANS", "#51ff7a"], ["PALMS ROYALE", "#ff5da2"], ["DRIVE SAFE-ISH", "#ffb84d"],
  ];
  [[141, -118], [141, -58], [141, 22], [141, 96], [-52, -104]].forEach(([x, z], i) => {
    const [text, color] = ADS[i % ADS.length];
    box(0.3, 8.4, 0.3, 0x14161d, x - 3.4, 4.2, z - 3.4);
    box(0.3, 8.4, 0.3, 0x14161d, x - 3.4, 4.2, z + 3.4);
    const panel = signMesh(text, color, 12.5);
    panel.position.set(x, 9.6, z);
    panel.rotation.y = x > 100 ? -Math.PI / 2 : Math.PI / 2;
    panel.scale.y = 2.1;
    scene.add(panel);
    box(12.8, 5.2, 0.25, 0x10131c, x + (x > 100 ? 0.25 : -0.25), 9.6, z).rotation.y = Math.PI / 2;
    addCollider(x, z, 1, 8);
  });

  // -------------------------------------------------------------------------
  // Beach, sea and pier. The sand is a held breath between the Drive and
  // the water; the pier walks out over both to the lighthouse.
  // -------------------------------------------------------------------------

  {
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(WATER_X - BEACH_X, 360), basic(0x3d3423));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set((BEACH_X + WATER_X) / 2, 0.01, 0);
    scene.add(sand);
  }
  const waterMat = basic(0x0b2d47);
  const waterMat2 = new THREE.MeshBasicMaterial({
    color: 0x14608c, transparent: true, opacity: 0.32,
  });
  let water2;
  let foam;
  {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(420, 560), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(WATER_X + 210, -0.18, 0);
    scene.add(water);
    water2 = new THREE.Mesh(new THREE.PlaneGeometry(420, 560), waterMat2);
    water2.rotation.x = -Math.PI / 2;
    water2.position.set(WATER_X + 210, -0.1, 0);
    scene.add(water2);
    foam = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 360),
      new THREE.MeshBasicMaterial({ color: 0x9fd8e8, transparent: true, opacity: 0.45 }),
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(WATER_X + 0.6, -0.04, 0);
    scene.add(foam);
  }
  // Sea walls: the water is for looking at. The pier band stays open.
  colliders.push(
    { minX: WATER_X - 2, maxX: WORLD.maxX, minZ: WORLD.minZ, maxZ: PIER_Z - 8 },
    { minX: WATER_X - 2, maxX: WORLD.maxX, minZ: PIER_Z + 8, maxZ: WORLD.maxZ },
  );
  let beam;
  {
    const deckMat = basic(0x3d2f22);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(110, 0.5, 13), deckMat);
    deck.position.set(193, 0.25, PIER_Z);
    scene.add(deck);
    box(110, 0.18, 0.3, 0x22262f, 193, 1.15, PIER_Z - 6.4);
    box(110, 0.18, 0.3, 0x22262f, 193, 1.15, PIER_Z + 6.4);
    const postGeo = new THREE.CylinderGeometry(0.22, 0.22, 2.2, 6);
    const posts = new THREE.InstancedMesh(postGeo, basic(0x2a2119), 20);
    for (let i = 0; i < 20; i++) {
      instance(posts, i, 144 + i * 5.4, -0.6, PIER_Z + (i % 2 === 0 ? -5.8 : 5.8));
    }
    posts.instanceMatrix.needsUpdate = true;
    scene.add(posts);
    // String lights down both rails: pink, cyan, gold, repeat.
    const bulbColors = [0xff5da2, 0x7fe7ff, 0xffd76a];
    const bulbs = [];
    for (let x = 146; x <= 244; x += 6) {
      bulbs.push([x, 2.5 - Math.abs(((x - 146) % 12) - 6) * 0.09, PIER_Z - 6.2]);
      bulbs.push([x, 2.5 - Math.abs(((x - 146) % 12) - 6) * 0.09, PIER_Z + 6.2]);
    }
    const stringMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), bulbs.length);
    bulbs.forEach(([x, y, z], i) => {
      instance(stringMesh, i, x, y, z);
      stringMesh.setColorAt(i, _c.setHex(bulbColors[i % 3]));
    });
    stringMesh.instanceMatrix.needsUpdate = true;
    if (stringMesh.instanceColor) stringMesh.instanceColor.needsUpdate = true;
    scene.add(stringMesh);
    box(7, 3.4, 6, 0x27324a, 231, 1.95, PIER_Z); // the bait hut
    addCollider(231, PIER_Z, 7, 6);
    // The lighthouse: white tower, red band, and a beam that never sleeps.
    const lh = LANDMARKS.lighthouse;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.5, 2, 10), basic(0x22262f));
    base.position.set(lh.x, 1, lh.z);
    scene.add(base);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.3, 12.5, 10), basic(0xd8dce8));
    shaft.position.set(lh.x, 8.2, lh.z);
    scene.add(shaft);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 2.1, 2.6, 10), basic(0xc22e3e));
    band.position.set(lh.x, 8.6, lh.z);
    scene.add(band);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 10), basic(0xfff2b0));
    lamp.position.set(lh.x, 15.6, lh.z);
    scene.add(lamp);
    beam = new THREE.Group();
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(3.4, 30, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffe9a8, transparent: true, opacity: 0.13,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    cone.rotation.z = Math.PI / 2;
    cone.position.x = 15;
    beam.add(cone);
    beam.position.set(lh.x, 15.6, lh.z);
    scene.add(beam);
    addCollider(lh.x, lh.z, 6.4, 6.4);
  }

  // -------------------------------------------------------------------------
  // The dockyard: container rows, gantry cranes, floodlights.
  // -------------------------------------------------------------------------

  {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(DOCKYARD.maxX - DOCKYARD.minX, 0.14, DOCKYARD.maxZ - DOCKYARD.minZ),
      basic(0x191d24),
    );
    slab.position.set((DOCKYARD.minX + DOCKYARD.maxX) / 2, 0.07, (DOCKYARD.minZ + DOCKYARD.maxZ) / 2);
    scene.add(slab);
    const contColors = [0x7a3b2e, 0x2e5a7a, 0x6b6f3a, 0x74552a, 0x4a4f57, 0x83324a];
    const stacks = [];
    for (let row = 0; row < 6; row++) {
      const z = 68 + row * 14;
      for (let x = -240; x <= -152; x += 13) {
        if (rng() < 0.22) continue; // a lane through the stacks
        const high = 1 + Math.floor(rng() * 3);
        stacks.push({ x: x + (rng() - 0.5) * 2, z, high, col: contColors[Math.floor(rng() * contColors.length)] });
      }
    }
    const total = stacks.reduce((s, c) => s + c.high, 0);
    const conts = new THREE.InstancedMesh(new THREE.BoxGeometry(6.2, 2.6, 2.5), new THREE.MeshBasicMaterial({ color: 0xffffff }), total);
    let ci = 0;
    for (const s of stacks) {
      for (let lvl = 0; lvl < s.high; lvl++) {
        instance(conts, ci, s.x, 1.44 + lvl * 2.62, s.z);
        conts.setColorAt(ci, _c.setHex(s.col));
        ci++;
      }
      addCollider(s.x, s.z, 6.2, 2.5);
    }
    conts.instanceMatrix.needsUpdate = true;
    if (conts.instanceColor) conts.instanceColor.needsUpdate = true;
    scene.add(conts);
    // Cranes along the back fence, jibs reaching over the yard.
    for (const cx of [-232, -196, -160]) {
      const frame = basic(0x27313f);
      for (const [lx, lz] of [[-4, -2], [4, -2], [-4, 2], [4, 2]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 17, 0.7), frame);
        leg.position.set(cx + lx, 8.5, 140 + lz);
        scene.add(leg);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(10, 1.1, 5.4), frame);
      top.position.set(cx, 17.2, 140);
      scene.add(top);
      const jib = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 24), frame);
      jib.position.set(cx, 16.6, 128);
      jib.rotation.x = 0.06;
      scene.add(jib);
      const cable = new THREE.Mesh(new THREE.BoxGeometry(0.08, 8, 0.08), frame);
      cable.position.set(cx + 1.5, 12.4, 121);
      scene.add(cable);
      box(1.6, 1, 1.6, 0x22262f, cx + 1.5, 8.2, 121);
      box(3.2, 1.4, 0.3, 0xffc93c, cx, 17.1, 137.2); // the cab window, lit
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(cx, 18.2, 140);
      scene.add(beacon);
      addCollider(cx, 140, 10, 5.4);
    }
    // Floodlight poles in the corners.
    for (const [fx, fz] of [[-244, 62], [-134, 62], [-244, 148], [-134, 148]]) {
      box(0.25, 9.5, 0.25, 0x14161d, fx, 4.75, fz);
      box(1.8, 0.5, 0.4, 0xffeebb, fx, 9.6, fz);
    }
  }

  // -------------------------------------------------------------------------
  // The impound: slab, fence, a gate gap on the east side, a shed.
  // -------------------------------------------------------------------------

  {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(IMPOUND.maxX - IMPOUND.minX, 0.14, IMPOUND.maxZ - IMPOUND.minZ),
      basic(0x1a1e26),
    );
    slab.position.set((IMPOUND.minX + IMPOUND.maxX) / 2, 0.07, (IMPOUND.minZ + IMPOUND.maxZ) / 2);
    scene.add(slab);
    const wallMat = basic(0x39415a);
    const wall = (cx, cz, w, d) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 1.35, d), wallMat);
      mesh.position.set(cx, 0.68, cz);
      scene.add(mesh);
      addCollider(cx, cz, w, d);
    };
    wall((IMPOUND.minX + IMPOUND.maxX) / 2, IMPOUND.minZ + 0.2, IMPOUND.maxX - IMPOUND.minX, 0.4);
    wall((IMPOUND.minX + IMPOUND.maxX) / 2, IMPOUND.maxZ - 0.2, IMPOUND.maxX - IMPOUND.minX, 0.4);
    wall(IMPOUND.minX + 0.2, (IMPOUND.minZ + IMPOUND.maxZ) / 2, 0.4, IMPOUND.maxZ - IMPOUND.minZ);
    // East fence in two runs, with the gate gap between them.
    wall(IMPOUND.maxX - 0.2, IMPOUND.minZ + 9, 0.4, 18);
    wall(IMPOUND.maxX - 0.2, IMPOUND.maxZ - 9, 0.4, 18);
    const sign = signMesh("MUNICIPAL IMPOUND", "#ffd76a", 13);
    sign.position.set(IMPOUND.maxX + 0.4, 3.4, (IMPOUND.minZ + IMPOUND.maxZ) / 2);
    sign.rotation.y = Math.PI / 2;
    scene.add(sign);
    box(8, 3, 4.5, 0x232838, -186, 1.6, -144); // the clerk's shed
    addCollider(-186, -144, 8, 4.5);
  }

  // -------------------------------------------------------------------------
  // Beach furniture: umbrellas asleep in the sand, two lifeguard stands,
  // a volleyball net nobody is using until sunrise.
  // -------------------------------------------------------------------------

  {
    const umbrellaCols = [0xff5da2, 0x22d3ee, 0xffd76a, 0xff5252, 0x8aff5a];
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.3, 5);
    const poles = new THREE.InstancedMesh(poleGeo, basic(0xd8dce8), 14);
    const canopies = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1.7, 0.55, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), 14,
    );
    let ui = 0;
    for (let i = 0; i < 26 && ui < 14; i++) {
      const ux = BEACH_X + 6 + rng() * (WATER_X - BEACH_X - 10);
      const uz = -150 + rng() * 300;
      if (isWater(ux, uz) || Math.abs(uz - PIER_Z) < 10) continue;
      instance(poles, ui, ux, 1.15, uz);
      instance(canopies, ui, ux, 2.35, uz);
      canopies.setColorAt(ui, _c.setHex(umbrellaCols[ui % umbrellaCols.length]));
      ui++;
    }
    poles.count = ui;
    canopies.count = ui;
    poles.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    scene.add(poles, canopies);
    for (const lz of [-64, 98]) { // lifeguard stands, white over red
      box(0.18, 2.6, 0.18, 0xd8dce8, 150, 1.3, lz - 1);
      box(0.18, 2.6, 0.18, 0xd8dce8, 150, 1.3, lz + 1);
      box(2.6, 1.5, 2.6, 0xc22e3e, 150, 3.3, lz);
      box(3, 0.25, 3, 0xd8dce8, 150, 4.2, lz);
      addCollider(150, lz, 2.6, 2.6);
    }
    box(0.09, 2.4, 0.09, 0xd8dce8, 156, 1.2, 4);
    box(0.09, 2.4, 0.09, 0xd8dce8, 156, 1.2, 16);
    const net = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 1),
      new THREE.MeshBasicMaterial({ color: 0xe8ecff, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    net.position.set(156, 1.7, 10);
    net.rotation.y = Math.PI / 2;
    scene.add(net);
  }

  // -------------------------------------------------------------------------
  // The world beyond: skyline silhouettes in the haze, and the causeway
  // lights crawling away over the water.
  // -------------------------------------------------------------------------

  {
    const mat = basic(0x0a0e1a);
    for (let i = 0; i < 38; i++) {
      const a = (i / 38) * Math.PI * 2 + rng() * 0.1;
      const r = 330 + rng() * 110;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r * 0.8;
      const h = 42 + rng() * 85;
      const m = new THREE.Mesh(new THREE.BoxGeometry(26 + rng() * 30, h, 26 + rng() * 30), mat);
      m.position.set(x, h / 2 - 2, z);
      scene.add(m);
    }
    const deckLights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 6, 6), basic(0xffd9a0), 26);
    for (let i = 0; i < 26; i++) {
      instance(deckLights, i, 292 + i * 13, 7 - i * 0.06, -84 - i * 2.6);
    }
    deckLights.instanceMatrix.needsUpdate = true;
    scene.add(deckLights);
    // Buoys blinking out in the bay.
    const buoyMat = new THREE.MeshBasicMaterial({ color: 0xff3548, transparent: true, opacity: 0.8 });
    animated.beacons.push(buoyMat);
    for (let i = 0; i < 9; i++) {
      const bx = 210 + rng() * 190;
      const bz = -140 + rng() * 300;
      if (!isWater(bx, bz)) continue;
      const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.55, 7, 7), buoyMat);
      buoy.position.set(bx, 0.1, bz);
      scene.add(buoy);
    }
  }

  // -------------------------------------------------------------------------

  let flickerClock = 0;
  function update(dt, t) {
    if (beam) beam.rotation.y = t * 0.65;
    water2.position.x = WATER_X + 210 + Math.sin(t * 0.35) * 2.2;
    foam.position.x = WATER_X + 0.6 + Math.sin(t * 0.8) * 0.8;
    const blink = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.6));
    for (const m of animated.beacons) m.opacity = blink;
    flickerClock += dt;
    if (flickerClock > 0.12) {
      flickerClock = 0;
      for (const m of animated.flicker) {
        m.opacity = Math.random() > 0.06 ? 1 : 0.45;
      }
    }
  }

  return { colliders, update };
}
