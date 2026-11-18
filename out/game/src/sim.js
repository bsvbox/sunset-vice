// Sunset Vice — the whole game logic, pure and DOM-free so Node can run it
// headless. The browser shell (main.js) owns the canvas, the keys and the
// sound; this file owns the city, the cars, the cops, the missions and the
// wanted stars, and nothing else.
import {
  WORLD_W, WORLD_H, LANDMARKS, AVENUES, STREETS,
  buildCity, hitsBuilding, resolveBuildings, nearestRoadPoint, onRoad,
} from './city.js';
import { mulberry32, clamp, dist2, angleLerp, range, rangeInt, pick } from './rng.js';

export const MISSIONS = [
  { name: 'First Wheels', brief: 'Steal a car and drive it to Rico\u2019s Garage.', reward: 150 },
  { name: 'The Pickup', brief: 'Wait at the Docks for Rico\u2019s contact.', reward: 250 },
  { name: 'Hot Pursuit', brief: 'Get the heat to two stars, then lose the cops.', reward: 300 },
  { name: 'The Score', brief: 'Rob the Corner Store till, then lose the cops.', reward: 500 },
  { name: 'Vice King', brief: 'With three stars on you, reach the North Gate.', reward: 800 },
];

const WALK_SPEED = 170;
const RUN_MULT = 1.7;
const COP_TOP_SPEED = 260;
const UNSEEN_DROP_SECONDS = 26;
const SEEN_RADIUS = 460;
const SPRAY_COST = 100;
const CAR_COLORS = ['#d84a4a', '#4a7dd8', '#e8c33d', '#7bc96f', '#c98ad8', '#e8e8e8', '#3d3d3d', '#e07b39'];
const PICKUP_SPOTS = [
  { x: 816, y: 396, kind: 'health' },
  { x: 1584, y: 756, kind: 'ammo' },
  { x: 432, y: 1116, kind: 'cash' },
  { x: 1968, y: 1116, kind: 'health' },
  { x: 816, y: 1836, kind: 'ammo' },
  { x: 1968, y: 1476, kind: 'cash' },
  { x: 1200, y: 396, kind: 'health' },
  { x: 432, y: 1836, kind: 'cash' },
];

function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

function makeCar(kind, x, y, angle, rand) {
  return {
    kind, x, y, angle,
    speed: 0,
    topSpeed: kind === 'cop' ? COP_TOP_SPEED : range(rand, 240, 330),
    color: kind === 'cop' ? '#2b4a8f' : pick(rand, CAR_COLORS),
    hp: 100,
    axis: 'v',
    dir: 1,
    cruise: range(rand, 90, 140),
    ramCd: 0,
  };
}

function roadPoint(rand, cx, cy, minD, maxD) {
  for (let tries = 0; tries < 14; tries++) {
    let px;
    let py;
    if (rand() < 0.5) {
      px = pick(rand, AVENUES);
      py = range(rand, 60, WORLD_H - 60);
    } else {
      px = range(rand, 60, WORLD_W - 60);
      py = pick(rand, STREETS);
    }
    const d = dist(px, py, cx, cy);
    if (d >= minD && d <= maxD) return { x: px, y: py };
  }
  const near = nearestRoadPoint(cx + minD, cy);
  return { x: near.x, y: near.y };
}

