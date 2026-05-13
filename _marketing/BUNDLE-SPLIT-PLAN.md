# REPLAB Client Bundle Split Plan

_Generated 2026-05-01 from a clean `npm run build` against client v1.3.03._

## Current state

The Vite build produces one oversized chunk — `assets/index-*.js` at **946.51 KB pre-gzip / 264.96 KB gzipped**. Everything imported eagerly from `client/src/App.jsx` (and everything those modules transitively pull in) lands in that chunk: PostHog (`posthog-js`), Sentry (`@sentry/react`), React Router, all of `@capacitor/*` used at module scope, the five eagerly-imported page components (`Login`, `Signup`, `Workouts`, `Calendar`, `WorkoutSession`), and every shared utility / context they touch. The lazy chunks alongside it are healthy — `Profile` (44 KB), `Brainstorm` (45 KB), `FeaturedWorkoutSession` (85 KB) — so the win is in the main chunk, not the rest of the route map. Vite still warns "Some chunks are larger than 500 kB after minification."

### Build output (selected, sorted by size — full list in build log)

| Chunk | Pre-gzip | Gzipped |
|---|---:|---:|
| **assets/index-C1Ft_HC_.js** (main) | **946.51 KB** | **264.96 KB** |
| assets/index-P4o5lDWY.css | 89.80 KB | 16.10 KB |
| FeaturedWorkoutSession | 85.52 KB | 21.03 KB |
| CardsTest | 64.79 KB | 11.83 KB |
| Utilities | 46.74 KB | 11.41 KB |
| Brainstorm | 45.04 KB | 12.39 KB |
| Profile | 44.59 KB | 9.76 KB |
| NikeCardsTest | 34.57 KB | 7.51 KB |
| LoginScreensTest | 32.76 KB | 5.78 KB |
| AIWorkoutGenerator | 20.17 KB | 4.99 KB |
| NewHomepage | 20.11 KB | 4.48 KB |
| RepLabFeedTest | 19.74 KB | 6.54 KB |
| ProgressiveOverloadTest | 19.12 KB | 4.94 KB |
| WorkoutSessionTest | 18.05 KB | 3.20 KB |
| Upgrade | 15.93 KB | 3.57 KB |
| NavbarsTest | 14.86 KB | 3.90 KB |
| ExerciseDetail | 14.72 KB | 4.13 KB |
| CreateWorkout | 13.90 KB | 4.52 KB |
| EditWorkout | 12.82 KB | 4.15 KB |
| ParallaxAnimation | 12.37 KB | 3.99 KB |
| NikeTestHomepage | 11.43 KB | 3.24 KB |
| PlateCalculator | 11.33 KB | 3.47 KB |
| ExerciseLibrary | 9.88 KB | 2.83 KB |
| TutorialTest | 9.39 KB | 2.45 KB |
| Privacy | 9.34 KB | 2.52 KB |
| LandingPageAuroraTest | 9.30 KB | 3.32 KB |
| LandingPageTest | 9.09 KB | 3.38 KB |
| Welcome | 8.72 KB | 3.40 KB |
| Terms | 8.63 KB | 2.45 KB |
| Community | 8.35 KB | 2.96 KB |
| Test | 8.26 KB | 1.87 KB |
| Progress | 7.19 KB | 2.68 KB |
| LandingPage | 7.10 KB | 2.39 KB |
| WaitingList | 6.20 KB | 2.21 KB |
| FreeTrialOffer | 5.96 KB | 2.19 KB |
| ResetPassword | 5.13 KB | 1.97 KB |
| History | 5.03 KB | 2.02 KB |
| SessionSummary | 4.62 KB | 1.69 KB |
| TutorialWorkout | 4.44 KB | 1.41 KB |
| ForgotPassword | 4.36 KB | 1.83 KB |
| CreateProgram | 4.09 KB | 1.81 KB |
| AppStoreBadges | 3.68 KB | 1.28 KB |
| SessionDetail | 2.92 KB | 1.19 KB |
| (small splits / NotFound / web shim) | < 3 KB each | — |

### What is in the 946 KB main chunk

Every eager import in `client/src/App.jsx` (lines 1–46) plus the React/Router/Sentry/PostHog runtime:

