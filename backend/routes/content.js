const express = require('express');
const { getDb } = require('../db/init');
const { authenticateToken } = require('../middleware/auth');

// Site content the owner edits in-game (About, Projects, Resume, Contact).
// Defaults ship with the frontend; rows here override them.
const router = express.Router();

const KEYS = ['about', 'projects', 'resume', 'contact'];

// GET /api/content — every saved section, e.g. { about: {...}, projects: [...] }
router.get('/', (_req, res) => {
  const rows = getDb().prepare('SELECT key, data FROM site_content').all();
  const out = {};
  for (const r of rows) {
    if (KEYS.includes(r.key)) out[r.key] = JSON.parse(r.data);
  }
  res.json(out);
});

// PUT /api/content/:key — save a section (authenticated)
router.put('/:key', authenticateToken, (req, res) => {
  const { key } = req.params;
  if (!KEYS.includes(key)) return res.status(400).json({ error: 'Unknown content section' });
  const { data } = req.body;
  if (data === undefined || data === null || typeof data !== 'object') {
    return res.status(400).json({ error: 'data must be an object or array' });
  }
  getDb().prepare(`
    INSERT INTO site_content (key, data, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).run(key, JSON.stringify(data));
  res.json({ success: true });
});

// DELETE /api/content/:key — go back to the built-in default (authenticated)
router.delete('/:key', authenticateToken, (req, res) => {
  if (!KEYS.includes(req.params.key)) return res.status(400).json({ error: 'Unknown content section' });
  getDb().prepare('DELETE FROM site_content WHERE key = ?').run(req.params.key);
  res.json({ success: true });
});

module.exports = router;
