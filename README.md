# VELORA HEAT

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/Ritwan007/gta6-01/rank.svg)
![reward](https://make.fun/badge/gta6-01/Ritwan007/gta6-01/reward.svg)

**VELORA HEAT** — a top-down 2D open-world crime game in Velora Bay, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01) ("Make GTA 6", $1,666 escrowed).

You are **Reno Karsa**, a broke ex-courier who owes money all over town. **Sari Lestari**
of Bengkel Sari gives you work to pay it off, job by job, until **Damar Wibowo** — the
Harbor King — comes for the garage itself. Explore the city on foot and by car, steal
what you need, outrun the **VBPD**, and finish the job.

## What is in the game

- **Explorable city** — Velora Bay, a 704×704 m top-down city on an 8×8 street grid across
  4 districts (Pelabuhan Lama, Neon Mile, The Flats, Marina Verde), with procedural
  buildings, shops, a garage lot, a harbor hideout and the Marina Verde waterfront.
- **On foot and by car** — walk/run anywhere, enter any car with E, steal parked cars and
  carjack traffic. 6 vehicle types with distinct handling: Lumba Sedan, Falco GT,
  Aruna Van, Bison Hauler, Zippy 125 motorcycle, VBPD Interceptor.
- **Traffic AI** — civilian cars loop the street grid, keep their lane, brake for
  obstacles and overtake parked cars.
- **Pedestrians** — sidewalk walkers who flee from guns and crashes, cower, and call the
  police when they witness a crime.
- **Wanted level 1–5** — every crime feeds one heat system: theft, carjacking, robbery,
  assault, hit-and-run, firing in public. VBPD Interceptors pursue, ram at 3★+,
  and bust you on foot. Break line of sight to enter SEARCHING and cool down;
  hide in the harbor warehouse or wait it out.
- **6-mission story chain** — M1 Roda Pertama (steal the Falco GT), M2 Kargo Panas
  (timed van delivery), M3 Lari Tiga Bintang (escape a 3★ manhunt), M4 Kasir Pelangi
  (rob PelangiMart), M5 Balap Neon Mile (12-checkpoint street race vs 2 AI racers),
  M6 Raja Pelabuhan (defend the garage in 3 waves, then the getaway) — with intro and
  complete cards, timers, cash rewards and weapon unlocks, ending in a finale card.
- **Combat** — 4 weapons with distinct feel: fists, Lestari 9 pistol, Tawon SMG,
  Breaker 12 shotgun. Ammo, reload, tracers, muzzle flash, enemy shooters in M6.
- **Crime systems** — car theft, carjacking, store robbery with an 8-second hold-up,
  hit-and-run, assault — all wired into the wanted system.
- **HUD + minimap** — health, cash, heat stars, weapon/ammo, mission objective banner,
  radio feed, live canvas minimap with blips; full-city map screen (M).
- **Menus + save** — title screen (New Game / Continue / How to Play), pause menu
  (Resume / Save / Cancel Mission / Quit), WASTED and BUSTED screens, ending card,
  localStorage save with garage car storage that survives reload.
- **Sound** — 100% synthesised WebAudio: engine pitch, two-tone siren, per-weapon
  gunshots, mission stings, UI clicks and a title-screen bass loop. No audio files.
- **Effects** — damage smoke, screen-space tracers, muzzle flashes, police light bars,
  objective beacons, day-glow district labels.

## How to play

WASD walk/drive · Shift run · mouse aim · click fire · E interact · 1–4 weapons ·
R reload · M map · Esc pause · Space brake. Steal the red Falco GT, deliver it to
Bengkel Sari, and follow the gold markers.

## Tech

Pure top-down 2D canvas, ES modules, zero dependencies, zero network requests, zero
external assets — every texture is procedural and every sound is synthesised.
Play locally with `node serve.ts` and open http://localhost:8080.
