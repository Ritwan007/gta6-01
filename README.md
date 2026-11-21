# VELORA HEAT — Velora Bay

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/Ritwan007/gta6-01/rank.svg)
![reward](https://make.fun/badge/gta6-01/Ritwan007/gta6-01/reward.svg)

A top-down 2D open-world crime game for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01) — "Make GTA 6". Original IP: nothing from Rockstar/GTA. Plain canvas 2D + synthesized WebAudio, no assets, no network, runs offline from `game/index.html`.

## The game

**Velora Bay** — a sun-soaked coastal city of 5 districts (Old Pier, Neon Row, The Terraces, Marina Azul, Crown Hill). **Reno Karsa**, a broke ex-courier, owes **Damar Wibowo** ("the Pier King") for a lost delivery. Fixer **Sari Lestari** gives him work at **Lestari Motors** — job by job — until Damar comes for the garage itself.

## Systems (all playable, all wired together)

- **Explorable city on foot + by car** — 7×7-block grid, sidewalks, 5 districts with distinct palettes
- **Traffic** — 14 AI cars in 5 civilian variants looping the street grid, with spacing and brake behaviour
- **Pedestrians** — 30 walkers with walk / flee / cower / call-police states; witnesses phone in crimes
- **Cars to steal and drive** — 6 variants (Lumba Sedan, Falco GT, Banteng Hauler, Aruna Van, Lebah 125 bike, VBPD Interceptor), each with distinct handling; E to steal, stealing the station Interceptor is instant 3★
- **Wanted 1–5 + VBPD response** — Interceptor pursuit with per-star escalation, foot officers, BUSTED on foot, SEARCHING cool-down after 6 s unseen, heat clears after 8 s more (half in hideouts), spray garage ($300) and 2 hideouts
- **6-mission story chain** — M1 steal the Falco GT · M2 hot cargo delivery · M3 three-star escape · M4 PelangiMart robbery · M5 12-checkpoint street race vs 2 AI racers · M6 wave-defence finale + marina getaway + ending card
- **Combat** — 4 weapons (fists, Lestari 9 pistol, Tawon SMG, Guntur 12 shotgun) with ammo, reload, switching, tracers, muzzle flash, enemy shooters
- **Crime that feeds wanted** — car theft, carjacking, store robbery, hit-and-run, assault, firing in public; every crime needs a witness (or a nearby officer) to land heat
- **HUD + minimap** — health, cash, heat stars, weapon/ammo, speed, objective banner, message/radio feed, live canvas minimap with blips, full-city map (M)
- **Start screen + menus** — title (New Game / Continue / How to Play / Credits), pause menu, mission cards, WASTED / BUSTED screens, ending card
- **Save** — localStorage: cash, weapons/ammo, mission progress, position, and garage vehicles as full records that respawn exactly after a reload
- **Sound** — 100% synthesized WebAudio: engine by speed, two-tone siren, per-class gunshots, cha-ching, mission stings, music loop
- **Polish** — golden-hour shadows, dust/smoke, muzzle flash, screen shake, sun coins (+$25) to collect

## Controls

WASD move / drive · Shift sprint · E enter / steal / interact · Mouse aim · Click fire · R reload · 1–4 switch weapon · M city map · Esc pause · Space handbrake.

## Play it

```sh
node serve.ts   # then open http://localhost:8080
```

## Files

- `game/index.html` — page, HUD/menu DOM
- `game/style.css` — HUD, menus, map styling
- `game/src/config.js` — all data tables (city geometry, vehicles, weapons, missions)
- `game/src/city.js` — city generation, collision, line-of-sight, reachability
- `game/src/vehicles.js` — vehicle factory, arcade physics, traffic AI, pursuit
- `game/src/pedestrians.js` — pedestrian states + witness calls
- `game/src/player.js` — on-foot controller + the E-key interact priority
- `game/src/weapons.js` — combat, tracers, enemy shooters
- `game/src/police.js` — wanted/heat state machine
- `game/src/missions.js` — the 6-mission chain
- `game/src/hud.js` — HUD, minimap, full-city map, cards, shop
- `game/src/save.js` — localStorage save / Continue
- `game/src/audio.js` — synthesized WebAudio
- `game/src/main.js` — boot, fixed-step loop, top-down renderer, screens
- `game/src/shots.js` — `?shot=` staged screenshot scenes

## Honest limits

- Top-down 2D by design (the brief's completeness bar, not a 3D showcase).
- Finalist humans play the game in desktop Chrome; it is play-tested end-to-end (M1–M6) by an automated driver before every submit — see the round handoff in the working notes.
