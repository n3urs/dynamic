/**
 * Climber Portal API routes
 * Customer-facing endpoints for the /app climber experience
 */

const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { getDb } = require('../main/database/db');

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.warn('[SECURITY] JWT_SECRET not set in environment — using insecure fallback. Set JWT_SECRET in /etc/dynamic.env');
  return 'dynamic-climber-secret-CHANGE-ME';
})();
const JWT_EXPIRES = '30d';
const CODE_EXPIRY_MINUTES = 10;

// ── Helpers ──────────────────────────────────────────────────

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Called during server startup (inside gymContext.run) for each gym,
// and lazily on first request if somehow missed.
const ensuredGyms = new Set();

function ensureClimberTables() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_codes (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (member_id) REFERENCES members(id)
    );
    CREATE TABLE IF NOT EXISTS climb_sends (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      climb_id TEXT NOT NULL,
      sent_at TEXT DEFAULT (datetime('now')),
      notes TEXT,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (climb_id) REFERENCES climbs(id),
      UNIQUE(member_id, climb_id)
    );
  `);
}

function ensureClimberTablesOnce(gymId) {
  if (!ensuredGyms.has(gymId)) {
    ensureClimberTables();
    ensuredGyms.add(gymId);
  }
}

function getEmailTransporter() {
  const db = getDb();
  const getSetting = (key) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : '';
  };
  const smtpUser = getSetting('email_smtp_user');
  const smtpPass = getSetting('email_smtp_pass');
  if (!smtpUser || !smtpPass) {
    throw new Error('Email not configured');
  }
  return nodemailer.createTransport({
    host: getSetting('email_smtp_host') || 'smtp.gmail.com',
    port: parseInt(getSetting('email_smtp_port') || '587'),
    secure: false,
    auth: { user: smtpUser, pass: smtpPass }
  });
}

function getFromAddress() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'email_from'").get();
  if (row && row.value) return row.value;
  const userRow = db.prepare("SELECT value FROM settings WHERE key = 'email_smtp_user'").get();
  return userRow ? userRow.value : '';
}

// ── Auth Middleware ───────────────────────────────────────────

function climberAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = getDb();
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(decoded.memberId);
    if (!member) return res.status(401).json({ error: 'Member not found' });
    req.member = member;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── Auth Routes ──────────────────────────────────────────────

// Request a login code
router.post('/auth/request-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    ensureClimberTablesOnce(req.gymId || 'default');
    const db = getDb();
    const member = db.prepare('SELECT * FROM members WHERE LOWER(email) = LOWER(?)').get(email.trim());
    if (!member) {
      return res.status(404).json({ error: 'No account found. Register at the front desk.' });
    }

    const code = generateCode();
    const id = uuidv4();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // Invalidate old codes for this member
    db.prepare('UPDATE auth_codes SET used = 1 WHERE member_id = ? AND used = 0').run(member.id);

    db.prepare('INSERT INTO auth_codes (id, member_id, code_hash, expires_at) VALUES (?, ?, ?, ?)').run(
      id, member.id, hashCode(code), expiresAt
    );

    // Send email (with dev fallback if SMTP fails)
    let emailSent = false;
    try {
      const db = getDb();
      const gymNameRow = db.prepare("SELECT value FROM settings WHERE key = 'gym_name'").get();
      const gymName = (gymNameRow && gymNameRow.value) || 'the gym';
      const transporter = getEmailTransporter();
      await transporter.sendMail({
        from: `"${gymName}" <${getFromAddress()}>`,
        to: member.email,
        subject: `Your ${gymName} Login Code`,
        text: `Hi ${member.first_name},\n\nYour login code is: ${code}\n\nThis code expires in ${CODE_EXPIRY_MINUTES} minutes.\n\n${gymName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; text-align: center;">
            <h2 style="color: #1E3A5F;">${gymName}</h2>
            <p>Hi ${member.first_name},</p>
            <p>Your login code is:</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1E3A5F; margin: 24px 0; padding: 16px; background: #F1F5F9; border-radius: 8px;">${code}</div>
            <p style="color: #666; font-size: 14px;">This code expires in ${CODE_EXPIRY_MINUTES} minutes.</p>
          </div>
        `
      });
      emailSent = true;
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message);
      emailSent = false;
    }

    if (emailSent) {
      res.json({ success: true, message: 'Login code sent to your email' });
    } else {
      // Dev fallback: return code in response so login still works
      res.json({ success: true, message: 'Email unavailable — use this code', devCode: code });
    }
  } catch (err) {
    console.error('Request code error:', err.message);
    res.status(500).json({ error: 'Failed to send login code' });
  }
});

// Verify code
router.post('/auth/verify-code', (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

    const db = getDb();
    const member = db.prepare('SELECT * FROM members WHERE LOWER(email) = LOWER(?)').get(email.trim());
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const authCode = db.prepare(
      'SELECT * FROM auth_codes WHERE member_id = ? AND used = 0 AND expires_at > datetime(\'now\') ORDER BY created_at DESC LIMIT 1'
    ).get(member.id);

    if (!authCode || authCode.code_hash !== hashCode(code)) {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    // Mark as used
    db.prepare('UPDATE auth_codes SET used = 1 WHERE id = ?').run(authCode.id);

    // Generate JWT
    const token = jwt.sign({ memberId: member.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.json({
      success: true,
      token,
      member: {
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email,
        created_at: member.created_at
      }
    });
  } catch (err) {
    console.error('Verify code error:', err.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ── Profile ──────────────────────────────────────────────────

router.get('/me', climberAuth, (req, res) => {
  const m = req.member;
  res.json({
    id: m.id,
    first_name: m.first_name,
    last_name: m.last_name,
    email: m.email,
    phone: m.phone,
    qr_code: m.qr_code,
    created_at: m.created_at
  });
});

// ── Routes (climbs) ──────────────────────────────────────────

router.get('/routes', climberAuth, (req, res) => {
  try {
    const db = getDb();
    const climbs = db.prepare(`
      SELECT c.id, c.grade, c.colour, c.setter, c.date_set, c.style_tags,
             w.id as wall_id, w.name as wall_name
      FROM climbs c
      JOIN walls w ON c.wall_id = w.id
      WHERE c.status = 'active'
      ORDER BY w.sort_order, c.grade, c.colour
    `).all();

    // Get sends for this member
    const sends = db.prepare('SELECT climb_id, sent_at FROM climb_sends WHERE member_id = ?').all(req.member.id);
    const sendMap = {};
    sends.forEach(s => { sendMap[s.climb_id] = s.sent_at; });

    const result = climbs.map(c => ({
      ...c,
      sent: !!sendMap[c.id],
      sent_at: sendMap[c.id] || null
    }));

    res.json(result);
  } catch (err) {
    console.error('Routes error:', err.message);
    res.status(500).json({ error: 'Failed to load routes' });
  }
});

// Log a send
router.post('/routes/:climbId/send', climberAuth, (req, res) => {
  try {
    const db = getDb();
    const climb = db.prepare("SELECT id FROM climbs WHERE id = ? AND status = 'active'").get(req.params.climbId);
    if (!climb) return res.status(404).json({ error: 'Climb not found' });

    const existing = db.prepare('SELECT id FROM climb_sends WHERE member_id = ? AND climb_id = ?').get(req.member.id, req.params.climbId);
    if (existing) return res.status(409).json({ error: 'Already logged this send' });

    const id = uuidv4();
    db.prepare('INSERT INTO climb_sends (id, member_id, climb_id, notes) VALUES (?, ?, ?, ?)').run(
      id, req.member.id, req.params.climbId, req.body.notes || null
    );
    res.json({ success: true, id });
  } catch (err) {
    console.error('Send error:', err.message);
    res.status(500).json({ error: 'Failed to log send' });
  }
});

// Remove a send
router.delete('/routes/:climbId/send', climberAuth, (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM climb_sends WHERE member_id = ? AND climb_id = ?').run(req.member.id, req.params.climbId);
    res.json({ success: true, deleted: result.changes > 0 });
  } catch (err) {
    console.error('Delete send error:', err.message);
    res.status(500).json({ error: 'Failed to remove send' });
  }
});

// ── Logbook ──────────────────────────────────────────────────

router.get('/logbook', climberAuth, (req, res) => {
  try {
    const db = getDb();
    const sends = db.prepare(`
      SELECT cs.sent_at, c.grade, c.colour, c.setter, w.name as wall_name
      FROM climb_sends cs
      JOIN climbs c ON cs.climb_id = c.id
      JOIN walls w ON c.wall_id = w.id
      WHERE cs.member_id = ?
      ORDER BY cs.sent_at DESC
    `).all(req.member.id);
    res.json(sends);
  } catch (err) {
    console.error('Logbook error:', err.message);
    res.status(500).json({ error: 'Failed to load logbook' });
  }
});

// ── Stats ────────────────────────────────────────────────────

router.get('/stats', climberAuth, (req, res) => {
  try {
    const db = getDb();
    const memberId = req.member.id;

    const totalSends = db.prepare('SELECT count(*) as c FROM climb_sends WHERE member_id = ?').get(memberId).c;
    const totalVisits = db.prepare('SELECT count(*) as c FROM check_ins WHERE member_id = ?').get(memberId).c;

    const highestGrade = db.prepare(`
      SELECT c.grade FROM climb_sends cs JOIN climbs c ON cs.climb_id = c.id
      WHERE cs.member_id = ? ORDER BY c.grade DESC LIMIT 1
    `).get(memberId);

    const favouriteGrade = db.prepare(`
      SELECT c.grade, count(*) as cnt FROM climb_sends cs JOIN climbs c ON cs.climb_id = c.id
      WHERE cs.member_id = ? GROUP BY c.grade ORDER BY cnt DESC LIMIT 1
    `).get(memberId);

    const sendsThisMonth = db.prepare(`
      SELECT count(*) as c FROM climb_sends
      WHERE member_id = ? AND sent_at >= date('now', 'start of month')
    `).get(memberId).c;

    // Monthly progression (highest grade per month, last 6 months)
    const progression = db.prepare(`
      SELECT strftime('%Y-%m', cs.sent_at) as month, MAX(c.grade) as highest_grade
      FROM climb_sends cs JOIN climbs c ON cs.climb_id = c.id
      WHERE cs.member_id = ? AND cs.sent_at >= date('now', '-6 months')
      GROUP BY month ORDER BY month
    `).all(memberId);

    res.json({
      total_sends: totalSends,
      total_visits: totalVisits,
      highest_grade: highestGrade ? highestGrade.grade : null,
      favourite_grade: favouriteGrade ? favouriteGrade.grade : null,
      sends_this_month: sendsThisMonth,
      progression
    });
  } catch (err) {
    console.error('Stats error:', err.message);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ── Visits ───────────────────────────────────────────────────

router.get('/visits', climberAuth, (req, res) => {
  try {
    const db = getDb();
    const visits = db.prepare(`
      SELECT checked_in_at, method FROM check_ins
      WHERE member_id = ? ORDER BY checked_in_at DESC LIMIT 20
    `).all(req.member.id);
    res.json(visits);
  } catch (err) {
    console.error('Visits error:', err.message);
    res.status(500).json({ error: 'Failed to load visits' });
  }
});

module.exports = router;
module.exports.ensureClimberTables = ensureClimberTables;
