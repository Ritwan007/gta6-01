// Caldera Bay — procedural 3D city on a 7x7 street grid (120 m pitch, 14 m roads).
// Buildings live inside blocks, >=18 m from any street centreline, so every named point
// (garage, hideouts, shops, mission spots, race checkpoints) is reachable by car or foot.
// Two structural guarantees, checked by the play-test: all 14 streets clear of buildings,
// and every named point >=3 m from any building.
import * as THREE from 'three';
import { CITY } from './config.js';

function districtAt(x, z) {
  for (const d of CITY.districts) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return CITY.districts[1];
}

export function buildCity(G) {
  const { scene, rng, textures } = G;
  const buildings = []; // {minX,maxX,minZ,maxZ,h}
  const group = new THREE.Group();
  scene.add(group);

  // Ground + roads + sidewalks.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2, CITY.half * 2),
    new THREE.MeshLambertMaterial({ color: 0x6a5a48 }),
  );
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);
  const roadMat = new THREE.MeshLambertMaterial({ map: textures.road });
  const walkMat = new THREE.MeshLambertMaterial({ map: textures.sidewalk });
  for (const s of CITY.streets) {
    for (const [mat, w, off] of [[roadMat, 14, 0], [walkMat, 5, -9.5], [walkMat, 5, 9.5]]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, w), mat);
      strip.rotation.x = -Math.PI / 2; strip.position.set(0, 0.02, s + off); strip.receiveShadow = true; group.add(strip);
      const strip2 = new THREE.Mesh(new THREE.PlaneGeometry(w, CITY.half * 2), mat);
      strip2.rotation.x = -Math.PI / 2; strip2.position.set(s + off, 0.02, 0); strip2.receiveShadow = true; group.add(strip2);
    }
  }
  // District tint washes on the ground.
  for (const d of CITY.districts) {
    const tint = new THREE.Mesh(
      new THREE.PlaneGeometry(d.x1 - d.x0, d.z1 - d.z0),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05 }),
    );
    tint.material.color.set(d.palette[0]);
    tint.rotation.x = -Math.PI / 2; tint.position.set((d.x0 + d.x1) / 2, 0.03, (d.z0 + d.z1) / 2);
    group.add(tint);
  }

  const blockCenters = [-300, -180, -60, 60, 180, 300];
  const facadeKeys = { 'Old Pier': 'pier', 'Neon Row': 'neon', 'The Terraces': 'terrace', 'Marina Sol': 'marina', 'Crown Hill': 'crown' };
  const blockBoxes = []; // keep landmarks clear of random buildings

  function addBuilding(cx, cz, w, d, h, facadeKey) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshLambertMaterial({ map: textures.facades[facadeKey] });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, h / 2, cz); mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    // Flat roof cap so the top reads as a roofline, not a texture edge.
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 1, d + 1), new THREE.MeshLambertMaterial({ color: 0x2a2018 }));
    cap.position.set(cx, h + 0.5, cz); group.add(cap);
    buildings.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h });
    return mesh;
  }

  // Landmark buildings first (so random buildings never crowd them), each offset from its
  // interact point so the point itself stays in the open.
  function landmark(name, px, pz, offX, offZ, w, d, h, signKey) {
    const cx = px + offX, cz = pz + offZ;
    const dist = districtAt(cx, cz);
    addBuilding(cx, cz, w, d, h, facadeKeys[dist.name]);
    blockBoxes.push({ minX: cx - w / 2 - 6, maxX: cx + w / 2 + 6, minZ: cz - d / 2 - 6, maxZ: cz + d / 2 + 6 });
    if (signKey) {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(18, 4.5),
        new THREE.MeshBasicMaterial({ map: textures.signs[signKey] }),
      );
      // Face the street the point sits on.
      sign.position.set(cx - offX * 0.55, Math.min(h - 2, 9), cz - offZ * 0.55);
      sign.lookAt(px, sign.position.y, pz);
      group.add(sign);
    }
  }
  landmark('garage', -300, 120, 0, 60, 46, 30, 12, 'garage');
  // Shop buildings sit INSIDE the neighbouring block (offset along x), never on a street.
  landmark('sunmart', 120, -60, 42, 0, 30, 22, 10, 'sunmart');
  landmark('noodle', -120, 180, -42, 0, 26, 20, 9, 'noodle');
  landmark('ammo', 240, 180, 42, 0, 28, 22, 10, 'ammo');
  landmark('clinic', -240, -180, -42, 0, 30, 22, 12, 'clinic');
  landmark('station', 300, -60, 30, 0, 30, 30, 14, null);
  // Hideout shelters: a container + a sign, offset into the block so the hideout point stays open.
  for (const [hx, hz, ox, oz] of [[-360, 300, 24, -24], [360, -300, -24, 24]]) {
    const cont = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 5), new THREE.MeshLambertMaterial({ color: 0x2a5a3a }));
    cont.position.set(hx + ox, 2, hz + oz); cont.castShadow = true; group.add(cont);
    buildings.push({ minX: hx + ox - 6, maxX: hx + ox + 6, minZ: hz + oz - 2.5, maxZ: hz + oz + 2.5, h: 4 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: textures.signs.hideout }));
    sign.position.set(hx + ox, 6, hz + oz); sign.lookAt(hx, 6, hz); group.add(sign);
  }

  // Random buildings: 1-3 per block, inside the block, clear of landmarks and points.
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      const dist = districtAt(bx, bz);
      const n = 1 + Math.floor(rng.next() * 3);
      for (let i = 0; i < n; i++) {
        const w = 18 + rng.next() * 26, d = 18 + rng.next() * 26;
        const cx = bx + rng.range(-34, 34), cz = bz + rng.range(-34, 34);
        const box = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
        // Keep clear of streets (18 m), landmarks (6 m buffer) and every named point (12 m).
        const nearStreet = CITY.streets.some((s) => box.minX < s + 18 && box.maxX > s - 18) ||
          CITY.streets.some((s) => box.minZ < s + 18 && box.maxZ > s - 18);
        const nearLandmark = blockBoxes.some((b) => box.minX < b.maxX && box.maxX > b.minX && box.minZ < b.maxZ && box.maxZ > b.minZ);
        const nearPoint = Object.values(CITY.points).some((p) => box.minX < p.x + 12 && box.maxX > p.x - 12 && box.minZ < p.z + 12 && box.maxZ > p.z - 12);
        if (nearStreet || nearLandmark || nearPoint) continue;
        const h = rng.range(dist.height[0], dist.height[1]);
        addBuilding(cx, cz, w, d, h, facadeKeys[dist.name]);
      }
    }
  }

  // Street props: palms and lampposts along sidewalk edges (never on a road).
  const palmMat = new THREE.MeshLambertMaterial({ color: 0x2a6a2a });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x222226, emissive: 0xffd27a, emissiveIntensity: 0.6 });
  for (let i = 0; i < 46; i++) {
    const s = CITY.streets[Math.floor(rng.next() * CITY.streets.length)];
    const along = rng.range(-400, 400);
    const side = rng.chance(0.5) ? -10.5 : 10.5;
    const x = rng.chance(0.5) ? s + side : along;
    const z = rng.chance(0.5) ? along : s + side;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 6, 6), trunkMat);
    trunk.position.set(x, 3, z); group.add(trunk);
    const top = new THREE.Mesh(new THREE.ConeGeometry(3.2, 5, 7), palmMat);
    top.position.set(x, 8, z); group.add(top);
  }
  for (let i = 0; i < 28; i++) {
    const s = CITY.streets[Math.floor(rng.next() * CITY.streets.length)];
    const along = rng.range(-400, 400);
    const side = rng.chance(0.5) ? -9 : 9;
    const x = rng.chance(0.5) ? s + side : along;
    const z = rng.chance(0.5) ? along : s + side;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), lampMat);
    pole.position.set(x, 3.5, z); group.add(pole);
  }

  // Sun coins: spinning gold discs.
  const shards = [];
  const shardGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.25, 16);
  const shardMat = new THREE.MeshLambertMaterial({ color: 0xffd23c, emissive: 0xa07800, emissiveIntensity: 0.7 });
  for (const [sx, sz] of CITY.shards) {
    const mesh = new THREE.Mesh(shardGeo, shardMat);
    mesh.rotation.x = Math.PI / 2; mesh.position.set(sx, 1.4, sz);
    group.add(mesh);
    shards.push({ x: sx, z: sz, mesh, taken: false });
  }

  // Mission beacon: a column of light the missions move around.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 70, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.position.set(0, 35, 0); beacon.visible = false; group.add(beacon);

  function rectDist(px, pz, b) {
    const dx = Math.max(b.minX - px, 0, px - b.maxX);
    const dz = Math.max(b.minZ - pz, 0, pz - b.maxZ);
    return Math.hypot(dx, dz);
  }
  // Segment vs AABB (2D, slab method) for line-of-sight checks.
  function segHitsBox(x1, z1, x2, z2, b) {
    const dx = x2 - x1, dz = z2 - z1;
    let tmin = 0, tmax = 1;
    for (const [p, d, mn, mx] of [[x1, dx, b.minX, b.maxX], [z1, dz, b.minZ, b.maxZ]]) {
      if (Math.abs(d) < 1e-9) { if (p < mn || p > mx) return false; }
      else {
        let t1 = (mn - p) / d, t2 = (mx - p) / d;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) return false;
      }
    }
    return true;
  }

  const city = {
    buildings, shards, beacon, group,
    collides(x, z, r) {
      for (const b of buildings) {
        if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) return b;
      }
      return null;
    },
    // Push a circle out of any building it overlaps; returns true if pushed.
    resolveCircle(pos, r) {
      let pushed = false;
      for (const b of buildings) {
        const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
        const dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          pushed = true;
          if (d2 > 1e-6) {
            const d = Math.sqrt(d2);
            pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r;
          } else {
            // Dead centre: push out along the smallest penetration axis.
            const pl = pos.x - (b.minX - r), pr = (b.maxX + r) - pos.x;
            const pt = pos.z - (b.minZ - r), pb = (b.maxZ + r) - pos.z;
            const m = Math.min(pl, pr, pt, pb);
            if (m === pl) pos.x = b.minX - r; else if (m === pr) pos.x = b.maxX + r;
            else if (m === pt) pos.z = b.minZ - r; else pos.z = b.maxZ + r;
          }
        }
      }
      return pushed;
    },
    clearance(x, z) {
      let m = Infinity;
      for (const b of buildings) m = Math.min(m, rectDist(x, z, b));
      return m;
    },
    losBlocked(x1, z1, x2, z2) {
      for (const b of buildings) if (segHitsBox(x1, z1, x2, z2, b)) return true;
      return false;
    },
    // Every street centreline sampled every 10 m: no building may come within roadHalf.
    roadReport() {
      const bad = [];
      for (const s of CITY.streets) {
        for (let t = -420; t <= 420; t += 10) {
          for (const [x, z] of [[t, s], [s, t]]) {
            for (const b of buildings) {
              if (rectDist(x, z, b) < CITY.roadHalf) bad.push({ x, z, d: rectDist(x, z, b) });
            }
          }
        }
      }
      return bad;
    },
    // Full reachability table: every named point + shard + race checkpoint.
    reachability() {
      const rows = [];
      for (const [name, p] of Object.entries(CITY.points)) rows.push({ name, x: p.x, z: p.z, clearance: this.clearance(p.x, p.z), r: p.r });
      CITY.shards.forEach(([x, z], i) => rows.push({ name: `shard${i}`, x, z, clearance: this.clearance(x, z), r: 4 }));
      CITY.raceRoute.forEach(([x, z], i) => rows.push({ name: `race${i}`, x, z, clearance: this.clearance(x, z), r: 10 }));
      return rows;
    },
  };
  G.city = city;
  return city;
}
