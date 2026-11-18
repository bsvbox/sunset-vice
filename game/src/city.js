// Sunset Vice — Palmetto Bay, a fictional beach city. The map is a road
// grid: seven avenues run north-south, six streets run east-west, and the
// blocks between them hold the buildings, trees and parking lots. The south
// edge below the last street is sand and water.
import { range, rangeInt, pick } from './rng.js';

export const WORLD_W = 2880;
export const WORLD_H = 2160;
export const ROAD_W = 96;
export const HALF_ROAD = ROAD_W / 2;

export const AVENUES = [240, 624, 1008, 1392, 1776, 2160, 2544];
export const STREETS = [216, 576, 936, 1296, 1656, 2016];

export const LANDMARKS = {
  garage: { x: 624, y: 2016, r: 70, label: "Rico's Garage", color: '#e8a33d' },
  docks: { x: 240, y: 936, r: 80, label: 'Docks', color: '#4da3d8' },
  store: { x: 1776, y: 576, r: 60, label: 'Corner Store', color: '#e05d5d' },
  spray: { x: 1008, y: 1656, r: 60, label: 'Pay n Spray', color: '#7bc96f' },
  gate: { x: 1392, y: 60, r: 90, label: 'North Gate', color: '#c98ad8' },
  beach: { x: 1440, y: 2100, r: 120, label: 'Palmetto Beach', color: '#e8d27a' },
  plaza: { x: 1392, y: 1296, r: 90, label: 'Plaza', color: '#8ad8c9' },
};

const ROOF_HUES = [18, 36, 200, 150, 280, 0, 45];

// True when the point sits on asphalt (within half a road of a centre line).
export function onRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) <= HALF_ROAD) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= HALF_ROAD) return true;
  return false;
}

// The closest point that lies on a road centre line.
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = { x: ax, y }; }
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; best = { x, y: sy }; }
  }
  return best;
}

function nearLandmark(x, y, pad) {
  for (const key of Object.keys(LANDMARKS)) {
    const lm = LANDMARKS[key];
    const dx = x - lm.x;
    const dy = y - lm.y;
    if (dx * dx + dy * dy < (lm.r + pad) * (lm.r + pad)) return true;
  }
  return false;
}

// Lay out the blocks. Buildings never cover a landmark pad, a road, or the
// beach strip; trees fill the gaps; three lots give parked cars a home.
export function buildCity(rand) {
  const buildings = [];
  const trees = [];
  const lots = [];
  let lotCount = 0;

  for (let i = 0; i < AVENUES.length - 1; i++) {
    for (let j = 0; j < STREETS.length - 1; j++) {
      const bx0 = AVENUES[i] + HALF_ROAD + 14;
      const bx1 = AVENUES[i + 1] - HALF_ROAD - 14;
      const by0 = STREETS[j] + HALF_ROAD + 14;
      const by1 = STREETS[j + 1] - HALF_ROAD - 14;
      const bw = bx1 - bx0;
      const bh = by1 - by0;
      if (bw < 90 || bh < 80) continue;

      // One block in five becomes a parking lot instead of buildings.
      if (lotCount < 3 && rand() < 0.2 && bw > 170 && bh > 130) {
        lots.push({ x: bx0 + 8, y: by0 + 8, w: bw - 16, h: bh - 16 });
        lotCount++;
        continue;
      }

      const count = rand() < 0.5 ? 3 : 2;
      for (let k = 0; k < count; k++) {
        const w = range(rand, 62, Math.min(150, bw - 20));
        const h = range(rand, 52, Math.min(120, bh - 20));
        const x = range(rand, bx0, bx1 - w);
        const y = range(rand, by0, by1 - h);
        const cx = x + w / 2;
        const cy = y + h / 2;
        if (nearLandmark(cx, cy, 60)) continue;
        let overlap = false;
        for (const b of buildings) {
          if (x < b.x + b.w + 12 && x + w + 12 > b.x && y < b.y + b.h + 12 && y + h + 12 > b.y) { overlap = true; break; }
        }
        if (overlap) continue;
        buildings.push({
          x, y, w, h,
          hue: pick(rand, ROOF_HUES),
          floors: rangeInt(rand, 1, 3),
          lit: rand(),
        });
      }

      const treeCount = rangeInt(rand, 1, 3);
      for (let t = 0; t < treeCount; t++) {
        const tx = range(rand, bx0, bx1);
        const ty = range(rand, by0, by1);
        if (nearLandmark(tx, ty, 46)) continue;
        let inside = false;
        for (const b of buildings) {
          if (tx > b.x - 8 && tx < b.x + b.w + 8 && ty > b.y - 8 && ty < b.y + b.h + 8) { inside = true; break; }
        }
        if (!inside) trees.push({ x: tx, y: ty, r: range(rand, 12, 20) });
      }
    }
  }

  // A few palms along the sand so the beach reads as a beach.
  for (let t = 0; t < 8; t++) {
    trees.push({ x: range(rand, 120, WORLD_W - 120), y: range(rand, 2050, 2130), r: range(rand, 13, 19), palm: true });
  }

  return { buildings, trees, lots };
}

// True when a circle of radius r at (x, y) touches any building.
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

// Push an entity with {x, y} out of any building it overlaps, one axis at a
// time so it slides along walls instead of sticking to corners.
export function resolveBuildings(city, e, r) {
  for (const b of city.buildings) {
    if (e.x + r > b.x && e.x - r < b.x + b.w && e.y + r > b.y && e.y - r < b.y + b.h) {
      const pushL = e.x + r - b.x;
      const pushR = b.x + b.w + r - e.x;
      const pushU = e.y + r - b.y;
      const pushD = b.y + b.h + r - e.y;
      const smallest = Math.min(pushL, pushR, pushU, pushD);
      if (smallest === pushL) e.x = b.x - r;
      else if (smallest === pushR) e.x = b.x + b.w + r;
      else if (smallest === pushU) e.y = b.y - r;
      else e.y = b.y + b.h + r;
    }
  }
}
