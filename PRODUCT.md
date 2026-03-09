# Product Vision — Crux

> Last updated: 2026-03-08

---

## What We're Building

**Crux** — a multi-tenant SaaS climbing gym management platform. Affordable, modern, built specifically for bouldering gyms. UK-first, bouldering-focused to start, expandable to other climbing disciplines later.

**Tagline direction:** "Crux | [Gym Name]" — each gym is co-branded under the Crux name.

---

## The Business Model

- Oscar builds and maintains the product
- Bat Computer handles: customer support via email, finding and cold-outreaching to potential gym customers, escalating to Oscar only when genuinely needed
- Oscar's goal: as hands-off as possible once gyms are onboarded
- Revenue: monthly/annual subscriptions per gym
- Overhead: server costs + domains + Oscar's £50/month margin

---

## Competitor Pricing (researched 2026-03-08)

| Platform | Price | Notes |
|---|---|---|
| Rock Gym Pro | $169–$429/month (~£130–£340) | US-focused, tiered by features. Industry standard. |
| PerfectGym | €179–€449/month (~£150–£380) | European, generic gym management |
| GetBeta (Beta) | Unknown (couldn't access pricing) | Climbing-specific, what we were originally cloning |
| Mindbody | ~£99–£300+/month | Very generic, overkill for small gyms |

**Takeaway:** The market sits at £130–£380/month for comparable products. Most are US/European companies without UK-specific focus. A UK-native, bouldering-specific product priced at ~£79–£99/month would be a clear differentiator.

**Suggested pricing:**
- **Starter** — £59/month (up to 200 members) — small/new gyms
- **Growth** — £99/month (up to 750 members) — typical indie gym
- **Scale** — £149/month (unlimited members) — larger operations

*Roughly half the price of Rock Gym Pro. Annual billing option (2 months free).*

---

## Target Market

- **Phase 1:** UK bouldering gyms
- **Phase 2:** All UK climbing gyms (lead, auto-belay, etc.)
- **Phase 3:** International if traction warrants it

UK has ~200+ climbing walls. Bouldering-only venues are the fastest growing segment.

---

## Multi-Tenancy — How It Works

Each gym gets:
- Isolated data — members, passes, products, staff, settings, transactions
- Their own subdomain: `gymname.cruxgym.co.uk` (or similar)
- Their own branding: logo, gym name, colour scheme configurable in settings
- Separate staff accounts — no cross-gym visibility
- Co-branding: "Crux | [Gym Name]" — not white-labelled, our brand stays visible

Architecture decision needed: **one SQLite DB per gym** (simpler isolation, easier backups) vs **shared Postgres with gym_id** (better for scale). Current codebase uses SQLite — likely move to per-gym DB initially.

---

## Onboarding Model

**Recommendation: Manual onboarding to start, self-serve later.**

Reasoning:
- Early customers need handholding to configure the system correctly
- Oscar (and Bat Computer) can learn what trips people up and build better self-serve tools from that
- First 5–10 gyms: Oscar sets up personally, Bat Computer assists with email
- Eventually: self-serve signup form, automated provisioning, Bat Computer handles the rest

Steps per gym onboarding:
1. Gym signs up / contacted via outreach
2. Oscar provisions a new instance (or automated script does it)
3. Bat Computer emails welcome + setup guide
4. Bat Computer monitors their support inbox for questions
5. Gym goes live

---

## Support Model (Bat Computer)

- Dedicated support email e.g. `support@cruxgym.co.uk`
- Bat Computer monitors inbox, handles common queries (how to add a pass type, how to reset a PIN, etc.)
- Escalation to Oscar for: billing disputes, technical bugs, anything needing code changes
- Outreach: Bat Computer can research UK climbing gyms, draft cold emails, send on Oscar's behalf (with approval workflow or autonomous for low-risk sends)

---

## Branding

- **Platform name:** Crux
- **Domain idea:** `cruxgym.co.uk` or `cruxgym.co.uk` or `cruxgym.io`
- **Logo:** Needs designing — clean, modern, could reference movement/climbing without being literal
- **Gym co-branding:** "Crux | GymName" style — gym name follows the pipe
- **Colour scheme:** Current navy/blue can stay for staff app; each gym can customise their member-facing portal

---

## Features

Already built and working:
- Member management + profiles (photo, warning flag, tags, comments)
- Pass types + assignment + check-in (desk + QR)
- POS with cart, member chip assignment, Dojo/GoCardless skeletons
- Waiver / induction registration flow (adult + minor)
- Staff management + PIN auth + role permissions
- Settings (products, pass types, general, integrations, staff)
- Analytics dashboard (KPI cards, revenue + check-in charts, EOD report)
- Events management (list + calendar view, create/cancel/enrolments)
- Routes / wall map (cards + SVG map, grade distribution)
- Email service (QR codes, receipts, waiver confirmation, welcome)

Needs building for multi-tenancy:
- [ ] Gym provisioning system (create new gym = new DB + config)
- [ ] Super-admin panel (Oscar can see all gyms, billing status, usage)
- [ ] Subdomain routing (gymname.cruxgym.co.uk → correct gym instance)
- [ ] Billing / subscription management (Stripe integration)
- [x] Renamed all BoulderRyn references to Crux
- [ ] New logo + brand assets
- [ ] Marketing/landing page (cruxgym.co.uk)
- [ ] Self-serve signup flow (later)

---

## Tech Stack

Current: Express.js + Node.js + SQLite + Tailwind CSS
Multi-tenant plan: per-gym SQLite databases, provisioned on signup, stored at `data/gyms/{gym_id}/`
Hosting: AWS EC2 (current) — can scale with more instances as needed

---

## Decisions Made

- **Pricing:** Starter £59/month, Growth £99/month, Scale £149/month — annual option available
- **Onboarding:** Manual for first 5–10 gyms, self-serve later
- **Billing:** Stripe (to be integrated)
- **Priority:** Multi-tenancy + rebrand before more features
- **Branding:** "Crux | [Gym Name]" — not white-labelled

## Domain Availability (checked 2026-03-08)

- `cruxgym.co.uk` — TAKEN
- `cruxgym.co.uk` — TAKEN
- `cruxgym.io` — possibly available
- `cruxgym.co.uk` — possibly available
- `cruxclimb.com` — possibly available
- `cruxclimb.co.uk` — possibly available
- `cruxwall.co.uk` — possibly available
- `climbcrux.com` — possibly available
- `trycrux.app` — possibly available

**Recommendation:** `cruxgym.co.uk` + `cruxgym.io` — clean, clear, UK-native. Oscar to register.

## Open Questions

- [ ] Oscar to register domain (recommend cruxgym.co.uk + .io pair)
- [ ] Logo design
- [ ] Legal: T&Cs, privacy policy, data processing agreement (GDPR for each gym's member data)

---

## Repo

https://github.com/n3urs/cruxgym
