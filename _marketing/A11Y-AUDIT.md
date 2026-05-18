# REPLAB — Pre-App-Store Accessibility Audit (Post-`bc8f3e5` Pass)

**Date:** 2026-05-17
**Scope:** `client/src/pages/**` (ship-routes only — Test*-prefixed pages skipped), `client/src/components/**`, server-rendered HTML in `server/userGuide.js`, `server/routes/trainer.js`, `server/routes/workoutDashboard.js`, `server/routes/shop.js`.

## Overall posture: YELLOW

The Apple submission a11y pass (commit `bc8f3e5`) materially upgraded the baseline. Specifically: a global `:focus-visible` outline, `prefers-reduced-motion` blanket override, a shared `useFocusTrap` hook, properly-bound `<label htmlFor>` across the auth flow, `aria-label`s on the ExerciseCard set inputs (the highest-volume interaction on the app), an `sr-only` `<h1>` on the three top-level routes (`/app`, `/workouts/session/*`, `/profile`), a `<title>` and `lang="en"` on the SPA shell, and `role="dialog" + aria-modal="true" + focus trap` on the WorkoutSession dialogs, ExerciseCard delete prompts, ConfirmOverwriteModal, AddCardioModal, PlateCalculatorModal, and Tutorial intro/choice modals.

What's still missing falls into three buckets: **(a)** ~25 secondary modals still rendered as raw `<div className="fixed inset-0">` without a dialog role or focus trap (Calendar's picker + prompts, Workouts share/invite modals, Profile delete-account & photo menu, FeaturedWorkoutSession share sheet, VideoPlayerModal, UnsavedGuard, SwapModal); **(b)** secondary forms (CreateWorkout / CreateProgram / EditWorkout / Utilities / and the server-rendered trainer + client-workout dashboards) have visible `<label>` text but no `htmlFor` binding; **(c)** announcement gaps — error blocks, the offline/sync banner, PB toasts, and undo toasts have no `aria-live`/`role="alert"`, so VoiceOver hears none of them.

**Findings: ~64 total — 9 blocking, 24 high, 21 medium, 10 low.**

---

## Blocking (Apple-rejection / WCAG Level A risk)

| # | Finding | Category | File:line | Recommendation |
|---|---|---|---|---|
| B1 | Delete Account modal has no `role="dialog"`, `aria-modal`, `aria-labelledby`, no focus trap, no focus return to trigger. Destructive flow — VoiceOver users won't hear "Delete Account" or the warning copy. | D | client/src/pages/Profile.jsx:1329 | Wrap the inner panel ref in `useFocusTrap(showDeleteAccount)`, add `role="dialog" aria-modal="true" aria-labelledby="profile-delete-title" aria-describedby="profile-delete-desc"`, give the `<h3>` at 1341 the matching id, give the `<p>` at 1342 the desc id. |
| B2 | Calendar workout-picker modal (the main "tap a day → assign workout" surface) has no `role="dialog"`, no focus trap. | D | client/src/pages/Calendar.jsx:1201 | Wire `useFocusTrap(!!editingDay)`; add `role="dialog" aria-modal="true" aria-labelledby="cal-picker-title"`; id the `<h3>` at 1212. |
| B3 | Calendar Rest-Day, Clear-Calendar, Clear-Calendar-Completed-warn, Copy-conflict prompts — five additional modals, none with dialog roles or focus traps. | D | client/src/pages/Calendar.jsx:1445, 1554, 1592, 1642 | Same pattern as B2; one `useFocusTrap` per modal, paired with `role="dialog" aria-modal="true"` and an `aria-labelledby` on the panel heading. |
| B4 | Profile photo menu (Change Photo / Remove Photo) — modal with no `role="dialog"`, no focus trap. | D | client/src/pages/Profile.jsx:1275 | Same fix as B1. Add a heading element first (currently the modal has no title at all). |
| B5 | Workouts share-user / invite modals — 13 modal containers, none with `role="dialog"`. | D | client/src/pages/Workouts.jsx (all `fixed inset-0` modals) | Audit each; wrap inner panel with `useFocusTrap` + add dialog ARIA. |
| B6 | FeaturedWorkoutSession share sheet (Save / Share / Save Image) has no dialog role, no focus trap. | D | client/src/pages/FeaturedWorkoutSession.jsx:2307 | Add `role="dialog" aria-modal="true"` + `useFocusTrap(showShareMenu)`. |
| B7 | VideoPlayerModal — no `role="dialog"`, no focus trap. iframe-embedded video is the modal's main content; the `<h3>` at line 29 should be `aria-labelledby` target. | D | client/src/components/VideoPlayerModal.jsx:18 | Add ref via `useFocusTrap(true)`, `role="dialog" aria-modal="true" aria-labelledby="vpm-title"`, id the `<h3>`. |
| B8 | UnsavedGuard `UnsavedModal` — destructive-confirm modal (Leave Without Saving) lacks dialog role + focus trap. | D | client/src/components/UnsavedGuard.jsx:140 | Same pattern. Critical because keyboard users currently can Tab past the dialog into the page beneath it. |
| B9 | Server-rendered trainer login + workout-dashboard login forms: `<label>Email</label>` followed by `<input name="identifier">` with no `for`/`id` pair. VoiceOver reads "edit text" with no name on the most security-sensitive field. | C | server/routes/trainer.js:112-118, server/routes/workoutDashboard.js:87-93 | Add matching `for` / `id` attributes on each label+input pair. Also add `lang="en"` to the `<html>` tag (line 88 / 54). |