- **Pages eagerly imported** (lines 41–46): `Login`, `Signup`, `Workouts`, `Calendar`, `WorkoutSession`
  - source sizes: Login 8 KB, Signup 18 KB, **Workouts 343 KB**, Calendar 102 KB, **WorkoutSession 222 KB** (raw source bytes — minified sizes are smaller but proportional)
- **Heavy deps loaded at module scope** via `main.jsx` / `App.jsx` / `Workouts.jsx` / `Calendar.jsx` / `WorkoutSession.jsx`:
  - `posthog-js` (full SDK, autocapture, surveys, replay shims) — ~80–100 KB gzipped solo
  - `@sentry/react` (`import * as Sentry`) — ~25–35 KB gzipped solo
  - `react-router-dom` — ~12 KB gzipped
  - `@capacitor/core` — ~3–5 KB gzipped (small, fine)
  - `date-fns` named imports — currently tree-shaken, ~6–8 KB gzipped for the functions actually used
  - `@dnd-kit/*` — only imported inside `ExerciseCard.jsx`, which is reached via WorkoutSession (eager) → so it's in the main chunk too. ~20 KB gzipped.

Pre-gzip, the React + Router + Sentry + PostHog runtime is roughly 350–400 KB; the five eager pages and their transitive utils are the rest.

---

## Top 10 recommendations (ranked by impact × effort)

### 1. Lazy-load `Workouts` (the dashboard) — keep the splash, defer the dashboard

- **What**: Convert `import Workouts from './pages/Workouts'` (App.jsx:44) to `const Workouts = lazyWithRetry(() => import('./pages/Workouts'))`.
- **Why**: Source is 343 KB — the single largest page in the app. It also drags in `TrainerProfile`, the trainer data tables, share utils, etc. It is reached only when an authenticated user hits `/app`; logged-out visitors hitting `/`, `/login`, `/signup`, `/privacy`, marketing landing, etc. should never download it.
- **Expected savings**: ~80–110 KB pre-gzip / **~22–28 KB gzipped** off the main chunk. Workouts becomes its own ~80 KB chunk (~22 KB gzipped).
- **Effort**: **S** (one line change + verify Suspense fallback already wraps `/app`). The route already sits inside the existing `<Suspense>` block in App.jsx:197.

### 2. Lazy-load `WorkoutSession`

- **What**: Convert App.jsx:46 to `lazyWithRetry`.
- **Why**: Source is 222 KB and it pulls `ExerciseCard` (~59 KB), which transitively imports **all of `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`**. Moving this page off-main removes `@dnd-kit` from the entry chunk. The session is only opened from `/calendar` or `/app`, never on first paint.
- **Expected savings**: ~110–140 KB pre-gzip / **~30–38 KB gzipped** (page code + dnd-kit + ExerciseCard transitives).
- **Effort**: **S** (one line change; route already inside `<Suspense>`).

### 3. Lazy-load `Calendar`, `Login`, `Signup`

- **What**: Convert App.jsx:42–45 to `lazyWithRetry`.
- **Why**: `Calendar` is 102 KB of source and pulls a large date-fns surface area. `Login` and `Signup` are smaller (8 KB / 18 KB) but are the public-route critical path — they don't need to ship in the same chunk that authenticated users download on `/app`, and vice versa. Splitting them lets each user type only pay for their starting route.
- **Expected savings**: ~50–70 KB pre-gzip / **~14–18 KB gzipped** off main (Calendar is the biggest of the three).
- **Effort**: **S** (3 one-line changes; routes already in `<Suspense>`).

### 4. Defer PostHog initialization off the critical path

- **What**: Today `main.jsx` imports `posthog-js` synchronously and calls `initAnalytics()` before React renders. Change to dynamic import inside `initAnalytics`:
  ```js
  export async function initAnalytics() {
    const key = import.meta.env.VITE_POSTHOG_KEY;
    if (!key) return;
    const { default: posthog } = await import('posthog-js');
    posthog.init(...);
  }
  ```
  Schedule `initAnalytics()` via `requestIdleCallback` (fallback `setTimeout(_, 0)`) so PostHog loads after first paint. `track()` / `identify()` / `reset()` already no-op when uninitialized, so the contract is preserved.
