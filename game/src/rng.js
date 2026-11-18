// Sunset Vice — small seeded random helpers. Every run of the city uses one
// mulberry32 stream so the same seed always builds the same Palmetto Bay.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick one element of an array with the given stream.
export function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

// A float in [lo, hi).
export function range(rand, lo, hi) {
  return lo + rand() * (hi - lo);
}

// A whole number in [lo, hi] inclusive.
export function rangeInt(rand, lo, hi) {
  return lo + Math.floor(rand() * (hi - lo + 1));
}

// Clamp a value into [lo, hi].
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Squared distance between two points (no square root needed for comparisons).
export function dist2(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

// Shortest-arc interpolation between two angles.
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