## High (WCAG AA / significant keyboard/SR impedance)

| # | Finding | Category | File:line | Recommendation |
|---|---|---|---|---|
| H1 | SwapModal (ExerciseCard) has no `role="dialog"`, no focus trap. | D | client/src/components/ExerciseCard.jsx:1113 | `useFocusTrap` on the inner ref, add `role="dialog" aria-modal="true" aria-labelledby="swap-title"`, id the `<h3>` at 1132. |
| H2 | Add-Exercise-Below inline dropdown (rendered inside the card, not a portal modal) — its search input has no `aria-label` and is `type="text"`. | C, E | client/src/components/ExerciseCard.jsx:981 | `aria-label="Search exercises"` + `type="search"`. (The dropdown is not a modal so no dialog role required.) |
| H3 | Server-rendered trainer dashboard / workout dashboard / shop pages — all `<label>` elements have no `for`/`id` pair on the input that follows (every form field across `server/routes/trainer.js`, `workoutDashboard.js`, `admin.js`). | C | server/routes/trainer.js (14 occurrences), server/routes/workoutDashboard.js (12), server/routes/admin.js (19) | Add `for`/`id` pairs on each; rg-replace pattern `<label>([^<]+)</label>\s*<input type=("text"|"password"|"email"|"tel"|"date")` → wrap or pair. |
| H4 | CreateWorkout, CreateProgram, EditWorkout, Utilities — visible `<label>` text with NO `htmlFor`. Tapping the label doesn't focus the input; SR users hear the label as separate text. | C | client/src/pages/CreateWorkout.jsx:291, 307, 318; client/src/pages/CreateProgram.jsx:93, 104; client/src/pages/EditWorkout.jsx:260, 271; client/src/pages/Utilities.jsx:859, 920, 931 | Add `htmlFor="…"` + matching `id="…"` on each pair. |
| H5 | Form-error blocks not announced. Auth errors (Login.jsx:133-148, Signup.jsx:185-189, Profile.jsx:1372-1374), Calendar picker error (Calendar.jsx:1262-1266) and CreateProgram error (CreateProgram.jsx:85-89) all render as plain `<div>` with no `role="alert"` and no `aria-live`. | K, H | client/src/pages/Login.jsx:134; client/src/pages/Signup.jsx:186; client/src/pages/Profile.jsx:1372; client/src/pages/Calendar.jsx:1263; client/src/pages/CreateProgram.jsx:86 | Add `role="alert"` (preferred for errors — implicit `aria-live="assertive"`) to each error container so the message is read when it appears. |
| H6 | Inputs lack `aria-invalid` when validation fails. After submitting Login/Signup with bad credentials, the focused input still announces "edit text, …" not "invalid entry". | K | client/src/pages/Login.jsx:153, 169; client/src/pages/Signup.jsx:196, 211, 226, etc. | Add `aria-invalid={!!error}` and `aria-describedby={error ? 'login-error' : undefined}` (with matching `id="login-error"` on the error div). |
| H7 | Layout's offline / syncing / synced banner changes state with no announcement to SR. | H | client/src/components/Layout.jsx:102, 108, 114 | Wrap the banner row in `<div role="status" aria-live="polite">` so the state flip ("You're offline" → "Syncing…" → "All changes synced") is read aloud. |
| H8 | PBCelebration toast (PR achievement) and UndoToast (Undo a destructive action) — both render without `role="status"` or `aria-live`. SR users hear nothing when they hit a new PR. | H | client/src/components/PBCelebration.jsx, client/src/components/UndoToast.jsx | Wrap the toast root with `role="status" aria-live="polite"` (polite — these are positive, not urgent). |
| H9 | Workouts library search-users input (invite-user modal). Placeholder only, no `aria-label`, no `type="search"`. | C | client/src/pages/Workouts.jsx:2593 | `aria-label="Search users"` + `type="search"`. |
| H10 | Workouts.jsx "Share workout" button is icon-only with `title="Share workout"` but no `aria-label`. `title` is unreliably announced on iOS. | A | client/src/pages/Workouts.jsx:2412 | Add `aria-label="Share workout"`. |
| H11 | Calendar picker search input lacks `aria-label` and uses `type="text"`. | C | client/src/pages/Calendar.jsx:1241 | `aria-label="Search workouts"` + `type="search"`. |
| H12 | Workouts edit-program-name input has no `aria-label`. | C | client/src/pages/Workouts.jsx:2240 | `aria-label="Program name"`. |
| H13 | Utilities exercise-list search input — no `aria-label`, `type="text"`. | C | client/src/pages/Utilities.jsx:876 | `aria-label="Search exercises"` + `type="search"`. |
| H14 | Profile change-password section — password inputs (currentPassword, newPassword, confirmNewPassword) — verify htmlFor binding present. (Spot check: appears wired at id `profile-delete-password` for delete; need to confirm same for change-password block at line ~1046+.) | C | client/src/pages/Profile.jsx:1046, 1061, 1076 | If unbound, add matching `htmlFor`/`id`. |
| H15 | Skip-to-content link missing entirely. Keyboard users on any page must Tab through the entire top chrome (logo + profile avatar + offline/sync banner) before reaching `<main>`. | D | client/src/components/Layout.jsx (top of return) | Add `<a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] bg-wf-red px-3 py-2 text-white">Skip to content</a>` as first child, and give the `<main>` `id="main"`. |
| H16 | `<div onClick={…}>` patterns are inaccessible to keyboard / SR. The `NikeCard` helper in NewHomepage exposes this everywhere it's used with `onClick`. Generic cards in Calendar (week rows), Workouts library grid, History sessions, Profile cards are mostly `<button>` wrappers — but verify any card-level click that's a `<div>`. | E | client/src/pages/NewHomepage.jsx:25-39; spot-check usages | Convert to `<button type="button">` (preserves keyboard + role); or add `role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}`. |
| H17 | Server-rendered sidebar (`server/routes/trainer.js:156-179` and `workoutDashboard.js:131-147`) uses `<div onclick="toggleSection(...)">` with no `role="button"`, no `tabindex`, no keyboard handler. Keyboard users can't expand/collapse sections. | E | server/routes/trainer.js:156, 165, 172; server/routes/workoutDashboard.js:131, 140 | Convert each `<div class="sidebar-section">` to `<button class="sidebar-section" type="button" aria-expanded="false">…</button>`. |
| H18 | FeaturedWorkoutSession "Tap a week to expand" header is a `<div onClick>` — should be a `<button>` (line 1257 area). | E | client/src/pages/FeaturedWorkoutSession.jsx:1257 | Replace `<div onClick={…}>` with `<button type="button" aria-expanded={isExpanded}>`. |
| H19 | Touch target undersize — `ExerciseCard.jsx:267` full-screen ⛶ button is `h-6 w-6` (24×24px), Plate Calc (`h-7 w-7`, 28×28) and PRs (`h-7`) buttons in the header are also below 44×44. Apple HIG requires 44pt minimum and the existing audit explicitly called this out. | I | client/src/components/ExerciseCard.jsx:267, 295, 314, 327 | Either bump to `h-11 w-11` (44px), or add invisible padding via `before` pseudo-content to expand the hit area while keeping the visual icon small. |
| H20 | StickyHeader gear/back/close buttons across pages (often `w-8 h-8` = 32×32) — flag for the Apple reviewer to check on a real device. | I | client/src/components/StickyHeader.jsx + most usages | Same fix: ensure `min-h-[44px] min-w-[44px]` on every icon-only header button, or add a touch-area `::before` overlay. |
| H21 | ConfirmOverwriteModal close button: SwapModal close button (ExerciseCard.jsx:1133) is `text-wf-gray-400 active:opacity-70` — `text-wf-gray-400` is `#9ca3af` on the dark gradient panel. AA contrast is borderline; combined with no visible focus-visible-equivalent on a fully-styled element. | F | client/src/components/ExerciseCard.jsx:1133 | Bump to `text-white/80` or `text-wf-gray-300`. |
| H22 | Heading hierarchy in WorkoutSummary — only `<h2>` exists (line 520 of WorkoutSession.jsx). When SessionSummary renders WorkoutSummary at `/sessions/:id/summary` the page has no `<h1>`. | G | client/src/pages/WorkoutSession.jsx:4240 (WorkoutSummary) / client/src/pages/SessionSummary.jsx | Add `<h1 className="sr-only">REPLAB Workout Summary</h1>` inside WorkoutSummary, or promote the existing h2 at 520. |
| H23 | Calendar swipe-to-edit chevrons / day-hop arrows (and FeaturedWorkoutSession week-card expand chevrons) — verify all have `aria-label` and an `aria-expanded` where toggling. | A | client/src/pages/Calendar.jsx, FeaturedWorkoutSession.jsx | Each chevron-only button needs `aria-label` describing the action (e.g. "Expand week 3") and `aria-expanded={isExpanded}`. |
| H24 | Workouts.jsx "All Workouts" back link at 4001 — flag of icon plus visible text, OK at first glance, but verify the parent collapse button at the same level has `aria-expanded`. | A | client/src/pages/Workouts.jsx:4001 + neighbors | Audit the cluster; flag any toggle without `aria-expanded`. |

