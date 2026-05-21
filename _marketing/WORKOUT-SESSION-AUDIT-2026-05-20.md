# Workout Session Audit — 2026-05-20

Scope: WorkoutSession.jsx, ExerciseCard.jsx, PlateCalculatorModal.jsx, WorkoutSummary, share-image generator, sessions route + db.createSession + supporting routes. Read-only audit, intended to surface real issues before this week's App Store submission.

## Summary
- 18 findings: 2 P0, 7 P1, 9 P2
- Top 3 risks to launch:
  1. **Autofill on set completion is inverted** — completing a set never forward-fills weight/reps to later sets in the same exercise. This is the headline UX feature and it's silently broken (P0).
  2. **Bodyweight (`weight = -1`) sets corrupt server-side total volume** — `SUM(se.weight * se.reps)` produces negative totals, polluting the History list, sessions feed, and any future analytics built on that column (P0/data-integrity).
  3. **Race conditions on Mark Complete** — `await handleSave()` inside `handleMarkComplete` while the debounced autosave is in flight throws "Save already in progress" and the user gets a scary alert despite having logged a real workout (P1).

The session flow is otherwise in surprisingly good shape: offline backup, restore, transactional createSession, focus traps, set-row reorder, and PR detection all look correct. Most of the P2 items are polish.

---

## P0 — Blockers (fix before submission)

### Autofill on set completion fires when **un**-completing, not when completing

- **File:** `client/src/pages/WorkoutSession.jsx:1797-1860`
- **Issue:** `handleToggleComplete` issues two sequential `setCompletedSets` updaters. The first toggles `key` in/out of the set. The second updater receives the result of the first as `latestCompleted`, then computes `const isCompleting = !latestCompleted.has(key);`. After toggling ON, `latestCompleted` already contains `key`, so `isCompleting === false` and the entire autofill block is skipped. After toggling OFF, the inverse happens — autofill runs on uncompletion. The commented intent ("When completing a set, auto-fill subsequent uncompleted sets") never actually fires.
  ```js
  // line 1797
  setCompletedSets((latestCompleted) => {
    const isCompleting = !latestCompleted.has(key); // inverted by the prior updater
    if (isCompleting) { /* autofill block — never runs on completion */ }
    return latestCompleted;
  });
  ```
