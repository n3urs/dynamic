const router = require('express').Router();
const Member = require('../main/models/member');
const Waiver = require('../main/models/waiver');
const { getDb } = require('../main/database/db');

router.post('/register', (req, res, next) => {
  try {
    const body = req.body;

    // Validate required fields
    const required = ['first_name', 'last_name', 'email', 'phone', 'date_of_birth',
      'emergency_contact_name', 'emergency_contact_phone'];
    for (const field of required) {
      if (!body[field]) {
        return res.status(400).json({ error: `${field} is required` });
      }
    }

    // Check for existing member with same email
    const existing = Member.getByEmail(body.email);
    if (existing) {
      return res.status(400).json({ error: 'A member with this email already exists. Please speak to staff at the front desk.' });
    }

    // Create member
    const memberData = {
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      phone: body.phone,
      date_of_birth: body.date_of_birth,
      gender: body.gender || null,
      address_line1: body.address_line1 || null,
      address_line2: body.address_line2 || null,
      city: body.city || null,
      region: body.region || null,
      postal_code: body.postal_code || null,
      country: 'United Kingdom',
      emergency_contact_name: body.emergency_contact_name,
      emergency_contact_phone: body.emergency_contact_phone,
      medical_conditions: body.medical_conditions || null,
      climbing_experience: body.climbing_experience || null,
      member_of_other_walls: body.member_of_other_walls || null,
      climbs_past_12_months: body.climbs_past_12_months || null,
      photo_id_consent: body.photo_id_consent ? 1 : 0,
      is_minor: body.is_minor ? 1 : 0,
      notes: body.is_minor ? 'Registered as minor via public form' : 'Registered via public form',
    };

    const member = Member.create(memberData);

    // Get correct waiver template
    const waiverType = body.is_minor ? 'minor' : 'adult';
    const template = Waiver.getActiveTemplate(waiverType);
    if (!template) {
      return res.status(500).json({ error: 'No active waiver template found' });
    }

    // Sign the waiver
    const waiverData = {
      member_id: member.id,
      waiver_template_id: template.id,
      form_data: body.form_data || {},
      signature_supervisee: body.signature || null,
      signature_dependent: body.parent_signature || null,
      video_watched: true,
      dependents: body.dependents || null,
    };

    Waiver.sign(waiverData);

    // If minor, create dependent members and family links
    if (body.is_minor && body.dependents && body.dependents.length > 0) {
      for (const dep of body.dependents) {
        if (dep.first_name && dep.last_name) {
          const child = Member.create({
            first_name: dep.first_name,
            last_name: dep.last_name,
            date_of_birth: dep.date_of_birth || null,
            gender: dep.gender || null,
            is_minor: 1,
            emergency_contact_name: body.first_name + ' ' + body.last_name,
            emergency_contact_phone: body.phone,
            notes: 'Minor - registered by parent/guardian via public form',
          });
          Member.addFamilyLink(member.id, child.id, 'parent');
        }
      }
    }

    // Send welcome + QR emails in background (don't block response)
    if (member.email) {
      try {
        const emailService = require('../main/services/email');
        emailService.sendWelcomeEmail(member).catch(err => {
          console.error('Failed to send welcome email:', err.message);
        });
      } catch (e) { console.error('Email service error:', e.message); }
      Member.sendQrEmail(member.id).catch(err => {
        console.error('Failed to send QR email:', err.message);
      });

      // Send member portal invite
      try {
        const nodemailer = require('nodemailer');
        const SMTP_USER = process.env.SMTP_USER || 'cruxgymhq@gmail.com';
        const SMTP_PASS = process.env.SMTP_PASS || 'tzrhwxyfpjgnfraz';
        const SMTP_FROM = process.env.SMTP_FROM || 'Crux <hello@cruxgym.co.uk>';
        const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: SMTP_USER, pass: SMTP_PASS } });
        const gymSettings = getDb().prepare("SELECT value FROM settings WHERE key = 'gym_name'").get();
        const gymName = gymSettings?.value || 'the gym';
        const host = req.get('host') || 'localhost:8080';
        const protocol = req.protocol || 'https';
        const portalUrl = `${protocol}://${host}/me`;
        transporter.sendMail({
          from: SMTP_FROM,
          to: member.email,
          subject: `Your ${gymName} member portal`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff">
              <h2 style="color:#1E3A5F;margin:0 0 8px">Hi ${member.first_name},</h2>
              <p style="color:#6B7280;margin:0 0 24px">Welcome to ${gymName}! You now have access to your personal member portal. Log in to see your QR check-in code, track your climbs on the wall map, and read gym updates.</p>
              <a href="${portalUrl}" style="display:inline-block;background:#1E3A5F;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;margin:0 0 24px">Open Member Portal</a>
              <p style="color:#9CA3AF;font-size:13px;margin:0">Use your email address (${member.email}) to log in — we'll send you a code each time.</p>
            </div>
          `,
        }).catch(err => console.warn('[register] portal invite failed:', err.message));
      } catch (err) {
        console.warn('[register] portal invite error:', err.message);
      }
    }

    res.json({
      success: true,
      member: {
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        qr_code: member.qr_code,
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    next(err);
  }
});

module.exports = router;
