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

function addWanted(s, n) {
  const p = s.player;
  const before = p.wanted;
  p.wanted = clamp(p.wanted + n, 0, 5);
  if (p.wanted > before) {
    s.unseenTimer = 0;
    if (p.wanted >= 2) s.sfx.push('siren');
  }
}

function roadSpot(rand) {
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
    const spot = roadSpot(s.rand);
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
    const spot = roadSpot(s.rand);
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
    const spot = roadSpot(s.rand);
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

export function missionTarget(s) {
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
          addWanted(s, 2);
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

// ---- damage, wanted, police -----------------------------------------------

function wastePlayer(s) {
  const p = s.player;
  const lost = Math.floor(p.cash / 2);
  p.cash -= lost;
  p.hp = 100;
  p.inCar = null;
  p.x = LANDMARKS.plaza.x; p.y = LANDMARKS.plaza.y;
  p.wanted = 0;
  s.cops.length = 0;
  s.sfx.push('wasted');
  s.screen = 'wasted';
  say(s, 'Wasted! You lost $' + lost + '. The hospital patched you up.', 5);
}

function bustPlayer(s) {
  const p = s.player;
  p.cash = Math.max(0, p.cash - 50);
  p.hp = 60;
  p.inCar = null;
  p.x = LANDMARKS.plaza.x; p.y = LANDMARKS.plaza.y;
  p.wanted = 0;
  s.cops.length = 0;
  s.screen = 'busted';
  say(s, 'Busted! The fine cost you $50.', 5);
}

function damagePlayer(s, dmg) {
  const p = s.player;
  if (p.hurtCd > 0) return;
  p.hp -= dmg;
  p.hurtCd = 0.5;
  if (p.hp <= 0) wastePlayer(s);
}

function spawnCopCar(s) {
  const p = s.player;
  const spot = nearestRoadPoint(p.x + (s.rand() < 0.5 ? -1 : 1) * range(s.rand, 480, 720), p.y + (s.rand() < 0.5 ? -1 : 1) * range(s.rand, 480, 720));
  s.cops.push({
    x: spot.x, y: spot.y, angle: Math.atan2(p.y - spot.y, p.x - spot.x),
    speed: 0, topSpeed: 260, inCar: true, hp: 80, carHp: 120,
    punchCd: 0, ramCd: 0, color: '#20242c',
  });
  s.sfx.push('siren');
}

function stepPolice(s, dt) {
  const p = s.player;
  const want = p.wanted > 0 ? Math.min(2 + p.wanted, 6) : 0;
  s._copTimer = (s._copTimer || 0) + dt;
  if (s.cops.length < want && s._copTimer > 0.5) {
    s._copTimer = 0;
    spawnCopCar(s);
  }
  if (p.wanted === 0) {
    // Cops give up and drive off.
    for (const c of s.cops) {
      c.x += Math.cos(c.angle) * 120 * dt;
      c.y += Math.sin(c.angle) * 120 * dt;
    }
    s.cops = s.cops.filter((c) => c.x > -100 && c.x < WORLD_W + 100 && c.y > -100 && c.y < WORLD_H + 100);
    return;
  }
  for (const c of s.cops) {
    const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y));
    const targetAngle = Math.atan2(p.y - c.y, p.x - c.x);
    if (c.inCar) {
      c.angle = angleLerp(c.angle, targetAngle, 1 - Math.pow(0.02, dt));
      c.speed = Math.min(c.topSpeed, c.speed + 300 * dt);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      const pos = resolveBuildings(s.city, c.x, c.y, 18);
      c.x = pos.x; c.y = pos.y;
      if (d < 46) {
        c.ramCd -= dt;
        if (c.ramCd <= 0) {
          c.ramCd = 0.5;
          if (p.inCar) {
            p.inCar.hp -= 30;
            s.sfx.push('crash');
            if (p.inCar.hp <= 0) {
              p.inCar = null;
              say(s, 'Your car is wrecked!', 3);
            }
          } else {
            damagePlayer(s, 12);
          }
        }
      }
      if (!p.inCar && d < 130) {
        // Cop gets out and chases on foot.
        c.inCar = false;
        c.speed = 0;
      }
    } else {
      c.angle = angleLerp(c.angle, targetAngle, 1 - Math.pow(0.01, dt));
      c.x += Math.cos(c.angle) * 165 * dt;
      c.y += Math.sin(c.angle) * 165 * dt;
      const pos = resolveBuildings(s.city, c.x, c.y, 14);
      c.x = pos.x; c.y = pos.y;
      if (d < 30) {
        c.punchCd -= dt;
        if (c.punchCd <= 0) {
          c.punchCd = 0.8;
          damagePlayer(s, 10);
        }
        p.bustedTimer += dt;
        if (p.bustedTimer > 1.4) { p.bustedTimer = 0; bustPlayer(s); }
      } else {
        p.bustedTimer = Math.max(0, p.bustedTimer - dt);
      }
    }
  }
  // Cops far from the player are dropped so the streets clear.
  s.cops = s.cops.filter((c) => dist2(c.x, c.y, p.x, p.y) < 1600 * 1600);
}

