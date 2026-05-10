# RepLab — Launch-Path Accessibility Audit

Read-only review. Findings only — no code changes made. Severity: HIGH = unusable for screen reader / Apple-review red flag, MEDIUM = degraded experience, LOW = polish.

---

## `client/index.html`

- **client/index.html:5** — Viewport contains `user-scalable=no` and no `maximum-scale`. Blocks pinch-zoom.
  Severity: **HIGH** (WCAG 1.4.4, common App Store / Play Store flag).
  Fix: drop `user-scalable=no` (and `maximum-scale=1` if added later); rely on iOS 10+ which already handles input-zoom suppression.
- **client/index.html:2 / 17** — `<html lang="en">` and `<title>` are present. OK.

---

## `client/src/components/Layout.jsx`

- **Layout.jsx:75** — `<img src="/RepLabLogo3.jpg" alt="RepLab" />` — alt is fine, but the avatar fallback `<div>` (line 84) renders an initial inside a button that already has `aria-label="Open profile"`, which is fine. OK.
- **Layout.jsx:95 / 101 / 107** — Offline / sync status pulse dots are decorative `<div>`s with no role. The text next to them carries the meaning. OK, but the live status changes (offline → syncing → synced) are not announced.
  Severity: **MEDIUM**. Fix: wrap the banner row in `<div role="status" aria-live="polite">` so SR users hear "syncing offline changes" when state flips.

---

## `client/src/components/BottomNav.jsx`

- **BottomNav.jsx:12-50** — Every `<svg>` icon is decorative (label is rendered as a sibling `<span>`) but none carry `aria-hidden="true"`. SR will announce "image" + tab label.
  Severity: **LOW**. Fix: add `aria-hidden="true"` to each tab `<svg>`.
- **BottomNav.jsx:97-112** — Label uses `text-[9px]` at `rgba(255,255,255,0.45)` for inactive tabs. 9px under font-bold uppercase + low alpha ≈ borderline contrast and below the 10px floor most reviewers expect.
  Severity: **MEDIUM**. Fix: bump to 10px or alpha 0.6.
- **BottomNav.jsx:67** — `NavLink` has only `active:scale-[0.97]` for press feedback and no visible `:focus` style. Keyboard users get no indicator.
  Severity: **MEDIUM**. Fix: add `focus-visible:ring-2 focus-visible:ring-wf-red`.

---

## `client/src/pages/Workouts.jsx`

- **Workouts.jsx (entire page)** — No `<h1>` exists; the page jumps straight to multiple `<h2>`/`<h3>`. The "WILL'S HYPERTROPHY PROGRAM" hero (line 3619/3712) is the most prominent and should be the page h1, OR "Workouts" should be the h1.
  Severity: **MEDIUM**. Fix: promote the hero or sticky-header title to `<h1>`.
- **Workouts.jsx:2639, 4179, 4207, 4327, 4459, 4696, 6111** — Avatar `<img alt="">` with empty alt is correct for purely decorative thumbnails next to a name string. OK.
- **Workouts.jsx:2409** — Share button has `title="Share workout"` but no `aria-label`, with only an SVG inside.
  Severity: **MEDIUM**. Fix: add `aria-label="Share workout"`.