## Medium (best practice / careful reviewer)

| # | Finding | Category | File:line | Recommendation |
|---|---|---|---|---|
| M1 | The Demo button in the exercise card header (around 327-336) has visible "Demo" text but no `aria-expanded` despite toggling a panel. | A, E | client/src/components/ExerciseCard.jsx:327 | Add `aria-expanded={showDemo}` and `aria-controls="…"`. |
| M2 | The "Skip" link on Welcome.jsx (~line 140) uses `text-white/40` on dark gradient at 10px — borderline AA on small text. | F | client/src/pages/Welcome.jsx:140 (range) | Bump alpha to 0.55+ or font-size to 12px+. |
| M3 | Profile member-info eyebrows (`text-white/30` at 10px around lines 560, 567, 573) — same borderline contrast. | F | client/src/pages/Profile.jsx:560-578 | Use `text-white/50` minimum on caption text. |
| M4 | Workouts hero captions: `text-white/25` at small sizes on dark gradient hero. | F | client/src/pages/Workouts.jsx (hero) | Bump alpha as above. |
| M5 | BottomNav inactive tab labels: `rgba(255,255,255,0.45)` at 9px font-weight-bold uppercase. 9px is below the 10px floor most reviewers expect. | F | client/src/components/BottomNav.jsx:100-110 | Bump to 10px (already audited in AUDIT-ACCESSIBILITY.md — confirm fixed). |
| M6 | BottomNav SVG icons (line 14-52) are decorative (label is sibling `<span>`) but lack `aria-hidden="true"`. SR will announce "image" + label. | H | client/src/components/BottomNav.jsx:14, 29, 39, 48 | Add `aria-hidden="true"` to each tab's outer `<svg>`. |
| M7 | Tutorial component has many `<svg>` decorative icons — verify each is `aria-hidden="true"`. | H | client/src/components/Tutorial.jsx | Spot-audit; tutorial copy IS already wrapped in proper dialog ARIA. |
| M8 | `userGuide.js` server-rendered page has no `lang` attr and no skip link. | G | server/userGuide.js:6 | `<html lang="en">` + add a skip link. |
| M9 | `userGuide.js` table of contents links — `.toc .sub` uses `color: rgba(255,255,255,0.35)`. AA-borderline on small text. | F | server/userGuide.js:27 | Bump to 0.55. |
| M10 | `<select>` elements throughout — appearance is custom-styled (overlay span shows shorthand), but the `<select>` itself is `color: transparent`. VoiceOver still reads the current `<option>` text, but visual users with low vision who rely on system text size won't see the value if zoomed. | F, C | client/src/components/ExerciseCard.jsx:535-545; client/src/index.css `.exercise-card-light-test select`, `.exercise-card-transparent-test select` | Verify on real device with VoiceOver + Larger Text setting. If illegible, drop `color: transparent` and overlay text via `::after` pseudo-element instead. |
| M11 | Profile `MetricInput` (Profile.jsx:154) wraps `<span>` + `<input aria-label={…}>`. The visible label is the span, but the span isn't a `<label>`, so click-to-focus is broken. | C | client/src/pages/Profile.jsx:155 | Wrap the whole row in `<label>` (treating the inner `<input>` as the only form control), and remove the redundant `aria-label`. |
| M12 | Profile `HeightInput` — same shape as MetricInput; same fix. | C | client/src/pages/Profile.jsx:201 | Same. |
| M13 | LandingPage / NewHomepage hero — many CSS animations now respect `prefers-reduced-motion` thanks to the global rule in index.css:1047, but verify by toggling the OS setting. | J | client/src/index.css:1047 | Verified rule exists. Confirm in QA on iPhone with Reduce Motion ON. |
| M14 | The "Personal Records" ticker on Profile.jsx (~590) auto-scrolls (`PRTicker` uses `@keyframes prTicker`). It runs continuously. The global reduced-motion rule sets `animation-iteration-count: 1` which stops the marquee — but verify that's the desired UX. | J | client/src/pages/Profile.jsx:613; client/src/index.css:611 (prTicker) | Confirm reduced-motion stops the ticker. Acceptable trade-off. |
| M15 | InstallPrompt component (Layout.jsx:144) — render as a dialog? It's a dismissable banner, not a focus-trapping modal — acceptable as a `role="region" aria-label="Install app"`. | D | client/src/components/InstallPrompt.jsx | Add `role="region" aria-label="Install REPLAB"`. |
| M16 | Server-rendered `<title>` is `REPLAB Trainer — ${title}` etc. — fine. But the same pages render `<h1>` with HTML-string interpolation (e.g. trainer.js:294 — `Trainer Dashboard${isAdmin ? ' <span>ADMIN</span>' : ''}`). The `<span>` inside the `<h1>` makes "ADMIN" part of the heading text — acceptable. | G | server/routes/trainer.js:294 | OK; flag for completeness only. |
| M17 | The `<h2 className="sr-only">` for SessionSummary error-state and loading-state would let SR users navigate by heading. Currently they get a visual eyebrow + h2 but no h1 at all. | G | client/src/pages/SessionSummary.jsx:54 | Add `<h1 className="sr-only">REPLAB Workout Summary</h1>` to error + loading branches. |
| M18 | Workouts.jsx 4271, 4299, 4419, 4551, 4789, 6239, 6247 — share/community thumbnail `<img alt="">`. Empty alt is correct for purely decorative thumbnails next to a name string. OK. (Confirmed correct.) | B | client/src/pages/Workouts.jsx | None; verified. |
| M19 | The Calendar modal close buttons (e.g. line 1222 → `aria-label="Close"`) — VoiceOver announces "Close, button" which is generic. "Close picker", "Close confirm" reads more clearly. | A | client/src/pages/Calendar.jsx:1222 and 4-5 similar | Use `aria-label="Close workout picker"` etc. |
| M20 | All Workouts.jsx modal-panel close buttons — same "generic Close" treatment. | A | client/src/pages/Workouts.jsx (multiple modals) | Same. |
| M21 | The exercise full-screen mode page has Next/Prev arrows with proper `aria-label="Previous exercise"`/"Next exercise" (verified at WorkoutSession.jsx:2234/2254). But verify there's no other navigation indicator for the SR user that they're on exercise N of M. | A | client/src/pages/WorkoutSession.jsx:2244 | Confirmed — the "Exercise N of M" `<span>` at 2245 IS read aloud after the button label. OK. |

