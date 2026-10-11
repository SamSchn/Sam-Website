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

    -- Owner-edited site content (About, Projects, ...) as JSON, see routes/content.js
    CREATE TABLE IF NOT EXISTS site_content (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Edited copies of the built-in game maps (JSON), see routes/gameMaps.js
    CREATE TABLE IF NOT EXISTS game_maps (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

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

  migrateGarden();
}

// Garden v2: real-time growth with per-plant speeds, real crop types, and a
// fixed 12x6 grid of beds. Existing plants keep the stage they had reached.
function migrateGarden() {
  const { GRID } = require('../garden/growth');
  const cols = db.prepare('PRAGMA table_info(garden_plants)').all().map(c => c.name);
  if (cols.includes('growth_hours')) return;

  db.transaction(() => {
    db.exec(`
      ALTER TABLE garden_plants ADD COLUMN growth_hours REAL NOT NULL DEFAULT 24;
      ALTER TABLE garden_plants ADD COLUMN wither_hours REAL NOT NULL DEFAULT 72;
      ALTER TABLE garden_plants ADD COLUMN setbacks INTEGER NOT NULL DEFAULT 0;
    `);
    // Pretend every plant just finished a watering cycle so its current stage
    // is preserved and it starts healthy
    db.exec(`
      UPDATE garden_plants
      SET setbacks = water_count - growth_stage,
          last_watered = datetime('now', '-24 hours')
    `);

    const renames = {
      cactus: 'cucumber', bonsai: 'kale', herb: 'leek', rose: 'strawberry',
      vine: 'grapes', mushroom: 'potato', fern: 'cabbage',
    };
    const rename = db.prepare('UPDATE garden_plants SET plant_type = ? WHERE plant_type = ?');
    for (const [from, to] of Object.entries(renames)) rename.run(to, from);

    // Move plants that fall outside the new grid into free plots
    const plants = db.prepare('SELECT id, grid_x, grid_y FROM garden_plants ORDER BY created_at').all();
    const taken = new Set(plants
      .filter(p => p.grid_x < GRID.cols && p.grid_y < GRID.rows)
      .map(p => `${p.grid_x},${p.grid_y}`));
    const move = db.prepare('UPDATE garden_plants SET grid_x = ?, grid_y = ? WHERE id = ?');
    for (const p of plants) {
      if (p.grid_x < GRID.cols && p.grid_y < GRID.rows) continue;
      let placed = false;
      for (let y = 0; y < GRID.rows && !placed; y++) {
        for (let x = 0; x < GRID.cols && !placed; x++) {
          if (taken.has(`${x},${y}`)) continue;
          move.run(x, y, p.id);
          taken.add(`${x},${y}`);
          placed = true;
        }
      }
      if (!placed) console.warn(`Garden migration: no free plot for plant ${p.id}`);
    }
    db.prepare('UPDATE garden_settings SET grid_width = ?, grid_height = ? WHERE id = 1').run(GRID.cols, GRID.rows);
  })();
}

module.exports = { getDb };
