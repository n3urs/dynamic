/**
 * Member Portal routes — /me
 *
 * Public:  POST /me/auth/request  — send OTP to member email
 *          POST /me/auth/verify   — verify OTP, return JWT
 * Auth'd:  GET  /me/profile       — member profile + active passes + QR data
 *          GET  /me/map           — walls + active climbs
 *          POST /me/climbs/:id/send    — mark climb as sent
 *          DELETE /me/climbs/:id/send — unmark climb as sent
 *          GET  /me/logbook       — member's sends history
 *          GET  /me/noticeboard   — gym noticeboard posts
 *
 * Staff:   POST   /me/noticeboard      — create post (requires staff JWT)
 *          DELETE /me/noticeboard/:id  — delete post (requires staff JWT)
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { getDb } = require('../main/database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'crux-member-secret-CHANGE-ME';
const SMTP_USER = process.env.SMTP_USER || 'cruxgymhq@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || 'tzrhwxyfpjgnfraz';
const SMTP_FROM = process.env.SMTP_FROM || 'Crux <hello@cruxgym.co.uk>';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

// ── Auth middleware ────────────────────────────────────────────────────────

function requireMemberAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  try {
    req.member = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

// ── POST /me/auth/request ─────────────────────────────────────────────────

router.post('/auth/request', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const db = getDb();
  const member = db.prepare('SELECT id, first_name, last_name, email FROM members WHERE LOWER(email) = LOWER(?)').get(email.trim());

  if (!member) return res.status(404).json({ error: 'No account found with that email. Contact the gym to get set up.' });

  // Generate 6-digit OTP
  const token = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins
  const id = uuidv4();

  // Invalidate previous tokens for this member
  db.prepare("UPDATE member_otp_tokens SET used = 1 WHERE member_id = ? AND used = 0").run(member.id);
  db.prepare("INSERT INTO member_otp_tokens (id, member_id, token, expires_at) VALUES (?, ?, ?, ?)").run(id, member.id, token, expiresAt);

  // Send email (best-effort)
  const gymSettings = db.prepare("SELECT value FROM settings WHERE key = 'gym_name'").get();
  const gymName = gymSettings?.value || 'Crux';

  transporter.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: `Your ${gymName} login code`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff">
        <h2 style="color:#1E3A5F;margin:0 0 8px">Your login code</h2>
        <p style="color:#6B7280;margin:0 0 24px">Use this code to log in to your ${gymName} member account. It expires in 10 minutes.</p>
        <div style="background:#F3F4F6;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px">
          <span style="font-size:40px;font-weight:700;letter-spacing:8px;color:#111827">${token}</span>
        </div>
        <p style="color:#9CA3AF;font-size:13px;margin:0">If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  }).catch(err => console.warn('[me/auth] email failed:', err.message));

  res.json({ ok: true });
});

// ── POST /me/auth/verify ──────────────────────────────────────────────────

router.post('/auth/verify', (req, res) => {
  const { email, token } = req.body;
  if (!email || !token) return res.status(400).json({ error: 'Email and code required' });

  const db = getDb();
  const member = db.prepare('SELECT id, first_name, last_name, email FROM members WHERE LOWER(email) = LOWER(?)').get(email.trim());
  if (!member) return res.status(401).json({ error: 'Invalid code' });

  const otp = db.prepare(`
    SELECT * FROM member_otp_tokens
    WHERE member_id = ? AND token = ? AND used = 0 AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).get(member.id, token.trim());

  if (!otp) return res.status(401).json({ error: 'Invalid or expired code' });

  // Mark used
  db.prepare("UPDATE member_otp_tokens SET used = 1 WHERE id = ?").run(otp.id);

  // Issue JWT
  const sessionToken = jwt.sign(
    { memberId: member.id, email: member.email, firstName: member.first_name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({ ok: true, token: sessionToken, member: { id: member.id, firstName: member.first_name, lastName: member.last_name, email: member.email } });
});

// ── GET /me/profile ───────────────────────────────────────────────────────

router.get('/profile', requireMemberAuth, (req, res) => {
  const db = getDb();
  const member = db.prepare(`
    SELECT m.id, m.first_name, m.last_name, m.email, m.phone, m.qr_code,
           m.climbing_experience, m.member_since, m.photo_url
    FROM members m WHERE m.id = ?
  `).get(req.member.memberId);

  if (!member) return res.status(404).json({ error: 'Member not found' });

  const passes = db.prepare(`
    SELECT mp.*, pt.name as pass_name, pt.category
    FROM member_passes mp
    JOIN pass_types pt ON mp.pass_type_id = pt.id
    WHERE mp.member_id = ? AND mp.status = 'active'
      AND (mp.expires_at IS NULL OR mp.expires_at > datetime('now'))
      AND (mp.visits_remaining IS NULL OR mp.visits_remaining > 0)
    ORDER BY mp.created_at DESC
  `).all(member.id);

  const gymSettings = db.prepare("SELECT key, value FROM settings WHERE key IN ('gym_name','gym_logo')").all();
  const settings = Object.fromEntries(gymSettings.map(r => [r.key, r.value]));

  res.json({ member, passes, gym: settings });
});

// ── GET /me/map ───────────────────────────────────────────────────────────

router.get('/map', requireMemberAuth, (req, res) => {
  const db = getDb();
  const walls = db.prepare("SELECT * FROM walls ORDER BY name").all().map(w => ({
    ...w,
    path_json: w.path_json ? JSON.parse(w.path_json) : [],
  }));

  const climbs = db.prepare(`
    SELECT c.id, c.grade, c.colour, c.style_tags, c.setter, c.date_set,
           c.map_x, c.map_y, c.wall_id, w.name as wall_name,
           CASE WHEN ms.id IS NOT NULL THEN 1 ELSE 0 END as sent_by_me
    FROM climbs c
    LEFT JOIN walls w ON c.wall_id = w.id
    LEFT JOIN member_sends ms ON ms.climb_id = c.id AND ms.member_id = ?
    WHERE c.status = 'active' AND c.map_x IS NOT NULL AND c.map_y IS NOT NULL
    ORDER BY c.date_set DESC
  `).all(req.member.memberId);

  res.json({ walls, climbs });
});

// ── POST /me/climbs/:id/send ──────────────────────────────────────────────

router.post('/climbs/:id/send', requireMemberAuth, (req, res) => {
  const db = getDb();
  const climb = db.prepare("SELECT id FROM climbs WHERE id = ? AND status = 'active'").get(req.params.id);
  if (!climb) return res.status(404).json({ error: 'Climb not found' });

  try {
    db.prepare("INSERT OR IGNORE INTO member_sends (id, member_id, climb_id) VALUES (?, ?, ?)").run(uuidv4(), req.member.memberId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /me/climbs/:id/send ────────────────────────────────────────────

router.delete('/climbs/:id/send', requireMemberAuth, (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM member_sends WHERE member_id = ? AND climb_id = ?").run(req.member.memberId, req.params.id);
  res.json({ ok: true });
});

// ── GET /me/logbook ───────────────────────────────────────────────────────

router.get('/logbook', requireMemberAuth, (req, res) => {
  const db = getDb();
  const sends = db.prepare(`
    SELECT ms.sent_at, c.id, c.grade, c.colour, c.style_tags, c.setter, c.date_set,
           w.name as wall_name
    FROM member_sends ms
    JOIN climbs c ON ms.climb_id = c.id
    LEFT JOIN walls w ON c.wall_id = w.id
    WHERE ms.member_id = ?
    ORDER BY ms.sent_at DESC
  `).all(req.member.memberId);
  res.json(sends);
});

// ── GET /me/noticeboard ───────────────────────────────────────────────────

router.get('/noticeboard', requireMemberAuth, (req, res) => {
  const db = getDb();
  const posts = db.prepare(`
    SELECT n.*, s.first_name || ' ' || s.last_name as posted_by
    FROM noticeboard n
    LEFT JOIN staff s ON n.created_by = s.id
    ORDER BY n.created_at DESC
    LIMIT 50
  `).all();
  res.json(posts);
});

// ── POST /me/noticeboard (staff only) ────────────────────────────────────

router.post('/noticeboard', (req, res) => {
  // Require staff session (PIN auth or JWT from staff app)
  const staffId = req.headers['x-staff-id'];
  if (!staffId) return res.status(401).json({ error: 'Staff authentication required' });

  const { title, body, image_url } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  const db = getDb();
  const id = uuidv4();
  db.prepare("INSERT INTO noticeboard (id, title, body, image_url, created_by) VALUES (?, ?, ?, ?, ?)").run(id, title, body || null, image_url || null, staffId);
  res.json(db.prepare("SELECT * FROM noticeboard WHERE id = ?").get(id));
});

// ── DELETE /me/noticeboard/:id (staff only) ───────────────────────────────

router.delete('/noticeboard/:id', (req, res) => {
  const staffId = req.headers['x-staff-id'];
  if (!staffId) return res.status(401).json({ error: 'Staff authentication required' });

  const db = getDb();
  db.prepare("DELETE FROM noticeboard WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ── POST /me/invite/:memberId (staff sends portal link to member) ──────────

router.post('/invite/:memberId', (req, res) => {
  // Require staff session
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorised' });

  const db = getDb();
  const member = db.prepare('SELECT id, first_name, last_name, email FROM members WHERE id = ?').get(req.params.memberId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (!member.email) return res.status(400).json({ error: 'Member has no email address on file' });

  const gymSettings = db.prepare("SELECT key, value FROM settings WHERE key IN ('gym_name')").all();
  const gymName = gymSettings.find(s => s.key === 'gym_name')?.value || 'the gym';

  // Get the host from request to build the portal URL
  const host = req.get('host') || 'localhost:8080';
  const protocol = req.protocol || 'https';
  const portalUrl = `${protocol}://${host}/me`;

  transporter.sendMail({
    from: SMTP_FROM,
    to: member.email,
    subject: `Your ${gymName} member portal`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff">
        <h2 style="color:#1E3A5F;margin:0 0 8px">Hi ${member.first_name},</h2>
        <p style="color:#6B7280;margin:0 0 24px">You now have access to your personal member portal for ${gymName}. Log in to view your QR check-in code, track your climbs, and read gym updates.</p>
        <a href="${portalUrl}" style="display:inline-block;background:#1E3A5F;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;margin:0 0 24px">Open Member Portal</a>
        <p style="color:#9CA3AF;font-size:13px;margin:0">Or copy this link: ${portalUrl}</p>
        <p style="color:#9CA3AF;font-size:13px;margin:16px 0 0">Use your email address (${member.email}) to log in — we'll send you a code each time.</p>
      </div>
    `,
  }).catch(err => console.warn('[me/invite] email failed:', err.message));

  res.json({ ok: true });
});

// ── GET /me/stats ─────────────────────────────────────────────────────────

router.get('/stats', requireMemberAuth, (req, res) => {
  const db = getDb();

  // Sends by grade
  const sendsByGrade = db.prepare(`
    SELECT c.grade, COUNT(*) as count
    FROM member_sends ms
    JOIN climbs c ON ms.climb_id = c.id
    WHERE ms.member_id = ?
    GROUP BY c.grade
    ORDER BY c.grade
  `).all(req.member.memberId);

  // Total sends
  const totalSends = db.prepare('SELECT COUNT(*) as c FROM member_sends WHERE member_id = ?').get(req.member.memberId);

  // Hardest grade sent (order by grade difficulty)
  const gradeOrder = ['VB','V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12'];
  const sentGrades = sendsByGrade.map(s => s.grade);
  const hardest = sentGrades.reduce((best, g) => {
    return gradeOrder.indexOf(g) > gradeOrder.indexOf(best) ? g : best;
  }, sentGrades[0] || null);

  res.json({ sendsByGrade, totalSends: totalSends.c, hardestGrade: hardest });
});

module.exports = router;