## Low (cosmetic / pedantic)

| # | Finding | Category | File:line | Recommendation |
|---|---|---|---|---|
| L1 | The Calendar component contains ~33 decorative `<svg>` elements; none carry `aria-hidden="true"`. SR announces "image" on each one. Cumulative noise. | H | client/src/pages/Calendar.jsx | Add `aria-hidden="true"` to every decorative `<svg>`. |
| L2 | Workouts.jsx — same pattern, 100+ decorative SVGs without `aria-hidden`. | H | client/src/pages/Workouts.jsx | Same. |
| L3 | Profile.jsx — 15+ decorative `<svg>` lacking `aria-hidden`. | H | client/src/pages/Profile.jsx | Same. |
| L4 | ExerciseCard.jsx — most decorative `<svg>` in the header cluster DO have `aria-hidden="true"` (lines 275, 307, etc.) — but the SVGs inside set rows (checkmark, move chevrons in 369/374, swap arrow 380) are mixed. | H | client/src/components/ExerciseCard.jsx | Audit and apply `aria-hidden="true"` uniformly. |
| L5 | Welcome.jsx tour-step icons (lines 10, 19, 28, 37 of the steps array) — decorative SVGs, no `aria-hidden`. | H | client/src/pages/Welcome.jsx | Same. |
| L6 | Signup gender pills (Signup.jsx:308-324) are `<button>` with visible text — OK. But `aria-pressed={gender === g}` would communicate toggle state. | A | client/src/pages/Signup.jsx:308 | Add `aria-pressed={gender === g}`. |
| L7 | `WaitingList.jsx` heading uses `<h1 className="text-3xl md:text-4xl…">` — OK. Verify `<main>` landmark wraps the content. | G | client/src/pages/WaitingList.jsx:82, 124 | Verify; if missing, wrap. |
| L8 | NotFound.jsx uses `<h1>` — good. Verify it includes a "Skip to home" or "Return to homepage" link. | G | client/src/pages/NotFound.jsx:25 | Spot-check; usually fine. |
| L9 | The exercise-card "Demo" button visible text appears as a small uppercase pill — visible, but the `<button>` itself doesn't have `aria-expanded={showDemoLocal}`. | A | client/src/components/ExerciseCard.jsx:327 | Add `aria-expanded={showDemoLocal} aria-controls="…"` for cleaner SR experience. |
| L10 | The exercise card "checkmark" buttons (line 504-520) have `aria-label={isCompleted ? 'Mark set incomplete' : 'Mark set complete'}`. Good. But these are conceptually checkboxes; `role="checkbox" aria-checked={isCompleted}` reads more naturally. | A | client/src/components/ExerciseCard.jsx:504 | Optional polish — switch to `role="checkbox" aria-checked={isCompleted}` and remove the conditional aria-label. |

