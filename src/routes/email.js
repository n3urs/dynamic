/**
 * Email API routes
 */

const router = require('express').Router();
const Member = require('../main/models/member');
const { getDb } = require('../main/database/db');
const emailService = require('../main/services/email');

// Send QR code email to member
router.post('/send-qr', async (req, res, next) => {
  try {
    const { member_id } = req.body;
    const member = Member.getById(member_id);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (!member.email) return res.status(400).json({ error: 'Member has no email address' });
    if (!member.qr_code) return res.status(400).json({ error: 'Member has no QR code' });

    const QRCode = require('qrcode');
    const qrBuffer = await QRCode.toBuffer(member.qr_code, {
      width: 400, margin: 2,
      color: { dark: '#1E3A5F', light: '#FFFFFF' }
    });

    await emailService.sendQrEmail(member, qrBuffer);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Send receipt email to member
router.post('/send-receipt', async (req, res, next) => {
  try {
    const { member_id, transaction_id } = req.body;
    const member = Member.getById(member_id);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (!member.email) return res.status(400).json({ error: 'Member has no email address' });

    const db = getDb();
    const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transaction_id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    const items = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(transaction_id);

    await emailService.sendReceiptEmail(member, transaction, items);

    // Mark receipt as sent
    db.prepare('UPDATE transactions SET receipt_sent = 1 WHERE id = ?').run(transaction_id);

    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Send waiver confirmation email
router.post('/send-waiver-confirm', async (req, res, next) => {
  try {
    const { member_id } = req.body;
    const member = Member.getById(member_id);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (!member.email) return res.status(400).json({ error: 'Member has no email address' });

    await emailService.sendWaiverConfirmEmail(member);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Send welcome email
router.post('/send-welcome', async (req, res, next) => {
  try {
    const { member_id } = req.body;
    const member = Member.getById(member_id);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (!member.email) return res.status(400).json({ error: 'Member has no email address' });

    await emailService.sendWelcomeEmail(member);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
