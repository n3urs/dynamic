#!/usr/bin/env node
/**
 * Provision a new gym instance
 *
 * Usage:
 *   node scripts/provision-gym.js <gym_id> [gym_name]
 *
 * Examples:
 *   node scripts/provision-gym.js boulderryn "BoulderRyn"
 *   node scripts/provision-gym.js climbhigh "Climb High Leeds"
 *
 * Creates:
 *   data/gyms/<gym_id>/gym.db   — SQLite database with schema
 *   data/gyms/<gym_id>/photos/  — member photo storage
 *
 * Seeds:
 *   - Default pass types
 *   - Default waiver templates
 *   - Default products
 *   - Settings (gym_name, etc.)
 *   - First-run owner account (staff must be added via UI after first login)
 *
 * Safe to re-run: skips seeding if data already exists.
 */

const path = require('path');
const fs = require('fs');

// ── Args ───────────────────────────────────────────────────────────────────

const gymId = process.argv[2];
const gymName = process.argv[3] || '';

if (!gymId) {
  console.error('Usage: node scripts/provision-gym.js <gym_id> [gym_name]');
  console.error('Example: node scripts/provision-gym.js boulderryn "BoulderRyn"');
  process.exit(1);
}

if (!/^[a-z0-9-]{2,30}$/.test(gymId)) {
  console.error('gym_id must be 2–30 characters, lowercase letters, numbers and hyphens only.');
  process.exit(1);
}

// ── Paths ──────────────────────────────────────────────────────────────────

const dataRoot = process.env.DYNAMIC_DATA_DIR || process.env.BOULDERRYN_DATA_DIR || path.join(__dirname, '..', 'data');
const gymDir = path.join(dataRoot, 'gyms', gymId);
const photosDir = path.join(gymDir, 'photos');
const dbPath = path.join(gymDir, 'gym.db');
const schemaPath = path.join(__dirname, '..', 'src', 'shared', 'schema.sql');

// ── Check for legacy single-gym DB ────────────────────────────────────────

const legacyDbPath = path.join(dataRoot, 'gym.db');
const migratingLegacy = !fs.existsSync(dbPath) && fs.existsSync(legacyDbPath);

// ── Create directories ─────────────────────────────────────────────────────

fs.mkdirSync(photosDir, { recursive: true });

if (migratingLegacy) {
  console.log(`Migrating existing gym.db → data/gyms/${gymId}/gym.db ...`);
  fs.renameSync(legacyDbPath, dbPath);
}

const isNew = !migratingLegacy || !fs.existsSync(dbPath);
console.log(`\n${isNew ? 'Provisioning new gym' : 'Updating existing gym'}: ${gymId}${gymName ? ` (${gymName})` : ''}`);
console.log(`  DB:     ${dbPath}`);
console.log(`  Photos: ${photosDir}`);

// ── Open / create DB ───────────────────────────────────────────────────────

const Database = require('better-sqlite3');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply schema if needed
const tableCheck = db.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name='members'").get();
if (tableCheck.c === 0) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
  console.log('  Schema applied.');
} else {
  console.log('  Schema already applied — skipping.');
}

// ── Set gym_name in settings ───────────────────────────────────────────────

if (gymName) {
  const existing = db.prepare("SELECT value FROM settings WHERE key = 'gym_name'").get();
  if (!existing || !existing.value) {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('gym_name', ?)").run(gymName);
    console.log(`  Set gym_name = "${gymName}"`);
  } else {
    console.log(`  gym_name already set to "${existing.value}" — skipping.`);
  }
}

db.close();

// ── Seed via models (require gym context) ─────────────────────────────────

// Set up gym context so models' getDb() calls hit the right DB
const gymContext = require('../src/main/database/gymContext');
const { getDb } = require('../src/main/database/db');

const Pass = require('../src/main/models/pass');
const Waiver = require('../src/main/models/waiver');
const { seedProducts } = require('../src/main/models/seed-products');
const { ensureClimberTables } = require('../src/routes/climber');

gymContext.run({ gymId }, () => {
  getDb(); // open connection in context

  const passCount = Pass.seedDefaults();
  if (passCount) console.log(`  Seeded ${passCount} pass types.`);
  else console.log('  Pass types already seeded — skipping.');

  const waiverCount = Waiver.seedDefaults();
  if (waiverCount) console.log(`  Seeded ${waiverCount} waiver templates.`);
  else console.log('  Waiver templates already seeded — skipping.');

  const productCount = seedProducts();
  if (productCount) console.log(`  Seeded ${productCount} products.`);
  else console.log('  Products already seeded — skipping.');

  ensureClimberTables();
  console.log('  Climber tables ensured.');

  console.log(`\n✓ Gym "${gymId}" is ready.`);
  if (!gymName) {
    console.log(`\n  Tip: set the gym name in Settings > General after first login.`);
  }
  console.log(`  Add staff via: Settings > Staff, or use the first-run setup on first browser visit.`);
  if (!process.env.DEFAULT_GYM_ID) {
    console.log(`\n  For local dev, set DEFAULT_GYM_ID=${gymId} in your environment.`);
  }
  process.exit(0);
});
