/**
 * BoulderRyn — Express Web Server
 */

const express = require('express');
const path = require('path');
const { getDb, closeDb } = require('./src/main/database/db');

// Models
const Pass = require('./src/main/models/pass');
const Waiver = require('./src/main/models/waiver');
const { seedProducts } = require('./src/main/models/seed-products');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API Routes
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
app.use('/api/stats', require('./src/routes/stats'));
app.use('/api', require('./src/routes/register'));

// Public registration page (no auth required)
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'public', 'register.html'));
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

// Start server
app.listen(PORT, () => {
  // Ensure database is initialised
  getDb();

  // Seed defaults on first run
  Pass.seedDefaults();
  Waiver.seedDefaults();
  seedProducts();

  console.log(`BoulderRyn running at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});
