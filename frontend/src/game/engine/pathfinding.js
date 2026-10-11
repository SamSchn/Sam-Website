// Breadth-first search over the tile walk grid (8-directional, no corner
// cutting). Maps are small (~40x30), so BFS is plenty fast and gives the
// nearest of several goal tiles for free.

const DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/**
 * @param walk  Uint8Array, 1 = walkable
 * @param W,H   grid size
 * @param start [tx, ty]
 * @param goals Set of tile indices (ty * W + tx)
 * @returns array of [tx, ty] from start (exclusive) to goal (inclusive), or null
 */
export function findPath(walk, W, H, start, goals) {
  const [sx, sy] = start;
  const startIdx = sy * W + sx;
  if (goals.has(startIdx)) return [];
  const prev = new Int32Array(W * H).fill(-1);
  prev[startIdx] = startIdx;
  const queue = [startIdx];
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    const cx = cur % W;
    const cy = (cur / W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (prev[ni] !== -1 || !walk[ni]) continue;
      if (dx && dy && (!walk[cy * W + nx] || !walk[ny * W + cx])) continue;
      prev[ni] = cur;
      if (goals.has(ni)) {
        const path = [];
        for (let p = ni; p !== startIdx; p = prev[p]) path.push([p % W, (p / W) | 0]);
        return path.reverse();
      }
      queue.push(ni);
    }
  }
  return null;
}
