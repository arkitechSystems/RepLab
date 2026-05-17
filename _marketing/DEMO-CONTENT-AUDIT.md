# Demo / Mock Content Audit

Sweep of all the "placeholder / sample / not-real-data" content the app still ships to production. Each item needs a decision before launch: **gate it**, **replace with real data**, **stub to empty**, or **leave intentionally**.

Audited 2026-05-17.

---

## 1. Trainers tab — Zumba Jason mock data ⚠️

**File:** `client/src/data/trainers.js`
**Surface:** Workouts page → Trainers row (rendered via `getTrainers().map(...)` at Workouts.jsx:3834)

Single hardcoded trainer entry with fabricated stats:
- Name: Zumba Jason
- Title: "Certified HIIT & Dance Fitness Instructor"
- Stats: 8+ years experience, 500+ clients, 4.9 rating, 3,842 community workouts
- 3 workouts: HIIT Blast, Dance Burn, Core Destroyer — fabricated exercise lists

**Apple risk:** medium. A reviewer tapping into Zumba Jason will see a polished mock profile. Could be flagged under guideline 2.1 (incomplete features) or guideline 4.0 (placeholder content).

**Options:**
- **(A) Gate the Trainers row** behind `FF_TRAINERS` the same way Featured/Challenges are gated. ~15 min. Recommended.
- **(B) Stub `getTrainers()` to return `[]`** so the trainer list renders empty. Workouts page already handles empty state at line 3870 with a fallback card. ~5 min.
- **(C) Replace with real trainer onboarding flow** — much bigger lift, would need an actual trainer to sign up.

**My pick: A.** Lowest risk + matches the pattern we already have for Featured/Challenges.

---

## 2. Featured Workouts — Will's Hypertrophy ✓ already gated

**File:** `client/src/pages/FeaturedWorkoutSession.jsx` + data inside `Workouts.jsx`

Gated as of 2026-05-17 via `FF_FEATURED` + `FeaturedGate` route wrapper. Card on Workouts page is non-clickable with COMING SOON pill; direct `/featured-session` URL redirects to `/app`. **No action needed pre-launch.**

Note for post-launch: when ungating, sanity-check the demo Apple Review account works (they currently can't access this — make sure the unlock flow doesn't require something only WMartin23 has).

---

## 3. Challenges section — Max Push-Ups + Plank Hold mock ✓ already gated

**File:** `client/src/pages/Workouts.jsx` lines 3385-3530 (challenges view), 6004+ (MaxPushupsChallenge fetcher)

Inline mock data inside the challenges view:
- Challenge Card 1: "Max Push-Ups Challenge" with fake leaderboard entries, mock countdown
- Challenge Card 2: "Plank Hold Challenge" — labeled "Coming Soon" in the card itself
- Activity feed with hardcoded entries ("Yesterday — Challenge started — 128 participants", "2 days ago — You joined Max Push-Ups Challenge")

`MaxPushupsChallenge` component DOES fetch from real endpoints (`/challenges/max-pushups/leaderboard`, `/challenges/max-pushups/my-entry`) — so there IS a backend. But the rest is placeholder.

Gated as of 2026-05-17 via `FF_CHALLENGES`. The non-interactive card is the only visible surface; the inline view + MaxPushupsChallenge component are only reachable with the flag set. **No action needed pre-launch.**

Note for post-launch: if the Max Push-Ups challenge is real (has working backend), unlocking should be straightforward. The Plank Hold + activity-feed mock entries should be replaced with real data or removed when ungating.

---

## 4. AI Workout Generator — Pro-gated, but functional?

**File:** `client/src/pages/AIWorkoutGenerator.jsx`
**Surface:** Behind Pro paywall in Upgrade.jsx PLANS array

Listed as Pro-tier in `client/src/pages/Upgrade.jsx` PLANS array. The Anthropic Claude API integration is configured server-side per `_marketing/privacy-nutrition-answers.md` (active vendor with token tracking per user). So this is real, not mock.

Apple risk: low if Pro is hidden on iOS per 3.1.1. **No action needed if iOS hides the paywall.**

---

## 5. Test pages — TestRoute-gated ✓ safe

