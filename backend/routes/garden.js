const express = require('express');
const { getDb } = require('../db/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const PLANT_TYPES = [
  'sunflower', 'cactus', 'bonsai', 'herb', 'rose', 'vine', 'mushroom', 'fern',
];

const MAX_GROWTH = 4;   // 0-4 (5 stages: seed, sprout, young, mature, blooming)
const MAX_WITHER = 2;   // 0-2 (3 stages: fading, wilting, withered)

// GET /api/garden — all plants + grid settings
router.get('/', (_req, res) => {
  const db = getDb();
  const plants = db.prepare(`
    SELECT garden_plants.*, users.display_name AS author_name
    FROM garden_plants
    JOIN users ON users.id = garden_plants.author_id
    ORDER BY garden_plants.created_at DESC
  `).all();
  const settings = db.prepare('SELECT * FROM garden_settings WHERE id = 1').get();
  res.json({ plants, settings: settings || { grid_width: 15, grid_height: 15 } });
});

// GET /api/garden/types — list available plant types
router.get('/types', (_req, res) => {
  res.json(PLANT_TYPES);
});

// POST /api/garden/plant — plant something (authenticated)
router.post('/plant', authenticateToken, (req, res) => {
  const { title, description, plant_type, grid_x, grid_y } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (grid_x == null || grid_y == null) return res.status(400).json({ error: 'grid position is required' });
  if (plant_type && !PLANT_TYPES.includes(plant_type)) {
    return res.status(400).json({ error: 'Invalid plant type' });
  }

  const db = getDb();
  const settings = db.prepare('SELECT * FROM garden_settings WHERE id = 1').get();
  const gw = settings ? settings.grid_width : 15;
  const gh = settings ? settings.grid_height : 15;

  if (grid_x < 0 || grid_x >= gw || grid_y < 0 || grid_y >= gh) {
    return res.status(400).json({ error: 'Position out of bounds' });
  }

  const existing = db.prepare(
    'SELECT id FROM garden_plants WHERE grid_x = ? AND grid_y = ?'
  ).get(grid_x, grid_y);
  if (existing) return res.status(409).json({ error: 'Plot already occupied' });

  const result = db.prepare(`
    INSERT INTO garden_plants (author_id, title, description, plant_type, grid_x, grid_y)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.id, title, description || '', plant_type || 'sunflower', grid_x, grid_y);

  const plant = db.prepare('SELECT * FROM garden_plants WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(plant);
});

// POST /api/garden/:id/water — water a plant (authenticated, owner only)
router.post('/:id/water', authenticateToken, (req, res) => {
  const db = getDb();
  const plant = db.prepare('SELECT * FROM garden_plants WHERE id = ?').get(req.params.id);
  if (!plant) return res.status(404).json({ error: 'Plant not found' });
  if (plant.author_id !== req.user.id) return res.status(403).json({ error: 'Not your plant' });
  if (plant.wither_stage > 0) return res.status(400).json({ error: 'Cannot water a withering plant. Revive it first.' });
  if (plant.growth_stage >= MAX_GROWTH) return res.status(400).json({ error: 'Plant is fully grown!' });

  const newGrowth = plant.growth_stage + 1;
  const newWaterCount = plant.water_count + 1;
  db.prepare(`
    UPDATE garden_plants
    SET growth_stage = ?, water_count = ?, last_watered = datetime('now'), last_touched = datetime('now')
    WHERE id = ?
  `).run(newGrowth, newWaterCount, plant.id);

  const updated = db.prepare('SELECT * FROM garden_plants WHERE id = ?').get(plant.id);
  res.json(updated);
});

// POST /api/garden/:id/wither — advance wither (authenticated, owner only)
router.post('/:id/wither', authenticateToken, (req, res) => {
  const db = getDb();
  const plant = db.prepare('SELECT * FROM garden_plants WHERE id = ?').get(req.params.id);
  if (!plant) return res.status(404).json({ error: 'Plant not found' });
  if (plant.author_id !== req.user.id) return res.status(403).json({ error: 'Not your plant' });
  if (plant.wither_stage >= MAX_WITHER) return res.status(400).json({ error: 'Plant is fully withered' });

  const newWither = plant.wither_stage + 1;
  db.prepare(`
    UPDATE garden_plants SET wither_stage = ?, last_touched = datetime('now') WHERE id = ?
  `).run(newWither, plant.id);

  const updated = db.prepare('SELECT * FROM garden_plants WHERE id = ?').get(plant.id);
  res.json(updated);
});

// POST /api/garden/:id/revive — remove one wither stage (authenticated, owner only)
router.post('/:id/revive', authenticateToken, (req, res) => {
  const db = getDb();
  const plant = db.prepare('SELECT * FROM garden_plants WHERE id = ?').get(req.params.id);
  if (!plant) return res.status(404).json({ error: 'Plant not found' });
  if (plant.author_id !== req.user.id) return res.status(403).json({ error: 'Not your plant' });
  if (plant.wither_stage <= 0) return res.status(400).json({ error: 'Plant is not withering' });

  db.prepare(`
    UPDATE garden_plants SET wither_stage = wither_stage - 1, last_touched = datetime('now') WHERE id = ?
  `).run(plant.id);

  const updated = db.prepare('SELECT * FROM garden_plants WHERE id = ?').get(plant.id);
  res.json(updated);
});

// POST /api/garden/:id/sunshine — visitor sunshine (no auth required)
router.post('/:id/sunshine', (req, res) => {
  const db = getDb();
  const plant = db.prepare('SELECT * FROM garden_plants WHERE id = ?').get(req.params.id);
  if (!plant) return res.status(404).json({ error: 'Plant not found' });

  db.prepare(`
    UPDATE garden_plants SET sunshine_count = sunshine_count + 1 WHERE id = ?
  `).run(plant.id);

  const updated = db.prepare('SELECT * FROM garden_plants WHERE id = ?').get(plant.id);
  res.json({ sunshine_count: updated.sunshine_count });
});

// DELETE /api/garden/:id — remove a plant (authenticated, owner only)
router.delete('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const plant = db.prepare('SELECT * FROM garden_plants WHERE id = ?').get(req.params.id);
  if (!plant) return res.status(404).json({ error: 'Plant not found' });
  if (plant.author_id !== req.user.id) return res.status(403).json({ error: 'Not your plant' });

  db.prepare('DELETE FROM garden_plants WHERE id = ?').run(plant.id);
  res.json({ success: true });
});

// PUT /api/garden/settings — update grid size (authenticated)
router.put('/settings', authenticateToken, (req, res) => {
  const { grid_width, grid_height } = req.body;
  if (!grid_width || !grid_height) return res.status(400).json({ error: 'grid_width and grid_height required' });
  if (grid_width < 5 || grid_height < 5 || grid_width > 50 || grid_height > 50) {
    return res.status(400).json({ error: 'Grid size must be between 5 and 50' });
  }

  const db = getDb();
  db.prepare('UPDATE garden_settings SET grid_width = ?, grid_height = ? WHERE id = 1').run(grid_width, grid_height);
  const settings = db.prepare('SELECT * FROM garden_settings WHERE id = 1').get();
  res.json(settings);
});

module.exports = router;
