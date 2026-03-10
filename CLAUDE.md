# CLAUDE.md — Crux Platform Context

Read this first. This is the full context for continuing work on the Crux gym management SaaS.

---

## What Is Crux?

Crux is a **multi-tenant SaaS platform** for climbing and bouldering gyms. Gyms pay a monthly subscription to access the platform. Each gym gets their own isolated subdomain (`gymname.cruxgym.co.uk`) and a completely separate SQLite database. There is no shared data between gyms.

**Business model:** Oscar (the platform owner) sells subscriptions to gym owners.
- Monthly: Starter £59/mo, Growth £99/mo, Scale £149/mo
- Annual (2 months free): Starter £49/mo, Growth £82/mo, Scale £124/mo
- 14-day free trial on signup. No credit card required to start.

**Target market:** UK climbing and bouldering gyms, specifically independent operators who can't afford or don't need bloated enterprise software.

---

## Tech Stack

- **Backend:** Node.js + Express.js
- **Database:** SQLite via `better-sqlite3` (one DB per gym + one platform DB)
- **Frontend:** Vanilla HTML/CSS/JS SPA (no framework), Tailwind CSS via CDN
- **Auth:** JWT for staff sessions, PIN-based login for staff at the desk. Member portal uses OTP (email code) → JWT.
- **Email:** Nodemailer via Gmail SMTP (`cruxgymhq@gmail.com`) — password in `/etc/crux.env` as `SMTP_PASS`
- **Payments (member-facing):** GoCardless (direct debit) + Dojo (in-person card) — placeholders/partial
- **Payments (platform billing):** Stripe — live with real API keys, checkout + webhook handler active
- **Hosting:** AWS EC2 (eu-west-1), served via nginx

---

## Repository Structure

```
boulderryn-project/          ← repo root (old name, rename pending)
├── server.js                ← main Express server entry point
├── scripts/
│   ├── provision-gym.js     ← CLI + exportable function to create a new gym
│   └── backup-dbs.sh        ← nightly DB backup script (run via cron)
├── src/
│   ├── main/
│   │   ├── database/
│   │   │   ├── db.js           ← per-gym DB connection (AsyncLocalStorage context)
│   │   │   ├── gymContext.js   ← gym context middleware
│   │   │   ├── init.js         ← DB initialisation + legacy migration
│   │   │   └── platformDb.js   ← global platform DB (billing records)
│   │   ├── models/
│   │   │   ├── member.js, waiver.js, staff.js, etc.
│   │   └── services/
│   │       └── email.js         ← member emails (QR codes, receipts)
│   ├── services/
│   │   └── welcomeEmail.js      ← new gym onboarding email
│   ├── middleware/
│   │   ├── requireAdmin.js      ← ADMIN_TOKEN check for /admin routes
│   │   └── requireBilling.js    ← subscription check (wired into all /api routes)
│   ├── routes/
│   │   ├── admin.js             ← super-admin panel API + /admin/stats
│   │   ├── billing.js           ← Stripe billing routes
│   │   ├── signup.js            ← self-serve gym signup + Stripe checkout creation
│   │   ├── me.js                ← member portal API (OTP auth, profile, map, logbook, noticeboard)
│   │   ├── register.js          ← public member registration + waiver submission
│   │   ├── export.js            ← GDPR data export (JSON + CSV)
│   │   ├── members.js, staff.js, pos.js, waivers.js, etc.
│   │   └── onboarding.js        ← onboarding status + dismiss
│   ├── config/
│   │   └── stripe.js            ← Stripe client (uses STRIPE_SECRET_KEY env var)
│   ├── shared/
│   │   └── schema.sql           ← SQLite schema for per-gym DBs
│   └── public/
│       ├── index.html           ← login/setup page
│       ├── app.html             ← main SPA shell
│       ├── app.js               ← entire SPA frontend (large file)
│       ├── me.html              ← member portal shell
│       ├── me.js                ← member portal frontend JS
│       ├── signup.html          ← self-serve gym owner signup page
│       ├── register.html        ← public member registration + waiver page (5 steps)
│       └── admin.html           ← super-admin panel UI (Iron Man/JARVIS theme)
├── data/
│   ├── platform.db              ← global billing DB
│   └── gyms/
│       └── {gym_id}/
│           ├── gym.db           ← per-gym database
│           └── photos/          ← member photos
├── crux-app.service             ← systemd service file
├── DEVELOPMENT.md               ← dev setup, architecture notes
├── PRODUCT.md                   ← product spec, feature list
├── BILLING.md                   ← Stripe billing implementation notes
├── ONBOARDING.md                ← onboarding wizard implementation notes
├── WAIVER_EDITOR.md             ← waiver editor implementation notes
└── SUPER_ADMIN.md               ← super-admin panel implementation notes
```

