# BETA Software Reference — Feature Spec for BoulderRyn

Based on screenshots from gym.sendmoregetbeta.com (BoulderRyn gym instance, v26.23).
Screenshots saved in this directory.

---

## 1. Visitors Page (Main Dashboard)

The home screen is NOT a stats dashboard — it's an operational visitor management screen.

### Search Section
- Large search bar at top
- "Enter at least 3 characters to search" hint
- Live search results in 2-column card grid
- Sort control (ascending/descending)
- Result count shown ("30 results")

### Member Cards (2-column grid)
- Profile photo or initials (2-letter, colour background)
- Name in UPPERCASE
- Email address
- DOB + age
- **Under-18 ages shown in blue** (safeguarding highlight)
- Green dot = currently checked in
- Warning triangle (orange) for flagged members
- Check-in/checkout icons (right side)
- Click card → opens member profile modal

### Active Visitors Section
- "Active Visitors (count)" header
- Same 2-column card grid
- Pagination (page numbers + arrows)
- Refresh button
- Grid/list view toggle
- Sort control

### Recent Forms Section
- Lists latest waiver submissions
- Columns: Form type, Member name, Age, Date/time, Actions
- Red warning circle = flagged issue with waiver
- Grey circle = all clear
- Birthday cake icon for members who just turned 21
- Action icons: save (floppy), view (eye)

### Today's Schedule Section
- Calendar/list/people view toggles
- Filters: Host, Bookings type, Show Cancelled
- "Expand all" toggle
- Shows date and scheduled events/classes

### Bottom-Right Floating Buttons
- Blue "+" button — add new visitor/member
- Settings/gear icon

### Left Sidebar Nav
- Visitors (people icon)
- Events (calendar icon)
- Climbs (route icon)
- Support (clipboard icon)

### Top Bar
- BETA | BoulderRyn logo
- BoulderRyn gym logo (right)
- Logged-in user avatar with initials (right)
- Chat button (right)

---

## 2. Member Profile (Modal Overlay)

Opens as a modal overlay on top of the current page — NOT a separate page.

### Left Side — Profile Info
- Large profile photo
- "Has App" badge
- Full name
- DOB + auto-calculated age
- Gender
- Email
- Phone
- Full address
- Warning tag (orange badge) if flagged
- "Edit profile" link

### Expandable Sections
- **Comments** — staff can leave notes on profile (shows commenter initials + text)
- **Forms (count)** — waiver status
  - "ADULT ACKNOWLEDGEMENT OF RISK FORM"
  - Date submitted
  - Actions: share, calendar, print, view
  - "Send form email" button
- **Tags (count)** — staff warnings/notes
  - Tag text with author name + date
  - E.g. "Will fall on you when lead climbing!" — oliver longhurst, dec 8, 2025

### Right Side — 4 Tabs
1. **Passes** — active/expired passes
   - Pass name
   - Visit count ("23 ∞" = 23 visits, unlimited)
   - Date range (start → end)
   - Subscription status ("subscription is paused")
   - Settings gear icon (manage pass)
   - Check-in arrow icon (check in on this pass)
   - "show all?" toggle for archived passes
2. **Visits** — visit history log
3. **Events** — event attendance history
4. **Transactions** — purchase/payment history

### Bottom-Right
- Blue floating action button (profile save/action)

---

## 3. Point of Sale (POS)

### Category Grid (Top Area)
- 9 category cards in 2 rows (5 top, 4 bottom)
- Each card shows: category name, item count, icon
- Categories: Cold Drinks (4), Day Entry (9), Events (10), Food (7), Hire (2), Hot Drinks (10), Membership (8), Prepaid (17), Products (25)
- Click category → shows product grid below

### Product Grid (Middle Area)
- Grid of product cards within selected category
- Each card shows:
  - Product name
  - Price (£)
  - Product code (C-XXXXX for products, EVT-XXXX for events)
  - Source label (BETA, Chalk, Gecko)
  - Small icon
- Staff variants exist (e.g. "Clif Bar Staff" £2.00 vs "Clif Bar" £2.50)
- Scrollable within category

### Checkout Sidebar (Right)
- Date and time display
- Red dot indicator (active/recording)
- "+" button (add custom item)
- **"WARNING!!! No Profile Linked"** red banner when no member linked
- Cart items list
- Subtotal
- Tax
- **TOTAL**
- DISCOUNTS section
- Payment method buttons: **Dojo** (card), **Voucher**, **Other** (each with icon)
- **Cancel Tx** button
- **New Tx** button
- **Show Totals** button

### Bottom-Left Icons
- Search (magnifying glass) — product search
- Check-in (arrow into box)

### Bottom-Right Icons
- Profile link (person silhouette) — link member to transaction

### Product Code Prefixes
- C-XXXXX = regular products
- EVT-XXXX = events

### Pricing Reference (from screenshots)
See individual category screenshots for full pricing.

---

## 4. Key Differences from Current BoulderRyn

### Missing from BoulderRyn (Priority Order)
1. **POS category grid** — we have empty product grid, need full category + product system
2. **Member profile modal** — we have basic table view, need full modal with tabs
3. **Visitor page as dashboard** — we have stats dashboard, need operational visitor view
4. **Active visitors** — no live tracking of who's in the gym
5. **Payment method buttons** (Dojo, Voucher, Other)
6. **Transaction controls** (Cancel/New/Show Totals)
7. **Profile linking** in POS with warning banner
8. **Staff comments** on member profiles
9. **Tags/warnings system** with author attribution
10. **Forms/waivers section** in member profile
11. **Pass management** with visit counts, expiration, subscription status
12. **Under-18 age highlighting** (blue) for safeguarding
13. **Birthday indicators**
14. **Product search** from POS
15. **Today's schedule** section
16. **Recent forms** section on dashboard
17. **Photo support** on member profiles
18. **Grid/list view toggle** on visitor list

### Already In BoulderRyn
- Basic member management (CRUD)
- Check-in system (needs live search dropdown)
- Basic POS layout (needs overhaul)
- Waiver system (basic, needs forms section in profile)
- Settings placeholder
- Events/Routes/Analytics placeholders
- Blue/navy branding + Tailwind CSS
