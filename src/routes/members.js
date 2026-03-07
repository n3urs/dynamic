const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const Member = require('../main/models/member');
const { getDb } = require('../main/database/db');
const multer = require('multer');

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../data/photos')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${req.params.id}${ext}`);
  }
});
const upload = multer({ storage: photoStorage, limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')) });

router.post('/', (req, res, next) => {
  try { res.json(Member.create(req.body)); } catch (e) { next(e); }
});

router.get('/search', (req, res, next) => {
  try { res.json(Member.search(req.query.q || '', parseInt(req.query.limit) || 20)); } catch (e) { next(e); }
});

router.get('/count', (req, res, next) => {
  try { res.json({ count: Member.count() }); } catch (e) { next(e); }
});

router.get('/list', (req, res, next) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage) || 50;
    const filter = req.query.filter;
    const offset = (page - 1) * perPage;

    let where = '';
    switch (filter) {
      case 'reg_due':
        where = 'WHERE m.registration_fee_paid = 0 OR m.registration_fee_paid IS NULL'; break;
      case 'no_waiver':
        where = `WHERE NOT EXISTS (SELECT 1 FROM signed_waivers sw WHERE sw.member_id = m.id AND (sw.expires_at IS NULL OR sw.expires_at > datetime('now')))`; break;
      case 'no_pass':
        where = `WHERE NOT EXISTS (SELECT 1 FROM member_passes mp WHERE mp.member_id = m.id AND mp.status = 'active' AND (mp.expires_at IS NULL OR mp.expires_at > datetime('now')) AND (mp.visits_remaining IS NULL OR mp.visits_remaining > 0))`; break;
      case 'active_pass':
        where = `WHERE EXISTS (SELECT 1 FROM member_passes mp WHERE mp.member_id = m.id AND mp.status = 'active' AND (mp.expires_at IS NULL OR mp.expires_at > datetime('now')) AND (mp.visits_remaining IS NULL OR mp.visits_remaining > 0))`; break;
      case 'under_18':
        where = `WHERE m.date_of_birth IS NOT NULL AND date(m.date_of_birth, '+18 years') > date('now')`; break;
    }

    if (!filter || filter === 'all') {
      const opts = { page, perPage, orderBy: req.query.orderBy || 'last_name', order: req.query.order || 'ASC' };
      return res.json(Member.list(opts));
    }

    const total = db.prepare(`SELECT COUNT(*) as c FROM members m ${where}`).get().c;
    const members = db.prepare(`
      SELECT m.*, 
        (SELECT COUNT(*) FROM check_ins ci WHERE ci.member_id = m.id) as total_visits,
        (SELECT MAX(ci.checked_in_at) FROM check_ins ci WHERE ci.member_id = m.id) as last_visit,
        (SELECT 1 FROM member_passes mp WHERE mp.member_id = m.id AND mp.status = 'active' AND (mp.expires_at IS NULL OR mp.expires_at > datetime('now')) AND (mp.visits_remaining IS NULL OR mp.visits_remaining > 0) LIMIT 1) as has_valid_pass,
        (SELECT 1 FROM signed_waivers sw WHERE sw.member_id = m.id AND (sw.expires_at IS NULL OR sw.expires_at > datetime('now')) LIMIT 1) as waiver_valid
      FROM members m ${where}
      ORDER BY m.last_name ASC, m.first_name ASC
      LIMIT ? OFFSET ?
    `).all(perPage, offset);

    res.json({ members, total, page, perPage });
  } catch (e) { next(e); }
});

router.get('/by-qr/:qrCode', (req, res, next) => {
  try { res.json(Member.getByQrCode(req.params.qrCode) || null); } catch (e) { next(e); }
});

router.get('/by-email/:email', (req, res, next) => {
  try { res.json(Member.getByEmail(req.params.email) || null); } catch (e) { next(e); }
});

router.get('/:id', (req, res, next) => {
  try { res.json(Member.getById(req.params.id) || null); } catch (e) { next(e); }
});

router.get('/:id/with-pass-status', (req, res, next) => {
  try {
    const member = Member.getWithPassStatus(req.params.id);
    if (!member) return res.json(null);
    const db = getDb();
    // "Has App" = has ever successfully logged into the climber portal
    const hasApp = db.prepare(`SELECT 1 FROM auth_codes WHERE member_id = ? AND used = 1 LIMIT 1`).get(req.params.id);
    res.json({ ...member, has_app: !!hasApp });
  } catch (e) { next(e); }
});

// Staff comments
router.get('/:id/comments', (req, res, next) => {
  try {
    const db = getDb();
    const comments = db.prepare(`
      SELECT * FROM staff_comments WHERE member_id = ? ORDER BY created_at DESC
    `).all(req.params.id);
    res.json(comments);
  } catch (e) { next(e); }
});

