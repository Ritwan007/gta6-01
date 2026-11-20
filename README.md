# SUNSET HEIST: CALDERA BAY

![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/Ritwan007/gta6-01/rank.svg)
![reward](https://make.fun/badge/gta6-01/Ritwan007/gta6-01/reward.svg)

An open-world crime game for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01) — "Make GTA 6".
All original: our own city, characters, vehicles, names, story, art and sound. Nothing from Rockstar Games
or any other commercial game.

## The game

Milo Voss owes Viktor Hale for a delivery that never arrived. Ivy Sorren is giving him work, job by job,
to pay it off — before Hale comes for the garage itself. Explore **Caldera Bay**, a sun-soaked coastal
city of five districts (Old Pier, Neon Row, The Terraces, Marina Sol, Crown Hill), on foot and by car.

**Systems (all playable, all wired together):**
- Explorable city on foot and by car — third-person on-foot controller, arcade driving, mouse-drag camera
- Traffic (14 AI cars in 5 civilian variants) and 36 pedestrians with flee / cower / call-police states
- Steal and drive 6 vehicle kinds: Falcon S sedan, Tempest GT sports car, Rhino Hauler truck, Mule Van, Wasp 125 bike, CBPD Pursuit
- Wanted level, 1–5 heat stars: Interceptor pursuit with per-star escalation, foot officers, BUSTED on foot, SEARCHING cool-down by line of sight, spray garage ($300) and two hideouts to lose the heat
- 6-mission story chain with timers, rewards and unlocks: steal a GT, hot cargo, a 3-star escape, a store robbery, a checkpoint race vs 2 AI rivals, and a wave-defence finale
- Playable crime: car theft, carjacking, store robbery, hit-and-run, assault, firing in public — every crime feeds the wanted system
- Combat: 4 weapons (fists & tire iron, Sorren 9 pistol, Hornet SMG, Thunder 12 shotgun) with ammo, reload, switching, tracers, muzzle flash and enemy shooters
- HUD with health, cash, heat stars, weapon/ammo, speed, objective banner and a live minimap; full-city map (M), pause menu, title screen, WASTED/BUSTED screens, ending card
- Save / Continue (localStorage): cash, weapons, mission progress, position, and garage-owned vehicles respawn exactly after a reload
- 12 collectible sun coins (+$25 each), 4 shops (SunMart robbery, Noodle House, Ammo Depot, Casa Palma clinic), garage vehicle storage
- Synthesised WebAudio only: engine by speed, two-tone siren, per-class gunshots, cha-ching, mission stings and a music loop — no audio files

## Controls

WASD move / drive · Shift sprint · Space jump / handbrake · E enter car, steal, interact · mouse drag look · click fire · 1–4 weapons · R reload · M map · Esc pause

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Static files under `game/` — no build step, no network. Screenshots in `screenshots/` are real renders
of the game's own code (`?shot=cover|foot|chase|combat&seed=1` stages each scene deterministically).

## How it was verified

- Real start-flow play-test in headless Chromium with real clicks and keys: boot → title →
  New Game → walk, sprint, jump → steal a car → drive across the city → steal the mission GT →
  deliver it to Sorren Motors (M1 completes, +$600) → store a car in the garage → save → reload →
  Continue (cash, position and the stored car restore exactly) → map (M opens and closes, Esc closes) →
  pause and resume → fire the pistol → steal a police Interceptor (3 stars) → escape and lose the heat.
- Static reachability check over every mission / garage / shop / shard / spawn point: each sits outside
  every building with at least 3 m clearance.
- `main.ts` run twice produces a byte-identical dossier; the game boots with zero console errors.

## Entry

`main.ts` (Node 22, stdlib only) copies `game/` + `screenshots/` to `/output` and writes
`/output/dossier.json` with the vendored make.fun library. Run it twice to check determinism:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Limits, stated honestly

- No day/night cycle and no weather: the whole game is fixed golden hour, by design.
- No upgrade tracks and no mission select: progression is the 6-mission chain plus free-roam crime.
- The race rivals advance on a fixed pace rather than driving the route.
