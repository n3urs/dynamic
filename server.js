/**
 * Crux — Express Web Server
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { getDb, closeAll, gymContext } = require('./src/main/database/db');
const fs = require('fs');

// Models
const Pass = require('./src/main/models/pass');
const Waiver = require('./src/main/models/waiver');
const { seedProducts } = require('./src/main/models/seed-products');
const climberRoutes = require('./src/routes/climber');

const app = express();
const PORT = process.env.PORT || 8080;
const DATA_ROOT = process.env.CRUX_DATA_DIR || process.env.BOULDERRYN_DATA_DIR || path.join(__dirname, 'data');

// ── Security ───────────────────────────────────────────────────────────────

app.use(helmet({
  // CSP: allow Tailwind CDN, Google Fonts, YouTube embeds, inline scripts (app.js)
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.tailwindcss.com', 'cdn.jsdelivr.net'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'cdn.tailwindcss.com', 'fonts.googleapis.com'],
      fontSrc: ["'self'", 'fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      frameSrc: ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com'],
      connectSrc: ["'self'"],
      scriptSrcAttr: ["'unsafe-inline'"], // allow onclick= handlers throughout the app
    },
  },
  crossOriginEmbedderPolicy: false, // needed for YouTube iframes
  referrerPolicy: { policy: 'origin-when-cross-origin' },
}));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later.' },
});

// ── Env vars (Stripe billing) ──────────────────────────────────────────────
// These are loaded from the environment (e.g. /etc/dynamic.env or .env).
// They can be left empty/placeholder during development.
//   STRIPE_SECRET_KEY       — Stripe secret key (sk_live_... or sk_test_...)
//   STRIPE_WEBHOOK_SECRET   — Stripe webhook signing secret (whsec_...)
//   STRIPE_PRICE_STARTER    — Stripe Price ID for Starter plan
//   STRIPE_PRICE_GROWTH     — Stripe Price ID for Growth plan
//   STRIPE_PRICE_SCALE      — Stripe Price ID for Scale plan

// ── Admin token (super-admin panel) ────────────────────────────────────────
// Set ADMIN_TOKEN in environment to secure the admin panel
process.env.ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin_secret_placeholder';

// ── Middleware ─────────────────────────────────────────────────────────────

// Webhook route needs raw body — must be registered before express.json()
app.post('/billing/webhook', express.raw({ type: 'application/json' }), require('./src/routes/billing').webhook);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Billing routes (platform-level, before gym context) ───────────────────
app.use('/billing', require('./src/routes/billing').router);

// ── Admin routes (super-admin panel, before gym context) ──────────────────
const requireAdmin = require('./src/middleware/requireAdmin');
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'public', 'admin.html'));
});
app.use('/admin', requireAdmin, require('./src/routes/admin'));

// ── Self-serve signup + invite (before gym context) ───────────────────────
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'public', 'signup.html'));
});
app.get('/invite', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'public', 'invite.html'));
});
app.use('/api/signup', require('./src/routes/signup'));

// ── Member portal ──────────────────────────────────────────────────────────
app.get('/me', (req, res) => res.sendFile(path.join(__dirname, 'src', 'public', 'me.html')));
app.get('/me/*', (req, res) => res.sendFile(path.join(__dirname, 'src', 'public', 'me.html')));

// ── Gym context middleware ─────────────────────────────────────────────────
// Resolves the active gym_id from the request subdomain and threads it
// through the entire async call chain via AsyncLocalStorage.

function detectFirstGym() {
  const gymsDir = path.join(DATA_ROOT, 'gyms');
  if (!fs.existsSync(gymsDir)) return null;
  const entries = fs.readdirSync(gymsDir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory() && fs.existsSync(path.join(gymsDir, e.name, 'gym.db'))) {
      return e.name;
    }
  }
  return null;
}

app.use((req, res, next) => {
  const hostname = req.hostname || '';
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(hostname);
  const isCrux = hostname.endsWith('.cruxgym.co.uk') || hostname.endsWith('.cruxgym.io');

  let gymId;

  // Also treat tunnel/proxy domains as local dev (trycloudflare.com, ngrok, etc.)
  const isTunnel = !isCrux && process.env.DEFAULT_GYM_ID;

  if (isLocal || isTunnel || (!isCrux && !hostname.includes('.'))) {
    // Local dev — use DEFAULT_GYM_ID or the first gym on disk
    gymId = process.env.DEFAULT_GYM_ID || detectFirstGym();
    if (!gymId) {
      return res.status(503).json({
        error: 'No gym provisioned. Run: node scripts/provision-gym.js <gym_id>'
      });
    }
  } else {
    // Production — extract subdomain: mygym.cruxgym.co.uk → mygym
    gymId = hostname.split('.')[0];
    if (!gymId || !/^[a-z0-9-]{2,30}$/.test(gymId)) {
      return res.status(400).json({ error: 'Invalid gym identifier in hostname.' });
    }
    // Reject requests for gyms that haven't been provisioned
    const gymDbPath = path.join(DATA_ROOT, 'gyms', gymId, 'gym.db');
    if (!fs.existsSync(gymDbPath)) {
      return res.status(404).json({ error: `Gym "${gymId}" not found.` });
    }
  }

  req.gymId = gymId; // convenience on req for routes that need it (e.g. photos)
  gymContext.run({ gymId }, next);
});

// ── Billing gate (applied to all /api routes except auth) ─────────────────
const requireBilling = require('./src/middleware/requireBilling');
app.use('/api', (req, res, next) => {
  // Auth and invite routes must always be accessible regardless of billing
  if (
    req.path.startsWith('/staff/auth') ||
    req.path.startsWith('/staff/invite') ||
    req.path.startsWith('/climber/auth') ||
    req.path.startsWith('/gym-info') ||
    req.path.startsWith('/signup') ||
    req.path.startsWith('/me/auth')
  ) return next();
  requireBilling(req, res, next);
});

// ── API Routes ─────────────────────────────────────────────────────────────

app.use('/api/members', require('./src/routes/members'));
app.use('/api/checkin', require('./src/routes/checkin'));
app.use('/api/products', require('./src/routes/products'));
app.use('/api/transactions', require('./src/routes/transactions'));
app.use('/api/passes', require('./src/routes/passes'));
app.use('/api/waivers', require('./src/routes/waivers'));
app.use('/api/giftcards', require('./src/routes/giftcards'));
app.use('/api/events', require('./src/routes/events'));
app.use('/api/routes', require('./src/routes/routes'));
app.use('/api/analytics', require('./src/routes/analytics'));
app.use('/api/staff', require('./src/routes/staff'));
app.use('/api/email', require('./src/routes/email'));
app.use('/api/settings', require('./src/routes/settings'));
app.use('/api/onboarding', require('./src/routes/onboarding'));
app.use('/api/stats', require('./src/routes/stats'));
app.use('/api/export', require('./src/routes/export'));
app.use('/api', require('./src/routes/register'));
app.use('/api/dojo', require('./src/routes/dojo'));
app.use('/api/me', require('./src/routes/me'));

// Rate-limit auth endpoints (must be registered before the route handlers)
app.use('/api/staff/auth', authLimiter);
app.use('/api/climber/auth', authLimiter);

// Climber portal API + pages
app.use('/api/climber', climberRoutes);
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'src', 'public', 'app.html')));
app.get('/app/*', (req, res) => res.sendFile(path.join(__dirname, 'src', 'public', 'app.html')));

// Public registration page (no auth required)
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'public', 'register.html'));
});
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'public', 'privacy.html'));
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'src', 'public')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: err.message });
});

// ── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  // Seed defaults for all provisioned gyms on startup
  const gymsDir = path.join(DATA_ROOT, 'gyms');
  if (fs.existsSync(gymsDir)) {
    const gymIds = fs.readdirSync(gymsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && fs.existsSync(path.join(gymsDir, e.name, 'gym.db')))
      .map(e => e.name);

    for (const gymId of gymIds) {
      gymContext.run({ gymId }, () => {
        getDb(); // ensure connection is open
        climberRoutes.ensureClimberTables();
        Pass.seedDefaults();
        Waiver.seedDefaults();
        seedProducts();
      });
    }
  }

  console.log(`Crux running at http://localhost:${PORT}`);
});

// Graceful shutdown
const { closePlatformDb } = require('./src/main/database/platformDb');
process.on('SIGINT', () => { closeAll(); closePlatformDb(); process.exit(0); });
process.on('SIGTERM', () => { closeAll(); closePlatformDb(); process.exit(0); });
