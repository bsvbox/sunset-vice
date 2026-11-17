// Sunset Vice world: the city of Palmetto Bay and everything that lives in it.
// Top-down open world: roads, buildings, traffic, pedestrians, police, missions,
// combat, wanted level and saving. All original content.
import {
  BEST_KEY,
  CAR,
  COLORS,
  GUN,
  MISSIONS,
  PED_COUNT,
  PED_SPEED,
  PICKUP,
  PLAYER,
  ROAD_W,
  ROADS_X,
  ROADS_Y,
  SAVE_KEY,
  SPRAY_COST,
  STEP,
  TRAFFIC_COUNT,
  TRAFFIC_SPEED,
  WANTED,
  WORLD,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_WASTED = 1;
export const EVENT_MISSION = 2;

// Fixed places in Palmetto Bay (all on roads, sand or sidewalks, never inside buildings).
export const PLACES = {
  garage: { x: 640, y: 340, label: 'Garage' },
  docks: { x: 330, y: 1790, label: 'Docks' },
  store: { x: 990, y: 820, label: 'Corner Store' },
  northGate: { x: 1440, y: 110, label: 'North Gate' },
  spray: { x: 1840, y: 560, label: 'Pay n Spray' },
  hospital: { x: 2120, y: 1300, label: 'Hospital' },
  gunshop: { x: 700, y: 1150, label: 'Gun Shop' },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
// Push a circle out of a rectangle; returns true when a collision happened.
function resolveCircleRect(p, r, rect) {
  const cx = clamp(p.x, rect.x, rect.x + rect.w);
  const cy = clamp(p.y, rect.y, rect.y + rect.h);
  const dx = p.x - cx;
  const dy = p.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    p.x = cx + (dx / d) * r;
    p.y = cy + (dy / d) * r;
  } else {
    // Centre inside the rectangle: push out along the smallest overlap.
    const left = p.x - rect.x;
    const right = rect.x + rect.w - p.x;
    const top = p.y - rect.y;
    const bottom = rect.y + rect.h - p.y;
    const min = Math.min(left, right, top, bottom);
    if (min === left) p.x = rect.x - r;
    else if (min === right) p.x = rect.x + rect.w + r;
    else if (min === top) p.y = rect.y - r;
    else p.y = rect.y + rect.h + r;
  }
  return true;
}
function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}
function nearestRoadX(x) {
  let best = ROADS_X[0];
  for (const rx of ROADS_X) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}
function nearestRoadY(y) {
  let best = ROADS_Y[0];
  for (const ry of ROADS_Y) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}

// Build the city from a seed: blocks of buildings, two parks, a plaza, the beach.
function buildCity(random) {
  const buildings = [];
  const trees = [];
  const parks = [];
  const xs = [0, ...ROADS_X, WORLD.width];
  const ys = [0, ...ROADS_Y, WORLD.height];
  let blockIndex = 0;
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const x0 = xs[i] + ROAD_W / 2 + 10;
      const x1 = xs[i + 1] - ROAD_W / 2 - 10;
      const y0 = ys[j] + ROAD_W / 2 + 10;
      const y1 = ys[j + 1] - ROAD_W / 2 - 10;
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 60 || h < 60) continue;
      // The south strip is beach, not buildings.
      if (y0 > 1700) continue;
      blockIndex += 1;
      if (blockIndex % 7 === 3) {
        parks.push({ x: x0, y: y0, w, h });
        for (let t = 0; t < 7; t += 1) {
          trees.push({ x: random.range(x0 + 20, x1 - 20), y: random.range(y0 + 20, y1 - 20), r: random.range(9, 15) });
        }
        continue;
      }
      if (blockIndex % 11 === 5) continue; // open plaza
      const count = random.int(1, 3);
      for (let b = 0; b < count; b += 1) {
        const bw = random.range(90, Math.min(200, w * 0.55));
        const bh = random.range(80, Math.min(170, h * 0.55));
        const bx = random.range(x0, x1 - bw);
        const by = random.range(y0, y1 - bh);
        const rect = { x: bx, y: by, w: bw, h: bh, color: random.pick(COLORS.buildingRoof) };
        if (buildings.some((o) => o.x < rect.x + rect.w + 14 && o.x + o.w + 14 > rect.x && o.y < rect.y + rect.h + 14 && o.y + o.h + 14 > rect.y)) continue;
        buildings.push(rect);
      }
    }
  }
  // Palms along the beach.
  for (let x = 120; x < WORLD.width - 100; x += 90) {
    trees.push({ x: x + random.range(-20, 20), y: random.range(1780, 1850), r: 12 });
  }
  return { buildings, trees, parks };
}

function makeCar(random, x, y, angle, color, kind) {
  return {
    x, y, angle, speed: 0, color, kind,
    hp: CAR.health, driver: kind === 'traffic',
    axis: Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle)) ? 'x' : 'y',
    dir: Math.cos(angle) >= 0 ? 1 : -1,
    road: 0, targetSpeed: TRAFFIC_SPEED, stuck: 0,
    brakeLight: false,
  };
}