---

## How to Run

```bash
cd /home/ec2-user/.openclaw/workspace/boulderryn-project

# Development (single gym, no subdomain routing)
DEFAULT_GYM_ID=mygym PORT=8080 node server.js

# With admin panel enabled and a specific token
DEFAULT_GYM_ID=mygym PORT=8080 ADMIN_TOKEN=mysecrettoken node server.js

# Provision a new gym
node scripts/provision-gym.js mygym "My Gym Name"
```

**Admin panel:** Visit `/admin` → login with `ADMIN_TOKEN` value.

**EC2 deployment:**
```bash
# Kill stale port-holder before restarting (recurring issue — old nohup process)
sudo fuser -k 8080/tcp
sudo systemctl restart crux-app
```

---

## Environment Variables

All production secrets live in `/etc/crux.env` on EC2, loaded by the systemd service.

| Variable | Description | Status |
|----------|-------------|--------|
| `DEFAULT_GYM_ID` | Gym to use in dev (bypasses subdomain routing) | Dev only |
| `PORT` | Server port | `8080` |
| `JWT_SECRET` | JWT signing secret | ✅ Real value set |
| `ADMIN_TOKEN` | Admin panel access token | ✅ Real value set |
| `CRUX_DATA_DIR` | Custom data directory | `./data` |
| `STRIPE_SECRET_KEY` | Stripe secret key | ✅ Live key set |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | ✅ Set |
| `STRIPE_PRICE_STARTER` | Stripe monthly price ID — Starter | ✅ Set |
| `STRIPE_PRICE_GROWTH` | Stripe monthly price ID — Growth | ✅ Set |
| `STRIPE_PRICE_SCALE` | Stripe monthly price ID — Scale | ✅ Set |
| `STRIPE_PRICE_STARTER_ANNUAL` | Stripe annual price ID — Starter | ✅ Set |
| `STRIPE_PRICE_GROWTH_ANNUAL` | Stripe annual price ID — Growth | ✅ Set |
| `STRIPE_PRICE_SCALE_ANNUAL` | Stripe annual price ID — Scale | ✅ Set |
| `SMTP_USER` | Gmail SMTP user | `cruxgymhq@gmail.com` |
| `SMTP_PASS` | Gmail app password | ✅ Set in env (not in code) |

---

## What's Been Built (Complete)

### Core gym app features
- ✅ Member management (profiles, photos, tags, notes, warning flags)
- ✅ Check-in system (desk check-in, QR code scan)
- ✅ Pass types & memberships (configurable)
- ✅ Point of Sale (cart, products, categories, receipts)
- ✅ Digital waiver & induction (adult + minor, video + signature)
- ✅ Staff management (roles: Owner, Tech Lead, Duty Manager, Centre Assistant, Route Setter — PIN + password login)
- ✅ Analytics & reporting (KPI dashboard, EOD reports, charts)
- ✅ Events management
- ✅ Route tracking & wall map
- ✅ Email automation (welcome, QR codes, receipts) via nodemailer
- ✅ Noticeboard — staff post announcements, members read in portal

