const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const Member = require('../main/models/member');
const { getDb } = require('../main/database/db');

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
    const opts = {
      page: parseInt(req.query.page) || 1,
      perPage: parseInt(req.query.perPage) || 50,
      orderBy: req.query.orderBy || 'last_name',
      order: req.query.order || 'ASC',
    };
    res.json(Member.list(opts));
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
  try { res.json(Member.getWithPassStatus(req.params.id) || null); } catch (e) { next(e); }
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
    const transactions = db.prepare(`
      SELECT t.*, 
        (SELECT GROUP_CONCAT(ti.description, ', ') FROM transaction_items ti WHERE ti.transaction_id = t.id) as items_summary
      FROM transactions t
      WHERE t.member_id = ?
      ORDER BY t.created_at DESC
      LIMIT 100
    `).all(req.params.id);
    res.json(transactions);
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

router.post('/:id/family-link', (req, res, next) => {
  try {
    const { childId, relationship } = req.body;
    res.json({ id: Member.addFamilyLink(req.params.id, childId, relationship || 'parent') });
  } catch (e) { next(e); }
});

router.get('/:id/family', (req, res, next) => {
  try { res.json(Member.getFamily(req.params.id)); } catch (e) { next(e); }
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

module.exports = router;
