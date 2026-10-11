// Terrain: maps store a grid of characters (one per 16px tile) which is turned
// into edge-matched tiles here. Keeping terrain as characters makes maps easy
// to read in code and easy to paint in the editor.

export const TILE = 16;

export const TERRAIN = {
  '.': { type: 'grass', label: 'Grass' },
  'x': { type: 'grass', solid: true, label: 'Grass (blocked)' },
  'd': { type: 'dirt', label: 'Dirt path' },
  'c': { type: 'cobble', label: 'Cobblestone' },
  'w': { type: 'water', solid: true, label: 'Water' },
  'f': { type: 'floor', label: 'Wood floor' },
  'W': { type: 'wall', solid: true, label: 'Wall' },
  ' ': { type: 'void', solid: true, label: 'Void' },
};

const TL = '/sprites/tiles/';

// 3x3 edge block + 2x2 inner-corner block, as laid out in the Cute Fantasy sheets
const AUTOTILES = {
  dirt: { sheet: `${TL}Grass_Grass_Tiles_1.png`, edge: [0, 80], inner: [0, 128], members: ['dirt', 'cobble'] },
  cobble: { sheet: `${TL}Cobble_Road_Cobble_Road_1.png`, edge: [0, 0], inner: [0, 48], members: ['cobble'] },
  water: {
    sheet: '/animations/tiles/Water_Water_Tile_1_Anim.png', edge: [0, 0], inner: [0, 48], members: ['water'],
    anim: { frames: 8, dx: 48, speed: 170 },
  },
};

const GRASS_SHEET = '/sprites/custom/grass_tiles.png';
const FLOOR_SHEET = '/sprites/interior/Wood_Floor_Tiles.png';
const WALL_SHEET = '/sprites/interior/Interior_Walls.png';

export const TERRAIN_SHEETS = [
  GRASS_SHEET, FLOOR_SHEET, WALL_SHEET,
  ...Object.values(AUTOTILES).map(a => a.sheet),
];

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Pick the tile within an autotile set for cell (x, y). Returns [sx, sy] in sheet px. */
function autotile(set, same, x, y) {
  const n = same(x, y - 1), s = same(x, y + 1), w = same(x - 1, y), e = same(x + 1, y);
  const [ex, ey] = set.edge;
  const [ix, iy] = set.inner;
  const E = (c, r) => [ex + c * TILE, ey + r * TILE];
  if (!n && !w) return E(0, 0);
  if (!n && !e) return E(2, 0);
  if (!s && !w) return E(0, 2);
  if (!s && !e) return E(2, 2);
  if (!n) return E(1, 0);
  if (!s) return E(1, 2);
  if (!w) return E(0, 1);
  if (!e) return E(2, 1);
  // Concave corners: the inner block is a blob of the *outer* terrain, so the
  // tile with the blob in its bottom-right is the one for a missing SE neighbour.
  if (!same(x - 1, y - 1)) return [ix + TILE, iy + TILE];
  if (!same(x + 1, y - 1)) return [ix, iy + TILE];
  if (!same(x - 1, y + 1)) return [ix + TILE, iy];
  if (!same(x + 1, y + 1)) return [ix, iy];
  return E(1, 1);
}

/**
 * Build renderable tiles from a map's terrain rows.
 * Returns { width, height, tiles: [{sheet, sx, sy, x, y, anim?}], solid: Uint8Array, types }
 */
export function buildTerrain(map) {
  const rows = map.terrain;
  const H = rows.length;
  const W = rows[0].length;
  const types = new Array(W * H);
  const solid = new Uint8Array(W * H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const def = TERRAIN[rows[y][x]] || TERRAIN['.'];
      types[y * W + x] = def.type;
      solid[y * W + x] = def.solid ? 1 : 0;
    }
  }

  // Out-of-bounds counts as "same" so paths/water run cleanly off the map edge
  const typeAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? null : types[y * W + x]);
  const sameAs = (members) => (x, y) => {
    const t = typeAt(x, y);
    return t === null || members.includes(t);
  };

  const tiles = [];
  const push = (sheet, sx, sy, x, y, anim) => tiles.push({ sheet, sx, sy, x: x * TILE, y: y * TILE, anim });

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = types[y * W + x];
      if (t === 'void') continue;

      if (t === 'floor') {
        push(FLOOR_SHEET, 32 + (x % 2) * TILE, (y % 2) * TILE, x, y);
        continue;
      }

      if (t === 'wall') {
        // Wood plank wall: 3 slices tall (top trim, middle, skirting)
        let top = y;
        while (top > 0 && types[(top - 1) * W + x] === 'wall') top--;
        let bottom = y;
        while (bottom < H - 1 && types[(bottom + 1) * W + x] === 'wall') bottom++;
        const slice = y === top ? 0 : y === bottom ? 2 : 1;
        push(WALL_SHEET, 48, 48 + slice * TILE, x, y);
        continue;
      }

      // Outdoor: grass underneath everything
      const r = hash(x, y);
      const variant = r < 0.55 ? 0 : 1 + Math.floor(hash(y, x) * 7);
      push(GRASS_SHEET, variant * TILE, 0, x, y);

      if (t === 'dirt' || t === 'cobble') {
        const [sx, sy] = autotile(AUTOTILES.dirt, sameAs(AUTOTILES.dirt.members), x, y);
        push(AUTOTILES.dirt.sheet, sx, sy, x, y);
      }
      if (t === 'cobble') {
        const [sx, sy] = autotile(AUTOTILES.cobble, sameAs(AUTOTILES.cobble.members), x, y);
        push(AUTOTILES.cobble.sheet, sx, sy, x, y);
      }
      if (t === 'water') {
        const set = AUTOTILES.water;
        const [sx, sy] = autotile(set, sameAs(set.members), x, y);
        push(set.sheet, sx, sy, x, y, set.anim);
      }
    }
  }

  return { width: W, height: H, tiles, solid, types };
}

/** Dev helper: warn about 1-tile-wide strips, which the autotile sets can't draw. */
export function validateTerrain(map) {
  const rows = map.terrain;
  const problems = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const t = TERRAIN[rows[y][x]]?.type;
      if (!['dirt', 'cobble', 'water'].includes(t)) continue;
      const same = (dx, dy) => {
        const c = rows[y + dy]?.[x + dx];
        if (c === undefined) return true;
        const tt = TERRAIN[c]?.type;
        return t === 'dirt' ? tt === 'dirt' || tt === 'cobble' : tt === t;
      };
      if ((!same(0, -1) && !same(0, 1)) || (!same(-1, 0) && !same(1, 0))) {
        problems.push(`${map.id}: 1-tile ${t} strip at (${x}, ${y})`);
      }
    }
  }
  return problems;
}
