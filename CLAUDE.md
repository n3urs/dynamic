# CLAUDE.md — Crux Platform Context

Read this first. This is the full context for continuing work on the Crux gym management SaaS.

---

## What Is Crux?

Crux is a **multi-tenant SaaS platform** for climbing and bouldering gyms. Gyms pay a monthly subscription to access the platform. Each gym gets their own isolated subdomain (`gymname.cruxgym.co.uk`) and a completely separate SQLite database. There is no shared data between gyms.

**Business model:** Oscar (the platform owner) sells subscriptions to gym owners. Starter £59/mo, Growth £99/mo, Scale £149/mo. 14-day free trial on signup.

**Target market:** UK climbing and bouldering gyms, specifically independent operators who can't afford or don't need bloated enterprise software.

---

## Tech Stack

- **Backend:** Node.js + Express.js
- **Database:** SQLite via `better-sqlite3` (one DB per gym + one platform DB)
- **Frontend:** Vanilla HTML/CSS/JS SPA (no framework), Tailwind CSS via CDN
- **Auth:** JWT for staff sessions, PIN-based login for staff at the desk
- **Email:** Nodemailer via Gmail SMTP (`cruxgymhq@gmail.com`)
- **Payments (member-facing):** GoCardless (direct debit) + Dojo (in-person card) — placeholders/partial
- **Payments (platform billing):** Stripe — installed, routes built, needs real API keys
- **Hosting:** AWS EC2 (eu-west-1), served via nginx

---

## Repository Structure

