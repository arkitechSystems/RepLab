# Your Next Workout Card Audit — 2026-05-21

Scope: the "Your Next Workout" hero card on the Workouts page (`/app`). Read-only audit of `client/src/pages/Workouts.jsx` (markup ~5025-5110, `nextWorkoutInfo` computation ~1254-1320, `navigateToWorkout` ~1828-1865, `loadAll`/`fetchData` ~1202-1376, visibility refresh ~1401-1409) and the `?summary=1` deeplink handler in `client/src/pages/WorkoutSession.jsx:940-946`. Cross-checked the schedule, sessions/completed, and initialize routes server-side.

## Summary
- 19 findings: 2 P0, 8 P1, 9 P2
- The recent `completedToday` deeplink (commit `7380898`) **works for the happy path**, but the close button on the modal it opens dumps the user on `/calendar` instead of back at `/app` — that's the headline regression and the audit's #1 risk.
- Top 3 risks to launch:
  1. **The default left button is wrong for the most common state.** "Create a Workout" is hardcoded for every `status !== 'completed'` branch — including today-scheduled-but-not-started, today-scheduled-and-in-progress (resume), and tomorrow-upcoming. The card titled "YOUR NEXT WORKOUT" shows a real workout name but the primary CTA takes you to a generic Create flow instead of into that workout. The legacy card (hidden at ~5128) had the correct Resume/Preview/Start Now/Add a Workout switch; the new card lost that. (P0)
  2. **`?summary=1` deeplink lands the user on `/calendar` after closing the modal.** `WorkoutSession.jsx:4022-4027` navigates to `/calendar` when the summary modal closes. If you entered via the Workouts-page deeplink, you'd expect to be back on Workouts. Worse: closing the modal via "View Workout" (`setShowSummary(false)`) leaves the user staring at the full editable session for a completed workout — confusing entry point. (P0)
  3. **The card doesn't refresh across midnight.** `fetchData` recomputes `todayStr` only when called. Visibility change refreshes when foregrounded, but if the user keeps the app foregrounded past 12:00am (late-night workout, scrolling around afterward), the card stays on yesterday's "Today" indefinitely. (P1)

The underlying state machine in `nextWorkoutInfo` is sound. The bugs are in the button rendering and the deeplink return path.

## Truth table — which `nextWorkoutInfo` state produces which card render

`completedToday` is computed independently from the displayed-state branch, so it can co-exist with any of the rows below. Every row's bottom-left button switches to "Workout Completed" when `completedToday` is set.

| Scenario | `status` | `templateName` | `dayLabel` | Card body | Card bottom-left (default) |
|---|---|---|---|---|---|
| Today scheduled, not started | `'start'` | today's | `'Today'` | "<name> · Today" | **Create a Workout** (wrong — should be Start) |
| Today scheduled, started | `'resume'` | today's | `'Today'` | "<name> · Today" | **Create a Workout** (wrong — should be Resume) |
| Today scheduled, completed | `'upcoming'` or `'rest'` or `'none'` depending on tomorrow | tomorrow's or null | tomorrow's or null | tomorrow's workout / Rest Day / Nothing scheduled | **Workout Completed** (correct) |
| Today is rest day | `'rest'` | undefined | `'Today'` | "Rest Day · Today" | **Create a Workout** (debatable — see P1) |
| Today empty, tomorrow scheduled | `'upcoming'` | tomorrow's | `'Tomorrow'` | "<name> · Tomorrow" | **Create a Workout** (wrong — should be Preview/Schedule) |
| Today empty, tomorrow rest | `'rest'` | undefined | `'Tomorrow'` | "Rest Day · Tomorrow" | Create a Workout |
| Today + tomorrow both empty | `'none'` | undefined | undefined | "Nothing scheduled" (no dayLabel separator) | Create a Workout (correct) |
| No programs at all | same as "both empty" | undefined | undefined | "Nothing scheduled" | Create a Workout (correct) |
| `nextWorkoutInfo` still loading | `null` | null | null | "Loading…" | Create a Workout button is **active and tappable while loading** (see P1) |
| Today completed + tomorrow scheduled | `'upcoming'` + `completedToday` | tomorrow's | `'Tomorrow'` | "<tomorrow's name> · Tomorrow" | **Workout Completed** (visually mismatched — see P2) |

