/**
 * Self-serve signup route — platform-level (no gym context)
 *
 * Mounted in server.js BEFORE gym context middleware:
 *   app.use('/api/signup', require('./src/routes/signup'));
 *
 * Flow:
 *   1. POST /api/signup/check-availability  — check if gym_id is available
 *   2. POST /api/signup/create              — provision gym + create Stripe checkout
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getPlatformDb } = require('../main/database/platformDb');
const { provisionGym } = require('../../scripts/provision-gym');
const { sendWelcomeEmail } = require('../services/welcomeEmail');

const DATA_ROOT = process.env.CRUX_DATA_DIR || process.env.BOULDERRYN_DATA_DIR || path.join(__dirname, '../../data');

// Detect placeholder/test mode
function isPlaceholder() {
  const key = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
  return key === 'sk_test_placeholder' || key === '';
}

function gymExists(gymId) {
  return fs.existsSync(path.join(DATA_ROOT, 'gyms', gymId, 'gym.db'));
}

// ── POST /api/signup/check-availability ───────────────────────────────────

router.post('/check-availability', (req, res) => {
  const { gymId } = req.body;
  if (!gymId) return res.status(400).json({ error: 'gymId required' });

  if (!/^[a-z0-9][a-z0-9-]{1,29}$/.test(gymId)) {
    return res.json({ available: false, reason: 'Invalid format. Use lowercase letters, numbers and hyphens (2–30 chars).' });
  }

  if (gymExists(gymId)) {
    return res.json({ available: false, reason: 'That subdomain is already taken. Please choose another.' });
  }

  res.json({ available: true });
});

// ── POST /api/signup/create ────────────────────────────────────────────────

router.post('/create', async (req, res) => {
  const { gymId, gymName, ownerEmail, ownerPassword, ownerFirstName, ownerLastName, plan: planId } = req.body;

  if (!gymId || !gymName || !ownerEmail) {
    return res.status(400).json({ error: 'gymId, gymName, and ownerEmail are required' });
  }

  if (!/^[a-z0-9][a-z0-9-]{1,29}$/.test(gymId)) {
    return res.status(400).json({ error: 'Invalid gymId format' });
  }

  if (gymExists(gymId)) {
    return res.status(409).json({ error: 'That subdomain is already taken' });
  }

  try {
    // 1. Provision the gym (creates DB, seeds defaults, inserts billing record)
    const result = await provisionGym(gymId, gymName, ownerEmail);
    if (!result.success) {
      return res.status(500).json({ error: result.message });
    }

    // 2. Create owner account in the new gym's DB (if details provided)
    if (ownerFirstName && ownerEmail) {
      try {
        const gymContext = require('../main/database/gymContext');
        const { getDb } = require('../main/database/db');
        const Staff = require('../main/models/staff');
        gymContext.run({ gymId }, () => {
          getDb(); // ensure connection
          const existing = getDb().prepare('SELECT COUNT(*) as c FROM staff WHERE role = ?').get('owner');
          if (existing.c === 0) {
            Staff.create({
              first_name: ownerFirstName,
              last_name: ownerLastName || '',
              email: ownerEmail,
              role: 'owner',
              password: ownerPassword || undefined,
            });
          }
        });
      } catch (ownerErr) {
        console.warn('[signup] owner account creation failed:', ownerErr.message);
      }
    }

    // 4. Send welcome email (best-effort)
    try {
      await sendWelcomeEmail(gymId, gymName, ownerEmail);
    } catch (emailErr) {
      console.warn('[signup] welcome email failed:', emailErr.message);
    }

    // 3. Create Stripe checkout (or mock in dev)
    const hostname = req.get('host') || 'localhost:8080';
    const protocol = req.protocol || 'http';
    const isLocal = hostname.startsWith('localhost') || hostname.startsWith('127.');

    const successUrl = isLocal
      ? `${protocol}://${hostname}/?gymId=${gymId}&signup=success`
      : `${protocol}://${gymId}.cruxgym.co.uk/?signup=success`;
    const cancelUrl = isLocal
      ? `${protocol}://${hostname}/signup?cancelled=1`
      : `${protocol}://cruxgym.co.uk/signup?cancelled=1`;

    if (isPlaceholder()) {
      // Dev mode — skip Stripe, return mock success
      return res.json({
        ok: true,
        gymId,
        subdomain: `${gymId}.cruxgym.co.uk`,
        checkoutUrl: successUrl + '&mock=1',
        mock: true,
      });
    }

    // Real Stripe checkout
    const stripe = require('../config/stripe');
    const db = getPlatformDb();
    const record = db.prepare('SELECT * FROM gym_billing WHERE gym_id = ?').get(gymId);

    const PLANS = {
      starter: process.env.STRIPE_PRICE_STARTER,
      growth:  process.env.STRIPE_PRICE_GROWTH,
      scale:   process.env.STRIPE_PRICE_SCALE,
    };
    const priceId = PLANS[planId] || PLANS.growth;

    let customerId = record?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: ownerEmail,
        name: gymName,
        metadata: { gym_id: gymId },
      });
      customerId = customer.id;
      db.prepare("UPDATE gym_billing SET stripe_customer_id = ?, updated_at = datetime('now') WHERE gym_id = ?")
        .run(customerId, gymId);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { gym_id: gymId, plan: planId || 'growth' },
      subscription_data: {
        trial_period_days: 14,
        metadata: { gym_id: gymId },
      },
    });

    res.json({
      ok: true,
      gymId,
      subdomain: `${gymId}.cruxgym.co.uk`,
      checkoutUrl: session.url,
    });

  } catch (err) {
    console.error('[signup] create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
