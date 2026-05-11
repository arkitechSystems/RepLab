# Start Empty Workout — Feature Audit

Read-only audit of commit `414e298`: `POST /sessions/start-empty` in `server/routes/sessions.js`, the Start Empty / push-back flow in `client/src/pages/Calendar.jsx`, and the `ownPrograms.sort` tweak in `client/src/pages/Workouts.jsx`.

Overall the flow is well-instrumented (transaction, dedup, sort_order continuity), and the push-back two-pass map is correct for the four traced cases. The real risks are a double-submit race on the Confirm button, a stale `editError` that bleeds across separate flows, and the silent loss of upstream/downstream workouts when push-back fires near the edge of the loaded window.

---

## HIGH

### Calendar.jsx:376-407 — Double-tap on "Confirm" creates duplicate templates
`handleConfirmStartEmpty` sets `startEmptySaving` *inside* the async function, but the button's `disabled` flag is the only guard. Between the user's first tap and the React re-render that disables the button (one paint), a second `onKeyDown`-Enter or fast double-tap can fire a second call. The server's dedup loop will name the second one `(2)`, both templates get inserted, and the schedule_days UPSERT for the same `(user, date)` will leave the day pointing at whichever of the two transactions commits second — orphaning the first template (still in My Workouts, no schedule row pointing at it).
**Fix sketch:** guard at function entry — `if (startEmptySaving) return;` before doing anything else.

### Calendar.jsx:295-329 — `handlePushScheduleBack` only cascades within the loaded ~7-day window; trailing edge silently drops off
The commit message flags this as "accepted v1," but the failure is not graceful — if the user is viewing the current week and has a Mon-workout on next Sunday (just outside `fetchTo`), pushing back the current week's Mon collapses the program by one full workout with no warning. The `schedule` state is bounded by `fetchFrom`/`fetchTo` (current view ± 7 days, line 96-97), so any workout beyond that window is invisible to the filter and never shifted.
**What could go wrong:** user loses a programmed workout from week N+2 and has no way to know it happened.
**Fix sketch:** before shifting, fetch a wider window (e.g. `+90 days`) so the cascade can reach the actual end of the user's program, or surface a confirmation if the last workout in the loaded window butts up against `fetchTo`.

### sessions.js:106-118 — Empty template is created BEFORE schedule_days UPSERT inside the same transaction, but find-or-create of program is NOT race-safe across concurrent requests
Two tabs hitting `/sessions/start-empty` at the same time when the user has no "My Workouts" program: both `SELECT … WHERE name='My Workouts'` return empty, both `INSERT INTO programs` succeed, the user ends up with two "My Workouts" programs. The transactions don't serialise on the SELECT because there's no row-level lock and no unique constraint on `(user_id, name)` for `programs`. Subsequent Start Empty calls will pick one arbitrarily, splitting custom workouts across two visually-identical program cards.
**Fix sketch:** add a partial unique index on `programs(user_id, lower(name)) WHERE name='My Workouts'` (or rely on `INSERT … ON CONFLICT DO NOTHING RETURNING id` + a second SELECT). At minimum, `SELECT … FOR UPDATE` would serialise tabs.

---

## MEDIUM

### Calendar.jsx:409-412 — `cancelStartEmpty` doesn't clear `editError`, so a stale error persists across flows
A failed Confirm sets `editError='Failed to create workout…'`. User taps backdrop → modal closes, `editError` is untouched. User opens day-editor on a different day → start-empty flow → name-prompt re-renders → the old error is still rendered inside the new modal (line 1994-1998 reads `editError` unconditionally). `openEditor` does clear `editError` on line 179, but only when the editor itself is reopened — not when the user goes straight from one start-empty modal to another via the rest-day path or cancels.
**Fix sketch:** clear `editError` inside `cancelStartEmpty`, `openStartEmptyFlow`, and `proceedToNamePrompt`.

### Calendar.jsx:349-365 — `handleStartEmptySkipExisting` clears the day via PUT /schedule, then proceeds; if user cancels at the name prompt, the day is now empty with no rollback
The PUT clears the day's templateId before the name-prompt opens. If the user reads the name prompt, changes their mind, and taps Cancel (or backdrop), the previously-scheduled workout is gone and the day is blank. The user wanted "Skip this workout AND start a new one"; they did not consent to "Skip this workout, then nothing." Worse, the PUT is also redundant — the `/sessions/start-empty` UPSERT will replace the day's templateId anyway, so the pre-clear achieves nothing the eventual call wouldn't.
**Fix sketch:** drop the PUT entirely; let `/sessions/start-empty`'s UPSERT do the work, and only commit the schedule change once the user actually confirms a name.

