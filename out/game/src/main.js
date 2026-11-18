// Sunset Vice — the browser shell: canvas, game loop, screens, save file.
// The sim owns the rules; this file owns the frame. A ?shot=<name> query
// freezes the sim on a staged scene so the screenshots are repeatable.
import { createGame, step, punch, shoot, enterExitCar, missionObjective } from './sim.js';
import { render, renderOverlay } from './render.js';
import { applyScene } from './scenes.js';
import { attach, axis, running, pressed, endFrame, mousePos, consumeClick } from './input.js';
import { startAudio, playSfx, toggleMute } from './audio.js';

const SAVE_KEY = 'sunset-vice-save-v1';
const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

let game = createGame(20261118);
let best = 0;
let frozen = false;

try {
  const raw = window.localStorage.getItem(SAVE_KEY);
  if (raw) {
    const save = JSON.parse(raw);
    if (typeof save.best === 'number') best = save.best;
    if (!shotName && typeof save.missionIndex === 'number' && save.missionIndex > 0 && save.missionIndex < 5) {
      game.missionIndex = save.missionIndex;
      game.player.cash = save.cash || 50;
      game.earned = save.earned || 0;
      game.player.gun = !!save.gun;
      game.player.ammo = save.ammo || 0;
    }
  }
} catch (e) {
  best = 0;
}

if (shotName) {
  applyScene(game, shotName);
  frozen = true;
}

attach(canvas);

let viewW = window.innerWidth;
let viewH = window.innerHeight;
function resize() {
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = viewW;
  canvas.height = viewH;
}
window.addEventListener('resize', resize);
resize();

const cam = { x: game.player.x, y: game.player.y, w: viewW, h: viewH, scale: 1 };

function saveGame() {
  try {
    best = Math.max(best, game.earned);
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      missionIndex: game.missionIndex,
      cash: game.player.cash,
      earned: game.earned,
      gun: game.player.gun,
      ammo: game.player.ammo,
      best,
    }));
  } catch (e) {
    // A browser that blocks storage still plays fine.
  }
}

function viewScale() {
  return Math.max(0.7, Math.min(viewW / 1300, viewH / 850));
}

function startPlaying() {
  startAudio();
  game.screen = 'play';
}

function restart() {
  const keepBest = best;
  game = createGame(20261118);
  best = keepBest;
  cam.x = game.player.x;
  cam.y = game.player.y;
  game.screen = 'play';
  startAudio();
}

let last = performance.now();
let lastMission = game.missionIndex;
let lastScreen = game.screen;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  cam.w = viewW;
  cam.h = viewH;
  cam.scale = viewScale();

  if (!frozen) {
    if (pressed('Space')) {
      if (game.screen === 'title') startPlaying();
      else if (game.screen === 'wasted' || game.screen === 'busted' || game.screen === 'won') restart();
    }
    if (pressed('KeyP') && (game.screen === 'play' || game.screen === 'paused')) {
      game.screen = game.screen === 'play' ? 'paused' : 'play';
    }
    if (pressed('KeyM')) toggleMute();

    if (game.screen === 'play') {
      if (pressed('KeyE')) enterExitCar(game);
      if (pressed('KeyF')) punch(game);
      if (consumeClick()) {
        const m = mousePos();
        const worldX = cam.x + (m.x - viewW / 2) / cam.scale;
        const worldY = cam.y + (m.y - viewH / 2) / cam.scale;
        shoot(game, Math.atan2(worldY - game.player.y, worldX - game.player.x));
      }
      step(game, dt, { axis: axis(), shift: running() });
      while (game.sfx.length > 0) playSfx(game.sfx.shift());
      if (game.screen !== lastScreen || game.missionIndex !== lastMission) {
        saveGame();
        lastScreen = game.screen;
        lastMission = game.missionIndex;
      }
    }
  }

  // Smooth camera follow, clamped to the world.
  const targetX = game.player.x;
  const targetY = game.player.y;
  cam.x += (targetX - cam.x) * Math.min(1, 5 * dt);
  cam.y += (targetY - cam.y) * Math.min(1, 5 * dt);
  const halfW = viewW / cam.scale / 2;
  const halfH = viewH / cam.scale / 2;
  cam.x = Math.max(halfW, Math.min(2880 - halfW, cam.x));
  cam.y = Math.max(halfH, Math.min(2160 - halfH, cam.y));

  ctx.clearRect(0, 0, viewW, viewH);
  render(ctx, game, cam, now);
  if (game.screen !== 'play') renderOverlay(ctx, game, viewW, viewH, best);

  if (statusEl) {
    const p = game.player;
    statusEl.textContent = `${missionObjective(game)} Cash $${p.cash} — wanted ${p.wanted} stars — screen ${game.screen}`;
  }

  endFrame();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
