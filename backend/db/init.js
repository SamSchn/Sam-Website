const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'samwebsite.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    createTables();
  }
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (author_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      color TEXT DEFAULT '#fef08a',
      pos_x INTEGER DEFAULT 0,
      pos_y INTEGER DEFAULT 0,
      pinned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (author_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS garden_plants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      plant_type TEXT NOT NULL DEFAULT 'sunflower',
      grid_x INTEGER NOT NULL DEFAULT 0,
      grid_y INTEGER NOT NULL DEFAULT 0,
      growth_stage INTEGER NOT NULL DEFAULT 0,
      wither_stage INTEGER NOT NULL DEFAULT 0,
      water_count INTEGER NOT NULL DEFAULT 0,
      sunshine_count INTEGER NOT NULL DEFAULT 0,
      last_watered TEXT,
      last_touched TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (author_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS garden_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      grid_width INTEGER NOT NULL DEFAULT 15,
      grid_height INTEGER NOT NULL DEFAULT 15
    );

    INSERT OR IGNORE INTO garden_settings (id, grid_width, grid_height) VALUES (1, 15, 15);
  `);
}

module.exports = { getDb };
