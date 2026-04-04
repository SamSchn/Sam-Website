const express = require('express');
const { getDb } = require('../db/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/notes — all bulletin board notes (public)
router.get('/', (_req, res) => {
  const db = getDb();
  const notes = db.prepare(`
    SELECT notes.*, users.display_name AS author_name
    FROM notes
    JOIN users ON users.id = notes.author_id
    ORDER BY notes.pinned DESC, notes.created_at DESC
  `).all();
  res.json(notes);
});

// POST /api/notes — create sticky note (authenticated)
router.post('/', authenticateToken, (req, res) => {
  const { content, color, posX, posY } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO notes (author_id, content, color, pos_x, pos_y) VALUES (?, ?, ?, ?, ?)'
  ).run(req.user.id, content, color || '#fef08a', posX || 0, posY || 0);

  const note = db.prepare(`
    SELECT notes.*, users.display_name AS author_name
    FROM notes
    JOIN users ON users.id = notes.author_id
    WHERE notes.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(note);
});

// PUT /api/notes/:id — update note (owner only)
router.put('/:id', authenticateToken, (req, res) => {
  const { content, color, posX, posY, pinned } = req.body;
  const db = getDb();

  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (note.author_id !== req.user.id) return res.status(403).json({ error: 'Not your note' });

  db.prepare(
    'UPDATE notes SET content = ?, color = ?, pos_x = ?, pos_y = ?, pinned = ? WHERE id = ?'
  ).run(
    content ?? note.content,
    color ?? note.color,
    posX ?? note.pos_x,
    posY ?? note.pos_y,
    pinned ?? note.pinned,
    req.params.id
  );

  const updated = db.prepare(`
    SELECT notes.*, users.display_name AS author_name
    FROM notes
    JOIN users ON users.id = notes.author_id
    WHERE notes.id = ?
  `).get(req.params.id);

  res.json(updated);
});

// DELETE /api/notes/:id — delete note (owner only)
router.delete('/:id', authenticateToken, (req, res) => {
  const db = getDb();

  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (note.author_id !== req.user.id) return res.status(403).json({ error: 'Not your note' });

  db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  res.json({ message: 'Note deleted' });
});

module.exports = router;
