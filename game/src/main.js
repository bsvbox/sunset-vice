// Sunset Vice entry point: game loop, screens, save/load, and the bridge
// between input, simulation, rendering and sound.
import { createGame, step, missionTargetFor } from './sim.js';
import { render } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { applyScene } from './scenes.js';

const SAVE_KEY = 'sunset-vice-save-v1';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const input = createInput();
const audio = createAudio();
input.attach(canvas);

let W = 0, H = 0;
function resize() {
  W = canvas.clientWidth || window.innerWidth;
  H = canvas.clientHeight || window.innerHeight;
  canvas.width = W;
  canvas.height = H;
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seedParam = Number(params.get('seed') || 20261118);

const game = createGame(seedParam);
let frozen = false;
let best = 0;
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    const save = JSON.parse(raw);
    best = save.best || 0;
    if (!shotName && save.missionIndex > 0) {
      game.missionIndex = save.missionIndex;
      game.player.cash = save.cash;
      game.player.gun = !!save.gun;
      game.player.ammo = save.ammo || 0;
      game.earned = save.earned || 0;
    }
  }
} catch { /* a fresh start is fine when the save is unreadable */ }

if (shotName) {
  applyScene(game, shotName);
  game.screen = shotName === 'title' ? 'title' : 'play';
  frozen = true;
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      missionIndex: game.missionIndex,
      cash: game.player.cash,
      earned: game.earned,
      gun: game.player.gun,
      ammo: game.player.ammo,
      best: Math.max(best, game.earned),
    }));
  } catch { /* saving is best-effort */ }
}

let prevKeys = new Set();
function edge(code) {
  const now = input.keys.has(code);
  const was = prevKeys.has(code);
  return now && !was;
}

let last = performance.now();
let camX = game.player.x - W / 2;
let camY = game.player.y - H / 2;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const p = game.player;
  game.missionTarget = missionTargetFor(game);

  if (game.screen === 'title') {
    if (edge('Space') || edge('Enter') || input.consumeClick()) {
      game.screen = 'play';
      audio.unlock();
      statusEl.textContent = 'Playing Sunset Vice.';
    }
  } else if (game.screen === 'play') {
    if (edge('KeyP') || edge('Escape')) {
      game.screen = 'paused';
      statusEl.textContent = 'Paused.';
    } else if (!frozen) {
      const ax = input.axis();
      const aimAngle = Math.atan2(
        (input.mouseY / viewScale() + camY) - p.y,
        (input.mouseX / viewScale() + camX) - p.x);
      step(game, {
        ax: ax.x, ay: ax.y,
        run: input.keys.has('ShiftLeft') || input.keys.has('ShiftRight'),
        enter: edge('KeyE'),
        punch: edge('KeyF'),
        shoot: input.mouseDown || input.clicked,
        aimAngle,
      }, dt);
      input.consumeClick();
      for (const fx of game.sfx.splice(0)) {
        if (fx === 'shoot') audio.shoot();
        else if (fx === 'punch') audio.punch();
        else if (fx === 'pickup') audio.pickup();
        else if (fx === 'cash') audio.cash();
        else if (fx === 'crash') audio.crash();
        else if (fx === 'siren') audio.siren();
        else if (fx === 'mission') audio.mission();
        else if (fx === 'wasted') audio.wasted();
        else if (fx === 'engine') audio.engine();
      }
      if (game.screen === 'wasted' || game.screen === 'busted' || game.screen === 'won') {
        best = Math.max(best, game.earned);
        saveGame();
        statusEl.textContent = game.screen === 'won' ? 'You won. Vice King of Palmetto Bay.' : 'Press Space to continue.';
      }
    }
  } else if (game.screen === 'paused') {
    if (edge('KeyP') || edge('Escape') || edge('Space')) {
      game.screen = 'play';
      statusEl.textContent = 'Playing Sunset Vice.';
    }
  } else if (game.screen === 'wasted' || game.screen === 'busted' || game.screen === 'won') {
    if (edge('Space') || edge('Enter')) {
      if (game.screen === 'won') {
        game.screen = 'title';
      } else {
        game.screen = 'play';
        game.player.hp = 100;
      }
      statusEl.textContent = 'Playing Sunset Vice.';
    }
  }

  if (edge('KeyM')) {
    const muted = audio.toggleMute();
    game.msg = muted ? 'Muted.' : 'Sound on.';
    game.msgTimer = 1.5;
  }

  // Camera follows the player smoothly.
  const scale = viewScale();
  const tx = p.x - W / scale / 2;
  const ty = p.y - H / scale / 2;
  camX += (tx - camX) * Math.min(1, dt * 5);
  camY += (ty - camY) * Math.min(1, dt * 5);

  render(ctx, game, { w: W, h: H, camX, camY, scale });
  drawScreenOverlay();
  prevKeys = new Set(input.keys);
  requestAnimationFrame(frame);
}

function viewScale() {
  return Math.max(0.7, Math.min(W / 1300, H / 850));
}

function drawScreenOverlay() {
  if (game.screen === 'title') {
    ctx.fillStyle = 'rgba(8,10,16,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('SUNSET VICE', W / 2, H / 2 - 110);
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    ctx.fillText('Palmetto Bay — an open-world crime story', W / 2, H / 2 - 66);
    ctx.font = '17px sans-serif';
    ctx.fillStyle = '#ccc';
    ctx.fillText('Work for Rico. Steal cars, dodge the law, run five missions,', W / 2, H / 2 - 20);
    ctx.fillText('and become the Vice King of Palmetto Bay.', W / 2, H / 2 + 6);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Press SPACE to start', W / 2, H / 2 + 64);
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.fillText('WASD move / drive  •  E enter car  •  F punch  •  Click shoot  •  Shift run', W / 2, H / 2 + 100);
    if (best > 0) {
      ctx.fillStyle = '#37b24d';
      ctx.font = '15px sans-serif';
      ctx.fillText('Best earnings so far: $' + best, W / 2, H / 2 + 130);
    }
    ctx.textAlign = 'left';
  } else if (game.screen === 'paused') {
    ctx.fillStyle = 'rgba(8,10,16,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('PAUSED', W / 2, H / 2);
    ctx.font = '17px sans-serif';
    ctx.fillText('Press P or Space to continue', W / 2, H / 2 + 36);
    ctx.textAlign = 'left';
  } else if (game.screen === 'wasted' || game.screen === 'busted') {
    ctx.fillStyle = 'rgba(40,8,8,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6a5a';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText(game.screen === 'wasted' ? 'WASTED' : 'BUSTED', W / 2, H / 2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText(game.msg || '', W / 2, H / 2 + 28);
    ctx.fillText('Press SPACE to continue', W / 2, H / 2 + 60);
    ctx.textAlign = 'left';
  } else if (game.screen === 'won') {
    ctx.fillStyle = 'rgba(8,16,10,0.66)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('VICE KING', W / 2, H / 2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('All five missions done. Palmetto Bay is yours.', W / 2, H / 2 + 30);
    ctx.fillText('Total earned: $' + game.earned + '   •   Press SPACE for the title screen', W / 2, H / 2 + 62);
    ctx.textAlign = 'left';
  }
}

requestAnimationFrame(frame);
