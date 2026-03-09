# Crux — Development Reference

> Read this at the start of every session. See PRODUCT.md for business/vision context.
> Last updated: 2026-03-08

---

## What This Is

**Crux** — a multi-tenant SaaS climbing gym management platform.
UK-first, bouldering-focused. Being built to sell to multiple gyms via subscription.

---

## Running Locally

```bash
npm install
node scripts/provision-gym.js mygym "My Gym"   # first time only
DEFAULT_GYM_ID=mygym PORT=8080 node server.js
# Open http://localhost:8080
```

Kill old instance: `pkill -f "node server.js"`
Tunnel (for external testing): `/usr/local/bin/cloudflared tunnel --url http://localhost:8080`
DB: `data/gyms/{gym_id}/gym.db` per gym

---

## Tech Stack

- **Backend:** Express.js + Node.js
- **Database:** SQLite via better-sqlite3
- **Frontend:** Vanilla JS SPA (`src/public/app.js` ~5500 lines), `loadPage(name)` router
- **Styling:** Tailwind CSS (CDN), blue/navy scheme (`#1E3A5F` primary)
- **Auth:** Staff PIN (salted PBKDF2 sha512), JWT for member sessions
- **Email:** Nodemailer (SMTP via settings)
- **Payments:** Dojo (in-person), GoCardless (DD) — skeletons only

---

## Project Structure

```
server.js                    — Express entry point
src/
  routes/                    — API route handlers (one file per domain)
  main/
    database/
      db.js                  — DB connection
      init.js                — Schema init + migrations
    models/                  — Data access layer
    services/
      email.js               — Email service (QR, receipts, waiver, welcome)
  integrations/
    dojo.js                  — Dojo card reader integration
  public/
    index.html               — Staff app shell
    app.js                   — All frontend JS (SPA)
    app.html                 — Member portal
    register.html            — Public registration/waiver page
    pages/
      pos.js                 — POS frontend
      waiver.js              — Waiver frontend
reference/                   — Gym layout, waiver text, pricing reference docs
data/
  gyms/
    {gym_id}/
      gym.db                 — Per-gym SQLite database
      photos/                — Per-gym member photo uploads
scripts/
  provision-gym.js           — Provision a new gym (creates DB, seeds defaults)
```

---

## Features Built

### Staff App Pages
| Page | Status | Notes |
|---|---|---|
| Dashboard (Visitors) | ✅ Complete | Stats cards, needs validation list, active visitors, check-in |
| Members | ✅ Complete | List, search, filters, profile modal |
| Profile Modal | ✅ Complete | 4 tabs: Overview, Passes, Transactions, Events |
| Edit Member | ✅ Complete | Edit, Merge Profile, Family Members tabs |
| Point of Sale | ✅ Complete | Cart, member chip, pass assignment, Dojo/GoCardless skeleton |
| Check-in | ✅ Complete | QR scan, name search, pass validation, day pass expiry |
| Events | ✅ Complete | List + calendar view, create/cancel/enrolments |
| Routes | ✅ Complete | Cards view, SVG map, wall filters, add climb, grade chart |
| Analytics | ✅ Complete | KPI cards, bar charts, EOD report, popular products, grade dist |
| Settings > Staff | ✅ Complete | Add/edit/delete/reset PIN/deactivate staff |
| Settings > Products | ✅ Complete | Categories + products, add/edit/archive |
| Settings > Pass Types | ✅ Complete | Grouped by category, add/edit/disable |
| Settings > General | ✅ Complete | Gym details, opening hours, pricing, induction video URL |
| Settings > Integrations | ✅ Complete | GoCardless, Dojo, Email/SMTP config |

### Backend API
All routes under `/api/*`. See `src/routes/` for full list.
Key endpoints: members, passes, checkin, pos/transactions, products, staff, analytics, events, routes, settings, email, waivers, giftcards.

### Member Portal (`app.html`)
- Login with auth code (emailed)
- Profile, pass status, booking

### Registration (`register.html`)
- Induction video + waiver form (adult + minor)
- Signature canvas
- QR code emailed on completion

---

## Database

Single SQLite DB with 29 tables. Key ones:

| Table | Purpose |
|---|---|
| members | All member data |
| staff | Staff accounts (PIN hashed PBKDF2) |
| pass_types | Pass type definitions |
| member_passes | Issued passes (visits_remaining, status) |
| check_ins | Check-in log |
| transactions / transaction_items | POS sales |
| products / product_categories | POS products (92 products, 9 categories seeded) |
| settings | Key/value gym config |
| events / event_enrolments | Events system |
| walls / climbs / climb_logs | Routes system |
| gift_cards / gift_card_transactions | Vouchers |

Test data: 7 members, 2 with active passes, 3 seeded climbs, 2 seeded events.

---

## ✅ REBRAND COMPLETE

All gym branding is config-driven per-gym. Logos in `src/public/assets/logos/`:
- `logo-compact.svg` — sidebar (white wordmark, dark bg)
- `logo-light.svg` — dark bg pages (first-run, register header)
- `logo-dark.svg` — light bg pages (member portal login, privacy policy)
- `icon.svg` — favicon + PWA icon

Gym name (`settings.gym_name`) still surfaces in: sidebar footer, browser title, email subjects.

---

## ✅ MULTI-TENANCY CORE COMPLETE

Per-gym DB isolation in place. Fully smoke-tested.

- `data/gyms/{gym_id}/gym.db` — per-gym SQLite
- `src/main/database/gymContext.js` — AsyncLocalStorage threads `gym_id` through all async calls
- `src/main/database/db.js` — `connections` Map, `getDb()`, `getPhotosDir()`, `closeAll()`
- `server.js` — gym middleware resolves from subdomain (prod) or `DEFAULT_GYM_ID` / first-on-disk (dev)
- `scripts/provision-gym.js` — provision a new gym

---

## 🏗️ Next Milestones

1. **Subdomain routing** — nginx config for `*.cruxgym.co.uk` → Node server
2. **Super-admin panel** — view all gyms, status, usage
3. **Stripe billing** — subscription management, webhook for active/inactive
4. **Gym signup flow** — self-service provisioning

---

## Security (pre-launch checklist)

- [ ] Set `JWT_SECRET` in `/etc/crux.env`
- [x] `helmet` middleware — ✅ done
- [x] Rate limit auth endpoints — ✅ done
- [ ] `chmod 600 data/gyms/*/gym.db`
- [ ] Run behind HTTPS (nginx + Let's Encrypt)

---

## Repo

GitHub: https://github.com/n3urs/cruxgym