### Platform / SaaS features
- ✅ Multi-tenancy — per-gym isolated SQLite DBs
- ✅ Subdomain routing (`gymname.cruxgym.co.uk → gym_id`) — Cloudflare wildcard DNS + nginx configured
- ✅ Waiver editor — gym owners build their own waiver sections, video URL (Settings → Waivers)
- ✅ Setup wizard — 5-step forced setup on first login (gym details, induction video, waiver builder, gym map, pass types)
- ✅ Gym map builder — draw walls as polylines on a top-down floor plan, rooms as named groups
- ✅ Blank-slate provisioning — no default products/passes/waiver content
- ✅ Stripe billing — live keys, monthly + annual plans, checkout, portal, webhook handler
- ✅ Annual billing toggle on signup — "2 months free", uses `STRIPE_PRICE_*_ANNUAL` env vars
- ✅ Billing gate UI — 402 responses show full-screen subscription wall
- ✅ `requireBilling` middleware — blocks `cancelled`, `unpaid`, `suspended` statuses; exempts auth routes
- ✅ Super-admin panel — Iron Man/JARVIS theme, stats strip, quick links to every part of the platform, gym list with suspend/activate
- ✅ Welcome email — sent to new gym owners on provisioning
- ✅ Self-serve signup — `/signup` with monthly/annual toggle, plan selection → Stripe checkout → auto-provision
- ✅ Logo upload — Settings → General, stored as base64, shown in sidebar
- ✅ GDPR data export — `/api/export/gdpr` (JSON) + `/api/export/members.csv`
- ✅ systemd service — running on EC2 as `crux-app.service`
- ✅ Nightly DB backups — `scripts/backup-dbs.sh` via cron, keeps 14 days in `/home/ec2-user/crux-backups/`
- ✅ Rate limiting — `express-rate-limit` on `/api/me/auth` (20 req/15min)
- ✅ Marketing site CTAs — all buttons on cruxgym.co.uk link to `/signup` ("Start Free Trial")

### Member Portal (`/me`) — BUILT
- ✅ OTP email login (no password) → JWT session in localStorage
- ✅ Home tab — QR code (fullscreen tap), pass status, grade pyramid stats, "Buy a Pass" link if no active pass
- ✅ Map tab — SVG gym map, route pins, tap to view details
- ✅ Logbook tab — mark routes as sent/unsent, sends history
- ✅ Noticeboard tab — gym announcements
- ✅ Per-gym accent colour (`portal_colour` setting) applied via CSS variable
- ✅ Pass shop URL (`portal_shop_url` setting) — shown as "Buy a Pass →" button
- ✅ Portal invite email — staff can send from member profile, also sent automatically after registration
- ✅ Portal settings UI in Settings → General (colour picker + shop URL)

### Registration flow (`/register`) — BUILT
- ✅ 5-step flow: Video → Waiver Type (adult/minor buttons) → Details → Waiver → Sign
- ✅ Auto-sends portal invite email on completion

---

## Self-Serve Signup & Auth — How It Works

### Domain structure
- `cruxgym.co.uk` — marketing site with "Start Free Trial" / "Log In" CTAs
- `cruxgym.co.uk/signup` — signup page
- `cruxgym.co.uk/login` — login page for returning users
- `gymname.cruxgym.co.uk` — individual gym instance
- `gymname.cruxgym.co.uk/me` — member portal

### Signup flow (`/signup`)
Multi-step:
1. **Personal details** — name, email, password
2. **Gym details** — gym name, subdomain (auto-generated)
3. **Plan** — monthly/annual toggle, Starter/Growth/Scale → Stripe Checkout
4. On completion: gym provisioned, owner account created, welcome email sent, redirect to subdomain

### Member portal auth
- Enter email → OTP code sent → 6-digit code → JWT session (30 days)
- Unknown emails return a clear 404 error ("No account found — contact the gym")

### Staff accounts
- PIN only for desk login; email + password for web/remote login
- Invite flow via Settings → Staff

### Role-based permissions
**Full access** (Owner, Tech Lead, Duty Manager): everything
**Desk-only** (Centre Assistant, Route Setter): Visitors, Members, POS, Events, Routes
**Restricted:** Analytics, Settings, Billing, Staff management (admin/manager only)

---

## What Still Needs Doing

### Dev/testing utilities

**Reset setup wizard on existing gym:**
```bash
sqlite3 data/gyms/{gym_id}/gym.db "UPDATE settings SET value='0' WHERE key='setup_complete';"
```

