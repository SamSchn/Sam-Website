// Small helpers for authoring maps in code. Maps end up as plain JSON
// ({ terrain: string[], objects: [], ... }) so the editor can load and save them.

export const T = 16;

export function makeGrid(w, h, ch = '.') {
  return Array.from({ length: h }, () => Array(w).fill(ch));
}

/** Fill an inclusive tile rectangle. */
export function fill(grid, x0, y0, x1, y1, ch) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (grid[y] && x >= 0 && x < grid[y].length) grid[y][x] = ch;
    }
  }
}

/** Set individual cells: spans is [[y, x0, x1], ...] */
export function spans(grid, list, ch) {
  for (const [y, x0, x1] of list) fill(grid, x0, y, x1, y, ch);
}

export function toRows(grid) {
  return grid.map(r => r.join(''));
}

/** Deterministic RNG so generated scenery is identical on every load. */
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function objectList() {
  const list = [];
  const counts = {};
  const add = (sprite, x, y, extra = {}) => {
    counts[sprite] = (counts[sprite] || 0) + 1;
    const obj = { id: extra.id || `${sprite}_${counts[sprite]}`, sprite, x: Math.round(x), y: Math.round(y), ...extra };
    list.push(obj);
    return obj;
  };
  return { list, add };
}
