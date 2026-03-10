/**
 * Member CSV import route
 *
 * POST /api/import/members — accepts multipart/form-data with a CSV file (field: "file")
 *
 * Accepts flexible column headers (case-insensitive) mapping to common gym software exports.
 * Skips rows with empty first_name, skips duplicate emails (INSERT OR IGNORE).
 * Returns: { ok: true, imported: N, skipped: N, errors: [...] }
 *
 * Requires staff auth (JWT) — protected by requireBilling middleware upstream.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../main/database/db');
const gymContext = require('../main/database/gymContext');

// In-memory storage — no files written to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.csv$/i)) {
      return cb(new Error('Only .csv files are accepted'));
    }
    cb(null, true);
  },
});

// ── Column header aliases (all lowercased, spaces/underscores normalised) ──

const COLUMN_MAP = {
  // First name
  'first name': 'first_name',
  'first_name': 'first_name',
  'firstname': 'first_name',
  'forename': 'first_name',
  'given name': 'first_name',
  'given_name': 'first_name',

  // Last name
  'last name': 'last_name',
  'last_name': 'last_name',
  'lastname': 'last_name',
  'surname': 'last_name',
  'family name': 'last_name',
  'family_name': 'last_name',

  // Email
  'email': 'email',
  'email address': 'email',
  'email_address': 'email',
  'e-mail': 'email',

  // Phone
  'phone': 'phone',
  'phone number': 'phone',
  'phone_number': 'phone',
  'mobile': 'phone',
  'mobile number': 'phone',
  'mobile_number': 'phone',
  'telephone': 'phone',
  'tel': 'phone',

  // Date of birth
  'date of birth': 'date_of_birth',
  'date_of_birth': 'date_of_birth',
  'dob': 'date_of_birth',
  'birthday': 'date_of_birth',
  'birth date': 'date_of_birth',
  'birth_date': 'date_of_birth',
  'dateofbirth': 'date_of_birth',

  // Gender
  'gender': 'gender',
  'sex': 'gender',

  // Address
  'address': 'address_line1',
  'address_line1': 'address_line1',
  'address line1': 'address_line1',
  'address line 1': 'address_line1',
  'street address': 'address_line1',
  'street_address': 'address_line1',
  'street': 'address_line1',

  // Address line 2
  'address_line2': 'address_line2',
  'address line2': 'address_line2',
  'address line 2': 'address_line2',

  // City
  'city': 'city',
  'town': 'city',
  'town/city': 'city',

  // Region / county
  'region': 'region',
  'county': 'region',
  'state': 'region',
  'province': 'region',

  // Postcode
  'postcode': 'postal_code',
  'postal_code': 'postal_code',
  'postal code': 'postal_code',
  'post code': 'postal_code',
  'zip': 'postal_code',
  'zip code': 'postal_code',
  'zip_code': 'postal_code',

  // Emergency contact
  'emergency contact': 'emergency_contact_name',
  'emergency_contact': 'emergency_contact_name',
  'emergency contact name': 'emergency_contact_name',
  'emergency_contact_name': 'emergency_contact_name',
  'emergency name': 'emergency_contact_name',

  // Emergency phone
  'emergency phone': 'emergency_contact_phone',
  'emergency_phone': 'emergency_contact_phone',
  'emergency contact phone': 'emergency_contact_phone',
  'emergency_contact_phone': 'emergency_contact_phone',
  'emergency number': 'emergency_contact_phone',
  'emergency contact number': 'emergency_contact_phone',

  // Medical
  'medical conditions': 'medical_conditions',
  'medical_conditions': 'medical_conditions',
  'medical notes': 'medical_conditions',
  'medical_notes': 'medical_conditions',
  'health notes': 'medical_conditions',
  'health_notes': 'medical_conditions',
  'medical': 'medical_conditions',

  // Notes
  'notes': 'notes',
  'staff notes': 'notes',
  'staff_notes': 'notes',
  'comments': 'notes',

  // Member since / join date → stored as member_since (display only, not created_at)
  'member since': 'member_since',
  'member_since': 'member_since',
  'join date': 'member_since',
  'join_date': 'member_since',
  'joined': 'member_since',
  'joined date': 'member_since',
  'created_at': 'member_since',
  'registration date': 'member_since',
  'registration_date': 'member_since',
};

// ── CSV parser (no external deps) ──────────────────────────────────────────

/**
 * Parse a CSV string into an array of row arrays.
 * Handles: quoted fields, escaped quotes (""), CRLF and LF line endings.
 */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const n = text.length;

  while (i < n) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ""
        if (i + 1 < n && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        row.push(field);
        field = '';
        i++;
      } else if (ch === '\r') {
        // CRLF or lone CR
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        i++;
        if (i < n && text[i] === '\n') i++; // skip \n after \r
      } else if (ch === '\n') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Trailing field / row
  if (field || row.length > 0) {
    row.push(field);
    if (row.some(f => f.trim() !== '')) rows.push(row);
  }

  return rows;
}

