// Sunset Vice — Palmetto Bay, the city layout. Roads are a fixed grid; the
// blocks between them are filled from a seed, so the same seed always builds
// the same streets, buildings, trees and parking lots.
import { range, rangeInt } from './rng.js';

export const WORLD_W = 2880;
export const WORLD_H = 2160;
export const ROAD_W = 96;

// Road centre lines, in pixels.
export const AVENUES = [240, 624, 1008, 1392, 1776, 2160, 2544];
export const STREETS = [216, 576, 936, 1296, 1656, 2016];

// Named places. x/y are the centre, r the trigger radius in pixels.
export const LANDMARKS = {
  garage: { x: 624, y: 2016, r: 70, label: 'Rico\u2019s Garage' },
  docks: { x: 240, y: 936, r: 80, label: 'Docks' },
  store: { x: 1776, y: 576, r: 60, label: 'Corner Store' },
  spray: { x: 1008, y: 1656, r: 60, label: 'Pay n Spray' },
  gate: { x: 1392, y: 60, r: 90, label: 'North Gate' },
  beach: { x: 1440, y: 2100, r: 120, label: 'Palmetto Beach' },
  plaza: { x: 1392, y: 1296, r: 90, label: 'Plaza' },
};

const HALF_ROAD = ROAD_W / 2;

// True when (x, y) sits on a road (within half a road width of a centre line).
export function onRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) <= HALF_ROAD) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= HALF_ROAD) return true;
  return false;
}

// The closest point on the road network to (x, y): snap to the nearest
// avenue or street line, clamped inside the world.
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of AVENUES) {
    const cy = Math.max(0, Math.min(WORLD_H, y));
    const d = (x - ax) * (x - ax) + (y - cy) * (y - cy);
    if (d < bestD) { bestD = d; best = { x: ax, y: cy }; }
  }
  for (const sy of STREETS) {
    const cx = Math.max(0, Math.min(WORLD_W, x));
    const d = (x - cx) * (x - cx) + (y - sy) * (y - sy);
    if (d < bestD) { bestD = d; best = { x: cx, y: sy }; }
  }
  return best;
}

// The bands of land between the roads (plus the two edge strips).
function bands(lines, size) {
  const out = [];
  let start = 0;
  for (const c of lines) {
    out.push([start, c - HALF_ROAD]);
    start = c + HALF_ROAD;
  }
  out.push([start, size]);
  return out;
}

// True when a circle of radius r at (x, y) overlaps a building rect.
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const nx = Math.max(b.x - b.w / 2, Math.min(x, b.x + b.w / 2));
    const ny = Math.max(b.y - b.h / 2, Math.min(y, b.y + b.h / 2));
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

// Push an entity with radius r out of any building it overlaps. The entity
// is an object with x/y; it is moved in place and the function returns true
// when it was pushed at all.
export function resolveBuildings(city, ent, r) {
  let pushed = false;
  for (const b of city.buildings) {
    const left = b.x - b.w / 2 - r;
    const right = b.x + b.w / 2 + r;
    const top = b.y - b.h / 2 - r;
    const bottom = b.y + b.h / 2 + r;
    if (ent.x <= left || ent.x >= right || ent.y <= top || ent.y >= bottom) continue;
    const dl = ent.x - left;
    const dr = right - ent.x;
    const dt = ent.y - top;
    const db = bottom - ent.y;
    const m = Math.min(dl, dr, dt, db);
    if (m === dl) ent.x = left;
    else if (m === dr) ent.x = right;
    else if (m === dt) ent.y = top;
    else ent.y = bottom;
    pushed = true;
  }
  return pushed;
}

// Build the city from a seeded stream. Buildings sit in the blocks between
// roads; a few blocks stay open as parking lots; trees scatter in the gaps.
export function buildCity(rand) {
  const buildings = [];
  const trees = [];
  const lots = [];
  const xBands = bands(AVENUES, WORLD_W);
  const yBands = bands(STREETS, WORLD_H);

  // Keep buildings clear of the named places so their pads stay open.
  const clearOfLandmarks = (x, y, pad) => {
    for (const lm of Object.values(LANDMARKS)) {
      const dx = x - lm.x;
      const dy = y - lm.y;
      if (dx * dx + dy * dy < (lm.r + pad) * (lm.r + pad)) return false;
    }
    return true;
  };

  // Three parking lots in busy blocks: by the garage, by the store, by the plaza.
  const lotSpots = [
    { bx: 1, by: 5 },
    { bx: 4, by: 1 },
    { bx: 3, by: 3 },
  ];
  for (const spot of lotSpots) {
    const [x0, x1] = xBands[spot.bx];
    const [y0, y1] = yBands[spot.by];
    const w = Math.min(220, x1 - x0 - 24);
    const h = Math.min(150, y1 - y0 - 24);
    lots.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, w, h });
  }
  const inLot = (x, y) => lots.some((l) => Math.abs(x - l.x) < l.w / 2 + 20 && Math.abs(y - l.y) < l.h / 2 + 20);

  for (let bi = 0; bi < xBands.length; bi++) {
    for (let bj = 0; bj < yBands.length; bj++) {
      if (lotSpots.some((s) => s.bx === bi && s.by === bj)) continue;
      const [x0, x1] = xBands[bi];
      const [y0, y1] = yBands[bj];
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (bw < 90 || bh < 80) continue;
      const count = rangeInt(rand, 1, 2);
      for (let k = 0; k < count; k++) {
        const w = range(rand, 60, Math.min(150, bw - 28));
        const h = range(rand, 50, Math.min(120, bh - 28));
        const x = range(rand, x0 + 14 + w / 2, x1 - 14 - w / 2);
        const y = range(rand, y0 + 14 + h / 2, y1 - 14 - h / 2);
        if (!clearOfLandmarks(x, y, 30)) continue;
        if (inLot(x, y)) continue;
        if (buildings.some((b) => Math.abs(b.x - x) < (b.w + w) / 2 + 16 && Math.abs(b.y - y) < (b.h + h) / 2 + 16)) continue;
        buildings.push({ x, y, w, h, hue: rangeInt(rand, 0, 5) });
      }
    }
  }

  // Trees in the open corners of blocks, never on a road or a lot.
  let guard = 0;
  while (trees.length < 48 && guard++ < 400) {
    const x = range(rand, 60, WORLD_W - 60);
    const y = range(rand, 60, WORLD_H - 60);
    if (onRoad(x, y)) continue;
    if (inLot(x, y)) continue;
    if (hitsBuilding({ buildings }, x, y, 24)) continue;
    if (!clearOfLandmarks(x, y, 10)) continue;
    if (trees.some((t) => Math.abs(t.x - x) < 36 && Math.abs(t.y - y) < 36)) continue;
    trees.push({ x, y, r: range(rand, 10, 17) });
  }

  return { buildings, trees, lots };
}
