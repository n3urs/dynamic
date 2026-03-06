const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../main/database/db');
const Member = require('../main/models/member');

router.post('/process', (req, res, next) => {
  try {
    const { memberId, method } = req.body;
    const db = getDb();

    const member = Member.getWithPassStatus(memberId);
    if (!member) return res.json({ success: false, error: 'Member not found' });

    if (!member.waiver_valid) {
      return res.json({ success: false, error: 'No valid waiver on file', member, needsWaiver: true });
    }

    if (!member.has_valid_pass) {
      return res.json({ success: false, error: 'No valid pass', member, needsPass: true });
    }

    if (member.checked_in_today) {
      return res.json({
        success: true,
        alreadyCheckedIn: true,
        member,
        message: 'Already checked in today',
        registrationWarning: !member.registration_fee_paid
      });
    }

    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const isWeekday = day >= 1 && day <= 5;
    const isPeak = !isWeekday || hour < 10 || hour >= 16;

    if (member.active_pass.visits_remaining !== null) {
      db.prepare("UPDATE member_passes SET visits_remaining = visits_remaining - 1, updated_at = datetime('now') WHERE id = ?")
        .run(member.active_pass.id);
    }

    const checkInId = uuidv4();
    db.prepare(`
      INSERT INTO check_ins (id, member_id, member_pass_id, checked_in_by, method, is_peak)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(checkInId, memberId, member.active_pass.id, 'staff', method || 'desk', isPeak ? 1 : 0);

    const updatedMember = Member.getWithPassStatus(memberId);

    res.json({
      success: true,
      member: updatedMember,
      checkInId,
      message: `Welcome, ${member.first_name}!`,
      registrationWarning: !updatedMember.registration_fee_paid
    });
  } catch (e) { next(e); }
});

// QR code scan check-in — look up by qr_code, validate, and auto check-in
router.get('/qr/:code', (req, res, next) => {
  try {
    const db = getDb();
    const qrCode = req.params.code;

    // Look up member by qr_code
    const rawMember = Member.getByQrCode(qrCode);
    if (!rawMember) {
      return res.json({ success: false, error: 'Unknown QR code', message: 'QR code not recognised' });
    }

    const member = Member.getWithPassStatus(rawMember.id);

    if (!member.waiver_valid) {
      return res.json({ success: false, error: 'No valid waiver on file', member, message: 'Waiver required' });
    }

    if (!member.has_valid_pass) {
      return res.json({ success: false, error: 'No valid pass', member, message: 'No active pass' });
    }

    if (member.checked_in_today) {
      return res.json({
        success: true,
        alreadyCheckedIn: true,
        member,
        pass: member.active_pass,
        message: `Already checked in today`,
        registrationWarning: !member.registration_fee_paid
      });
    }

    // Perform check-in
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const isWeekday = day >= 1 && day <= 5;
    const isPeak = !isWeekday || hour < 10 || hour >= 16;

    if (member.active_pass.visits_remaining !== null) {
      db.prepare("UPDATE member_passes SET visits_remaining = visits_remaining - 1, updated_at = datetime('now') WHERE id = ?")
        .run(member.active_pass.id);
    }

    const checkInId = uuidv4();
    db.prepare(`
      INSERT INTO check_ins (id, member_id, member_pass_id, checked_in_by, method, is_peak)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(checkInId, rawMember.id, member.active_pass.id, 'staff', 'qr_scan', isPeak ? 1 : 0);

    const updatedMember = Member.getWithPassStatus(rawMember.id);

    res.json({
      success: true,
      member: updatedMember,
      pass: updatedMember.active_pass,
      checkInId,
      message: `Welcome back, ${member.first_name}!`,
      registrationWarning: !updatedMember.registration_fee_paid
    });
  } catch (e) { next(e); }
});

// Active visitors (checked in today)
router.get('/active', (req, res, next) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage) || 20;
    const offset = (page - 1) * perPage;

    const visitors = db.prepare(`
      SELECT m.*, ci.checked_in_at, ci.method,
        MAX(ci.checked_in_at) as latest_checkin
      FROM check_ins ci
      JOIN members m ON ci.member_id = m.id
      WHERE date(ci.checked_in_at) = date('now')
      GROUP BY m.id
      ORDER BY latest_checkin DESC
      LIMIT ? OFFSET ?
    `).all(perPage, offset);

    const total = db.prepare(`
      SELECT count(DISTINCT member_id) as c FROM check_ins
      WHERE date(checked_in_at) = date('now')
    `).get().c;

    res.json({ visitors, total, page, perPage, totalPages: Math.ceil(total / perPage) });
  } catch (e) { next(e); }
});

module.exports = router;
