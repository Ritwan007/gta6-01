// VELORA HEAT — the 6-mission story chain: cards, objectives, timers, race,
// wave defence, rewards and unlocks. State is polled every step; no teleports.
import {
  CASA_BIRU, DROP, GARAGE, HIDEOUT, MARINA, MART, MISSIONS, RACE_CPS,
} from './config.js';
import { spawnCar } from './vehicles.js';
import { enterCar, playerCar, refillAmmo } from './player.js';

function d(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
function playerPos(G) {
  const car = playerCar(G);
  return car ? { x: car.x, z: car.z } : { x: G.player.x, z: G.player.z };
}
function gtCar(G) { return G.cars.find((c) => c.mission === 'M1' && c.hp > 0); }
function vanCar(G) { return G.cars.find((c) => c.mission === 'M2' && c.hp > 0); }

export function createMissions(G) {
  const M = G.mission;
  function showCard(title, text, cb) {
    G.showCard(title, text, cb);
  }
  function complete() {
    const def = MISSIONS[M.index];
    G.player.cash += def.reward;
    if (def.unlock) {
      G.player.weapons[def.unlock].unlocked = true;
      G.player.weapons[def.unlock].mag = G.player.weapons[def.unlock].magMax;
      G.player.weapons[def.unlock].reserve = G.player.weapons[def.unlock].reserveMax;
    }
    M.completed[M.index] = true;
    M.active = false;
    G.audio.sting(true);
    G.audio.chaChing();
    G.feed(`Misi selesai! +$${def.reward}`);
    const idx = M.index;
    showCard(`${def.id} Selesai — ${def.title}`, `${def.complete}\nHadiah: $${def.reward}${def.unlock ? ' · Senjata baru terbuka!' : ''}`, () => {
      M.index = idx + 1;
      if (M.index >= 6) {
        G.mode = 'ending';
        G.showEnding();
      }
    });
  }
  function fail(reason) {
    const def = MISSIONS[M.index];
    M.active = false;
    M.step = 0;
    G.wanted = 0; G.searching = false;
    G.audio.siren(false);
    G.audio.sting(false);
    // Clean up mission actors.
    for (const c of G.cars) if (c.driver === 'racer') { c.driver = null; c.parked = true; }
    G.enemies.length = 0;
    G.holdup = null;
    showCard(`${def.id} Gagal — ${def.title}`, `${reason}\nMisi masih tersedia di Bengkel Sari. Coba lagi.`, () => {});
  }
  function startMission(i) {
    const def = MISSIONS[i];
    M.index = i;
    M.active = true;
    M.step = 0;
    M.timer = def.timer;
    M.playerCp = 0;
    M.racerCp = [0, 0];
    showCard(`${def.id} — ${def.title}`, `${def.intro}\n\nTujuan: ${def.brief}${def.timer ? `\nBatas waktu: ${Math.floor(def.timer / 60)}:${String(def.timer % 60).padStart(2, '0')}` : ''}`, () => {
      if (i === 2) {
        G.police.setHeat(3, 'Pengiriman gagal');
        G.feed('VBPD mengepungmu! Kabur ke Gudang Pelabuhan!');
      }
      if (i === 4) {
        G.wanted = 0; G.searching = false; G.audio.siren(false);
        // Lend the player a Falco GT at the garage and put them in it.
        const lent = spawnCar(G, 'gt', GARAGE.x, GARAGE.z, 0, { color: '#d02020' });
        enterCar(G, lent);
        // Two AI racers beside the player.
        const r1 = spawnCar(G, 'gt', GARAGE.x + 14, GARAGE.z + 4, 0, { driver: 'racer', color: '#202020' });
        const r2 = spawnCar(G, 'gt', GARAGE.x + 14, GARAGE.z - 4, 0, { driver: 'racer', color: '#e8a020' });
        r1.racerIdx = 0; r2.racerIdx = 1;
        M.racers = [r1.id, r2.id];
        G.feed('Balapan dimulai! 12 checkpoint — jadilah yang pertama!');
      }
      if (i === 5) {
        refillAmmo(G);
        spawnWave(1);
        G.feed('Pertahankan Bengkel Sari! Gelombang 1 datang!');
      }
      G.audio.click();
    });
  }
  function spawnWave(n) {
    M.wave = n;
    const spots = [
      [-186, -44], [-220, -10], [-254, -44], [-186, -78], [-254, -10], [-186, -10], [-254, -78],
    ];
    const count = [2, 2, 3][n - 1] || 2;
    for (let k = 0; k < count; k++) {
      const s = spots[(n - 1) * 2 + k] || spots[k];
      G.enemies.push({ x: s[0], z: s[1], angle: 0, hp: 45, maxHp: 45, shootCd: 1 + G.rng(), deadT: 0 });
    }
  }
  function update(dt) {
    if (!M.active || G.mode !== 'play') return;
    const p = playerPos(G);
    const car = playerCar(G);
    if (M.timer > 0) {
      M.timer -= dt;
      if (M.timer <= 0) { fail('Waktu habis.'); return; }
    }
    // Hold-up progress (mission M4 or free-roam).
    if (G.holdup) {
      const h = G.holdup;
      if (d(p.x, p.z, h.x, h.z) > 14) {
        G.holdup = null;
        G.feed('Perampokan batal — kau terlalu jauh dari kasir.');
      } else {
        h.t += dt;
        if (h.t >= h.dur) {
          G.holdup = null;
          if (h.freeroam) {
            G.player.cash += 300;
            G.police.setHeat(2, 'Perampokan toko');
            G.feed('Uang kasir di tangan! +$300');
          } else if (M.index === 3 && M.step === 1) {
            M.step = 2;
            G.police.setHeat(2, 'Perampokan PelangiMart');
            G.feed('Uang didapat! Kabur ke Titik Drop!');
          }
        }
      }
    }
    switch (M.index) {
      case 0: {
        const gt = gtCar(G);
        if (M.step === 0 && gt && d(p.x, p.z, gt.x, gt.z) <= 12) { M.step = 1; G.feed('Itu dia Falco GT-nya. Curi! (E)'); }
        if (M.step === 1 && car && car.mission === 'M1') { M.step = 2; G.feed('Bawa GT ke Bengkel Sari!'); }
        if (M.step === 2 && car && d(car.x, car.z, GARAGE.x, GARAGE.z) <= 12) complete();
        break;
      }
      case 1: {
        const van = vanCar(G);
        if (M.step === 0 && van && d(p.x, p.z, van.x, van.z) <= 12) { M.step = 1; G.feed('Itu Aruna Van-nya. Ambil! (E)'); }
        if (M.step === 1 && car && car.mission === 'M2') { M.step = 2; G.feed('Antar paket ke Casa Biru!'); }
        if (M.step === 2 && car && d(car.x, car.z, CASA_BIRU.x, CASA_BIRU.z) <= 12) complete();
        break;
      }
      case 2: {
        if (M.step === 0 && d(p.x, p.z, HIDEOUT.x, HIDEOUT.z) <= HIDEOUT.r) {
          M.step = 1;
          G.feed('Bersembunyi di gudang... jangan keluar sampai panas reda.');
        }
        if (M.step === 1 && G.wanted === 0) complete();
        break;
      }
      case 3: {
        if (M.step === 0 && d(p.x, p.z, MART.x, MART.z) <= 12) {
          M.step = 1;
          G.feed('Todong kasir dengan senjata (E) — jangan pakai tangan kosong!');
        }
        if (M.step === 2 && d(p.x, p.z, DROP.x, DROP.z) <= 12) complete();
        break;
      }
      case 4: {
        if (M.step === 0) {
          // Checkpoint pickup for the player.
          const cp = RACE_CPS[M.playerCp];
          if (cp && d(p.x, p.z, cp[0], cp[1]) <= 9) {
            M.playerCp += 1;
            G.feed(`Checkpoint ${M.playerCp}/12!`);
            G.audio.chaChing();
            if (M.playerCp >= 12) {
              // Player finished first unless a racer already did.
              if (M.racerCp[0] < 12 && M.racerCp[1] < 12) {
                for (const c of G.cars) if (c.driver === 'racer') { c.driver = null; c.parked = true; }
                complete();
              }
              return;
            }
          }
          // Racers advance along the same checkpoints.
          for (const c of G.cars) {
            if (c.driver !== 'racer' || c.hp <= 0) continue;
            const ri = c.racerIdx;
            const cpR = RACE_CPS[M.racerCp[ri]];
            if (cpR && d(c.x, c.z, cpR[0], cpR[1]) <= 9) {
              M.racerCp[ri] += 1;
              if (M.racerCp[ri] >= 12) { fail('Pembalap Damar finis duluan.'); return; }
            }
          }
        }
        break;
      }
      case 5: {
        if (M.step === 0) {
          const alive = G.enemies.filter((e) => e.hp > 0).length;
          if (alive === 0) {
            if (M.wave >= 3) {
              M.step = 1;
              G.feed('Markas aman! Kabur ke Marina Verde!');
            } else {
              spawnWave(M.wave + 1);
              G.feed(`Gelombang ${M.wave} datang!`);
            }
          }
        }
        if (M.step === 1 && d(p.x, p.z, MARINA.x, MARINA.z) <= 12) complete();
        break;
      }
      default: break;
    }
  }
  function objectiveText() {
    if (!M.active) {
      if (M.index >= 6) return 'Velora Bay bebas. Bebas berkeliaran!';
      return `Misi berikutnya: ${MISSIONS[M.index].id} — ${MISSIONS[M.index].title} (datang ke Bengkel Sari, tekan E)`;
    }
    const def = MISSIONS[M.index];
    const steps = [
      ['Pergi ke Falco GT', 'Curi Falco GT (E)', 'Antar GT ke Bengkel Sari'],
      ['Pergi ke Aruna Van', 'Naik Aruna Van (E)', 'Antar paket ke Casa Biru'],
      ['Kabur ke Gudang Pelabuhan', 'Bersembunyi sampai panas reda'],
      ['Pergi ke PelangiMart', 'Rampok kasir (E, senjata keluar)', 'Kabur ke Titik Drop'],
      [`Checkpoint ${M.playerCp}/12 — balapan!`],
      [M.wave ? `Pertahankan markas — Gelombang ${M.wave}` : 'Pertahankan markas', 'Kabur ke Marina Verde'],
    ];
    const list = steps[M.index] || [def.brief];
    const stepText = list[Math.min(M.step, list.length - 1)];
    const timer = M.timer > 0 ? ` · ${Math.ceil(M.timer)} dtk` : '';
    return `${def.id} ${def.title}: ${stepText}${timer}`;
  }
  return { startMission, update, complete, fail, objectiveText, spawnWave };
}