### Calendar.jsx:295-329 — Push-back excludes standalone rest days; behavior inconsistent with spec
The filter `s.templateId` excludes rows where `templateId` is null (standalone rest days saved as `is_rest=TRUE, template_id=NULL`). Per the spec the audit is checking against ("rest days shift like normal workouts"), these should slide forward — but they stay put. Practical impact: a user who's manually inserted a rest day mid-program will see workouts after the rest day collapse onto/over it.
**Fix sketch:** filter on `s.templateId || s.isRest`, and have the claim pass write `{templateId, isRest}` so rest days slide too. (Same fix should be applied to `handleSkipWorkout` for symmetry — it has the same gap.)

### sessions.js:88-96 — Name dedup uses LIKE-free comparison but doesn't anchor the suffix; user can poison their own list
Suffix bookkeeping starts at 2 and only checks the exact `${baseName} (${suffix})` form. If the user manually creates a template called `Leg Day (5)` in My Workouts (via the regular template builder), then triggers Start Empty with baseName `Leg Day`, the loop will: check `Leg Day` (collision), try `Leg Day (2)` (free) → assign. Fine. But if `Leg Day (2)` *also* exists, it iterates 2 → 3 → … and eventually lands on a free slot. The loop is bounded by integer arithmetic and the user's collision count, so it can't actually run forever — but on a pathological 10k-row program this is 10k roundtrips per Start Empty. Not exploitable, but a latency landmine if dedup ever explodes.
**Fix sketch:** one query — `SELECT MAX(suffix) FROM (SELECT regexp_match(name, ...) ...)` — to pick the next free suffix in O(1).