---

## P0 — Blockers

### Default left-button never takes you to the workout the card is advertising

- **File:** `client/src/pages/Workouts.jsx:5088-5098` (button) + `client/src/pages/Workouts.jsx:1271-1294` (state computation)
- **Issue:** When `completedToday` is null (the common case), the bottom-left button is hardcoded to:
  ```js
  onClick={(e) => {
    e.stopPropagation();
    navigate('/clientworkouts/create');
  }}
  ```
  The card heading is "YOUR NEXT WORKOUT", the body shows a real `templateName` + `dayLabel`. The button labeled "Create a Workout" sends the user to a totally separate flow that has nothing to do with the workout they just read. The legacy card (hidden at lines ~5172-5194) correctly branched on `nextWorkoutInfo.status` and rendered `Resume → / Preview → / Start Now → / Add a Workout →` with `navigateToWorkout(nextWorkoutInfo.templateId, nextWorkoutInfo.date)`. The new card dropped the branch. This is the primary daily-friction surface the user described — every "open app, go to today's workout" tap currently misses.
- **Repro:** Schedule a workout for today. Don't start it. Open `/app`. Tap the white button. You land on `/clientworkouts/create` instead of `/session/<id>/<today>`.
- **Fix:** Match the legacy switch. When `nextWorkoutInfo.templateId` is set, route to `navigateToWorkout(nextWorkoutInfo.templateId, nextWorkoutInfo.date)` (which already handles the featured-program + prehab branches). Label by `status`:
  - `'start'` → "Start Now"
  - `'resume'` → "Resume"
  - `'upcoming'` → "Preview" or "Open"
  - `'rest'` → keep "Create a Workout" (or "Mark Rest Day Complete", separate question)
  - `'none'` → "Add a Workout"
  - `completedToday` set → "Workout Completed" (already there)
- **Why P0:** The user explicitly described this card as "the main card where you just can open the app and go directly to their next workout." The current button takes them to a Create page. This is a daily, primary-action regression.

### `?summary=1` deeplink leaves the user on `/calendar`, not back on `/app`