function stepWanted(s, dt) {
  const p = s.player;
  if (p.wanted === 0) return;
  if (!copSeesPlayer(s)) {
    s.unseenTimer += dt;
    if (s.unseenTimer > 26) {
      p.wanted--;
      s.unseenTimer = 0;
      say(s, 'The heat is cooling. Wanted: ' + p.wanted + ' star' + (p.wanted === 1 ? '' : 's') + '.', 3);
    }
  } else s.unseenTimer = 0;
}

// ---- traffic, peds, pickups -----------------------------------------------

function stepTraffic(s, dt) {
  const p = s.player;
  s.lightTimer += dt;
  if (s.lightTimer > 6) s.lightTimer = 0;
  const verticalGreen = s.lightTimer < 3;
  for (const c of s.cars) {
    if (c.kind !== 'traffic') continue;
    // Stop at a red light when close to an intersection.
    let blocked = false;
    if (verticalGreen) {
      for (const sy of STREETS) {
        const dy = sy - c.y;
        if (Math.abs(c.x % 384) < 200 && Math.abs(dy) < 46 && Math.abs(dy) > 6 && Math.sin(c.angle) * dy > 0) blocked = true;
      }
    } else {
      for (const ax of AVENUES) {
        const dx = ax - c.x;
        if (Math.abs(dx) < 46 && Math.abs(dx) > 6 && Math.cos(c.angle) * dx > 0) blocked = true;
      }
    }
    // Stop for the car ahead.
    for (const o of s.cars) {
      if (o === c) continue;
      const dx = o.x - c.x, dy = o.y - c.y;
      const ahead = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
      const side = Math.abs(-dx * Math.sin(c.angle) + dy * Math.cos(c.angle));
      if (ahead > 0 && ahead < 58 && side < 22) { blocked = true; break; }
    }
    if (blocked) {
      c.speed = Math.max(0, c.speed - 300 * dt);
    } else {
      c.speed = Math.min(c.topSpeed, c.speed + 120 * dt);
      // Random turns at intersections.
      if (onRoad(c.x, c.y) && s.rand() < dt * 0.06) {
        c.angle += (s.rand() < 0.5 ? -1 : 1) * Math.PI / 2;
      }
    }
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    if (c.x < 20 || c.x > WORLD_W - 20 || c.y < 20 || c.y > WORLD_H - 20) {
      // Wrap to the far side so traffic never runs out.
      const spot = roadSpot(s.rand);
      c.x = spot.x; c.y = spot.y; c.angle = spot.angle;
      c.speed = 60;
    }
    const pos = resolveBuildings(s.city, c.x, c.y, 16);
    c.x = pos.x; c.y = pos.y;
  }
}

function stepPeds(s, dt) {
  const p = s.player;
  for (const ped of s.peds) {
    if (ped.state === 'down') {
      ped.fleeTimer -= dt;
      if (ped.fleeTimer <= 0) { ped.state = 'walk'; ped.hp = 50; }
      continue;
    }
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = angleLerp(ped.angle, away, 1 - Math.pow(0.05, dt));
      ped.x += Math.cos(ped.angle) * 120 * dt;
      ped.y += Math.sin(ped.angle) * 120 * dt;
      if (ped.fleeTimer <= 0) ped.state = 'walk';
    } else {
      // Wander, mostly along the roads.
      if (s.rand() < dt * 0.15) ped.angle += (s.rand() - 0.5) * 2;
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (!onRoad(ped.x, ped.y) && s.rand() < dt * 0.5) ped.angle += Math.PI / 2;
    }
    const pos = resolveBuildings(s.city, ped.x, ped.y, 12);
    ped.x = clamp(pos.x, 20, WORLD_W - 20);
    ped.y = clamp(pos.y, 20, WORLD_H - 20);
    // Run over by the player's car.
    if (p.inCar && dist2(ped.x, ped.y, p.x, p.y) < 34 * 34 && ped.state !== 'down') {
      ped.state = 'down';
      ped.fleeTimer = 8;
      s.kills++;
      addWanted(s, 1);
      s.sfx.push('crash');
      s.pickups.push({ kind: 'cash', x: ped.x, y: ped.y, amount: 10, bob: 0 });
      say(s, 'You ran over a pedestrian. The police noticed.', 3);
    }
  }
}