- **Why**: `posthog-js` is ~80–100 KB gzipped and is the single largest non-React dep in the bundle. None of it is needed for first paint — the SDK queues events internally once init returns, and our wrapper already silently no-ops missing init.
- **Expected savings**: ~200–260 KB pre-gzip / **~75–95 KB gzipped** off the main chunk. PostHog becomes its own deferred chunk.
- **Effort**: **M** (modify `utils/analytics.js`, `main.jsx`, and confirm every `track()` call still works when the SDK hasn't loaded yet — the wrapper already handles this).

### 5. Defer Sentry initialization (or use the lazy/loader build)

- **What**: Two options:
  - **A (lighter touch)**: Replace `import * as Sentry from '@sentry/react'` in `sentry.js` with a dynamic import gated on `VITE_SENTRY_DSN`, called from `requestIdleCallback`.
  - **B (cleanest)**: Switch to the [Sentry Loader Script](https://docs.sentry.io/platforms/javascript/install/loader/) injected into `index.html` — removes Sentry from the JS bundle entirely.
- **Why**: `@sentry/react` is ~25–35 KB gzipped at module scope. Errors during the first ~200 ms are rare; the loader / lazy-init approach catches global handlers from page-load time so we don't lose much coverage.
- **Expected savings**: ~70–100 KB pre-gzip / **~25–35 KB gzipped**.
- **Effort**: **M** for option A (1 file + verify ErrorBoundary still calls `Sentry.captureException` safely — that path is already guarded). **L** for option B (DSN now sits in HTML, need to wire CSP / build-time env injection).

### 6. Add a manualChunks split for the React + Router runtime

- **What**: Add to `vite.config.js`:
  ```js
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'dnd-kit': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
  ```
- **Why**: Pulls React (~45 KB gzipped) and Router (~12 KB gzipped) into their own long-lived, cacheable chunk. Doesn't reduce total bytes on a cold load, but on subsequent deploys the vendor chunk's hash rarely changes — repeat visits skip the 60 KB re-download. Also gives `@dnd-kit` a stable chunk if it isn't already isolated by lazy-loading WorkoutSession (rec #2).
- **Expected savings**: **~0 KB on first load**, but ~60 KB gzipped on every repeat visit until React or Router is bumped. Caching win, not a size win.
- **Effort**: **S** (config-only).

### 7. Confirm `date-fns` is tree-shaking (it is) — but consider `date-fns/format` vs named imports

- **What**: Current usage (e.g., `import { format, parseISO } from 'date-fns'`) is already tree-shakeable under `date-fns` v3 ESM. Audit the actual function count: Calendar pulls 11 functions, WorkoutSession 4, History/Profile/SessionDetail 2 each. Total unique surface is maybe 15 functions.
- **Why**: Replacing with `dayjs` would save ~5–8 KB gzipped at best and require rewriting `parseISO`, `startOfWeek`, `isSameWeek` etc., which dayjs only exposes via plugins. **Not worth it.** A larger win is letting lazy routes own their date-fns imports — once Calendar / WorkoutSession are lazy (rec #1–3), their date-fns surface area moves off the main chunk automatically.
- **Expected savings**: ~0 KB net from a switch; ~5–8 KB gzipped follows automatically from recs #1–3.
- **Effort**: **N/A** (no-op recommendation — documented to head off a future "should we replace date-fns?" thread).

### 8. Lazy-load the test-page routes behind a single check, not 19 separate splits

- **What**: The 19 `Test*` / `Nike*` / `*Test` lazy imports (App.jsx:73–92) already split correctly, but each carries its own `lazyWithRetry` wrapper. Consider gating the entire `/test/*` subtree behind a single lazy-loaded `<TestRoutes>` component so the test users (`willmartinmail@gmail.com`, `abilenerentals@gmail.com`) take one waterfall hit. **Optional polish** — current behavior is already correct.
- **Why**: Cleaner App.jsx, no actual size win since each test page is already its own chunk.
- **Expected savings**: ~0 KB. Code-organization win only.
- **Effort**: **M**. Skip unless we're refactoring App.jsx for other reasons.

### 9. Trim PostHog feature flags / autocapture if SDK can't be deferred

- **What**: If rec #4 is rejected, at minimum pass `autocapture: false`, `disable_session_recording: true`, `disable_surveys: true` to `posthog.init`. PostHog tree-shakes some surfaces when these flags are set at init time.
- **Why**: Session replay alone is ~30 KB gzipped of the PostHog bundle; it's never used by REPLAB. Surveys and autocapture add another ~15–20 KB.
- **Expected savings**: **~20–35 KB gzipped** depending on what we currently use (we only call `capture` + `identify` + `reset` per `utils/analytics.js` — none of autocapture / replay / surveys).
- **Effort**: **S** (3-line config change). Subsumed by rec #4 if we defer the whole SDK.

### 10. Lazy-load `BibleVerseOverlay` inside `WorkoutSession`

- **What**: WorkoutSession imports `BibleVerseOverlay` from `./BibleVerses` directly. Convert to `React.lazy(() => import('./BibleVerses').then(m => ({ default: m.BibleVerseOverlay })))` and gate behind whatever shows the overlay.
- **Why**: Once rec #2 lands, this is inside the WorkoutSession chunk and doesn't matter for main-chunk size — but it does improve WorkoutSession's first paint for users who never trigger the verse overlay.
- **Expected savings**: ~5–10 KB pre-gzip off WorkoutSession's chunk. Negligible for main-chunk goal.
- **Effort**: **S**. Low priority — only after recs #1–5.

---

## Quick wins (1 hour of work, ~120–150 KB gzipped off main)

If we only have time for the highest-leverage trio, do these in order:

1. **Rec #1 — lazy-load `Workouts`** (~25 KB gzipped saved; 1 line change).
2. **Rec #2 — lazy-load `WorkoutSession`** (~33 KB gzipped saved; 1 line change; also removes `@dnd-kit` from main).
3. **Rec #4 — defer PostHog init** (~85 KB gzipped saved; ~30 min change to `analytics.js` + `main.jsx`).

Cumulative expected gzipped savings: **~140–155 KB** → main chunk drops from 265 KB gzipped to roughly **115–125 KB gzipped** (~530–600 KB pre-gzip). Lighthouse TTI on slow 4G should drop ~1.0–1.5 s.

---

## Full plan — getting from 946 KB → under 600 KB pre-gzip

Execute in this order; verify after each step that the main chunk shrank and lazy chunks didn't balloon.

| Step | Change | Cumulative main-chunk size (gzipped, est.) |
|---|---|---:|
| baseline | — | 265 KB |
| 1 | Lazy-load `Workouts` (rec #1) | 240 KB |
| 2 | Lazy-load `WorkoutSession` (rec #2) | 207 KB |
| 3 | Lazy-load `Calendar` + `Login` + `Signup` (rec #3) | 190 KB |
| 4 | Defer PostHog with dynamic import (rec #4) | **105 KB** |
| 5 | Defer Sentry (rec #5, option A) | **80 KB gzipped** |
| 6 | Add `manualChunks` for React/Router/dnd-kit (rec #6) | 80 KB on first load, but cache-friendly across deploys |

**Target hit**: pre-gzip main should land around **350–450 KB** (well under 600 KB), gzipped around **80 KB**. The Vite "chunk > 500 KB" warning goes away.

### Risks / things to verify per step

- After rec #1–3: confirm `<Suspense fallback={<div className="min-h-screen bg-black" />}>` (App.jsx:197) is acceptable as the perceived loading state for `/app` and `/login`. Today those flash nothing because they're eager; afterwards they'll briefly show a black screen. Acceptable for a fitness app, but worth a UX check.
- After rec #4: verify event-loss window. Any `track()` call between page-load and `requestIdleCallback` firing will silently no-op. For REPLAB this is fine — none of the first-paint events are critical funnel signals. Test the auth signup funnel end-to-end after the change.
- After rec #5: confirm errors thrown during the first ~200 ms are still captured. The Sentry Loader Script (option B) catches `window.onerror` from HTML-parse time and is the safer choice if option A loses early errors in QA.
- After rec #6: vendor-chunk hash should stabilize across deploys; verify by running `npm run build` twice with no source changes and diffing the chunk filenames.

### What's intentionally NOT on the list

- **Replace `date-fns` with `dayjs`** — savings too small once Calendar/WorkoutSession go lazy (rec #7).
- **Drop `react-router-dom` for a lighter router** — ~12 KB gzipped, used everywhere, not worth a rewrite.
- **Inline-split `@capacitor/*`** — already small (~5 KB gzipped), and `Capacitor.isNativePlatform()` is called synchronously on every render of `App` so it can't easily go lazy without a refactor of `RootRoute`.
- **Image / video CDN audit** — not part of the JS bundle question.

---

_Plan generated for review — no code changes have been made. Awaiting approval on which recommendations to action._