- **Repro:** Open any session, enter weight + reps on set 1, tap the green checkmark. Sets 2..N stay empty. (Expected: 2..N auto-fill with set 1's weight/reps, marked italic-grey as autofilled.) Then uncheck set 1 — and now you watch 2..N fill in, which is the opposite of what should happen.
- **Fix:** Compute `isCompleting` from the *first* updater's input (e.g. capture `wasCompletedBeforeToggle = completedSets.has(key)` outside the updaters, or do all the autofill work inside a single `setCompletedSets` that returns the new set after computing autofill against `prev`).

### `total_volume` SQL multiplies `weight × reps` with no `weight > 0` guard, so BW sets produce negative totals

- **File:** `server/db.js:885` (and the matching read at `getSessions`)
- **Issue:** BW sets store `weight = -1` to encode "bodyweight". The client guards this in its own total-volume calculation (`w > 0 ? w * r : 0`, WorkoutSession.jsx:2212). The server query does not:
  ```sql
  COALESCE(SUM(se.weight * se.reps) FILTER (WHERE se.is_completed = TRUE), 0)::NUMERIC AS total_volume
  ```
  A user who logs three BW sets at 12 reps each gets a row in `getSessions()` reporting `total_volume = -36`. The History page (`client/src/pages/History.jsx`) renders that as "−36 lbs", and the per-session totals shown in the community feed inherit the same value. Any future cumulative-volume rollup will also be wrong.
- **Repro:** Log any session whose entries include BW (`weight = -1`), mark complete, open History.
- **Fix:** Add `AND se.weight > 0` to the FILTER clause (or `SUM(GREATEST(se.weight, 0) * se.reps)`). Same fix needs to ship anywhere else that consumes `SUM(se.weight * se.reps)` from session_entries — grep `weight * reps` across `server/` to confirm.

---

## P1 — Should fix before launch

### `Mark Complete` races the debounced autosave and alerts "Save already in progress"

- **File:** `client/src/pages/WorkoutSession.jsx:1707-1748`, `1905-1911`
- **Issue:** `handleMarkComplete` calls `await handleSave()` to persist before flipping the completed flag. `handleSave` throws if a save is already in flight (`if (saving) throw new Error('Save already in progress');`). The autosave debounce is 500ms after the last set toggle, and `Mark Complete` is right next to the green checkmarks — tapping checkmark then immediately tapping Mark Complete is common. Result:
  ```js
  } catch (err) {
    alert('Failed to update: ' + err.message);
  }
  ```
  User sees "Failed to update: Save already in progress" despite their session being fine.
- **Repro:** Tap the last set's checkmark, immediately tap Mark Complete within ~500ms.
- **Fix:** When `saving` is true, await the in-flight save instead of throwing — e.g. promise stash on `savingRef`, or just `if (saving) { await new Promise(r => setTimeout(r, 100)); return handleSave(); }`. Same pattern needed wherever else `handleSave` is awaited externally (only `handleMarkComplete` today).

### `POST /sessions` trusts `templateId` without verifying it belongs to the caller

- **File:** `server/routes/sessions.js:9-36`, `server/db.js:759-765`
- **Issue:** The handler validates `templateId` is present but not that the calling user owns it. `createSession` inserts the row with `req.userId` and the passed `templateId` directly. A user can POST a templateId for another user's template; the FK accepts it, the session row attaches to their account but references a template they shouldn't see. PB rows then key into `(req.userId, foreign_templateId, ...)` — a way for a user to silently pollute their own PR namespace, and if any future cross-user query joins on template_id (e.g. shared programs), it gets messy. `/sessions/initialize` already does the ownership check at db.js:144 (`if (tmpl.userId && tmpl.userId !== req.userId)`); apply the same gate to the main `POST /sessions`.
- **Repro:** Auth as user A. `POST /sessions` with a templateId belonging to user B's *private* template, valid entries. The session is created and visible only to A, but referenced template_id leaks B's id into A's data.
- **Fix:** Add the same `tmpl.userId && tmpl.userId !== req.userId` check at the top of `db.createSession`, or do it in the route before calling.

### Rest timer drifts when the app is backgrounded on iOS

- **File:** `client/src/pages/WorkoutSession.jsx:436-463`
- **Issue:** `startRestTimer` uses `setInterval(..., 1000)` decrementing `restRemaining` by 1 per tick. iOS suspends JS when the app is backgrounded, so the interval pauses. When the user comes back, the timer has "lost" the suspended time — they think they still have 30s of rest left when in reality their rest is over. The workout timer is fine (it's `Date.now() - origin`, wall-clock); the rest timer is not.
- **Repro:** Start a 90s rest timer. Background the app for 60s. Foreground: timer shows ~85s remaining, not ~30s.
- **Fix:** Store rest start timestamp in a ref. On each tick (or on visibilitychange), compute remaining as `duration - Math.floor((Date.now() - startedAt)/1000)`. Mirrors how the workout timer works.

### `Mark Complete` followed by deleted-then-undone last exercise can POST empty `entries` and hard-error

- **File:** `client/src/pages/WorkoutSession.jsx:1916-1934` (entry assembly), `server/routes/sessions.js:12` (`!entries.length` check)
- **Issue:** `handleSave` iterates `template.exercises` and pushes one entry per set. If a user is mid-undo of "delete last exercise" (template momentarily has 0 non-section exercises) and an autosave fires, `allEntries = []` is POSTed; server returns 400 `"entries are required"`; the catch in handleSave alerts `Failed to save: entries are required`. Pre-Begin Workout, a user starting an empty workout via `/sessions/start-empty` *and* immediately tapping Save would hit the same path.
- **Repro:** Use `/sessions/start-empty` to create an empty workout, navigate into the session, tap any path that triggers structureSave before adding an exercise.
- **Fix:** In `handleSave`, return early (resolve cleanly) when `allEntries.length === 0`. Same write to local backup, no POST. The server-side guard can stay as a defense-in-depth.

### `notifyPRCelebration` push fires for prior-day re-completes because `pb.achieved_at >= s.created_at` is a stale comparison

- **File:** `server/postSessionPushes.js:25-67`
- **Issue:** `sessions.created_at` is set when the session row is first inserted (`/sessions/initialize`) — could be hours or days before the user actually completes. The PR push compares `pb.achieved_at >= s.created_at`, which catches every PR upserted during the entire window of the session row's life. If a user opens a workout Monday (creates row), doesn't lift, logs sets Wednesday, marks complete Wednesday — fine. But if the *same* template happened to PR earlier in the week from a different session, those PB rows can still satisfy `achieved_at >= s.created_at` for the Monday-shell session and re-fire. Edge case but real once users have history.
- **Repro:** Pre-create a session row Monday. Complete a different session of the same template Tuesday with a new PR. Complete the Monday session Wednesday with no new lifts → still receives "🏆 New PR!" push for the Tuesday lift.
- **Fix:** Compare against `last_activity_at` (or `now() - INTERVAL '4 hours'`, or the timestamp of the most recent `is_completed` entry on this session) so the window is the actual workout, not the row's lifetime.

### Stale closure: structure auto-save effect lists only `template`, but `handleSave` reads `entries`/`notes` from closure

- **File:** `client/src/pages/WorkoutSession.jsx:349-361`
- **Issue:** This effect schedules a `handleSave()` call 1.5s after a structural change. Its deps are `[template]`, so the `setTimeout` captures the `handleSave` (and indirectly its captured `entries`, `notes`, `pbs`, etc.) from the render in which `template` last changed. In practice this is usually correct because structural mutations always touch `template`. But: if the user types into a weight input (entries changes, template does not), then triggers a structural change that gets DEBOUNCED with later typed input, the *first* save fires `handleSave` captured with the `entries` from the structural-change render — older than the user's most recent typing. Same applies to `notes`.
- **Repro:** Add a set. Within 1.5s, type a weight into another set. The autosave that fires saves the template's *old* entries.
- **Fix:** Wrap `handleSave` in `useCallback` (or use a ref pointing at the latest `handleSave`), and have the effect read the ref. The autosave effect at line 336-347 has the same shape; same fix.

### Tutorial overlay `setTimeout`-based ready detection can soft-lock if the target never mounts

- **File:** `client/src/pages/WorkoutSession.jsx:265-326`
- **Issue:** `tryFind` retries up to 30 × 200ms looking for the data-tutorial target. If none ever matches (e.g. the user navigates between exercises, the targeted card is removed, or a previous test build's selector reference is stale), `tutorialReady` stays false, the tip dialog never renders, and the user is stuck on a translucent overlay with no exit affordance until they tap outside. There's no "skip" surfaced before `tutorialReady === true`.
- **Repro:** Open the tutorial workout, force a target to never render (modify CSS for `[data-tutorial="..."]` to `display: none` via DevTools). The page is unusable until reload.
- **Fix:** After the 30-attempt budget elapses, set `tutorialTip` to its `next` (or null), so the tutorial gracefully advances/aborts.

---

## P2 — Polish / post-launch

### Empty-shell workouts can be reached from full-screen mode and present an empty card

- **File:** `client/src/pages/WorkoutSession.jsx:971-980`
- **Issue:** `fullScreenAutoOpenedRef` opens full-screen on first template load when `fullScreenDefault` is true. If the user started a workout via `/sessions/start-empty` (zero exercises), `template.exercises.findIndex(e => !e.isSectionHeader) === -1`, the effect bails with `fullScreenIdx` unchanged. Good. But after they add their first exercise, `fullScreenIdx` is still null, the ref is `true`, so the auto-open never fires. Inconsistent UX vs. non-empty templates.
- **Fix:** Reset the ref when the first non-section exercise appears, OR don't set the ref to true on the empty path.

### Destructive overwrite path can promote drop-sets to PRs

- **File:** `server/db.js:98-126` (`rebuildPBsForTemplateOnClient`)
- **Issue:** `session_entries` has no `set_type` column. The normal PR upsert path (line 794-807) filters `if (entry.setType && entry.setType !== 'straight') continue;` from the in-memory `entries`. The rebuild path can only read what's in the DB, so a drop-set's terminal heavy single becomes a PR after a destructive overwrite. The code comment at line 92-97 acknowledges this; tagging as P2 because it's only relevant on the confirm-overwrite path, which is rare.
- **Fix:** Add `set_type` column to `session_entries`. Persist it on insert (currently only `is_completed` is the 7th param). Then filter in the rebuild query.

### Volume / sets aggregates on session list don't dedupe duplicate exercise names

- **File:** `server/db.js:879-895` (`getSessions`)
- **Issue:** `COUNT(DISTINCT se.exercise_name) FILTER (WHERE se.is_completed = TRUE) AS exercise_count` counts distinct names. A workout that legitimately repeats the same exercise (e.g. a superset of Bench Press appearing twice as two ExerciseCards) underreports as 1 exercise instead of 2. Same surface as the in-app `exerciseStats.length`, which counts correctly via `exKey`. Minor display inconsistency.
- **Fix:** Either count distinct `(exercise_name, sort_order)` if a sort_order column gets added, or accept that "exercises" here means distinct lifts.

### `handleShareText` and `generateSummaryImage` swallow errors silently in production

- **File:** `client/src/pages/WorkoutSession.jsx:4759-4760`, `4777`, `4789`
- **Issue:** `try { ... } catch {}` everywhere. If the canvas fails (e.g. tainted by the logo image in a rare cross-origin scenario), the user just sees the share menu open with no image and no error message. Add a small "Couldn't generate image — share as text instead" fallback.
- **Fix:** Surface a toast or inline message in the share menu when `generateSummaryImage` rejects.

### PlateCalculatorModal resets bar to 45 even when the user has chosen 35 (women's bar)

- **File:** `client/src/components/PlateCalculatorModal.jsx:181-194`
- **Issue:** Tapping "Both Sides" or "One Side" while in Machine mode forces `setBar(45); setTarget('45');` regardless of the user's last-chosen bar. A user who picked a 35lb bar earlier, switched to Machine, then back to Both Sides gets their bar silently reset to 45. Subtle but annoying.
- **Fix:** Stash the last non-zero bar in a ref. Restore it on the way out of Machine mode instead of hard-coding 45.

### PR modal lift sort is not stable for sets with identical (weight, reps)

- **File:** `client/src/pages/WorkoutSession.jsx:3343`
- **Issue:** `.sort((a, b) => (byVolume ? b.volume - a.volume : b.weight - a.weight || b.reps - a.reps))` — when both weight and reps tie, sort is implementation-defined. Different PB rows for the same `(weight, reps)` (from different sessions) will swap positions on re-render. Cosmetic.
- **Fix:** Add `|| (new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime())` as a final tiebreak.

### Inline `getBoundingClientRect()` read inside the `style` of the session-menu popover happens on every render

- **File:** `client/src/pages/WorkoutSession.jsx:2825-2833`
- **Issue:** The popover's `style` uses an IIFE that calls `document.querySelector(...)` + `getBoundingClientRect()` on every render while `showSessionMenu` is true. Cheap on its own, but if anything triggers a re-render mid-interaction (e.g. the elapsed timer tick once a second) it does a layout query each tick. Minor.
- **Fix:** Compute once on open, store in state.

### `handleShare` (text share) miscounts sets when no set was logged

- **File:** `client/src/pages/WorkoutSession.jsx:1889`
- **Issue:** `${completedSets.size}/${template.exercises.filter(e => !e.isSectionHeader).reduce((s, e) => s + e.sets.length, 0)} sets completed` — fine when sets exist. If the user shares mid-session with `template.exercises = []` (or all section headers), denominator is 0 and you get `0/0 sets completed`. Edge case, harmless but ugly.
- **Fix:** Guard with `totalSets > 0 ? ... : 'Workout in progress'`.

### `heaviestSet` is computed but never displayed; volume-tiebreak comparator is incorrect anyway

- **File:** `client/src/pages/WorkoutSession.jsx:4406-4418`
- **Issue:** The `heaviestSet` reducer ranks by `actualVolume` first then `actualWeight`. Comment at line 4404 claims this is "the heaviest single completed set" but the math is actually heaviest *by volume*, not heaviest by weight. The result isn't currently shown in the modal (the 4-tile layout was simplified to 2 tiles per the prior pass) so it's dead code right now. Cited because if it's re-enabled the label will be wrong relative to the math.
- **Fix:** Either delete the reducer, or flip it to `ss.actualWeight > best.actualWeight || (ss.actualWeight === best.actualWeight && ss.actualReps > best.actualReps)` to match the user's "heaviest = highest weight" mental model.

---

## Things that look correct (sanity checks that passed)

- **`createSession` transaction discipline.** All session-entries + PB-upsert work runs under a single `BEGIN/COMMIT` on one client, with explicit `ROLLBACK` on the structured 409 path before grabbing metadata. No half-written sessions on PR-insert failure (the err propagates and the outer catch rolls back the actual work).
- **Offline backup + restore.** `replab:session:{templateId}:{date}` JSON, 200ms debounce, 7-day TTL purge on mount, write-suppress during restore, server load wins on race. The restore correctly skips entries/completedSets/notes mismatches by guarding each field with `typeof`/`Array.isArray`. Good edge handling for Safari private mode (`try/catch` on every localStorage call).
- **PR detection client+server agreement.** Client uses `prKeys` Set seeded from `/pbs?templateId=X` for the in-modal PR badge. Server uses `INSERT … ON CONFLICT (user_id, template_id, exercise_name, best_weight) DO UPDATE SET best_reps = GREATEST(...)`. Both paths agree on "higher weight wins, tiebreak on higher reps" per the user's stated rule.
- **Stale-closure guards on `handleBlur`.** `completedSetsRef` / `autoFilledRef` / `userEditedRef` are mirrored from state via dedicated effects (line 331-333), and `handleBlur` reads from the refs instead of the closure-captured Set. Race between "type a value → tap checkmark before blur fires" is correctly handled.
- **Full-screen overlay + portaled modals.** Full-screen overlay is portaled to `document.body` at `z-[90]`, PR modal portals at `z-[110]`, share menu at `z-[70]`. Stacking order works for all of them. PR-modal-behind-FS-overlay regression from the recent fix is gone.
- **Focus traps on every modal.** `useFocusTrap` is wired to PR modal, add-exercise modal, begin prompt, pre-begin summary, date confirm, pending swap, delete set, confirm-delete-last. Good a11y baseline.
- **Idempotent `/sessions/initialize`.** Existing session is returned as-is; first-call creates the workout_data copy. Re-calling never resets entries.
- **Session backup is cleared on successful save AND on completion.** `clearSessionBackup` is called in `handleSave` (line 1988) and `handleMarkComplete` (line 1723); the "submitted: true" sentinel is written first so a late restore pass can't pick it back up.
- **`runTimerInterval` is wall-clock-based.** Workout timer survives background suspension because it recomputes `Math.floor((Date.now() - origin) / 1000)` each tick. (Rest timer does not — see P1.)
- **`exKey` collision handling.** Duplicate exercise names within a single workout get suffix `::1`, `::2`, ... preserving first-occurrence as bare name so existing saved sessions decode without migration. Used consistently across handleSave, handleToggleComplete, share-image, exercise refs, etc.
- **Drag-to-reorder with `@dnd-kit`.** TouchSensor activation requires 500ms stillness + 8px tolerance — drag activation correctly doesn't fight the row's tap (focus input), swipe-left (delete), and swipe-right (complete). Completed sets are `disabled` so users can't accidentally drag a set they've already logged.
- **XSS via notes / exercise names is mitigated.** `server/middleware/sanitize.js` runs xss() over every req.body/query/params string before the route handler sees it. Set notes, exercise names, section notes all flow through.
- **Plate calculator Machine mode no longer leaks weight.** `setBar(0); setTarget('0')` on Machine pick (PlateCalculatorModal.jsx:182-187) — explicitly resets to a clean machine state. The "restore from Machine → 45 on switch back" is fine (see P2 about preserving the user's preferred bar).
- **Section header long-press, two-step delete, and undo toast** all work for both individual sets and full exercises. State migration (entries/completedSets/autoFilled/notes) shifts indices correctly on add/delete/reorder/swap — manually verified by tracing `handleAddSet` → `handleDeleteSet` → `handleReorderSets` → `performSwap`.
- **Auth on every session-related endpoint.** Every route in `server/routes/sessions.js` is behind `authMiddleware`. Same for `/pbs/*`, `/cardio/*`, `/metrics`, `/templates`. No anonymous reads.
