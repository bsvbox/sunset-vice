// Sunset Vice — pure simulation. No DOM, no canvas, no AudioContext: the
// same step() runs in the browser and in the headless Node tests. The game
// loop owns input and rendering; this module owns the world state.
import { WORLD_W, WORLD_H, LANDMARKS, AVENUES, STREETS, buildCity, hitsBuilding, resolveBuildings, nearestRoadPoint, onRoad } from './city.js';
import { mulberry32, clamp, dist2, angleLerp, range, rangeInt, pick } from './rng.js';

export const MISSIONS = [
  { name: 'First Wheels', brief: 'Steal a car and drive it to Rico\u2019s Garage.', reward: 150 },
  { name: 'The Pickup', brief: 'Stand at the Docks for the drop.', reward: 250 },
  { name: 'Hot Pursuit', brief: 'Raise 2 stars, then lose them all.', reward: 300 },
  { name: 'The Score', brief: 'Rob the Corner Store, then lose the heat.', reward: 500 },
  { name: 'Vice King', brief: 'Reach the North Gate with the cops still on you.', reward: 800 },
];

const CAR_COLORS = ['#d94f3d', '#3d7bd9', '#e8b93c', '#43b581', '#8a5fc0', '#d9d9d9', '#2e2e38', '#e07b39'];
const WALK_SPEED = 170;
const RUN_MULT = 1.7;
const STAR_DROP_SECONDS = 26;
const UNSEEN_RANGE = 460;
const COP_SPAWN_SECONDS = 0.5;
const SPRAY_COST = 100;
const SPRAY_COOLDOWN = 10;
const BUSTED_FINE = 50;
const BULLET_SPEED = 720;
const BULLET_DAMAGE = 34;
const PUNCH_DAMAGE = 25;
const PUNCH_REACH = 26;
const PUNCH_RADIUS = 30;

function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

function insideLandmark(p, lm) {
  return dist2(p.x, p.y, lm.x, lm.y) < lm.r * lm.r;
}

// ------------------------------------------------------------------ spawns

function randomRoadPoint(rand) {
  if (rand() < 0.5) {
    return { x: pick(rand, AVENUES), y: range(rand, 40, WORLD_H - 40), axis: 'v' };
  }
  return { x: range(rand, 40, WORLD_W - 40), y: pick(rand, STREETS), axis: 'h' };
}

function makeTrafficCar(rand) {
  const spot = randomRoadPoint(rand);
  const dir = rand() < 0.5 ? 1 : -1;
  const top = range(rand, 120, 180);
  return {
    kind: 'traffic',
    x: spot.x,
    y: spot.y,
    angle: spot.axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI,
    speed: top * 0.6,
    topSpeed: top,
    color: pick(rand, CAR_COLORS),
    hp: 100,
    axis: spot.axis,
    line: spot.axis === 'v' ? spot.x : spot.y,
    dir,
    turnKey: '',
  };
}

function makeParkedCar(rand, x, y) {
  return {
    kind: 'parked',
    x,
    y,
    angle: range(rand, 0, Math.PI * 2),
    speed: 0,
    topSpeed: range(rand, 240, 330),
    color: pick(rand, CAR_COLORS),
    hp: 100,
  };
}

function makePed(rand) {
  const spot = randomRoadPoint(rand);
  const target = randomRoadPoint(rand);
  return {
    x: spot.x + range(rand, -20, 20),
    y: spot.y + range(rand, -20, 20),
    angle: range(rand, 0, Math.PI * 2),
    hp: 50,
    state: 'walk',
    speed: range(rand, 34, 52),
    color: pick(rand, ['#d94f3d', '#3d7bd9', '#e8b93c', '#43b581', '#c05fc0']),
    tx: target.x,
    ty: target.y,
    fleeT: 0,
    downT: 0,
  };
}

// A police unit. While driving, x/y are the cruiser; on foot, carX/carY hold
// the parked cruiser and x/y are the officer.
export function makeCop(x, y) {
  return {
    x, y,
    angle: 0,
    speed: 0,
    hp: 100,
    onFoot: false,
    carX: x, carY: y, carAngle: 0,
    punchCd: 0,
    closeT: 0,
    ramCd: 0,
  };
}

