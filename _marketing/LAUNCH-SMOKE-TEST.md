# RepLab Launch-Day Smoke Test

Run on a real iPhone against production. Target: ~30 min. Each step should resolve in under 60 seconds.

---

## Pre-Flight (Infra)

1. [ ] Hit `https://<prod-domain>/health` in browser → JSON returns `status: "ok"` with non-zero `uptime`.
2. [ ] Open Render dashboard → web service is `Live`, no recent restarts, postgres add-on shows `Available`.
3. [ ] Confirm latest Postgres backup timestamp is within the last 24h (Render → DB → Backups).
4. [ ] Sentry: trigger a test error (visit a known throwing route or use Sentry test button) → event appears in Sentry within 60s.
5. [ ] PostHog: open the live events feed, then load the marketing page on the test phone → a `$pageview` event lands in PostHog within 60s.
6. [ ] Resend: send a test reset-password email to your own address → arrives in inbox within 2 min, links resolve to prod.
7. [ ] DNS / TLS: load prod URL on phone over LTE (not Wi-Fi) → page serves with valid cert, no mixed-content warnings.

---

## Auth: New User

8. [ ] Open prod URL in Safari → splash screen renders, `/login` loads cleanly.
9. [ ] Tap "Sign up" → `/signup` loads with email + password fields.
10. [ ] Submit a brand-new email + password → redirect lands on `/welcome` (onboarding).
11. [ ] Walk all the way through `/welcome` (intro slides + 1RM collection step) → exits to `/` (Workouts).
12. [ ] Workouts page renders — featured "Will's Hypertrophy" hero card is visible, no console errors, PR ticker animates.
13. [ ] Bottom nav shows four tabs: Workouts, Calendar, Utilities, Profile. Tap each in turn — every page loads without spinner-stuck or 404.

## Auth: Existing User + Recovery

14. [ ] Log out from Profile → lands on `/login`.
15. [ ] Log back in with the same credentials → lands on `/` (Workouts), no second onboarding.
16. [ ] Log out again, tap "Forgot password" → `/forgot-password` loads.
17. [ ] Submit your email → success message shown, reset email arrives via Resend.
18. [ ] Tap reset link on phone → opens `/reset-password/:token`, set a new password → redirected to login, sign in succeeds with new password.

---

## Featured Workout Flow (Will's Hypertrophy)

19. [ ] On Workouts, tap the Will's Hypertrophy hero card → program detail / weekly view opens with weeks listed.
20. [ ] Tap "Begin Program" / "Start Today" → confirmation modal → confirm → calendar gets populated (toast or success state shown).
21. [ ] From the program view, pick Week 1 / Day 1 → `FeaturedWorkoutSession` opens with exercise list (warm-up + working sets).
22. [ ] Tap "Start" / first set → log a set (enter a weight + reps, hit complete) → set marks as done, rest timer starts if applicable.
23. [ ] Tap an exercise's video thumbnail → video plays from the RepLab CDN (replab-videos.onrender.com) without 404.
24. [ ] Skip / fast-forward through remaining exercises → tap "Finish Workout" → `/summary/:id` loads with stats, PRs, body parts (or whatever pre-launch state allows).
25. [ ] Back out to Workouts → hero PR ticker now reflects any new PR set.

## Custom Workout Flow

26. [ ] From Workouts, navigate to "Create Program" → name a program, save → program appears in library.
27. [ ] Inside that program, create a new template (workout) with 1-2 exercises and at least one set each → save → template appears under the program.
28. [ ] Schedule the new template on today via Calendar (or program scheduler) → today's date shows the workout chip.
29. [ ] Tap the scheduled workout on Calendar → `WorkoutSession` opens → log one set → finish → SessionSummary renders → back returns to Workouts/Calendar cleanly.

## Calendar

30. [ ] Open `/calendar` → current week renders, today is highlighted, scheduled workouts visible.
31. [ ] Swipe / arrow to next week and back → no flicker, scheduled chips persist.

## History

32. [ ] Open `/history` → list shows the sessions logged in steps 24 and 29 (most recent first).
33. [ ] Tap one session → `/history/:id` (SessionDetail) opens with sets/reps/weights → back works.

## Utilities

34. [ ] Open `/utilities` → page renders, both tools tappable.
35. [ ] Open 1RM Estimator → enter weight + reps + lift → estimated 1RM appears, percentage breakdown table renders.
36. [ ] Open Plate Calculator (`/plate-calculator`) → enter a target weight → plate stack renders.
37. [ ] Open Exercise Library (`/exercises`) → list loads → tap an exercise → `/exercises/:slug` detail page renders with video.

## Profile + Account Deletion (Apple 5.1.1(v))

38. [ ] Open `/profile` → photo upload control, App Settings toggles, Body Metrics, Performance Metrics all render.
39. [ ] Toggle one App Settings switch (e.g., Bible Verses) → state persists after page refresh.
40. [ ] Edit Body Metrics (height/weight) and tap Save → "Saved!" confirmation; refresh page → values persist.
41. [ ] Scroll to bottom → "Delete Account" control is visible and tappable (not buried/invisible).
42. [ ] Tap Delete Account on a throwaway account from earlier → confirm → user is logged out, redirected to login. Try logging back in with that email → fails (account gone). Verify in admin DB that sessions/PBs/templates/metrics are wiped.

---

## Final Sanity

43. [ ] Force-quit Safari, reopen prod URL → still logged in (or login flow works), no stale-chunk blank screen.
44. [ ] Check Sentry for the last 30 min → no new unexpected errors from real-user traffic.
45. [ ] Check PostHog → events from this smoke run are visible (signup, page_visit, session_finished, etc.).
