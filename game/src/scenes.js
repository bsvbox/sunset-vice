// Sunset Vice — staged setups for the four screenshots. Each one drops the
// player into a moment of the game: the title, a cruise down the avenue, a
// five-star chase, and a robbery in progress. The shell freezes the sim
// after applying a scene, so the shot is exactly what the maker framed.
import { LANDMARKS } from './city.js';
import { makeCop } from './sim.js';

function parkCar(s, x, y, angle, speed) {
  const car = { kind: 'parked', x, y, angle, speed: speed || 0, topSpeed: 300, color: '#e8e8e8', hp: 100, axis: 'v', dir: -1, cruise: 120, ramCd: 0 };
  s.cars.push(car);
  return car;
}

export function applyScene(s, name) {
  const p = s.player;
  if (name === 'title') {
    s.screen = 'title';
    p.x = LANDMARKS.plaza.x;
    p.y = LANDMARKS.plaza.y;
    p.angle = -Math.PI / 2;
    s.missionIndex = 0;
    s.missionPhase = 'go';
    return;
  }
  if (name === 'drive') {
    s.screen = 'play';
    const car = parkCar(s, 1392, 1500, -Math.PI / 2, 210);
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = 210;
    s.missionIndex = 0;
    const ahead = [
      { x: 1392, y: 1330, angle: -Math.PI / 2 },
      { x: 1412, y: 1180, angle: -Math.PI / 2 },
      { x: 1372, y: 1030, angle: -Math.PI / 2 },
      { x: 1392, y: 880, angle: -Math.PI / 2 },
    ];
    for (const spot of ahead) {
      const t = { kind: 'traffic', x: spot.x, y: spot.y, angle: spot.angle, speed: 120, topSpeed: 300, color: '#4a7dd8', hp: 100, axis: 'v', dir: -1, cruise: 120, ramCd: 0 };
      s.cars.push(t);
    }
    return;
  }
  if (name === 'chase') {
    s.screen = 'play';
    s.missionIndex = 3;
    s.missionPhase = 'go';
    p.wanted = 5;
    p.gun = true;
    p.ammo = 48;
    const car = parkCar(s, LANDMARKS.plaza.x, LANDMARKS.plaza.y, -Math.PI / 2, 260);
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = 260;
    const spots = [
      { x: 1190, y: 1296, angle: 0 },
      { x: 1590, y: 1296, angle: Math.PI },
      { x: 1392, y: 1100, angle: Math.PI / 2 },
      { x: 1392, y: 1500, angle: -Math.PI / 2 },
    ];
    for (const spot of spots) makeCop(s, spot.x, spot.y, spot.angle);
    return;
  }
  if (name === 'mission') {
    s.screen = 'play';
    s.missionIndex = 2;
    s.missionPhase = 'rob';
    s.missionProgress = 2.2;
    p.wanted = 2;
    p.gun = true;
    p.ammo = 30;
    p.x = LANDMARKS.store.x;
    p.y = LANDMARKS.store.y;
    p.angle = Math.PI / 2;
    makeCop(s, 1600, 576, 0);
    makeCop(s, 1776, 760, -Math.PI / 2);
    return;
  }
  s.screen = 'title';
}
