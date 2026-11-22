// world.js — builds Port Meridian, the neon coastal city of LEONIDA AFTER
// DARK, into a three.js scene.
//
// Visual density is the brief: every block is built out — towers with lit
// windows, neon signs, palms, lampposts with pools of light, benches,
// hydrants, dumpsters, billboards, rooftop clutter, string lights over
// Ocean Drive, container stacks and cranes at the dockyard, a skyline of
// silhouettes behind it all and haze in the air. Everything repeats through
// InstancedMesh and shared canvas textures so the city stays cheap to draw.

import * as THREE from "three";
import {
  AVENUES_X, OCEAN_DRIVE_X, STREETS_Z, ROAD_HALF, BEACH_X, WATER_X,
  PIER_Z, PIER_END_X, DOCKYARD, IMPOUND, LANDMARKS, blockCenters,
} from "./logic.js";

/** Deterministic RNG so the city is the same city on every visit. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20261122);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];

// ---------------------------------------------------------------------------
// Canvas textures. All art is drawn here — the game ships no image files.
// ---------------------------------------------------------------------------

function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A tower facade: floors of windows, most of them lit, warm or cool. */
function facadeTexture(seed, base) {
  const r = mulberry32(seed);
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(255,255,255,0.10)");
    grad.addColorStop(1, "rgba(0,0,0,0.35)");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const cols = 10, rows = 22;
    const cw = w / cols, ch = h / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const lit = r();
        if (lit < 0.46) g.fillStyle = r() < 0.62 ? "#f5cf96" : "#a8cdea";
        else if (lit < 0.52) g.fillStyle = "#e88bb0";
        else g.fillStyle = "#191d26";
        g.fillRect(x * cw + 2.5, y * ch + 2.5, cw - 5, ch - 5);
      }
    }
  });
}

/** A neon sign: glowing tube lettering on a dark panel. */
function neonTexture(text, color, sub) {
  return canvasTexture(512, 160, (g, w, h) => {
    g.fillStyle = "rgba(8,8,16,0.92)";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.textAlign = "center";
    g.shadowColor = color;
    g.shadowBlur = 26;
    g.fillStyle = "#ffffff";
    g.font = "bold 64px Arial, sans-serif";
    g.fillText(text, w / 2, sub ? 78 : 102);
    if (sub) {
      g.font = "bold 30px Arial, sans-serif";
      g.shadowBlur = 16;
      g.fillText(sub, w / 2, 128);
    }
  });
}

/** A billboard advert, bright and a little brash. */
function billboardTexture(headline, line, bg, fg) {
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.textAlign = "center";
    g.font = "bold 74px Arial, sans-serif";
    g.fillText(headline, w / 2, 118);
    g.font = "bold 40px Arial, sans-serif";
    g.fillText(line, w / 2, 190);
    g.strokeStyle = fg;
    g.lineWidth = 6;
    g.strokeRect(10, 10, w - 20, h - 20);
  });
}

/** A palm frond: a rib with two combs of leaflets, drawn once, instanced everywhere. */
const frondTexture = canvasTexture(128, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const rib = (x0, y0, x1, y1, color, width) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  };
  // Leaflets first (under the rib), angled down off the spine — many, thin
  // and jittered, so the frond reads as foliage and not as a comb.
  let seed = 7;
  const jitter = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const x = 8 + t * 108, y = 116 - t * 84;
    const len = (30 - t * 12) * (1 + jitter() * 0.35);
    rib(x, y, x + len * 0.45, y + len * 0.8, "#1f6a3e", 1.8);
    rib(x, y, x - len * 0.3, y + len * 0.85, "#185430", 1.6);
  }
  rib(4, 122, 122, 26, "#2f9e5f", 3.5);
});
frondTexture.colorSpace = THREE.SRGBColorSpace;

/** Asphalt with a worn dashed centre line, repeated along the roads. */
const roadTexture = canvasTexture(128, 128, (g, w, h) => {
  g.fillStyle = "#171a21";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < 260; i++) g.fillRect(rng() * w, rng() * h, 2, 2);
  g.fillStyle = "#c8a83c";
  g.fillRect(w / 2 - 2, 8, 4, 44);
  g.fillRect(w / 2 - 2, 76, 4, 44);
});
roadTexture.wrapS = roadTexture.wrapT = THREE.RepeatWrapping;

