const express = require('express');
const router = express.Router();
const dojo = require('../integrations/dojo');
const { getDb } = require('../main/database/db');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/dojo/payment-intent
 * Creates a Dojo Payment Intent for in-person card payment
 * Called by POS when "Card" payment method selected
 */
router.post('/payment-intent', async (req, res, next) => {
  try {
    if (!dojo.isConfigured()) {
      return res.status(503).json({ error: 'Dojo not configured. Add DOJO_API_KEY to /etc/dynamic.env' });
    }
    const { amountPence, reference, description } = req.body;
    if (!amountPence || amountPence <= 0) return res.status(400).json({ error: 'amountPence required' });

    const intent = await dojo.createPaymentIntent({ amountPence, reference, description });
    res.json({ intentId: intent.id, clientSessionSecret: intent.clientSessionSecret, status: intent.status });
  } catch (e) { next(e); }
});

/**
 * GET /api/dojo/payment-intent/:id
 * Poll the status of a payment intent
 * Frontend polls this every 2s while waiting for terminal confirmation
 */
router.get('/payment-intent/:id', async (req, res, next) => {
  try {
    if (!dojo.isConfigured()) return res.status(503).json({ error: 'Dojo not configured' });
    const intent = await dojo.getPaymentIntent(req.params.id);
    res.json({ intentId: intent.id, status: intent.status, amount: intent.amount });
  } catch (e) { next(e); }
});

/**
 * POST /api/dojo/payment-intent/:id/cancel
 * Cancel a pending payment intent (e.g. customer changed mind)
 */
router.post('/payment-intent/:id/cancel', async (req, res, next) => {
  try {
    if (!dojo.isConfigured()) return res.status(503).json({ error: 'Dojo not configured' });
    const result = await dojo.cancelPaymentIntent(req.params.id);
    res.json({ success: true, status: result.status });
  } catch (e) { next(e); }
});

/**
 * POST /api/dojo/webhook
 * Dojo calls this URL when a payment is completed/failed
 * Configure this URL in the Dojo Developer Portal as your webhook endpoint
 * Dojo will send events like: payment_intent.captured, payment_intent.canceled
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['dojo-signature'];
    const secret = process.env.DOJO_WEBHOOK_SECRET;

    if (secret && signature) {
      const valid = dojo.verifyWebhook(req.body, signature, secret);
      if (!valid) return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const event = JSON.parse(req.body.toString());
    const db = getDb();

    if (event.type === 'payment_intent.captured') {
      const intent = event.data?.paymentIntent;
      if (intent?.reference) {
        // Mark the transaction as completed via card
        db.prepare(`UPDATE transactions SET payment_status = 'completed', dojo_intent_id = ?
          WHERE reference = ? AND payment_status = 'pending'`)
          .run(intent.id, intent.reference);
      }
    }

    res.json({ received: true });
  } catch (e) {
    console.error('[Dojo webhook error]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/dojo/status
 * Returns whether Dojo is configured and which environment (sandbox/prod)
 */
router.get('/status', (req, res) => {
  const configured = dojo.isConfigured();
  const key = process.env.DOJO_API_KEY || '';
  const env = key.startsWith('sk_sandbox_') ? 'sandbox' : key.startsWith('sk_prod_') ? 'production' : 'unconfigured';
  res.json({ configured, environment: env });
});

module.exports = router;