export function createGame(seed) {
  const rand = mulberry32(seed === undefined ? 20261118 : seed);
  const city = buildCity(rand);
  const cars = [];

  // Fourteen cars in traffic, spread over the avenues and streets.
  for (let i = 0; i < 14; i++) {
    const vertical = rand() < 0.5;
    let x;
    let y;
    if (vertical) {
      x = pick(rand, AVENUES) + (rand() < 0.5 ? -20 : 20);
      y = range(rand, 80, WORLD_H - 80);
    } else {
      x = range(rand, 80, WORLD_W - 80);
      y = pick(rand, STREETS) + (rand() < 0.5 ? -20 : 20);
    }
    const car = makeCar('traffic', x, y, vertical ? (rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rand() < 0.5 ? 0 : Math.PI), rand);
    car.axis = vertical ? 'v' : 'h';
    car.dir = car.angle === -Math.PI / 2 || car.angle === Math.PI ? -1 : 1;
    if (car.axis === 'h' && car.angle === 0) car.dir = 1;
    if (car.axis === 'h' && car.angle === Math.PI) car.dir = -1;
    if (car.axis === 'v' && car.angle === Math.PI / 2) car.dir = 1;
    if (car.axis === 'v' && car.angle === -Math.PI / 2) car.dir = -1;
    car.speed = car.cruise;
    cars.push(car);
  }

  // Twelve parked cars: four in the lots, the rest along road edges.
  for (let i = 0; i < 12; i++) {
    let x;
    let y;
    let angle;
    if (i < city.lots.length * 2 && city.lots.length > 0) {
      const lot = city.lots[i % city.lots.length];
      x = lot.x + 30 + (i % 2) * 44;
      y = lot.y + 26;
      angle = 0;
    } else if (rand() < 0.5) {
      x = pick(rand, AVENUES) + (rand() < 0.5 ? -58 : 58);
      y = range(rand, 120, WORLD_H - 120);
      angle = rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = range(rand, 120, WORLD_W - 120);
      y = pick(rand, STREETS) + (rand() < 0.5 ? -58 : 58);
      angle = rand() < 0.5 ? 0 : Math.PI;
    }
    cars.push(makeCar('parked', x, y, angle, rand));
  }

  // Twenty-two pedestrians wandering the sidewalks.
  const peds = [];
  for (let i = 0; i < 22; i++) {
    const vertical = rand() < 0.5;
    const x = vertical
      ? pick(rand, AVENUES) + range(rand, -44, 44)
      : range(rand, 80, WORLD_W - 80);
    const y = vertical
      ? range(rand, 80, WORLD_H - 80)
      : pick(rand, STREETS) + range(rand, -44, 44);
    peds.push({
      x, y,
      angle: range(rand, 0, Math.PI * 2),
      hp: 50,
      state: 'walk',
      speed: range(rand, 38, 68),
      dirTimer: range(rand, 1, 4),
      fleeTimer: 0,
    });
  }

  const pickups = PICKUP_SPOTS.map((spot) => ({
    x: spot.x, y: spot.y, kind: spot.kind,
    value: spot.kind === 'cash' ? 25 : 0,
    taken: false, respawn: 0,
  }));

  const plaza = LANDMARKS.plaza;
  return {
    player: {
      x: plaza.x, y: plaza.y, angle: -Math.PI / 2,
      hp: 100, cash: 50, wanted: 0,
      gun: false, ammo: 0, inCar: null, speed: 0,
      punchCd: 0, shootCd: 0, hurtCd: 0, bustedTimer: 0,
    },
    cars, peds,
    cops: [],
    bullets: [],
    pickups,
    missionIndex: 0,
    missionPhase: 'go',
    missionProgress: 0,
    unseenTimer: 0,
    sprayCd: 0,
    lightTimer: 0,
    spawnTimer: 0,
    kills: 0,
    carsStolen: 0,
    earned: 0,
    sfx: [],
    msg: '',
    msgTimer: 0,
    screen: 'title',
    time: 0,
    city,
    rand,
    stats: { shots: 0, hits: 0 },
  };
}

function say(s, text, kind) {
  s.msg = text;
  s.msgTimer = 4;
  if (kind) s.sfx.push(kind);
}

function completeMission(s, reward, text) {
  s.player.cash += reward;
  s.earned += reward;
  s.missionIndex++;
  s.missionPhase = 'go';
  s.missionProgress = 0;
  say(s, text, 'mission');
}

export function missionObjective(s) {
  const names = ['First Wheels', 'The Pickup', 'Hot Pursuit', 'The Score', 'Vice King'];
  if (s.missionIndex >= 5) return 'Vice King — Palmetto Bay is yours.';
  const m = MISSIONS[s.missionIndex];
  if (s.missionIndex === 2 && s.missionPhase === 'lose') return 'Hot Pursuit — lose the cops, get to zero stars.';
  if (s.missionIndex === 3 && s.missionPhase === 'rob') return 'The Score — hold the robbery, stay in the store.';
  if (s.missionIndex === 3 && s.missionPhase === 'lose') return 'The Score — lose the cops, get to zero stars.';
  return `${names[s.missionIndex]} — ${m.brief}`;
}