router.post('/:id/comments', (req, res, next) => {
  try {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO staff_comments (id, member_id, staff_name, comment) VALUES (?, ?, ?, ?)
    `).run(id, req.params.id, req.body.staff_name, req.body.comment);
    const comment = db.prepare('SELECT * FROM staff_comments WHERE id = ?').get(id);
    res.json(comment);
  } catch (e) { next(e); }
});

// Validate registration fee
router.post('/:id/validate-registration', (req, res, next) => {
  try {
    const db = getDb();
    db.prepare("UPDATE members SET registration_fee_paid = 1, updated_at = datetime('now') WHERE id = ?")
      .run(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// Visit history
router.get('/:id/visits', (req, res, next) => {
  try {
    const db = getDb();
    const visits = db.prepare(`
      SELECT ci.*, mp.id as pass_id, pt.name as pass_name
      FROM check_ins ci
      LEFT JOIN member_passes mp ON ci.member_pass_id = mp.id
      LEFT JOIN pass_types pt ON mp.pass_type_id = pt.id
      WHERE ci.member_id = ?
      ORDER BY ci.checked_in_at DESC
      LIMIT 100
    `).all(req.params.id);
    res.json(visits);
  } catch (e) { next(e); }
});

// Transaction history
router.get('/:id/transactions', (req, res, next) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage) || 20;
    const offset = (page - 1) * perPage;

    const total = db.prepare(`SELECT COUNT(*) as c FROM transactions WHERE member_id = ?`).get(req.params.id).c;

    const transactions = db.prepare(`
      SELECT t.*,
        (SELECT GROUP_CONCAT(ti.description || ' x' || ti.quantity, ' · ') FROM transaction_items ti WHERE ti.transaction_id = t.id) as items_summary,
        s.first_name || ' ' || s.last_name as staff_name
      FROM transactions t
      LEFT JOIN staff s ON t.staff_id = s.id
      WHERE t.member_id = ?
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.params.id, perPage, offset);

    // Attach full item list to each transaction
    const getItems = db.prepare(`SELECT * FROM transaction_items WHERE transaction_id = ? ORDER BY id`);
    const result = transactions.map(tx => ({ ...tx, items: getItems.all(tx.id) }));

    res.json({ transactions: result, total, page, perPage, totalPages: Math.ceil(total / perPage) });
  } catch (e) { next(e); }
});

// Member vouchers / gift cards
router.get('/:id/vouchers', (req, res, next) => {
  try {
    const db = getDb();
    const vouchers = db.prepare(`
      SELECT gc.*, t.created_at as purchased_at
      FROM gift_cards gc
      LEFT JOIN transactions t ON gc.purchased_transaction_id = t.id
      WHERE gc.purchased_by_member_id = ?
      ORDER BY gc.created_at DESC
    `).all(req.params.id);
    res.json(vouchers);
  } catch (e) { next(e); }
});

// Tags — add/remove
router.get('/tags/types', (req, res, next) => {
  try {
    const db = getDb();
    res.json(db.prepare('SELECT * FROM tags ORDER BY tag_type').all());
  } catch (e) { next(e); }
});

