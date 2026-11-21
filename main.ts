// VELORA HEAT — the gta6-01 entry handoff (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop browser
// loads offline (game/index.html and its ES modules, no library, no network
// request). This program copies game/ and screenshots/ from beside this file to
// /output and writes /output/dossier.json, the summary the judge reads, with the
// vendored make.fun library. The game itself is VELORA HEAT: a top-down 2D
// open-world crime game in Velora Bay — explore on foot and by car, steal cars,
// outrun the VBPD heat system, run a 6-mission story chain, fight with 4 weapons,
// rob shops, save at the garage. All art is procedural canvas, all sound is
// synthesized WebAudio.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Determinism: the handoff writes no timestamps or randomness, so running it
// twice over the same tree produces byte-identical output (verified in the
// round-14 play-test: dossier.json sha256 compared across two runs).

import { cpSync, existsSync, mkdirSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const entryHtml = join(here, 'game', 'index.html');
if (!existsSync(entryHtml)) {
  throw new Error('VELORA HEAT entry point is missing: game/index.html not found — refusing to hand in an empty game.');
}

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

// VELORA HEAT handoff note (authored for this entry): report the handed-in size
// so a local run can be eyeballed against the caps without opening the dossier.
const dossierBytes = statSync(join(out, 'dossier.json')).size;
const shotCount = existsSync(join(here, 'screenshots'))
  ? readdirSync(join(here, 'screenshots')).filter((f) => /\.(jpe?g|png)$/i.test(f)).length
  : 0;
console.log(`VELORA HEAT handed in: dossier.json ${dossierBytes} bytes (cap 1572864), ${shotCount} screenshot(s) (cap 4).`);
