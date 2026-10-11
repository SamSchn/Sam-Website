const express = require('express');
const { getDb } = require('../db/init');
const { authenticateToken } = require('../middleware/auth');
const { CROPS, GRID, LIMITS, MAX_STAGE, plantState } = require('../garden/growth');

const router = express.Router();

const SELECT_PLANT = `
  SELECT garden_plants.*, users.display_name AS author_name
  FROM garden_plants
  JOIN users ON users.id = garden_plants.author_id
`;

function withState(p, now = Date.now()) {
  return {
    id: p.id,
    author_id: p.author_id,
    author_name: p.author_name,
    title: p.title,
    description: p.description,
    crop: p.plant_type,
    grid_x: p.grid_x,
    grid_y: p.grid_y,
    growth_hours: p.growth_hours,
    wither_hours: p.wither_hours,
    water_count: p.water_count,
    sunshine_count: p.sunshine_count,
    setbacks: p.setbacks,
    last_watered: p.last_watered,
    created_at: p.created_at,
    state: plantState(p, now),
  };
}

const getPlant = (id) => getDb().prepare(`${SELECT_PLANT} WHERE garden_plants.id = ?`).get(id);

function readSpeeds(body, current = {}) {
  const out = {};
  for (const [key, limit] of [['growth_hours', LIMITS.growth], ['wither_hours', LIMITS.wither]]) {
    const v = body[key] ?? current[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < limit.min || v > limit.max) {
      return { error: `${key} must be between ${limit.min} and ${limit.max} hours` };
    }
    out[key] = v;
  }
  return out;
}

// GET /api/garden — every plant with its current growth state
router.get('/', (_req, res) => {
  const now = Date.now();
  const plants = getDb().prepare(`${SELECT_PLANT} ORDER BY garden_plants.created_at`).all();
  res.json({ plants: plants.map(p => withState(p, now)), grid: GRID, maxStage: MAX_STAGE, crops: CROPS, now });
});

// POST /api/garden/plant — plant a seed (owner). Planting also waters it.
router.post('/plant', authenticateToken, (req, res) => {
  const { title, description, crop, grid_x, grid_y } = req.body;
  if (typeof title !== 'string' || !title.trim() || title.length > 80) {
    return res.status(400).json({ error: 'Give your idea a name (up to 80 characters)' });
  }
  if (description != null && (typeof description !== 'string' || description.length > 2000)) {
    return res.status(400).json({ error: 'Description must be text (up to 2000 characters)' });
  }
  if (!CROPS.includes(crop)) return res.status(400).json({ error: 'Pick a seed to plant' });
  if (!Number.isInteger(grid_x) || !Number.isInteger(grid_y)
      || grid_x < 0 || grid_y < 0 || grid_x >= GRID.cols || grid_y >= GRID.rows) {
    return res.status(400).json({ error: 'That plot is outside the garden' });
  }
  const speeds = readSpeeds(req.body);
  if (speeds.error) return res.status(400).json({ error: speeds.error });

  const db = getDb();
  if (db.prepare('SELECT id FROM garden_plants WHERE grid_x = ? AND grid_y = ?').get(grid_x, grid_y)) {
    return res.status(409).json({ error: 'Something is already growing there' });
  }
  const result = db.prepare(`
    INSERT INTO garden_plants
      (author_id, title, description, plant_type, grid_x, grid_y, growth_hours, wither_hours, water_count, last_watered)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
  `).run(req.user.id, title.trim(), (description || '').trim(), crop, grid_x, grid_y, speeds.growth_hours, speeds.wither_hours);

  res.status(201).json(withState(getPlant(result.lastInsertRowid)));
});

// POST /api/garden/:id/water — anyone can water a dry plant
router.post('/:id/water', (req, res) => {
  const plant = getPlant(req.params.id);
  if (!plant) return res.status(404).json({ error: 'Plant not found' });

  const now = Date.now();
  const st = plantState(plant, now);
  if (st.watered) {
    return res.status(409).json({ error: 'The soil is still damp. Come back when it dries out!' });
  }
  // Reviving a withered plant costs it a stage
  const setbacks = st.wither === 2 ? st.completed - Math.max(0, st.stage - 1) : plant.setbacks;
  getDb().prepare(`
    UPDATE garden_plants
    SET water_count = water_count + 1, last_watered = datetime('now'), setbacks = ?, last_touched = datetime('now')
    WHERE id = ?
  `).run(setbacks, plant.id);

  res.json({ plant: withState(getPlant(plant.id)), revived: st.wither > 0, lostStage: st.wither === 2 && st.stage > 0 });
});

// POST /api/garden/:id/sunshine — visitors can cheer a plant on
router.post('/:id/sunshine', (req, res) => {
  const db = getDb();
  const result = db.prepare('UPDATE garden_plants SET sunshine_count = sunshine_count + 1 WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Plant not found' });
  res.json(withState(getPlant(req.params.id)));
});

// PUT /api/garden/:id — edit an idea (owner)
router.put('/:id', authenticateToken, (req, res) => {
  const plant = getPlant(req.params.id);
  if (!plant) return res.status(404).json({ error: 'Plant not found' });
  if (plant.author_id !== req.user.id) return res.status(403).json({ error: 'Not your plant' });

  const { title, description, crop } = req.body;
  if (title != null && (typeof title !== 'string' || !title.trim() || title.length > 80)) {
    return res.status(400).json({ error: 'Title must be 1-80 characters' });
  }
  if (description != null && (typeof description !== 'string' || description.length > 2000)) {
    return res.status(400).json({ error: 'Description must be text (up to 2000 characters)' });
  }
  if (crop != null && !CROPS.includes(crop)) return res.status(400).json({ error: 'Unknown crop' });
  const speeds = readSpeeds(req.body, plant);
  if (speeds.error) return res.status(400).json({ error: speeds.error });

  getDb().prepare(`
    UPDATE garden_plants SET title = ?, description = ?, plant_type = ?, growth_hours = ?, wither_hours = ? WHERE id = ?
  `).run(
    title != null ? title.trim() : plant.title,
    description != null ? description.trim() : plant.description,
    crop ?? plant.plant_type,
    speeds.growth_hours,
    speeds.wither_hours,
    plant.id,
  );
  res.json(withState(getPlant(plant.id)));
});

// DELETE /api/garden/:id — pull a plant up (owner)
router.delete('/:id', authenticateToken, (req, res) => {
  const plant = getPlant(req.params.id);
  if (!plant) return res.status(404).json({ error: 'Plant not found' });
  if (plant.author_id !== req.user.id) return res.status(403).json({ error: 'Not your plant' });
  getDb().prepare('DELETE FROM garden_plants WHERE id = ?').run(plant.id);
  res.json({ success: true });
});

module.exports = router;
