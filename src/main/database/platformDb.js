/**
 * Platform database — global, not per-gym
 *
 * Stored at {DATA_ROOT}/platform.db
 * Holds billing records and billing events for all gyms.
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function getDataRoot() {
  return process.env.CRUX_DATA_DIR || process.env.BOULDERRYN_DATA_DIR || path.join(__dirname, '..', '..', '..', 'data');
}

let _db = null;

function getPlatformDb() {
  if (_db) return _db;

  const dataRoot = getDataRoot();
  fs.mkdirSync(dataRoot, { recursive: true });

  const dbPath = path.join(dataRoot, 'platform.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS gym_billing (
      gym_id TEXT PRIMARY KEY,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      plan TEXT NOT NULL DEFAULT 'growth',
      status TEXT NOT NULL DEFAULT 'trialing',
      trial_ends_at TEXT,
      current_period_end TEXT,
      cancel_at_period_end INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS billing_events (
      id TEXT PRIMARY KEY,
      gym_id TEXT,
      stripe_event_id TEXT UNIQUE,
      event_type TEXT,
      payload_json TEXT,
      processed_at TEXT DEFAULT (datetime('now'))
    );
  `);

  _db = db;
  return db;
}

function closePlatformDb() {
  if (_db) {
    try { _db.close(); } catch (e) { /* ignore */ }
    _db = null;
  }
}

module.exports = { getPlatformDb, closePlatformDb };
