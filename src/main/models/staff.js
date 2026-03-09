/**
 * Staff & Admin model
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getDb } = require('../database/db');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const verify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verify;
}

function hashPin(pin) {
  // Salted PBKDF2 — same as password hashing, prevents rainbow table attacks on short PINs
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(pin), salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPin(pin, stored) {
  if (!stored) return false;
  // Legacy: plain SHA256 (no colon separator) — migrate on first successful auth
  if (!stored.includes(':')) {
    return crypto.createHash('sha256').update(String(pin)).digest('hex') === stored;
  }
  const [salt, hash] = stored.split(':');
  const verify = crypto.pbkdf2Sync(String(pin), salt, 10000, 64, 'sha512').toString('hex');
  return hash === verify;
}

// Role display names
const ROLE_DISPLAY_NAMES = {
  centre_assistant: 'Centre Assistant',
  duty_manager: 'Duty Manager',
  setter: 'Route Setter',
  tech_lead: 'Tech Lead',
  owner: 'Owner',
};

function getRoleDisplayName(role) {
  return ROLE_DISPLAY_NAMES[role] || role;
}

const DEFAULT_PERMISSIONS = {
  centre_assistant: {
    checkin: true, pos: true, members_view: true, members_edit: false,
    events_view: true, events_edit: false, routes_view: true, routes_edit: false,
    analytics: false, settings: false, staff: false, waiver_validate: true,
  },
  duty_manager: {
    checkin: true, pos: true, members_view: true, members_edit: true,
    events_view: true, events_edit: true, routes_view: true, routes_edit: true,
    analytics: false, settings: false, staff: false, waiver_validate: true,
  },
  setter: {
    checkin: true, pos: false, members_view: false, members_edit: false,
    events_view: true, events_edit: false, routes_view: true, routes_edit: true,
    analytics: false, settings: false, staff: false, waiver_validate: false,
  },
  tech_lead: {
    checkin: true, pos: true, members_view: true, members_edit: true,
    events_view: true, events_edit: true, routes_view: true, routes_edit: true,
    analytics: true, settings: true, staff: true, waiver_validate: true,
  },
  owner: {
    checkin: true, pos: true, members_view: true, members_edit: true,
    events_view: true, events_edit: true, routes_view: true, routes_edit: true,
    analytics: true, settings: true, staff: true, waiver_validate: true,
  },
};

const Staff = {
  create(data) {
    const db = getDb();
    const id = uuidv4();
    const role = data.role || 'centre_assistant';
    const permissions = data.permissions || DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.centre_assistant;

    db.prepare(`
      INSERT INTO staff (id, first_name, last_name, email, phone, role, pin_hash, password_hash, permissions_json, is_active)
      VALUES (@id, @first_name, @last_name, @email, @phone, @role, @pin_hash, @password_hash, @permissions_json, 1)
    `).run({
      id, first_name: data.first_name, last_name: data.last_name,
      email: data.email || null, phone: data.phone || null, role,
      pin_hash: data.pin ? hashPin(data.pin) : null,
      password_hash: data.password ? hashPassword(data.password) : null,
      permissions_json: JSON.stringify(permissions),
    });

    return this.getById(id);
  },

  getById(id) {
    const s = getDb().prepare('SELECT * FROM staff WHERE id = ?').get(id);
    if (s) {
      s.permissions = JSON.parse(s.permissions_json || '{}');
      delete s.password_hash;
      delete s.pin_hash;
    }
    return s;
  },

  list(activeOnly = true) {
    const sql = activeOnly
      ? 'SELECT id, first_name, last_name, email, phone, role, is_active, permissions_json, created_at FROM staff WHERE is_active = 1 ORDER BY role, last_name'
      : 'SELECT id, first_name, last_name, email, phone, role, is_active, permissions_json, created_at FROM staff ORDER BY role, last_name';
    const rows = getDb().prepare(sql).all();
    return rows.map(r => {
      r.permissions = JSON.parse(r.permissions_json || '{}');
      delete r.permissions_json;
      return r;
    });
  },

  count() {
    const row = getDb().prepare('SELECT COUNT(*) as cnt FROM staff').get();
    return row ? row.cnt : 0;
  },

  update(id, data) {
    const db = getDb();
    const fields = ['first_name', 'last_name', 'email', 'phone', 'role', 'is_active'];
    const updates = []; const params = { id };

    for (const f of fields) {
      if (data[f] !== undefined) { updates.push(`${f} = @${f}`); params[f] = data[f]; }
    }

    if (data.pin) { updates.push('pin_hash = @pin_hash'); params.pin_hash = hashPin(data.pin); }
    if (data.password) { updates.push('password_hash = @password_hash'); params.password_hash = hashPassword(data.password); }
    if (data.permissions) { updates.push('permissions_json = @permissions_json'); params.permissions_json = JSON.stringify(data.permissions); }

    // If role changed and no explicit permissions, update permissions to role defaults
    if (data.role && !data.permissions) {
      const newPerms = DEFAULT_PERMISSIONS[data.role] || DEFAULT_PERMISSIONS.centre_assistant;
      updates.push('permissions_json = @permissions_json');
      params.permissions_json = JSON.stringify(newPerms);
    }

    if (updates.length) db.prepare(`UPDATE staff SET ${updates.join(', ')} WHERE id = @id`).run(params);
    return this.getById(id);
  },

  deactivate(id) {
    getDb().prepare('UPDATE staff SET is_active = 0 WHERE id = ?').run(id);
  },

  activate(id) {
    getDb().prepare('UPDATE staff SET is_active = 1 WHERE id = ?').run(id);
  },

  /**
   * Authenticate by PIN (quick desk login)
   */
  authenticateByPin(pin) {
    const db = getDb();
    // Salted hash means we can't use WHERE — fetch active staff and verify each
    const allStaff = db.prepare('SELECT * FROM staff WHERE is_active = 1').all();
    const staff = allStaff.find(s => verifyPin(pin, s.pin_hash));
    if (!staff) return null;
    // Migrate legacy unsalted SHA256 PIN to salted PBKDF2 on successful auth
    if (staff.pin_hash && !staff.pin_hash.includes(':')) {
      db.prepare('UPDATE staff SET pin_hash = ? WHERE id = ?').run(hashPin(pin), staff.id);
    }
    staff.permissions = JSON.parse(staff.permissions_json || '{}');
    delete staff.password_hash;
    delete staff.pin_hash;
    return staff;
  },

  /**
   * Authenticate by email + password (full login)
   */
  authenticateByPassword(email, password) {
    const db = getDb();
    const staff = db.prepare('SELECT * FROM staff WHERE email = ? AND is_active = 1').get(email);
    if (!staff || !staff.password_hash) return null;
    if (!verifyPassword(password, staff.password_hash)) return null;
    staff.permissions = JSON.parse(staff.permissions_json || '{}');
    delete staff.password_hash;
    delete staff.pin_hash;
    return staff;
  },

  /**
   * Check if staff has permission
   */
  hasPermission(staffId, permission) {
    const staff = this.getById(staffId);
    if (!staff) return false;
    if (staff.role === 'owner' || staff.role === 'tech_lead') return true;
    return !!staff.permissions[permission];
  },

  getDefaultPermissions(role) {
    return DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.centre_assistant;
  },

  getRoleDisplayName,
  ROLE_DISPLAY_NAMES,

  /**
   * Seed default owner — only works if no staff exist
   */
  seedOwner() {
    const count = this.count();
    if (count > 0) return { created: false, message: 'Staff already exist' };

    const owner = this.create({
      first_name: 'Oscar',
      last_name: 'Sullivan',
      email: 'oscar@sullivanltd.co.uk',
      role: 'owner',
      pin: '2109',
      password: 'dynamic2026',
    });

    return { created: true, staff: owner };
  },

  // ---- Staff Rota ----

  createShift(data) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO staff_shifts (id, staff_id, shift_date, start_time, end_time, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.staff_id, data.shift_date, data.start_time, data.end_time, data.notes || null);
    return db.prepare('SELECT * FROM staff_shifts WHERE id = ?').get(id);
  },

  getShifts({ staffId, dateFrom, dateTo } = {}) {
    const db = getDb();
    let sql = `
      SELECT ss.*, s.first_name, s.last_name, s.role
      FROM staff_shifts ss JOIN staff s ON ss.staff_id = s.id WHERE 1=1
    `;
    const params = {};
    if (staffId) { sql += ' AND ss.staff_id = @staffId'; params.staffId = staffId; }
    if (dateFrom) { sql += ' AND ss.shift_date >= @dateFrom'; params.dateFrom = dateFrom; }
    if (dateTo) { sql += ' AND ss.shift_date <= @dateTo'; params.dateTo = dateTo; }
    sql += ' ORDER BY ss.shift_date, ss.start_time';
    return db.prepare(sql).all(params);
  },

  deleteShift(id) {
    return getDb().prepare('DELETE FROM staff_shifts WHERE id = ?').run(id);
  },

  getWeekRota(startDate) {
    const end = new Date(startDate);
    end.setDate(end.getDate() + 6);
    return this.getShifts({ dateFrom: startDate, dateTo: end.toISOString().split('T')[0] });
  },

  // ---- Audit Log ----

  getAuditTrail({ staffId, dateFrom, dateTo, limit = 50 } = {}) {
    const db = getDb();
    let sql = `
      SELECT t.id, t.created_at, t.total_amount, t.payment_method,
        s.first_name || ' ' || s.last_name as staff_name,
        m.first_name || ' ' || m.last_name as member_name,
        t.notes
      FROM transactions t
      LEFT JOIN staff s ON t.staff_id = s.id
      LEFT JOIN members m ON t.member_id = m.id
      WHERE 1=1
    `;
    const params = {};
    if (staffId) { sql += ' AND t.staff_id = @staffId'; params.staffId = staffId; }
    if (dateFrom) { sql += ' AND t.created_at >= @dateFrom'; params.dateFrom = dateFrom; }
    if (dateTo) { sql += ' AND t.created_at <= @dateTo'; params.dateTo = dateTo; }
    sql += ' ORDER BY t.created_at DESC LIMIT @limit';
    params.limit = limit;
    return db.prepare(sql).all(params);
  },
};

module.exports = Staff;
