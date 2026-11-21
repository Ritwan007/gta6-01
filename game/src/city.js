// city.js — builds Port Meridian in three.js from cityplan.js: a neon dusk
// sky, the bay, the road grid, tower blocks with lit windows, palms, lamps,
// and the landmark buildings the story visits (Palms Royale, Casino Cielo,
// the dockyard, Zara's garage, the lighthouse pier). Returns the building
// colliders the physics steps use, plus an update for water and light beams.

import * as THREE from 'three';
import { AVENUES, BEACH_X, BLOCKS, BLOCK_SIZE, CITY, LANDMARKS, STREETS } from './cityplan.js';
import {
  asphaltTexture,
  buildingFacade,
  concreteTexture,
  FACADE_PALETTES,
  glowTexture,
  neonSignTexture,
  palmFrondTexture,
  roadTexture,
  sandTexture,
} from './textures.js';

const NEON = ['#ff2e88', '#00e5ff', '#ffb300', '#b967ff', '#3dff8f', '#ff5e3a'];

/** Merge simple geometries into one, applying a matrix to each part. */
export function mergeParts(parts) {
  const positions = [];
  const normals = [];
  const uvs = [];
  for (const { geometry, matrix } of parts) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.applyMatrix4(matrix);
    positions.push(...g.attributes.position.array);
    normals.push(...g.attributes.normal.array);
    if (g.attributes.uv) uvs.push(...g.attributes.uv.array);
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (uvs.length) merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return merged;
}

function matrix(x, y, z, ry = 0, rx = 0, rz = 0, s = 1) {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(s, s, s),
  );
  return m;
}

