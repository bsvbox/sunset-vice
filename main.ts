// Sunset Vice — the dossier entrypoint for the make.fun gta6-01 bounty.
// The game is plain static files under game/ beside this file, and the four
// screenshots sit in screenshots/. This program copies both trees into the
// output directory the grader hands over, then asks the vendored make.fun
// library to summarise them as dossier.json, which is what the judge reads.
//
// Run it outside the grader with the output directory in the environment:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader the same variable points at /output instead.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath as urlToPath } from 'node:url';
import { buildDossier as assembleDossier } from './vendor/makefun-game.ts';

// The folder holding this file is the repository root.
const repoRoot = path.dirname(urlToPath(import.meta.url));

// The grader hands us /output through the environment; local runs use out/.
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// The scorer's caps for gta6-01, taken from the kit's gate: the text budget
// shapes the dossier bytes, the rest refuse an entry the scorer would refuse.
const TEXT_BUDGET_BYTES = 163840;
const SHOT_LIMIT = 4;
const SHOT_LIMIT_BYTES = 262144;
const GAME_LIMIT_FILES = 993;
const GAME_LIMIT_BYTES = 50331648;
const GAME_LIMIT_PATH_BYTES = 1000;

// Copy a whole folder, replacing whatever a previous run left behind.
function copyFolder(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

// Screenshots are optional in a bare repo but required for a good entry:
// refuse to hand in a dossier with none instead of a silent empty one.
function copyShots(from, to) {
  fs.mkdirSync(to, { recursive: true });
  if (!fs.existsSync(from)) {
    throw new Error('Sunset Vice: no screenshots/ beside main.ts — take the four shots first');
  }
  const names = fs.readdirSync(from).filter((name) => /\.(png|jpe?g)$/i.test(name));
  if (names.length < 3 || names.length > SHOT_LIMIT) {
    throw new Error(`Sunset Vice: screenshots/ holds ${names.length} images, need 3 or 4`);
  }
  for (const name of names) {
    const file = path.join(from, name);
    if (fs.statSync(file).size > SHOT_LIMIT_BYTES) {
      throw new Error(`Sunset Vice: screenshot ${name} is over the 256 KiB cap`);
    }
    fs.copyFileSync(file, path.join(to, name));
  }
  return names.length;
}

function assemble() {
  const gameDir = path.join(repoRoot, 'game');
  if (!fs.existsSync(path.join(gameDir, 'index.html'))) {
    throw new Error('Sunset Vice: game/index.html is missing — the game is not staged');
  }
  fs.mkdirSync(outDir, { recursive: true });
  copyFolder(gameDir, path.join(outDir, 'game'));
  const shotCount = copyShots(path.join(repoRoot, 'screenshots'), path.join(outDir, 'screenshots'));
  const dossierText = assembleDossier(outDir, {
    text_max_bytes: TEXT_BUDGET_BYTES,
    screenshots: { max: SHOT_LIMIT, max_bytes: SHOT_LIMIT_BYTES },
    game_max_files: GAME_LIMIT_FILES,
    game_max_bytes: GAME_LIMIT_BYTES,
    game_path_max_bytes: GAME_LIMIT_PATH_BYTES,
  });
  fs.writeFileSync(path.join(outDir, 'dossier.json'), dossierText);
  const staged = fs.readdirSync(path.join(outDir, 'game'), { recursive: true }).length;
  console.log(`Sunset Vice: staged ${staged} game entries and ${shotCount} screenshots, dossier ${dossierText.length} bytes -> ${outDir}`);
}

assemble();
