// Sunset Vice simulation: pure logic, no DOM, no canvas. Node can import it
// for headless tests; the browser loop in main.js drives it each frame.
import { AVENUES, STREETS, WORLD_W, WORLD_H, LANDMARKS, buildCity, hitsBuilding, resolveBuildings, nearestRoadPoint, onRoad } from './city.js';
import { mulberry32, pick, range, rangeInt, clamp, angleLerp, dist2 } from './rng.js';

export const MISSIONS = [
  { name: 'First Wheels', brief: 'Steal a car, then bring it to the Garage.', reward: 150 },
  { name: 'The Pickup', brief: 'Collect the package at the Docks.', reward: 250 },
  { name: 'Hot Pursuit', brief: 'Get to 2 stars, then lose the heat.', reward: 300 },
  { name: 'The Score', brief: 'Rob the Corner Store, then get clean.', reward: 500 },
  { name: 'Vice King', brief: 'Escape a 3-star manhunt to the North Gate.', reward: 800 },
];

const CAR_COLORS = ['#d84a4a', '#4a7ad8', '#e0b13c', '#3cb371', '#c0c8d0', '#8c5ad8', '#e07b39', '#39c0c8'];
const PED_COLORS = ['#e8c39e', '#c98d64', '#8c5a3c', '#f0d0b0', '#a06a42'];
const SHIRTS = ['#d84a4a', '#4a7ad8', '#e0b13c', '#3cb371', '#8c5ad8', '#e07b39', '#eeeeee', '#333a44'];

export function createGame(seed) {
  const rand = mulberry32(seed || 20261118);
  const city = buildCity(rand);
  const s = {
    seed, rand, city,
    time: 0,
    screen: 'title', // title | play | paused | wasted | busted | won
    player: {
      x: 1392, y: 1296, angle: -Math.PI / 2, hp: 100, cash: 50,
      wanted: 0, gun: false, ammo: 0, inCar: null, speed: 0,
      punchCd: 0, shootCd: 0, hurtCd: 0, bustedTimer: 0,
    },
    cars: [], peds: [], cops: [], bullets: [], pickups: [],
    missionIndex: 0, missionPhase: 'go', missionTimer: 0, missionProgress: 0,
    unseenTimer: 0, sprayCd: 0, lightTimer: 0,
    kills: 0, carsStolen: 0, earned: 0,
    sfx: [], // drained by main.js each frame
    msg: '', msgTimer: 0,
    stats: { shots: 0, punches: 0 },
  };
  spawnTraffic(s, 14);
  spawnParked(s, 10);
  spawnPeds(s, 22);
  spawnPickups(s);
  return s;
}

function say(s, text, dur) {
  s.msg = text;
  s.msgTimer = dur || 4;
}

function addWanted(s, n, why) {
  const p = s.player;
  const before = p.wanted;
  p.wanted = clamp(p.wanted + n, 0, 5);
  if (p.wanted > before) {
    s.unseenTimer = 0;
    if (p.wanted >= 2) s.sfx.push('siren');
  }
}