export function createWorld(random, audio, saved) {
  const city = buildCity(random);
  const state = {
    time: 0,
    seed: 0,
    player: {
      x: PLACES.garage.x + 64, y: PLACES.garage.y + 70, angle: -Math.PI / 2,
      hp: PLAYER.health, inCar: null, punchCd: 0, gunCd: 0, ammo: GUN.startAmmo,
      hurtCd: 0, runDust: 0,
    },
    cars: [],
    peds: [],
    cops: [],
    copCars: [],
    pickups: [],
    tracers: [],
    messages: [],
    wanted: 0,
    quietTimer: 0,
    lastSeen: { x: 0, y: 0, t: -1000 },
    money: 0,
    earned: 0,
    missionIndex: 0,
    missionStage: 0,
    missionTimer: 0,
    missionProgress: 0,
    missionDone: false,
    kills: 0,
    busted: false,
    gameOver: null,
    saveTimer: 0,
    sirenTimer: 0,
    sprayCd: 0,
  };
  if (saved) {
    state.money = saved.money || 0;
    state.earned = saved.earned || 0;
    state.missionIndex = Math.min(saved.missionIndex || 0, MISSIONS.length);
    state.kills = saved.kills || 0;
  }

  const world = {
    state,
    city,
    audio,
    random,
    reset,
    step,
    save,
    missionTarget,
    missionText,
  };

  function reset() {
    state.player.x = PLACES.garage.x + 64;
    state.player.y = PLACES.garage.y + 70;
    state.player.angle = -Math.PI / 2;
    state.player.hp = PLAYER.health;
    state.player.inCar = null;
    state.player.ammo = GUN.startAmmo;
    state.wanted = 0;
    state.gameOver = null;
    state.busted = false;
    state.cops = [];
    state.copCars = [];
    state.tracers = [];
    state.missionStage = 0;
    state.missionTimer = 0;
    state.missionProgress = 0;
    state.missionDone = state.missionIndex >= MISSIONS.length;
    spawnTraffic();
    spawnPeds();
    spawnPickups();
  }

  function spawnTraffic() {
    state.cars = [];
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
      const vertical = random.next() < 0.5;
      let x;
      let y;
      let angle;
      if (vertical) {
        const rx = random.pick(ROADS_X);
        const dir = random.next() < 0.5 ? 1 : -1;
        x = rx + (dir > 0 ? 18 : -18);
        y = random.range(100, WORLD.height - 100);
        angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        const ry = random.pick(ROADS_Y);
        const dir = random.next() < 0.5 ? 1 : -1;
        y = ry + (dir > 0 ? 18 : -18);
        x = random.range(100, WORLD.width - 100);
        angle = dir > 0 ? 0 : Math.PI;
      }
      const car = makeCar(random, x, y, angle, random.pick(COLORS.carColors), 'traffic');
      car.speed = random.range(100, TRAFFIC_SPEED);
      car.axis = vertical ? 'y' : 'x';
      car.dir = angle === 0 || angle === Math.PI / 2 ? 1 : -1;
      if (!vertical) car.dir = angle === 0 ? 1 : -1;
      car.road = vertical ? ROADS_X.indexOf(nearestRoadX(x)) : ROADS_Y.indexOf(nearestRoadY(y));
      state.cars.push(car);
    }
    // Parked cars along the roads.
    for (let i = 0; i < 9; i += 1) {
      const vertical = random.next() < 0.5;
      let x;
      let y;
      let angle;
      if (vertical) {
        const rx = random.pick(ROADS_X);
        x = rx + (random.next() < 0.5 ? 36 : -36);
        y = random.range(150, WORLD.height - 150);
        angle = random.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        const ry = random.pick(ROADS_Y);
        y = ry + (random.next() < 0.5 ? 36 : -36);
        x = random.range(150, WORLD.width - 150);
        angle = random.next() < 0.5 ? 0 : Math.PI;
      }
      const car = makeCar(random, x, y, angle, random.pick(COLORS.carColors), 'parked');
      car.driver = false;
      state.cars.push(car);
    }
  }

  function spawnPeds() {
    state.peds = [];
    for (let i = 0; i < PED_COUNT; i += 1) {
      const vertical = random.next() < 0.5;
      let x;
      let y;
      if (vertical) {
        const rx = random.pick(ROADS_X);
        x = rx + (random.next() < 0.5 ? 56 : -56);
        y = random.range(80, WORLD.height - 80);
      } else {
        const ry = random.pick(ROADS_Y);
        y = ry + (random.next() < 0.5 ? 56 : -56);
        x = random.range(80, WORLD.width - 80);
      }
      state.peds.push({
        x, y, angle: random.range(0, Math.PI * 2),
        speed: random.range(40, PED_SPEED), color: random.pick(COLORS.pedShirt),
        state: 'walk', axis: vertical ? 'y' : 'x', dir: random.next() < 0.5 ? 1 : -1,
        road: vertical ? nearestRoadX(x) : nearestRoadY(y), hp: 30, cash: random.int(10, 40),
        fleeX: 0, fleeY: 0, panic: 0,
      });
    }
  }

  function spawnPickups() {
    state.pickups = [
      { x: PLACES.hospital.x, y: PLACES.hospital.y, kind: 'health' },
      { x: PLACES.gunshop.x, y: PLACES.gunshop.y, kind: 'ammo' },
      { x: PLACES.garage.x - 60, y: PLACES.garage.y + 120, kind: 'health' },
      { x: 1500, y: 900, kind: 'cash', amount: 50 },
      { x: 900, y: 1500, kind: 'ammo' },
    ];
  }

  function say(text) {
    state.messages.push({ text, t: 0 });
    if (state.messages.length > 4) state.messages.shift();
  }

  function addWanted(stars, reason) {
    if (state.wanted >= WANTED.max) return;
    state.wanted = Math.min(WANTED.max, state.wanted + stars);
    state.quietTimer = 0;
    state.lastSeen = { x: state.player.x, y: state.player.y, t: state.time };
    if (reason) say(reason);
    spawnCops();
  }

  function spawnCops() {
    const wantCars = WANTED.copsPerStar[state.wanted];
    while (state.copCars.length < wantCars) {
      // Spawn a cop car on a road at the map edge FARTHEST from the player, so the
      // player always has room to break away.
      const px = state.player.x;
      const py = state.player.y;
      const edge = random.next() < 0.5;
      let x;
      let y;
      let angle;
      if (edge) {
        const rx = nearestRoadX(px + random.range(-300, 300));
        x = rx;
        y = py < WORLD.height / 2 ? WORLD.height - 120 : 120;
        angle = py < WORLD.height / 2 ? -Math.PI / 2 : Math.PI / 2;
      } else {
        const ry = nearestRoadY(py + random.range(-300, 300));
        y = ry;
        x = px < WORLD.width / 2 ? WORLD.width - 120 : 120;
        angle = px < WORLD.width / 2 ? Math.PI : 0;
      }
      const car = makeCar(random, x, y, angle, COLORS.copCar, 'police');
      car.speed = WANTED.copCarSpeed * 0.7;
      state.copCars.push(car);
    }
    const wantFoot = state.wanted >= 2 ? state.wanted - 1 : 0;
    while (state.cops.length < wantFoot) {
      const a = random.range(0, Math.PI * 2);
      const d = random.range(420, 560);
      state.cops.push({
        x: clamp(state.player.x + Math.cos(a) * d, 60, WORLD.width - 60),
        y: clamp(state.player.y + Math.sin(a) * d, 60, WORLD.height - 60),
        angle: a, speed: WANTED.copFootSpeed, hp: 50, punchCd: 0, shootCd: random.range(1, 2),
      });
    }
  }

  function collideBuildings(p, r) {
    let hit = false;
    for (const b of city.buildings) {
      if (resolveCircleRect(p, r, b)) hit = true;
    }
    return hit;
  }

  function collideCars(p, r, ignore) {
    let hit = null;
    const all = [...state.cars, ...state.copCars];
    if (state.player.inCar) all.push(state.player.inCar);
    for (const car of all) {
      if (car === ignore) continue;
      const d2 = dist2(p.x, p.y, car.x, car.y);
      const rr = r + 24;
      if (d2 < rr * rr) hit = car;
    }
    return hit;
  }

  // ---- per-system updates, missions, combat and saving ----

  function missionTarget() {
    if (state.missionIndex >= MISSIONS.length) return null;
    const m = MISSIONS[state.missionIndex];
    if (m.id === 'wheels') return state.missionStage === 0 ? null : PLACES.garage;
    if (m.id === 'pickup') return state.missionStage === 0 ? PLACES.docks : PLACES.garage;
    if (m.id === 'heat') return null;
    if (m.id === 'score') return state.missionStage <= 1 ? PLACES.store : PLACES.garage;
    if (m.id === 'king') return PLACES.northGate;
    return null;
  }

  function missionText() {
    if (state.missionIndex >= MISSIONS.length) return 'Story complete. Free roam: cause chaos, lose the cops, get rich.';
    const m = MISSIONS[state.missionIndex];
    if (m.id === 'wheels') return state.missionStage === 0 ? 'Steal a car (walk up to one, press E)' : 'Drive it to the garage marker';
    if (m.id === 'pickup') return state.missionStage === 0 ? 'Go to the docks marker, south side' : 'Bring the package back to the garage';
    if (m.id === 'heat') return 'Lose the heat: break line of sight and stay hidden';
    if (m.id === 'score') {
      if (state.missionStage === 0) return 'Go to the corner store on Coral Ave';
      if (state.missionStage === 1) return 'Hold E inside the store to clean it out';
      return 'Escape to the safehouse (garage)';
    }
    if (m.id === 'king') return `Deliver to the North Gate — ${Math.ceil(state.missionTimer)}s left`;
    return m.brief;
  }

  function completeMission() {
    const m = MISSIONS[state.missionIndex];
    state.money += m.reward;
    state.earned += m.reward;
    say(`Mission passed: ${m.title}  +$${m.reward}`);
    audio.mission();
    state.missionIndex += 1;
    state.missionStage = 0;
    state.missionTimer = 0;
    state.missionProgress = 0;
    state.missionDone = state.missionIndex >= MISSIONS.length;
    if (state.missionDone) say('Story complete! Palmetto Bay is yours.');
    else say(`New mission: ${MISSIONS[state.missionIndex].title}`);
    save();
  }

  function failMission(reason) {
    say(`Mission failed: ${reason}. Try again.`);
    audio.fail();
    state.missionStage = 0;
    state.missionTimer = 0;
    state.missionProgress = 0;
    state.wanted = 0;
    state.cops = [];
    state.copCars = [];
  }

  function updateMissions(dt) {
    if (state.missionIndex >= MISSIONS.length) return;
    const m = MISSIONS[state.missionIndex];
    const p = state.player;
    if (m.id === 'wheels') {
      if (state.missionStage === 0 && p.inCar) {
        state.missionStage = 1;
        say('Nice wheels. Now bring it to the garage.');
      } else if (state.missionStage === 1 && p.inCar && dist2(p.x, p.y, PLACES.garage.x, PLACES.garage.y) < 90 * 90) {
        completeMission();
      }
    } else if (m.id === 'pickup') {
      if (state.missionStage === 0 && dist2(p.x, p.y, PLACES.docks.x, PLACES.docks.y) < 70 * 70) {
        state.missionStage = 1;
        say('Package grabbed. Back to the garage.');
        audio.pickup();
      } else if (state.missionStage === 1 && dist2(p.x, p.y, PLACES.garage.x, PLACES.garage.y) < 90 * 90) {
        completeMission();
      }
    } else if (m.id === 'heat') {
      if (state.missionStage === 0) {
        state.missionStage = 1;
        addWanted(2, 'The cops are onto you!');
      } else if (state.wanted === 0) {
        completeMission();
      }
    } else if (m.id === 'score') {
      if (state.missionStage === 0 && dist2(p.x, p.y, PLACES.store.x, PLACES.store.y) < 80 * 80) {
        state.missionStage = 1;
        say('Hold E to clean out the register...');
      } else if (state.missionStage === 1) {
        const inside = dist2(p.x, p.y, PLACES.store.x, PLACES.store.y) < 80 * 80;
        if (inside && state._holdE) {
          state.missionProgress += dt;
          if (state.missionProgress >= 5) {
            state.missionStage = 2;
            state.money += 200;
            state.earned += 200;
            say('Register cleaned: +$200. Run!');
            addWanted(2, 'Silent alarm tripped!');
          }
        } else {
          state.missionProgress = Math.max(0, state.missionProgress - dt * 2);
        }
      } else if (state.missionStage === 2 && dist2(p.x, p.y, PLACES.garage.x, PLACES.garage.y) < 90 * 90 && state.wanted === 0) {
        completeMission();
      }
    } else if (m.id === 'king') {
      if (state.missionStage === 0) {
        state.missionStage = 1;
        state.missionTimer = 150;
        addWanted(3, 'Every cop in the city is looking for you!');
      } else {
        state.missionTimer -= dt;
        if (dist2(p.x, p.y, PLACES.northGate.x, PLACES.northGate.y) < 90 * 90) {
          completeMission();
        } else if (state.missionTimer <= 0) {
          failMission('Out of time at the North Gate');
        }
      }
    }
  }

  function updatePlayer(dt, input, aimAngle) {
    const p = state.player;
    p.punchCd = Math.max(0, p.punchCd - dt);
    p.gunCd = Math.max(0, p.gunCd - dt);
    p.hurtCd = Math.max(0, p.hurtCd - dt);
    if (p.inCar) {
      updatePlayerCar(dt, input);
      return;
    }
    const mv = input.move();
    const len = Math.hypot(mv.x, mv.y) || 1;
    const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const nx = mv.x / len;
    const ny = mv.y / len;
    if (mv.x !== 0 || mv.y !== 0) {
      p.x += nx * speed * dt;
      p.y += ny * speed * dt;
      p.angle = Math.atan2(ny, nx);
      p.x = clamp(p.x, 30, WORLD.width - 30);
      p.y = clamp(p.y, 30, WORLD.height - 30);
      collideBuildings(p, PLAYER.radius);
    }
    // Car collision: walking into a moving car hurts and knocks the player clear.
    const car = collideCars(p, PLAYER.radius, null);
    if (car && Math.abs(car.speed) > 120 && p.hurtCd <= 0) {
      hurtPlayer(12, 'Hit by a car');
      const a = angleTo(car.x, car.y, p.x, p.y);
      p.x += Math.cos(a) * 30;
      p.y += Math.sin(a) * 30;
    }
    // Aim with the mouse when shooting; otherwise face movement.
    if (aimAngle !== null && aimAngle !== undefined) p.angle = aimAngle;
  }

  function updatePlayerCar(dt, input) {
    const p = state.player;
    const car = p.inCar;
    const mv = input.move();
    // Steering: up/down is throttle/brake, left/right steers (relative to heading).
    const throttle = mv.y < 0 ? 1 : 0;
    const braking = mv.y > 0 ? 1 : 0;
    const steer = mv.x;
    if (throttle) car.speed += CAR.accel * dt;
    if (braking) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
    // Drag and rolling resistance.
    car.speed -= car.speed * 0.6 * dt;
    if (!throttle && !braking) car.speed -= car.speed * 1.4 * dt;
    car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
    if (Math.abs(car.speed) > 5) {
      car.angle += steer * CAR.steer * dt * (car.speed / CAR.maxSpeed) * 2.4 * Math.sign(car.speed);
    }
    const nx = p.x + Math.cos(car.angle) * car.speed * dt;
    const ny = p.y + Math.sin(car.angle) * car.speed * dt;
    const before = { x: p.x, y: p.y };
    p.x = nx;
    p.y = ny;
    car.x = p.x;
    car.y = p.y;
    const hitWall = collideBuildings(p, 20);
    if (hitWall) {
      const impact = Math.abs(car.speed);
      if (impact > 220) {
        audio.crash();
        hurtPlayer(Math.min(20, impact / 30), 'Crashed');
        car.speed *= -0.25;
      } else {
        car.speed *= 0.4;
      }
      p.x = before.x;
      p.y = before.y;
      car.x = p.x;
      car.y = p.y;
    }
    // Bump traffic cars.
    for (const other of [...state.cars, ...state.copCars]) {
      if (other === car) continue;
      const d2 = dist2(p.x, p.y, other.x, other.y);
      if (d2 < 48 * 48) {
        const d = Math.sqrt(d2) || 1;
        const push = (48 - d) / 2;
        const ux = (other.x - p.x) / d;
        const uy = (other.y - p.y) / d;
        other.x += ux * push;
        other.y += uy * push;
        other.speed *= 0.5;
        if (Math.abs(car.speed) > 200) {
          other.hp -= 20;
          car.speed *= 0.7;
          audio.crash();
          if (other.kind === 'traffic' && other.driver) {
            other.driver = false;
            ejectDriver(other);
            // A smash only brings the law when someone sees it happen.
            const witnessed = state.cops.some((c) => dist2(c.x, c.y, p.x, p.y) < 400 * 400)
              || state.copCars.some((c) => dist2(c.x, c.y, p.x, p.y) < 400 * 400)
              || state.peds.some((pd) => pd.state === 'walk' && dist2(pd.x, pd.y, p.x, p.y) < 250 * 250);
            if (witnessed) addWanted(1, 'You smashed a car — the cops noticed');
          }
        }
      }
    }
    p.x = clamp(p.x, 30, WORLD.width - 30);
    p.y = clamp(p.y, 30, WORLD.height - 30);
    car.x = p.x;
    car.y = p.y;
    p.angle = car.angle;
    audio.setEngine(Math.abs(car.speed) / CAR.maxSpeed, true);
  }

  function ejectDriver(car) {
    const a = car.angle + Math.PI / 2;
    state.peds.push({
      x: car.x + Math.cos(a) * 40, y: car.y + Math.sin(a) * 40,
      angle: a, speed: PED_SPEED * 1.4, color: '#f5f0e6',
      state: 'flee', axis: 'x', dir: 1, road: nearestRoadX(car.x), hp: 30,
      cash: 0, fleeX: car.x + Math.cos(a) * 300, fleeY: car.y + Math.sin(a) * 300, panic: 4,
    });
  }

  function hurtPlayer(amount, why) {
    const p = state.player;
    if (p.hurtCd > 0 || state.gameOver) return;
    p.hp -= amount;
    p.hurtCd = 0.5;
    audio.hit();
    if (p.hp <= 0) {
      p.hp = 0;
      state.gameOver = 'wasted';
      say(`${why}. WASTED.`);
      audio.fail();
      audio.setEngine(0, false);
    }
  }

  function enterExitCar() {
    const p = state.player;
    if (p.inCar) {
      const car = p.inCar;
      car.speed = 0;
      p.inCar = null;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
      p.x = clamp(p.x, 30, WORLD.width - 30);
      p.y = clamp(p.y, 30, WORLD.height - 30);
      collideBuildings(p, PLAYER.radius);
      audio.door();
      audio.setEngine(0, false);
      return;
    }
    // Nearest car within reach.
    let best = null;
    let bestD = 70 * 70;
    for (const car of [...state.cars, ...state.copCars]) {
      const d2 = dist2(p.x, p.y, car.x, car.y);
      if (d2 < bestD) {
        bestD = d2;
        best = car;
      }
    }
    if (!best) return;
    if (best.kind === 'traffic' && best.driver) {
      best.driver = false;
      ejectDriver(best);
      const witnessed = state.cops.some((c) => dist2(c.x, c.y, p.x, p.y) < 350 * 350)
        || state.copCars.some((c) => dist2(c.x, c.y, p.x, p.y) < 350 * 350)
        || state.peds.some((pd) => pd.state === 'walk' && dist2(pd.x, pd.y, p.x, p.y) < 250 * 250);
      if (witnessed) addWanted(1, 'Carjacking witnessed!');
      say('You jacked the car!');
    } else if (best.kind === 'police') {
      say('That is a cop car. Stealing it is a terrible idea.');
      addWanted(1, 'You tried to steal a cop car!');
      return;
    }
    if (best.kind === 'traffic' || best.kind === 'parked') {
      const idx = state.cars.indexOf(best);
      if (idx >= 0) state.cars.splice(idx, 1);
    } else {
      const idx = state.copCars.indexOf(best);
      if (idx >= 0) state.copCars.splice(idx, 1);
    }
    p.inCar = best;
    best.kind = 'player';
    best.hp = CAR.health;
    p.x = best.x;
    p.y = best.y;
    audio.door();
  }

  function punch() {
    const p = state.player;
    if (p.inCar || p.punchCd > 0) return;
    p.punchCd = PLAYER.punchCooldown;
    audio.punch();
    const tx = p.x + Math.cos(p.angle) * PLAYER.punchRange;
    const ty = p.y + Math.sin(p.angle) * PLAYER.punchRange;
    let hitAny = false;
    for (const ped of state.peds) {
      if (dist2(tx, ty, ped.x, ped.y) < 30 * 30) {
        ped.hp -= PLAYER.punchDamage;
        ped.state = 'flee';
        ped.panic = 5;
        ped.fleeX = ped.x + (ped.x - p.x);
        ped.fleeY = ped.y + (ped.y - p.y);
        hitAny = true;
        if (ped.hp <= 0) killPed(ped, 'You knocked out a pedestrian');
      }
    }
    for (const cop of state.cops) {
      if (dist2(tx, ty, cop.x, cop.y) < 30 * 30) {
        cop.hp -= PLAYER.punchDamage;
        hitAny = true;
        if (cop.hp <= 0) killCop(cop);
      }
    }
    if (hitAny) {
      const witnessed = state.cops.length > 0 || state.copCars.some((c) => dist2(c.x, c.y, p.x, p.y) < 400 * 400);
      if (witnessed) addWanted(1, 'Assault witnessed by police!');
    }
  }

  function shoot(aimAngle) {
    const p = state.player;
    if (p.inCar || p.gunCd > 0 || p.ammo <= 0) return;
    p.gunCd = GUN.cooldown;
    p.ammo -= 1;
    audio.shoot();
    const ex = p.x + Math.cos(aimAngle) * GUN.range;
    const ey = p.y + Math.sin(aimAngle) * GUN.range;
    let endX = ex;
    let endY = ey;
    let bestT = 1;
    // Buildings block the shot.
    for (const b of city.buildings) {
      const t = rayRect(p.x, p.y, ex - p.x, ey - p.y, b);
      if (t !== null && t < bestT) {
        bestT = t;
        endX = p.x + (ex - p.x) * t;
        endY = p.y + (ey - p.y) * t;
      }
    }
    const targets = [...state.peds, ...state.cops];
    for (const t of targets) {
      const tt = rayCircle(p.x, p.y, ex - p.x, ey - p.y, t.x, t.y, 16);
      if (tt !== null && tt < bestT) {
        bestT = tt;
        endX = t.x;
        endY = t.y;
        t.hp -= GUN.damage;
        if (t.hp <= 0) {
          if (state.peds.includes(t)) killPed(t, 'You shot a pedestrian');
          else killCop(t);
        } else if (state.peds.includes(t)) {
          t.state = 'flee';
          t.panic = 5;
          t.fleeX = t.x + (t.x - p.x);
          t.fleeY = t.y + (t.y - p.y);
        }
      }
    }
    for (const car of [...state.cars, ...state.copCars]) {
      const tt = rayCircle(p.x, p.y, ex - p.x, ey - p.y, car.x, car.y, 24);
      if (tt !== null && tt < bestT) {
        bestT = tt;
        endX = car.x;
        endY = car.y;
        car.hp -= GUN.damage;
        if (car.hp <= 0) {
          car.speed = 0;
          if (car.kind === 'traffic' && car.driver) {
            car.driver = false;
            ejectDriver(car);
          }
          addWanted(1, 'You wrecked a car!');
        }
      }
    }
    state.tracers.push({ x1: p.x, y1: p.y, x2: endX, y2: endY, ttl: 0.08 });
    // Gunfire draws the law.
    const nearCop = state.cops.some((c) => dist2(c.x, c.y, p.x, p.y) < 500 * 500)
      || state.copCars.some((c) => dist2(c.x, c.y, p.x, p.y) < 500 * 500);
    if (nearCop) addWanted(1, 'Shots fired!');
    else if (state.wanted === 0) {
      state.quietTimer = 0;
      addWanted(1, 'Someone called the cops!');
    }
    for (const ped of state.peds) {
      if (dist2(ped.x, ped.y, p.x, p.y) < 300 * 300) {
        ped.state = 'flee';
        ped.panic = 4;
        ped.fleeX = ped.x + (ped.x - p.x) * 2;
        ped.fleeY = ped.y + (ped.y - p.y) * 2;
      }
    }
  }

  function rayRect(x, y, dx, dy, r) {
    let tmin = 0;
    let tmax = 1;
    for (const [o, d, mn, mx] of [[x, dx, r.x, r.x + r.w], [y, dy, r.y, r.y + r.h]]) {
      if (Math.abs(d) < 1e-9) {
        if (o < mn || o > mx) return null;
      } else {
        let t1 = (mn - o) / d;
        let t2 = (mx - o) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return null;
      }
    }
    return tmin;
  }

  function rayCircle(x, y, dx, dy, cx, cy, r) {
    const ox = x - cx;
    const oy = y - cy;
    const a = dx * dx + dy * dy;
    const b = 2 * (ox * dx + oy * dy);
    const c = ox * ox + oy * oy - r * r;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t < 0 || t > 1) return null;
    return t;
  }

  function killPed(ped, message) {
    state.kills += 1;
    state.pickups.push({ x: ped.x, y: ped.y, kind: 'cash', amount: ped.cash });
    state.peds = state.peds.filter((q) => q !== ped);
    say(message);
    if (state.wanted === 0) addWanted(1, 'Someone saw that!');
    else addWanted(1, null);
  }

  function killCop(cop) {
    state.kills += 1;
    state.pickups.push({ x: cop.x, y: cop.y, kind: 'ammo', amount: PICKUP.ammo });
    state.cops = state.cops.filter((q) => q !== cop);
    say('You took down a cop. The whole city will hear about this.');
    addWanted(2, null);
  }

  // Traffic lights: each intersection cycles; NS green then EW green, 7s each.
  function lightGreen(axis, ix, iy) {
    const phase = (state.time + ix * 3.1 + iy * 5.7) % 14;
    const nsGreen = phase < 7;
    return axis === 'y' ? nsGreen : !nsGreen;
  }

  function updateTraffic(dt) {
    for (const car of state.cars) {
      if (car.kind !== 'traffic' || !car.driver) continue;
    // Car ahead on the same road?
      let blocked = false;
      for (const other of state.cars) {
        if (other === car || other.kind !== 'traffic') continue;
        if (other.axis !== car.axis || other.dir !== car.dir) continue;
        const along = car.axis === 'y' ? (other.y - car.y) * car.dir : (other.x - car.x) * car.dir;
        const side = car.axis === 'y' ? Math.abs(other.x - car.x) : Math.abs(other.y - car.y);
        if (along > 0 && along < 70 && side < 30) blocked = true;
      }
      // A pedestrian on foot in front of the car: brake for them.
      const pp = state.player;
      if (!pp.inCar) {
        const along = car.axis === 'y' ? (pp.y - car.y) * car.dir : (pp.x - car.x) * car.dir;
        const side = car.axis === 'y' ? Math.abs(pp.x - car.x) : Math.abs(pp.y - car.y);
        if (along > 0 && along < 80 && side < 30) blocked = true;
      }
      // Red light ahead?
      const roads = car.axis === 'y' ? ROADS_Y : ROADS_X;
      const pos = car.axis === 'y' ? car.y : car.x;
      for (let i = 0; i < roads.length; i += 1) {
        const ahead = (roads[i] - pos) * car.dir;
        if (ahead > 0 && ahead < 70) {
          const ix = car.axis === 'y' ? car.road : i;
          const iy = car.axis === 'y' ? i : car.road;
          if (!lightGreen(car.axis, ix, iy)) blocked = true;
        }
      }
      car.targetSpeed = blocked ? 0 : TRAFFIC_SPEED;
      car.speed += clamp(car.targetSpeed - car.speed, -260 * dt, 200 * dt);
      // Move along the road; maybe turn at an intersection.
      const cross = car.axis === 'y' ? ROADS_Y : ROADS_X;
      const alongPos = car.axis === 'y' ? car.y : car.x;
      for (let i = 0; i < cross.length; i += 1) {
        const d = (cross[i] - alongPos) * car.dir;
        if (d > 0 && d < Math.abs(car.speed) * dt + 2 && random.next() < 0.28) {
          // Turn onto the cross road.
          const newDir = random.next() < 0.5 ? 1 : -1;
          const lane = 18;
          if (car.axis === 'y') {
            car.axis = 'x';
            car.dir = newDir;
            car.y = cross[i] + (newDir > 0 ? lane : -lane);
            car.angle = newDir > 0 ? 0 : Math.PI;
            car.road = i;
          } else {
            car.axis = 'y';
            car.dir = newDir;
            car.x = cross[i] + (newDir > 0 ? lane : -lane);
            car.y = cross[i];
            car.angle = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
            car.road = i;
          }
          break;
        }
      }
      if (car.axis === 'y') car.y += car.dir * car.speed * dt;
      else car.x += car.dir * car.speed * dt;
      // Wrap around the map edges.
      if (car.x < 60) car.x = WORLD.width - 60;
      if (car.x > WORLD.width - 60) car.x = 60;
      if (car.y < 60) car.y = WORLD.height - 60;
      if (car.y > WORLD.height - 60) car.y = 60;
      // Keep in lane.
      if (car.axis === 'y') car.x = nearestRoadX(car.x) + (car.dir > 0 ? 18 : -18);
      else car.y = nearestRoadY(car.y) + (car.dir > 0 ? 18 : -18);
      car.angle = angleLerp(car.angle, car.axis === 'y' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI), 0.2);
    }
    // Parked cars sit still.
  }

  function updatePeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.state === 'flee') {
        ped.panic -= dt;
        const a = angleTo(ped.x, ped.y, ped.fleeX, ped.fleeY);
        ped.x += Math.cos(a) * ped.speed * 1.8 * dt;
        ped.y += Math.sin(a) * ped.speed * 1.8 * dt;
        ped.angle = a;
        if (ped.panic <= 0) ped.state = 'walk';
      } else {
        // Walk along the sidewalk; turn at intersections sometimes.
        const roads = ped.axis === 'y' ? ROADS_Y : ROADS_X;
        const pos = ped.axis === 'y' ? ped.y : ped.x;
        for (let i = 0; i < roads.length; i += 1) {
          const d = (roads[i] - pos) * ped.dir;
          if (d > 0 && d < Math.abs(ped.speed) * dt + 2 && random.next() < 0.2) {
            if (ped.axis === 'y') {
              ped.axis = 'x';
              ped.dir = random.next() < 0.5 ? 1 : -1;
              ped.y = roads[i] + (ped.dir > 0 ? 56 : -56);
            } else {
              ped.axis = 'y';
              ped.dir = random.next() < 0.5 ? 1 : -1;
              ped.x = roads[i] + (ped.dir > 0 ? 56 : -56);
            }
            break;
          }
        }
        if (ped.axis === 'y') ped.y += ped.dir * ped.speed * dt;
        else ped.x += ped.dir * ped.speed * dt;
        ped.angle = ped.axis === 'y' ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
        if (ped.x < 60 || ped.x > WORLD.width - 60) ped.dir *= -1;
        if (ped.y < 60 || ped.y > WORLD.height - 60) ped.dir *= -1;
        // Flee from a speeding car or gunfire nearby.
        const car = state.player.inCar;
        if (car && Math.abs(car.speed) > 250 && dist2(ped.x, ped.y, p.x, p.y) < 160 * 160) {
          ped.state = 'flee';
          ped.panic = 2.5;
          ped.fleeX = ped.x + (ped.x - p.x) * 2;
          ped.fleeY = ped.y + (ped.y - p.y) * 2;
        }
      }
      ped.x = clamp(ped.x, 40, WORLD.width - 40);
      ped.y = clamp(ped.y, 40, WORLD.height - 40);
      collideBuildings(ped, 12);
    }
    // Keep the streets populated.
    if (state.peds.length < PED_COUNT && random.next() < dt * 0.5) {
      const vertical = random.next() < 0.5;
      const rx = random.pick(ROADS_X);
      const ry = random.pick(ROADS_Y);
      state.peds.push({
        x: vertical ? rx + 56 : random.range(100, WORLD.width - 100),
        y: vertical ? random.range(100, WORLD.height - 100) : ry + 56,
        angle: 0, speed: random.range(40, PED_SPEED), color: random.pick(COLORS.pedShirt),
        state: 'walk', axis: vertical ? 'y' : 'x', dir: random.next() < 0.5 ? 1 : -1,
        road: vertical ? rx : ry, hp: 30, cash: random.int(10, 40), fleeX: 0, fleeY: 0, panic: 0,
      });
    }
  }

  function updateCops(dt) {
    const p = state.player;
    const seen = state.cops.some((c) => dist2(c.x, c.y, p.x, p.y) < 260 * 260)
      || state.copCars.some((c) => dist2(c.x, c.y, p.x, p.y) < 260 * 260);
    if (seen) state.lastSeen = { x: p.x, y: p.y, t: state.time };
    const hunt = state.lastSeen;
    // Cop cars chase the last seen position on the road grid: drive to its road,
    // then along it. When they reach it without seeing the player, they search
    // the area around it.
    for (const car of state.copCars) {
      // A cop that lost the trail for 10 seconds gives up and leaves.
      const dc = Math.sqrt(dist2(car.x, car.y, p.x, p.y));
      car.lost = dc > 900 ? (car.lost || 0) + dt : 0;
      if (car.lost > 10) {
        car.gone = true;
        continue;
      }
      const targetX = hunt.x;
      const targetY = hunt.y;
      const dx = targetX - car.x;
      const dy = targetY - car.y;
      const wantAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      // If on the target's road already, drive straight at it.
      const onTargetRoad = wantAxis === 'x'
        ? Math.abs(car.y - nearestRoadY(targetY)) < 60
        : Math.abs(car.x - nearestRoadX(targetX)) < 60;
      let tx;
      let ty;
      if (onTargetRoad) {
        tx = targetX;
        ty = targetY;
      } else if (wantAxis === 'x') {
        tx = car.x;
        ty = nearestRoadY(targetY);
      } else {
        tx = nearestRoadX(targetX);
        ty = car.y;
      }
      // Reached the last seen spot without a sighting: search nearby.
      if (dist2(car.x, car.y, targetX, targetY) < 80 * 80 && !seen) {
        car.wanderT = (car.wanderT || 0) - dt;
        if (car.wanderT <= 0) {
          car.wanderT = 2;
          car.wanderX = clamp(targetX + random.range(-300, 300), 80, WORLD.width - 80);
          car.wanderY = clamp(targetY + random.range(-300, 300), 80, WORLD.height - 80);
        }
        tx = car.wanderX;
        ty = car.wanderY;
      }
      const want = angleTo(car.x, car.y, tx, ty);
      car.angle = angleLerp(car.angle, want, 0.08);
      car.speed += (WANTED.copCarSpeed - car.speed) * 0.5 * dt;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const before = { x: car.x, y: car.y };
      car.x = nx;
      car.y = ny;
      if (collideBuildings(car, 20)) {
        car.x = before.x;
        car.y = before.y;
        car.angle += 0.6;
        car.speed *= 0.6;
      }
      // Ram the player: at most once per half second, so a chase stays a chase.
      if (dist2(car.x, car.y, p.x, p.y) < 46 * 46 && p.hurtCd <= 0) {
        if (p.inCar) {
          p.inCar.speed *= 0.8;
          car.speed *= 0.8;
          hurtPlayer(6, 'Ram by a cop car');
        } else {
          hurtPlayer(15, 'Run over by a cop car');
          // Knock the player away from the car.
          const a = angleTo(car.x, car.y, p.x, p.y);
          p.x += Math.cos(a) * 40;
          p.y += Math.sin(a) * 40;
        }
        audio.crash();
      }
    }
    // Foot cops run at the last seen position and punch the player up close.
    for (const cop of state.cops) {
      const dc = Math.sqrt(dist2(cop.x, cop.y, p.x, p.y));
      cop.lost = dc > 900 ? (cop.lost || 0) + dt : 0;
      if (cop.lost > 8) {
        cop.gone = true;
        continue;
      }
      cop.punchCd = Math.max(0, cop.punchCd - dt);
      let tx = hunt.x;
      let ty = hunt.y;
      if (dist2(cop.x, cop.y, hunt.x, hunt.y) < 60 * 60 && !seen) {
        cop.wanderT = (cop.wanderT || 0) - dt;
        if (cop.wanderT <= 0) {
          cop.wanderT = 3;
          cop.wanderX = clamp(hunt.x + random.range(-200, 200), 60, WORLD.width - 60);
          cop.wanderY = clamp(hunt.y + random.range(-200, 200), 60, WORLD.height - 60);
        }
        tx = cop.wanderX;
        ty = cop.wanderY;
      }
      const a = angleTo(cop.x, cop.y, tx, ty);
      cop.angle = a;
      const d = Math.sqrt(dist2(cop.x, cop.y, p.x, p.y));
      if (d > 30) {
        cop.x += Math.cos(a) * cop.speed * dt;
        cop.y += Math.sin(a) * cop.speed * dt;
        collideBuildings(cop, 12);
      } else if (cop.punchCd <= 0) {
        cop.punchCd = 0.8;
        if (!p.inCar) hurtPlayer(8, 'Beaten by a cop');
        else if (Math.abs(p.inCar.speed) < 50) {
          // A slow car can be stopped: the cops drag the player out.
          p.inCar.speed = 0;
          p.inCar = null;
          say('The cops dragged you out of the car!');
          hurtPlayer(8, 'Dragged out by a cop');
        }
      }
      cop.x = clamp(cop.x, 40, WORLD.width - 40);
      cop.y = clamp(cop.y, 40, WORLD.height - 40);
    }
    // Siren blips while wanted.
    if (state.wanted > 0) {
      state.sirenTimer -= dt;
      if (state.sirenTimer <= 0) {
        state.sirenTimer = 1.6;
        audio.siren();
      }
    }
    state.copCars = state.copCars.filter((c) => !c.gone);
    state.cops = state.cops.filter((c) => !c.gone);
  }

  function updateWanted(dt) {
    if (state.wanted === 0) return;
    // A star drops after 26 seconds with no cop seeing the player.
    if (state.time - state.lastSeen.t >= WANTED.decaySeconds) {
      state.wanted -= 1;
      state.lastSeen.t = state.time;
      say(state.wanted === 0 ? 'You lost the cops.' : `Wanted level dropped to ${state.wanted} star${state.wanted > 1 ? 's' : ''}.`);
      if (state.wanted === 0) {
        state.cops = [];
        state.copCars = [];
      }
    }
    // Keep pressure up while the trail is fresh: fresh cops arrive only while the
    // player was seen recently, so the heat can actually be lost.
    const trailFresh = state.time - state.lastSeen.t < 10;
    if (trailFresh && state.copCars.length < WANTED.copsPerStar[state.wanted]) spawnCops();
    if (trailFresh && state.wanted >= 2 && state.cops.length < state.wanted - 1) spawnCops();
  }

  function updatePickups(dt) {
    const p = state.player;
    for (const pk of state.pickups) {
      if (dist2(p.x, p.y, pk.x, pk.y) < 34 * 34) {
        if (pk.kind === 'health' && p.hp < PLAYER.health) {
          p.hp = Math.min(PLAYER.health, p.hp + PICKUP.health);
          say(`Health +${PICKUP.health}`);
          audio.pickup();
        } else if (pk.kind === 'ammo') {
          p.ammo = Math.min(GUN.maxAmmo, p.ammo + (pk.amount || PICKUP.ammo));
          say(`Ammo +${pk.amount || PICKUP.ammo}`);
          audio.pickup();
        } else if (pk.kind === 'cash') {
          state.money += pk.amount;
          state.earned += pk.amount;
          say(`+$${pk.amount}`);
          audio.cash();
        } else {
          continue;
        }
        pk.taken = true;
      }
    }
    state.pickups = state.pickups.filter((pk) => !pk.taken);
    // Pay n Spray: drive in with a car, pay to clear wanted.
    if (p.inCar && state.wanted > 0 && state.sprayCd <= 0
      && dist2(p.x, p.y, PLACES.spray.x, PLACES.spray.y) < 70 * 70) {
      if (state.money >= SPRAY_COST) {
        state.money -= SPRAY_COST;
        state.wanted = 0;
        state.cops = [];
        state.copCars = [];
        state.sprayCd = 5;
        say(`Pay n Spray: -$${SPRAY_COST}. Clean slate.`);
        audio.cash();
      } else {
        say(`Pay n Spray needs $${SPRAY_COST}. You have $${state.money}.`);
        state.sprayCd = 5;
      }
    }
    state.sprayCd = Math.max(0, state.sprayCd - dt);
  }

  function updateHealth(dt) {
    const p = state.player;
    if (state.wanted === 0 && p.hp > 0 && p.hp < PLAYER.health) {
      p.hp = Math.min(PLAYER.health, p.hp + 2 * dt);
    }
  }

  function save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: state.money, earned: state.earned,
        missionIndex: state.missionIndex, kills: state.kills,
      }));
      window.localStorage.setItem(BEST_KEY, String(score()));
    } catch {
      // Storage can be off: the session still plays.
    }
  }

  function score() {
    return state.earned + state.missionIndex * 1000 + state.kills * 10;
  }

  function step(dt, input, aimAngle) {
    if (state.gameOver) return EVENT_WASTED;
    state.time += dt;
    state._holdE = input.holdingE;
    updatePlayer(dt, input, aimAngle);
    if (input.enterPressed) enterExitCar();
    if (input.punchPressed) punch();
    if (input.shootHeld && aimAngle !== null && aimAngle !== undefined) shoot(aimAngle);
    updateTraffic(dt);
    updatePeds(dt);
    updateCops(dt);
    updateWanted(dt);
    updateMissions(dt);
    updatePickups(dt);
    updateHealth(dt);
    for (const t of state.tracers) t.ttl -= dt;
    state.tracers = state.tracers.filter((t) => t.ttl > 0);
    for (const m of state.messages) m.t += dt;
    state.messages = state.messages.filter((m) => m.t < 6);
    state.saveTimer += dt;
    if (state.saveTimer > 30) {
      state.saveTimer = 0;
      save();
    }
    if (state.gameOver) return EVENT_WASTED;
    return EVENT_NONE;
  }

  return world;
}
