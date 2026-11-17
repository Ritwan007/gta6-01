# SOLMAR HEAT — a complete open-world crime game

![make.fun bounty](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/Ritwan007/gta6-01/rank.svg)
![reward](https://make.fun/badge/gta6-01/Ritwan007/gta6-01/reward.svg)

**SOLMAR HEAT** is an open-world crime game set in Solmar Bay, a sun-soaked
coastal city of marinas, boardwalks and neon. You play Dax Mahesa, a broke
ex-courier who owes money all over town. Built for the make.fun competition
[`gta6-01`](https://make.fun/bounty/gta6-01) — "Make GTA 6", $1,666 escrowed,
deadline 2026-11-24. Playable in a desktop browser from static files, no
network requests, keyboard and mouse.

## The city

Solmar Bay is a procedural 3D city (~640×640 m, 8×8 block grid) in five
districts with their own palettes, heights and props: Old Harbor (docks and
warehouses), Neon Mile (downtown strip), The Flats (residential blocks),
Marina Verde (rich waterfront) and Cielo Heights (hill villas). Golden-hour
sun, shadows, billboards and shop signs — all art is original, procedural
canvas textures; all sound is synthesized WebAudio.

## Systems (completeness first — every system below is in the game)

- **On foot and by car** — third-person on-foot controller with orbit camera;
  enter/exit any car with E; arcade driving physics.
- **Traffic** — AI cars in four civilian variants looping the road grid, with
  spacing, brake lights, fleeing and honking.
- **Pedestrians** — sidewalk walkers who flee, cower, or call the police when
  they witness a crime.
- **Cars to steal and drive** — six variants: Comet Sedan, Vantara GT sports
  coupe, Bison Hauler truck, Kuda Van, Zippy 125 motorcycle, SBPD Interceptor.
  Parked cars everywhere; moving traffic can be carjacked.
- **Wanted level + police** — 1–5 heat stars. SBPD Interceptors pursue with
  per-star escalation (ramming from 3★, roadblocks at 4★); break line of sight
  to enter SEARCHING and cool down; spray garage and hideouts clear heat.
- **Missions + story** — a 6-mission chain: steal the Vantara GT, a timed
  delivery, a three-star escape, a CoralMart robbery, a street race, and a
  wave-defense finale against Kaspar Rudi's crew. Intro cards, objective
  markers, timers, cash rewards and unlocks.
- **Combat** — four weapons with distinct feel: fists/tire iron, Venn 9mm
  pistol, Rattler SMG, Breaker 12 shotgun. Ammo, reload, switching, tracers,
  enemy shooters in missions.
- **Crime** — car theft, carjacking, store robbery (hold-up timer), hit-and-run,
  assault, firing in public. Every crime feeds the wanted system.
- **HUD + minimap** — health, cash, heat stars, weapon/ammo, mission objective
  banner, radio feed, live canvas minimap with blips.
- **Start screen + menus** — title (New Game / Continue / How to Play),
  pause menu with full-city map, WASTED and BUSTED cards, ending card.
- **Save** — localStorage: cash, weapons/ammo, mission progress, position,
  current car. Autosave on mission complete; save at the garage.
- **Sound** — 100% synthesized WebAudio: engine, two-tone siren, per-class
  gunshots, thud, cha-ching, mission stings, UI clicks, music loop.
- **Effects** — golden-hour sun + shadows, skid dust, muzzle flashes, damage
  smoke, screen shake.

## Controls

- **WASD** move / drive · **mouse** camera / aim · **E** enter, exit, steal
  car · **F** fire (hold for SMG) · **R** reload · **1–4** switch weapon ·
  **Shift** run / handbrake · **Esc** pause · **M** map.

## Run it

```sh
node serve.ts   # serves game/ on localhost; open http://localhost:8000
```

Or open `game/index.html` through any static server. `main.ts` (Node 22)
copies `game/` + `screenshots/` to `/output` and writes `dossier.json`.

## License

MIT — see `LICENSE`.
