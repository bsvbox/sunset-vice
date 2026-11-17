// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between four screens: title, play, paused
// and game over.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_ENTER,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_PUNCH,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const renderer = createRenderer(canvas);

function readSave() {
  try {
    return JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? 'null');
  } catch {
    return null;
  }
}
function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

const world = createWorld(createRandom(seed), audio, readSave());
world.reset();
let best = readBest();

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, { best: scene.best, muted: audio.isMuted() });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let lastCam = null;
  let holdingE = false;
  let muted = false;

  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'e') holdingE = true;
  });
  window.addEventListener('keyup', (event) => {
    if (event.key.toLowerCase() === 'e') holdingE = false;
  });

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    if (world.state.gameOver) {
      world.reset();
      world.state.money = Math.floor(world.state.money / 2);
    }
    screen = SCREEN_PLAY;
    announce('Playing. Steal a car, run Rico\'s jobs, lose the cops.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    world.save();
    best = Math.max(best, world.state.earned + world.state.missionIndex * 1000 + world.state.kills * 10);
    announce('Wasted. Press Space to get back out there.');
  }

  function aimAngle() {
    if (!lastCam) return null;
    const mouse = input.mouse();
    const sx = world.state.player.x - lastCam.x;
    const sy = world.state.player.y - lastCam.y;
    return Math.atan2(mouse.y - sy, mouse.x - sx);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = !muted;
      audio.setMuted(muted);
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startGame();
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (screen === SCREEN_PLAY) {
      input.enterPressed = Boolean(actions & ACTION_ENTER);
      input.punchPressed = Boolean(actions & ACTION_PUNCH);
      input.shootHeld = input.mouse().down;
      input.holdingE = holdingE;
      while (accumulator >= STEP) {
        const event = world.step(STEP, input, aimAngle());
        accumulator -= STEP;
        input.enterPressed = false;
        input.punchPressed = false;
        if (event === 1) {
          endGame();
          break;
        }
      }
    } else {
      accumulator = 0;
      input.enterPressed = false;
      input.punchPressed = false;
      input.shootHeld = false;
    }
    lastCam = renderer.draw(world, screen, { best, muted });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Sunset Vice. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
