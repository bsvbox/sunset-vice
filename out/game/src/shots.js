// Screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what a short game really looks like and the same seed
// always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const DRIVE_SECONDS = 9;
const CHASE_SECONDS = 12;
const MISSION_SECONDS = 10;

function idleInput() {
  return {
    move: () => ({ x: 0, y: 0 }),
    running: () => false,
    holdingE: false,
    enterPressed: false,
    punchPressed: false,
    shootHeld: false,
  };
}

// Drive the road grid: head for the next intersection on the current road, and
// turn onto the cross road only once inside the intersection, so the car stays
// on roads and never cuts through a block. Keeps the car moving for screenshots.
import { ROADS_X, ROADS_Y } from './config.js';

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

function driveInput(world) {
  return {
    move: () => {
      const car = world.state.player.inCar;
      if (!car) return { x: 0, y: 0 };
      const vertical = Math.abs(Math.cos(car.angle)) < Math.abs(Math.sin(car.angle));
      let tx;
      let ty;
      if (vertical) {
        const rx = nearestRoadX(car.x);
        const dir = Math.sin(car.angle) >= 0 ? 1 : -1;
        const ahead = ROADS_Y.filter((y) => (dir > 0 ? y > car.y + 40 : y < car.y - 40));
        const iy = ahead.length > 0
          ? (dir > 0 ? Math.min(...ahead) : Math.max(...ahead))
          : (dir > 0 ? Math.max(...ROADS_Y) : Math.min(...ROADS_Y));
        tx = rx;
        ty = iy;
        // Inside the intersection: turn onto the cross road.
        if (Math.abs(car.y - iy) < 70) {
          tx = car.x + (car.x < 1300 ? 260 : -260);
          ty = iy;
        }
      } else {
        const ry = nearestRoadY(car.y);
        const dir = Math.cos(car.angle) >= 0 ? 1 : -1;
        const ahead = ROADS_X.filter((x) => (dir > 0 ? x > car.x + 40 : x < car.x - 40));
        const ix = ahead.length > 0
          ? (dir > 0 ? Math.min(...ahead) : Math.max(...ahead))
          : (dir > 0 ? Math.max(...ROADS_X) : Math.min(...ROADS_X));
        tx = ix;
        ty = ry;
        if (Math.abs(car.x - ix) < 70) {
          tx = ix;
          ty = car.y + (car.y < 1000 ? 260 : -260);
        }
      }
      const want = Math.atan2(ty - car.y, tx - car.x);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return { x: Math.max(-1, Math.min(1, diff * 1.4)), y: -1 };
    },
    running: () => false,
    holdingE: false,
    enterPressed: false,
    punchPressed: false,
    shootHeld: false,
  };
}

function putPlayerInCar(world, x, y, angle) {
  const s = world.state;
  let car = s.cars.find((c) => c.kind === 'parked');
  if (!car) car = s.cars[0];
  if (!car) return;
  const idx = s.cars.indexOf(car);
  if (idx >= 0) s.cars.splice(idx, 1);
  car.kind = 'player';
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = 0;
  s.player.inCar = car;
  s.player.x = x;
  s.player.y = y;
  s.player.angle = angle;
}

function runSteps(world, seconds, input) {
  for (let i = 0; i < seconds / STEP; i += 1) {
    world.step(STEP, input, null);
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. Mission state is set explicitly per scene so no earlier
 * mission leaks in; staged scenes give the player extra health so the frame
 * shows the action, not a game-over screen.
 */
export function stageShot(name, world) {
  world.reset();
  const s = world.state;
  if (name === 'drive') {
    s.missionIndex = 0;
    s.missionStage = 1;
    s.player.hp = 500;
    putPlayerInCar(world, 1040, 1500, -Math.PI / 2);
    runSteps(world, DRIVE_SECONDS, driveInput(world));
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'chase') {
    s.missionIndex = 0;
    s.missionStage = 0;
    s.wanted = 3;
    s.player.hp = 500;
    putPlayerInCar(world, 1040, 1500, -Math.PI / 2);
    runSteps(world, CHASE_SECONDS, driveInput(world));
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'mission') {
    // The robbery in progress: on foot at the corner store, cleaning out the
    // register, with the law already on the way.
    s.missionIndex = 3;
    s.missionStage = 1;
    s.missionProgress = 3;
    s.wanted = 2;
    s.player.hp = 500;
    s.player.x = 990;
    s.player.y = 820;
    s.player.angle = 0;
    runSteps(world, MISSION_SECONDS, idleInput());
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // start (and anything else): the title over a living city.
  s.missionIndex = 0;
  s.missionStage = 0;
  s.player.hp = 500;
  runSteps(world, START_SECONDS, idleInput());
  return { screen: SCREEN_TITLE, best: 0 };
}
