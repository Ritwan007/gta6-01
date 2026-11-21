# Leonida After Dark

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ritwan007/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ritwan007/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game for the browser, in the spirit of a neon-soaked
coastal city at night. You are **Nico Vega**, a getaway driver in **Port Meridian**,
a fictional city on Serena Bay. Fixer **Madame Zara** has nine jobs for you tonight —
deliveries, tails, repo work and one dawn run — and the Cielo family wants its money
by sunrise. Explore the city on foot or by car, steal rides, dodge or outrun the
Meridian PD, and work the whole story in one sitting.

Everything is original: the city, characters, vehicles, names, story, art and
sounds are this project's own. The game is plain static files — no build step, no
network requests — with three.js vendored under `game/vendor/`.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. To hand the entry in the way
the grader does: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

## Controls

- **W A S D / arrows** — walk, or drive the car you are in
- **Mouse drag** — orbit the camera · **wheel** — zoom
- **E** — enter / exit the nearest car
- **Space** — handbrake in a car, shove on foot
- **Shift** — sprint on foot
- **M** — big map · **P / Esc** — pause

## What's in the world

- A full city grid on a bay: avenues, Ocean Drive, a marina dockyard, a casino,
  the Palms Royale hotel and a lighthouse pier — lit for a neon night.
- Traffic that drives the grid, pedestrians on the sidewalks, parked cars to take.
- A wanted system: reckless driving, collisions, shoves and certain jobs raise
  your stars; Meridian PD cruisers hunt you, and standing still in their reach
  fills the bust meter. Break line of sight and the heat cools.
- Nine story missions with checkpoints, timers, pickups, a tail, a repo, two
  escapes and a six-gate dawn finale, plus free roam after the story.
- A HUD with cash, wanted stars, objective marker with distance, speedometer and
  a live minimap. Progress saves to your browser (cash, story position).

## Honest limitations

- Arcade physics, not a simulation: cars slide, spin and recover generously.
- Sound is small WebAudio synthesis (engine, sirens, chimes, an ambient pad) —
  there are no audio files and no music track.
- The city is one island district, not a county; the map is the whole world.

---

<sub>Entered on [make.fun](https://make.fun/?ref=7pp9vww4&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