/** The dusk sky: a gradient dome, a field of stars and a low moon. */
function buildSky(scene, glowTex) {
  const skyGeo = new THREE.SphereGeometry(1500, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {},
    vertexShader: `
      varying vec3 vPos;
      void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 zenith = vec3(0.03, 0.04, 0.13);
        vec3 mid = vec3(0.23, 0.07, 0.35);
        vec3 horizon = vec3(0.98, 0.30, 0.45);
        vec3 low = vec3(1.0, 0.55, 0.20);
        vec3 col = mix(mid, zenith, smoothstep(0.12, 0.65, h));
        col = mix(horizon, col, smoothstep(0.0, 0.14, h));
        col = mix(low, col, smoothstep(-0.06, 0.015, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  const starRng = Math.random;
  for (let i = 0; i < 800; i += 1) {
    const a = starRng() * Math.PI * 2;
    const e = Math.asin(starRng() * 0.92 + 0.06);
    const r = 1400;
    starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xcdd8ff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }),
  );
  scene.add(stars);

  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xdfe8ff, fog: false, transparent: true, opacity: 0.95 }));
  moon.position.set(-700, 420, -1050);
  moon.scale.setScalar(190);
  scene.add(moon);
}

/** Serena Bay: a dark shader sea with slow neon-tinted shimmer. */
function buildOcean(scene) {
  const geo = new THREE.PlaneGeometry(2400, 1800);
  const mat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      varying vec3 vWorld;
      uniform float uTime;
      void main() {
        vec3 deep = vec3(0.012, 0.07, 0.14);
        vec3 lift = vec3(0.03, 0.16, 0.26);
        float wave = sin(vWorld.x * 0.11 + uTime * 0.7 + sin(vWorld.z * 0.13 + uTime * 0.4) * 1.7);
        float wave2 = sin(vWorld.z * 0.21 - uTime * 0.55 + vWorld.x * 0.05);
        vec3 col = mix(deep, lift, smoothstep(0.2, 1.0, wave * 0.5 + wave2 * 0.5) * 0.55);
        float glitter = pow(max(0.0, sin(vWorld.x * 1.4 + uTime * 1.3) * sin(vWorld.z * 1.1 - uTime)), 6.0);
        col += vec3(1.0, 0.45, 0.65) * glitter * 0.12;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sea = new THREE.Mesh(geo, mat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(80, -0.4, 0);
  scene.add(sea);
  return mat;
}

/** A neon sign plane plus its halo sprite, parented to `parent` at a pose. */
function addNeonSign(parent, text, color, width, pos, rotY = 0) {
  const { texture, aspect } = neonSignTexture(text, color);
  const height = width / aspect;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, fog: false }),
  );
  sign.position.copy(pos);
  sign.rotation.y = rotY;
  parent.add(sign);
  return sign;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const glowTex = glowTexture();
  scene.fog = new THREE.FogExp2(0x241031, 0.00135);

  buildSky(scene, glowTex);
  const oceanMat = buildOcean(scene);

  scene.add(new THREE.HemisphereLight(0x8a7bd8, 0x1c0f2e, 1.35));
  const moonlight = new THREE.DirectionalLight(0x9db8ff, 1.0);
  moonlight.position.set(-300, 420, -500);
  scene.add(moonlight);
  scene.add(new THREE.AmbientLight(0x40305e, 0.9));

  // --- Ground: city slab, roads, beach -------------------------------------
  const asphalt = asphaltTexture(rng);
  asphalt.repeat.set(30, 22);
  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.maxX - CITY.minX, CITY.maxZ - CITY.minZ),
    new THREE.MeshLambertMaterial({ map: asphalt }),
  );
  slab.rotation.x = -Math.PI / 2;
  slab.position.set(0, 0, 0);
  scene.add(slab);

  const roadTexA = roadTexture();
  roadTexA.repeat.set(1, 22);
  const roadMatA = new THREE.MeshLambertMaterial({ map: roadTexA });
  const roadTexB = roadTexture();
  roadTexB.center.set(0.5, 0.5);
  roadTexB.rotation = Math.PI / 2;
  roadTexB.repeat.set(1, 30);
  const roadMatB = new THREE.MeshLambertMaterial({ map: roadTexB });
  const avenueGeo = new THREE.PlaneGeometry(16, CITY.maxZ - CITY.minZ);
  for (const ax of AVENUES) {
    const road = new THREE.Mesh(avenueGeo, roadMatA);
    road.rotation.x = -Math.PI / 2;
    road.position.set(ax, 0.02, 0);
    scene.add(road);
  }
  const streetGeo = new THREE.PlaneGeometry(CITY.maxX - CITY.minX, 16);
  for (const sz of STREETS) {
    const road = new THREE.Mesh(streetGeo, roadMatB);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.02, sz);
    scene.add(road);
  }

  const sand = sandTexture(rng);
  sand.repeat.set(3, 22);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(46, CITY.maxZ - CITY.minZ), new THREE.MeshLambertMaterial({ map: sand }));
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(BEACH_X + 21, 0.04, 0);
  scene.add(beach);
  const promenade = new THREE.Mesh(
    new THREE.PlaneGeometry(26, CITY.maxZ - CITY.minZ),
    new THREE.MeshLambertMaterial({ map: concreteTexture(rng) }),
  );
  promenade.rotation.x = -Math.PI / 2;
  promenade.position.set(215, 0.05, 0);
  scene.add(promenade);

  // --- Blocks: islands, towers, landmarks ----------------------------------
  const facades = FACADE_PALETTES.map((palette) => {
    const tex = buildingFacade(rng.fork(), palette);
    return new THREE.MeshLambertMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: 0xffffff,
      emissiveIntensity: 0.62,
      color: 0x9aa0b5,
    });
  });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x11141d });
  const concrete = concreteTexture(rng);
  concrete.repeat.set(6, 6);
  const islandMat = new THREE.MeshLambertMaterial({ map: concrete });
  const islandGeo = new THREE.BoxGeometry(BLOCK_SIZE, 0.3, BLOCK_SIZE);
  const towerGeo = new THREE.BoxGeometry(1, 1, 1);

  const addCollider = (cx, cz, w, d) =>
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });

  const crownMats = NEON.map((c) => new THREE.MeshBasicMaterial({ color: c, fog: false }));
  function tower(x, z, w, d, h, facadeIndex) {
    const side = facades[facadeIndex % facades.length];
    const mesh = new THREE.Mesh(towerGeo, [side, side, roofMat, side, side, side]);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, 0.3 + h / 2, z);
    scene.add(mesh);
    addCollider(x, z, w, d);
    if (h > 30 && rng.chance(0.55)) {
      const crown = new THREE.Mesh(towerGeo, rng.pick(crownMats));
      crown.scale.set(w + 0.5, 0.7, d + 0.5);
      crown.position.set(x, 0.3 + h + 0.35, z);
      scene.add(crown);
    }
    return mesh;
  }

  for (const block of BLOCKS) {
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.set(block.cx, 0.15, block.cz);
    scene.add(island);
    if (block.kind === 'buildings') {
      for (const ox of [-11.5, 11.5]) {
        for (const oz of [-11.5, 11.5]) {
          if (rng.chance(0.1)) continue;
          const w = rng.range(14, 20);
          const d = rng.range(14, 20);
          const centrePull = 1 - Math.min(1, Math.hypot(block.cx, block.cz) / 260);
          const h = rng.range(13, 26) + centrePull * rng.range(8, 30);
          tower(block.cx + ox, block.cz + oz, w, d, h, rng.int(0, 2));
        }
      }
    }
  }

  // Palms Royale hotel: the tall pink tower on Ocean Drive.
  tower(LANDMARKS.hotelFront.x - 30, 32, 30, 34, 74, 2);
  addNeonSign(scene, 'PALMS ROYALE', '#ff2e88', 26, new THREE.Vector3(176.2, 30, 32), Math.PI / 2);
  const hotelLight = new THREE.PointLight(0xff5e9c, 900, 70, 2);
  hotelLight.position.set(182, 10, 32);
  scene.add(hotelLight);

  // Casino Cielo.
  tower(96, -96, 40, 36, 20, 2);
  addNeonSign(scene, 'CASINO CIELO', '#ffb300', 30, new THREE.Vector3(96, 17, -76.8), 0);
  const casinoLight = new THREE.PointLight(0xffc46b, 800, 65, 2);
  casinoLight.position.set(96, 9, -72);
  scene.add(casinoLight);

  // Dockyard: warehouses, crates and two crane silhouettes.
  const warehouseMat = new THREE.MeshLambertMaterial({ color: 0x2c3444 });
  const warehouseRoof = new THREE.MeshLambertMaterial({ color: 0x1a1f2a });
  for (const [wx, wz, ww, wd] of [[-148, 74, 30, 14], [-146, 108, 16, 30], [-178, 116, 22, 14]]) {
    const wh = new THREE.Mesh(towerGeo, [warehouseMat, warehouseMat, warehouseRoof, warehouseMat, warehouseMat, warehouseMat]);
    wh.scale.set(ww, 9, wd);
    wh.position.set(wx, 0.3 + 4.5, wz);
    scene.add(wh);
    addCollider(wx, wz, ww, wd);
  }
  addNeonSign(scene, 'MARINA', '#00e5ff', 14, new THREE.Vector3(-148, 8, 65.8), Math.PI);
  const crateGeo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
  const crateCount = 46;
  const crates = new THREE.InstancedMesh(crateGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), crateCount);
  let crateIndex = 0;
  const crateSpots = [];
  for (let i = 0; i < crateCount; i += 1) {
    const cx = rng.range(-186, -134);
    const cz = rng.range(74, 122);
    if (Math.abs(cx - LANDMARKS.ledgerCrate.x) < 5 && Math.abs(cz - LANDMARKS.ledgerCrate.z) < 5) continue;
    const level = rng.chance(0.35) ? 1 : 0;
    crates.setMatrixAt(crateIndex, matrix(cx, 1.1 + level * 2.2, cz, rng.range(0, Math.PI)));
    crates.setColorAt(crateIndex, new THREE.Color(rng.pick([0x7a4a21, 0x2e5e4e, 0x54486e, 0x6e2f35])));
    crateSpots.push({ x: cx, z: cz });
    crateIndex += 1;
  }
  crates.count = crateIndex;
  scene.add(crates);
  const craneMat = new THREE.MeshLambertMaterial({ color: 0x141008 });
  for (const [px, pz] of [[-188, 70], [-140, 124]]) {
    const crane = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.BoxGeometry(1.6, 26, 1.6), craneMat);
    mast.position.y = 13;
    crane.add(mast);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(20, 1.2, 1.2), craneMat);
    jib.position.set(7, 25, 0);
    crane.add(jib);
    crane.position.set(px, 0, pz);
    scene.add(crane);
    addCollider(px, pz, 2.4, 2.4);
  }

  // Zara's garage at the safehouse block.
  const garage = new THREE.Mesh(towerGeo, [warehouseMat, warehouseMat, warehouseRoof, warehouseMat, warehouseMat, warehouseMat]);
  garage.scale.set(26, 7, 16);
  garage.position.set(-32, 0.3 + 3.5, 88);
  scene.add(garage);
  addCollider(-32, 88, 26, 16);
  addNeonSign(scene, "ZARA'S", '#3dff8f', 10, new THREE.Vector3(-32, 6, 96.3), 0);

  // Meridian Plaza: a fountain ring and open stone.
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.6, 1.1, 20), new THREE.MeshLambertMaterial({ color: 0x39415a }));
  basin.position.set(32, 0.55, -32);
  scene.add(basin);
  const fountainWater = new THREE.Mesh(
    new THREE.CylinderGeometry(6.2, 6.2, 0.3, 20),
    new THREE.MeshBasicMaterial({ color: 0x1d5f8a }),
  );
  fountainWater.position.set(32, 1.15, -32);
  scene.add(fountainWater);
  addCollider(32, -32, 14, 14);

  // A few bar and club signs scattered on tower faces for street-level neon.
  const signSpots = [
    ['CLUB LUNA', '#b967ff', -64, 14, -55.8, 0],
    ['BAR SOL', '#ff5e3a', 0, 12, 55.8, Math.PI],
    ['DINER 24H', '#00e5ff', 128, 13, -8.2, Math.PI / 2],
    ['PAWN', '#3dff8f', -128, 11, 71.8, Math.PI * 1.5],
    ['HOTEL MAR', '#ff2e88', 64, 15, -119.8, 0],
  ];
  for (const [text, color, x, y, z, ry] of signSpots) {
    addNeonSign(scene, text, color, 13, new THREE.Vector3(x, y, z), ry);
  }

  // --- Palms: instanced trunks and crowns sharing one set of poses ---------
  const palmPoses = [];
  for (let z = -168; z <= 168; z += 16) palmPoses.push({ x: 214, z: z + rng.range(-2, 2) });
  for (let i = 0; i < 16; i += 1) palmPoses.push({ x: rng.range(234, 258), z: rng.range(-168, 168) });
  for (let i = 0; i < 8; i += 1) palmPoses.push({ x: 32 + rng.range(-18, 18), z: -32 + rng.range(-18, 18) });
  for (let i = 0; i < 22; i += 1) {
    const block = rng.pick(BLOCKS);
    palmPoses.push({ x: block.cx + rng.range(-26, 26), z: block.cz + rng.range(-26, 26) });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 5.2, 5);
  trunkGeo.translate(0, 2.6, 0);
  const frondGeoParts = [];
  for (let i = 0; i < 7; i += 1) {
    const plane = new THREE.PlaneGeometry(3.6, 1.25);
    plane.translate(1.55, 0, 0);
    frondGeoParts.push({
      geometry: plane,
      matrix: matrix(0, 0, 0, (i / 7) * Math.PI * 2, 0, -0.55 - (i % 3) * 0.12),
    });
  }
  const frondGeo = mergeParts(frondGeoParts);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3826 });
  const frondMat = new THREE.MeshLambertMaterial({ map: palmFrondTexture(), alphaTest: 0.3, side: THREE.DoubleSide });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmPoses.length);
  const crowns = new THREE.InstancedMesh(frondGeo, frondMat, palmPoses.length);
  palmPoses.forEach((pose, i) => {
    const tilt = rng.range(-0.07, 0.07);
    const m = matrix(pose.x, 0, pose.z, rng.range(0, Math.PI * 2), tilt, tilt * 0.6, rng.range(0.85, 1.2));
    trunks.setMatrixAt(i, m);
    const top = new THREE.Matrix4().makeTranslation(0, 5.1, 0);
    crowns.setMatrixAt(i, m.clone().multiply(top));
  });
  scene.add(trunks);
  scene.add(crowns);

  // --- Street lamps: instanced posts, one Points cloud for all the glows ---
  const lampParts = [
    { geometry: new THREE.CylinderGeometry(0.09, 0.12, 5.4, 5), matrix: matrix(0, 2.7, 0) },
    { geometry: new THREE.BoxGeometry(1.4, 0.12, 0.12), matrix: matrix(0.6, 5.35, 0) },
  ];
  const lampGeo = mergeParts(lampParts);
  const lampSpots = [];
  for (const ax of AVENUES) for (let z = -160; z <= 160; z += 40) lampSpots.push({ x: ax + 8.6, z });
  for (const sz of STREETS) for (let x = -176; x <= 176; x += 44) lampSpots.push({ x, z: sz + 8.6 });
  const lamps = new THREE.InstancedMesh(lampGeo, new THREE.MeshLambertMaterial({ color: 0x22242e }), lampSpots.length);
  lampSpots.forEach((spot, i) => lamps.setMatrixAt(i, matrix(spot.x, 0, spot.z, rng.range(0, Math.PI * 2))));
  scene.add(lamps);
  const glowPositions = [];
  const glowColors = [];
  const warm = new THREE.Color(0xffc98a);
  for (const spot of lampSpots) {
    glowPositions.push(spot.x + 1.2, 5.3, spot.z);
    glowColors.push(warm.r, warm.g, warm.b);
  }
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowPositions, 3));
  glowGeo.setAttribute('color', new THREE.Float32BufferAttribute(glowColors, 3));
  const glowPoints = new THREE.Points(
    glowGeo,
    new THREE.PointsMaterial({
      map: glowTex,
      size: 7,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  scene.add(glowPoints);

  // --- The lighthouse pier ---------------------------------------------------
  const pier = new THREE.Mesh(new THREE.BoxGeometry(64, 1, 9), new THREE.MeshLambertMaterial({ color: 0x3d3a33 }));
  pier.position.set(272, 0.6, -144);
  scene.add(pier);
  const towerLightMat = new THREE.MeshLambertMaterial({ color: 0xe8e2d4 });
  const lightTower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 13, 10), towerLightMat);
  lightTower.position.set(298, 7.1, -144);
  scene.add(lightTower);
  const lightBand = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.5, 3, 10), new THREE.MeshLambertMaterial({ color: 0xc22e3a }));
  lightBand.position.set(298, 10.5, -144);
  scene.add(lightBand);
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 2.2, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }),
  );
  lampRoom.position.set(298, 14.6, -144);
  scene.add(lampRoom);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffe9a8,
    transparent: true,
    opacity: 0.13,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(7, 46, 12, 1, true), beamMat);
  beam.geometry.translate(0, -23, 0);
  beam.position.set(298, 14.6, -144);
  scene.add(beam);
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe9a8, transparent: true, depthWrite: false }));
  beacon.position.set(298, 14.6, -144);
  beacon.scale.setScalar(26);
  scene.add(beacon);
  addCollider(298, -144, 6, 6);

  let elapsed = 0;
  return {
    colliders,
    update(dt) {
      elapsed += dt;
      oceanMat.uniforms.uTime.value = elapsed;
      beam.rotation.y = elapsed * 0.5;
      beam.rotation.z = Math.PI / 2.25;
      fountainWater.position.y = 1.15 + Math.sin(elapsed * 2.2) * 0.05;
    },
  };
}