function stepPickups(s, dt) {
  const p = s.player;
  for (const pk of s.pickups) {
    pk.bob += dt;
    if (dist2(pk.x, pk.y, p.x, p.y) < 30 * 30) {
      if (pk.kind === 'health' && p.hp < 100) {
        p.hp = Math.min(100, p.hp + 40);
        pk.taken = true;
        s.sfx.push('pickup');
        say(s, 'Health +40.', 2);
      } else if (pk.kind === 'ammo') {
        p.gun = true;
        p.ammo += 24;
        pk.taken = true;
        s.sfx.push('pickup');
        say(s, 'Ammo +24.', 2);
      } else if (pk.kind === 'cash') {
        p.cash += pk.amount;
        s.earned += pk.amount;
        pk.taken = true;
        s.sfx.push('cash');
      }
    }
  }
  s.pickups = s.pickups.filter((pk) => !pk.taken);
  // Respawn health and ammo at their fixed spots so the map stays useful.
  const respawn = [
    { kind: 'health', x: 1008, y: 936 }, { kind: 'health', x: 2160, y: 1296 },
    { kind: 'health', x: 624, y: 576 }, { kind: 'ammo', x: 1776, y: 1656 },
    { kind: 'ammo', x: 240, y: 1656 }, { kind: 'ammo', x: 2544, y: 936 },
  ];
  for (const sp of respawn) {
    const exists = s.pickups.some((pk) => pk.kind === sp.kind && dist2(pk.x, pk.y, sp.x, sp.y) < 4);
    if (!exists && s.rand() < dt * 0.02) s.pickups.push({ ...sp, amount: 0, bob: 0 });
  }
}

// ---- combat ----------------------------------------------------------------

function stepBullets(s, dt) {
  for (const b of s.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    if (hitsBuilding(s.city, b.x, b.y, 2)) b.life = 0;
    for (const ped of s.peds) {
      if (ped.state !== 'down' && dist2(b.x, b.y, ped.x, ped.y) < 20 * 20) {
        ped.hp -= 34;
        b.life = 0;
        if (ped.hp <= 0) {
          ped.state = 'down';
          ped.fleeTimer = 8;
          s.kills++;
          addWanted(s, 1);
          s.pickups.push({ kind: 'cash', x: ped.x, y: ped.y, amount: 10, bob: 0 });
        }
        break;
      }
    }
    for (const c of s.cops) {
      if (dist2(b.x, b.y, c.x, c.y) < 22 * 22) {
        if (c.inCar) c.carHp -= 34; else c.hp -= 34;
        b.life = 0;
        if (c.inCar && c.carHp <= 0) { c.inCar = false; c.speed = 0; }
        if (!c.inCar && c.hp <= 0) {
          s.cops = s.cops.filter((o) => o !== c);
          s.kills++;
          s.pickups.push({ kind: 'cash', x: c.x, y: c.y, amount: 20, bob: 0 });
          addWanted(s, 1);
        }
        break;
      }
    }
    for (const car of s.cars) {
      if (car.kind === 'traffic' && dist2(b.x, b.y, car.x, car.y) < 22 * 22) {
        car.hp -= 34;
        b.life = 0;
        if (car.hp <= 0) {
          car.kind = 'parked';
          car.speed = 0;
          car.driver = false;
          addWanted(s, 1);
        }
        break;
      }
    }
  }
  s.bullets = s.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < WORLD_W && b.y > 0 && b.y < WORLD_H);
}

export function punch(s) {
  const p = s.player;
  if (p.punchCd > 0 || p.inCar) return;
  p.punchCd = 0.45;
  s.stats.punches++;
  s.sfx.push('punch');
  const hx = p.x + Math.cos(p.angle) * 26;
  const hy = p.y + Math.sin(p.angle) * 26;
  for (const ped of s.peds) {
    if (ped.state !== 'down' && dist2(hx, hy, ped.x, ped.y) < 30 * 30) {
      ped.hp -= 25;
      ped.state = 'flee';
      ped.fleeTimer = 3;
      if (ped.hp <= 0) {
        ped.state = 'down';
        ped.fleeTimer = 8;
        s.kills++;
        addWanted(s, 1);
        s.pickups.push({ kind: 'cash', x: ped.x, y: ped.y, amount: 10, bob: 0 });
      }
    }
  }
  for (const c of s.cops) {
    if (!c.inCar && dist2(hx, hy, c.x, c.y) < 30 * 30) {
      c.hp -= 25;
      if (c.hp <= 0) {
        s.cops = s.cops.filter((o) => o !== c);
        s.kills++;
        s.pickups.push({ kind: 'cash', x: c.x, y: c.y, amount: 20, bob: 0 });
      }
    }
  }
}