**Full reset for local dev:**
```bash
sqlite3 data/gyms/mygym/gym.db "DELETE FROM staff; UPDATE settings SET value='0' WHERE key='setup_complete';"
DEFAULT_GYM_ID=mygym PORT=8080 node server.js
```

---

## Remaining Roadmap

### PRIORITY 1 — Email Improvements

**Onboarding email sequence (automated, time-based):**
- Day 0: Welcome email (already exists)
- Day 3: "Getting started" tips
- Day 7: "You're one week in" checklist
- Day 13: "Your trial ends tomorrow" + Stripe portal link
- Day 14 (if no card): "Trial expired" + reactivate link

**Member emails:**
- Registration confirmation with portal link + QR code image
- Pass expiry reminder: 7 days before + 1 day before
- Receipt email after POS transaction

**Branded templates:**
- Consistent HTML layout across all emails (Crux logo, navy/white, footer)

---

### PRIORITY 2 — Production Hardening

- Fix recurring port 8080 conflict — add `ExecStartPre=fuser -k 8080/tcp` to systemd service
- HTTPS confirm — Cloudflare SSL mode should be Full (not Flexible)
- Input validation on all public-facing routes (signup, register, member portal)
- Rename `boulderryn-project/` folder on EC2 to `crux/`

---

### PRIORITY 3 — Super-Admin Improvements

**Impersonate / Open Gym:**
- `POST /admin/impersonate/:gymId` → short-lived token → redirect to gym already logged in as Owner

**Revenue dashboard:**
- MRR, trial gyms ending in 7 days, recent signups

---

### PRIORITY 4 — UX Polish

**Error pages:**
- Custom 404 (nginx), branded "Gym not found" page

**Mobile responsiveness:**
- Staff app audit on tablet (POS, member profiles, check-in)

**Print support:**
- Member QR code "Print QR" → A6 card
- Day pass receipt printable format

**Loading states:**
- Spinners / skeleton screens on API calls

---

### FUTURE (no timeline)

- GoCardless direct debit for member recurring payments
- Native iOS/Android app (post-PWA)
- Multi-location support
- Bulk member CSV import
- Booking system (lane/session reservations)
- Push notifications
- White-label option
- Reseller/franchise support

---

## Known Issues / Technical Debt

- **Port 8080 conflict on EC2** — an old `nohup` node process survives systemd restarts. Must run `sudo fuser -k 8080/tcp` before each `systemctl restart crux-app`. Fix: add `ExecStartPre` to service file.
- `server.js` has a UNIQUE constraint error on first startup sometimes — waiver template seeding. Usually harmless.
- `requireBilling` treats missing billing records as "trialing + active" — correct for now.
- Staff PIN login uses a simple hash — fine for now, consider bcrypt for production.
- `boulderryn-project/` folder and git remote URL still reference old name.
- YouTube embeds use `youtube-nocookie.com` — works on live domain, may have issues on localhost with ad blockers.

---

## All URLs, Mapped Out

| What | URL | Status |
|------|-----|--------|
| Marketing site | `cruxgym.co.uk` | ✅ Live, CTAs → /signup |
| Signup | `cruxgym.co.uk/signup` | ✅ Live, monthly + annual |
| Login | `cruxgym.co.uk/login` | ✅ Live |
| Gym staff app | `gymname.cruxgym.co.uk` | ✅ Live |
| Member registration | `gymname.cruxgym.co.uk/register` | ✅ Live, 5-step flow |
| Member portal | `gymname.cruxgym.co.uk/me` | ✅ Built + live |
| Super-admin | `cruxgym.co.uk/admin` | ✅ Built (URL via EC2 IP or Cloudflare tunnel) |
| Staff invite | `gymname.cruxgym.co.uk/invite/:token` | ✅ Built |

---

## Marketing Website

Separate from the app. Lives at `/var/www/cruxgym/` on EC2 (served by nginx directly — not in this repo).