---

## Verified clean (the `bc8f3e5` work that's still landed correctly)

- **client/index.html** — `lang="en"` (line 2), `<title>` set (18), viewport DOES include zoom (`width=device-width, initial-scale=1.0, viewport-fit=cover`, no `user-scalable=no`). Apple-review-friendly.
- **client/src/index.css:1027-1040** — `:focus-visible` outline 2px wf-red, plus separate inset ring for `input:focus-visible / textarea:focus-visible / select:focus-visible`. Confirmed.
- **client/src/index.css:1047-1056** — `@media (prefers-reduced-motion: reduce)` zeroes out animation-duration and transition-duration globally. Confirmed.
- **client/src/hooks/useFocusTrap.js** — proper WAI-ARIA dialog focus trap: focuses first focusable on open, traps Tab/Shift-Tab to cycle inside, restores focus to `previouslyFocused` on close. Confirmed.
- **client/src/pages/Login.jsx, Signup.jsx, ForgotPassword.jsx, ResetPassword.jsx, WaitingList.jsx** — every form `<input>` has a matching `<label htmlFor="…" id="…">` pair. Confirmed.
- **client/src/components/ExerciseCard.jsx:573, 608, 635** — weight & reps inputs have `aria-label={\`Set ${idx + 1} weight\`}` etc. The highest-volume interaction in the app is now SR-accessible. Confirmed.
- **client/src/components/ExerciseCard.jsx:802, 842** — "Delete set" and "Confirm delete last" confirms are `role="dialog" aria-modal="true" aria-labelledby="…"` with focus traps. Confirmed.
- **client/src/components/ConfirmOverwriteModal.jsx:50** — `role="dialog" aria-modal="true"` + `useFocusTrap`. Confirmed.
- **client/src/components/AddCardioModal.jsx:188** — dialog roles + focus trap + `aria-labelledby="add-cardio-title"` matching the `<h2 id="add-cardio-title">` at 215. Confirmed (exemplar implementation).
- **client/src/components/PlateCalculatorModal.jsx:103** — `role="dialog" aria-modal="true"`. Confirmed.
- **client/src/components/Tutorial.jsx:114, 188** — both intro + choice modals carry full dialog ARIA. Confirmed.
- **client/src/pages/WorkoutSession.jsx** — 8 modal patterns (begin-prompt, prebegin-summary, date-confirm, pending-swap, add-exercise, PR modal, section-edit, session-menu) all carry `role="dialog" aria-modal="true"` with paired `useFocusTrap` hooks. Confirmed (best-in-class).
- **Workouts.jsx:4019, WorkoutSession.jsx:3773** — search inputs use `type="search"` and have `aria-label`. Confirmed.
- **client/src/pages/Profile.jsx:486, Workouts.jsx:4647, WorkoutSession.jsx:2205** — `<h1 className="sr-only">` ensures each top-level route has exactly one document-level h1. Confirmed.
- **All `<img>` tags audited** — every `<img>` has an `alt` attribute (decorative thumbnails use `alt=""` correctly; functional images carry meaningful text). Confirmed. No missing alts found.
- **No explicit `tabIndex={1}` or greater anywhere in `client/src`.** No tab-order anti-patterns. Confirmed.
- **client/src/components/StickyHeader.jsx:49** — emits `<h1>` for the title prop, so any page that renders `<StickyHeader title="…">` (Calendar, History, SessionDetail, Profile, Workouts, Utilities, Progress, Community, FeaturedWorkoutSession) automatically gets a document h1. Confirmed.