### sessions.js:53-129 — No length cap on `name`; templates.name is `TEXT` (unbounded)
Postgres `TEXT` has no length limit, so a malicious or buggy client can submit a 10 MB name. The trimmed string is what gets stored, joined into card titles, and surfaces in workout-summary copy. No truncation, no validation beyond non-empty.
**Fix sketch:** cap `name.trim().length` at, say, 80 chars before the transaction (matches the input's UX bounds — display titles wrap badly past that).

### sessions.js:53-129 — `date` is regex-validated for shape but not for sanity
`/^\d{4}-\d{2}-\d{2}$/` matches `9999-13-45`, `0000-00-00`, etc. PostgreSQL DATE will reject the truly impossible ones (`13-45`) and turn that into a 500 (`invalid input syntax for type date`), not a 400. Borderline valid dates (`1900-01-01`, `9999-12-31`) succeed silently and land in `schedule_days` where the calendar UI never displays them.
**Fix sketch:** after the regex, parse with `Date.parse` or `parseISO`, reject if `NaN` or year outside e.g. `[2020, 2100]`, and return a structured 400.

---

## LOW

### Calendar.jsx:367-374 — `handleStartEmptyPushBack` silently swallows push-back errors
The `try { await handlePushScheduleBack(…); proceedToNamePrompt(); } catch(_) {}` pattern means a failed push-back leaves the user staring at the overwrite-options modal with `editError` set (it's set inside `handlePushScheduleBack`) but the step itself doesn't change. They get a red error message but no clear next step.
**Fix sketch:** on catch, also call `setStartEmptyStep(null)` so the user returns to the day-editor in a clean state with the error surfaced.

### Calendar.jsx:1534-1543 — Rest-day modal's Push Back button doesn't clear `editError` on success
The Insert Rest Day / Skip Workout buttons set `editError` only on failure; the Push Back button mirrors them but `openEditor` is the only path that clears `editError`. If the user previously attempted Skip and it failed, the error stays visible while they then choose Push Back successfully.
**Fix sketch:** clear `editError` at the top of each rest-day option handler (or inside `setRestDayPrompt(false)` consistently).

### Workouts.jsx:4121-4129 — Sort mutates `ownPrograms` in place; harmless today but fragile
`ownPrograms = isBrowse ? filtered : filtered.filter(...)` creates a *new* array via `.filter`, so the mutation by `.sort` doesn't reach React state. Confirmed safe. But the code is one refactor away from `ownPrograms = filtered;` (no `.filter`), at which point in-place sort would mutate `filtered` and corrupt downstream views.
**Fix sketch:** belt-and-suspenders — call `[...ownPrograms].sort(...)` or `ownPrograms = ownPrograms.slice().sort(...)`.

### Workouts.jsx:4121-4129 — Two pinned "My Workouts" programs collapse to sort_order tiebreak
If a user has both the auto-created "My Workouts" and a manually-named "My Workouts," both compare as `aMine && bMine` → falls through to `sortOrder`. Functionally fine, but the user sees two identical-looking pinned cards with no visual disambiguation.
**Fix sketch:** non-blocking — prevent duplicate naming server-side, or display a small "(custom)" suffix on the manual one.

### sessions.js:53-129 — `/sessions/initialize` (called immediately after navigation) does `tmpl.exercises.map(...)` on a zero-exercise template
`tmpl.exercises` is `[]` for a fresh Start Empty template, so `.map`, the inner `for-of`, and the resulting `workoutData.exercises = []` are all fine — no crash. But `db.createSession` is called with `entries=[]`, which the code already guards for. End-to-end the empty-template path through `/initialize` works, just barely. Flagged because the safety relies on `[].map()` returning `[]` and the inner `if (entries.length > 0)` skip in `db.js:719` — both standing structures, but worth a single integration test pinning this contract.
**Fix sketch:** add a unit test asserting `/sessions/initialize` on a zero-exercise template returns a session row with empty `entries` and 200 OK.

### Calendar.jsx:1858-1929, 1933-2001 — No iOS safe-area padding on z-[120] modals
The two new Start Empty modals use `fixed inset-0 flex items-center justify-center`. They center on the viewport, so the panel itself won't get clipped by the notch — but if iOS keyboard pushes the name-prompt up and the panel grows tall, the top edge can sit under the status bar. Existing modals in the same file (rest-day, ConfirmOverwriteModal) have the same shape, so this isn't a regression — but worth one screenshot pass on a notched iPhone before launch.
**Fix sketch:** add `paddingTop: env(safe-area-inset-top)` to the outer flex container if the panel ever bumps the top edge.

### Calendar.jsx:1964-1974 — Name input has no `autoCapitalize`, `autoCorrect`, or `inputMode` hints
On iOS, the default for a `<input type="text">` is `autoCapitalize="sentences"` and `autoCorrect="on"`. For a workout-name field, autocorrect routinely mangles short names like "Push A" → "Push A." or capitalises mid-edits. Minor papercut.
**Fix sketch:** add `autoCapitalize="words" autoCorrect="off" spellCheck={false}`.

### Calendar.jsx:402 — `console.error` gated on `import.meta.env.DEV` is fine, but consistency check
Other handlers in this file follow the same `if (import.meta.env.DEV) console.error(err)` pattern. No production leak. Flagged only because the rest of the audit-CONSOLE doc tracks this — these new additions don't regress that policy.

### sessions.js:124 — `console.error('start-empty error:', err)` ships to Render logs unconditionally
Matches the rest of the file's style (most handlers `console.error(err)` raw). Not a regression, but it does mean any `pg` error from this endpoint will dump the failing SQL into logs. Same fix as the existing AUDIT-CONSOLE entry: filter at the logger level, not the route.

---

## Not findings (verified clean)

- **schedule_days unique index for ON CONFLICT** — confirmed at `server/initDb.js:236` (`CREATE UNIQUE INDEX idx_schedule_days_user_date ON schedule_days(user_id, schedule_date)`). The UPSERT works.
- **Authorization** — endpoint uses `req.userId` from `authMiddleware`, never reads userId from body. Cannot write to another user's program.
- **Transaction atomicity** — all three DB writes (program insert, template insert, schedule_days UPSERT) live inside the same BEGIN/COMMIT with explicit ROLLBACK in the catch. If schedule_days fails, the template is rolled back. Correct.
- **Dedup `while(true)` termination** — bounded by integer increment; can't loop forever.
- **Push-back four traced cases (A/B/C)** — manual trace confirms expected outputs. Case D (push-back from day with no workout) cascades anyway, but the Start Empty UI gates entry to days with workouts, so no current path triggers the surprise. Flagged in MEDIUM #3 for the rest-day-modal entry where the gate is weaker.
- **Destructive overwrite collision** — Start Empty creates a *new* templateId, so the existing session row on the day (if any) is keyed at `(user, OLD_templateId, date)` and doesn't conflict with the new one. The destructive-overwrite contract in `db.createSession` never fires for the new template until the user logs sets — at which point there's nothing on the new templateId to overwrite. Correct.
- **Workouts.jsx mutation of state** — `ownPrograms` is a `filter` result, not the raw state array. Mutation is local. (See LOW finding above for the fragility note.)
- **No TODO/FIXME in the diff** — verified.

---

## Bottom line

**Ship with the HIGH items fixed.** The double-tap race (HIGH #1) will cause user-visible weirdness — orphan templates in My Workouts, mismatch between schedule and template list — within hours of launch. The trailing-edge push-back (HIGH #2) is a data-loss bug for any user with a program that extends beyond the current week's view, which is the modal use case. The concurrent-tab race for "My Workouts" creation (HIGH #3) is rarer but produces a permanent split-state that requires manual cleanup.

The two HIGH client-side fixes are each ~3 lines. HIGH #3 is one DB index migration plus a one-line code change. All three should land before the feature reaches App Store TestFlight.

MEDIUM items (stale `editError`, skip-existing pre-clear, rest-day filter mismatch, name length / date sanity) are quality issues that won't block launch but will produce support tickets. Fix in a follow-up pass.

LOW items are polish.
