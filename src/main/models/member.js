/**
 * Member model — CRUD operations for climber profiles
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');

const Member = {
  /**
   * Create a new member
   */
  create(data) {
    const db = getDb();
    const id = uuidv4();
    const qrCode = `BR-${id.split('-')[0].toUpperCase()}`;

    const stmt = db.prepare(`
      INSERT INTO members (
        id, first_name, last_name, email, phone, date_of_birth, gender,
        address_line1, address_line2, city, region, postal_code, country,
        emergency_contact_name, emergency_contact_phone,
        medical_conditions, climbing_experience, member_of_other_walls,
        climbs_past_12_months, photo_id_consent, notes, qr_code, is_minor
      ) VALUES (
        @id, @first_name, @last_name, @email, @phone, @date_of_birth, @gender,
        @address_line1, @address_line2, @city, @region, @postal_code, @country,
        @emergency_contact_name, @emergency_contact_phone,
        @medical_conditions, @climbing_experience, @member_of_other_walls,
        @climbs_past_12_months, @photo_id_consent, @notes, @qr_code, @is_minor
      )
    `);

    stmt.run({
      id,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email || null,
      phone: data.phone || null,
      date_of_birth: data.date_of_birth || null,
      gender: data.gender || null,
      address_line1: data.address_line1 || null,
      address_line2: data.address_line2 || null,
      city: data.city || null,
      region: data.region || null,
      postal_code: data.postal_code || null,
      country: data.country || 'United Kingdom',
      emergency_contact_name: data.emergency_contact_name || null,
      emergency_contact_phone: data.emergency_contact_phone || null,
      medical_conditions: data.medical_conditions || null,
      climbing_experience: data.climbing_experience || null,
      member_of_other_walls: data.member_of_other_walls || null,
      climbs_past_12_months: data.climbs_past_12_months || null,
      photo_id_consent: data.photo_id_consent || 0,
      notes: data.notes || null,
      qr_code: qrCode,
      is_minor: data.is_minor || 0,
    });

    return this.getById(id);
  },

  /**
   * Get member by ID
   */
  getById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  },

  /**
   * Get member by QR code
   */
  getByQrCode(qrCode) {
    const db = getDb();
    return db.prepare('SELECT * FROM members WHERE qr_code = ?').get(qrCode);
  },

  /**
   * Get member by email
   */
  getByEmail(email) {
    const db = getDb();
    return db.prepare('SELECT * FROM members WHERE email = ?').get(email);
  },

  /**
   * Search members by name, email, or phone
   */
  search(query, limit = 20) {
    const db = getDb();
    const searchTerm = `%${query}%`;
    return db.prepare(`
      SELECT * FROM members
      WHERE first_name LIKE @q OR last_name LIKE @q OR email LIKE @q OR phone LIKE @q
        OR (first_name || ' ' || last_name) LIKE @q
      ORDER BY last_name, first_name
      LIMIT @limit
    `).all({ q: searchTerm, limit });
  },

  /**
   * Update member
   */
  update(id, data) {
    const db = getDb();
    const existing = this.getById(id);
    if (!existing) throw new Error(`Member ${id} not found`);

    const fields = [
      'first_name', 'middle_name', 'last_name', 'email', 'phone', 'date_of_birth', 'gender',
      'address_line1', 'address_line2', 'city', 'region', 'postal_code', 'country',
      'emergency_contact_name', 'emergency_contact_phone',
      'medical_conditions', 'climbing_experience', 'member_of_other_walls',
      'climbs_past_12_months', 'photo_id_consent', 'notes', 'is_minor',
      'has_warning', 'warning_note', 'photo_url'
    ];

    const updates = [];
    const params = { id };

    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = @${field}`);
        params[field] = data[field];
      }
    }

    if (updates.length === 0) return existing;

    updates.push("updated_at = datetime('now')");

    db.prepare(`UPDATE members SET ${updates.join(', ')} WHERE id = @id`).run(params);
    return this.getById(id);
  },

  /**
   * Delete member (soft delete would be better in production, but hard delete for now)
   */
  delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM members WHERE id = ?').run(id);
  },

  /**
   * List all members with pagination
   */
  list({ page = 1, perPage = 50, orderBy = 'last_name', order = 'ASC' } = {}) {
    const db = getDb();
    const offset = (page - 1) * perPage;
    const validColumns = ['first_name', 'last_name', 'email', 'created_at'];
    const col = validColumns.includes(orderBy) ? orderBy : 'last_name';
    const dir = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const members = db.prepare(`
      SELECT * FROM members ORDER BY ${col} ${dir} LIMIT @perPage OFFSET @offset
    `).all({ perPage, offset });

    const total = db.prepare('SELECT count(*) as count FROM members').get().count;

    return { members, total, page, perPage, totalPages: Math.ceil(total / perPage) };
  },

  /**
   * Get member count
   */
  count() {
    const db = getDb();
    return db.prepare('SELECT count(*) as count FROM members').get().count;
  },

  /**
   * Get member with active pass status
   */
  getWithPassStatus(id) {
    const db = getDb();
    const member = this.getById(id);
    if (!member) return null;

    const activePass = db.prepare(`
      SELECT mp.*, pt.name as pass_name, pt.category
      FROM member_passes mp
      JOIN pass_types pt ON mp.pass_type_id = pt.id
      WHERE mp.member_id = ? AND mp.status = 'active'
        AND (mp.expires_at IS NULL OR mp.expires_at > datetime('now'))
        AND (mp.visits_remaining IS NULL OR mp.visits_remaining > 0)
      ORDER BY mp.created_at DESC
      LIMIT 1
    `).get(id);

    const latestWaiver = db.prepare(`
      SELECT sw.*, wt.name as waiver_name
      FROM signed_waivers sw
      JOIN waiver_templates wt ON sw.waiver_template_id = wt.id
      WHERE sw.member_id = ?
      ORDER BY sw.signed_at DESC
      LIMIT 1
    `).get(id);

    const waiverValid = latestWaiver && (!latestWaiver.expires_at ||
      new Date(latestWaiver.expires_at) > new Date());

    const certifications = db.prepare(`
      SELECT mc.*, ct.name as cert_name
      FROM member_certifications mc
      JOIN certification_types ct ON mc.certification_type_id = ct.id
      WHERE mc.member_id = ?
        AND (mc.expires_at IS NULL OR mc.expires_at > datetime('now'))
    `).all(id);

    const tags = db.prepare(`
      SELECT t.*, mt.note as member_note, mt.expires_at as tag_expires_at, mt.applied_at, mt.applied_by
      FROM member_tags mt
      JOIN tags t ON mt.tag_id = t.id
      WHERE mt.member_id = ?
      ORDER BY mt.applied_at DESC
    `).all(id);

    const todayCheckIn = db.prepare(`
      SELECT * FROM check_ins
      WHERE member_id = ? AND date(checked_in_at) = date('now')
      ORDER BY checked_in_at DESC LIMIT 1
    `).get(id);

    return {
      ...member,
      active_pass: activePass || null,
      has_valid_pass: !!activePass,
      latest_waiver: latestWaiver || null,
      waiver_valid: waiverValid,
      certifications,
      tags,
      checked_in_today: !!todayCheckIn,
      today_check_in: todayCheckIn || null,
    };
  },

  /**
   * Add family link
   */
  addFamilyLink(parentId, childId, relationship = 'parent') {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT OR IGNORE INTO family_links (id, parent_member_id, child_member_id, relationship)
      VALUES (?, ?, ?, ?)
    `).run(id, parentId, childId, relationship);
    return id;
  },

  /**
   * Get family members
   */
  getFamily(memberId) {
    const db = getDb();
    const children = db.prepare(`
      SELECT m.* FROM members m
      JOIN family_links fl ON fl.child_member_id = m.id
      WHERE fl.parent_member_id = ?
    `).all(memberId);

    const parents = db.prepare(`
      SELECT m.* FROM members m
      JOIN family_links fl ON fl.parent_member_id = m.id
      WHERE fl.child_member_id = ?
    `).all(memberId);

    return { children, parents };
  },

  /**
   * Re-send QR code email to member
   */
  async sendQrEmail(id) {
    const member = this.getById(id);
    if (!member || !member.email) {
      throw new Error('Member not found or no email address');
    }

    const QRCode = require('qrcode');
    const nodemailer = require('nodemailer');
    const db = getDb();

    // Get email settings
    const getSetting = (key) => {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      return row ? row.value : '';
    };

    const smtpUser = getSetting('email_smtp_user');
    const smtpPass = getSetting('email_smtp_pass');

    if (!smtpUser || !smtpPass) {
      throw new Error('Email not configured. Set SMTP credentials in settings.');
    }

    // Generate QR code as buffer
    const qrBuffer = await QRCode.toBuffer(member.qr_code, {
      width: 400,
      margin: 2,
      color: { dark: '#1E3A5F', light: '#FFFFFF' }
    });

    // Send email
    const transporter = nodemailer.createTransport({
      host: getSetting('email_smtp_host') || 'smtp.gmail.com',
      port: parseInt(getSetting('email_smtp_port') || '587'),
      secure: false,
      auth: { user: smtpUser, pass: smtpPass }
    });

    await transporter.sendMail({
      from: getSetting('email_from') || smtpUser,
      to: member.email,
      subject: `Your BoulderRyn Membership QR Code`,
      text: `Hi ${member.first_name},\n\nHere's your BoulderRyn QR code. Save this image to your phone and show it at the desk when you check in.\n\nYour code: ${member.qr_code}\n\nSee you on the wall!\nBoulderRyn`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #1E3A5F;">BoulderRyn</h2>
          <p>Hi ${member.first_name},</p>
          <p>Here's your BoulderRyn QR code. Save this image to your phone and show it at the desk when you check in.</p>
          <p style="text-align: center; margin: 24px 0;">
            <img src="cid:qrcode" alt="QR Code" style="width: 250px; height: 250px;" />
          </p>
          <p style="text-align: center; color: #666; font-size: 14px;">Code: ${member.qr_code}</p>
          <p>See you on the wall!<br/>BoulderRyn</p>
        </div>
      `,
      attachments: [
        {
          filename: 'boulderryn-qr.png',
          content: qrBuffer,
          cid: 'qrcode'
        },
        {
          filename: 'boulderryn-qr.png',
          content: qrBuffer
        }
      ]
    });

    return true;
  }
};

module.exports = Member;
