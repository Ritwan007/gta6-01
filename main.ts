// SUNSET HEIST: CALDERA BAY — gta6-01 entry (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop browser
// loads offline (game/index.html and its ES modules, three.js vendored as a minified
// file under game/vendor/, no network request anywhere). This program hands it in:
// it copies game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun
// library. It refuses a handoff with the wrong number of screenshots or any
// screenshot over the gate's 256 KiB cap, so a bad bundle never reaches the server.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Gate the screenshots before anything is copied: exactly 4, each a whole JPEG/PNG
// of at most 256 KiB. A bundle with 3 or 5 shots, or one oversize file, is refused
// here — the scorer would refuse it anyway, and a refused submit burns nothing.
const shotsDir = join(here, 'screenshots');
const shotNames = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((n) => !n.startsWith('.')).sort()
  : [];
if (shotNames.length !== 4) {
  throw new Error(`SUNSET HEIST: expected exactly 4 screenshots, found ${shotNames.length} (${shotNames.join(', ')})`);
}
for (const name of shotNames) {
  const size = statSync(join(shotsDir, name)).size;
  if (size > 262144) throw new Error(`SUNSET HEIST: screenshot ${name} is ${size} bytes, over the 256 KiB cap`);
}

// Same for the game's entry page: it must exist and stay under the gate's 1 MiB.
const indexPath = join(here, 'game', 'index.html');
if (!existsSync(indexPath)) throw new Error('SUNSET HEIST: game/index.html is missing');
if (statSync(indexPath).size > 1048576) throw new Error('SUNSET HEIST: game/index.html is over the 1 MiB cap');

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

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
