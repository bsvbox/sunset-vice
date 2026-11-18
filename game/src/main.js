// Sunset Vice — the game loop, screens, save and the screenshot mode.
// Wires input + simulation + renderer together; the simulation itself stays
// free of the DOM so the headless tests can drive it directly.
import { createGame, step, punch, shoot, enterExitCar, MISSIONS } from './sim.js';
import { render } from './render.js';
import { sceneGame } from './scenes.js';
import { attach, axis, running, pressed, mouse, consumeClick } from './input.js';
import { startAudio, playSfx, toggleMute } from './audio.js';
import { LANDMARKS } from './city.js';

const SAVE_KEY = 'sunset-vice-save-v1';
const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const shotMode = shotName !== null;

let game;
if (shotMode) {
  game = sceneGame(shotName);
  if (!game) {
    document.body.textContent = `Unknown shot: ${shotName}`;
    throw new Error(`unknown shot ${shotName}`);
  }
} else {
  game = createGame(20261118);
  loadSave(game);
}

function loadSave(s) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.missionIndex === 'number') s.missionIndex = Math.min(data.missionIndex, MISSIONS.length - 1);
    if (typeof data.cash === 'number') s.player.cash = data.cash;
    if (typeof data.earned === 'number') s.earned = data.earned;
    if (typeof data.gun === 'boolean') s.player.gun = data.gun;
    if (typeof data.ammo === 'number') s.player.ammo = data.ammo;
  } catch {
    // A corrupt save is ignored; a fresh game starts instead.
  }
}

function saveGame(s) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      missionIndex: s.missionIndex,
      cash: s.player.cash,
      earned: s.earned,
      gun: s.player.gun,
      ammo: s.player.ammo,
    }));
  } catch {
    // Storage may be unavailable; the game still plays.
  }
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();
attach(canvas);

let last = performance.now();
let camX = game.player.x;
let camY = game.player.y;

function viewScale() {
  return Math.max(0.7, Math.min(canvas.width / 1300, canvas.height / 850));
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function screenText() {
  const p = game.player;
  switch (game.screen) {
    case 'title':
      return 'Sunset Vice — title screen. Press Space to start.';
    case 'paused':
      return 'Sunset Vice — paused. Press P to continue.';
    case 'wasted':
      return 'Sunset Vice — wasted. Press Space to get back up.';
    case 'busted':
      return 'Sunset Vice — busted. Press Space to walk free.';
    case 'won':
      return 'Sunset Vice — Vice King! Press Space to play again.';
    default:
      return `Sunset Vice — Mission ${Math.min(game.missionIndex + 1, 5)} of 5, $${p.cash}, ${p.wanted} stars.`;
  }
}

function drawOverlay() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(8,10,14,0.78)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 64px system-ui, sans-serif';
  if (game.screen === 'title') {
    ctx.fillText('SUNSET VICE', w / 2, h / 2 - 110);
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillText('Palmetto Bay — an open-world crime story', w / 2, h / 2 - 66);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillStyle = '#cfe8c0';
    ctx.fillText('Work for Rico. Steal cars, dodge the cops, take the city.', w / 2, h / 2 - 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('Press SPACE to start', w / 2, h / 2 + 30);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#bbbbbb';
    ctx.fillText('WASD move / drive · E steal car · Click shoot · F punch · Shift run · P pause · M mute', w / 2, h / 2 + 66);
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        ctx.fillStyle = '#ffe9a8';
        ctx.font = '16px system-ui, sans-serif';
        ctx.fillText(`Best run: mission ${Math.min(data.missionIndex + 1, 5)} of 5 · earned $${data.earned || 0}`, w / 2, h / 2 + 100);
      }
    } catch {
      // No save to show.
    }
  } else if (game.screen === 'paused') {
    ctx.fillText('PAUSED', w / 2, h / 2 - 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Press P to continue', w / 2, h / 2 + 20);
  } else if (game.screen === 'wasted') {
    ctx.fillStyle = '#d93a3a';
    ctx.fillText('WASTED', w / 2, h / 2 - 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('You lost half your cash. Press SPACE to get back up.', w / 2, h / 2 + 20);
  } else if (game.screen === 'busted') {
    ctx.fillStyle = '#3d7bd9';
    ctx.fillText('BUSTED', w / 2, h / 2 - 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Fine paid. Press SPACE to walk free.', w / 2, h / 2 + 20);
  } else if (game.screen === 'won') {
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText('VICE KING', w / 2, h / 2 - 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText(`You own Palmetto Bay. Total earned: $${game.earned}`, w / 2, h / 2 + 4);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Press SPACE to play again.', w / 2, h / 2 + 44);
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (!shotMode) {
    if (pressed('mute')) {
      const m = toggleMute();
      setStatus(m ? 'Sunset Vice — sound off.' : 'Sunset Vice — sound on.');
    }
    if (game.screen === 'title' || game.screen === 'wasted' || game.screen === 'busted' || game.screen === 'won') {
      if (pressed('start')) {
        if (game.screen === 'won') {
          game = createGame(20261118);
          try { localStorage.removeItem(SAVE_KEY); } catch { /* fresh run anyway */ }
        }
        startAudio();
        game.screen = 'play';
        saveGame(game);
      }
    } else if (game.screen === 'play') {
      if (pressed('pause')) {
        game.screen = 'paused';
      } else {
        if (pressed('enter')) enterExitCar(game);
        if (pressed('punch')) punch(game);
        if (consumeClick()) {
          const m = mouse();
          const scale = viewScale();
          const worldX = camX + (m.x - canvas.width / 2) / scale;
          const worldY = camY + (m.y - canvas.height / 2) / scale;
          shoot(game, Math.atan2(worldY - game.player.y, worldX - game.player.x));
        }
        const before = game.missionIndex;
        step(game, dt, { axis: axis(), shift: running() });
        if (game.missionIndex !== before) saveGame(game);
        for (const name of game.sfx.splice(0)) playSfx(name);
      }
    } else if (game.screen === 'paused') {
      if (pressed('pause')) game.screen = 'play';
    }
  }

  // Smooth camera follow.
  const scale = viewScale();
  const tx = game.player.x;
  const ty = game.player.y;
  camX += (tx - camX) * Math.min(1, 6 * dt);
  camY += (ty - camY) * Math.min(1, 6 * dt);
  render(ctx, game, { w: canvas.width, h: canvas.height, camX, camY, scale });
  if (game.screen !== 'play') drawOverlay();
  setStatus(screenText());
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