export function missionTarget(s) {
  if (s.missionIndex === 0) return LANDMARKS.garage;
  if (s.missionIndex === 1) return LANDMARKS.docks;
  if (s.missionIndex === 2) return s.missionPhase === 'lose' ? null : LANDMARKS.plaza;
  if (s.missionIndex === 3) return LANDMARKS.store;
  if (s.missionIndex === 4) return LANDMARKS.gate;
  return null;
}

function clearCops(s) {
  s.cars = s.cars.filter((c) => c.kind !== 'cop');
  s.cops.length = 0;
}

function bustPlayer(s) {
  const p = s.player;
  p.cash = Math.max(0, p.cash - 50);
  p.hp = 60;
  p.wanted = 0;
  p.inCar = null;
  p.x = LANDMARKS.plaza.x;
  p.y = LANDMARKS.plaza.y;
  p.bustedTimer = 0;
  clearCops(s);
  s.screen = 'busted';
  say(s, 'BUSTED — the cops took $50.', 'busted');
}

function wastePlayer(s) {
  const p = s.player;
  p.cash = Math.floor(p.cash / 2);
  p.hp = 100;
  p.wanted = 0;
  p.inCar = null;
  p.x = LANDMARKS.plaza.x;
  p.y = LANDMARKS.plaza.y;
  p.bustedTimer = 0;
  clearCops(s);
  s.screen = 'wasted';
  say(s, 'WASTED — you lost half your cash.', 'wasted');
}

export function makeCop(s, x, y, angle) {
  const car = makeCar('cop', x, y, angle === undefined ? 0 : angle, s.rand);
  car.speed = COP_TOP_SPEED;
  s.cars.push(car);
  const cop = {
    x, y, angle: car.angle, hp: 50,
    state: 'car', car,
    punchCd: 0, bustedTimer: 0, ramCd: 0,
  };
  s.cops.push(cop);
  return cop;
}

