// Sunset Vice: game loop, screens, save/load, camera and input wiring.
// The simulation lives in sim.js; this file only drives it and draws it.
import { createGame, step, punch, shoot, enterExitCar, missionObjective } from './sim.js';
import { render, drawOverlay } from './render.js';
import { applyScene } from './scenes.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';

const SAVE_KEY = 'sunset-vice-save-v1';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const input = createInput();
input.attach(canvas);
const audio = createAudio();

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

let game = createGame(20261118);
let frozen = false;

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    game.missionIndex = d.missionIndex || 0;
    game.player.cash = d.cash ?? 50;
    game.earned = d.earned || 0;
    game.player.gun = !!d.gun;
    game.player.ammo = d.ammo || 0;
  } catch { /* a bad save never blocks the game */ }
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      missionIndex: game.missionIndex,
      cash: game.player.cash,
      earned: game.earned,
      gun: game.player.gun,
      ammo: game.player.ammo,
    }));
  } catch { /* storage may be unavailable */ }
}

function bestScore() {
  try { return Number(localStorage.getItem(SAVE_KEY + '-best') || 0); } catch { return 0; }
}

function saveBest() {
  try {
    if (game.earned > bestScore()) localStorage.setItem(SAVE_KEY + '-best', String(game.earned));
  } catch { /* ignore */ }
}

if (shotName) {
  applyScene(game, shotName);
  game.screen = shotName === 'title' ? 'title' : 'play';
  frozen = true;
} else {
  loadSave();
}

let camX = game.player.x, camY = game.player.y;
let last = performance.now();
let wasPaused = false;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function viewScale() {
  return Math.max(0.7, Math.min(canvas.width / 1300, canvas.height / 850));
}

function edge(code) {
  if (input.pressed(code)) {
    if (!edge._seen) edge._seen = new Set();
    if (edge._seen.has(code)) return false;
    edge._seen.add(code);
    return true;
  }
  if (edge._seen) edge._seen.delete(code);
  return false;
}

function aimAngle() {
  const scale = viewScale();
  const wx = camX + (input.mouseX - canvas.width / 2) / scale;
  const wy = camY + (input.mouseY - canvas.height / 2) / scale;
  return Math.atan2(wy - game.player.y, wx - game.player.x);
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  const p = game.player;

  if (!frozen) {
    if (edge('KeyM')) {
      const m = audio.toggleMute();
      game.msg = m ? 'Sound off.' : 'Sound on.';
      game.msgTimer = 2;
    }
    if (game.screen === 'title') {
      if (edge('Space') || input.consumeClick()) {
        audio.unlock();
        game.screen = 'play';
      }
    } else if (game.screen === 'play') {
      if (edge('KeyP')) { game.screen = 'paused'; wasPaused = true; }
      if (edge('KeyE')) enterExitCar(game);
      if (edge('KeyF')) punch(game);
      if (input.consumeClick() || input.mouseDown) shoot(game, aimAngle());
      const simInput = {
        axis: input.axis(),
        shift: input.pressed('ShiftLeft') || input.pressed('ShiftRight'),
      };
      step(game, dt, simInput);
      if (game.screen === 'wasted' || game.screen === 'busted' || game.screen === 'won') saveBest();
      if (game.missionIndex > 0) saveGame();
      while (game.sfx.length) {
        const fx = game.sfx.shift();
        if (audio[fx]) audio[fx]();
      }
    } else if (game.screen === 'paused') {
      if (edge('KeyP') || edge('Space')) game.screen = 'play';
    } else if (game.screen === 'wasted' || game.screen === 'busted') {
      if (edge('Space')) {
        game.screen = 'play';
        p.hp = 100;
        if (game.screen === 'wasted') p.hp = 100;
        saveGame();
      }
    } else if (game.screen === 'won') {
      if (edge('Space')) {
        game = createGame(20261118);
        game.screen = 'play';
        camX = game.player.x; camY = game.player.y;
      }
    }
  }

  // Camera follows the player smoothly.
  const targetX = p.x, targetY = p.y;
  camX += (targetX - camX) * Math.min(1, dt * 5);
  camY += (targetY - camY) * Math.min(1, dt * 5);

  const scale = viewScale();
  render(ctx, game, { camX, camY, scale, W: canvas.width, H: canvas.height });

  if (game.screen === 'title') {
    drawOverlay(ctx, game, canvas.width, canvas.height, [
      ['SUNSET VICE', 64, '#ffd23c'],
      ['Palmetto Bay — an open-world crime story', 22, '#ffffff'],
      ['Work for Rico. Steal cars, dodge the law, run five missions,', 16, '#e8e8e8'],
      ['and become the Vice King of Palmetto Bay.', 16, '#e8e8e8'],
    ], 'Press SPACE to start');
    if (bestScore() > 0) {
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('Best score so far: $' + bestScore(), canvas.width / 2, canvas.height / 2 + 170);
    }
  } else if (game.screen === 'paused') {
    drawOverlay(ctx, game, canvas.width, canvas.height, [
      ['PAUSED', 48, '#ffffff'],
      ['P or Space to keep playing.', 16, '#e8e8e8'],
    ], null);
  } else if (game.screen === 'wasted') {
    drawOverlay(ctx, game, canvas.width, canvas.height, [
      ['WASTED', 56, '#d83a3a'],
      ['You lost half your cash at the hospital.', 16, '#e8e8e8'],
    ], 'Press SPACE to get back out there');
  } else if (game.screen === 'busted') {
    drawOverlay(ctx, game, canvas.width, canvas.height, [
      ['BUSTED', 56, '#3a7ad8'],
      ['The fine cost you $50.', 16, '#e8e8e8'],
    ], 'Press SPACE to get back out there');
  } else if (game.screen === 'won') {
    drawOverlay(ctx, game, canvas.width, canvas.height, [
      ['VICE KING', 56, '#ffd23c'],
      ['All five missions done. Total earned $' + game.earned + '.', 18, '#ffffff'],
      ['Palmetto Bay is yours.', 16, '#e8e8e8'],
    ], 'Press SPACE to play again');
  }

  if (statusEl) {
    const m = game.missionIndex < 5 ? 'Mission ' + (game.missionIndex + 1) + '/5: ' + missionObjective(game) : 'Vice King';
    statusEl.textContent = 'Sunset Vice — ' + m + ' — $' + p.cash + ' — ' + p.wanted + ' stars';
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
