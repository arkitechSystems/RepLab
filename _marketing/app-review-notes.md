# App Review Information — REPLAB

Paste the body below into App Store Connect:
App Information -> App Review Information -> Notes (max 4000 chars).

---

## Demo account

- Email: apple-reviewer@replab-fitness.com
- Password: Reviewer2026!

After login the reviewer will see a populated weekly calendar, a few
already-logged sessions in the recent history, body metrics + lift maxes
filled in, and the featured "Will's Hypertrophy Program" assigned to
their schedule. The account is pre-seeded so review can begin
immediately with no setup. The account is on the Free tier (role=user,
not admin) which mirrors what a real new user sees on iOS.

## About the app

REPLAB is a workout-tracking app for lifters and trainers. Core
features include:

- Programmable workouts with sets, reps, and suggested weights
- A weekly schedule + calendar view for planning sessions
- Session logging with personal-best tracking
- AI-assisted workout generation (Anthropic Claude API)
- A community feed and progress charts
- A library of pre-built programs from well-known coaches

The featured program for v1 is "Will's Hypertrophy Program" — a 12-week
strength + hypertrophy split written by the developer.

## IMPORTANT — Free-tier-only on iOS for v1 (Guideline 3.1.1)

REPLAB v1 ships free-tier-only on iOS. No in-app purchase mechanism is
presented when the app runs on iOS native. Per App Store Review
Guideline 3.1.1 ("Apps offering subscriptions for digital content or
services must use Apple's in-app purchase"), we have intentionally
removed any purchase button or external subscription link on iOS.

Specifically, the tier-comparison view at `/upgrade` is visible and
shows what Pro and Elite tiers would offer, but the purchase CTA is
hidden when `Capacitor.getPlatform() === 'ios'`. Web (desktop browser)
and Android still offer Stripe-based subscription, which is outside
Apple's In-App Purchase guidelines. A future Pro tier on iOS will be
wired through StoreKit IAP before any paid offering is exposed in the
iOS build.

This pre-empts the most common rejection reason for fitness apps with
a web companion.

## Account deletion (Guideline 5.1.1(v))

In-app account deletion is supported and required by guideline 5.1.1(v):

- Path: Profile tab -> Settings -> Delete Account
- Confirmation: the user must re-enter their password
- Effect: immediate hard delete with cascade across 19+ dependent
  tables (workouts, programs, schedule, sessions, session entries,
  personal bests, metrics, AI usage, feedback, push tokens, etc.)
- Endpoint: `DELETE /auth/delete-account`

No data is retained after deletion beyond legally required transaction
records (none for free-tier users).

## Privacy policy, terms, and support

- Privacy policy: https://replab-fitness.com/privacy
- Terms of service: https://replab-fitness.com/terms
- Support: https://replab-fitness.com/support

## Third-party services in use

- Stripe — billing on web and Android only; hidden on iOS
- Resend — transactional email (welcome, password reset, receipts)
- PostHog — product analytics; opt-in, identified-users only
- Sentry — error monitoring; no PII captured
- Anthropic Claude API — in-app AI workout generator
- Render — application hosting and PostgreSQL database

## Contact

- Developer email: wmartin@phgworks.com
- Support email: support@replab-fitness.com
- Phone: [YOUR PHONE]

---

## TODO for the developer before submitting

- [ ] Replace `[YOUR PHONE]` above (or remove the line) — App Review may
      call if they have questions during the review window
- [ ] Confirm the seeded library program is named exactly
      "Will's Hypertrophy Program" — the seed script falls back to any
      seeded library program if the exact name is missing, so verify
      `SELECT name FROM programs WHERE user_id IS NULL` returns that
      string in production
- [ ] Verify the Delete Account button is currently visible and wired
      in the Profile screen (one of the parallel agents is checking
      this); if not, fix before submission so the 5.1.1(v) claim above
      is true
- [ ] Run the seed script against the production database before
      submitting:
      `node --env-file=server/.env server/scripts/seed-apple-reviewer.js`
- [ ] Verify login at https://replab-fitness.com with the credentials
      above to confirm the seeded data is visible
