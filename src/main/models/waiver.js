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

    const gymNameRow = db.prepare("SELECT value FROM settings WHERE key = 'gym_name'").get();
    const gymName = (gymNameRow && gymNameRow.value) || 'the gym';

    // Adult form structure
    const adultContent = {
      sections: [
        {
          title: 'Participation Statement',
          type: 'text',
          content: 'All climbing and bouldering activities have a risk of serious injury or death. Participants must be aware of and accept that even if they follow all good practice there may still be the risk of accident and injury. It is the responsibility of the participant to adhere to the conditions of use.'
        },
        {
          title: 'Conditions of Use',
          type: 'text',
          subsections: ['General Safety', 'Bouldering', 'Climbers Aged 8-17', 'Supervising Declaration', 'Warm Up and Training Area', 'Photography', 'Matting Warning', 'Duty of Care']
        }
      ],
      climber_details: [
        { field: 'medical_conditions', label: 'Medical Requirements, If Any', type: 'text', required: true },
        { field: 'climbing_experience', label: 'Level of climbing Experience?', type: 'radio', options: ['New Climber', 'Climbed a few times', 'Regular Climber'], required: true },
        { field: 'other_walls', label: 'Are You A Member Of Any Other Walls? Which?', type: 'text', required: true },
        { field: 'climbs_12_months', label: 'Roughly, How Many Times Have You Climbed In The Past 12 Months?', type: 'text', required: true },
      ],
      confirmation_questions: [
        'Do you understand that failure to exercise due care, and follow the rules of the centre could result in injury or death?',
        'Have you watched the Induction Video?',
        'Have you fully read and understood the conditions of this Participation Agreement?',
        `Do you agree to abide by the rules and conditions set out in this document when using the facilities at ${gymName}?`,
        'Do you understand that the matting does not remove the risk of injury?',
        'Having watched the video, do you feel you know how to climb safely?',
        'Are you, the person filling out this form, over 18 years of age?',
        `Do you understand that failure to exercise due care, and follow the rules of the centre could result in you being asked to leave ${gymName}?`,
      ],
      final_checkboxes: [
        'I certify that to the best of my knowledge, I do not suffer from a medical condition that might have the effect of making it more likely that I will be involved in an accident that could result in injury to myself or others, OR I have discussed it with a duty manager and a risk assessment is in place.',
        'I confirm that the above information is correct and if any information changes I will notify the centre.',
        'I HAVE HAD SUFFICIENT OPPORTUNITY TO READ THIS ENTIRE DOCUMENT AND WATCH THE INDUCTION VIDEO. I HAVE UNDERSTOOD THE FORM AND VIDEO AND ACKNOWLEDGE I AM BOUND BY ITS TERMS',
      ],
      signatures_required: ['supervisee'],
    };

    // Minor form — same as adult plus extras
    const minorContent = {
      ...adultContent,
      additional_checkboxes: [
        `Under 18 Photo ID Consent — I confirm that I am the parent/legal guardian of the above-named child and I consent to ${gymName} taking and storing a photograph of my child for identification purposes at the reception desk only. I understand that this photograph will be used solely to help staff verify the child's identity and access rights, will be stored securely in line with data protection legislation, and will not be used for marketing or promotional purposes.`,
      ],
      signatures_required: ['supervisee', 'dependent'],
      requires_dependents: true,
      dependent_fields: [
        { field: 'first_name', label: 'First Name', type: 'text', required: true },
        { field: 'last_name', label: 'Last Name', type: 'text', required: true },
        { field: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
        { field: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other', 'Prefer not to say'] },
      ],
    };

    this.createTemplate({
      name: 'Adult Acknowledgement of Risk',
      type: 'adult',
      content: adultContent,
      video_url: 'https://www.youtube.com/watch?v=-r2zbi21aks',
      expires_after_days: 365,
    });

    this.createTemplate({
      name: 'Minor Acknowledgement of Risk',
      type: 'minor',
      content: minorContent,
      video_url: 'https://www.youtube.com/watch?v=-r2zbi21aks',
      expires_after_days: 365,
    });

    return 2;
  },
};

module.exports = Waiver;