/**
 * Normalise a header string for lookup in COLUMN_MAP:
 * strip BOM, trim, lowercase, collapse multiple spaces.
 */
function normaliseHeader(h) {
  return h.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Parse a date string into ISO YYYY-MM-DD, or return null.
 * Handles: DD/MM/YYYY, MM/DD/YYYY (ambiguous — assumes DD/MM for UK),
 * YYYY-MM-DD, "1 Jan 1990", "January 1, 1990", etc.
 */
function parseDate(str) {
  if (!str || !str.trim()) return null;
  const s = str.trim();

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or D/M/YYYY (UK format, assumed)
  const dmyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const date = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    if (!isNaN(date.getTime())) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // MM-DD-YYYY
  const mdyDashMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mdyDashMatch) {
    const [, d, m, y] = mdyDashMatch;
    const date = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    if (!isNaN(date.getTime())) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Try native Date parse as last resort (handles "Jan 1, 1990" etc.)
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

// ── POST /api/import/members ───────────────────────────────────────────────

router.post('/members',
  // Capture gymId BEFORE multer processes the body (multer can lose AsyncLocalStorage context)
  (req, res, next) => { req._gymId = gymContext.getStore()?.gymId; next(); },
  upload.single('file'),
  (req, res) => {
  // Re-establish gym context in case multer lost it
  const runInContext = (fn) => {
    if (req._gymId) return gymContext.run({ gymId: req._gymId }, fn);
    return fn();
  };
  runInContext(() => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No file uploaded. Send a CSV as multipart field "file".' });
  }

  let text;
  try {
    text = req.file.buffer.toString('utf8');
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'Could not read file as UTF-8 text.' });
  }

  let rows;
  try {
    rows = parseCSV(text);
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'CSV parse error: ' + e.message });
  }

  if (rows.length < 2) {
    return res.status(400).json({ ok: false, error: 'CSV must have at least a header row and one data row.' });
  }

  // Map headers to internal field names
  const rawHeaders = rows[0];
  const fieldMap = rawHeaders.map(h => COLUMN_MAP[normaliseHeader(h)] || null);

  const db = getDb();

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO members (
      id, first_name, last_name, email, phone, date_of_birth, gender,
      address_line1, address_line2, city, region, postal_code, country,
      emergency_contact_name, emergency_contact_phone, medical_conditions,
      notes, qr_code, registration_fee_paid, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, 0, ?, ?
    )
  `);

  let imported = 0;
  let skipped = 0;
  const errors = [];

  // Process data rows (skip header row at index 0)
  for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
    const rawRow = rows[rowIdx];

    // Skip entirely blank rows
    if (rawRow.every(f => !f.trim())) continue;

    // Build a field object from the mapping
    const fields = {};
    for (let colIdx = 0; colIdx < fieldMap.length; colIdx++) {
      const key = fieldMap[colIdx];
      if (key) {
        fields[key] = (rawRow[colIdx] || '').trim();
      }
    }

    // Require at least a first name
    if (!fields.first_name) {
      skipped++;
      continue;
    }

    try {
      const id = uuidv4();
      const qrCode = `CX-${id.split('-')[0].toUpperCase()}`;

      // Parse date of birth
      const dob = parseDate(fields.date_of_birth) || null;

      // Determine created_at — use member_since if provided, else now
      let createdAt = null;
      if (fields.member_since) {
        const parsed = parseDate(fields.member_since);
        if (parsed) createdAt = parsed + 'T00:00:00.000Z';
      }
      if (!createdAt) createdAt = new Date().toISOString();

      const result = insertStmt.run(
        id,
        fields.first_name,
        fields.last_name || '',
        fields.email || null,
        fields.phone || null,
        dob,
        fields.gender || null,
        fields.address_line1 || null,
        fields.address_line2 || null,
        fields.city || null,
        fields.region || null,
        fields.postal_code || null,
        'United Kingdom',
        fields.emergency_contact_name || null,
        fields.emergency_contact_phone || null,
        fields.medical_conditions || null,
        fields.notes || null,
        qrCode,
        createdAt,
        createdAt,
      );

      if (result.changes > 0) {
        imported++;
      } else {
        // INSERT OR IGNORE silently skipped a duplicate
        skipped++;
      }
    } catch (err) {
      errors.push(`Row ${rowIdx + 1}: ${err.message}`);
      skipped++;
    }
  }

  res.json({ ok: true, imported, skipped, errors });
  }); // end runInContext
}); // end router.post

module.exports = router;