const PICKUP_SPOTS = [
  { x: 1392, y: 1150, kind: 'health' },
  { x: 624, y: 1900, kind: 'health' },
  { x: 1776, y: 700, kind: 'ammo' },
  { x: 1008, y: 1500, kind: 'ammo' },
  { x: 240, y: 1100, kind: 'ammo' },
  { x: 1392, y: 1450, kind: 'cash' },
  { x: 2160, y: 936, kind: 'cash' },
  { x: 1008, y: 216, kind: 'cash' },
];

function pickupValue(kind) {
  if (kind === 'health') return 40;
  if (kind === 'ammo') return 24;
  return 25;
}

// ------------------------------------------------------------------ create

export function createGame(seed = 20261118) {
  const rand = mulberry32(seed);
  const city = buildCity(rand);
  const cars = [];
  for (let i = 0; i < 14; i++) cars.push(makeTrafficCar(rand));
  // Parked cars: ten in the lots, six along the roads.
  for (const lot of city.lots) {
    for (let k = 0; k < 3 && cars.filter((c) => c.kind === 'parked').length < 10; k++) {
      cars.push(makeParkedCar(rand, lot.x - 50 + k * 50, lot.y));
    }
  }
  let guard = 0;
  while (cars.filter((c) => c.kind === 'parked').length < 16 && guard++ < 200) {
    const spot = randomRoadPoint(rand);
    const ox = spot.axis === 'v' ? 52 : 0;
    const oy = spot.axis === 'h' ? 52 : 0;
    const x = clamp(spot.x + ox, 40, WORLD_W - 40);
    const y = clamp(spot.y + oy, 40, WORLD_H - 40);
    if (hitsBuilding(city, x, y, 24)) continue;
    cars.push(makeParkedCar(rand, x, y));
  }
  const peds = [];
  for (let i = 0; i < 22; i++) peds.push(makePed(rand));
  const pickups = PICKUP_SPOTS.map((p) => ({ ...p, value: pickupValue(p.kind), active: true, timer: 0, temp: false }));

  return {
    player: {
      x: LANDMARKS.plaza.x, y: LANDMARKS.plaza.y, angle: 0,
      hp: 100, cash: 50, wanted: 0, gun: false, ammo: 0,
      inCar: null, speed: 0, punchCd: 0, shootCd: 0, hurtCd: 0, bustedTimer: 0,
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
    stats: { shotsFired: 0, hits: 0, pedsDown: 0, copsDown: 0 },
  };
}

// ------------------------------------------------------------------ helpers

function say(s, text, seconds = 3) {
  s.msg = text;
  s.msgTimer = seconds;
}

function nearestCopDist(s) {
  let best = Infinity;
  for (const c of s.cops) {
    const d = dist(c.x, c.y, s.player.x, s.player.y);
    if (d < best) best = d;
  }
  return best;
}

function completeMission(s) {
  const m = MISSIONS[s.missionIndex];
  if (!m) return;
  s.player.cash += m.reward;
  s.earned += m.reward;
  say(s, `${m.name} complete! +$${m.reward}`);
  s.sfx.push('mission');
  s.missionIndex++;
  s.missionPhase = 'go';
  s.missionProgress = 0;
  if (s.missionIndex === 1) {
    s.player.gun = true;
    s.player.ammo += 24;
    say(s, 'First Wheels complete! +$150 — Rico gave you a pistol (+24 ammo)');
  }
  if (s.missionIndex === 4) {
    // Vice King opens with the whole city already hunting you.
    s.player.wanted = 3;
  }
  if (s.missionIndex >= MISSIONS.length) {
    s.screen = 'won';
    say(s, 'VICE KING! You own Palmetto Bay.', 6);
  }
}

export function missionObjective(s) {
  const i = s.missionIndex;
  if (i >= MISSIONS.length) return 'You own Palmetto Bay.';
  const m = MISSIONS[i];
  if (i === 0) return s.player.inCar ? 'Drive to Rico\u2019s Garage.' : 'Steal a car (E) and drive to Rico\u2019s Garage.';
  if (i === 1) return 'Wait at the Docks for the drop.';
  if (i === 2) return s.missionPhase === 'lose' ? 'Lose the cops — stay unseen.' : 'Raise your wanted level to 2 stars.';
  if (i === 3) {
    if (s.missionPhase === 'rob') return 'Robbing the store — hold still!';
    if (s.missionPhase === 'lose') return 'Lose the cops — stay unseen.';
    return 'Go to the Corner Store.';
  }
  if (i === 4) return 'Reach the North Gate with the cops still on you.';
  return m.brief;
}

export function missionTarget(s) {
  const i = s.missionIndex;
  if (i === 0) return LANDMARKS.garage;
  if (i === 1) return LANDMARKS.docks;
  if (i === 2) return s.missionPhase === 'lose' ? LANDMARKS.spray : null;
  if (i === 3) return s.missionPhase === 'lose' ? LANDMARKS.spray : LANDMARKS.store;
  if (i === 4) return LANDMARKS.gate;
  return null;
}

// ------------------------------------------------------------------ actions

export function enterExitCar(s) {
  const p = s.player;
  if (s.screen !== 'play') return;
  if (p.inCar) {
    const car = p.inCar;
    p.inCar = null;
    p.speed = 0;
    p.x = clamp(car.x + 34, 0, WORLD_W);
    p.y = clamp(car.y + 10, 0, WORLD_H);
    return;
  }
  let best = null;
  let bestD = 70;
  for (const car of s.cars) {
    if (car.kind !== 'parked' || car.hp <= 0) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return;
  p.inCar = best;
  p.wanted = Math.min(5, p.wanted + 1);
  p.angle = best.angle;
  s.carsStolen++;
  s.sfx.push('steal');
  say(s, 'Car stolen! The cops are looking for you.');
}

export function punch(s) {
  const p = s.player;
  if (s.screen !== 'play' || p.inCar || p.punchCd > 0) return;
  p.punchCd = 0.45;
  s.sfx.push('punch');
  const hx = p.x + Math.cos(p.angle) * PUNCH_REACH;
  const hy = p.y + Math.sin(p.angle) * PUNCH_REACH;
  const hitOne = (t, isCop) => {
    const d = dist(hx, hy, t.x, t.y);
    if (d > PUNCH_RADIUS) return false;
    t.hp -= PUNCH_DAMAGE;
    const away = Math.atan2(t.y - p.y, t.x - p.x);
    t.x = clamp(t.x + Math.cos(away) * 18, 0, WORLD_W);
    t.y = clamp(t.y + Math.sin(away) * 18, 0, WORLD_H);
    if (t.hp <= 0) {
      if (isCop) {
        s.cops.splice(s.cops.indexOf(t), 1);
        s.stats.copsDown++;
        p.wanted = Math.min(5, p.wanted + 1);
        dropCash(s, t.x, t.y, 20);
      } else {
        t.state = 'down';
        t.downT = 10;
        s.stats.pedsDown++;
        dropCash(s, t.x, t.y, 10);
      }
    } else if (!isCop) {
      t.state = 'flee';
      t.fleeT = 3;
    }
    return true;
  };
  for (const ped of s.peds) if (ped.state !== 'down') hitOne(ped, false);
  for (const cop of [...s.cops]) if (cop.onFoot) hitOne(cop, true);
  for (const ped of s.peds) {
    if (ped.state === 'flee') continue;
    if (dist(p.x, p.y, ped.x, ped.y) < 200 && ped.state !== 'down') { ped.state = 'flee'; ped.fleeT = 2; }
  }
}

export function shoot(s, angle) {
  const p = s.player;
  if (s.screen !== 'play' || p.inCar || !p.gun || p.ammo <= 0 || p.shootCd > 0) return;
  p.ammo--;
  p.shootCd = 0.22;
  p.angle = angle;
  s.stats.shotsFired++;
  s.sfx.push('shoot');
  s.bullets.push({
    x: p.x + Math.cos(angle) * 22,
    y: p.y + Math.sin(angle) * 22,
    angle,
    speed: BULLET_SPEED,
    life: 1.4,
    dmg: BULLET_DAMAGE,
  });
}

function dropCash(s, x, y, value) {
  s.pickups.push({ x, y, kind: 'cash', value, active: true, timer: 0, temp: true });
}

// ------------------------------------------------------------------ updates

function updatePlayer(s, dt, input) {
  const p = s.player;
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.hurtCd = Math.max(0, p.hurtCd - dt);
  if (p.inCar) {
    const car = p.inCar;
    const top = car.topSpeed;
    const want = input.axis.y < 0 ? top : input.axis.y > 0 ? -70 : 0;
    const accel = 320;
    if (p.speed < want) p.speed = Math.min(want, p.speed + accel * dt);
    else if (p.speed > want) p.speed = Math.max(want, p.speed - accel * dt);
    if (input.axis.y === 0) p.speed *= Math.pow(0.4, dt);
    const steer = input.axis.x * 2.1 * clamp(Math.abs(p.speed) / 130, 0, 1) * (p.speed < 0 ? -1 : 1);
    p.angle += steer * dt;
    car.angle = p.angle;
    car.speed = p.speed;
    car.x = clamp(car.x + Math.cos(p.angle) * p.speed * dt, 0, WORLD_W);
    car.y = clamp(car.y + Math.sin(p.angle) * p.speed * dt, 0, WORLD_H);
    const before = { x: car.x, y: car.y };
    if (resolveBuildings(s.city, car, 20)) {
      p.speed *= 0.3;
      if (dist(before.x, before.y, car.x, car.y) > 2) s.sfx.push('crash');
    }
    p.x = car.x;
    p.y = car.y;
    if (Math.abs(p.speed) > 40 && s.time % 1 < dt) s.sfx.push('engine');
    return;
  }
  const ax = input.axis;
  const moving = ax.x !== 0 || ax.y !== 0;
  if (moving) p.angle = Math.atan2(ax.y, ax.x);
  const speed = WALK_SPEED * (input.shift ? RUN_MULT : 1);
  p.speed = moving ? speed : 0;
  p.x = clamp(p.x + ax.x * speed * dt, 0, WORLD_W);
  p.y = clamp(p.y + ax.y * speed * dt, 0, WORLD_H);
  resolveBuildings(s.city, p, 14);
}

function updateTraffic(s, dt) {
  s.lightTimer += dt;
  if (s.lightTimer >= 6) s.lightTimer -= 6;
  const verticalGreen = s.lightTimer < 3;
  for (const car of s.cars) {
    if (car.kind !== 'traffic') continue;
    let target = car.topSpeed;
    // Red light: stop before the next crossing on this road.
    const crossings = car.axis === 'v' ? STREETS : AVENUES;
    const pos = car.axis === 'v' ? car.y : car.x;
    for (const cross of crossings) {
      const ahead = (cross - pos) * car.dir;
      if (ahead > 0 && ahead < 70) {
        const green = car.axis === 'v' ? verticalGreen : !verticalGreen;
        if (!green) { target = 0; break; }
      }
    }
    // Stop for the car ahead in the same lane.
    for (const other of s.cars) {
      if (other === car) continue;
      if (other.axis !== car.axis || other.line !== car.line || other.dir !== car.dir) continue;
      const along = car.axis === 'v' ? (other.y - car.y) * car.dir : (other.x - car.x) * car.dir;
      if (along > 0 && along < 58) { target = 0; break; }
    }
    // Stop for the player on foot right ahead.
    if (!s.player.inCar) {
      const dx = s.player.x - car.x;
      const dy = s.player.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 52 && side < 26) target = 0;
    }
    if (car.speed < target) car.speed = Math.min(target, car.speed + 200 * dt);
    else if (car.speed > target) car.speed = Math.max(target, car.speed - 320 * dt);
    if (car.speed > 0) {
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
    }
    // Turn at an intersection, once per crossing.
    const nearCross = crossings.find((c) => Math.abs((car.axis === 'v' ? car.y : car.x) - c) < 22);
    if (nearCross !== undefined) {
      const key = `${car.line}:${nearCross}`;
      if (car.turnKey !== key) {
        car.turnKey = key;
        if (s.rand() < 0.22) {
          const newAxis = car.axis === 'v' ? 'h' : 'v';
          const newDir = s.rand() < 0.5 ? 1 : -1;
          if (newAxis === 'h') {
            car.y = nearCross;
            car.line = nearCross;
            car.angle = newDir > 0 ? 0 : Math.PI;
          } else {
            car.x = nearCross;
            car.line = nearCross;
            car.angle = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
          car.axis = newAxis;
          car.dir = newDir;
        }
      }
    }
    // Off the map: come back on a random road.
    if (car.x < -60 || car.x > WORLD_W + 60 || car.y < -60 || car.y > WORLD_H + 60) {
      const fresh = makeTrafficCar(s.rand);
      Object.assign(car, fresh);
    }
  }
}

function updatePeds(s, dt) {
  const p = s.player;
  for (const ped of s.peds) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0) {
        ped.state = 'flee';
        ped.fleeT = 2;
        ped.hp = 25;
      }
      continue;
    }
    if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      ped.state = 'flee';
    } else if (ped.state === 'flee') {
      ped.state = 'walk';
    }
    if (ped.state === 'flee') {
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = away;
      ped.x = clamp(ped.x + Math.cos(away) * 100 * dt, 0, WORLD_W);
      ped.y = clamp(ped.y + Math.sin(away) * 100 * dt, 0, WORLD_H);
    } else {
      const d = dist(ped.x, ped.y, ped.tx, ped.ty);
      if (d < 12) {
        const t = randomRoadPoint(s.rand);
        ped.tx = t.x;
        ped.ty = t.y;
      } else {
        ped.angle = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
        ped.x = clamp(ped.x + Math.cos(ped.angle) * ped.speed * dt, 0, WORLD_W);
        ped.y = clamp(ped.y + Math.sin(ped.angle) * ped.speed * dt, 0, WORLD_H);
      }
    }
    resolveBuildings(s.city, ped, 10);
    // Run over by the player's car.
    if (p.inCar && Math.abs(p.speed) > 60 && ped.state !== 'down') {
      if (dist(p.x, p.y, ped.x, ped.y) < 30) {
        ped.state = 'down';
        ped.hp = 0;
        ped.downT = 10;
        p.wanted = Math.min(5, p.wanted + 1);
        s.kills++;
        s.stats.pedsDown++;
        s.sfx.push('crash');
        dropCash(s, ped.x, ped.y, 10);
      }
    }
  }
}

