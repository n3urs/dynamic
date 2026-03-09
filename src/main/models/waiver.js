/**
 * Waiver model — templates, signing, validation
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');

const Waiver = {
  // ---- Templates ----

  createTemplate(data) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO waiver_templates (id, name, type, content_json, video_url, expires_after_days, is_active, version)
      VALUES (@id, @name, @type, @content_json, @video_url, @expires_after_days, 1, 1)
    `).run({
      id,
      name: data.name,
      type: data.type, // 'adult' or 'minor'
      content_json: JSON.stringify(data.content || {}),
      video_url: data.video_url || 'https://www.youtube.com/watch?v=-r2zbi21aks',
      expires_after_days: data.expires_after_days || 365,
    });
    return this.getTemplateById(id);
  },

  getTemplateById(id) {
    const t = getDb().prepare('SELECT * FROM waiver_templates WHERE id = ?').get(id);
    if (t) t.content = JSON.parse(t.content_json || '{}');
    return t;
  },

  getActiveTemplate(type) {
    const t = getDb().prepare('SELECT * FROM waiver_templates WHERE type = ? AND is_active = 1 ORDER BY version DESC LIMIT 1').get(type);
    if (t) t.content = JSON.parse(t.content_json || '{}');
    return t;
  },

  listTemplates() {
    return getDb().prepare('SELECT * FROM waiver_templates ORDER BY type, version DESC').all();
  },

  // ---- Signing ----

  sign(data) {
    const db = getDb();
    const template = this.getTemplateById(data.waiver_template_id);
    if (!template) throw new Error('Waiver template not found');

    const id = uuidv4();
    let expiresAt = null;
    if (template.expires_after_days) {
      const d = new Date();
      d.setDate(d.getDate() + template.expires_after_days);
      expiresAt = d.toISOString();
    }

    db.prepare(`
      INSERT INTO signed_waivers (id, member_id, waiver_template_id, template_version, form_data_json,
        signature_supervisee, signature_dependent, video_watched, expires_at, dependents_json)
      VALUES (@id, @member_id, @waiver_template_id, @template_version, @form_data_json,
        @signature_supervisee, @signature_dependent, @video_watched, @expires_at, @dependents_json)
    `).run({
      id,
      member_id: data.member_id,
      waiver_template_id: data.waiver_template_id,
      template_version: template.version,
      form_data_json: JSON.stringify(data.form_data || {}),
      signature_supervisee: data.signature_supervisee || null,
      signature_dependent: data.signature_dependent || null,
      video_watched: data.video_watched ? 1 : 0,
      expires_at: expiresAt,
      dependents_json: data.dependents ? JSON.stringify(data.dependents) : null,
    });

    return this.getSignedById(id);
  },

  getSignedById(id) {
    const w = getDb().prepare(`
      SELECT sw.*, wt.name as waiver_name, wt.type as waiver_type
      FROM signed_waivers sw
      JOIN waiver_templates wt ON sw.waiver_template_id = wt.id
      WHERE sw.id = ?
    `).get(id);
    if (w) {
      w.form_data = JSON.parse(w.form_data_json || '{}');
      w.dependents = w.dependents_json ? JSON.parse(w.dependents_json) : [];
    }
    return w;
  },

  /**
   * Get latest valid waiver for a member
   */
  getLatestValid(memberId) {
    const w = getDb().prepare(`
      SELECT sw.*, wt.name as waiver_name, wt.type as waiver_type
      FROM signed_waivers sw
      JOIN waiver_templates wt ON sw.waiver_template_id = wt.id
      WHERE sw.member_id = ?
        AND (sw.expires_at IS NULL OR sw.expires_at > datetime('now'))
      ORDER BY sw.signed_at DESC LIMIT 1
    `).get(memberId);
    if (w) {
      w.form_data = JSON.parse(w.form_data_json || '{}');
      w.dependents = w.dependents_json ? JSON.parse(w.dependents_json) : [];
    }
    return w;
  },

  /**
   * Check if member has valid waiver
   */
  isValid(memberId) {
    return !!this.getLatestValid(memberId);
  },

  /**
   * Get all signed waivers for a member
   */
  getMemberHistory(memberId) {
    return getDb().prepare(`
      SELECT sw.*, wt.name as waiver_name, wt.type as waiver_type
      FROM signed_waivers sw
      JOIN waiver_templates wt ON sw.waiver_template_id = wt.id
      WHERE sw.member_id = ?
      ORDER BY sw.signed_at DESC
    `).all(memberId);
  },

  /**
   * Get waivers expiring soon
   */
  getExpiringSoon(days = 30) {
    return getDb().prepare(`
      SELECT sw.*, wt.name as waiver_name, m.first_name, m.last_name, m.email
      FROM signed_waivers sw
      JOIN waiver_templates wt ON sw.waiver_template_id = wt.id
      JOIN members m ON sw.member_id = m.id
      WHERE sw.expires_at IS NOT NULL
        AND sw.expires_at > datetime('now')
        AND sw.expires_at <= datetime('now', '+' || ? || ' days')
        AND sw.id = (
          SELECT id FROM signed_waivers sw2
          WHERE sw2.member_id = sw.member_id
          ORDER BY sw2.signed_at DESC LIMIT 1
        )
      ORDER BY sw.expires_at ASC
    `).all(days);
  },

  /**
   * Seed default waiver templates
   */
  seedDefaults() {
    const db = getDb();
    const existing = db.prepare('SELECT count(*) as c FROM waiver_templates').get().c;
    if (existing > 0) return;

    // Blank templates — gym owner builds their own waiver during setup wizard
    const blankContent = {
      sections: [],
      include_minor_option: false,
      signatures_required: ['supervisee'],
    };

    this.createTemplate({
      name: 'Acknowledgement of Risk',
      type: 'adult',
      content: blankContent,
      video_url: '',
      expires_after_days: 365,
    });

    this.createTemplate({
      name: 'Minor Acknowledgement of Risk',
      type: 'minor',
      content: {
        ...blankContent,
        include_minor_option: true,
        signatures_required: ['supervisee', 'dependent'],
        requires_dependents: true,
        dependent_fields: [
          { field: 'first_name', label: 'First Name', type: 'text', required: true },
          { field: 'last_name', label: 'Last Name', type: 'text', required: true },
          { field: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
          { field: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other', 'Prefer not to say'] },
        ],
      },
      video_url: '',
      expires_after_days: 365,
    });

    return 2;
  },
};

module.exports = Waiver;