function roadSpot(rand, margin) {
  const vertical = rand() < 0.5;
  if (vertical) {
    const ax = pick(rand, AVENUES);
    return { x: ax + (rand() < 0.5 ? -14 : 14), y: 60 + rand() * (WORLD_H - 120), angle: rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
  }
  const sy = pick(rand, STREETS);
  return { x: 60 + rand() * (WORLD_W - 120), y: sy + (rand() < 0.5 ? -14 : 14), angle: rand() < 0.5 ? 0 : Math.PI };
}

function spawnTraffic(s, n) {
  for (let i = 0; i < n; i++) {
    const spot = roadSpot(s.rand, 0);
    s.cars.push({
      id: 't' + i, kind: 'traffic', x: spot.x, y: spot.y, angle: spot.angle,
      speed: range(s.rand, 90, 130), topSpeed: range(s.rand, 110, 150),
      color: pick(s.rand, CAR_COLORS), hp: 100, driver: true, wait: 0,
    });
  }
}

function spawnParked(s, n) {
  const spots = [];
  for (const lot of s.city.lots) {
    for (let i = 0; i < 4; i++) {
      spots.push({ x: lot.x + 30 + (i % 2) * 60, y: lot.y + 30 + Math.floor(i / 2) * 60, angle: 0 });
    }
  }
  for (let i = 0; i < n && spots.length; i++) {
    const spot = spots.splice(Math.floor(s.rand() * spots.length), 1)[0];
    s.cars.push({
      id: 'p' + i, kind: 'parked', x: spot.x, y: spot.y, angle: spot.angle + (s.rand() < 0.5 ? 0 : Math.PI),
      speed: 0, topSpeed: range(s.rand, 240, 330), color: pick(s.rand, CAR_COLORS),
      hp: 100, driver: false, wait: 0,
    });
  }
  // A few parked cars along the roads too.
  for (let i = 0; i < 6; i++) {
    const spot = roadSpot(s.rand, 0);
    const off = 34;
    s.cars.push({
      id: 'r' + i, kind: 'parked',
      x: spot.x + (Math.abs(Math.sin(spot.angle)) > 0.5 ? off : 0),
      y: spot.y + (Math.abs(Math.cos(spot.angle)) > 0.5 ? off : 0),
      angle: spot.angle, speed: 0, topSpeed: range(s.rand, 240, 330),
      color: pick(s.rand, CAR_COLORS), hp: 100, driver: false, wait: 0,
    });
  }
}

function spawnPeds(s, n) {
  for (let i = 0; i < n; i++) {
    const spot = roadSpot(s.rand, 0);
    s.peds.push({
      x: spot.x + range(s.rand, -60, 60), y: spot.y + range(s.rand, -60, 60),
      angle: s.rand() * Math.PI * 2, speed: range(s.rand, 30, 55),
      state: 'walk', hp: 50, skin: pick(s.rand, PED_COLORS),
      shirt: pick(s.rand, SHIRTS), fleeTimer: 0, target: null,
    });
  }
}

function spawnPickups(s) {
  const spots = [
    { kind: 'health', x: 1008, y: 936 }, { kind: 'health', x: 2160, y: 1296 },
    { kind: 'health', x: 624, y: 576 }, { kind: 'ammo', x: 1776, y: 1656 },
    { kind: 'ammo', x: 240, y: 1656 }, { kind: 'ammo', x: 2544, y: 936 },
    { kind: 'cash', x: 1392, y: 576 }, { kind: 'cash', x: 624, y: 1296 },
  ];
  for (const sp of spots) s.pickups.push({ ...sp, amount: sp.kind === 'cash' ? 25 : 0, bob: s.rand() * 6 });
}

function nearestCar(s, x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const c of s.cars) {
    const d = dist2(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function nearestCopDist(s, x, y) {
  let bd = Infinity;
  for (const c of s.cops) bd = Math.min(bd, dist2(x, y, c.x, c.y));
  return Math.sqrt(bd);
}

function copSeesPlayer(s) {
  return nearestCopDist(s, s.player.x, s.player.y) < 460;
}

// ---- missions -------------------------------------------------------------

function missionTarget(s) {
  const m = s.missionIndex;
  if (m === 0) return LANDMARKS.garage;
  if (m === 1) return LANDMARKS.docks;
  if (m === 2) return null; // wanted-based
  if (m === 3) return LANDMARKS.store;
  if (m === 4) return LANDMARKS.gate;
  return null;
}

export function missionObjective(s) {
  if (s.missionIndex >= MISSIONS.length) return 'Vice King of Palmetto Bay.';
  const m = MISSIONS[s.missionIndex];
  if (s.missionIndex === 0) return s.player.inCar ? 'Drive to the Garage.' : 'Steal a car (stand by one, press E).';
  if (s.missionIndex === 1) return 'Go to the Docks and wait for the package.';
  if (s.missionIndex === 2) return s.missionPhase === 'lose' ? 'Lose all stars. Stay out of sight.' : 'Raise your wanted level to 2 stars.';
  if (s.missionIndex === 3) {
    if (s.missionPhase === 'go') return 'Go to the Corner Store.';
    if (s.missionPhase === 'rob') return 'Robbing... stay in the store!';
    return 'Lose all stars. Stay out of sight.';
  }
  if (s.missionIndex === 4) return 'Reach the North Gate with the heat on you.';
  return m.brief;
}

function completeMission(s) {
  const m = MISSIONS[s.missionIndex];
  s.player.cash += m.reward;
  s.earned += m.reward;
  s.sfx.push('cash', 'mission');
  say(s, m.name + ' done. +$' + m.reward, 4);
  s.missionIndex++;
  s.missionPhase = 'go';
  s.missionTimer = 0;
  s.missionProgress = 0;
  if (s.missionIndex === 1) {
    // Rico's gift after the first job: a pistol.
    s.player.gun = true;
    s.player.ammo += 24;
    say(s, 'First Wheels done. +$150. Rico gave you a pistol (+24 ammo).', 5);
  }
  if (s.missionIndex === 4) {
    // The final job starts hot.
    s.player.wanted = 3;
    s.unseenTimer = 0;
    s.sfx.push('siren');
    say(s, 'Vice King: 3 stars on you. Run for the North Gate!', 5);
  }
  if (s.missionIndex >= MISSIONS.length) {
    s.screen = 'won';
    say(s, 'You are the Vice King of Palmetto Bay.', 6);
  }
}

function stepMissions(s, dt) {
  const p = s.player;
  const m = s.missionIndex;
  if (m >= MISSIONS.length) return;
  if (m === 0) {
    if (p.inCar) {
      const g = LANDMARKS.garage;
      if (dist2(p.x, p.y, g.x, g.y) < g.r * g.r) completeMission(s);
    }
  } else if (m === 1) {
    const d = LANDMARKS.docks;
    if (dist2(p.x, p.y, d.x, d.y) < d.r * d.r) {
      s.missionProgress += dt;
      if (s.missionProgress > 1.5) completeMission(s);
    } else s.missionProgress = 0;
  } else if (m === 2) {
    if (s.missionPhase === 'go' || s.missionPhase === 'get') {
      if (p.wanted >= 2) { s.missionPhase = 'lose'; say(s, '2 stars! Now lose them.', 3); }
    } else if (p.wanted === 0) completeMission(s);
  } else if (m === 3) {
    const st = LANDMARKS.store;
    if (s.missionPhase === 'go') {
      if (dist2(p.x, p.y, st.x, st.y) < st.r * st.r) { s.missionPhase = 'rob'; s.missionProgress = 0; }
    } else if (s.missionPhase === 'rob') {
      if (dist2(p.x, p.y, st.x, st.y) < st.r * st.r) {
        s.missionProgress += dt;
        if (s.missionProgress > 4) {
          p.cash += 200;
          s.earned += 200;
          addWanted(s, 2, 'robbery');
          s.missionPhase = 'lose';
          say(s, 'Store robbed: +$200. Now lose the heat!', 4);
          s.sfx.push('cash');
        }
      } else { s.missionPhase = 'go'; s.missionProgress = 0; }
    } else if (p.wanted === 0) completeMission(s);
  } else if (m === 4) {
    const g = LANDMARKS.gate;
    if (dist2(p.x, p.y, g.x, g.y) < g.r * g.r && p.wanted > 0) completeMission(s);
  }
}

// ---- police ---------------------------------------------------------------

function stepPolice(s, dt) {
  const p = s.player;
  const want = p.wanted > 0 ? Math.min(2 + p.wanted, 6) : 0;
  // Spawn more units while under target.
  if (s.cops.length < want && s.time % 0.5 < dt) {
    const spot = nearestRoadPoint(
      p.x + (s.rand() < 0.5 ? -1 : 1) * range(s.rand, 480, 720),
      p.y + (s.rand() < 0.5 ? -1 : 1) * range(s.rand, 480, 720));
    s.cops.push({
      x: spot.x, y: spot.y, angle: 0, hp: 80, onFoot: false,
      car: null, punchCd: 0, speed: 0,
    });
    // Give the new unit a car if it spawns far away.
    const car = {
      id: 'cop' + s.time.toFixed(0) + s.cops.length, kind: 'police',
      x: spot.x, y: spot.y, angle: 0, speed: 0, topSpeed: 260,
      color: '#20242c', hp: 120, driver: true, wait: 0,
    };
    s.cars.push(car);
    s.cops[s.cops.length - 1].car = car;
  }
  // Remove units when the heat is gone.
  if (want === 0 && s.cops.length) {
    s.cops = s.cops.filter((c) => dist2(c.x, c.y, p.x, p.y) < 700 * 700);
    for (const c of s.cops) {
      if (c.car && dist2(c.x, c.y, p.x, p.y) > 650 * 650) {
        s.cars = s.cars.filter((x) => x !== c.car);
        c.car = null;
      }
    }
    s.cops = s.cops.filter((c) => c.car || dist2(c.x, c.y, p.x, p.y) < 650 * 650);
  }
  for (const c of s.cops) {
    if (c.hp <= 0) continue;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (c.car) {
      // Drive the police car at the player.
      const car = c.car;
      const wantAngle = Math.atan2(p.y - car.y, p.x - car.x);
      car.angle = angleLerp(car.angle, wantAngle, Math.min(1, dt * 3));
      car.speed = Math.min(car.topSpeed, car.speed + 320 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const fixed = resolveBuildings(s.city, car.x, car.y, 18);
      car.x = fixed.x; car.y = fixed.y;
      c.x = car.x; c.y = car.y; c.angle = car.angle;
      // Ram: damage the player's car or the player.
      if (d < 44) {
        if (p.inCar) {
          const pc = s.cars.find((x) => x.id === p.inCar);
          if (pc) {
            pc.hp -= 30 * dt;
            if (s.time % 1 < dt) s.sfx.push('crash');
            if (pc.hp <= 0) {
              p.inCar = null;
              s.sfx.push('crash');
              say(s, 'Your car is wrecked. Run!', 3);
            }
          }
        } else if (p.hurtCd <= 0) {
          p.hp -= 12;
          p.hurtCd = 0.7;
          s.sfx.push('punch');
        }
      }
      // Get out and chase on foot when close and the player is on foot.
      if (d < 130 && !p.inCar) {
        c.onFoot = true;
        s.cars = s.cars.filter((x) => x !== car);
        c.car = null;
        c.x = car.x + 24; c.y = car.y;
      }
    } else {
      // On-foot chase.
      const wantAngle = Math.atan2(p.y - c.y, p.x - c.x);
      c.angle = angleLerp(c.angle, wantAngle, Math.min(1, dt * 6));
      const sp = 165;
      c.x += Math.cos(c.angle) * sp * dt;
      c.y += Math.sin(c.angle) * sp * dt;
      const fixed = resolveBuildings(s.city, c.x, c.y, 12);
      c.x = fixed.x; c.y = fixed.y;
      c.punchCd -= dt;
      if (d < 30 && c.punchCd <= 0) {
        c.punchCd = 0.8;
        p.hp -= 10;
        p.hurtCd = 0.5;
        s.sfx.push('punch');
      }
      // Busted: a cop stays on top of a slow player.
      if (d < 30 && !p.inCar) {
        p.bustedTimer += dt;
        if (p.bustedTimer > 1.4) {
          p.bustedTimer = 0;
          bustPlayer(s);
          return;
        }
      } else p.bustedTimer = Math.max(0, p.bustedTimer - dt * 2);
    }
  }
  s.cops = s.cops.filter((c) => c.hp > 0);
}

function bustPlayer(s) {
  const p = s.player;
  const fine = Math.min(p.cash, 50);
  p.cash -= fine;
  p.wanted = 0;
  p.hp = 60;
  p.inCar = null;
  p.x = LANDMARKS.plaza.x; p.y = LANDMARKS.plaza.y;
  s.cops = [];
  s.sfx.push('wasted');
  s.screen = 'busted';
  say(s, 'Busted! The cops took $' + fine + ' and dropped you at the Plaza.', 4);
}

function wastePlayer(s) {
  const p = s.player;
  const lost = Math.floor(p.cash / 2);
  p.cash -= lost;
  p.wanted = 0;
  p.hp = 100;
  p.inCar = null;
  p.gun = p.gun; // keep the gun, lose the cash
  p.x = LANDMARKS.plaza.x; p.y = LANDMARKS.plaza.y;
  s.cops = [];
  s.sfx.push('wasted');
  s.screen = 'wasted';
  say(s, 'Wasted! You lost $' + lost + ' and woke up at the Plaza.', 4);
}

// ---- traffic and pedestrians ----------------------------------------------

function stepTraffic(s, dt) {
  const greenVertical = Math.floor(s.lightTimer / 6) % 2 === 0;
  for (const car of s.cars) {
    if (car.kind !== 'traffic') continue;
    // Car ahead: slow down.
    let blocked = false;
    for (const o of s.cars) {
      if (o === car) continue;
      const dx = o.x - car.x, dy = o.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 64 && side < 26) { blocked = true; break; }
    }
    // Red light: stop before the next intersection.
    const vertical = Math.abs(Math.sin(car.angle)) > 0.7;
    const lightRed = vertical ? !greenVertical : greenVertical;
    if (lightRed) {
      const line = vertical ? STREETS : AVENUES;
      const pos = vertical ? car.y : car.x;
      for (const l of line) {
        const ahead = (vertical ? Math.sin(car.angle) : Math.cos(car.angle)) * (l - pos);
        if (ahead > 0 && ahead < 90) { blocked = true; break; }
      }
    }
    if (blocked) {
      car.speed = Math.max(0, car.speed - 300 * dt);
      car.wait += dt;
    } else {
      car.speed = Math.min(car.topSpeed, car.speed + 120 * dt);
      car.wait = 0;
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // At an intersection, sometimes turn; at the edge, turn around.
    const nearX = AVENUES.some((a) => Math.abs(car.x - a) < 12);
    const nearY = STREETS.some((t) => Math.abs(car.y - t) < 12);
    if (nearX && nearY && s.rand() < dt * 0.35) {
      car.angle = pick(s.rand, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    }
    if (car.x < 50 || car.x > WORLD_W - 50 || car.y < 50 || car.y > WORLD_H - 50) {
      car.angle += Math.PI;
      car.x = clamp(car.x, 60, WORLD_W - 60);
      car.y = clamp(car.y, 60, WORLD_H - 60);
    }
    const fixed = resolveBuildings(s.city, car.x, car.y, 16);
    car.x = fixed.x; car.y = fixed.y;
  }
}

function stepPeds(s, dt) {
  for (const ped of s.peds) {
    if (ped.hp <= 0) continue;
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const away = Math.atan2(ped.y - s.player.y, ped.x - s.player.x);
      ped.angle = angleLerp(ped.angle, away, Math.min(1, dt * 5));
      ped.x += Math.cos(ped.angle) * 120 * dt;
      ped.y += Math.sin(ped.angle) * 120 * dt;
      if (ped.fleeTimer <= 0) ped.state = 'walk';
    } else {
      // Wander along the sidewalks; turn at intersections.
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (s.rand() < dt * 0.15) ped.angle += pick(s.rand, [-Math.PI / 2, Math.PI / 2, Math.PI]);
      if (ped.x < 40 || ped.x > WORLD_W - 40 || ped.y < 40 || ped.y > WORLD_H - 40) ped.angle += Math.PI;
      if (!onRoad(ped.x, ped.y) && s.rand() < dt * 0.2) {
        const rp = nearestRoadPoint(ped.x, ped.y);
        ped.angle = Math.atan2(rp.y - ped.y, rp.x - ped.x);
      }
    }
    const fixed = resolveBuildings(s.city, ped.x, ped.y, 10);
    ped.x = fixed.x; ped.y = fixed.y;
  }
  // Replace downed pedestrians over time so the streets stay alive.
  const alive = s.peds.filter((q) => q.hp > 0).length;
  if (alive < 14 && s.time % 1 < dt) {
    const spot = roadSpot(s.rand, 0);
    s.peds.push({
      x: spot.x + range(s.rand, -60, 60), y: spot.y + range(s.rand, -60, 60),
      angle: s.rand() * Math.PI * 2, speed: range(s.rand, 30, 55),
      state: 'walk', hp: 50, skin: pick(s.rand, PED_COLORS),
      shirt: pick(s.rand, SHIRTS), fleeTimer: 0, target: null,
    });
  }
  s.peds = s.peds.filter((q) => q.hp > 0 || s.rand() < 0.98);
}

// ---- player ----------------------------------------------------------------

function stepPlayer(s, input, dt) {
  const p = s.player;
  p.punchCd -= dt;
  p.shootCd -= dt;
  p.hurtCd -= dt;
  if (p.inCar) {
    const car = s.cars.find((c) => c.id === p.inCar);
    if (!car) { p.inCar = null; return; }
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    const accel = input.ay !== 0 ? -input.ay : 0; // W = forward
    if (accel > 0) car.speed = Math.min(car.topSpeed, car.speed + 300 * dt);
    else if (accel < 0) car.speed = Math.max(-120, car.speed - 320 * dt);
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 180 * dt);
    const steer = input.ax * (car.speed >= 0 ? 1 : -1);
    car.angle += steer * 2.1 * dt * clamp(Math.abs(car.speed) / 120, 0, 1);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const fixed = resolveBuildings(s.city, car.x, car.y, 18);
    if (fixed.x !== car.x || fixed.y !== car.y) {
      if (Math.abs(car.speed) > 140 && s.time % 0.5 < dt) s.sfx.push('crash');
      car.speed *= 0.55;
      car.x = fixed.x; car.y = fixed.y;
      car.hp -= 4;
      if (car.hp <= 0) {
        p.inCar = null;
        s.sfx.push('crash');
        say(s, 'Your car is wrecked. Run!', 3);
      }
    }
    car.x = clamp(car.x, 24, WORLD_W - 24);
    car.y = clamp(car.y, 24, WORLD_H - 24);
    p.speed = car.speed;
    // Running over pedestrians is a crime the cops notice.
    for (const ped of s.peds) {
      if (ped.hp > 0 && Math.abs(car.speed) > 60 && dist2(car.x, car.y, ped.x, ped.y) < 30 * 30) {
        ped.hp = 0;
        s.kills++;
        s.pickups.push({ kind: 'cash', x: ped.x, y: ped.y, amount: rangeInt(s.rand, 10, 30), bob: 0 });
        if (copSeesPlayer(s)) addWanted(s, 1, 'hit pedestrian');
        s.sfx.push('crash');
      }
    }
    // Exit the car.
    if (input.enter) {
      p.inCar = null;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
      car.speed = 0;
    }
    return;
  }

  // On foot.
  const run = input.run ? 1.5 : 1;
  const sp = 175 * run;
  let mx = input.ax, my = input.ay;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len; my /= len;
    p.x += mx * sp * dt;
    p.y += my * sp * dt;
    p.angle = Math.atan2(my, mx);
    p.speed = sp;
  } else p.speed = 0;
  const fixed = resolveBuildings(s.city, p.x, p.y, 12);
  p.x = fixed.x; p.y = fixed.y;

  // Enter a nearby car.
  if (input.enter) {
    const car = nearestCar(s, p.x, p.y, 56);
    if (car) {
      const wasParked = car.kind === 'parked';
      if (car.kind === 'traffic') {
        // Jacking: the driver flees on foot.
        car.driver = false;
        const d = { x: car.x, y: car.y, angle: s.rand() * 6, speed: 50, state: 'flee', hp: 50, skin: pick(s.rand, PED_COLORS), shirt: pick(s.rand, SHIRTS), fleeTimer: 4, target: null };
        s.peds.push(d);
      }
      car.kind = 'player';
      p.inCar = car.id;
      s.carsStolen++;
      s.sfx.push('engine');
      if (wasParked || car.kind === 'player') {
        if (copSeesPlayer(s)) addWanted(s, 1, 'stole car');
        else if (s.rand() < 0.35) addWanted(s, 1, 'stole car');
      }
    }
  }

  // Punch.
  if (input.punch && p.punchCd <= 0) {
    p.punchCd = 0.45;
    s.stats.punches++;
    s.sfx.push('punch');
    const hx = p.x + Math.cos(p.angle) * 26;
    const hy = p.y + Math.sin(p.angle) * 26;
    for (const ped of s.peds) {
      if (ped.hp > 0 && dist2(hx, hy, ped.x, ped.y) < 30 * 30) {
        ped.hp -= 25;
        ped.state = 'flee'; ped.fleeTimer = 3;
        if (ped.hp <= 0) {
          s.kills++;
          s.pickups.push({ kind: 'cash', x: ped.x, y: ped.y, amount: rangeInt(s.rand, 10, 30), bob: 0 });
          if (copSeesPlayer(s)) addWanted(s, 1, 'assault');
        }
      }
    }
    for (const cop of s.cops) {
      if (cop.hp > 0 && dist2(hx, hy, cop.x, cop.y) < 30 * 30) {
        cop.hp -= 25;
        addWanted(s, 1, 'hit cop');
        if (cop.hp <= 0) {
          s.kills++;
          s.pickups.push({ kind: 'cash', x: cop.x, y: cop.y, amount: 40, bob: 0 });
        }
      }
    }
  }

  // Shoot toward the mouse.
  if (input.shoot && p.shootCd <= 0 && p.gun && p.ammo > 0) {
    p.shootCd = 0.22;
    p.ammo--;
    s.stats.shots++;
    const a = input.aimAngle;
    s.bullets.push({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, vx: Math.cos(a) * 720, vy: Math.sin(a) * 720, life: 0.9 });
    s.sfx.push('shoot');
    if (copSeesPlayer(s)) addWanted(s, 1, 'gunfire');
    for (const ped of s.peds) {
      if (ped.hp > 0 && dist2(p.x, p.y, ped.x, ped.y) < 320 * 320) { ped.state = 'flee'; ped.fleeTimer = 4; }
    }
  }
}

function stepBullets(s, dt) {
  for (const b of s.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    for (const ped of s.peds) {
      if (ped.hp > 0 && dist2(b.x, b.y, ped.x, ped.y) < 14 * 14) {
        ped.hp -= 34;
        b.life = 0;
        if (ped.hp <= 0) {
          s.kills++;
          s.pickups.push({ kind: 'cash', x: ped.x, y: ped.y, amount: rangeInt(s.rand, 10, 30), bob: 0 });
          addWanted(s, 1, 'shooting');
        } else { ped.state = 'flee'; ped.fleeTimer = 4; }
        break;
      }
    }
    for (const cop of s.cops) {
      if (cop.hp > 0 && dist2(b.x, b.y, cop.x, cop.y) < 14 * 14) {
        cop.hp -= 34;
        b.life = 0;
        addWanted(s, 1, 'shot cop');
        if (cop.hp <= 0) {
          s.kills++;
          s.pickups.push({ kind: 'cash', x: cop.x, y: cop.y, amount: 40, bob: 0 });
        }
        break;
      }
    }
  }
  s.bullets = s.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < WORLD_W && b.y > 0 && b.y < WORLD_H);
}

function stepPickups(s, dt) {
  const p = s.player;
  for (const pk of s.pickups) {
    pk.bob += dt;
    if (dist2(p.x, p.y, pk.x, pk.y) < 30 * 30) {
      if (pk.kind === 'health') { p.hp = Math.min(100, p.hp + 40); say(s, 'Health +40', 2); }
      else if (pk.kind === 'ammo') { p.ammo += 24; if (!p.gun) p.gun = true; say(s, 'Ammo +24', 2); }
      else { p.cash += pk.amount; say(s, '+$' + pk.amount, 2); s.sfx.push('cash'); }
      s.sfx.push('pickup');
      pk.taken = true;
    }
  }
  s.pickups = s.pickups.filter((pk) => !pk.taken);
  // Respawn health/ammo at their home spots.
  const homes = [
    { kind: 'health', x: 1008, y: 936 }, { kind: 'health', x: 2160, y: 1296 },
    { kind: 'health', x: 624, y: 576 }, { kind: 'ammo', x: 1776, y: 1656 },
    { kind: 'ammo', x: 240, y: 1656 }, { kind: 'ammo', x: 2544, y: 936 },
  ];
  for (const h of homes) {
    if (!s.pickups.some((pk) => pk.kind === h.kind && Math.abs(pk.x - h.x) < 2 && Math.abs(pk.y - h.y) < 2)) {
      if (s.rand() < dt * 0.02) s.pickups.push({ ...h, amount: 0, bob: 0 });
    }
  }
}

function stepWanted(s, dt) {
  const p = s.player;
  if (p.wanted === 0) { s.unseenTimer = 0; return; }
  if (nearestCopDist(s, p.x, p.y) > 430) {
    s.unseenTimer += dt;
    if (s.unseenTimer > 26) {
      s.unseenTimer = 0;
      p.wanted--;
      say(s, p.wanted === 0 ? 'You lost the cops.' : 'Heat dropping: ' + p.wanted + ' stars left.', 3);
    }
  } else s.unseenTimer = 0;
  // Pay n Spray: drive in with $100 to clear the heat.
  s.sprayCd -= dt;
  const sp = LANDMARKS.spray;
  if (p.inCar && p.wanted > 0 && p.cash >= 100 && s.sprayCd <= 0 && dist2(p.x, p.y, sp.x, sp.y) < sp.r * sp.r) {
    p.cash -= 100;
    p.wanted = 0;
    s.cops = [];
    s.sprayCd = 10;
    s.sfx.push('cash');
    say(s, 'Pay n Spray: -$100, wanted cleared.', 3);
  }
}

// ---- main step --------------------------------------------------------------

export function step(s, input, dt) {
  dt = Math.min(dt, 0.05);
  s.time += dt;
  s.lightTimer += dt;
  if (s.msgTimer > 0) s.msgTimer -= dt;
  if (s.screen !== 'play') return;
  stepPlayer(s, input, dt);
  stepTraffic(s, dt);
  stepPeds(s, dt);
  stepPolice(s, dt);
  stepBullets(s, dt);
  stepPickups(s, dt);
  stepWanted(s, dt);
  stepMissions(s, dt);
  if (s.player.hp <= 0 && s.screen === 'play') wastePlayer(s);
}

export function missionTargetFor(s) {
  return missionTarget(s);
}