export function shoot(s, angle) {
  const p = s.player;
  if (!p.gun || p.ammo <= 0 || p.shootCd > 0 || p.inCar) return;
  p.shootCd = 0.22;
  p.ammo--;
  p.angle = angle;
  s.stats.shots++;
  s.sfx.push('shoot');
  s.bullets.push({ x: p.x + Math.cos(angle) * 20, y: p.y + Math.sin(angle) * 20, angle, speed: 720, life: 1.2 });
}

// ---- player movement -------------------------------------------------------

function stepPlayer(s, dt, input) {
  const p = s.player;
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.hurtCd = Math.max(0, p.hurtCd - dt);
  s.sprayCd = Math.max(0, s.sprayCd - dt);
  const ax = input.axis || { x: 0, y: 0 };
  if (p.inCar) {
    const car = p.inCar;
    const drive = ax.y !== 0 ? -ax.y : 0; // W is forward
    const steer = ax.x;
    if (drive !== 0) {
      car.speed += drive * 320 * dt;
      if (drive > 0 && car.speed > car.topSpeed) car.speed = car.topSpeed;
      if (drive < 0 && car.speed < -120) car.speed = -120;
    } else {
      car.speed *= Math.pow(0.4, dt);
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    if (Math.abs(car.speed) > 8) car.angle += steer * 1.9 * dt * Math.sign(car.speed);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const pos = resolveBuildings(s.city, car.x, car.y, 18);
    if (pos.x !== car.x || pos.y !== car.y) {
      if (Math.abs(car.speed) > 140) { car.hp -= 12; s.sfx.push('crash'); }
      car.speed *= 0.4;
      car.x = pos.x; car.y = pos.y;
    }
    car.x = clamp(car.x, 20, WORLD_W - 20);
    car.y = clamp(car.y, 20, WORLD_H - 20);
    p.x = car.x; p.y = car.y;
    p.angle = car.angle;
    // Pay n Spray: repaint and lose the heat, $100.
    const sp = LANDMARKS.spray;
    if (p.wanted > 0 && p.cash >= 100 && dist2(p.x, p.y, sp.x, sp.y) < sp.r * sp.r && s.sprayCd <= 0) {
      p.cash -= 100;
      p.wanted = 0;
      s.cops.length = 0;
      s.sprayCd = 10;
      s.sfx.push('cash');
      say(s, 'Pay n Spray: fresh paint, clean record. -$100.', 4);
    }
  } else {
    const run = input.shift ? 1.7 : 1;
    const speed = 170 * run;
    let mx = ax.x, my = ax.y;
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    if (len > 0) p.angle = Math.atan2(my, mx);
    const pos = resolveBuildings(s.city, p.x, p.y, 14);
    p.x = pos.x; p.y = pos.y;
  }
}

export function enterExitCar(s) {
  const p = s.player;
  if (p.inCar) {
    const car = p.inCar;
    p.inCar = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    const pos = resolveBuildings(s.city, p.x, p.y, 14);
    p.x = pos.x; p.y = pos.y;
    return;
  }
  const car = nearestCar(s, p.x, p.y, 56);
  if (!car) return;
  p.inCar = car;
  car.kind = 'parked';
  car.driver = true;
  p.speed = 0;
  if (car.id.startsWith('p') || car.id.startsWith('r')) {
    s.carsStolen++;
    addWanted(s, 1);
    say(s, 'Car stolen! The owner called the cops.', 3);
  }
  s.sfx.push('engine');
}

// ---- main step --------------------------------------------------------------

export function step(s, dt, input) {
  s.time += Math.min(dt, 0.05);
  dt = Math.min(dt, 0.05);
  if (s.screen !== 'play') return;
  if (s.msgTimer > 0) s.msgTimer -= dt;
  stepPlayer(s, dt, input || { axis: { x: 0, y: 0 } });
  stepTraffic(s, dt);
  stepPeds(s, dt);
  stepPolice(s, dt);
  stepWanted(s, dt);
  stepBullets(s, dt);
  stepPickups(s, dt);
  stepMissions(s, dt);
}
