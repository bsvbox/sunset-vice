// Sunset Vice — dossier entrypoint for make.fun gta6-01 ("Make GTA 6").
// The game lives in game/ beside this file: plain static files a desktop
// browser loads offline (game/index.html plus its ES modules, no library,
// no network request). The screenshots live in screenshots/. This program
// stages both into the output directory and writes dossier.json there with
// the vendored make.fun library, so the judge can read the entry.
// Run it locally with:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath as urlToPath } from 'node:url';
import { buildDossier as makeDossier } from './vendor/makefun-game.ts';

// The repository root is the directory holding this file.
const repoRoot = path.dirname(urlToPath(import.meta.url));

// The grader hands us /output through the environment; local runs use out/.
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps for gta6-01, from the kit's gate: the text budget shapes
// the dossier bytes, the rest refuse an entry the scorer would refuse.
const TEXT_CAP_BYTES = 163840;
const SHOT_CAP_COUNT = 4;
const SHOT_CAP_BYTES = 262144;
const GAME_CAP_FILES = 993;
const GAME_CAP_BYTES = 50331648;
const GAME_CAP_PATH_BYTES = 1000;

// Copy one staged tree, replacing whatever a previous run left behind.
function stageTree(sourceDir, destDir) {
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, destDir, { recursive: true });
}

// The screenshots are optional in the repo but required for a good entry:
// refuse to hand in a dossier with none, instead of a silent empty one.
function stageShots(sourceDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  if (!fs.existsSync(sourceDir)) {
    throw new Error('Sunset Vice: no screenshots/ beside main.ts — take the four shots first');
  }
  const shots = fs.readdirSync(sourceDir).filter((name) => /\.(png|jpe?g)$/i.test(name));
  if (shots.length === 0) {
    throw new Error('Sunset Vice: screenshots/ holds no PNG or JPEG image');
  }
  for (const name of shots) {
    fs.copyFileSync(path.join(sourceDir, name), path.join(destDir, name));
  }
  return shots.length;
}

function buildEntry() {
  const gameDir = path.join(repoRoot, 'game');
  if (!fs.existsSync(path.join(gameDir, 'index.html'))) {
    throw new Error('Sunset Vice: game/index.html is missing — the game is not staged');
  }
  fs.mkdirSync(outDir, { recursive: true });
  stageTree(gameDir, path.join(outDir, 'game'));
  const shotCount = stageShots(path.join(repoRoot, 'screenshots'), path.join(outDir, 'screenshots'));
  const dossier = makeDossier(outDir, {
    text_max_bytes: TEXT_CAP_BYTES,
    screenshots: { max: SHOT_CAP_COUNT, max_bytes: SHOT_CAP_BYTES },
    game_max_files: GAME_CAP_FILES,
    game_max_bytes: GAME_CAP_BYTES,
    game_path_max_bytes: GAME_CAP_PATH_BYTES,
  });
  fs.writeFileSync(path.join(outDir, 'dossier.json'), dossier);
  const staged = fs.readdirSync(path.join(outDir, 'game'), { recursive: true }).length;
  console.log(`Sunset Vice: staged ${staged} game entries and ${shotCount} screenshots, dossier ${dossier.length} bytes -> ${outDir}`);
}

buildEntry();
