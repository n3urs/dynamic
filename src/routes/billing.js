/**
 * Billing routes — platform-level (not per-gym)
 *
 * Must be mounted BEFORE gym context middleware in server.js:
 *   app.post('/billing/webhook', express.raw({type: 'application/json'}), require('./src/routes/billing').webhook);
 *   app.use('/billing', require('./src/routes/billing').router);
 */

const express = require('express');
const { v4: uuidv4 } = require('crypto').webcrypto ? require('crypto') : { v4: () => require('crypto').randomUUID() };
const { getPlatformDb } = require('../main/database/platformDb');
const stripe = require('../config/stripe');

const router = express.Router();

// Detect placeholder/test mode — graceful degradation when no real key configured
function isPlaceholder() {
  const key = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
  return key === 'sk_test_placeholder' || key === '';
}

const PLANS = [
  { id: 'starter', name: 'Starter', price: 5900, currency: 'gbp', interval: 'month', priceId: process.env.STRIPE_PRICE_STARTER || '' },
  { id: 'growth',  name: 'Growth',  price: 9900, currency: 'gbp', interval: 'month', priceId: process.env.STRIPE_PRICE_GROWTH  || '' },
  { id: 'scale',   name: 'Scale',   price: 14900, currency: 'gbp', interval: 'month', priceId: process.env.STRIPE_PRICE_SCALE  || '' },
];