function updateBullets(s, dt) {
  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i];
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H;
    if (!dead && hitsBuilding(s.city, b.x, b.y, 2)) dead = true;
    if (!dead) {
      for (const ped of s.peds) {
        if (ped.state === 'down') continue;
        if (dist(b.x, b.y, ped.x, ped.y) < 24) {
          ped.hp -= b.dmg;
          s.stats.hits++;
          if (ped.hp <= 0) {
            ped.state = 'down';
            ped.downT = 10;
            s.stats.pedsDown++;
            s.player.wanted = Math.min(5, s.player.wanted + 1);
            dropCash(s, ped.x, ped.y, 10);
          } else {
            ped.state = 'flee';
            ped.fleeT = 3;
          }
          for (const near of s.peds) {
            if (near !== ped && near.state !== 'down' && dist(ped.x, ped.y, near.x, near.y) < 200) {
              near.state = 'flee';
              near.fleeT = 2;
            }
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (let ci = s.cops.length - 1; ci >= 0; ci--) {
        const cop = s.cops[ci];
        if (dist(b.x, b.y, cop.x, cop.y) < 24) {
          cop.hp -= b.dmg;
          s.stats.hits++;
          if (cop.hp <= 0) {
            s.cops.splice(ci, 1);
            s.stats.copsDown++;
            s.player.wanted = Math.min(5, s.player.wanted + 1);
            dropCash(s, cop.x, cop.y, 20);
          }
          dead = true;
          break;
        }
      }
    }
    if (dead) s.bullets.splice(i, 1);
  }
}

function updateCops(s, dt) {
  const p = s.player;
  const desired = p.wanted > 0 ? Math.min(2 + p.wanted, 6) : 0;
  s.spawnT = (s.spawnT ?? 0) + dt;
  if (desired > 0 && s.cops.length < desired && s.spawnT >= COP_SPAWN_SECONDS) {
    s.spawnT = 0;
    // A road point 480-720px from the player.
    let spot = null;
    for (let tries = 0; tries < 12; tries++) {
      const a = s.rand() * Math.PI * 2;
      const r = range(s.rand, 480, 720);
      const cand = nearestRoadPoint(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      if (cand && dist(p.x, p.y, cand.x, cand.y) >= 460) { spot = cand; break; }
    }
    if (spot) {
      s.cops.push(makeCop(spot.x, spot.y));
      if (s.cops.length === 1) s.sfx.push('siren');
    }
  }
  for (let i = s.cops.length - 1; i >= 0; i--) {
    const cop = s.cops[i];
    cop.ramCd = Math.max(0, cop.ramCd - dt);
    cop.punchCd = Math.max(0, cop.punchCd - dt);
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (!cop.onFoot) {
      const want = Math.atan2(p.y - cop.y, p.x - cop.x);
      cop.angle = angleLerp(cop.angle, want, Math.min(1, 3.2 * dt));
      cop.speed = 260;
      cop.x = clamp(cop.x + Math.cos(cop.angle) * cop.speed * dt, 0, WORLD_W);
      cop.y = clamp(cop.y + Math.sin(cop.angle) * cop.speed * dt, 0, WORLD_H);
      resolveBuildings(s.city, cop, 20);
      cop.carX = cop.x;
      cop.carY = cop.y;
      cop.carAngle = cop.angle;
      if (d < 130 && !p.inCar) {
        cop.onFoot = true;
        cop.speed = 0;
      } else if (p.inCar && d < 46 && cop.ramCd <= 0) {
        cop.ramCd = 0.5;
        p.inCar.hp -= 30;
        s.sfx.push('crash');
        p.inCar.x = clamp(p.inCar.x + Math.cos(cop.angle) * 26, 0, WORLD_W);
        p.inCar.y = clamp(p.inCar.y + Math.sin(cop.angle) * 26, 0, WORLD_H);
        if (p.inCar.hp <= 0) {
          const wreck = p.inCar;
          p.inCar = null;
          p.speed = 0;
          p.x = clamp(wreck.x + 34, 0, WORLD_W);
          p.y = clamp(wreck.y + 10, 0, WORLD_H);
          say(s, 'Your car is wrecked!');
        }
      }
    } else {
      if (d > 350) {
        // Too far on foot: get back in the cruiser.
        const cd = dist(cop.x, cop.y, cop.carX, cop.carY);
        if (cd < 30) {
          cop.onFoot = false;
        } else {
          const back = Math.atan2(cop.carY - cop.y, cop.carX - cop.x);
          cop.angle = back;
          cop.x += Math.cos(back) * 165 * dt;
          cop.y += Math.sin(back) * 165 * dt;
        }
        cop.closeT = Math.max(0, cop.closeT - dt);
      } else {
        const chase = Math.atan2(p.y - cop.y, p.x - cop.x);
        cop.angle = chase;
        cop.x = clamp(cop.x + Math.cos(chase) * 165 * dt, 0, WORLD_W);
        cop.y = clamp(cop.y + Math.sin(chase) * 165 * dt, 0, WORLD_H);
        resolveBuildings(s.city, cop, 12);
        if (d < 42) {
          cop.closeT += dt;
          if (cop.punchCd <= 0) {
            cop.punchCd = 0.8;
            p.hp -= 10;
            p.hurtCd = 0.4;
          }
          if (cop.closeT >= 1.4) {
            p.cash = Math.max(0, p.cash - BUSTED_FINE);
            p.hp = 60;
            p.wanted = 0;
            p.x = LANDMARKS.plaza.x;
            p.y = LANDMARKS.plaza.y;
            if (p.inCar) { p.inCar.hp = Math.max(p.inCar.hp, 40); p.inCar = null; p.speed = 0; }
            s.cops.length = 0;
            s.screen = 'busted';
            s.sfx.push('busted');
            say(s, `Busted! Fine $${BUSTED_FINE}. The heat is off — for now.`, 5);
            return;
          }
        } else {
          cop.closeT = Math.max(0, cop.closeT - dt);
        }
      }
    }
  }
  if (p.hp <= 0) {
    p.cash = Math.floor(p.cash / 2);
    p.hp = 100;
    p.wanted = 0;
    p.x = LANDMARKS.plaza.x;
    p.y = LANDMARKS.plaza.y;
    if (p.inCar) { p.inCar = null; p.speed = 0; }
    s.cops.length = 0;
    s.screen = 'wasted';
    s.sfx.push('wasted');
    say(s, 'Wasted! You lost half your cash.', 5);
  }
}

function updatePickups(s, dt) {
  const p = s.player;
  for (let i = s.pickups.length - 1; i >= 0; i--) {
    const pk = s.pickups[i];
    if (!pk.active) {
      pk.timer -= dt;
      if (pk.timer <= 0) {
        if (pk.temp) { s.pickups.splice(i, 1); continue; }
        pk.active = true;
      }
      continue;
    }
    if (dist(p.x, p.y, pk.x, pk.y) < 32) {
      if (pk.kind === 'health') p.hp = Math.min(100, p.hp + pk.value);
      else if (pk.kind === 'ammo') { p.gun = true; p.ammo += pk.value; }
      else p.cash += pk.value;
      pk.active = false;
      pk.timer = 20;
      s.sfx.push(pk.kind === 'cash' ? 'cash' : 'pickup');
    }
  }
}

function updateWanted(s, dt) {
  const p = s.player;
  if (p.wanted <= 0) { s.unseenTimer = 0; return; }
  if (nearestCopDist(s) > UNSEEN_RANGE) {
    s.unseenTimer += dt;
    if (s.unseenTimer >= STAR_DROP_SECONDS) {
      p.wanted--;
      s.unseenTimer = 0;
      say(s, 'A star dropped. Stay out of sight.');
    }
  } else {
    s.unseenTimer = 0;
  }
}

function updateMissions(s, dt) {
  const p = s.player;
  const i = s.missionIndex;
  if (i >= MISSIONS.length) return;
  if (i === 0) {
    if (p.inCar && insideLandmark(p, LANDMARKS.garage)) completeMission(s);
    return;
  }
  if (i === 1) {
    if (insideLandmark(p, LANDMARKS.docks)) {
      s.missionProgress += dt;
      if (s.missionProgress >= 1.5) completeMission(s);
    } else {
      s.missionProgress = 0;
    }
    return;
  }
  if (i === 2) {
    if (s.missionPhase === 'go' && p.wanted >= 2) {
      s.missionPhase = 'lose';
      say(s, 'Two stars! Now lose them all.');
    } else if (s.missionPhase === 'lose' && p.wanted === 0) {
      completeMission(s);
    }
    return;
  }
  if (i === 3) {
    if (s.missionPhase === 'go') {
      if (insideLandmark(p, LANDMARKS.store)) {
        s.missionPhase = 'rob';
        s.missionProgress = 0;
        say(s, 'Hold still — emptying the till…');
      }
    } else if (s.missionPhase === 'rob') {
      if (insideLandmark(p, LANDMARKS.store)) {
        s.missionProgress += dt;
        if (s.missionProgress >= 4) {
          p.cash += 200;
          s.earned += 200;
          p.wanted = Math.min(5, p.wanted + 2);
          s.missionPhase = 'lose';
          s.missionProgress = 0;
          s.sfx.push('cash');
          say(s, 'Till emptied: +$200! Lose the cops.');
        }
      } else {
        s.missionProgress = Math.max(0, s.missionProgress - dt);
      }
    } else if (s.missionPhase === 'lose' && p.wanted === 0) {
      completeMission(s);
    }
    return;
  }
  if (i === 4) {
    if (insideLandmark(p, LANDMARKS.gate) && p.wanted > 0) completeMission(s);
  }
}

// ------------------------------------------------------------------ step

export function step(s, dt, input) {
  if (s.screen !== 'play') return;
  dt = Math.min(dt, 0.05);
  s.time += dt;
  s.sprayCd = Math.max(0, s.sprayCd - dt);
  s.msgTimer = Math.max(0, s.msgTimer - dt);
  if (s.msgTimer === 0) s.msg = '';
  updatePlayer(s, dt, input || { axis: { x: 0, y: 0 }, shift: false });
  updateTraffic(s, dt);
  updatePeds(s, dt);
  updateBullets(s, dt);
  updateCops(s, dt);
  if (s.screen !== 'play') return;
  updatePickups(s, dt);
  updateWanted(s, dt);
  // Pay n Spray: a clean car and a clean record for $100.
  const p = s.player;
  if (p.inCar && p.wanted > 0 && p.cash >= SPRAY_COST && s.sprayCd <= 0 && insideLandmark(p, LANDMARKS.spray)) {
    p.cash -= SPRAY_COST;
    p.wanted = 0;
    s.cops.length = 0;
    s.sprayCd = SPRAY_COOLDOWN;
    s.sfx.push('cash');
    say(s, 'Pay n Spray: fresh paint, clean record. -$100');
  }
  updateMissions(s, dt);
}
