# VELORA HEAT — Make GTA 6 (gta6-01)

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/Ritwan007/gta6-01/rank.svg)
![reward](https://make.fun/badge/gta6-01/Ritwan007/gta6-01/reward.svg)

Entry for the [gta6-01 bounty](https://make.fun/bounty/gta6-01) — a complete top-down 2D open-world crime game set in Velora Bay, built from scratch in plain canvas 2D with zero external assets and zero network requests.

## The game

Reno Karsa owes Damar Wibowo big. Sari Lestari, who runs Karsa Auto Works, gives him work — six missions that pay the debt off, job by job, until Damar comes for the garage itself.

- **Explorable city, on foot and by car** — Velora Bay: 8×8 street grid, 7×7 blocks, 8 named landmark buildings (Karsa Auto Works, PelangiMart, Casa Biru, VBPD HQ, Noodle Bahari, Ammo Depot, Hotel Marina, Dermaga), palms, marina water, golden-hour light.
- **Traffic** — AI cars in 6 variants loop the grid, keep their lane, brake for cars ahead and overtake parked cars.
- **Pedestrians** — sidewalk walkers who flee gunfire and fast cars, cower, and call the VBPD when they witness a crime.
- **Cars to steal and drive** — 6 variants with distinct handling (Lumba Sedan, Falco GT, Bison Hauler, Kuda Van, Zippy 125, VBPD Interceptor). Press E near any car to take it; stealing a parked car in sight of a witness raises heat.
- **Wanted 1–5 + police response** — VBPD Interceptors pursue, ram at 3★+, foot officers close in on foot. Break line of sight to enter SEARCHING, then lose the heat; hide at the Dermaga hideout or pay $300 for a spray job at the garage.
- **6-mission story chain** — M1 steal the Falco GT, M2 van delivery, M3 three-star escape, M4 PelangiMart hold-up, M5 12-checkpoint street race vs 2 AI drivers, M6 three-wave garage defence + marina getaway + ending card.
- **Combat** — 4 weapons (Fists, Lestari 9 pistol, Tawon SMG, Badak 12 shotgun) with distinct damage, rate, spread and reload; tracers, muzzle flash, screen shake; mission enemies shoot back.
- **Crime systems** — car theft, carjacking, store robbery (8 s hold-up), hit-and-run, assault, firing in public — every crime feeds the wanted system.
- **HUD + minimap** — health, cash, heat stars, weapon + ammo, mission objective banner, context prompt, message feed, live canvas minimap with blips; full-city map on M.
- **Menus + save** — title (New Game / Continue / How to Play), pause (Resume / Save / Restart Mission / Quit), WASTED and BUSTED cards, ending card, localStorage save that keeps cash, weapons, mission progress and stored garage cars (they respawn at their slots after a reload).
- **Sound** — 100% synthesized WebAudio: engine hum, two-tone siren, per-weapon gunshots, thuds, cha-ching, mission stings, ambient bass loop. No audio files.
- **Polish** — building shadows, car headlights, police light bars, damage smoke, screen shake, golden-hour vignette, procedural everything.

## Controls

WASD move / drive · Mouse aim · Click fire · E interact / steal / store / start mission · R reload · 1–4 switch weapon · M map · Esc pause · Shift run · Space brake.

## Play it

Serve locally with `node serve.ts` and open http://localhost:8080. No build step, no network.
