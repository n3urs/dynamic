-- Crux Gym Management Schema
-- SQLite

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ============================================================
-- MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,                    -- UUID
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  date_of_birth TEXT,                     -- ISO date YYYY-MM-DD
  gender TEXT,                            -- male/female/other/prefer_not_to_say
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  region TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'United Kingdom',
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  medical_conditions TEXT,                -- freeform text
  climbing_experience TEXT,               -- new/few_times/regular
  member_of_other_walls TEXT,
  climbs_past_12_months TEXT,
  photo_id_consent INTEGER DEFAULT 0,     -- for minors: parent consented to photo ID
  notes TEXT,                             -- staff freeform notes
  qr_code TEXT,                           -- unique QR identifier string
  is_minor INTEGER DEFAULT 0,            -- 1 if under 18
  registration_fee_paid INTEGER DEFAULT 0, -- 1 = paid £3, 0 = not yet
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_name ON members(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_members_qr ON members(qr_code);

-- ============================================================
-- FAMILY LINKS
-- ============================================================

CREATE TABLE IF NOT EXISTS family_links (
  id TEXT PRIMARY KEY,
  parent_member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  child_member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'parent',     -- parent/guardian
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(parent_member_id, child_member_id)
);

-- ============================================================
-- CERTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS certification_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,              -- e.g. 'Belay Competency', 'Lead Climbing'
  description TEXT,
  expires_after_days INTEGER,             -- NULL = never expires
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS member_certifications (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  certification_type_id TEXT NOT NULL REFERENCES certification_types(id),
  granted_at TEXT DEFAULT (datetime('now')),
  granted_by TEXT,                        -- staff member name or ID
  expires_at TEXT,                        -- NULL if cert type doesn't expire
  notes TEXT,
  UNIQUE(member_id, certification_type_id)
);

-- ============================================================
-- TAGS
-- ============================================================

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,              -- e.g. 'Competition Team', 'At Risk'
  colour TEXT DEFAULT '#3B82F6',          -- hex colour for display
  is_automated INTEGER DEFAULT 0,        -- 1 if system-managed
  auto_rule TEXT,                         -- JSON rule definition for automated tags
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS member_tags (
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  applied_at TEXT DEFAULT (datetime('now')),
  applied_by TEXT,                        -- 'system' or staff name
  PRIMARY KEY (member_id, tag_id)
);

-- ============================================================
-- STAFF COMMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS staff_comments (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  staff_name TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_staff_comments_member ON staff_comments(member_id);

-- ============================================================
-- WAIVERS
-- ============================================================

CREATE TABLE IF NOT EXISTS waiver_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                     -- 'Adult Acknowledgement of Risk', 'Minor Acknowledgement of Risk'
  type TEXT NOT NULL,                     -- 'adult' or 'minor'
  content_json TEXT NOT NULL,             -- full form structure as JSON
  video_url TEXT,                         -- YouTube induction video URL
  expires_after_days INTEGER DEFAULT 365, -- waiver validity period
  is_active INTEGER DEFAULT 1,
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS signed_waivers (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  waiver_template_id TEXT NOT NULL REFERENCES waiver_templates(id),
  template_version INTEGER NOT NULL,
  form_data_json TEXT NOT NULL,           -- all answers, checkboxes, climber details
  signature_supervisee TEXT,              -- base64 signature image (parent/guardian for minor)
  signature_dependent TEXT,               -- base64 signature image (minor themselves, NULL for adults)
  video_watched INTEGER DEFAULT 0,
  signed_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,                        -- calculated from template expires_after_days
  ip_address TEXT,
  dependents_json TEXT                    -- JSON array of minor details [{first_name, last_name, dob, gender}]
);

CREATE INDEX IF NOT EXISTS idx_signed_waivers_member ON signed_waivers(member_id);

-- ============================================================
-- PASSES & MEMBERSHIPS
-- ============================================================

CREATE TABLE IF NOT EXISTS pass_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                     -- e.g. 'Adult Peak Single Entry', 'Adult Monthly DD'
  category TEXT NOT NULL,                 -- 'single_entry', 'multi_visit', 'monthly_pass', 'membership_dd'
  price_peak REAL,
  price_off_peak REAL,
  visits_included INTEGER,               -- NULL for unlimited, number for multi-visit
  duration_days INTEGER,                  -- validity period (30 for monthly, 365 for annual, NULL for single)
  is_recurring INTEGER DEFAULT 0,        -- 1 for GoCardless direct debit memberships
  recurring_interval TEXT,                -- 'monthly' or 'annual'
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS member_passes (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  pass_type_id TEXT NOT NULL REFERENCES pass_types(id),
  status TEXT DEFAULT 'active',           -- active/paused/expired/cancelled
  is_peak INTEGER DEFAULT 1,             -- 1=peak, 0=off-peak
  price_paid REAL NOT NULL,
  visits_remaining INTEGER,              -- for multi-visit passes, NULL for unlimited
  started_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,
  paused_at TEXT,
  pause_reason TEXT,
  cancelled_at TEXT,
  cancel_reason TEXT,
  gocardless_subscription_id TEXT,       -- GoCardless subscription reference for DD memberships
  gocardless_mandate_id TEXT,            -- GoCardless mandate reference
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_member_passes_member ON member_passes(member_id);
CREATE INDEX IF NOT EXISTS idx_member_passes_status ON member_passes(status);

-- ============================================================
-- CHECK-INS
-- ============================================================

CREATE TABLE IF NOT EXISTS check_ins (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  member_pass_id TEXT REFERENCES member_passes(id),
  checked_in_at TEXT DEFAULT (datetime('now')),
  checked_in_by TEXT,                    -- staff name or 'qr_self' for QR scan
  method TEXT DEFAULT 'desk',            -- 'desk', 'qr_scan'
  is_peak INTEGER DEFAULT 1,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_check_ins_date ON check_ins(checked_in_at);
CREATE INDEX IF NOT EXISTS idx_check_ins_member ON check_ins(member_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_member_date ON check_ins(member_id, checked_in_at DESC);

-- ============================================================
-- PRODUCTS & INVENTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS product_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,             -- 'Cold Drinks', 'Day Entry', etc.
  icon TEXT,                              -- emoji or icon identifier
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES product_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  cost_price REAL,                       -- supply price for margin calculations
  stock_count INTEGER,                   -- NULL = not stock tracked
  stock_low_threshold INTEGER,           -- alert when stock drops below this
  stock_enforce_limit INTEGER DEFAULT 0, -- 1 = prevent sale when out of stock
  requires_certification_id TEXT REFERENCES certification_types(id),
  linked_pass_type_id TEXT REFERENCES pass_types(id),  -- smart product: auto-issue this pass
  product_code TEXT,                       -- e.g. C-00001, EVT-0001
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- ============================================================
-- TRANSACTIONS & PAYMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES members(id),  -- NULL for anonymous walk-in sales
  staff_id TEXT REFERENCES staff(id),
  total_amount REAL NOT NULL,
  payment_method TEXT NOT NULL,           -- 'dojo_card', 'gocardless_dd', 'gift_card', 'free'
  payment_status TEXT DEFAULT 'completed', -- 'completed', 'pending', 'failed', 'refunded'
  payment_reference TEXT,                 -- Dojo/GoCardless transaction reference
  receipt_sent INTEGER DEFAULT 0,         -- 1 if email receipt sent
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transaction_items (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  description TEXT NOT NULL,             -- product name or custom description
  quantity INTEGER DEFAULT 1,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_member ON transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_transactions_member_date ON transactions(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_items_txn ON transaction_items(transaction_id);

-- ============================================================
-- GIFT CARDS
-- ============================================================

CREATE TABLE IF NOT EXISTS gift_cards (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,             -- unique redemption code
  initial_balance REAL NOT NULL,
  current_balance REAL NOT NULL,
  purchased_by_member_id TEXT REFERENCES members(id),
  purchased_transaction_id TEXT REFERENCES transactions(id),
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gift_card_transactions (
  id TEXT PRIMARY KEY,
  gift_card_id TEXT NOT NULL REFERENCES gift_cards(id),
  transaction_id TEXT REFERENCES transactions(id),
  amount REAL NOT NULL,                  -- negative for redemptions, positive for loads
  balance_after REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- EVENTS & COURSES
-- ============================================================

CREATE TABLE IF NOT EXISTS event_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  capacity INTEGER,
  price REAL DEFAULT 0,
  tags TEXT,                             -- comma-separated: 'kids,competition,social'
  requires_certification_id TEXT REFERENCES certification_types(id),
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  template_id TEXT REFERENCES event_templates(id),
  name TEXT NOT NULL,
  description TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  capacity INTEGER,
  current_enrolment INTEGER DEFAULT 0,
  price REAL DEFAULT 0,
  min_participants INTEGER,              -- auto-cancel threshold
  auto_cancel_deadline TEXT,             -- datetime: cancel if min not met by this time
  status TEXT DEFAULT 'scheduled',       -- scheduled/cancelled/completed
  cancel_reason TEXT,
  course_id TEXT REFERENCES courses(id), -- NULL if standalone event
  external_organiser TEXT,               -- third party organiser name
  confirmation_email_template TEXT,      -- custom email content
  tags TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  total_sessions INTEGER,
  price REAL NOT NULL,                   -- single fee for whole course
  capacity INTEGER,
  allows_late_join INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',          -- active/completed/cancelled
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_enrolments (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  status TEXT DEFAULT 'enrolled',        -- enrolled/waitlisted/cancelled/attended/no_show
  price_paid REAL,
  transaction_id TEXT REFERENCES transactions(id),
  enrolled_at TEXT DEFAULT (datetime('now')),
  attended_at TEXT,
  cancelled_at TEXT,
  UNIQUE(event_id, member_id)
);

CREATE TABLE IF NOT EXISTS course_enrolments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  status TEXT DEFAULT 'enrolled',
  price_paid REAL,
  transaction_id TEXT REFERENCES transactions(id),
  enrolled_at TEXT DEFAULT (datetime('now')),
  UNIQUE(course_id, member_id)
);

-- ============================================================
-- SLOT BOOKER
-- ============================================================

CREATE TABLE IF NOT EXISTS slot_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  capacity INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  price REAL DEFAULT 0,                  -- 0 = free slot
  recurrence_pattern TEXT,               -- JSON: days of week, times, etc.
  advance_booking_days INTEGER DEFAULT 7,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  template_id TEXT REFERENCES slot_templates(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  booked_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',            -- open/full/cancelled
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS slot_bookings (
  id TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL REFERENCES slots(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  status TEXT DEFAULT 'booked',          -- booked/cancelled/no_show/attended
  price_paid REAL DEFAULT 0,
  transaction_id TEXT REFERENCES transactions(id),
  booked_at TEXT DEFAULT (datetime('now')),
  cancelled_at TEXT,
  UNIQUE(slot_id, member_id)
);

-- ============================================================
-- STAFF ROTA
-- ============================================================

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  role TEXT DEFAULT 'centre_assistant',   -- centre_assistant/duty_manager/setter/tech_lead/owner
  pin_hash TEXT,                         -- hashed PIN for quick login
  password_hash TEXT,                    -- hashed password for full login
  permissions_json TEXT,                 -- JSON object of granular permissions
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff_shifts (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id),
  shift_date TEXT NOT NULL,              -- ISO date
  start_time TEXT NOT NULL,              -- HH:MM
  end_time TEXT NOT NULL,                -- HH:MM
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_date ON staff_shifts(shift_date);

-- ============================================================
-- ROUTESETTING
-- ============================================================

CREATE TABLE IF NOT EXISTS walls (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                    -- 'Cove Wall', 'Mothership', 'Magical Mystery'
  colour TEXT,                           -- display colour for gym map
  description TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS climbs (
  id TEXT PRIMARY KEY,
  wall_id TEXT NOT NULL REFERENCES walls(id),
  grade TEXT NOT NULL,                   -- 'VB', 'V0', 'V1', ... 'V9'
  colour TEXT NOT NULL,                  -- hold colour: 'Black', 'Yellow', 'Green', 'Purple', 'Mint', 'Red'
  setter TEXT,                           -- name of routesetter
  style_tags TEXT,                       -- comma-separated: 'crimpy,overhang,dynamic'
  date_set TEXT,
  date_strip_planned TEXT,               -- when it's planned to come down
  date_stripped TEXT,                     -- when it was actually stripped
  status TEXT DEFAULT 'active',          -- active/stripped/archived
  notes TEXT,
  snippet_video_path TEXT,               -- local file path to short video clip
  nfc_tag_id TEXT,                       -- TapTag NFC identifier
  map_x REAL,                            -- X position on gym map SVG
  map_y REAL,                            -- Y position on gym map SVG
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_climbs_wall ON climbs(wall_id);
CREATE INDEX IF NOT EXISTS idx_climbs_status ON climbs(status);
CREATE INDEX IF NOT EXISTS idx_climbs_grade ON climbs(grade);

CREATE TABLE IF NOT EXISTS climb_logs (
  id TEXT PRIMARY KEY,
  climb_id TEXT NOT NULL REFERENCES climbs(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  attempts INTEGER DEFAULT 1,
  sent INTEGER DEFAULT 0,               -- 1 = completed/sent
  logged_at TEXT DEFAULT (datetime('now')),
  logged_via TEXT DEFAULT 'desk',        -- 'desk', 'kiosk', 'nfc_tap'
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_climb_logs_member ON climb_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_climb_logs_climb ON climb_logs(climb_id);

CREATE TABLE IF NOT EXISTS climb_feedback (
  id TEXT PRIMARY KEY,
  climb_id TEXT NOT NULL REFERENCES climbs(id),
  member_id TEXT REFERENCES members(id),
  rating INTEGER,                        -- 1-5 stars
  grade_opinion TEXT,                    -- 'soft', 'accurate', 'hard'
  comment TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hold_inventory (
  id TEXT PRIMARY KEY,
  brand TEXT,
  type TEXT,                             -- 'crimp', 'jug', 'sloper', 'pinch', 'volume', etc.
  colour TEXT,
  quantity INTEGER DEFAULT 0,
  condition TEXT DEFAULT 'good',         -- good/worn/retired
  storage_location TEXT,
  in_use_count INTEGER DEFAULT 0,        -- how many currently on walls
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- COMPETITIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS competitions (
  id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES events(id),   -- linked to an event
  name TEXT NOT NULL,
  format TEXT NOT NULL,                  -- 'points', 'tops_zones', 'circuit'
  scoring_rules_json TEXT,               -- JSON scoring config
  status TEXT DEFAULT 'upcoming',        -- upcoming/active/completed
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS competition_entries (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  category TEXT,                         -- age/gender category if applicable
  total_score REAL DEFAULT 0,
  rank INTEGER,
  registered_at TEXT DEFAULT (datetime('now')),
  UNIQUE(competition_id, member_id)
);

CREATE TABLE IF NOT EXISTS competition_scores (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id),
  entry_id TEXT NOT NULL REFERENCES competition_entries(id),
  climb_id TEXT REFERENCES climbs(id),
  score REAL DEFAULT 0,
  topped INTEGER DEFAULT 0,
  zones INTEGER DEFAULT 0,
  attempts_to_top INTEGER,
  attempts_to_zone INTEGER,
  scored_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- GOCARDLESS TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS gocardless_events (
  id TEXT PRIMARY KEY,
  member_pass_id TEXT REFERENCES member_passes(id),
  member_id TEXT REFERENCES members(id),
  event_type TEXT NOT NULL,              -- 'payment_created', 'payment_confirmed', 'payment_failed', 'mandate_created', 'mandate_cancelled', etc.
  gocardless_id TEXT,                    -- GoCardless event/payment/mandate ID
  amount REAL,
  status TEXT,
  failure_reason TEXT,
  raw_json TEXT,                         -- full webhook payload for debugging
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gc_events_member ON gocardless_events(member_id);

-- ============================================================
-- SYSTEM / SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('gym_name', 'My Gym'),
  ('peak_description', 'Monday-Sunday anytime'),
  ('off_peak_description', 'Monday-Friday 10am-4pm'),
  ('currency', 'GBP'),
  ('currency_symbol', '£'),
  ('first_time_registration_fee', '3.00'),
  ('shoe_rental_price', '3.50'),
  ('email_smtp_host', 'smtp.gmail.com'),
  ('email_smtp_port', '587'),
  ('email_from', ''),
  ('email_smtp_user', ''),
  ('email_smtp_pass', ''),
  ('gocardless_access_token', ''),
  ('gocardless_environment', 'sandbox'),
  ('dojo_api_key', ''),
  ('dojo_terminal_id', ''),
  ('waiver_video_url', 'https://www.youtube.com/watch?v=-r2zbi21aks');

-- Default walls
INSERT OR IGNORE INTO walls (id, name, colour, description, sort_order) VALUES
  ('wall_cove', 'Cove Wall', '#0EA5E9', 'Left wall — also Competition Wall', 1),
  ('wall_mothership', 'Mothership', '#EAB308', 'Centre island — routes all the way around', 2),
  ('wall_mystery', 'Magical Mystery', '#EF4444', 'Right wall', 3);

-- Default product categories (matching Beta)
INSERT OR IGNORE INTO product_categories (id, name, icon, sort_order) VALUES
  ('cat_cold_drinks', 'Cold Drinks', '🥤', 1),
  ('cat_day_entry', 'Day Entry', '🎟️', 2),
  ('cat_events', 'Events', '🎪', 3),
  ('cat_food', 'Food', '🍕', 4),
  ('cat_hire', 'Hire', '👟', 5),
  ('cat_hot_drinks', 'Hot Drinks', '☕', 6),
  ('cat_membership', 'Membership', '💳', 7),
  ('cat_prepaid', 'Prepaid', '🎫', 8),
  ('cat_products', 'Products', '🧗', 9);