---

## Recommended fix order (highest impact / lowest cost first)

1. **B9 — Server-rendered `<label>` ↔ `<input>` binding** in trainer + workout-dashboard + admin routes. Trivial regex-replace; unblocks every server-rendered form for VoiceOver. *(~30 min)*
2. **H15 — Skip-to-content link in Layout.jsx.** Five lines of JSX; helps every keyboard user every page load. *(~5 min)*
3. **B1, B4 — Profile Delete Account + Photo Menu dialog ARIA.** Destructive flow + most-exercised modal on the page; high reviewer visibility. *(~20 min)*
4. **B2, B3 — Calendar's 5 modals.** Apply the same `useFocusTrap` + `role="dialog"` pattern that WorkoutSession.jsx already uses. *(~30 min)*
5. **B5, B6, B7, B8, H1 — Remaining modal cluster** (Workouts share modals, FeaturedWorkoutSession share sheet, VideoPlayerModal, UnsavedGuard, SwapModal). Same pattern, repeated. *(~1 hr)*
6. **H5, H7, H8 — Live-region polish.** `role="alert"` on form-error blocks, `role="status" aria-live="polite"` on offline/sync banner + PB toast + UndoToast. *(~20 min)*
7. **H19, H20 — Touch-target audit.** Bump ExerciseCard ⛶/⚖/PR header buttons to ≥44px, audit StickyHeader gear/close buttons. *(~30 min)*
8. **H4 — Bind labels in CreateWorkout / CreateProgram / EditWorkout / Utilities.** Trivial. *(~10 min)*
9. **H17 — Server sidebar `<div onclick>` → `<button>`.** Adds keyboard support to trainer + client dashboards. *(~15 min)*
10. **H16, H18 — Card-level `<div onClick>` → `<button>`.** NewHomepage `NikeCard` helper + the FeaturedWorkoutSession week-expand. *(~20 min)*

Estimated total: **~3.5 hours of focused work** to move the app from YELLOW to GREEN for App Review.