router.post('/:id/tags', (req, res, next) => {
  try {
    const db = getDb();
    const { tag_id, note, expires_at, applied_by } = req.body;
    if (!tag_id) return res.status(400).json({ error: 'tag_id required' });
    db.prepare(`INSERT INTO member_tags (member_id, tag_id, note, expires_at, applied_at, applied_by)
      VALUES (?, ?, ?, ?, datetime('now'), ?)
      ON CONFLICT(member_id, tag_id) DO UPDATE SET note=excluded.note, expires_at=excluded.expires_at, applied_at=excluded.applied_at, applied_by=excluded.applied_by`)
      .run(req.params.id, tag_id, note || null, expires_at || null, applied_by || null);
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.delete('/:id/tags/:tagId', (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM member_tags WHERE member_id = ? AND tag_id = ?').run(req.params.id, req.params.tagId);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// Event history
router.get('/:id/events', (req, res, next) => {
  try {
    const db = getDb();
    const events = db.prepare(`
      SELECT ee.*, e.name as event_name, e.starts_at, e.ends_at, e.status as event_status
      FROM event_enrolments ee
      JOIN events e ON ee.event_id = e.id
      WHERE ee.member_id = ?
      ORDER BY e.starts_at DESC
      LIMIT 100
    `).all(req.params.id);
    res.json(events);
  } catch (e) { next(e); }
});

router.put('/:id', (req, res, next) => {
  try { res.json(Member.update(req.params.id, req.body)); } catch (e) { next(e); }
});

router.delete('/:id', (req, res, next) => {
  try { res.json(Member.delete(req.params.id)); } catch (e) { next(e); }
});

// Merge profiles — transfers all data from :id to target_id, then deletes :id
router.post('/:id/merge', (req, res, next) => {
  try {
    const db = getDb();
    const { target_id } = req.body;
    const source = req.params.id;
    if (!target_id) return res.status(400).json({ error: 'target_id required' });
    if (source === target_id) return res.status(400).json({ error: 'Cannot merge a profile with itself' });

    const merge = db.transaction(() => {
      const tables = [
        ['member_passes', 'member_id'],
        ['check_ins', 'member_id'],
        ['transactions', 'member_id'],
        ['event_enrolments', 'member_id'],
        ['member_tags', 'member_id'],
        ['staff_comments', 'member_id'],
        ['auth_codes', 'member_id'],
        ['climb_sends', 'member_id'],
        ['gift_cards', 'purchased_by_member_id'],
        ['signed_waivers', 'member_id'],
      ];
      for (const [table, col] of tables) {
        try {
          db.prepare(`UPDATE OR IGNORE ${table} SET ${col} = ? WHERE ${col} = ?`).run(target_id, source);
          // Clean up any dupes that couldn't update (ON CONFLICT)
          db.prepare(`DELETE FROM ${table} WHERE ${col} = ?`).run(source);
        } catch (e) { /* skip tables that don't exist */ }
      }
      // Also handle family_links
      try {
        db.prepare(`UPDATE OR IGNORE family_links SET parent_member_id = ? WHERE parent_member_id = ?`).run(target_id, source);
        db.prepare(`DELETE FROM family_links WHERE parent_member_id = ?`).run(source);
        db.prepare(`UPDATE OR IGNORE family_links SET child_member_id = ? WHERE child_member_id = ?`).run(target_id, source);
        db.prepare(`DELETE FROM family_links WHERE child_member_id = ?`).run(source);
      } catch(e) {}
      db.prepare(`DELETE FROM members WHERE id = ?`).run(source);
    });
    merge();
    res.json({ success: true });
  } catch (e) { next(e); }
});

// Family links
router.post('/:id/family-link', (req, res, next) => {
  try {
    const { childId, relationship } = req.body;
    res.json({ id: Member.addFamilyLink(req.params.id, childId, relationship || 'parent') });
  } catch (e) { next(e); }
});

router.post('/:id/family', (req, res, next) => {
  try {
    const db = getDb();
    const { child_id, relationship } = req.body;
    if (!child_id) return res.status(400).json({ error: 'child_id required' });
    const { v4: uuidv4 } = require('uuid');
    db.prepare(`INSERT OR IGNORE INTO family_links (id, parent_member_id, child_member_id, relationship) VALUES (?, ?, ?, ?)`)
      .run(uuidv4(), req.params.id, child_id, relationship || 'parent/child');
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.delete('/:id/family/:linkedId', (req, res, next) => {
  try {
    const db = getDb();
    db.prepare(`DELETE FROM family_links WHERE (parent_member_id = ? AND child_member_id = ?) OR (parent_member_id = ? AND child_member_id = ?)`)
      .run(req.params.id, req.params.linkedId, req.params.linkedId, req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.get('/:id/family', (req, res, next) => {
  try {
    const db = getDb();
    const id = req.params.id;
    const parents = db.prepare(`
      SELECT m.*, fl.relationship FROM family_links fl
      JOIN members m ON m.id = fl.parent_member_id
      WHERE fl.child_member_id = ?`).all(id);
    const children = db.prepare(`
      SELECT m.*, fl.relationship FROM family_links fl
      JOIN members m ON m.id = fl.child_member_id
      WHERE fl.parent_member_id = ?`).all(id);
    res.json({ parents, children });
  } catch (e) { next(e); }
});

// Generate QR code as PNG image
router.get('/:id/qr-code', async (req, res, next) => {
  try {
    const QRCode = require('qrcode');
    const member = Member.getById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (!member.qr_code) return res.status(400).json({ error: 'No QR code assigned' });

    const qrBuffer = await QRCode.toBuffer(member.qr_code, {
      width: parseInt(req.query.size) || 400,
      margin: 2,
      color: { dark: '#1E3A5F', light: '#FFFFFF' }
    });

    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="boulderryn-qr-${member.first_name}-${member.last_name}.png"`);
    res.send(qrBuffer);
  } catch (e) { next(e); }
});

router.post('/:id/send-qr-email', async (req, res, next) => {
  try {
    await Member.sendQrEmail(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Photo upload
router.post('/:id/photo', upload.single('photo'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const photoUrl = `/api/members/${req.params.id}/photo`;
    getDb().prepare('UPDATE members SET photo_url = ?, updated_at = datetime("now") WHERE id = ?').run(photoUrl, req.params.id);
    res.json({ success: true, photo_url: photoUrl });
  } catch (e) { next(e); }
});

// Serve photo
router.get('/:id/photo', (req, res, next) => {
  try {
    const dir = path.join(__dirname, '../../data/photos');
    const files = fs.readdirSync(dir).filter(f => f.startsWith(req.params.id));
    if (!files.length) return res.status(404).json({ error: 'No photo' });
    res.sendFile(path.join(dir, files[0]));
  } catch (e) { next(e); }
});

// Warning flag
router.post('/:id/warning', (req, res, next) => {
  try {
    const { has_warning, warning_note } = req.body;
    getDb().prepare("UPDATE members SET has_warning = ?, warning_note = ?, updated_at = datetime('now') WHERE id = ?")
      .run(has_warning ? 1 : 0, warning_note || null, req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

module.exports = router;
