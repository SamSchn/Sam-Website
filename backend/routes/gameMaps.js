const express = require('express');
const { getDb } = require('../db/init');
const { authenticateToken } = require('../middleware/auth');

// Edited copies of the built-in game maps. The frontend ships each map's
// default in code; a row here (saved from the editor) overrides it.
const router = express.Router();

const ID_RE = /^[a-z0-9_-]{1,40}$/;

// GET /api/game-maps/:id — { data } or { data: null } when using the default
router.get('/:id', (req, res) => {
  if (!ID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid map id' });
  const row = getDb().prepare('SELECT data, updated_at FROM game_maps WHERE id = ?').get(req.params.id);
  res.json(row ? { data: JSON.parse(row.data), updated_at: row.updated_at } : { data: null });
});

// PUT /api/game-maps/:id — save an edited map (authenticated)
router.put('/:id', authenticateToken, (req, res) => {
  if (!ID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid map id' });
  const { data } = req.body;
  if (!data || typeof data !== 'object' || !Array.isArray(data.terrain) || !Array.isArray(data.objects)) {
    return res.status(400).json({ error: 'data must include terrain and objects arrays' });
  }
  if (!data.terrain.every(r => typeof r === 'string')) {
    return res.status(400).json({ error: 'terrain rows must be strings' });
  }
  getDb().prepare(`
    INSERT INTO game_maps (id, data, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).run(req.params.id, JSON.stringify(data));
  res.json({ success: true });
});

// DELETE /api/game-maps/:id — discard edits and go back to the built-in map
router.delete('/:id', authenticateToken, (req, res) => {
  if (!ID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid map id' });
  getDb().prepare('DELETE FROM game_maps WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
