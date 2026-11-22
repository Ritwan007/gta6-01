// main.ts — the hand-in program for LEONIDA AFTER DARK (make.fun gta6-01).
//
// It copies the playable game (game/) and the maker's screenshots
// (screenshots/) from this repository into the output directory, then writes
// the entry dossier with the kit's own buildDossier, so the dossier on disk
// is byte for byte the one the gate rebuilds from the same files.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR names the output directory; inside
// the grader the program writes to /output. Node 22, standard library only.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

// The gate's own caps for this bounty, as the kit's reference states them:
// the dossier text is capped at 160 KiB, screenshots at 4 files of 256 KiB,
// and the game tree at 993 entries, 48 MiB and 1,000-byte paths.
const DOSSIER_CAPS = {
  text_max_bytes: 163_840,
  screenshots: { max: 4, max_bytes: 262_144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1_000,
} as const;

function copyTree(name: string): void {
  // Clear any stale copy first: the program runs twice and both runs must
  // write the same bytes, so nothing from an earlier run may leak through.
  const dest = join(outputDir, name);
  rmSync(dest, { recursive: true, force: true });
  cpSync(join(repoRoot, name), dest, { recursive: true });
}

function verifyHandIn(): void {
  if (!existsSync(join(outputDir, "game", "index.html"))) {
    throw new Error("hand-in is missing game/index.html");
  }
  const shots = readdirSync(join(outputDir, "screenshots")).filter((f) => !f.startsWith("."));
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(`hand-in needs 3 or 4 screenshots, found ${shots.length}`);
  }
}

function handIn(): void {
  mkdirSync(outputDir, { recursive: true });
  copyTree("game");
  copyTree("screenshots");
  verifyHandIn();
  const dossier = buildDossier(outputDir, DOSSIER_CAPS);
  writeFileSync(join(outputDir, "dossier.json"), dossier);
  console.log(`handed in: game/ + screenshots/ + dossier.json (${dossier.length} bytes) -> ${outputDir}`);
}

handIn();