/** Sea water: deep blue with a scatter of moonlit sparkle. */
const waterTexture = canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = "#0a2438";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "rgba(160,210,255,0.25)";
  const r = mulberry32(77);
  for (let i = 0; i < 420; i++) g.fillRect(r() * w, r() * h, 2.4, 1.2);
});
waterTexture.wrapS = waterTexture.wrapT = THREE.RepeatWrapping;
waterTexture.repeat.set(30, 30);

// ---------------------------------------------------------------------------
// Small builders shared by the districts.
// ---------------------------------------------------------------------------

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);

function basicMat(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, ...opts });
}

/** An instanced scatter of boxes: transforms in, one draw call out. */
function instancedBoxes(list, material, geo = boxGeo) {
  const mesh = new THREE.InstancedMesh(geo, material, list.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  list.forEach((t, i) => {
    e.set(0, t.rotY ?? 0, 0);
    q.setFromEuler(e);
    p.set(t.x, t.y, t.z);
    s.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    if (t.color !== undefined) mesh.setColorAt(i, new THREE.Color(t.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------------------
// The world itself.
// ---------------------------------------------------------------------------

export function buildWorld(scene) {
  const colliders = []; // {minX, maxX, minZ, maxZ} for solid buildings & stacks
  const dynamics = []; // update callbacks (dt, elapsed)
  const collide = (x, z, hw, hd) =>
    colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd });

  scene.fog = new THREE.FogExp2(0x0b1026, 0.0026);
  scene.background = new THREE.Color(0x070a1c);

  // Ambient light so emissive-style basic materials sit in a lit world:
  // a moon-glow hemisphere and one low directional for the standard mats.
  scene.add(new THREE.HemisphereLight(0x8fa3cc, 0x1a1426, 0.85));
  const moon = new THREE.DirectionalLight(0xaac4ff, 0.55);
  moon.position.set(-120, 200, -80);
  scene.add(moon);

  // -- Ground, roads, beach, water -------------------------------------------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(760, 560), basicMat(0x11131c));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  scene.add(ground);

  const roadPlane = (x, z, w, d, repX, repY) => {
    const t = roadTexture.clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repX, repY);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: t }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.0, z);
    scene.add(mesh);
  };
  for (const ax of [...AVENUES_X, OCEAN_DRIVE_X]) roadPlane(ax, 0, ROAD_HALF * 2, 330, 1, 40);
  for (const sz of STREETS_Z) roadPlane(-20, sz, 380, ROAD_HALF * 2, 46, 1);

  // Sidewalk slabs under every block: the city's bones.
  const slabs = [];
  for (const b of blockCenters()) slabs.push({ x: b.x, y: 0.06, z: b.z, sx: 34, sy: 0.12, sz: 34, color: 0x2b2f3a });
  slabs.push({ x: -210, y: 0.06, z: 105, sx: 46, sy: 0.12, sz: 96, color: 0x272b33 }); // dockyard apron
  slabs.push({ x: -139, y: 0.06, z: -132, sx: 90, sy: 0.12, sz: 30, color: 0x272b33 }); // impound apron
  scene.add(instancedBoxes(slabs, basicMat(0xffffff)));

  // Beach, boardwalk and sea.
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(WATER_X - BEACH_X + 26, 340), basicMat(0x8a7a52));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set((BEACH_X + WATER_X) / 2 + 4, 0.01, 0);
  scene.add(sand);
  const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(7, 0.18, 330), basicMat(0x6e4f30));
  boardwalk.position.set(146.5, 0.09, 0);
  scene.add(boardwalk);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(560, 700), new THREE.MeshBasicMaterial({ map: waterTexture }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(WATER_X + 270, -0.12, 0);
  scene.add(sea);
  dynamics.push(() => { waterTexture.offset.x += 0.00035; waterTexture.offset.y += 0.00012; });

  // The pier and the lighthouse at its end.
  const pier = new THREE.Mesh(new THREE.BoxGeometry(PIER_END_X - WATER_X + 16, 0.5, 10), basicMat(0x5d4630));
  pier.position.set((WATER_X + PIER_END_X) / 2 + 2, 0.25, PIER_Z);
  scene.add(pier);
  const railMat = basicMat(0x39404f);
  for (const dz of [-4.8, 4.8]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(PIER_END_X - WATER_X + 14, 0.9, 0.18), railMat);
    rail.position.set((WATER_X + PIER_END_X) / 2 + 2, 0.9, PIER_Z + dz);
    scene.add(rail);
  }
  const lighthouse = new THREE.Group();
  const towerMat = basicMat(0xd8d3c8);
  const towerRed = basicMat(0xb8352f);
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(2.6 - i * 0.3, 2.9 - i * 0.3, 4.4, 12), i % 2 ? towerRed : towerMat);
    seg.position.y = 2.2 + i * 4.4;
    lighthouse.add(seg);
  }
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 2.6, 10), basicMat(0xffe9a8));
  lampRoom.position.y = 19.4;
  lighthouse.add(lampRoom);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.8, 10), basicMat(0x22242e));
  cap.position.y = 21.6;
  lighthouse.add(cap);
  const beamPivot = new THREE.Group();
  beamPivot.position.y = 19.4;
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(3.4, 42, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.rotation.z = Math.PI / 2; // apex at the lamp, widening as it reaches out
  beam.position.set(21, 0, 0);
  beamPivot.add(beam);
  lighthouse.add(beamPivot);
  const lampLight = new THREE.PointLight(0xffe9a8, 900, 90, 1.8);
  lampLight.position.y = 19.4;
  lighthouse.add(lampLight);
  lighthouse.position.set(PIER_END_X, 0.4, PIER_Z);
  scene.add(lighthouse);
  collide(PIER_END_X, PIER_Z, 3.4, 3.4);
  dynamics.push((dt, t) => { beamPivot.rotation.y = t * 0.45; });

  // -- Buildings ---------------------------------------------------------------
  const facades = [
    new THREE.MeshBasicMaterial({ map: facadeTexture(11, "#939cb4") }),
    new THREE.MeshBasicMaterial({ map: facadeTexture(23, "#a89a90") }),
    new THREE.MeshBasicMaterial({ map: facadeTexture(37, "#8b96ad") }),
  ];
  const buildingLists = [[], [], []];
  const roofProps = [];
  const neonStrips = [];
  const signPlanes = [];
  const downtown = (x, z) => Math.hypot(x, z) < 120;

  function addBuilding(x, z, w, h, d, tint) {
    const list = buildingLists[Math.floor(rng() * 3)];
    list.push({ x, y: h / 2, z, sx: w, sy: h, sz: d, color: tint });
    collide(x, z, w / 2, d / 2);
    // Rooftop clutter: AC boxes on most roofs, a water tower on some.
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      roofProps.push({
        x: x + (rng() - 0.5) * (w - 5), y: h + 0.7, z: z + (rng() - 0.5) * (d - 5),
        sx: 2 + rng() * 2.4, sy: 1.4, sz: 2 + rng() * 2, color: 0x3a3f4c,
      });
    }
    if (rng() < 0.22) {
      roofProps.push({ x: x + w / 4, y: h + 2.6, z, sx: 2.6, sy: 5.2, sz: 2.6, color: 0x4c4238 });
      roofProps.push({ x: x + w / 4, y: h + 5.6, z, sx: 3.4, sy: 1, sz: 3.4, color: 0x33291f });
    }
    // A glowing edge strip on the street face of some towers.
    if (rng() < 0.4) {
      neonStrips.push({
        x: x + (rng() < 0.5 ? w / 2 + 0.15 : -w / 2 - 0.15), y: h * (0.55 + rng() * 0.3), z,
        sx: 0.3, sy: 0.5, sz: d * 0.8, color: pick([0xff2e88, 0x22d3ee, 0xffa726, 0x8aff5a]),
      });
    }
  }

  const signTexts = [
    ["HOTEL", "#ff5da2", "VACANCY"], ["BAR", "#22d3ee", null], ["LIQUOR", "#ffa726", "24 H"],
    ["PAWN", "#8aff5a", "GOLD BOUGHT"], ["DINER", "#ff5da2", "OPEN LATE"], ["TACOS", "#ffd54a", null],
    ["CLUB NOVA", "#c77dff", null], ["GYM", "#22d3ee", "NO EXCUSES"], ["PHARMACY", "#8aff5a", null],
    ["LOANS", "#ff5252", "FAST CASH"], ["MOTEL", "#ff5da2", "POOL"], ["CINEMA", "#ffd54a", "NOW SHOWING"],
  ];
  let signIdx = 0;

  for (const b of blockCenters()) {
    const isHotel = b.x === LANDMARKS.hotel.x && b.z === LANDMARKS.hotel.z;
    const isCasino = b.x === LANDMARKS.casino.x && b.z === LANDMARKS.casino.z;
    if (isHotel || isCasino) continue; // built as landmarks below
    const pattern = rng();
    if (pattern < 0.3) {
      const h = downtown(b.x, b.z) ? 34 + rng() * 26 : 20 + rng() * 16;
      addBuilding(b.x, b.z, 26, h, 26, pick([0xb8bdd0, 0xcbb9a6, 0xa8bfd4, 0xd0a8b8]));
    } else if (pattern < 0.68) {
      for (const dx of [-8.5, 8.5]) {
        const h = 14 + rng() * (downtown(b.x, b.z) ? 22 : 13);
        addBuilding(b.x + dx, b.z, 14, h, 27, pick([0xb0b6c6, 0xc4b096, 0x9fb4cc]));
      }
    } else {
      for (const dx of [-8.5, 8.5]) for (const dz of [-8.5, 8.5]) {
        const h = 8 + rng() * 11;
        addBuilding(b.x + dx, b.z + dz, 14, h, 14, pick([0xc0c4d2, 0xd6c2a8, 0xaac4da, 0xd8b4c2]));
      }
    }
    // Street-level neon for the block's east face, most blocks.
    if (rng() < 0.72) {
      const [text, color, sub] = signTexts[signIdx++ % signTexts.length];
      signPlanes.push({ x: b.x + 16.6, z: b.z, rotY: Math.PI / 2, w: 15, h: 4.7, tex: neonTexture(text, color, sub) });
    }
  }
  buildingLists.forEach((list, i) => scene.add(instancedBoxes(list, facades[i])));
  scene.add(instancedBoxes(roofProps, basicMat(0xffffff)));
  scene.add(instancedBoxes(neonStrips, basicMat(0xffffff)));

  const signMat = (tex) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
  for (const s of signPlanes) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), signMat(s.tex));
    plane.position.set(s.x, 6.4, s.z);
    plane.rotation.y = s.rotY;
    scene.add(plane);
  }

  // -- Landmarks ----------------------------------------------------------------
  // Palms Royale: a tall stepped tower on Ocean Drive with a crown sign.
  const hotel = new THREE.Group();
  const hotelMat = new THREE.MeshBasicMaterial({ map: facadeTexture(51, "#c9a2b4") });
  const towerA = new THREE.Mesh(new THREE.BoxGeometry(26, 62, 26), hotelMat);
  towerA.position.y = 31;
  hotel.add(towerA);
  const towerB = new THREE.Mesh(new THREE.BoxGeometry(18, 78, 18), hotelMat);
  towerB.position.set(-3, 39, -3);
  hotel.add(towerB);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(16, 0.6, 7), basicMat(0xff5da2));
  canopy.position.set(14, 4.4, 0);
  hotel.add(canopy);
  const hotelSign = new THREE.Mesh(new THREE.PlaneGeometry(24, 7.5), signMat(neonTexture("PALMS ROYALE", "#ff5da2", "HOTEL & SPA")));
  hotelSign.position.set(0, 70, 9.6);
  hotel.add(hotelSign);
  const hotelSign2 = hotelSign.clone();
  hotelSign2.rotation.y = Math.PI / 2;
  hotelSign2.position.set(9.6, 70, 0);
  hotel.add(hotelSign2);
  const hotelLight = new THREE.PointLight(0xff8fc0, 1400, 70, 1.9);
  hotelLight.position.set(16, 6, 0);
  hotel.add(hotelLight);
  hotel.position.set(LANDMARKS.hotel.x, 0, LANDMARKS.hotel.z);
  scene.add(hotel);
  collide(LANDMARKS.hotel.x, LANDMARKS.hotel.z, 14, 14);

  // Casino Cielo: a wide slab, a marquee of chasing bulbs and a huge sign.
  const casino = new THREE.Group();
  const casinoMat = new THREE.MeshBasicMaterial({ map: facadeTexture(67, "#9a8fc0") });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(30, 17, 30), casinoMat);
  slab.position.y = 8.5;
  casino.add(slab);
  const casinoSign = new THREE.Mesh(new THREE.PlaneGeometry(30, 9.4), signMat(neonTexture("CASINO CIELO", "#ffd54a", "SLOTS · TABLES · LUCK")));
  casinoSign.position.set(15.4, 13.5, 0);
  casinoSign.rotation.y = Math.PI / 2;
  casino.add(casinoSign);
  const bulbGeo = new THREE.SphereGeometry(0.3, 8, 6);
  const bulbMatA = new THREE.MeshStandardMaterial({ color: 0x201404, emissive: 0xffd54a, emissiveIntensity: 1.5, roughness: 0.4 });
  const bulbMatB = new THREE.MeshStandardMaterial({ color: 0x20040c, emissive: 0xff2e88, emissiveIntensity: 1.5, roughness: 0.4 });
  const bulbsA = [], bulbsB = [];
  for (let i = 0; i < 26; i++) {
    (i % 2 ? bulbsA : bulbsB).push({ x: 15.6, y: 3.2, z: -12.5 + i });
  }
  const bulbMeshA = instancedBoxes(bulbsA, bulbMatA, bulbGeo);
  const bulbMeshB = instancedBoxes(bulbsB, bulbMatB, bulbGeo);
  casino.add(bulbMeshA, bulbMeshB);
  const casinoLight = new THREE.PointLight(0xffd54a, 1500, 75, 1.9);
  casinoLight.position.set(18, 8, 0);
  casino.add(casinoLight);
  casino.position.set(LANDMARKS.casino.x, 0, LANDMARKS.casino.z);
  scene.add(casino);
  collide(LANDMARKS.casino.x, LANDMARKS.casino.z, 15.5, 15.5);
  let bulbPhase = 0;
  dynamics.push((dt) => {
    bulbPhase += dt;
    const on = Math.floor(bulbPhase * 2.4) % 2 === 0;
    bulbMeshA.visible = on;
    bulbMeshB.visible = !on;
  });

  // Venn Loans: a modest office with a red sign — the debt lives here.
  const loansSign = new THREE.Mesh(new THREE.PlaneGeometry(13, 4.1), signMat(neonTexture("VENN LOANS", "#ff5252", "PAY UP")));
  loansSign.position.set(LANDMARKS.loans.x + 13.4, 7.6, LANDMARKS.loans.z);
  loansSign.rotation.y = Math.PI / 2;
  scene.add(loansSign);

  // -- Dockyard -------------------------------------------------------------------
  const containerColors = [0x8e3b32, 0x3a5a80, 0x3f7a52, 0x96702f, 0x5d4a75, 0x8a8378, 0x35706e];
  const containers = [];
  for (let i = 0; i < 64; i++) {
    const stackH = 1 + Math.floor(rng() * 3);
    const cx = DOCKYARD.minX + 6 + rng() * (DOCKYARD.maxX - DOCKYARD.minX - 12);
    const cz = DOCKYARD.minZ + 8 + rng() * (DOCKYARD.maxZ - DOCKYARD.minZ - 16);
    const rotY = rng() < 0.5 ? 0 : Math.PI / 2;
    for (let s = 0; s < stackH; s++) {
      containers.push({ x: cx, y: 1.3 + s * 2.6, z: cz, sx: 12, sy: 2.6, sz: 5, rotY, color: pick(containerColors) });
    }
    collide(cx, cz, rotY ? 2.5 : 6, rotY ? 6 : 2.5);
  }
  scene.add(instancedBoxes(containers, basicMat(0xffffff)));

  // Two dock cranes: legs, a jib and a hanging hook block.
  const craneMat = basicMat(0xd08a1d);
  const craneDark = basicMat(0x3a3f4c);
  for (const [cx, cz] of [[-222, 84], [-200, 128]]) {
    const crane = new THREE.Group();
    for (const [lx, lz] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 26, 1.2), craneMat);
      leg.position.set(lx, 13, lz);
      crane.add(leg);
      collide(cx + lx, cz + lz, 0.8, 0.8);
    }
    const jib = new THREE.Mesh(new THREE.BoxGeometry(34, 1.6, 1.6), craneMat);
    jib.position.set(6, 26.5, 0);
    crane.add(jib);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), craneDark);
    cab.position.set(-2, 24.4, 0);
    crane.add(cab);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 1.6), craneDark);
    hook.position.set(18, 15, 0);
    crane.add(hook);
    const cable = new THREE.Mesh(new THREE.BoxGeometry(0.12, 10, 0.12), craneDark);
    cable.position.set(18, 21, 0);
    crane.add(cable);
    crane.position.set(cx, 0, cz);
    scene.add(crane);
  }

  // Warehouse shed at the yard's north edge.
  const shed = new THREE.Mesh(new THREE.BoxGeometry(30, 9, 16), new THREE.MeshBasicMaterial({ map: facadeTexture(91, "#7d8896") }));
  shed.position.set(-208, 4.5, 66);
  scene.add(shed);
  collide(-208, 66, 15, 8);
  const shedSign = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), signMat(neonTexture("SALVAGE & SONS", "#22d3ee", "WE BUY WRECKS")));
  shedSign.position.set(-208, 7, 74.3);
  scene.add(shedSign);

  // -- Impound lot ------------------------------------------------------------------
  const fenceMat = basicMat(0x596273);
  const fence = [];
  const im = IMPOUND;
  for (let x = im.minX; x <= im.maxX; x += 4) {
    fence.push({ x, y: 1.1, z: im.minZ, sx: 0.18, sy: 2.2, sz: 0.18, color: 0x596273 });
    if (x < im.minX + 30 || x > im.maxX - 12) fence.push({ x, y: 1.1, z: im.maxZ, sx: 0.18, sy: 2.2, sz: 0.18, color: 0x596273 });
  }
  for (let z = im.minZ; z <= im.maxZ; z += 4) {
    fence.push({ x: im.minX, y: 1.1, z, sx: 0.18, sy: 2.2, sz: 0.18, color: 0x596273 });
    fence.push({ x: im.maxX, y: 1.1, z, sx: 0.18, sy: 2.2, sz: 0.18, color: 0x596273 });
  }
  scene.add(instancedBoxes(fence, fenceMat));
  void fenceMat;

  // -- Street furniture ---------------------------------------------------------------
  // Lampposts along every road, with a pool of light under each head.
  const lampPosts = [], lampHeads = [], lightPools = [];
  const lampSpots = [];
  for (const ax of [...AVENUES_X, OCEAN_DRIVE_X]) {
    for (let z = -150; z <= 150; z += 30) lampSpots.push({ x: ax + ROAD_HALF + 1.2, z: z + (ax % 2 ? 8 : 0) });
  }
  for (const sz of STREETS_Z) {
    for (let x = -190; x <= 140; x += 30) lampSpots.push({ x: x + 6, z: sz - ROAD_HALF - 1.2 });
  }
  for (const s of lampSpots) {
    if (s.x > BEACH_X - 4) continue;
    lampPosts.push({ x: s.x, y: 3, z: s.z, sx: 0.28, sy: 6, sz: 0.28, color: 0x23262e });
    lampHeads.push({ x: s.x, y: 6.1, z: s.z, sx: 0.85, sy: 0.5, sz: 0.85, color: 0xffc37a });
    lightPools.push({ x: s.x, y: 0.14, z: s.z, sx: 7.5, sy: 0.02, sz: 7.5 });
  }
  scene.add(instancedBoxes(lampPosts, basicMat(0xffffff)));
  scene.add(instancedBoxes(lampHeads, basicMat(0xffffff)));
  const poolMesh = instancedBoxes(lightPools, new THREE.MeshBasicMaterial({
    color: 0xff9a3c, transparent: true, opacity: 0.10, depthWrite: false,
  }));
  scene.add(poolMesh);

  // Palms: bent trunks and frond crowns, thick along Ocean Drive and the beach.
  const trunks = [], fronds = [];
  const palmAt = (x, z) => {
    const lean = (rng() - 0.5) * 0.16;
    const hgt = 6.5 + rng() * 2.5;
    trunks.push({ x, y: hgt / 2, z, sx: 0.55, sy: hgt, sz: 0.55, rotY: 0, color: 0x7a5c3e });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rng() * 0.5;
      fronds.push({
        x: x + Math.cos(a) * 1.5 + lean * 6, y: hgt + 0.25 - Math.abs(Math.sin(a)) * 0.3, z: z + Math.sin(a) * 1.5,
        sx: 3.0, sy: 3.0, sz: 3.0, rotY: -a,
      });
    }
  };
  for (let z = -148; z <= 148; z += 13) { palmAt(143.6, z + rng() * 4); if (rng() < 0.7) palmAt(120.6, z + 6); }
  for (let i = 0; i < 46; i++) palmAt(-190 + rng() * 320, -140 + rng() * 280);
  for (let i = 0; i < 16; i++) palmAt(156 + rng() * 18, -140 + rng() * 280);
  const trunkMesh = new THREE.InstancedMesh(cylGeo, basicMat(0xffffff), trunks.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    trunks.forEach((t, i) => {
      p.set(t.x, t.y, t.z); s.set(t.sx, t.sy, t.sz); q.identity();
      m.compose(p, q, s);
      trunkMesh.setMatrixAt(i, m);
      trunkMesh.setColorAt(i, new THREE.Color(t.color));
    });
    trunkMesh.frustumCulled = false;
    scene.add(trunkMesh);
  }
  const frondMat = new THREE.MeshBasicMaterial({ map: frondTexture, transparent: true, side: THREE.DoubleSide, alphaTest: 0.15, color: 0xa9bfa9 });
  const frondMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), frondMat, fronds.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    fronds.forEach((t, i) => {
      e.set(-1.08, t.rotY, 0.15);
      q.setFromEuler(e);
      p.set(t.x, t.y, t.z); s.set(t.sx, t.sy, t.sz);
      m.compose(p, q, s);
      frondMesh.setMatrixAt(i, m);
    });
    frondMesh.frustumCulled = false;
    scene.add(frondMesh);
  }

  // Benches, hydrants, dumpsters: the small print of a lived-in street.
  const benches = [], hydrants = [], dumpsters = [];
  for (let z = -140; z <= 140; z += 22) {
    benches.push({ x: 141.5, y: 0.5, z, sx: 0.6, sy: 0.9, sz: 2.4, color: 0x4c6b8a });
    if (rng() < 0.6) hydrants.push({ x: 119.4, y: 0.45, z: z + 9, sx: 0.5, sy: 0.9, sz: 0.5, color: 0xd23b2e });
  }
  for (const b of blockCenters()) {
    if (rng() < 0.55) dumpsters.push({ x: b.x - 15.4, y: 0.8, z: b.z + (rng() - 0.5) * 18, sx: 1.4, sy: 1.6, sz: 2.6, color: pick([0x2e6e46, 0x39506e, 0x6e5239]) });
    if (rng() < 0.4) benches.push({ x: b.x + 15.2, y: 0.5, z: b.z - 8, sx: 0.6, sy: 0.9, sz: 2.4, color: 0x54687e });
  }
  scene.add(instancedBoxes(benches, basicMat(0xffffff)));
  scene.add(instancedBoxes(hydrants, basicMat(0xffffff)));
  scene.add(instancedBoxes(dumpsters, basicMat(0xffffff)));

  // Billboards on poles and rooftops.
  const ads = [
    billboardTexture("VISIT", "PORT MERIDIAN", "#12283f", "#7fe7ff"),
    billboardTexture("CIELO", "JACKPOT $50,000", "#2c1240", "#ffd54a"),
    billboardTexture("MARLOWE'S", "GARAGE · 24H", "#30160f", "#ffb37a"),
    billboardTexture("SURF", "RENTALS DAILY", "#0f3030", "#8affd1"),
  ];
  const boardPoles = [];
  const boardSpots = [
    { x: -60, z: -118, rotY: 0 }, { x: 60, z: 118, rotY: Math.PI }, { x: -160, z: 30, rotY: Math.PI / 2 },
    { x: 30, z: -60, rotY: 0 }, { x: -100, z: -30, rotY: Math.PI / 2 },
  ];
  boardSpots.forEach((s, i) => {
    boardPoles.push({ x: s.x, y: 5, z: s.z, sx: 0.5, sy: 10, sz: 0.5, color: 0x2c3038 });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(15, 7.5), new THREE.MeshBasicMaterial({ map: ads[i % ads.length], side: THREE.DoubleSide }));
    board.position.set(s.x, 12.5, s.z);
    board.rotation.y = s.rotY;
    scene.add(board);
  });
  scene.add(instancedBoxes(boardPoles, basicMat(0xffffff)));

  // String lights sagging across Ocean Drive.
  const stringBulbs = [];
  for (let z = -132; z <= 132; z += 24) {
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const x = 121 + t * 22;
      const y = 7.6 - Math.sin(t * Math.PI) * 1.5;
      stringBulbs.push({ x, y, z, sx: 0.34, sy: 0.34, sz: 0.34, color: pick([0xffc37a, 0xff8fc0, 0x7fe7ff]) });
    }
  }
  const stringMesh = instancedBoxes(stringBulbs, basicMat(0xffffff), new THREE.SphereGeometry(0.5, 6, 6));
  scene.add(stringMesh);

  // Beach props: umbrellas, loungers and a lifeguard stand.
  const beachProps = [];
  for (let i = 0; i < 26; i++) {
    const x = 158 + rng() * 16, z = -145 + rng() * 290;
    beachProps.push({ x, y: 1.15, z, sx: 0.16, sy: 2.3, sz: 0.16, color: 0xd8d3c8 });
    beachProps.push({ x, y: 2.4, z, sx: 3.4, sy: 0.5, sz: 3.4, color: pick([0xff5da2, 0x22d3ee, 0xffa726]) });
    if (rng() < 0.7) beachProps.push({ x: x + 1.6, y: 0.35, z: z + 0.8, sx: 0.8, sy: 0.5, sz: 2.1, color: 0xe8e2d2 });
  }
  scene.add(instancedBoxes(beachProps, basicMat(0xffffff)));
  const lifeguard = new THREE.Mesh(new THREE.BoxGeometry(3, 3.4, 3), basicMat(0xe8e2d2));
  lifeguard.position.set(158, 1.7, -20);
  scene.add(lifeguard);
  collide(158, -20, 1.6, 1.6);

  // -- Skyline silhouettes and sky ---------------------------------------------------
  const skyline = [];
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2;
    const r = 330 + rng() * 90;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8;
    if (x > 190) continue; // keep the sea horizon clean
    skyline.push({ x, y: 20, z, sx: 26 + rng() * 20, sy: 40 + rng() * 55, sz: 26, color: 0x0d1122 });
  }
  const skylineMesh = instancedBoxes(skyline, new THREE.MeshBasicMaterial({ map: facadeTexture(131, "#39405c") }));
  scene.add(skylineMesh);

  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(700 * 3);
  for (let i = 0; i < 700; i++) {
    const a = rng() * Math.PI * 2, e = rng() * Math.PI * 0.42 + 0.08, r = 620;
    starPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    starPos[i * 3 + 1] = Math.sin(e) * r;
    starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcdd8ff, size: 1.6, sizeAttenuation: false, fog: false })));
  const moonSprite = new THREE.Mesh(new THREE.CircleGeometry(16, 24), new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false }));
  moonSprite.position.set(-320, 300, -420);
  moonSprite.lookAt(0, 0, 0);
  scene.add(moonSprite);

  // Drifting haze: a few hundred soft points wandering over the streets.
  const hazeCount = 380;
  const hazePos = new Float32Array(hazeCount * 3);
  for (let i = 0; i < hazeCount; i++) {
    hazePos[i * 3] = -220 + rng() * 440;
    hazePos[i * 3 + 1] = 1 + rng() * 16;
    hazePos[i * 3 + 2] = -160 + rng() * 320;
  }
  const hazeGeo = new THREE.BufferGeometry();
  hazeGeo.setAttribute("position", new THREE.BufferAttribute(hazePos, 3));
  const hazeTex = canvasTexture(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    grad.addColorStop(0, "rgba(255,255,255,0.85)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
  const haze = new THREE.Points(hazeGeo, new THREE.PointsMaterial({
    color: 0x93a7d8, size: 2.2, map: hazeTex, transparent: true, opacity: 0.10, depthWrite: false,
  }));
  haze.frustumCulled = false;
  scene.add(haze);
  dynamics.push((dt, t) => {
    haze.position.x = Math.sin(t * 0.021) * 9;
    haze.position.z = Math.cos(t * 0.017) * 7;
  });

  return {
    colliders,
    update(dt, elapsed) {
      for (const fn of dynamics) fn(dt, elapsed);
    },
  };
}

/** Resolve a circle (x, z, radius) out of every AABB collider. Mutates pos. */
export function resolveCollisions(pos, radius, colliders) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(c.maxX, pos.x));
    const nz = Math.max(c.minZ, Math.min(c.maxZ, pos.z));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * radius;
      pos.z = nz + (dz / d) * radius;
    } else {
      // Centre inside the box: push out along the smallest penetration.
      const left = pos.x - c.minX, right = c.maxX - pos.x;
      const top = pos.z - c.minZ, bottom = c.maxZ - pos.z;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = c.minX - radius;
      else if (m === right) pos.x = c.maxX + radius;
      else if (m === top) pos.z = c.minZ - radius;
      else pos.z = c.maxZ + radius;
    }
  }
  return pos;
}