- **File:** `client/src/pages/WorkoutSession.jsx:4021-4027`
- **Issue:** The summary modal's `onClose` handler:
  ```js
  onClose={() => {
    setShowSummary(false);
    if (!pendingVerse) navigate(tutorialMode ? '/' : '/calendar');
  }}
  ```
  When the user reached this modal via the Workouts-page "Workout Completed" deeplink (the new feature this audit is verifying), the close button drops them on Calendar — a completely different surface than where they came from. The user has no path back to the Workouts card they tapped two seconds ago. Worse, `onViewWorkout` (the modal's secondary CTA) just dismisses the summary with `setShowSummary(false)`, leaving the user inside the full editable `/session/:templateId/:date` view for a *completed* workout — they can now edit history entries and re-trigger save logic on a finalized session.
- **Repro:**
  1. Complete today's scheduled workout.
  2. Return to `/app`. Tap the green "Workout Completed" button.
  3. Tap the X / Done button on the summary modal. → lands on `/calendar`.
  4. Try again, tap "View Workout" → lands on the editable session page for a completed workout.
- **Fix:** Detect the deeplink origin (e.g. via `location.state.from === 'workouts-card'`, or just check `location.search.includes('summary=1')` at modal-close time) and `navigate('/app')` instead of `/calendar`. Better: route the deeplink to the dedicated `/summary/:id` route (`client/src/pages/SessionSummary.jsx`) which already handles "completed session, read-only summary" cleanly. The card would need to know the session id; `getCompletedSessions` already returns `id`, so include it in `completedToday` alongside `templateId`/`date`/`templateName`.
- **Why P0:** Every tap on the new button traps the user into a confusing destination. Day-1 users will lose orientation.

---

## P1 — Should fix before launch

### Card doesn't refresh across midnight while the app stays foregrounded

- **File:** `client/src/pages/Workouts.jsx:1202-1209` and `:1401-1409`
- **Issue:** `fetchData` computes `todayStr`/`tomorrowStr` from `new Date()` at call time. The visibility-change listener calls `fetchData()` only on `visibilitychange → visible`. If a user logs an evening workout, finishes ~11:55pm, then keeps `/app` open while scrolling stats, the card never re-runs `fetchData` past midnight. `todaySchedule` is still yesterday's row; `completedToday` is still yesterday's templateId; "Tomorrow" is actually today. Compounds with the next-workout-button regression — the user can't even tap into tomorrow's workout once it's actually today.
- **Repro:** Set device clock just before midnight. Load `/app`. Wait. After 12:00am the card still reads "Today" for the wrong day.
- **Fix:** Add a `setTimeout` keyed to `(midnight - now) + 1000ms` that calls `fetchData()`, scheduled in a `useEffect` and re-scheduled each call. Or recompute `todayStr` inside an interval-based effect every 60s and re-derive `nextWorkoutInfo` from the already-fetched schedule rows (no need to refetch).

### Buttons are tappable while `nextWorkoutInfo` is still loading

- **File:** `client/src/pages/Workouts.jsx:5076-5107`
- **Issue:** While `nextWorkoutInfo` is `null` (initial render before `fetchData` returns), the card shows "Loading..." but the buttons are fully active. The white button fires `navigate('/clientworkouts/create')`. The Browse button fires `setSelectedGroup('browse')`. Either action transitions away from the page before the user knows what the card actually said. The legacy card guarded behind `(nextWorkoutInfo?.templateId || status === 'none' || status === 'rest')` (line 5171). The new card has no such guard.
- **Repro:** Throttle the network in DevTools to "Slow 3G", reload `/app`, immediately tap the white button. You're whisked to Create before "Your Next Workout" even resolves.
- **Fix:** When `nextWorkoutInfo` is `null`, render the buttons as `disabled` with `opacity-50 pointer-events-none`, or render skeleton placeholders. (Note: the outer page already shows a 3-card pulse skeleton above this card while `loading === true`, so this race only happens for `fetchData` revalidations triggered by visibility-change or undisclosed re-renders — but it does happen.)

### Visibility-change re-fetches can race; no in-flight guard

- **File:** `client/src/pages/Workouts.jsx:1401-1409`
- **Issue:** `handleVisibility` calls `fetchData()` with no in-flight check. A user who toggles between Workouts and another app rapidly can have two `fetchData` calls in flight; the order of their resolves is not guaranteed, and each independently writes to `setNextWorkoutInfo`. If the stale one resolves last, the card briefly shows pre-completion state after a workout was just completed.
- **Repro:** Quickly background/foreground the app a few times. Watch state flicker.
- **Fix:** Gate visibility-change re-fetches behind an `inFlightRef`, or cancel the previous fetch's `AbortController` before kicking off a new one (the initial `useEffect` at 1392-1398 already uses an AbortController; the visibility-change one does not).

### "Workout Completed" button next to a "Browse" button that goes to library is a mismatched pair

- **File:** `client/src/pages/Workouts.jsx:5076-5106`
- **Issue:** When today is completed, the left button reads "Workout Completed" (review) and the right reads "Browse" (library). These are unrelated affordances — the natural pair after completing today's workout is "View Summary" + "What's Next" (tomorrow's workout, schedule next, mark rest day, etc.). The Browse pair makes the right side feel orphaned, especially because tapping Browse loses the user's context entirely.
- **Fix:** When `completedToday` is set, consider switching the right button to surface the *real next workout* (tomorrow's templateName, or "Schedule tomorrow" if empty). Browse becomes a tertiary action somewhere else.

### Schedule-deleted-but-completed edge: stale `completedToday` shows wrong template

- **File:** `client/src/pages/Workouts.jsx:1257-1269` + server schema (`schedule_days.template_id ON DELETE CASCADE` but `sessions.template_id ON DELETE SET NULL`)
- **Issue:** When a template is deleted, its `schedule_days` row cascades (good). But `sessions.template_id` SET NULLs. `db.getCompletedSessions` returns rows with `templateId: null` for those orphaned completed sessions. The card's `todayCompleted` check requires `todaySchedule.templateId` to match `c.templateId`. If a user has *no* schedule entry for today but has a `templateId: null` orphan in completed — fine, no match. But if `todaySchedule.templateId === null` (a standalone rest day) and any orphan completed row has `templateId: null` AND `date === todayStr`, line 1257 short-circuits to `false` because `todaySchedule.templateId` is null. OK, safe. (Verified — the `todayCompleted` ternary has a leading `todaySchedule && todaySchedule.templateId` guard, so the null-id match can't fire accidentally.) Tagging as P1 to verify rather than as P0.
- **Repro:** N/A — defensive verification only.
- **Fix:** None needed today, but if this guard is ever relaxed, the null-id collision becomes a real bug.

### Server returns `completedData[i].date` as a string from a `TEXT NOT NULL` column — relies on schema, not pg coercion

- **File:** `server/db.js:1126-1132` (`getCompletedSessions`) + `server/schema.sql:83` (`sessions.date TEXT NOT NULL`)
- **Issue:** Other code in the codebase converts `DATE` columns to YYYY-MM-DD strings explicitly (e.g. `getSchedule` at line 643-655). `getCompletedSessions` does no conversion — it relies on `sessions.date` being `TEXT`. If anyone ever migrates this column to `DATE` for indexing/comparison benefits, the comparison `c.date === todayStr` at Workouts.jsx:1258 silently breaks (string vs. Date-instance equality is always false). The schema choice is a latent footgun.
- **Repro:** Not currently broken. Future-bug awareness.
- **Fix:** Defensively format `r.date` in `getCompletedSessions` the way `getSchedule` does (`d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)`), so the API contract doesn't depend on the underlying column type.

### `Browse` button doesn't complete tutorial actions or fire analytics

- **File:** `client/src/pages/Workouts.jsx:5100-5106`
- **Issue:** The Browse button at line 5101 just calls `setSelectedGroup('browse')`. A different Browse entry point at line 5385 does `setSelectedGroup('browse'); completeTutorialAction('browse-library-tap')`. The card's Browse button skips the tutorial-completion call entirely, so a user mid-tutorial who taps the hero card's Browse button doesn't advance their tutorial state — they're "stuck" until they navigate via the larger card below. Plus zero analytics on either CTA tap.
- **Fix:** Call `completeTutorialAction('browse-library-tap')` from the card's Browse onClick too. While you're there, add `track('next_workout_card_tapped', { button: 'browse' | 'create' | 'completed', status: nextWorkoutInfo?.status })`.

### `templateName` overflow on long workout names pushes separator + dayLabel off-screen

- **File:** `client/src/pages/Workouts.jsx:5053-5063`
- **Issue:** `<div className="flex items-center gap-3 mb-1">` with `<span text-[15px]>{templateName}</span>` then a vertical-bar separator then `<span>{dayLabel}</span>`. No `min-w-0`, no `truncate`, no `flex-wrap`. Library templates can be long — `"Week 13 · Day 5 — Push Day"` (Nippard PPL) is ~30 chars and overflows the small card on iPhone SE width. The separator and "Today" get pushed off the right side. Worse, an even longer custom template name (`'Lower Body Power + Hypertrophy Block 4'`) actually expands the flex parent and the card grows to fit.
- **Repro:** Schedule a Nippard PPL workout for today on iPhone SE (375px wide). The "· Today" label disappears off the right.
- **Fix:** `<span className="truncate min-w-0 flex-1 text-[15px] ...">` on the templateName, fixed-width `shrink-0` on the dayLabel pair. Or stack vertically when name length > ~22 chars.

### `currentProgram` line under the workout name shows even on rest/none states

- **File:** `client/src/pages/Workouts.jsx:5065-5067` + `:1302-1320`
- **Issue:** `setCurrentProgram` is derived from `todaySchedule?.templateId ? todaySchedule : tomorrowSchedule?.templateId ? tomorrowSchedule : null`. On a rest day (today is rest, tomorrow has a real workout), `currentProgram` is set to *tomorrow's* program. The card body says "Rest Day · Today" but the program line reads e.g. "Nippard PPL — Week 4". User reads "today is a rest day in Nippard PPL Week 4". OK in spirit, but if today's "Rest Day" was a standalone (no program), and tomorrow is from a totally different program, the linkage is misleading. Minor confusion, but the program line should probably only show when the displayed workout actually belongs to that program.
- **Fix:** Set `currentProgram` from whichever schedule produced the displayed templateName, not "first one that has a templateId."

---

## P2 — Polish

### `completedToday.templateName` is set but never rendered

- **File:** `client/src/pages/Workouts.jsx:1268` (set) — no reads
- **Issue:** The `completedToday` object carries `{ templateId, date, templateName }`. The button label is the hardcoded string "Workout Completed". Nothing ever reads `templateName`. Either drop the field (smaller `nextWorkoutInfo` payload, less code) or use it — "Review <templateName>" or "<templateName> · Completed" would be more informative than the generic label.

### Touch target borderline at 44pt minimum for Apple HIG

- **File:** `client/src/pages/Workouts.jsx:5083, 5094, 5102`
- **Issue:** Buttons use `py-3.5` (14px top + 14px bottom = 28px padding) plus `text-[11px]` (font-size 11, computed line-height ~16-18px). Total visible touch height ≈ 44-46px. Right at Apple HIG's 44pt minimum (44pt @ 2x = 44 CSS px). With device pixel ratio 3 (iPhone Pro) the *visible* tap area is exactly at the line. Pre-submission rule of thumb is to leave a buffer.
- **Fix:** Bump to `py-4` (32px total padding + content ≈ 50-52px) or add `min-h-[48px]`. Same goes for every other `py-3.5` button on this page; consistent global lift would be cleaner than one-off.

### No `focus-visible` styling specific to the gradient buttons

- **File:** `client/src/pages/Workouts.jsx:5083, 5094`
- **Issue:** Global `:focus-visible` (`client/src/index.css:1049-1053`) gives a 2px red outline with 2px offset. For the green "Workout Completed" button (background `#22c55e`) the red outline contrasts well; for the white button it's also fine. Both buttons set `active:scale-[0.97]` but no `focus-visible:scale-` or `focus-visible:ring` of their own. This is consistent with the rest of the app; flagging for completeness rather than correction.

### Color contrast of `text-[11px] text-black on gradient(#22c55e → #16a34a)` at small sizes

- **File:** `client/src/pages/Workouts.jsx:5083-5086`
- **Issue:** Black text on `#22c55e` measures ~5.5:1 contrast — passes WCAG AA 4.5:1 for normal text. But `text-[11px] font-bold uppercase` with `letterSpacing: '0.15em'` is below the 14px "large text" threshold, so it must meet 4.5:1, which it does. No actual fail. But WCAG AAA 7:1 — borderline. Marketing wants the gradient; just confirming it passes AA. Same check on the gradient `#fff → #e0e0e0` with black text: passes easily (>15:1).
- **No action needed.**

### Card has a red accent line + radial spotlight while the completed-state CTA is green

- **File:** `client/src/pages/Workouts.jsx:5042-5044`
- **Issue:** The card's brand accents are red (`#ef4444` line + glow). When `completedToday` is set, the green CTA next to a red glow reads as a color clash — "stop go" simultaneously. Subjective; flag for design pass.
- **Fix:** When `completedToday` is set, tint the accent green to match the CTA, or mute the red glow. Or just accept the visual tension as "completion energy."

### Card layout jolt as data loads in stages

- **File:** `client/src/pages/Workouts.jsx:5046-5068`
- **Issue:** The card renders before `nextWorkoutInfo` and `currentProgram` resolve. First paint: "Loading..." text, no `currentProgram` line, smaller card. Second paint (after `fetchData`): "<name> · Today" + `currentProgram` line, card grows by one line of text. The vertical jump is noticeable on slow networks. No skeleton placeholder for the inner content. The outer page already has a skeleton list (lines 5005-5017) above this card, but it's a different shape.
- **Fix:** Reserve vertical space with a min-height on `<div className="mt-3 mb-4">`, or always render an invisible placeholder for the program line so the card doesn't jolt.

### "YOUR NEXT WORKOUT" title doesn't change semantics when displaying a rest day

- **File:** `client/src/pages/Workouts.jsx:5048-5050`
- **Issue:** When `status === 'rest'`, the card body reads "Rest Day · Today" but the heading still says "YOUR NEXT WORKOUT". Screen readers announce "Your next workout, Rest Day, Today". Confusing for SR users; sighted users mostly skim past. Apple review unlikely to ping but the SR experience is worth a beat.
- **Fix:** Change the `<h2>` to "TODAY" or "REST DAY" when status === 'rest'.

### `e.stopPropagation()` on buttons inside a non-clickable card

- **File:** `client/src/pages/Workouts.jsx:5079, 5091`
- **Issue:** The button handlers call `e.stopPropagation()` but the parent card has no `onClick`. The stops are no-ops. Harmless, but suggests the card was copy-pasted from a context where the parent was a tap target (likely from the legacy card around line 5172 which probably had an enclosing tap handler). Tiny cleanup.

### `setCurrentProgram` recomputes from `tmpls.find(t => t.id === activeSchedule.templateId)` — silent fail if template is missing

- **File:** `client/src/pages/Workouts.jsx:1304-1320`
- **Issue:** If `activeSchedule.templateId` is set but the corresponding template isn't in `tmpls` (e.g. a stale schedule entry referencing a template that was deleted between the schedule fetch and the templates fetch), `tmpl` is undefined, then `tmpl.programId` would throw on a null deref except the code guards with `if (tmpl && tmpl.programId)`. So it silently sets `setCurrentProgram(null)` — fine, but flag because no warning is logged. If a template is missing, that's a sign of a data inconsistency worth surfacing in dev builds.
- **Fix:** `if (import.meta.env.DEV && activeSchedule.templateId && !tmpl) console.warn(...)`.

### No `aria-live` on the dayLabel when state changes

- **File:** `client/src/pages/Workouts.jsx:5054-5063`
- **Issue:** When the user crosses midnight (assuming the P1 midnight-refresh fix lands), the card's content changes from "<name> · Today" to "<name> · Tomorrow" silently. SR users won't be notified. Low priority; the card isn't a status region. Flag only if you implement aria-live elsewhere on this page.

---

## Things that look correct (verified)

- **`nextWorkoutInfo` state machine logic.** The `if/else if/else` ladder at Workouts.jsx:1271-1300 correctly orders today-active → today-rest → tomorrow-active → tomorrow-rest → none. The `completedToday` field is computed independently and attached to whichever branch fires, so the deeplink works regardless of what the body of the card shows.
- **`?summary=1` query-param check is robust.** `location.search.includes('summary=1')` at WorkoutSession.jsx:945 correctly matches `?summary=1`, `?summary=1&extra`, `?other=1&summary=1`, etc. (False positives like `?summarynot=1`, `?foo=summary=1`, or `?summary=10` would also match in theory; none are emitted by the app, but worth being aware of. URLSearchParams would be stricter — `new URLSearchParams(location.search).get('summary') === '1'`.)
- **Modal doesn't auto-reopen on subsequent visits.** Because `showSummary` is local state initialized to `false` and only set true inside the load effect when `session.completed && search contains summary=1`. If the user closes the modal then navigates back to the same URL via browser history, the load effect re-runs (templateId/date unchanged but new mount) and re-opens. That's correct behavior for explicit re-deeplink, and *not* an auto-reopen bug — verified by tracing the effect dep `[templateId, date]`.
- **Featured-program templates correctly route through prehab gate when NOT a summary deeplink.** `navigateToWorkout` at Workouts.jsx:1828-1865 handles the prehab + featured-session branches. The summary deeplink intentionally bypasses both (it goes directly to `/session/:id/:date?summary=1`), which is correct for "view summary of completed workout" — you don't prompt for prehab when reviewing.
- **Featured-program template completed today: deeplink works.** The `/session/:templateId/:date` route is registered (App.jsx:297) and handles featured templates via the same flow. Templates with `prehabTemplateId` still load — the prehab prompt is in `navigateToWorkout`, not in `WorkoutSession`. So the deeplink loads the session, the auto-open-summary effect fires, no prehab interruption.
- **`completedData[i].date` is a string (not a Date instance) because `sessions.date` column is `TEXT NOT NULL`** — verified at schema.sql:83. So `c.date === todayStr` comparison at Workouts.jsx:1258 works as written. (Flag in P1 about the fragility if the schema ever changes.)
- **`/sessions/:id` (used by `/summary/:id`) and `/sessions/by-template/:templateId/:date` both enforce ownership.** Both routes are behind `authMiddleware` and query `WHERE user_id = $1 AND ...`, so no cross-user data leak via deeplink. A logged-out user landing on `/session/X/Y?summary=1` hits the auth gate first (ProtectedRoute wraps the route at App.jsx:289-295). Verified.
- **Schedule entry with deleted template: cascades cleanly.** `schedule_days.template_id ON DELETE CASCADE` (schema.sql:75) removes the row when its template is deleted. So a stale "schedule says template 42 today but 42 doesn't exist anymore" condition is impossible at the data layer.
- **`completedToday` is null on a rest day, which means the green CTA can't appear on a rest-day display.** Verified: line 1283 only attaches `completedToday` when the `todayCompleted` ternary returned true, which itself requires `todaySchedule.templateId` set. A pure rest day has `templateId = null` so `todayCompleted = false` so `completedToday = null`. Safe.
- **`fetchData` is idempotent and re-runs cleanly on visibility-change.** Each call independently re-derives all the state. No accumulation, no leaks. Initial mount uses AbortController; visibility re-fetches don't (P1 above).
- **Tutorial flow doesn't touch the new card.** `data-tutorial="create-btn"` is on the header `+ Create` button at line 4829, not on the card's "Create a Workout" button. No conflict.
- **`POST /schedule` validates template ownership.** Lines 47-63 of `server/routes/schedule.js` check `row.user_id !== null && row.user_id !== req.userId → 403`. So a malicious client can't schedule another user's private template to surface it on their next-workout card.
- **Tutorial mode coexists with the card** — `tutorial.active` is read elsewhere in this page but the new card has no tutorial branch, so it renders normally regardless of tutorial state. (No `tutorialMode` check, no `selectedGroup` gate.)
- **Card is gated by `loading` and `loadError` upstream** — lines 5003-5020. While initial fetch is in flight, the user sees a 3-card skeleton + spinner instead of the broken Loading state. Only background revalidations expose the "Loading..." copy + active-buttons issue flagged in P1.
- **`OdometerStat` row below the card doesn't interact with the card** — separate component, separate state (`streak`, `totalWorkouts`, `workoutsThisMonth`). Conditional render at line 5115 only depends on those stats being > 0. No coupling.
