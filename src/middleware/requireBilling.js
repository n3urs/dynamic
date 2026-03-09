/**
 * requireBilling middleware
 *
 * Checks that a gym has an active subscription before allowing access.
 * DO NOT wire this in yet — it will be added to routes explicitly later.
 *
 * Usage (when ready):
 *   const requireBilling = require('./src/middleware/requireBilling');
 *   app.use('/api/members', requireBilling, require('./src/routes/members'));
 */

const { getPlatformDb } = require('../main/database/platformDb');

function requireBilling(req, res, next) {
  // gym_id from gymContext on req (set by gym middleware) or query param
  const gymId = req.gymId || req.query.gymId;
  if (!gymId) return next(); // no context — pass through (e.g. public routes)

  const db = getPlatformDb();
  const record = db.prepare('SELECT * FROM gym_billing WHERE gym_id = ?').get(gymId);

  if (!record) {
    // No billing record — treat as trialing, allow through
    return next();
  }

  const { status, trial_ends_at } = record;

  if (status === 'cancelled' || status === 'unpaid') {
    return res.status(402).json({
      error: 'subscription_required',
      upgradeUrl: '/billing/create-checkout',
    });
  }

  if (status === 'trialing') {
    if (trial_ends_at && new Date(trial_ends_at) <= new Date()) {
      return res.status(402).json({
        error: 'subscription_required',
        upgradeUrl: '/billing/create-checkout',
      });
    }
    return next();
  }

  if (status === 'past_due') {
    res.setHeader('X-Billing-Warning', 'past_due');
    return next();
  }

  // active or anything else — allow through
  next();
}

module.exports = requireBilling;
