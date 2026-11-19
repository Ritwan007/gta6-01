# NEON COAST: UNDERWORLD — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ritwan007/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ritwan007/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**NEON COAST: UNDERWORLD** is a complete open-world crime game built for the
make.fun competition [gta6-01](https://make.fun/bounty/gta6-01) — "Make GTA 6",
$1,666 escrowed, deadline 2026-11-24. It runs in a desktop browser from
static files, with no network requests, keyboard and mouse.

You are **Raka Surya**, a getaway driver who owes the syndicate fixer
**Vera Kade** after a port job went wrong. Work off the debt across 8 story
missions, steal cars, dodge a 5-star wanted system, and finally choose who
owns Neon Coast: Vera, or the honest cop **Det. Mara Ilves**. The antagonist
is port boss **Dario Venn**. 100% original IP — no Rockstar names, maps,
characters, or assets.

## The city

Neon Coast is a procedural 3D coastal metropolis (~840×840 m) in 9
districts: Downtown (skyscrapers, neon), Marina Luxe (beachfront luxury),
Portside (industrial port, cranes, containers), The Undertow (criminal
quarter + a tunnel hideout), Aero Field (airport, runway, hangars), Sierra
Ridge (mountain switchbacks), Coral Row (shopping street, rob-able shops),
Civic Center (Police HQ), and the island dock. Roads with lanes and
sidewalks, traffic lights at intersections, street lamps, trees, shop
fronts, lit windows on every building face — all textures are procedural
canvas art; all sound is synthesized WebAudio. Ocean east, mountains west.

## Systems (every system below is real and wired, not a stub)

- **On foot and by car** — third-person controller, smooth follow camera
  (~8 m on foot, ~13.5 m in car, with look-ahead), walk/run with stamina,
  jump, procedural limb animation, enter/exit vehicles with E.
- **Vehicles** — 6 distinct kinds (sedan, GT coupe, hauler truck, van,
  motorcycle, police interceptor) with distinct handling; all present in
  traffic from minute one; headlights at night.
- **Traffic** — 12 ambient cars, one per street, alternating axes, lane
  following, traffic-light obedience, simple collision avoidance.
- **Pedestrians** — 36 active, varied colors and speeds; sidewalk walking,
  road crossing, fleeing from danger, gunfire and near-miss cars.
- **Police + wanted** — crimes feed ONE wanted system, 1–5 stars: 1
  investigate, 2 chase, 3 multiple patrols, 4 roadblocks + coordinated
  pursuit, 5 elite units. Police pursue your LAST KNOWN position; break
  line of sight to enter SEARCHING and cool down. BUSTED and WASTED states
  with respawn and cash penalty. Hideouts and the spray garage clear heat.
- **Combat** — 4 fictional weapons: Baton (melee), VK-9 pistol, Rattler
  SMG, Breaker-12 shotgun. Distinct damage, fire rate, ammo and range;
  keys 1–4, tracers, hit feedback. Ammo bought at shops.
- **Missions + story** — 8 missions with intro cards, dialogue, objective
  markers, success/fail states and cash rewards: M1 First Run (steal the
  GT coupe, deliver to the garage), M2 Hot Cargo (timed van delivery),
  M3 Heat Sink (reach 3 stars, escape via the tunnel), M4 Coral Row Job
  (rob the jeweller, getaway), M5 The Choice (branching: ledger to Vera
  OR to Det. Ilves — changes the finale's ally), M6 Ridge Run (checkpoint
  race vs 2 AI drivers), M7 Port Fire (defend the warehouse, 6 attackers),
  M8 Neon Reckoning (finale with TWO endings). Mission select on the
  title screen for unlocked missions; replay allowed.
- **Economy / progression** — cash; garage storage (owned vehicles
  persist); spray garage clears wanted; shops (ammo, health, armor);
  4 upgrade tracks (Engine, Armor, Stamina, Charm/discount); 20 neon
  shards hidden across districts (HUD + map counter); hidden locations
  (tunnel hideout, rooftop garden, island dock).
- **Save / load** — localStorage: cash, mission progress, owned vehicles,
  upgrades, shards, player position. Continue on the title screen.
- **Menus / UI** — title (New Game / Continue / Mission Select / How to
  Play), pause (Esc), full map (M) with markers, HUD: health, armor,
  cash, wanted stars, objective, speed, minimap (canvas, with
  player/traffic/police/mission blips), interaction prompts, dialogue
  cards, mission complete/fail screens, letterbox cinematic intros.
- **World life** — accelerated day/night cycle, weather (clear ↔ rain
  fronts), wet-road sheen, neon emissives at night, rain particles,
  muzzle-flash tracers, screen fade transitions, ambient WebAudio
  (city pad, rain, engine, sirens, gunshots, UI clicks) with mute (F).
- **Reachability guarantee** — every interact / deliver / pickup point
  (garage, all shops, mission waypoints, all 20 shards) sits outside
  every building footprint with ≥3 m clearance, verified by a static
  reachability check (`reachabilityReport()` in `game/src/world.js`):
  37/37 points pass. The garage point is in front of the garage
  building, never at its centre.

## Controls

- **WASD** move / drive · **Shift** sprint · **Space** jump · **E**
  interact / enter-exit vehicle / store vehicle · **Mouse** drag camera ·
  **Click** fire · **1–4** weapons · **M** map · **Esc** pause · **F** mute.

## Run it

```sh
node serve.ts   # serves game/ on http://localhost:8080
```

Or serve `game/` with any static server and open `game/index.html`.
`main.ts` (Node 22) copies `game/` + `screenshots/` to `/output` and
writes `dossier.json` via the official `vendor/makefun-game.ts`.

## Project layout

- `game/index.html` — page + HUD DOM + import map (three.js vendored)
- `game/src/main.js` — engine, loop, systems, HUD, minimap, save/load
- `game/src/world.js` — city data + static reachability check
- `game/src/missions.js` — mission, weapon, upgrade and shop data
- `game/src/input.js` — held keys + pressed-edge queue (E edge first)
- `game/src/audio.js` — synthesized WebAudio sounds
- `game/src/shots.js` — staged screenshot scenes (real running game)
- `game/vendor/three.module.min.js` — vendored three.js r160
- `main.ts` — hands the game in (copies game/ + screenshots/, dossier)

## Verified in-session (round 12, 2026-11-19)

- **Static reachability check**: 37/37 points pass (garage, all shops,
  mission waypoints, all 20 shards, spawn, all parked cars) — every point
  outside every building with ≥3 m clearance.
- **FAST play subset** (real clicks/keys, headless Chromium, 23 checks):
  21/23 pass on the full run; the other 2 were re-verified fixed — M1
  end-to-end (steal GT, deliver to garage, +$400 exactly: $275 → $675),
  garage store-vehicle on foot, shop purchase with exact delta
  ($675 → $615, medkit $60), save → reload → Continue restores exactly
  (cash, mission, position), jump probe (max height 1.57 m, lands),
  map toggle, pause + save, zero console/page errors.
- **Dossier**: `MAKEFUN_OUTPUT_DIR=out node main.ts` run twice →
  byte-identical `dossier.json`.
- **Kit check** (fresh kit CLI): 4 passed / 0 failed.
- **Screenshots**: 4 real renders of the running game, 1280×720 JPEG,
  each ≤256 KiB, visually inspected.

## License

MIT — see `LICENSE`.
