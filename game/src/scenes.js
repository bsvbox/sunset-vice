// Deterministic screenshot scenes. Each one puts the game into a fixed,
// good-looking state; main.js freezes the simulation so the screenshot is
// stable. Names match shots.json.
import { LANDMARKS, AVENUES, STREETS } from './city.js';
import { range } from './rng.js';

function putPlayerInCar(s, x, y, angle, speed) {
  const car = s.cars.find((c) => c.kind === 'parked') || s.cars[0];
  car.kind = 'player';
  car.x = x; car.y = y; car.angle = angle; car.speed = speed;
  car.topSpeed = 320;
  s.player.inCar = car.id;
  s.player.x = x; s.player.y = y; s.player.angle = angle;
  return car;
}

function addCopCar(s, x, y, angle) {
  const car = {
    id: 'shotcop' + s.cops.length, kind: 'police', x, y, angle,
    speed: 180, topSpeed: 260, color: '#20242c', hp: 120, driver: true, wait: 0,
  };
  s.cars.push(car);
  s.cops.push({ x, y, angle, hp: 80, onFoot: false, car, punchCd: 0, speed: 0 });
}

export function applyScene(s, name) {
  const p = s.player;
  if (name === 'title') {
    // Title screen over a busy avenue at dusk colours.
    p.x = 1392; p.y = 1296;
    s.missionIndex = 0;
    return;
  }
  if (name === 'drive') {
    // Driving down an avenue with traffic around, mission 1 in progress.
    s.missionIndex = 0;
    putPlayerInCar(s, 1392, 1500, -Math.PI / 2, 210);
    for (let i = 0; i < 4; i++) {
      const c = s.cars.find((x) => x.kind === 'traffic' && Math.abs(x.x - 1392) > 200);
      if (c) { c.x = 1392 + (i % 2 ? -16 : 16); c.y = 1500 - (i + 1) * 170; c.angle = -Math.PI / 2; c.speed = 120; }
    }
    return;
  }
  if (name === 'chase') {
    // Five-star chase: the player flees in a car, police closing in.
    s.missionIndex = 4;
    p.wanted = 5;
    p.gun = true; p.ammo = 48;
    putPlayerInCar(s, 1392, 1296, -Math.PI / 2, 260);
    addCopCar(s, 1392 - 20, 1296 + 190, -Math.PI / 2);
    addCopCar(s, 1392 + 22, 1296 + 260, -Math.PI / 2);
    addCopCar(s, 1008, 1296 - 40, 0);
    addCopCar(s, 1776, 1296 + 60, Math.PI);
    return;
  }
  if (name === 'mission') {
    // The Score: inside the Corner Store mid-robbery, 2 stars, cops outside.
    s.missionIndex = 3;
    s.missionPhase = 'rob';
    s.missionProgress = 2.2;
    p.wanted = 2;
    p.gun = true; p.ammo = 30;
    p.x = LANDMARKS.store.x; p.y = LANDMARKS.store.y;
    p.angle = Math.PI / 2;
    addCopCar(s, LANDMARKS.store.x - 130, LANDMARKS.store.y + 120, Math.PI / 4);
    addCopCar(s, LANDMARKS.store.x + 140, LANDMARKS.store.y - 100, -Math.PI * 0.75);
    return;
  }
  throw new Error('unknown scene: ' + name);
}
