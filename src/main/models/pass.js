/**
 * Pass & Membership model
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');

const Pass = {
  // ---- Pass Types ----

  createType(data) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO pass_types (id, name, category, price_peak, price_off_peak, visits_included, duration_days, is_recurring, recurring_interval, description, is_active)
      VALUES (@id, @name, @category, @price_peak, @price_off_peak, @visits_included, @duration_days, @is_recurring, @recurring_interval, @description, @is_active)
    `).run({
      id,
      name: data.name,
      category: data.category,
      price_peak: data.price_peak ?? null,
      price_off_peak: data.price_off_peak ?? null,
      visits_included: data.visits_included ?? null,
      duration_days: data.duration_days ?? null,
      is_recurring: data.is_recurring || 0,
      recurring_interval: data.recurring_interval || null,
      description: data.description || null,
      is_active: data.is_active ?? 1,
    });
    return this.getTypeById(id);
  },

  getTypeById(id) {
    return getDb().prepare('SELECT * FROM pass_types WHERE id = ?').get(id);
  },

  listTypes(activeOnly = true) {
    const db = getDb();
    const sql = activeOnly
      ? 'SELECT * FROM pass_types WHERE is_active = 1 ORDER BY category, name'
      : 'SELECT * FROM pass_types ORDER BY category, name';
    return db.prepare(sql).all();
  },

  updateType(id, data) {
    const db = getDb();
    const fields = ['name', 'category', 'price_peak', 'price_off_peak', 'visits_included', 'duration_days', 'is_recurring', 'recurring_interval', 'description', 'is_active'];
    const updates = [];
    const params = { id };
    for (const f of fields) {
      if (data[f] !== undefined) { updates.push(`${f} = @${f}`); params[f] = data[f]; }
    }
    if (updates.length) db.prepare(`UPDATE pass_types SET ${updates.join(', ')} WHERE id = @id`).run(params);
    return this.getTypeById(id);
  },

  // ---- Member Passes ----

  issue(memberId, passTypeId, isPeak = true, pricePaid = null) {
    const db = getDb();
    const passType = this.getTypeById(passTypeId);
    if (!passType) throw new Error('Pass type not found');

    const price = pricePaid ?? (isPeak ? passType.price_peak : passType.price_off_peak) ?? 0;
    const id = uuidv4();

    let expiresAt = null;
    let visitsRemaining = passType.visits_included ?? null;

    if (passType.category === 'single_entry') {
      // Day passes: expire at midnight tonight, 1 visit
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      expiresAt = endOfDay.toISOString();
      visitsRemaining = visitsRemaining ?? 1;
    } else if (passType.duration_days) {
      const d = new Date();
      d.setDate(d.getDate() + passType.duration_days);
      expiresAt = d.toISOString();
    }

    db.prepare(`
      INSERT INTO member_passes (id, member_id, pass_type_id, status, is_peak, price_paid, visits_remaining, expires_at)
      VALUES (?, ?, ?, 'active', ?, ?, ?, ?)
    `).run(id, memberId, passTypeId, isPeak ? 1 : 0, price, visitsRemaining, expiresAt);

    return this.getById(id);
  },

  getById(id) {
    return getDb().prepare(`
      SELECT mp.*, pt.name as pass_name, pt.category, pt.is_recurring, pt.recurring_interval
      FROM member_passes mp
      JOIN pass_types pt ON mp.pass_type_id = pt.id
      WHERE mp.id = ?
    `).get(id);
  },

  getActivePasses(memberId) {
    return getDb().prepare(`
      SELECT mp.*, pt.name as pass_name, pt.category, pt.is_recurring
      FROM member_passes mp
      JOIN pass_types pt ON mp.pass_type_id = pt.id
      WHERE mp.member_id = ? AND mp.status = 'active'
        AND (mp.expires_at IS NULL OR mp.expires_at > datetime('now'))
        AND (mp.visits_remaining IS NULL OR mp.visits_remaining > 0)
      ORDER BY mp.created_at DESC
    `).all(memberId);
  },

  getAllPasses(memberId) {
    return getDb().prepare(`
      SELECT mp.*, pt.name as pass_name, pt.category, pt.is_recurring
      FROM member_passes mp
      JOIN pass_types pt ON mp.pass_type_id = pt.id
      WHERE mp.member_id = ?
      ORDER BY mp.created_at DESC
    `).all(memberId);
  },

  pause(passId, reason = '') {
    const db = getDb();
    db.prepare(`
      UPDATE member_passes SET status = 'paused', paused_at = datetime('now'), pause_reason = ?, updated_at = datetime('now')
      WHERE id = ? AND status = 'active'
    `).run(reason, passId);
    return this.getById(passId);
  },

  unpause(passId) {
    const db = getDb();
    const pass = this.getById(passId);
    if (!pass || pass.status !== 'paused') throw new Error('Pass is not paused');

    // Extend expiry by the paused duration
    if (pass.paused_at && pass.expires_at) {
      const pausedMs = Date.now() - new Date(pass.paused_at).getTime();
      const newExpiry = new Date(new Date(pass.expires_at).getTime() + pausedMs).toISOString();
      db.prepare(`
        UPDATE member_passes SET status = 'active', paused_at = NULL, pause_reason = NULL, expires_at = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(newExpiry, passId);
    } else {
      db.prepare(`
        UPDATE member_passes SET status = 'active', paused_at = NULL, pause_reason = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).run(passId);
    }

    return this.getById(passId);
  },

  cancel(passId, reason = '') {
    const db = getDb();
    db.prepare(`
      UPDATE member_passes SET status = 'cancelled', cancelled_at = datetime('now'), cancel_reason = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(reason, passId);
    return this.getById(passId);
  },

  extend(passId, extraDays) {
    const db = getDb();
    const pass = this.getById(passId);
    if (!pass) throw new Error('Pass not found');

    const currentExpiry = pass.expires_at ? new Date(pass.expires_at) : new Date();
    currentExpiry.setDate(currentExpiry.getDate() + extraDays);

    db.prepare("UPDATE member_passes SET expires_at = ?, updated_at = datetime('now') WHERE id = ?")
      .run(currentExpiry.toISOString(), passId);
    return this.getById(passId);
  },

  transfer(passId, newMemberId) {
    const db = getDb();
    db.prepare("UPDATE member_passes SET member_id = ?, updated_at = datetime('now') WHERE id = ?")
      .run(newMemberId, passId);
    return this.getById(passId);
  },

  /**
   * Check and expire passes that are past their date
   */
  expireOverdue() {
    const db = getDb();
    const result = db.prepare(`
      UPDATE member_passes SET status = 'expired', updated_at = datetime('now')
      WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= datetime('now')
    `).run();
    return result.changes;
  },

  /**
   * Seed the default BoulderRyn pass types
   */
  seedDefaults() {
    const db = getDb();
    const existing = db.prepare('SELECT count(*) as c FROM pass_types').get().c;
    if (existing > 0) return;

    const types = [
      // Single entry
      { name: 'Adult Single Entry', category: 'single_entry', price_peak: 15.00, price_off_peak: 12.50 },
      { name: 'Concession/Student/U18 Single Entry', category: 'single_entry', price_peak: 12.50, price_off_peak: 12.50 },
      { name: 'Under 16 Single Entry', category: 'single_entry', price_peak: 12.00, price_off_peak: 12.00 },
      { name: '8-10 Single Entry', category: 'single_entry', price_peak: 10.50, price_off_peak: 10.50 },
      // 10 visit
      { name: 'Adult 10 Visit Pass', category: 'multi_visit', price_peak: 135.00, price_off_peak: 135.00, visits_included: 10 },
      { name: 'Concession/Student/U18 10 Visit Pass', category: 'multi_visit', price_peak: 112.50, price_off_peak: 112.50, visits_included: 10 },
      // Monthly passes (single month, not recurring)
      { name: 'Adult Monthly Pass', category: 'monthly_pass', price_peak: 45.00, price_off_peak: 35.00, duration_days: 30 },
      { name: 'Concession Monthly Pass', category: 'monthly_pass', price_peak: 38.00, price_off_peak: 33.00, duration_days: 30 },
      { name: 'Family Monthly Pass', category: 'monthly_pass', price_peak: 90.00, price_off_peak: 70.00, duration_days: 30 },
      { name: 'U16 Monthly Pass', category: 'monthly_pass', price_peak: 35.00, price_off_peak: 25.00, duration_days: 30 },
      // Memberships (DD recurring)
      { name: 'Adult Monthly Membership', category: 'membership_dd', price_peak: 42.00, price_off_peak: 32.00, duration_days: 30, is_recurring: 1, recurring_interval: 'monthly' },
      { name: 'Adult Annual Membership', category: 'membership_dd', price_peak: 465.00, price_off_peak: 352.00, duration_days: 365, is_recurring: 1, recurring_interval: 'annual' },
      { name: 'Concession/Student/U18 Monthly Membership', category: 'membership_dd', price_peak: 35.00, price_off_peak: 30.00, duration_days: 30, is_recurring: 1, recurring_interval: 'monthly' },
      { name: 'Concession/Student/U18 Annual Membership', category: 'membership_dd', price_peak: 385.00, price_off_peak: 330.00, duration_days: 365, is_recurring: 1, recurring_interval: 'annual' },
      { name: 'Family Monthly Membership', category: 'membership_dd', price_peak: 85.00, price_off_peak: 65.00, duration_days: 30, is_recurring: 1, recurring_interval: 'monthly' },
    ];

    for (const t of types) {
      this.createType(t);
    }

    return types.length;
  },
};

module.exports = Pass;
