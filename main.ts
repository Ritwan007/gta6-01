// LEONIDA AFTER DARK — entry program for make.fun's gta6-01 ("Make GTA 6").
// Node 22, standard library only. The game itself is the static site under game/
// (game/index.html plus its ES modules and the vendored three.js build); this
// program hands it in: it copies game/ and screenshots/ to the output directory
// and writes dossier.json there with the kit's buildDossier library, exactly the
// bytes the scorer rebuilds and compares.
//
// Run it the way the grader does (MAKEFUN_OUTPUT_DIR stands in for /output):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play the game locally with:  node serve.ts   →   http://localhost:8080
//
// Before anything is copied, a preflight walks the tree against every limit
// the gate checks (file counts, byte caps, screenshot sizes AND dimensions),
// so a bad tree fails here with a readable reason instead of at grading time.
// After the dossier is written it is read back and verified: valid JSON, the
// screenshots embedded, the source text within its cap. The grader runs this
// program twice and compares bytes, so everything here is read-only checking —
// the hand-in itself is exactly the starter's copy + buildDossier.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's own limits, mirrored here so a bad tree fails loudly at hand-in
// time instead of quietly at grading time.
const GATE = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};
const DOSSIER_MAX_BYTES = 1572864; // 1.5 MiB, the dossier_matches row
const SHOT_LONG_SIDE_MAX = 1280;
const SHOT_SHORT_SIDE_MIN = 480;

/** Count files under a directory and add up their bytes (the game_files row). */
function survey(dir) {
  let files = 0;
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      const sub = survey(path);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += stats.size;
    }
  }
  return { files, bytes };
}

/**
 * Pixel dimensions of a PNG or JPEG from its header bytes alone (the gate's
 * screenshots row cares about the long and short sides). Returns null for
 * anything that is not a whole PNG or JPEG.
 */
function imageSize(path) {
  const head = readFileSync(path).subarray(0, 262144);
  // PNG: 8-byte signature, then the IHDR chunk with big-endian dimensions.
  if (head.length > 24 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) {
    return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
  }
  // JPEG: walk the marker segments until a start-of-frame carries dimensions.
  if (head.length > 4 && head[0] === 0xff && head[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < head.length) {
      if (head[offset] !== 0xff) return null;
      const marker = head[offset + 1];
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        return { width: head.readUInt16BE(offset + 7), height: head.readUInt16BE(offset + 5) };
      }
      if (marker === 0xd9 || marker === 0xda) return null; // image over or data begun: no frame found
      offset += 2 + head.readUInt16BE(offset + 2);
    }
  }
  return null;
}

/** Refuse early, with a readable reason, when the tree cannot pass the gate. */
function preflight(gameDir, shotsDir) {
  const { files, bytes } = survey(gameDir);
  if (files > GATE.game_max_files) throw new Error(`game/ holds ${files} files, over the ${GATE.game_max_files} cap`);
  if (bytes > GATE.game_max_bytes) throw new Error(`game/ is ${bytes} bytes, over the ${GATE.game_max_bytes} cap`);
  if (!existsSync(join(gameDir, 'index.html'))) throw new Error('game/index.html is missing');
  const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((name) => !name.startsWith('.')) : [];
  if (shots.length < 3 || shots.length > GATE.screenshots.max) {
    throw new Error(`screenshots/ holds ${shots.length} images; the gate wants 3 or 4`);
  }
  for (const name of shots) {
    const path = join(shotsDir, name);
    const size = statSync(path).size;
    if (size > GATE.screenshots.max_bytes) throw new Error(`screenshots/${name} is ${size} bytes, over the 256 KiB cap`);
    const dims = imageSize(path);
    if (!dims) throw new Error(`screenshots/${name} is not a whole PNG or JPEG`);
    const longSide = Math.max(dims.width, dims.height);
    const shortSide = Math.min(dims.width, dims.height);
    if (longSide > SHOT_LONG_SIDE_MAX) throw new Error(`screenshots/${name} is ${dims.width}x${dims.height}, long side over ${SHOT_LONG_SIDE_MAX}`);
    if (shortSide < SHOT_SHORT_SIDE_MIN) throw new Error(`screenshots/${name} is ${dims.width}x${dims.height}, short side under ${SHOT_SHORT_SIDE_MIN}`);
  }
  return { files, bytes, shots: shots.length };
}

/**
 * Read the finished dossier back and prove it is the hand-in the gate wants:
 * valid JSON under its byte cap, one embedded image per screenshot (each with
 * its bytes and hash), and the source text — index.html first — within the
 * dossier text cap.
 */
function verifyDossier(dossierPath, expectedShots) {
  const raw = readFileSync(dossierPath, 'utf8');
  if (Buffer.byteLength(raw) > DOSSIER_MAX_BYTES) {
    throw new Error(`dossier.json is ${Buffer.byteLength(raw)} bytes, over the 1.5 MiB cap`);
  }
  const dossier = JSON.parse(raw);
  if (!Array.isArray(dossier.images) || dossier.images.length !== expectedShots) {
    throw new Error(`dossier.json embeds ${dossier.images?.length ?? 0} screenshots, expected ${expectedShots}`);
  }
  for (const image of dossier.images) {
    if (!image.base64 || !image.sha256) throw new Error(`dossier.json image ${image.name ?? '?'} lacks bytes or hash`);
  }
  if (typeof dossier.text !== 'string' || !dossier.text.includes('index.html')) {
    throw new Error('dossier.json does not describe the game (no index.html in its text)');
  }
  if (Buffer.byteLength(dossier.text) > GATE.text_max_bytes) {
    throw new Error(`dossier text is ${Buffer.byteLength(dossier.text)} bytes, over the ${GATE.text_max_bytes} cap`);
  }
  return { bytes: Buffer.byteLength(raw), embedded: dossier.images.length, textBytes: Buffer.byteLength(dossier.text) };
}

const summary = preflight(join(here, 'game'), join(here, 'screenshots'));

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

writeFileSync(join(out, 'dossier.json'), buildDossier(out, GATE));
const proof = verifyDossier(join(out, 'dossier.json'), summary.shots);

console.log(
  `Leonida After Dark handed in: ${summary.files} game files (${summary.bytes} bytes), ${summary.shots} screenshots, dossier verified (${proof.bytes} bytes, ${proof.embedded} images embedded, source text ${proof.textBytes} bytes) at ${join(out, 'dossier.json')}`,
);
