// Palmetto Bay: a fictional beach city, all original. The world is a grid of
// avenues (vertical roads) and streets (horizontal roads). The blocks between
// the roads hold buildings, parks and parking lots. Coordinates are world
// pixels, origin at the north-west corner.
import { clamp } from './rng.js';

export const WORLD_W = 2880;
export const WORLD_H = 2160;
export const ROAD_W = 96;

// Avenue x-centres and street y-centres.
export const AVENUES = [240, 624, 1008, 1392, 1776, 2160, 2544];
export const STREETS = [216, 576, 936, 1296, 1656, 2016];

export function onRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) < ROAD_W / 2) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) < ROAD_W / 2) return true;
  return false;
}

// Snap a point onto the nearest road centre line.
export function nearestRoadPoint(x, y) {
  let best = null, bd = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bd) { bd = d; best = { x: ax, y: clamp(y, 40, WORLD_H - 40), vertical: true }; }
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < bd) { bd = d; best = { x: clamp(x, 40, WORLD_W - 40), y: sy, vertical: false }; }
  }
  return best;
}

// Landmarks the missions and the map use: a spot to reach and a short label.
export const LANDMARKS = {
  garage: { x: 624, y: 2016, r: 70, label: 'Garage' },
  docks: { x: 240, y: 936, r: 80, label: 'Docks' },
  store: { x: 1776, y: 576, r: 60, label: 'Corner Store' },
  spray: { x: 1008, y: 1656, r: 60, label: 'Pay n Spray' },
  gate: { x: 1392, y: 60, r: 90, label: 'North Gate' },
  beach: { x: 1440, y: 2100, r: 120, label: 'Beach' },
  plaza: { x: 1392, y: 1296, r: 90, label: 'Plaza' },
};

// Buildings fill the blocks. Generated once from a seed so the city never
// changes between runs.
export function buildCity(rand) {
  const buildings = [];
  const trees = [];
  const lots = [];
  const palette = ['#c96f4a', '#4a7a96', '#96784a', '#6a4a8c', '#4a8c5a', '#8c4a5e', '#b0a060'];
  for (let ai = 0; ai < AVENUES.length - 1; ai++) {
    for (let si = 0; si < STREETS.length - 1; si++) {
      const x0 = AVENUES[ai] + ROAD_W / 2 + 14;
      const x1 = AVENUES[ai + 1] - ROAD_W / 2 - 14;
      const y0 = STREETS[si] + ROAD_W / 2 + 14;
      const y1 = STREETS[si + 1] - ROAD_W / 2 - 14;
      const w = x1 - x0, h = y1 - y0;
      const kind = rand();
      if (kind < 0.12) {
        // Park: trees, no buildings.
        const n = 3 + Math.floor(rand() * 4);
        for (let i = 0; i < n; i++) {
          trees.push({ x: x0 + rand() * w, y: y0 + rand() * h, r: 10 + rand() * 8 });
        }
        continue;
      }
      if (kind < 0.24) {
        // Parking lot: flat asphalt with painted bays.
        lots.push({ x: x0, y: y0, w, h });
        continue;
      }
      // One or two buildings per block.
      if (rand() < 0.5) {
        const mid = x0 + w * (0.42 + rand() * 0.16);
        buildings.push({ x: x0, y: y0, w: mid - x0 - 10, h: h * (0.55 + rand() * 0.3), c: palette[Math.floor(rand() * palette.length)] });
        buildings.push({ x: mid + 10, y: y0 + h * 0.2, w: x1 - mid - 10, h: h * (0.5 + rand() * 0.3), c: palette[Math.floor(rand() * palette.length)] });
      } else {
        buildings.push({ x: x0 + w * 0.1, y: y0 + h * 0.12, w: w * (0.6 + rand() * 0.2), h: h * (0.55 + rand() * 0.25), c: palette[Math.floor(rand() * palette.length)] });
      }
      if (rand() < 0.6) trees.push({ x: x0 + rand() * w, y: y0 + rand() * h, r: 9 + rand() * 6 });
    }
  }
  return { buildings, trees, lots };
}

// True when a circle at (x, y) with radius r overlaps a building.
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of any building it overlaps; returns the corrected pos.
export function resolveBuildings(city, x, y, r) {
  for (let i = 0; i < 3; i++) {
    const b = hitsBuilding(city, x, y, r);
    if (!b) break;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const dx = x - cx, dy = y - cy;
    const ox = b.w / 2 + r - Math.abs(dx);
    const oy = b.h / 2 + r - Math.abs(dy);
    if (ox < oy) x = cx + (dx >= 0 ? 1 : -1) * (b.w / 2 + r);
    else y = cy + (dy >= 0 ? 1 : -1) * (b.h / 2 + r);
  }
  return {
    x: clamp(x, 20, WORLD_W - 20),
    y: clamp(y, 20, WORLD_H - 20),
  };
}
