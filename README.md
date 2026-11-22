# LEONIDA AFTER DARK

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ritwan007/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ritwan007/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game for the desktop browser, set in the neon
coastal city of **Port Meridian, Leonida** — a full street grid, an Ocean
Drive beachfront, the Palms Royale hotel, Casino Cielo, a working dockyard
and a lighthouse pier, all of it lit for the night and packed with traffic,
pedestrians and street detail.

You play **Jax Marlowe**, a wheelman who owes **$25,000** to Venn Loans.
Work the city's fixers through **9 missions** — deliveries, pickups, package
runs, a checkpoint dash and a final impound break-in — earn more than the
debt, and pay it off before the interest eats you. Steal cars, outrun the
Port Meridian PD's wanted system, and mind the bust meter: if a cruiser pins
you, you pay.

## Play

Serve the `game/` folder with any static file server and open `index.html`
in desktop Chrome. No build step, no network: everything the game loads is
in this repository (three.js is vendored under `game/vendor/`).

- **W A S D / arrows** — walk or drive
- **Mouse** — orbit the camera (drag), wheel zooms
- **E** — enter / exit a car, talk to a mission marker
- **Shift** — sprint on foot / boost in a car
- **Space** — shove (on foot)
- **M** — big map, **Esc** — pause

Progress (cash, missions cleared, debt) is saved in `localStorage`.

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` with the kit's `buildDossier`.
- `game/index.html` — the page, start screen, HUD and minimap.
- `game/src/` — the game itself, one job per file: `world.js` builds Port
  Meridian, `vehicles.js` makes and drives the cars, `people.js` walks the
  crowds, `police.js` runs the wanted system, `missions.js` and `logic.js`
  carry the story and its rules, `player.js` moves Jax, `hud.js` draws the
  interface, `audio.js` synthesises the city's sounds, `main.js` ties it
  together.
- `tests/` — a Node suite for the pure game logic (missions, economy,
  wanted levels, saving).

## Testing

The game's rules live in `game/src/logic.js` with no browser dependencies,
and are covered by a headless suite:

    node --test tests/logic.test.mjs

The rest is verified by playing it: serve `game/`, click NEW GAME, steal a
car on Ocean Drive and run the gold markers. The hand-in itself can be
dry-run outside the grader with:

    mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

which writes `out/game`, `out/screenshots` and `out/dossier.json`.

## License

MIT — see `LICENSE`.