- 4 pages: index.html, features.html, pricing.html, contact.html
- All CTAs updated to "Start Free Trial →" linking to `/signup`
- "Log In" link in desktop nav
- Contact form handler: running as systemd service `crux-form-handler` on port 3001
- Emails go to `cruxgymhq@gmail.com` (hello@cruxgym.co.uk forward)

---

## Useful Commands

```bash
# Self-serve signup (test in browser)
open http://localhost:8080/signup

# Check app server status
curl http://localhost:8080/api/gym-info

# Check admin panel
curl "http://localhost:8080/admin/gyms?adminToken=YOUR_TOKEN"

# Provision a gym
curl -X POST http://localhost:8080/admin/provision?adminToken=YOUR_TOKEN \
  -H "Content-Type: application/json" \
  -d '{"gymId":"testgym","gymName":"Test Gym","ownerEmail":"test@example.com"}'

# EC2 — kill port conflict + restart
sudo fuser -k 8080/tcp && sleep 1 && sudo systemctl restart crux-app

# Restart form handler
sudo systemctl restart crux-form-handler

# Nginx reload
sudo systemctl reload nginx

# View app logs
sudo journalctl -u crux-app -f
```

---

## Road to Launch — Big Picture

### STAGE 1 — Feature Complete ← roughly here
- ✅ Member portal built (OTP auth, QR, map, logbook, noticeboard, grade pyramid)
- ✅ Annual billing on signup
- ✅ Marketing site CTAs working
- ✅ DB backups running nightly
- ✅ Rate limiting on auth endpoints
- ✅ SMTP password secured in env file
- [ ] End-to-end test (signup → setup → members → payments → emails → member portal)
- [ ] Fix port 8080 systemd conflict permanently

---

### STAGE 2 — Legal & Compliance (do in parallel)

- [ ] **Privacy Policy** — `/privacy` page on cruxgym.co.uk (UK GDPR compliant)
- [ ] **Terms of Service** — `/terms` page
- [ ] **Data Processing Agreement (DPA)** — accepted during signup
- [ ] **Cookie policy**
- [ ] **ICO registration** — £40/year at ico.org.uk
- [ ] **Business entity** — sole trader or limited company?
- [ ] **VAT** — threshold is £90k turnover

---

### STAGE 3 — Pre-Launch Testing

- [ ] Full end-to-end trial: signup → setup wizard → staff → member registration → check-in → POS → emails → member portal
- [ ] Test Stripe checkout with `4242 4242 4242 4242`
- [ ] Test annual billing checkout
- [ ] Test trial expiry (fast-forward DB date, confirm billing gate activates)
- [ ] Test on mobile: staff app, member portal, registration
- [ ] Test member portal PWA install (iOS + Android)
- [ ] Security review: unauthenticated requests rejected, no sensitive data in public routes

---

### STAGE 4 — Soft Launch (Beta)

- [ ] 1-2 UK climbing gyms for beta test (BoulderRyn is obvious first candidate)
- [ ] Provision, walk through setup in person
- [ ] Collect feedback, fix critical issues
- [ ] Get a testimonial/case study

---

### STAGE 5 — Go-To-Market

- [ ] Demo/sales flow — 10-minute walkthrough script
- [ ] Support plan — hello@cruxgym.co.uk + FAQ/help doc
- [ ] Outreach list — UK bouldering/climbing gyms
- [ ] LinkedIn/Instagram presence

---

### STAGE 6 — Public Launch

- [ ] First paying customer onboarded
- [ ] Uptime monitoring active (UptimeRobot or similar)
- [ ] Oscar can log into super-admin and see real data

---

### Where we are right now

```
[Stage 1: Feature Complete] █████████░  ~92% — email sequence + hardening left
[Stage 2: Legal]            ░░░░░░░░░░  ~0%  — not started
[Stage 3: Testing]          ░░░░░░░░░░  ~0%  — not started
[Stage 4: Beta]             ░░░░░░░░░░  ~0%  — not started
[Stage 5: Go-To-Market]     ░░░░░░░░░░  ~0%  — not started
[Stage 6: Launch]           ░░░░░░░░░░  ~0%  — not started
```

Realistically: 1-2 more Claude Code sessions to finish Stage 1, then legal + testing in parallel, then beta.