export function enterExitCar(s) {
  const p = s.player;
  if (p.inCar) {
    const car = p.inCar;
    car.speed = 0;
    p.inCar = null;
    p.x = clamp(car.x + 34, 14, WORLD_W - 14);
    p.y = clamp(car.y + 10, 14, WORLD_H - 14);
    p.speed = 0;
    return 'exit';
  }
  let best = null;
  let bestD = 70;
  for (const car of s.cars) {
    if (car.kind !== 'parked') continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return null;
  p.inCar = best;
  p.wanted += 1;
  s.carsStolen++;
  p.x = best.x;
  p.y = best.y;
  p.angle = best.angle;
  say(s, 'Car stolen — wanted +1.', 'car');
  return 'enter';
}

export function punch(s) {
  const p = s.player;
  if (p.punchCd > 0) return false;
  p.punchCd = 0.45;
  const hx = p.x + Math.cos(p.angle) * 26;
  const hy = p.y + Math.sin(p.angle) * 26;
  let hit = false;
  for (const ped of s.peds) {
    if (ped.state === 'down') continue;
    if (dist2(hx, hy, ped.x, ped.y) < 30 * 30) {
      ped.hp -= 25;
      hit = true;
      if (ped.hp <= 0) {
        ped.state = 'down';
        s.kills++;
        s.pickups.push({ x: ped.x, y: ped.y, kind: 'cash', value: 10, taken: false, respawn: 0 });
      } else {
        ped.state = 'flee';
        ped.fleeTimer = 3;
      }
    }
  }
  for (let i = s.cops.length - 1; i >= 0; i--) {
    const cop = s.cops[i];
    if (cop.state !== 'foot') continue;
    if (dist2(hx, hy, cop.x, cop.y) < 30 * 30) {
      cop.hp -= 25;
      hit = true;
      if (cop.hp <= 0) {
        s.kills++;
        s.pickups.push({ x: cop.x, y: cop.y, kind: 'cash', value: 20, taken: false, respawn: 0 });
        if (cop.car) cop.car.kind = 'parked';
        s.cops.splice(i, 1);
      }
    }
  }
  if (hit) s.sfx.push('punch');
  return hit;
}

export function shoot(s, angle) {
  const p = s.player;
  if (!p.gun || p.ammo <= 0 || p.shootCd > 0) return false;
  p.ammo--;
  p.shootCd = 0.22;
  p.angle = angle;
  s.bullets.push({
    x: p.x + Math.cos(angle) * 20,
    y: p.y + Math.sin(angle) * 20,
    angle, speed: 720, life: 1.2,
  });
  s.stats.shots++;
  s.sfx.push('shoot');
  return true;
}

function missionTick(s, dt) {
  const p = s.player;
  const idx = s.missionIndex;
  if (idx >= 5) return;
  if (idx === 0) {
    if (p.inCar && dist(p.x, p.y, LANDMARKS.garage.x, LANDMARKS.garage.y) < LANDMARKS.garage.r) {
      completeMission(s, 150, 'First Wheels done — Rico gave you a pistol (+24 ammo).');
      p.gun = true;
      p.ammo = 24;
    }
    return;
  }
  if (idx === 1) {
    if (dist(p.x, p.y, LANDMARKS.docks.x, LANDMARKS.docks.y) < LANDMARKS.docks.r) {
      s.missionProgress += dt;
      if (s.missionProgress >= 1.5) completeMission(s, 250, 'The Pickup done — the package is yours.');
    } else {
      s.missionProgress = 0;
    }
    return;
  }
  if (idx === 2) {
    if (s.missionPhase === 'go') {
      if (p.wanted >= 2) { s.missionPhase = 'lose'; s.missionProgress = 0; say(s, 'Two stars — now lose them.'); }
    } else if (p.wanted === 0) {
      completeMission(s, 300, 'Hot Pursuit done — clean getaway.');
    }
    return;
  }
  if (idx === 3) {
    const inStore = dist(p.x, p.y, LANDMARKS.store.x, LANDMARKS.store.y) < LANDMARKS.store.r;
    if (s.missionPhase === 'go') {
      if (inStore) { s.missionPhase = 'rob'; s.missionProgress = 0; say(s, 'Robbing the till — stay in the store.'); }
    } else if (s.missionPhase === 'rob') {
      if (inStore) {
        s.missionProgress += dt;
        if (s.missionProgress >= 4) {
          p.cash += 200;
          s.earned += 200;
          p.wanted += 2;
          s.missionPhase = 'lose';
          s.missionProgress = 0;
          say(s, 'Till emptied +$200 — now lose the cops.', 'cash');
        }
      } else {
        s.missionPhase = 'go';
        s.missionProgress = 0;
      }
    } else if (p.wanted === 0) {
      completeMission(s, 500, 'The Score done — Rico is impressed.');
      p.wanted = 3;
      say(s, 'Vice King — three stars on you. Reach the North Gate.');
    }
    return;
  }
  if (idx === 4) {
    if (p.wanted > 0 && dist(p.x, p.y, LANDMARKS.gate.x, LANDMARKS.gate.y) < LANDMARKS.gate.r) {
      completeMission(s, 800, 'VICE KING — Palmetto Bay is yours.');
      s.screen = 'won';
    }
  }
}

function policeTick(s, dt) {
  const p = s.player;
  const wanted = p.wanted;
  const desired = wanted > 0 ? Math.min(2 + wanted, 6) : 0;
  if (wanted > 0) {
    s.spawnTimer += dt;
    if (s.spawnTimer >= 0.5 && s.cops.length < desired) {
      s.spawnTimer = 0;
      const spot = roadPoint(s.rand, p.x, p.y, 480, 720);
      const cop = makeCop(s, spot.x, spot.y, Math.atan2(p.y - spot.y, p.x - spot.x));
      void cop;
      if (s.cops.length === 1) s.sfx.push('siren');
    }
  }
  for (const cop of s.cops) {
    cop.ramCd = Math.max(0, cop.ramCd - dt);
    cop.punchCd = Math.max(0, cop.punchCd - dt);
    if (cop.state === 'car') {
      const car = cop.car;
      const want = Math.atan2(p.y - car.y, p.x - car.x);
      car.angle = angleLerp(car.angle, want, Math.min(1, 3 * dt));
      car.speed = COP_TOP_SPEED;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = clamp(car.x, 10, WORLD_W - 10);
      car.y = clamp(car.y, 10, WORLD_H - 10);
      resolveBuildings(s.city, car, 18);
      cop.x = car.x;
      cop.y = car.y;
      cop.angle = car.angle;
      const d = dist(car.x, car.y, p.x, p.y);
      if (!p.inCar && d < 130) {
        cop.state = 'foot';
        cop.x = car.x + 20;
        cop.y = car.y + 12;
        car.speed = 0;
        continue;
      }
      if (p.inCar && d < 40 && cop.ramCd <= 0) {
        cop.ramCd = 0.5;
        p.inCar.hp -= 30;
        s.sfx.push('crash');
        if (p.inCar.hp <= 0) {
          p.inCar.speed = 0;
          p.inCar = null;
          p.x = clamp(car.x + 40, 14, WORLD_W - 14);
          p.y = clamp(car.y, 14, WORLD_H - 14);
          say(s, 'Your car is wrecked.');
        }
      }
    } else {
      const d = dist(cop.x, cop.y, p.x, p.y);
      const want = Math.atan2(p.y - cop.y, p.x - cop.x);
      cop.angle = want;
      cop.x += Math.cos(want) * 165 * dt;
      cop.y += Math.sin(want) * 165 * dt;
      resolveBuildings(s.city, cop, 12);
      cop.x = clamp(cop.x, 10, WORLD_W - 10);
      cop.y = clamp(cop.y, 10, WORLD_H - 10);
      if (d < 34) {
        cop.bustedTimer += dt;
        if (cop.punchCd <= 0) {
          cop.punchCd = 0.8;
          p.hp -= 10;
          s.sfx.push('punch');
          if (p.hp <= 0) wastePlayer(s);
        }
        if (cop.bustedTimer >= 1.4 && s.screen === 'play') bustPlayer(s);
      } else {
        cop.bustedTimer = 0;
      }
    }
  }
}

function trafficTick(s, dt) {
  const verticalGreen = (s.lightTimer % 6) < 3;
  for (const car of s.cars) {
    if (car.kind !== 'traffic') continue;
    let target = car.cruise;
    // Red light: stop before the next cross-road.
    const ahead = car.dir;
    if (car.axis === 'v') {
      if (!verticalGreen) {
        for (const sy of STREETS) {
          const gap = (sy - car.y) * ahead;
          if (gap > 0 && gap < 58) { target = 0; break; }
        }
      }
    } else if (verticalGreen) {
      for (const ax of AVENUES) {
        const gap = (ax - car.x) * ahead;
        if (gap > 0 && gap < 58) { target = 0; break; }
      }
    }
    // Car ahead in the same lane: follow it, never ram it.
    for (const other of s.cars) {
      if (other === car || other.kind === 'parked') continue;
      if (car.axis === 'v') {
        if (Math.abs(other.x - car.x) < 34 && (other.y - car.y) * ahead > 0 && (other.y - car.y) * ahead < 52) { target = 0; break; }
      } else if (Math.abs(other.y - car.y) < 34 && (other.x - car.x) * ahead > 0 && (other.x - car.x) * ahead < 52) {
        target = 0; break;
      }
    }
    car.speed += (target - car.speed) * Math.min(1, 3 * dt);
    if (car.speed < 2 && target === 0) car.speed = 0;
    if (car.axis === 'v') car.y += car.dir * car.speed * dt;
    else car.x += car.dir * car.speed * dt;
    // Random turn at an intersection centre.
    const onAvenue = AVENUES.some((ax) => Math.abs(car.x - ax) < 8);
    const onStreet = STREETS.some((sy) => Math.abs(car.y - sy) < 8);
    if (onAvenue && onStreet && car.speed > 30 && s.rand() < 0.012) {
      if (car.axis === 'v') {
        car.axis = 'h';
        car.dir = s.rand() < 0.5 ? 1 : -1;
        car.angle = car.dir === 1 ? 0 : Math.PI;
        car.y = STREETS.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
      } else {
        car.axis = 'v';
        car.dir = s.rand() < 0.5 ? 1 : -1;
        car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
        car.x = AVENUES.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
      }
    }
    // Wrap to a fresh road spot at the world edge.
    if (car.x < 40 || car.x > WORLD_W - 40 || car.y < 40 || car.y > WORLD_H - 40) {
      const vertical = s.rand() < 0.5;
      if (vertical) {
        car.axis = 'v';
        car.x = pick(s.rand, AVENUES) + (s.rand() < 0.5 ? -20 : 20);
        car.y = car.dir === 1 ? 80 : WORLD_H - 80;
        car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.axis = 'h';
        car.y = pick(s.rand, STREETS) + (s.rand() < 0.5 ? -20 : 20);
        car.x = car.dir === 1 ? 80 : WORLD_W - 80;
        car.angle = car.dir === 1 ? 0 : Math.PI;
      }
      car.speed = car.cruise;
    }
  }
}

function pedsTick(s, dt) {
  const p = s.player;
  for (const ped of s.peds) {
    if (ped.state === 'down') continue;
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = away;
      ped.x += Math.cos(away) * 140 * dt;
      ped.y += Math.sin(away) * 140 * dt;
      if (ped.fleeTimer <= 0) ped.state = 'walk';
    } else {
      ped.dirTimer -= dt;
      if (ped.dirTimer <= 0) {
        ped.dirTimer = range(s.rand, 1, 4);
        if (!onRoad(ped.x, ped.y)) {
          const near = nearestRoadPoint(ped.x, ped.y);
          ped.angle = Math.atan2(near.y - ped.y, near.x - ped.x);
        } else {
          ped.angle += range(s.rand, -1.2, 1.2);
        }
      }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    resolveBuildings(s.city, ped, 10);
    ped.x = clamp(ped.x, 10, WORLD_W - 10);
    ped.y = clamp(ped.y, 10, WORLD_H - 10);
  }
}

function bulletsTick(s, dt) {
  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i];
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H;
    if (!dead) {
      for (const ped of s.peds) {
        if (ped.state === 'down') continue;
        if (dist2(b.x, b.y, ped.x, ped.y) < 20 * 20) {
          ped.hp -= 34;
          s.stats.hits++;
          dead = true;
          if (ped.hp <= 0) {
            ped.state = 'down';
            s.kills++;
            s.pickups.push({ x: ped.x, y: ped.y, kind: 'cash', value: 10, taken: false, respawn: 0 });
          } else {
            ped.state = 'flee';
            ped.fleeTimer = 3;
          }
          break;
        }
      }
    }
    if (!dead) {
      for (let j = s.cops.length - 1; j >= 0; j--) {
        const cop = s.cops[j];
        if (cop.state !== 'foot') continue;
        if (dist2(b.x, b.y, cop.x, cop.y) < 20 * 20) {
          cop.hp -= 34;
          s.stats.hits++;
          dead = true;
          if (cop.hp <= 0) {
            s.kills++;
            s.pickups.push({ x: cop.x, y: cop.y, kind: 'cash', value: 20, taken: false, respawn: 0 });
            if (cop.car) cop.car.kind = 'parked';
            s.cops.splice(j, 1);
          }
          break;
        }
      }
    }
    if (dead) s.bullets.splice(i, 1);
  }
}

