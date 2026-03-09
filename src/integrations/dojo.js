/**
 * Dojo (Paymentsense) Payment Integration
 *
 * Dojo uses a Payment Intent flow for in-person (EPOS) payments:
 * 1. Your server creates a Payment Intent (amount, currency, reference)
 * 2. Dojo returns a clientSessionSecret (short-lived token)
 * 3. The Dojo terminal receives the payment request
 * 4. Terminal processes the card tap/insert
 * 5. Dojo calls your webhook with the result OR you poll the intent status
 *
 * Docs: https://docs.dojo.tech/payments/getting-started
 * API:  https://api.dojo.tech/payment-intents
 *
 * Setup:
 *   1. Log in to https://developer.dojo.tech/
 *   2. Generate an API key (sk_sandbox_... for test, sk_prod_... for live)
 *   3. Add to /etc/dynamic.env: DOJO_API_KEY=sk_prod_xxxxx
 *   4. Add to /etc/dynamic.env: DOJO_ACCOUNT_ID=your-account-id
 */

const https = require('https');

const DOJO_API_BASE = 'https://api.dojo.tech';
const DOJO_API_VERSION = '2024-02-05';

function getApiKey() {
  const key = process.env.DOJO_API_KEY;
  if (!key) throw new Error('DOJO_API_KEY not set in environment');
  return key;
}

function dojoRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const apiKey = getApiKey();
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.dojo.tech',
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${apiKey}`,
        'Version': DOJO_API_VERSION,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) reject(new Error(`Dojo API error ${res.statusCode}: ${JSON.stringify(parsed)}`));
          else resolve(parsed);
        } catch (e) { reject(new Error(`Dojo parse error: ${data}`)); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = {
  /**
   * Create a Payment Intent — call this when staff presses "Pay with Card"
   *
   * @param {object} opts
   * @param {number}  opts.amountPence  - Amount in pence (e.g. 1500 = £15.00)
   * @param {string}  opts.reference    - Your transaction reference (e.g. 'TXN-abc123')
   * @param {string}  [opts.description] - Line items summary shown on receipt
   * @returns {Promise<{id, clientSessionSecret, status}>}
   */
  async createPaymentIntent({ amountPence, reference, description }) {
    return dojoRequest('POST', '/payment-intents', {
      amount: {
        value: amountPence,
        currencyCode: 'GBP',
      },
      reference,
      description: description || 'Climbing Gym',
      paymentMethods: ['Card'],
      // For EPOS/terminal: no redirect needed
    });
  },

  /**
   * Get the current status of a Payment Intent
   * Statuses: Created, Authorized, Captured, Canceled, Reversed
   *
   * @param {string} intentId  - The id returned from createPaymentIntent
   */
  async getPaymentIntent(intentId) {
    return dojoRequest('GET', `/payment-intents/${intentId}`, null);
  },

  /**
   * Cancel a Payment Intent (if not yet captured)
   */
  async cancelPaymentIntent(intentId) {
    return dojoRequest('POST', `/payment-intents/${intentId}/cancel`, {});
  },

  /**
   * Check if Dojo is configured (API key present)
   */
  isConfigured() {
    return !!(process.env.DOJO_API_KEY && process.env.DOJO_API_KEY.startsWith('sk_'));
  },

  /**
   * Verify a webhook signature from Dojo
   * Dojo sends a `dojo-signature` header — validate it against your webhook secret
   */
  verifyWebhook(payload, signature, secret) {
    const crypto = require('crypto');
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  },
};
