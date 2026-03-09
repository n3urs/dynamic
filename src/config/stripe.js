const Stripe = require('stripe');
const key = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
module.exports = new Stripe(key, { apiVersion: '2023-10-16' });
