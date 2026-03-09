/**
 * Database initialisation script
 * Creates the SQLite database and runs the schema
 * Can be run standalone: node src/main/database/init.js
 */

const path = require('path');
const fs = require('fs');

// In Electron, we'd use app.getPath('userData')
// For standalone init, use a local data directory
const DATA_DIR = process.env.CRUX_DATA_DIR || process.env.BOULDERRYN_DATA_DIR || path.join(__dirname, '..', '..', '..', 'data');
const LEGACY_DB_PATH = path.join(DATA_DIR, 'legacy.db');
const DB_PATH = path.join(DATA_DIR, 'gym.db');
// Auto-migrate legacy DB filename on first run
if (!fs.existsSync(DB_PATH) && fs.existsSync(LEGACY_DB_PATH)) {
  fs.renameSync(LEGACY_DB_PATH, DB_PATH);
  console.log('Migrated legacy database to gym.db');
}
const SCHEMA_PATH = path.join(__dirname, '..', '..', 'shared', 'schema.sql');

function initDatabase() {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`Created data directory: ${DATA_DIR}`);
  }

  // Load better-sqlite3
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (err) {
    console.error('better-sqlite3 not installed. Run: npm install better-sqlite3');
    console.error('Note: better-sqlite3 requires native compilation. On Windows, you may need windows-build-tools.');
    process.exit(1);
  }

  // Open/create database
  const db = new Database(DB_PATH);
  console.log(`Database opened: ${DB_PATH}`);

  // Read and execute schema
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
  console.log('Schema applied successfully.');

  // Verify tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log(`\nTables created (${tables.length}):`);
  tables.forEach(t => console.log(`  - ${t.name}`));

  // Verify default data
  const walls = db.prepare('SELECT name FROM walls ORDER BY sort_order').all();
  console.log(`\nDefault walls:`);
  walls.forEach(w => console.log(`  - ${w.name}`));

  const settings = db.prepare('SELECT key, value FROM settings').all();
  console.log(`\nSettings (${settings.length}):`);
  settings.forEach(s => console.log(`  - ${s.key}: ${s.value || '(empty)'}`));

  db.close();
  console.log('\nDatabase initialised successfully.');
  return DB_PATH;
}

// Run if called directly
if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase, DB_PATH, DATA_DIR };