function pickupsTick(s, dt) {
  const p = s.player;
  for (const pk of s.pickups) {
    if (pk.taken) {
      pk.respawn -= dt;
      if (pk.respawn <= 0) pk.taken = false;
      continue;
    }
    if (!p.inCar && dist2(p.x, p.y, pk.x, pk.y) < 28 * 28) {
      pk.taken = true;
      pk.respawn = 20;
      if (pk.kind === 'health') {
        p.hp = Math.min(100, p.hp + 40);
        say(s, 'Health +40.');
      } else if (pk.kind === 'ammo') {
        p.gun = true;
        p.ammo += 24;
        say(s, 'Ammo +24.');
      } else {
        p.cash += pk.value || 25;
        say(s, `Cash +$${pk.value || 25}.`, 'cash');
      }
      s.sfx.push('pickup');
    }
  }
}

export function step(s, dt, input) {
  dt = Math.min(dt, 0.05);
  if (s.screen !== 'play') return;
  const p = s.player;
  s.time += dt;
  s.lightTimer += dt;
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.hurtCd = Math.max(0, p.hurtCd - dt);
  s.sprayCd = Math.max(0, s.sprayCd - dt);
  s.msgTimer = Math.max(0, s.msgTimer - dt);

  const ax = input && input.axis ? input.axis : { x: 0, y: 0 };
  const shift = !!(input && input.shift);

  if (p.inCar) {
    const car = p.inCar;
    const throttle = -ax.y;
    car.speed += throttle * 300 * dt;
    car.speed = clamp(car.speed, -70, car.topSpeed);
    if (throttle === 0) car.speed *= Math.max(0, 1 - 0.6 * dt);
    if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;
    const turnAuthority = clamp(Math.abs(car.speed) / 120, 0, 1);
    car.angle += ax.x * 1.9 * dt * turnAuthority * (car.speed >= 0 ? 1 : -1);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const wasX = car.x;
    const wasY = car.y;
    car.x = clamp(nx, 16, WORLD_W - 16);
    car.y = clamp(ny, 16, WORLD_H - 16);
    if (hitsBuilding(s.city, car.x, car.y, 18)) {
      car.x = wasX;
      car.y = wasY;
      car.speed *= 0.4;
      s.sfx.push('crash');
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = car.speed;
    // Running over pedestrians.
    if (Math.abs(car.speed) > 60) {
      for (const ped of s.peds) {
        if (ped.state === 'down') continue;
        if (dist2(car.x, car.y, ped.x, ped.y) < 26 * 26) {
          ped.state = 'down';
          ped.hp = 0;
          s.kills++;
          p.wanted += 1;
          s.pickups.push({ x: ped.x, y: ped.y, kind: 'cash', value: 10, taken: false, respawn: 0 });
          say(s, 'Pedestrian down — wanted +1.', 'crash');
        }
      }
    }
  } else {
    const speed = WALK_SPEED * (shift ? RUN_MULT : 1);
    if (ax.x !== 0 || ax.y !== 0) {
      p.angle = Math.atan2(ax.y, ax.x);
      p.x += ax.x * speed * dt;
      p.y += ax.y * speed * dt;
      p.speed = speed;
    } else {
      p.speed = 0;
    }
    resolveBuildings(s.city, p, 14);
    p.x = clamp(p.x, 14, WORLD_W - 14);
    p.y = clamp(p.y, 14, WORLD_H - 14);
  }

  // Pay n Spray: a clean car for $100, cops included.
  if (p.inCar && p.wanted > 0 && p.cash >= SPRAY_COST && s.sprayCd <= 0
    && dist(p.x, p.y, LANDMARKS.spray.x, LANDMARKS.spray.y) < LANDMARKS.spray.r) {
    p.cash -= SPRAY_COST;
    p.wanted = 0;
    s.unseenTimer = 0;
    s.sprayCd = 10;
    clearCops(s);
    say(s, 'Pay n Spray — clean car, wanted cleared.', 'spray');
  }

  // Wanted decay: a star drops every 26 seconds no cop can see you.
  if (p.wanted > 0) {
    let seen = false;
    for (const cop of s.cops) {
      if (dist2(cop.x, cop.y, p.x, p.y) < SEEN_RADIUS * SEEN_RADIUS) { seen = true; break; }
    }
    if (!seen) {
      s.unseenTimer += dt;
      if (s.unseenTimer >= UNSEEN_DROP_SECONDS) {
        s.unseenTimer = 0;
        p.wanted -= 1;
        if (p.wanted === 0) clearCops(s);
      }
    } else {
      s.unseenTimer = 0;
    }
  }

  missionTick(s, dt);
  policeTick(s, dt);
  trafficTick(s, dt);
  pedsTick(s, dt);
  bulletsTick(s, dt);
  pickupsTick(s, dt);

  if (p.hp <= 0 && s.screen === 'play') wastePlayer(s);
  if (p.wanted === 0 && s.cops.length > 0) clearCops(s);
  if (s.msgTimer <= 0) s.msg = '';
}
