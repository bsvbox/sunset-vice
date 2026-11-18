// Sunset Vice — frozen scenes for the four screenshots. Each scene builds a
// fresh game, then arranges the actors into a readable moment: the title,
// a drive up the avenue, a five-star chase, and the store robbery.
import { createGame, makeCop } from './sim.js';
import { LANDMARKS } from './city.js';

function putPlayerInCar(s, x, y, angle, speed) {
  const car = s.cars.find((c) => c.kind === 'parked' && c.hp > 0);
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed;
  s.player.x = x;
  s.player.y = y;
  s.player.angle = angle;
  s.player.speed = speed;
  s.player.inCar = car;
  return car;
}

function placeTrafficAhead(s, x, ys) {
  const moving = s.cars.filter((c) => c.kind === 'traffic');
  ys.forEach((y, i) => {
    const car = moving[i % moving.length];
    car.x = x + (i % 2 === 0 ? -14 : 18);
    car.y = y;
    car.axis = 'v';
    car.line = x;
    car.dir = -1;
    car.angle = -Math.PI / 2;
    car.speed = 150;
  });
}

function addCopsNear(s, spots) {
  for (const [x, y] of spots) s.cops.push(makeCop(x, y));
}

// title: a fresh game at the plaza, mission 0, nothing arranged.
function title(s) {
  return s;
}

// drive: the player in a parked car on the avenue, heading north at speed,
// with four traffic cars ahead of them.
function drive(s) {
  putPlayerInCar(s, 1392, 1500, -Math.PI / 2, 210);
  placeTrafficAhead(s, 1392, [1380, 1230, 1080, 930]);
  return s;
}

// chase: Vice King (mission index 4), wanted 5, pistol with 48 rounds, the
// player car at the plaza doing 260, four cruisers closing in.
function chase(s) {
  s.missionIndex = 4;
  s.missionPhase = 'go';
  s.player.wanted = 5;
  s.player.gun = true;
  s.player.ammo = 48;
  putPlayerInCar(s, LANDMARKS.plaza.x, LANDMARKS.plaza.y, 0, 260);
  addCopsNear(s, [
    [LANDMARKS.plaza.x - 320, LANDMARKS.plaza.y - 60],
    [LANDMARKS.plaza.x + 300, LANDMARKS.plaza.y + 120],
    [LANDMARKS.plaza.x - 80, LANDMARKS.plaza.y - 340],
    [LANDMARKS.plaza.x + 140, LANDMARKS.plaza.y + 360],
  ]);
  return s;
}

// mission: The Score mid-robbery — phase 'rob', progress 2.2 of 4 seconds,
// wanted 2, pistol with 30 rounds, the player on foot at the store, two
// cruisers arriving.
function mission(s) {
  s.missionIndex = 3;
  s.missionPhase = 'rob';
  s.missionProgress = 2.2;
  s.player.wanted = 2;
  s.player.gun = true;
  s.player.ammo = 30;
  s.player.x = LANDMARKS.store.x;
  s.player.y = LANDMARKS.store.y;
  s.player.angle = Math.PI / 2;
  addCopsNear(s, [
    [LANDMARKS.store.x - 300, LANDMARKS.store.y + 40],
    [LANDMARKS.store.x + 260, LANDMARKS.store.y - 120],
  ]);
  return s;
}

const SCENES = { title, drive, chase, mission };

// Build a frozen game for the named scene, or null for an unknown name.
// The title scene keeps the title screen (the overlay draws over the
// plaza); the other scenes play, so the renderer draws the HUD, but the
// caller never steps the game, so each moment stays exactly as arranged.
export function applyScene(s, name) {
  const fn = SCENES[name];
  if (!fn) return null;
  fn(s);
  s.screen = name === 'title' ? 'title' : 'play';
  return s;
}

// A scene game straight from a seed, for the screenshot page.
export function sceneGame(name, seed = 20261118) {
  const s = createGame(seed);
  return applyScene(s, name);
}