Multiple pages exist at `/test/*` routes wrapped in `TestRoute`. The route gate restricts access to a hardcoded `TEST_EMAILS` list in App.jsx. Apple Review demo account won't be in that list, so reviewers can't reach these. Files:

- `/test/landing` → LandingPageTest.jsx
- `/test/landing-aurora` → LandingPageAuroraTest.jsx
- `/test/cards` → CardsTest.jsx
- `/test/nike` → NikeTestHomepage.jsx
- `/test/new-homepage` → NewHomepage.jsx
- `/test/feed` → RepLabFeedTest.jsx
- `/test/parallax` → ParallaxAnimation.jsx
- `/test/login-screens` → LoginScreensTest.jsx
- `/test/navbars` → NavbarsTest.jsx
- `/test/brainstorm` → Brainstorm.jsx
- `/test/progressive-overload` → ProgressiveOverloadTest.jsx
- `/test/request-trainer` → RequestTrainerTest.jsx
- ...etc

**No action needed.** Even if a reviewer typed the URL, TestRoute bounces them.

---

## 6. Programs library — verify after Path A cleanup

Live programs in production DB as of 2026-05-17 (post-Path A):

- Will's Hypertrophy Program (gated as Featured — not user-accessible)
- Jeff Nippard's Push Pull Legs
- Jim Stoppani's Shortcut to Shred
- Robin Gallant's Intensive Max Glute Hypertrophy
- Muscle & Fitness 5000 Rep Arm Specialization
- Katie Sonier's 6-Week Glute Building
- Mike Mentzer Workout (per migration history)
- Athlean-X Summer Shred (renamed from "Summer Shred")
- Bro Split Workout
- Glute Hypertrophy (6-week)

**Action item:** before listing the description-block program names to reviewers, **verify the actual current list** by running:
```sql
SELECT id, name, COALESCE(LENGTH(description), 0) AS desc_len
FROM programs
WHERE user_id IS NULL
ORDER BY sort_order;
```
The description blocks for some of these (Mike Mentzer, Athlean-X, Bro Split, Glute Hypertrophy) haven't been verified against current state. If any have empty templates or are "Coming Soon" stubs, either populate or hide them.

---

## 7. Welcome email content

**File:** `_marketing/current-welcome-email.html`

Used for new signups via Resend. The Resend integration has an **open issue** flagged by Will on 2026-04-30 (see PRE-LAUNCH.md). Until that's resolved, new users may not actually receive welcome emails. Reviewers may not notice (they'll already be logged in via the demo account), but worth confirming.

---

## 8. Trainer profile cards on RequestTrainerTest

**File:** `client/src/pages/RequestTrainerTest.jsx`

Already gated under `/test/request-trainer` (TestRoute). Reviewers can't reach this. No action.

---

## 9. Pro-tier feature mentions in Upgrade.jsx

**File:** `client/src/pages/Upgrade.jsx`

Lists Pro + Elite tier features: AI Workout Generator, featured trainer workouts, advanced analytics, custom program builder, video exercise guides, nutrition tracking, direct trainer chat. Some of these (custom program builder, video exercise guides) appear to work in the free tier already. Others (nutrition tracking, trainer chat) may not be implemented yet.

Apple risk: low — paywall is hidden on iOS per 3.1.1, reviewers won't see the upgrade screen. **No action needed.**

If the upgrade screen does end up visible on iOS, audit the feature list to make sure every listed feature is actually unlock-able by a paying user.

---

## Pre-launch action items extracted from this audit

| Priority | Item | Effort | Owner |
|---|---|---|---|
| **High** | Gate the Trainers section (Option A) — `FF_TRAINERS` flag + card non-interactive + section guard | 15 min | Will / agent |
| **High** | Verify the actual programs in production DB match the description block | 5 min query | Will |
| **Medium** | Resolve the open Resend email issue from 2026-04-30 | unknown | Will |
| **Low** | Decide which Pro features are real vs aspirational on Upgrade.jsx | 15 min | Will |
| **Low** | Post-launch checklist for ungating: Featured (check WMartin23-only access doesn't leak), Challenges (replace mock activity feed) | — | Will (post-launch) |
