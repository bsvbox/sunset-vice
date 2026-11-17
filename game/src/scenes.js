// Screenshot scenes: frozen moments the shots.json driver captures.
// Each one sets up a game state, then main.js freezes the sim on it.
import { LANDMARKS } from './city.js';
import { createGame } from './sim.js';

export function applyScene(s, name) {
  const p = s.player;
  if (name === 'title') {
    p.x = LANDMARKS.plaza.x; p.y = LANDMARKS.plaza.y;
    s.missionIndex = 0;
  } else if (name === 'drive') {
    // Player in a parked car, heading north up an avenue.
    const car = s.cars.find((c) => c.kind === 'parked' && Math.abs(c.x - 1392) < 200) || s.cars[10];
    car.kind = 'parked';
    car.x = 1392; car.y = 1500; car.angle = -Math.PI / 2; car.speed = 210;
    p.inCar = car;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    s.missionIndex = 0;
    // A few traffic cars ahead.
    s.cars.filter((c) => c.kind === 'traffic').slice(0, 4).forEach((c, i) => {
      c.x = 1392 + (i % 2 ? 16 : -16);
      c.y = 1500 - (i + 1) * 190;
      c.angle = -Math.PI / 2;
      c.speed = 120;
    });
  } else if (name === 'chase') {
    s.missionIndex = 4;
    p.wanted = 5;
    p.gun = true; p.ammo = 48;
    const car = s.cars.find((c) => c.kind === 'parked') || s.cars[10];
    car.x = LANDMARKS.plaza.x; car.y = LANDMARKS.plaza.y;
    car.angle = -Math.PI / 2; car.speed = 260;
    p.inCar = car;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    // Four cop cars in pursuit.
    for (let i = 0; i < 4; i++) {
      s.cops.push({
        x: p.x + (i - 1.5) * 120, y: p.y + 260 + i * 60,
        angle: -Math.PI / 2, speed: 240, topSpeed: 260,
        inCar: true, hp: 80, carHp: 120, punchCd: 0, ramCd: 0, color: '#20242c',
      });
    }
  } else if (name === 'mission') {
    s.missionIndex = 3;
    s.missionPhase = 'rob';
    s.missionProgress = 2.2;
    p.wanted = 2;
    p.gun = true; p.ammo = 30;
    p.x = LANDMARKS.store.x; p.y = LANDMARKS.store.y;
    for (let i = 0; i < 2; i++) {
      s.cops.push({
        x: p.x + 260 - i * 520, y: p.y + 300,
        angle: Math.PI / 2, speed: 0, topSpeed: 260,
        inCar: true, hp: 80, carHp: 120, punchCd: 0, ramCd: 0, color: '#20242c',
      });
    }
  }
  return s;
}

export function sceneGame(name) {
  const s = createGame(20261118);
  s.screen = 'play';
  return applyScene(s, name);
}
