const express = require('express');
const { getDb } = require('../db/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const LAYER_NAMES = ['ground', 'objects', 'canopy'];

// GET /api/tilemap — list all maps
router.get('/', (_req, res) => {
  const db = getDb();
  const maps = db.prepare('SELECT * FROM tile_maps ORDER BY updated_at DESC').all();
  res.json(maps);
});

// POST /api/tilemap — create a new map (authenticated)
router.post('/', authenticateToken, (req, res) => {
  const { name, width, height } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const w = Math.max(5, Math.min(200, parseInt(width) || 30));
  const h = Math.max(5, Math.min(200, parseInt(height) || 30));

  const db = getDb();

  const existing = db.prepare('SELECT id FROM tile_maps WHERE name = ?').get(name.trim());
  if (existing) return res.status(409).json({ error: 'A map with that name already exists' });

  const insertMap = db.prepare(
    'INSERT INTO tile_maps (name, width, height) VALUES (?, ?, ?)'
  );
  const insertLayer = db.prepare(
    'INSERT INTO tile_map_layers (map_id, layer_index, name) VALUES (?, ?, ?)'
  );

  const create = db.transaction(() => {
    const result = insertMap.run(name.trim(), w, h);
    const mapId = result.lastInsertRowid;
    for (let i = 0; i < LAYER_NAMES.length; i++) {
      insertLayer.run(mapId, i, LAYER_NAMES[i]);
    }
    return mapId;
  });

  const mapId = create();
  const map = db.prepare('SELECT * FROM tile_maps WHERE id = ?').get(mapId);
  const layers = db.prepare('SELECT * FROM tile_map_layers WHERE map_id = ? ORDER BY layer_index').all(mapId);
  res.status(201).json({ ...map, layers });
});

// GET /api/tilemap/:id — full map data (map + layers + cells)
router.get('/:id', (req, res) => {
  const db = getDb();
  const map = db.prepare('SELECT * FROM tile_maps WHERE id = ?').get(req.params.id);
  if (!map) return res.status(404).json({ error: 'Map not found' });

  const layers = db.prepare(
    'SELECT * FROM tile_map_layers WHERE map_id = ? ORDER BY layer_index'
  ).all(map.id);

  const layerIds = layers.map(l => l.id);
  let cells = [];
  if (layerIds.length > 0) {
    const placeholders = layerIds.map(() => '?').join(',');
    cells = db.prepare(
      `SELECT * FROM tile_map_cells WHERE layer_id IN (${placeholders}) ORDER BY layer_id, grid_y, grid_x`
    ).all(...layerIds);
  }

  // Group cells by layer_id for convenience
  const cellsByLayer = {};
  for (const layer of layers) {
    cellsByLayer[layer.id] = [];
  }
  for (const cell of cells) {
    if (cellsByLayer[cell.layer_id]) {
      cellsByLayer[cell.layer_id].push(cell);
    }
  }

  res.json({
    ...map,
    layers: layers.map(l => ({
      ...l,
      cells: cellsByLayer[l.id] || [],
    })),
  });
});

// PUT /api/tilemap/:id — update map metadata (authenticated)
router.put('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const map = db.prepare('SELECT * FROM tile_maps WHERE id = ?').get(req.params.id);
  if (!map) return res.status(404).json({ error: 'Map not found' });

  const { name, width, height } = req.body;
  const newName = name ? name.trim() : map.name;
  const newW = width != null ? Math.max(5, Math.min(200, parseInt(width) || map.width)) : map.width;
  const newH = height != null ? Math.max(5, Math.min(200, parseInt(height) || map.height)) : map.height;

  if (newName !== map.name) {
    const dup = db.prepare('SELECT id FROM tile_maps WHERE name = ? AND id != ?').get(newName, map.id);
    if (dup) return res.status(409).json({ error: 'A map with that name already exists' });
  }

  db.prepare(
    "UPDATE tile_maps SET name = ?, width = ?, height = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(newName, newW, newH, map.id);

  const updated = db.prepare('SELECT * FROM tile_maps WHERE id = ?').get(map.id);
  res.json(updated);
});

// DELETE /api/tilemap/:id — delete a map and all its data (authenticated)
router.delete('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const map = db.prepare('SELECT * FROM tile_maps WHERE id = ?').get(req.params.id);
  if (!map) return res.status(404).json({ error: 'Map not found' });

  db.prepare('DELETE FROM tile_maps WHERE id = ?').run(map.id);
  res.json({ success: true });
});

