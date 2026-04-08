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

    -- Tile Map Editor tables
    CREATE TABLE IF NOT EXISTS tile_maps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      width INTEGER NOT NULL DEFAULT 30,
      height INTEGER NOT NULL DEFAULT 30,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tile_map_layers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      map_id INTEGER NOT NULL,
      layer_index INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL DEFAULT 'ground',
      UNIQUE(map_id, layer_index),
      FOREIGN KEY (map_id) REFERENCES tile_maps(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tile_map_cells (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layer_id INTEGER NOT NULL,
      grid_x INTEGER NOT NULL,
      grid_y INTEGER NOT NULL,
      sheet TEXT NOT NULL,
      sprite_x INTEGER NOT NULL DEFAULT 0,
      sprite_y INTEGER NOT NULL DEFAULT 0,
      sprite_w INTEGER NOT NULL DEFAULT 16,
      sprite_h INTEGER NOT NULL DEFAULT 16,
      walkable INTEGER NOT NULL DEFAULT 1,
      interactable INTEGER NOT NULL DEFAULT 0,
      portal_target TEXT,
      anim_frames INTEGER NOT NULL DEFAULT 1,
      anim_speed REAL NOT NULL DEFAULT 150,
      anim_step INTEGER NOT NULL DEFAULT 1,
      UNIQUE(layer_id, grid_x, grid_y),
      FOREIGN KEY (layer_id) REFERENCES tile_map_layers(id) ON DELETE CASCADE
    );
  `);

  // Migrations for existing databases
  const cols = db.prepare("PRAGMA table_info(tile_map_cells)").all().map(c => c.name);
  if (!cols.includes('anim_frames')) {
    db.exec(`
      ALTER TABLE tile_map_cells ADD COLUMN anim_frames INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE tile_map_cells ADD COLUMN anim_speed REAL NOT NULL DEFAULT 150;
      ALTER TABLE tile_map_cells ADD COLUMN anim_step INTEGER NOT NULL DEFAULT 1;
    `);
  }
  if (cols.includes('anim_frames') && !cols.includes('anim_step')) {
    db.exec(`ALTER TABLE tile_map_cells ADD COLUMN anim_step INTEGER NOT NULL DEFAULT 1;`);
  }
}

module.exports = { getDb };
