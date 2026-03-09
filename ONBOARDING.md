# Onboarding Wizard — Implementation Summary

## What was built

A first-run onboarding experience for new gym owners. When a gym is provisioned and the owner opens the app for the first time, they are guided through 5 essential setup steps.

## Files changed

| File | Change |
|------|--------|
| `src/routes/onboarding.js` | New file — onboarding API routes |
| `server.js` | Mounted `src/routes/onboarding` at `/api/onboarding` |
| `src/routes/waivers.js` | PUT handler now sets `updated_at = datetime('now')` so waiver edits are detectable |
| `src/public/index.html` | Added sidebar checklist widget + welcome modal HTML |
| `src/public/app.js` | Added `loadOnboardingStatus`, `renderOnboardingChecklist`, `dismissOnboarding`, `showWelcomeModal`, `closeWelcomeModal`, `navigateToSettings` functions |

## API routes

### `GET /api/onboarding/status`
Returns live onboarding state by inspecting real data:

```json
{
  "complete": false,
  "dismissed": false,
  "steps": {
    "gym_details": true,
    "waiver": false,
    "pass_types": true,
    "staff": false
  }
}
```

Step completion criteria:
- **gym_details** — `gym_name` setting is non-empty and not `"My Gym"`
- **waiver** — at least one `waiver_templates` row where `updated_at > created_at` (user has edited it)
- **pass_types** — at least 1 active row in `pass_types` table
- **staff** — more than 1 active staff member (beyond the seeded owner)
- **complete** — all 4 steps done, OR `onboarding_complete = '1'` in settings

### `POST /api/onboarding/dismiss`
Sets `onboarding_complete = '1'` in settings. Hides the checklist permanently.

## Frontend

### Sidebar checklist (`#onboarding-checklist`)
Injected between the nav links and the sidebar footer in `index.html`. Hidden by default via `style="display:none;"`.

On load, `loadOnboardingStatus()` is called. If not complete:
- Shows the card with a title, progress count (e.g. "2 / 5 done"), and a filled progress bar
- Lists 5 items with tick icons when done, strikethrough text for completed steps
- Each incomplete step is a button that calls `navigateToSettings(tab)` to jump to the relevant Settings tab
- Item 5 ("You're ready!") auto-completes when all 4 data steps are done
- "Dismiss" link at the bottom calls `POST /api/onboarding/dismiss` and hides the card

### Welcome modal (`#onboarding-welcome-modal`)
Shown once per browser session (gated by `sessionStorage.crux_welcome_shown`) when 0 steps are complete. Contains:
- Crux logo
- "Welcome to Crux 👋" title
- Brief copy
- "Let's go →" button (closes modal)
- "I'll explore on my own" secondary link (closes modal)

The sidebar checklist remains visible after closing the modal either way.

### `navigateToSettings(tab)`
Helper function that sets the `settingsTab` global and calls `navigateTo('staff')` (the Settings page). This lets checklist items deep-link to the correct tab (general, waivers, passes, staff).

## Notes

- No new npm dependencies
- All checks are read-only queries against existing tables — no schema migrations required
- The `onboarding_complete` key in the `settings` table is created on first dismiss via `INSERT OR REPLACE`
- The waiver `updated_at` fix is a one-line addition to the PUT handler — it only starts tracking edits from this point forward; existing gyms with no waiver edits will show `waiver: false` until they save any change to the waiver template
- For the test gym DB: `gym_details` and `pass_types` are already true; `waiver` and `staff` are false (no extra staff beyond the owner, no waiver edits since the fix)