```
boulderryn-project/          ← repo root (yes, old name, rename is pending)
├── server.js                ← main Express server entry point
├── scripts/
│   └── provision-gym.js     ← CLI + exportable function to create a new gym
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
│   │       ├── email.js         ← member emails (QR codes, receipts)
│   │       └── welcomeEmail.js  ← new gym onboarding email
│   ├── middleware/
│   │   ├── requireAdmin.js      ← ADMIN_TOKEN check for /admin routes
│   │   └── requireBilling.js    ← subscription check (NOT wired in yet)
│   ├── routes/
│   │   ├── admin.js             ← super-admin panel API
│   │   ├── billing.js           ← Stripe billing routes
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
│       ├── register.html        ← public member registration + waiver page
│       └── admin.html           ← super-admin panel UI
├── data/
│   ├── platform.db              ← global billing DB
│   └── gyms/
│       └── {gym_id}/
│           ├── gym.db           ← per-gym database
│           └── photos/          ← member photos
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

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEFAULT_GYM_ID` | Gym to use in dev (bypasses subdomain routing) | required in dev |
| `PORT` | Server port | 8080 |
| `JWT_SECRET` | JWT signing secret | insecure fallback (fix in prod) |
| `ADMIN_TOKEN` | Admin panel access token | `admin_secret_placeholder` |
| `CRUX_DATA_DIR` | Custom data directory | `./data` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_test_placeholder` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | empty |
| `STRIPE_PRICE_STARTER` | Stripe price ID for Starter plan | empty |
| `STRIPE_PRICE_GROWTH` | Stripe price ID for Growth plan | empty |
| `STRIPE_PRICE_SCALE` | Stripe price ID for Scale plan | empty |
| `SMTP_USER` | Gmail SMTP user | `cruxgymhq@gmail.com` |
| `SMTP_PASS` | Gmail app password | hardcoded in welcomeEmail.js |

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

### Platform / SaaS features
- ✅ Multi-tenancy — per-gym isolated SQLite DBs
- ✅ Subdomain routing (`gymname.cruxgym.co.uk → gym_id`)
- ✅ Waiver editor — gym owners can edit their own waiver text, sections, video URL (Settings → Waivers)
- ✅ Onboarding wizard — welcome modal + sidebar checklist on first login
- ✅ Stripe billing infrastructure — plans, checkout, portal, webhook handler, Billing tab in Settings
- ✅ Super-admin panel — `/admin` with gym list, provision form, suspend/activate
- ✅ Welcome email — sent to new gym owners on provisioning (subdomain URL, trial info, next steps)
- ✅ `requireBilling` middleware — exists but NOT wired into routes yet (see below)

---

## What Still Needs Doing (Priority Order)

### 1. Wire in billing gating (high priority)
`src/middleware/requireBilling.js` exists but is not applied to any routes yet. Gyms can use the platform indefinitely without paying.

To wire it in: in `server.js`, add `requireBilling` to the gym API routes after the gym context middleware:
```js
const requireBilling = require('./src/middleware/requireBilling');
app.use('/api', gymContextMiddleware, requireBilling, gymRoutes);
```

Be careful: do NOT apply it to `/api/auth`, `/api/gym-info`, `/billing/*`, `/admin/*`, or the public register page.

### 2. Real Stripe keys
Oscar needs to:
1. Create a Stripe account at stripe.com
2. Create 3 products/prices (Starter £59/mo, Growth £99/mo, Scale £149/mo) 
3. Set env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_SCALE`
4. Configure Stripe webhook endpoint: `https://cruxgym.co.uk/billing/webhook`

### 3. Wildcard DNS for subdomains
Currently `*.cruxgym.co.uk` doesn't point anywhere. Need:
- Cloudflare: add `A` record `*` → `52.51.136.243` (proxied)
- nginx: update `/etc/nginx/conf.d/cruxgym.conf` to handle any subdomain and proxy to the Express app on port 8080

nginx config change needed:
```nginx
server {
    listen 80;
    server_name cruxgym.co.uk www.cruxgym.co.uk *.cruxgym.co.uk;
    # ... proxy to port 8080 for *.cruxgym.co.uk
    # ... serve /var/www/cruxgym for cruxgym.co.uk (marketing site)
}
```
Actually needs two server blocks — one for the marketing site (apex domain), one for subdomains (app).

### 4. JWT_SECRET in production
Currently using an insecure fallback. Set `JWT_SECRET` in `/etc/crux.env` and load it in server.js.

### 5. Production process management
The app currently runs as a background process. Should be a systemd service like the form handler:
`/etc/systemd/system/crux-app.service`

### 6. Self-serve signup flow (future)
Currently gyms are provisioned manually via the admin panel. Eventually: a signup page at cruxgym.co.uk where gym owners can sign up, pay via Stripe, and get their instance automatically provisioned.

### 7. Data export for GDPR compliance
Settings → General should have a "Export all data" button that generates a ZIP of member data, transactions, waivers, etc. This was mentioned in the website FAQs.

### 8. Logo upload
Settings → General should allow uploading a gym logo that appears in the sidebar and on emails.

---

## Known Issues / Technical Debt

- `server.js` has a UNIQUE constraint error on first startup sometimes — related to waiver template seeding attempting duplicates. Usually harmless but worth investigating.
- The `requireBilling` middleware treats missing billing records as "trialing + active" — correct for now but will need tightening once real Stripe is live.
- Staff PIN login uses a simple hash — fine for now, consider bcrypt for production.
- The `boulderryn-project` folder and GitHub repo should be renamed to `crux` or `cruxgym`.
- Git committer identity shows EC2 default user — run `git config --global user.name "Oscar Sullivan"` and `git config --global user.email "oscar@sullivanltd.co.uk"`.

---

## Marketing Website

Separate from the app. Lives at `/home/ec2-user/.openclaw/workspace/crux-website/` and is served by nginx from `/var/www/cruxgym/`.

- 4 pages: index.html, features.html, pricing.html, contact.html
- Contact form handler: `crux-website/form-handler.js` running as systemd service `crux-form-handler` on port 3001
- Emails go to `cruxgymhq@gmail.com` (hello@cruxgym.co.uk forward)

---

## Useful Commands

```bash
# Check app server status
curl http://localhost:8080/api/gym-info

# Check admin panel
curl "http://localhost:8080/admin/gyms?adminToken=YOUR_TOKEN"

# Check billing status
curl "http://localhost:8080/billing/status?gymId=mygym"

# Provision a gym
curl -X POST http://localhost:8080/admin/provision?adminToken=YOUR_TOKEN \
  -H "Content-Type: application/json" \
  -d '{"gymId":"testgym","gymName":"Test Gym","ownerEmail":"test@example.com"}'

# Restart form handler
sudo systemctl restart crux-form-handler

# Nginx reload
sudo systemctl reload nginx

# Cloudflare tunnel (for testing)
/usr/local/bin/cloudflared tunnel --url http://localhost:8080
```
