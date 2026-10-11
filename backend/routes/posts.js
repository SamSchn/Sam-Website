const express = require('express');
const { getDb } = require('../db/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const SELECT_POST = `
  SELECT posts.*, users.display_name AS author_name, users.username AS author_username
  FROM posts
  JOIN users ON users.id = posts.author_id
`;

// GET /api/posts — list all posts (public)
router.get('/', (_req, res) => {
  const db = getDb();
  const posts = db.prepare(`${SELECT_POST} ORDER BY posts.created_at DESC`).all();
  res.json(posts);
});

// GET /api/posts/:id — single post (public)
router.get('/:id', (req, res) => {
  const db = getDb();
  const post = db.prepare(`${SELECT_POST} WHERE posts.id = ?`).get(req.params.id);

  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

// POST /api/posts — create post (authenticated)
router.post('/', authenticateToken, (req, res) => {
  const { title, body } = req.body;
  if (typeof title !== 'string' || typeof body !== 'string' || !title.trim() || !body.trim()) {
    return res.status(400).json({ error: 'title and body are required' });
  }

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO posts (author_id, title, body) VALUES (?, ?, ?)'
  ).run(req.user.id, title, body);

  const post = db.prepare(`${SELECT_POST} WHERE posts.id = ?`).get(result.lastInsertRowid);
  res.status(201).json(post);
});

// PUT /api/posts/:id — update post (owner only)
router.put('/:id', authenticateToken, (req, res) => {
  const { title, body } = req.body;
  if ((title != null && typeof title !== 'string') || (body != null && typeof body !== 'string')) {
    return res.status(400).json({ error: 'title and body must be strings' });
  }
  const db = getDb();

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.author_id !== req.user.id) return res.status(403).json({ error: 'Not your post' });

  db.prepare(
    "UPDATE posts SET title = ?, body = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(title || post.title, body || post.body, req.params.id);

  const updated = db.prepare(`${SELECT_POST} WHERE posts.id = ?`).get(req.params.id);
  res.json(updated);
});

// DELETE /api/posts/:id — delete post (owner only)
router.delete('/:id', authenticateToken, (req, res) => {
  const db = getDb();

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.author_id !== req.user.id) return res.status(403).json({ error: 'Not your post' });

  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ message: 'Post deleted' });
});

module.exports = router;
