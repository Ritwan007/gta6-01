// VELORA HEAT — gta6-01 entry (Node 22, standard library only): the game is this
// directory's game/ folder, plain static files a desktop browser loads offline
// (game/index.html and its ES modules, no library and no network request), and the
// program hands it in. It copies game/ and screenshots/ from beside this file to
// /output and writes /output/dossier.json, the summary the judge reads, with the
// vendored make.fun library. VELORA HEAT is a top-down 2D open-world crime game
// in Velora Bay: Reno Karsa works jobs for Sari Lestari across a 6-mission story
// chain (steal the Falco GT, deliver cargo, escape a 3-star manhunt, rob
// PelangiMart, win a 12-checkpoint street race, defend the garage), with traffic
// AI, pedestrians, a 1-5 star wanted system with VBPD pursuit, 4 weapons,
// garage car storage, localStorage saves, synth WebAudio and a live minimap.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Determinism: the copy is a plain tree copy and buildDossier is deterministic,
// so running this file twice over the same tree writes byte-identical output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
