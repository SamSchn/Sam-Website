const express = require('express');
const { getDb } = require('../db/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/posts — list all posts (public)
router.get('/', (_req, res) => {
  const db = getDb();
  const posts = db.prepare(`
    SELECT posts.*, users.display_name AS author_name, users.username AS author_username
    FROM posts
    JOIN users ON users.id = posts.author_id
    ORDER BY posts.created_at DESC
  `).all();
  res.json(posts);
});

// GET /api/posts/:id — single post (public)
router.get('/:id', (req, res) => {
  const db = getDb();
  const post = db.prepare(`
    SELECT posts.*, users.display_name AS author_name, users.username AS author_username
    FROM posts
    JOIN users ON users.id = posts.author_id
    WHERE posts.id = ?
  `).get(req.params.id);

  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

// POST /api/posts — create post (authenticated)
router.post('/', authenticateToken, (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: 'title and body are required' });
  }

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO posts (author_id, title, body) VALUES (?, ?, ?)'
  ).run(req.user.id, title, body);

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(post);
});

// PUT /api/posts/:id — update post (owner only)
router.put('/:id', authenticateToken, (req, res) => {
  const { title, body } = req.body;
  const db = getDb();

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.author_id !== req.user.id) return res.status(403).json({ error: 'Not your post' });

  db.prepare(
    "UPDATE posts SET title = ?, body = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(title || post.title, body || post.body, req.params.id);

  const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
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
