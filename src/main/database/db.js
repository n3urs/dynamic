/**
 * Database connection manager — multi-gym aware
 *
 * Each gym has its own SQLite DB at:
 *   {DATA_ROOT}/gyms/{gym_id}/gym.db
 *
 * The active gym_id is threaded through request handling via AsyncLocalStorage
 * (set by the gym middleware in server.js). Outside of a request context
 * (e.g. startup seeding) it falls back to DEFAULT_GYM_ID env var or the
 * first gym found on disk.
 */

const path = require('path');
const fs = require('fs');
const gymContext = require('./gymContext');

const Database = require('better-sqlite3');

function getDataRoot() {
  return process.env.CRUX_DATA_DIR || process.env.BOULDERRYN_DATA_DIR || path.join(__dirname, '..', '..', '..', 'data');
}

// One open connection per gym_id, kept for the process lifetime
const connections = new Map();

/**
 * Detect the first gym that exists on disk (fallback for local dev with no
 * DEFAULT_GYM_ID set and no request context active).
 */
function detectFirstGym() {
  const gymsDir = path.join(getDataRoot(), 'gyms');
  if (!fs.existsSync(gymsDir)) return null;
  const entries = fs.readdirSync(gymsDir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      const dbPath = path.join(gymsDir, e.name, 'gym.db');
      if (fs.existsSync(dbPath)) return e.name;
    }
  }
  return null;
}

/**
 * Resolve the current gym_id from (in order):
 *   1. AsyncLocalStorage store (set by request middleware)
 *   2. DEFAULT_GYM_ID env var (set in /etc/dynamic.env for single-gym deploys)
 *   3. First gym found on disk (local dev convenience)
 */
function getCurrentGymId() {
  const store = gymContext.getStore();
  if (store && store.gymId) return store.gymId;
  if (process.env.DEFAULT_GYM_ID) return process.env.DEFAULT_GYM_ID;
  const found = detectFirstGym();
  if (found) return found;
  throw new Error(
    'No gym context active and no DEFAULT_GYM_ID set. ' +
    'Run "node scripts/provision-gym.js <gym_id>" to create a gym first.'
  );
}

/**
 * Get (or open) the SQLite connection for the current gym.
 * This is the only function the rest of the codebase needs to call.
 */
function getDb() {
  const gymId = getCurrentGymId();

  if (connections.has(gymId)) {
    return connections.get(gymId);
  }

  const gymDir = path.join(getDataRoot(), 'gyms', gymId);
  const dbPath = path.join(gymDir, 'gym.db');

  // Auto-migrate legacy single-gym layout on first access
  const legacyPath = path.join(getDataRoot(), 'gym.db');
  if (!fs.existsSync(dbPath) && fs.existsSync(legacyPath)) {
    fs.mkdirSync(path.join(gymDir, 'photos'), { recursive: true });
    fs.renameSync(legacyPath, dbPath);
    console.log(`[db] Migrated: data/gym.db → data/gyms/${gymId}/gym.db`);
  }

  if (!fs.existsSync(gymDir)) {
    fs.mkdirSync(path.join(gymDir, 'photos'), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Apply schema if fresh database
  const tableCheck = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='members'").get();
  if (tableCheck.count === 0) {
    const schemaPath = path.join(__dirname, '..', '..', 'shared', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    console.log(`[db] Fresh database for gym "${gymId}" — schema applied.`);
  }

  // Run column migrations for DBs created before new columns were added
  runMigrations(db);

  connections.set(gymId, db);
  return db;
}

function runMigrations(db) {
  // ALTER TABLE ADD COLUMN throws if column already exists — try/catch each one
  const tryAdd = (sql) => { try { db.exec(sql); } catch (_) {} };
  tryAdd('ALTER TABLE staff ADD COLUMN invite_token TEXT');
  tryAdd('ALTER TABLE staff ADD COLUMN invite_expires_at TEXT');
  tryAdd('ALTER TABLE staff ADD COLUMN invite_accepted INTEGER DEFAULT 0');
  tryAdd('ALTER TABLE walls ADD COLUMN room_id TEXT');
  tryAdd('ALTER TABLE walls ADD COLUMN path_json TEXT');
  tryAdd(`CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  tryAdd("INSERT OR IGNORE INTO settings (key, value) VALUES ('setup_complete', '0')");
}

/**
 * Get the photos directory for the current gym.
 * Use this in routes instead of hardcoding a path.
 */
function getPhotosDir() {
  const gymId = getCurrentGymId();
  return path.join(getDataRoot(), 'gyms', gymId, 'photos');
}

/**
 * Close all open gym connections (called on SIGINT/SIGTERM).
 */
function closeAll() {
  for (const [gymId, db] of connections) {
    try {
      db.close();
    } catch (e) { /* ignore */ }
  }
  connections.clear();
}

// Legacy alias — keep for any code that calls closeDb()
function closeDb() {
  closeAll();
}

module.exports = { getDb, getPhotosDir, closeDb, closeAll, gymContext };