// PUT /api/tilemap/:id/cells — batch upsert cells (authenticated)
// Body: { cells: [{ layer_index, grid_x, grid_y, sheet, sprite_x, sprite_y, sprite_w, sprite_h, walkable, interactable, portal_target }] }
router.put('/:id/cells', authenticateToken, (req, res) => {
  const db = getDb();
  const map = db.prepare('SELECT * FROM tile_maps WHERE id = ?').get(req.params.id);
  if (!map) return res.status(404).json({ error: 'Map not found' });

  const { cells } = req.body;
  if (!Array.isArray(cells)) return res.status(400).json({ error: 'cells must be an array' });
  if (cells.length > 5000) return res.status(400).json({ error: 'Too many cells in one batch (max 5000)' });

  const layers = db.prepare(
    'SELECT * FROM tile_map_layers WHERE map_id = ? ORDER BY layer_index'
  ).all(map.id);
  const layerByIndex = {};
  for (const l of layers) {
    layerByIndex[l.layer_index] = l;
  }

  const upsert = db.prepare(`
    INSERT INTO tile_map_cells (layer_id, grid_x, grid_y, sheet, sprite_x, sprite_y, sprite_w, sprite_h, walkable, interactable, portal_target)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(layer_id, grid_x, grid_y) DO UPDATE SET
      sheet = excluded.sheet,
      sprite_x = excluded.sprite_x,
      sprite_y = excluded.sprite_y,
      sprite_w = excluded.sprite_w,
      sprite_h = excluded.sprite_h,
      walkable = excluded.walkable,
      interactable = excluded.interactable,
      portal_target = excluded.portal_target
  `);

  const errors = [];
  const batchUpsert = db.transaction(() => {
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const layerIdx = parseInt(c.layer_index);
      const layer = layerByIndex[layerIdx];
      if (!layer) {
        errors.push({ index: i, error: `Invalid layer_index: ${c.layer_index}` });
        continue;
      }
      const gx = parseInt(c.grid_x);
      const gy = parseInt(c.grid_y);
      if (isNaN(gx) || isNaN(gy) || gx < 0 || gx >= map.width || gy < 0 || gy >= map.height) {
        errors.push({ index: i, error: 'Position out of bounds' });
        continue;
      }
      if (!c.sheet) {
        errors.push({ index: i, error: 'sheet is required' });
        continue;
      }
      upsert.run(
        layer.id, gx, gy,
        c.sheet,
        parseInt(c.sprite_x) || 0,
        parseInt(c.sprite_y) || 0,
        parseInt(c.sprite_w) || 16,
        parseInt(c.sprite_h) || 16,
        c.walkable != null ? (c.walkable ? 1 : 0) : 1,
        c.interactable ? 1 : 0,
        c.portal_target || null
      );
    }
  });

  batchUpsert();

  db.prepare("UPDATE tile_maps SET updated_at = datetime('now') WHERE id = ?").run(map.id);

  res.json({ success: true, saved: cells.length - errors.length, errors });
});

// DELETE /api/tilemap/:id/cells — batch delete cells (authenticated)
// Body: { cells: [{ layer_index, grid_x, grid_y }] }
router.delete('/:id/cells', authenticateToken, (req, res) => {
  const db = getDb();
  const map = db.prepare('SELECT * FROM tile_maps WHERE id = ?').get(req.params.id);
  if (!map) return res.status(404).json({ error: 'Map not found' });

  const { cells } = req.body;
  if (!Array.isArray(cells)) return res.status(400).json({ error: 'cells must be an array' });

  const layers = db.prepare(
    'SELECT * FROM tile_map_layers WHERE map_id = ? ORDER BY layer_index'
  ).all(map.id);
  const layerByIndex = {};
  for (const l of layers) {
    layerByIndex[l.layer_index] = l;
  }

  const del = db.prepare(
    'DELETE FROM tile_map_cells WHERE layer_id = ? AND grid_x = ? AND grid_y = ?'
  );

  const batchDelete = db.transaction(() => {
    let deleted = 0;
    for (const c of cells) {
      const layer = layerByIndex[parseInt(c.layer_index)];
      if (!layer) continue;
      const result = del.run(layer.id, parseInt(c.grid_x), parseInt(c.grid_y));
      deleted += result.changes;
    }
    return deleted;
  });

  const deleted = batchDelete();
  db.prepare("UPDATE tile_maps SET updated_at = datetime('now') WHERE id = ?").run(map.id);
  res.json({ success: true, deleted });
});

module.exports = router;
