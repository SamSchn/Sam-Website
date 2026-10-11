// Pure edit operations on map data. Each returns a new map object so the
// editor can keep an undo history of snapshots.

export function setTerrain(map, cx, cy, ch, brush = 1) {
  const half = Math.floor((brush - 1) / 2);
  let changed = false;
  const rows = map.terrain.slice();
  for (let ty = cy - half; ty < cy - half + brush; ty++) {
    if (ty < 0 || ty >= rows.length) continue;
    const row = rows[ty].split('');
    for (let tx = cx - half; tx < cx - half + brush; tx++) {
      if (tx < 0 || tx >= row.length || row[tx] === ch) continue;
      row[tx] = ch;
      changed = true;
    }
    rows[ty] = row.join('');
  }
  return changed ? { ...map, terrain: rows } : map;
}

/** Flood fill a contiguous region of the same terrain character. */
export function fillTerrain(map, x, y, ch) {
  const H = map.terrain.length, W = map.terrain[0].length;
  const target = map.terrain[y]?.[x];
  if (target === undefined || target === ch) return map;
  const grid = map.terrain.map(r => r.split(''));
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= W || cy >= H || grid[cy][cx] !== target) continue;
    grid[cy][cx] = ch;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return { ...map, terrain: grid.map(r => r.join('')) };
}

export function resizeMap(map, w, h, fillChar) {
  const fallback = fillChar ?? (map.outdoor ? '.' : ' ');
  const rows = [];
  for (let y = 0; y < h; y++) {
    const src = map.terrain[y] ?? '';
    rows.push((src + fallback.repeat(Math.max(0, w - src.length))).slice(0, w));
  }
  return { ...map, width: w, height: h, terrain: rows };
}

function uniqueId(map, base) {
  const ids = new Set(map.objects.map(o => o.id));
  let n = 1;
  while (ids.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

export function addObject(map, obj) {
  const id = obj.id && !map.objects.some(o => o.id === obj.id) ? obj.id : uniqueId(map, obj.sprite || 'custom');
  const placed = { ...obj, id, x: Math.round(obj.x), y: Math.round(obj.y) };
  return { map: { ...map, objects: [...map.objects, placed] }, id };
}

export function updateObject(map, id, patch) {
  return { ...map, objects: map.objects.map(o => (o.id === id ? { ...o, ...patch } : o)) };
}

export function removeObject(map, id) {
  return { ...map, objects: map.objects.filter(o => o.id !== id) };
}

export function duplicateObject(map, id) {
  const src = map.objects.find(o => o.id === id);
  if (!src) return { map, id: null };
  const copy = JSON.parse(JSON.stringify(src));
  delete copy.id;
  return addObject(map, { ...copy, x: src.x + 16, y: src.y + 16 });
}

export function setSpawn(map, name, x, y) {
  return { ...map, spawns: { ...map.spawns, [name]: { ...(map.spawns?.[name] || { facing: 'down' }), x: Math.round(x), y: Math.round(y) } } };
}