function getPlan(planId) {
  return PLANS.find(p => p.id === planId) || PLANS[1]; // default growth
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getBillingRecord(gymId) {
  const db = getPlatformDb();
  return db.prepare('SELECT * FROM gym_billing WHERE gym_id = ?').get(gymId);
}

function isActive(record) {
  if (!record) return false; // no record → treat as trialing but not "active" for isActive
  if (record.status === 'active') return true;
  if (record.status === 'trialing') {
    if (!record.trial_ends_at) return true; // no expiry set → still trialing
    return new Date(record.trial_ends_at) > new Date();
  }
  return false;
}

function formatRecord(record, gymId) {
  if (!record) {
    return {
      gymId,
      status: 'trialing',
      plan: 'growth',
      trialEndsAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      isActive: true,
    };
  }
  return {
    gymId: record.gym_id,
    status: record.status,
    plan: record.plan,
    trialEndsAt: record.trial_ends_at || null,
    currentPeriodEnd: record.current_period_end || null,
    cancelAtPeriodEnd: !!record.cancel_at_period_end,
    isActive: isActive(record),
  };
}

// ── GET /billing/plans ─────────────────────────────────────────────────────

router.get('/plans', (req, res) => {
  res.json({ plans: PLANS });
});

// ── GET /billing/status ────────────────────────────────────────────────────

router.get('/status', (req, res) => {
  // gym_id from gymContext on req (set by gym middleware) or query param
  const gymId = req.gymId || req.query.gymId;
  if (!gymId) return res.status(400).json({ error: 'gymId required' });

  const record = getBillingRecord(gymId);
  res.json(formatRecord(record, gymId));
});

// ── POST /billing/create-checkout ─────────────────────────────────────────

router.post('/create-checkout', async (req, res) => {
  const { gymId, plan: planId, successUrl, cancelUrl } = req.body;
  if (!gymId || !successUrl || !cancelUrl) {
    return res.status(400).json({ error: 'gymId, successUrl, and cancelUrl are required' });
  }

  if (isPlaceholder()) {
    return res.json({ url: successUrl + '?mock=1' });
  }

  try {
    const db = getPlatformDb();
    let record = db.prepare('SELECT * FROM gym_billing WHERE gym_id = ?').get(gymId);
    const plan = getPlan(planId);

    // Create or retrieve Stripe customer
    let customerId = record?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { gym_id: gymId },
        description: `Gym: ${gymId}`,
      });
      customerId = customer.id;

      if (record) {
        db.prepare('UPDATE gym_billing SET stripe_customer_id = ?, updated_at = datetime(\'now\') WHERE gym_id = ?')
          .run(customerId, gymId);
      } else {
        db.prepare(`INSERT INTO gym_billing (gym_id, stripe_customer_id, plan, status)
                    VALUES (?, ?, ?, 'trialing')`)
          .run(gymId, customerId, plan.id);
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { gym_id: gymId, plan: plan.id },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[billing] create-checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /billing/portal ───────────────────────────────────────────────────

router.post('/portal', async (req, res) => {
  const { gymId, returnUrl } = req.body;
  if (!gymId || !returnUrl) {
    return res.status(400).json({ error: 'gymId and returnUrl are required' });
  }

  if (isPlaceholder()) {
    return res.json({ url: returnUrl + '?mock=portal=1' });
  }

  try {
    const db = getPlatformDb();
    const record = db.prepare('SELECT * FROM gym_billing WHERE gym_id = ?').get(gymId);
    if (!record?.stripe_customer_id) {
      return res.status(404).json({ error: 'No billing account found for this gym' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: record.stripe_customer_id,
      return_url: returnUrl,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[billing] portal error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /billing/webhook ─────────────────────────────────────────────────
// Exported separately so server.js can mount it with express.raw body parser

async function webhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  let event;
  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // No webhook secret configured — parse raw body as JSON (dev mode)
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('[billing] webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  const db = getPlatformDb();

  // Store event (idempotency)
  try {
    db.prepare(`INSERT OR IGNORE INTO billing_events (id, gym_id, stripe_event_id, event_type, payload_json)
                VALUES (?, ?, ?, ?, ?)`)
      .run(
        require('crypto').randomUUID(),
        event.data?.object?.metadata?.gym_id || null,
        event.id,
        event.type,
        JSON.stringify(event.data.object)
      );
  } catch (e) {
    // Duplicate event — already processed
    return res.json({ received: true });
  }

  const obj = event.data.object;

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const gymId = obj.metadata?.gym_id;
        const subscriptionId = obj.subscription;
        if (!gymId) break;

        const existing = db.prepare('SELECT gym_id FROM gym_billing WHERE gym_id = ?').get(gymId);
        if (existing) {
          db.prepare(`UPDATE gym_billing
                      SET status = 'active', stripe_subscription_id = ?, updated_at = datetime('now')
                      WHERE gym_id = ?`)
            .run(subscriptionId, gymId);
        } else {
          db.prepare(`INSERT INTO gym_billing (gym_id, stripe_customer_id, stripe_subscription_id, plan, status)
                      VALUES (?, ?, ?, 'growth', 'active')`)
            .run(gymId, obj.customer, subscriptionId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const gymId = obj.metadata?.gym_id;
        if (!gymId) break;

        // Map Stripe status to our status
        const statusMap = {
          active: 'active',
          trialing: 'trialing',
          past_due: 'past_due',
          canceled: 'cancelled',
          unpaid: 'unpaid',
          incomplete: 'trialing',
          incomplete_expired: 'cancelled',
          paused: 'past_due',
        };
        const status = statusMap[obj.status] || obj.status;
        const periodEnd = obj.current_period_end
          ? new Date(obj.current_period_end * 1000).toISOString()
          : null;
        const cancelAtPeriodEnd = obj.cancel_at_period_end ? 1 : 0;

        // Try to detect plan from price metadata or nickname
        const priceId = obj.items?.data?.[0]?.price?.id || '';
        const plansByPriceId = {
          [process.env.STRIPE_PRICE_STARTER || '']: 'starter',
          [process.env.STRIPE_PRICE_GROWTH  || '']: 'growth',
          [process.env.STRIPE_PRICE_SCALE   || '']: 'scale',
        };
        const plan = plansByPriceId[priceId] || 'growth';

        db.prepare(`UPDATE gym_billing
                    SET status = ?, plan = ?, current_period_end = ?, cancel_at_period_end = ?,
                        stripe_subscription_id = ?, updated_at = datetime('now')
                    WHERE gym_id = ?`)
          .run(status, plan, periodEnd, cancelAtPeriodEnd, obj.id, gymId);
        break;
      }

      case 'customer.subscription.deleted': {
        const gymId = obj.metadata?.gym_id;
        if (!gymId) break;
        db.prepare(`UPDATE gym_billing SET status = 'cancelled', updated_at = datetime('now') WHERE gym_id = ?`)
          .run(gymId);
        break;
      }

      case 'invoice.payment_failed': {
        const customerId = obj.customer;
        if (!customerId) break;
        db.prepare(`UPDATE gym_billing SET status = 'past_due', updated_at = datetime('now') WHERE stripe_customer_id = ?`)
          .run(customerId);
        break;
      }

      case 'invoice.payment_succeeded': {
        const customerId = obj.customer;
        if (!customerId) break;
        db.prepare(`UPDATE gym_billing SET status = 'active', updated_at = datetime('now') WHERE stripe_customer_id = ?`)
          .run(customerId);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('[billing] webhook handler error:', err.message);
    // Don't return 500 — Stripe will retry; just log it
  }

  res.json({ received: true });
}

module.exports = { router, webhook };
