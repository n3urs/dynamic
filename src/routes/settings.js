const router = require('express').Router();
const { getDb } = require('../main/database/db');

router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.json(settings);
  } catch (e) { next(e); }
});

router.get('/:key', (req, res, next) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(req.params.key);
    res.json({ value: row ? row.value : null });
  } catch (e) { next(e); }
});

router.put('/:key', (req, res, next) => {
  try {
    const db = getDb();
    db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))").run(req.params.key, req.body.value);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// Batch update: PUT /api/settings with body { key: value, ... }
router.put('/', (req, res, next) => {
  try {
    const db = getDb();
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))");
    const updateMany = db.transaction((pairs) => { for (const [k, v] of pairs) stmt.run(k, String(v)); });
    updateMany(Object.entries(req.body));
    res.json({ success: true });
  } catch (e) { next(e); }
});

module.exports = router;