- **Workouts.jsx:2248, 4008, 4292, 4424, 4734, 6058** — Search/text `<input>`s have placeholder only, no associated `<label>` or `aria-label` (the 4008 search has aria-label sibling buttons but the input itself doesn't). The 4008 input is also `type="text"` — should be `type="search"` for the iOS search keyboard.
  Severity: **MEDIUM** (HIGH for the 4008 search since it's the discovery surface). Fix: add `aria-label="Search programs"` and `type="search"`.
- **Workouts.jsx:2604** — Edit-program input lacks aria-label; placeholder unknown but it's renamed inline.
  Severity: **MEDIUM**. Fix: `aria-label="Program name"`.
- **Workouts.jsx:3700, 3726** — `heroAccentShimmer 8s linear infinite` and `kenBurns 18s ease-in-out infinite` run continuously with no `prefers-reduced-motion` opt-out.
  Severity: **MEDIUM** (vestibular trigger; Apple review increasingly flags). Fix: `@media (prefers-reduced-motion: reduce) { animation: none; }`.
- **Workouts.jsx 35+ low-contrast spans** — Lots of `rgba(255,255,255,0.25)` and `text-white/25` over a dark gradient hero with text under 12px (e.g. lines 3636-3638). Borderline; combined with `font-weight: 300` is below WCAG AA in places.
  Severity: **LOW–MEDIUM**. Fix: bump small captions to `0.5` alpha or use `text-wf-gray-400`.

---

## `client/src/pages/FeaturedWorkoutSession.jsx`

- **FeaturedWorkoutSession.jsx:1900, 1925** — Weight & reps `<input type="number" inputMode="decimal/numeric">` lack `aria-label`. Each row has visible "Weight"/"Reps" header columns elsewhere but the input's accessible name is empty.
  Severity: **HIGH** (every set logged silently for VoiceOver). Fix: `aria-label={\`Weight, set ${idx + 1}\`}` etc.
- **FeaturedWorkoutSession.jsx:2318** — `<img src={shareImage} alt="Workout summary" />` OK.
- **FeaturedWorkoutSession.jsx:1199, 1425, 1538** — Multiple `<h1>` on the same page (one per route phase). When more than one is rendered simultaneously this skips levels.
  Severity: **LOW**. Fix: pick one as the canonical h1 and demote the others to `<h2>`.

---

## `client/src/pages/WorkoutSession.jsx`

- **WorkoutSession.jsx (entire page)** — No `<h1>`; only `<h2>` at 3545. The active workout name should be the page h1.
  Severity: **MEDIUM**. Fix: promote workout-name heading to `<h1>`.
- **(via ExerciseCard.jsx) WorkoutSession's set inputs at ExerciseCard.jsx:388, 407, 433, 698, 864** — Weight/reps inputs have `inputMode` (good) but no `aria-label`. These are the primary interaction on this page.
  Severity: **HIGH**. Fix: `aria-label` per input.
- **WorkoutSession.jsx:2630** — Add-exercise search uses `type="text"`. Should be `type="search"` and have `aria-label="Search exercises"`.
  Severity: **MEDIUM**.
- **WorkoutSession.jsx — share/export modals at 2624, 2778, 2858, 3522, 3867** — All close buttons use `aria-label="Close"`. OK. But none of the modal containers carry `role="dialog"` / `aria-modal="true"`, and there is no focus trap — Tab walks back into the page beneath.
  Severity: **HIGH** (Apple guideline 1.4 / WCAG 2.4.3). Fix: wrap modal panel with `role="dialog" aria-modal="true" aria-labelledby="..."` and trap Tab inside the panel until close, returning focus to the trigger.

---

## `client/src/pages/Calendar.jsx`

- **Calendar.jsx (entire page)** — No `<h1>`; "SCHEDULE" is rendered inside `StickyHeader` (likely as a `<p>` or `<h2>`). Should be the page h1.
  Severity: **MEDIUM**.
- **Calendar.jsx:1131** — Picker search input has placeholder "Search workouts..." but no `aria-label` and `type="text"`.
  Severity: **MEDIUM**. Fix: `aria-label="Search workouts"` + `type="search"`.
- **Calendar.jsx:1092, 1324, 1405, 1503** — Backdrop-tap-to-close `<div onClick={...}>` containers — these are *not* the primary control (the Close `<button>` is), so they don't need `role="button"`. However the modal panels themselves (1094, 1328, etc.) lack `role="dialog"` / focus trap.
  Severity: **HIGH** (same as WorkoutSession).
- **Calendar.jsx — every `<svg>` in this file (33 instances)** lacks `aria-hidden="true"` even when adjacent to text labels.
  Severity: **LOW** (cumulative noise). Fix: add `aria-hidden="true"` blanket-style.

---

## `client/src/pages/Signup.jsx`

- **Signup.jsx:195, 209, 223, 242, 254, 269, 282, 298, 323, 340, 356, 369, 381** — Every `<label>` is a stand-alone `<label className=...>` *not* tied to its input via `htmlFor`/`id`. Click on the label doesn't focus the input; SR will announce label as separate text from input.
  Severity: **MEDIUM** (Apple review uses VoiceOver — they will hear "edit text" with no name). Fix: add matching `htmlFor`/`id`, or wrap input inside `<label>`.
- **Signup.jsx:151** — Back button has SVG + visible text "Back". OK.
- **Signup.jsx:301** — Gender pill `<button>`s have visible text. OK, but `aria-pressed={gender === g}` would help convey toggle state.
  Severity: **LOW**.
- **Signup.jsx — no visible `:focus` style** on inputs (`focus:outline-none` with no `focus-visible` replacement; the JS `focusInput` handler is on Login only).
  Severity: **MEDIUM**. Fix: `focus-visible:ring-2 focus-visible:ring-wf-red/40` on the `glass-input` Tailwind class or replace with native focus ring.

---

## `client/src/pages/Login.jsx`

- **Login.jsx:142** — Identifier input dynamically toggles `type` between `tel` and `text`. No `type="email"` ever — fine because the field accepts username/email/phone and `autoComplete="username"` is set. OK.
- **Login.jsx:141, 156** — `<label>` not bound via `htmlFor`. Same MEDIUM finding as Signup.
- **Login.jsx:34-41** — `focusInput` / `blurInput` set border + box-shadow inline, so a focus indicator does exist. OK.

---

## `client/src/pages/ForgotPassword.jsx` & `ResetPassword.jsx`

- **ForgotPassword.jsx:97 / ResetPassword.jsx:118, 131** — `<label>` not bound via `htmlFor`. Same as above. **MEDIUM**.
- **ForgotPassword.jsx:41 / ResetPassword.jsx:58** — Back buttons combine icon + visible "Back" text. OK.
- **ForgotPassword.jsx:74, ResetPassword.jsx:74, 91** — Decorative success-state `<svg>` lack `aria-hidden`. LOW.

---

## `client/src/pages/Welcome.jsx`

- **Welcome.jsx:10, 19, 28, 37** — Tour-step icon `<svg>`s (large, decorative — sit alongside title + description) lack `aria-hidden="true"`. LOW.
- **Welcome.jsx:236-252** — `maxInput()` returns `<label>` wrapping `<span>` + `<input>` — this *does* associate the label, but the visible label is the all-caps eyebrow text and the input is unlabeled to AT (the span isn't the `<label>` text per spec, it's just a child span). VoiceOver will read the span text as the label which works in practice. OK, borderline.
- **Welcome.jsx:248** — Bench/Squat/Deadlift inputs have `focus:outline-none` and no replacement. MEDIUM.
- **Welcome.jsx:140-147** — "Skip" link is `text-white/40` (alpha 0.40) at `text-[10px]` over a dark panel — borderline contrast. LOW.

---

## `client/src/pages/Profile.jsx`

- **Profile.jsx (entire page)** — No `<h1>`. The display name at 523 is `<h2>`. Promote to `<h1>`. **MEDIUM**.
- **Profile.jsx:159, 204, 215** — `WeightInput` / `HeightInput` use `<span>` for visible labels next to `<input>`. No `<label htmlFor>` association. SR users hear unlabelled "edit text".
  Severity: **MEDIUM**. Fix: wrap with `<label>` or add `aria-label={label}` to the input.
- **Profile.jsx:1046, 1061, 1076, 1279, 1289** — Password inputs *do* have sibling `<label>` but no `htmlFor`/`id`. Same fix.
  Severity: **MEDIUM**.
- **Profile.jsx:482** — Hidden file input — fine; the visible button at 490 has `aria-label="Change profile photo"`. OK.
- **Profile.jsx:536, 542** — `text-white/30` on dark gradient at `text-[10px]` — fails AA on small text.
  Severity: **MEDIUM**. Fix: `text-white/55` or larger size.
- **Profile.jsx — 15 `<svg>`s lack `aria-hidden`**. LOW.

---

## `client/src/pages/SessionSummary.jsx`

- **SessionSummary.jsx:54** — Page title rendered as `<h2>` ("error/summary heading"). Reasonable here because `WorkoutSummary` (rendered via re-export) presumably owns the document `<h1>`. Verify when reviewing `WorkoutSummary` itself. LOW.
- **SessionSummary.jsx:57** — "Back" button has visible text. OK.

---

## `client/src/components/ConfirmOverwriteModal.jsx`

- **ConfirmOverwriteModal.jsx:44-48** — Modal `<div>` has no `role="dialog"`, no `aria-modal="true"`, no `aria-labelledby` pointing at the `<h3>` at line 77. No focus trap; opening the modal does not move focus into it; closing does not return focus to the trigger.
  Severity: **HIGH** (this is a destructive-action confirmation — VoiceOver users won't hear "dialog opened" or the warning copy).
  Fix: `<div role="dialog" aria-modal="true" aria-labelledby="overwrite-title" aria-describedby="overwrite-desc">`, then `id="overwrite-title"` on the h3 and `id="overwrite-desc"` on the `<ul>` container; on open, focus the Cancel button; on close, return focus to the original trigger via a ref the parent passes in.
- **ConfirmOverwriteModal.jsx:57-68** — Warning `<svg>` lacks `aria-hidden`. LOW.
- **ConfirmOverwriteModal.jsx:107-115** — Checkbox is wrapped in `<label>`. OK.
- **ConfirmOverwriteModal.jsx:127-132** — `disabled` button uses `pointer-events-none` + opacity but the `disabled` attribute is also set, so SR will announce "dimmed". OK.

---

## Cross-cutting findings

1. **No `prefers-reduced-motion` handler anywhere in `client/`.** The Workouts hero, Featured hero, page-fade transitions, "btn-liquid" liquid wash, and `replab-spinner` all run unconditionally. **MEDIUM** project-wide.
2. **No `role="dialog"` on any of the ~12 modal patterns audited.** Combined with no focus trap, this is the single largest a11y debt for App Store review. **HIGH**.
3. **Pervasive `focus:outline-none` without `focus-visible` replacement** in 22 files. Keyboard / external-keyboard users have no indicator. **MEDIUM**.
4. **`<label>` rarely bound to inputs via `htmlFor`/`id`** anywhere in the launch path — even where labels exist. **MEDIUM**.
5. **Decorative `<svg>` icons almost never carry `aria-hidden="true"`.** Cumulative VoiceOver noise on every screen. **LOW**.
6. **Heading hierarchy** — Workouts, Calendar, WorkoutSession, Profile all skip `<h1>`. Each top-level route should own exactly one. **MEDIUM**.
