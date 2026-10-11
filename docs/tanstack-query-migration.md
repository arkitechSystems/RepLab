# TanStack Query migration

Project to move RepLab's client data loading, caching, retries and offline saving onto
TanStack Query, so one well-tested library owns that logic in place of the hand-built layers
that caused the Oct 2026 bugs. Server-side Zod checks are the final phase.

**Read this first if you're picking the project up on another computer or Claude login.**
Decisions below are settled. Add new questions and answers to the decision log as they come up.

## To-do (after the 2026-10-11 website release)

Claude: remind Will of any open item here at the start of a session.

- [ ] **Merge `zod-validation` into `main`** — on or after **2026-10-14**, once the website has been
  quiet. Will chose to wait so a problem can be traced to TanStack or to Zod (2026-10-11). Ask Will
  before merging; it deploys the website. This merge also brings the two Android files from
  `npx cap sync android` (network plugin) onto `main`.
- [ ] **Will: manual website checks** — on replab-fitness.com, log sets, go Offline in DevTools,
  log a set and edit the calendar, go back online, confirm "All changes synced" and the changes
  survive a refresh.
- [ ] **Watch Coding Errors + Sentry** for a few days after the release (reading the production
  database needs Will's OK).
- [ ] **Will: iPhone build** — Xcode Cloud runs `npx cap sync ios` itself; test airplane mode on the device.
- [ ] **Will: Android build** — build only after the `zod-validation` merge (or once the two Android
  files reach `main`); test airplane mode on the device.

## Save point and branches

| | |
|---|---|
| Save point (commit before the migration) | `0e5bb7f` — "style: goal weight and reps lose their boxes…" (2026-10-07) |
| Tag | `pre-tanstack-query` (on GitHub) |
| Work branch | `tanstack-query` (pushed to GitHub as work progresses; Render deploys only `main`) |
| Merge | Into `main` only after the full test pass (phase 7) and Will's approval |

Roll back after merge: `git revert` the merge commit, or redeploy the `pre-tanstack-query` tag.
Never force-push `main`.

## Why

Oct 2026 bugs that this targets (see Admin → System → Coding Errors):

- `api()` passed its own `cache: true` option into `fetch()`, which rejected it. Every cached
  load looked like a network failure, showed a false "Slow connection" banner, then failed
  (fixed in `28fd8bd`). The retry, timeout and saved-copy layer was all custom code.
- Save logic is spread across `api.js`, `WorkoutSession.jsx` (autosave, local backup, 15s retry
  loop, offline Mark Complete) and `public/sw.js` (API cache + offline POST queue that answers
  with a fake success). Three overlapping layers = hard to reason about, easy to break.

## Decision log

| # | Date | Question | Decision |
|---|---|---|---|
| 1 | 2026-10-10 | Zod in this project? | **Later phase.** Finish and test TanStack Query first, then Zod on the save routes (sessions, schedule, templates). |
| 2 | 2026-10-10 | How does the work reach the live app? | **Branch, then merge.** All work on `tanstack-query`; merge to `main` once fully tested. |
| 3 | 2026-10-10 | Service worker API caching + offline POST queue? | **Strip API handling.** SW keeps caching app files (site opens offline) but no longer touches API requests. TanStack Query owns saved data and offline saves. |
| 4 | 2026-10-10 | Same workout day edited on two devices? | **Last save wins** (same as today; each save sends the whole day). |
| 5 | 2026-10-10 | Save/connection status shown to users? | **Keep + sync count.** Keep yellow "Slow connection" banner, "Showing saved data from…" line and Saving/Saved indicator (now driven by TanStack Query) and add a small "N changes waiting to sync" note when saves are queued. |
| 6 | 2026-10-10 | Automated client tests? | **Add them.** Vitest + Testing Library + MSW for the save/offline paths, plus a manual device checklist. |
| 7 | 2026-10-10 | Release order? | **Website first**, watch Coding Errors + Sentry for a few days, then iOS/Android builds. |
| 8 | 2026-10-10 | Push tag and branch to GitHub? | **Push both** (backup + visible from any login). |
| 10 | 2026-10-10 | Offline edits outside a workout (Calendar / Workouts)? | **The stack's way where it fits.** Self-contained edits — rest day, rename, delete, move a workout to another day — are queued like workout saves: the screen updates immediately (optimistic), they sync later and count in "N changes waiting to sync"; last change wins (decision 4). Multi-step edits that need the server's answer first — copy a workout, start empty, create workout/program — fail with "You're offline — try again when connected." Built in phase 5. |
| 9 | 2026-10-10 | Logging out with workout changes not yet synced? | **Warn first:** "You have N workout changes that haven't synced yet. If you log out now, they will be lost." — Stay logged in / Log out anyway. Logging out wipes everything, unsent changes included, so the next person on the device never sees or sends them. (A forced logout — refresh token rejected — can't ask and wipes them.) |

### Technical defaults (Claude's calls — change them here if they turn out wrong)

- **Library:** `@tanstack/react-query` v5 (React 18.3 is fine), `@tanstack/react-query-persist-client`,
  `@tanstack/query-async-storage-persister`; storage in IndexedDB via `idb-keyval` (localStorage is
  ~5 MB and synchronous). React Query Devtools in dev builds only.
- **Online/offline detection:** `@capacitor/network` feeds TanStack's `onlineManager` on iOS/Android
  (`navigator.onLine` is unreliable in the WebView); browser events on the web. Needs a native
  rebuild, which phase 8 does anyway.
- **`api.js` keeps:** auth header, token refresh on 401, 30s time limit (60s for `/ai/`), JSON/error
  envelope handling, the "fetch rejected for a non-network reason = code bug, report it" check.
  **Removed:** `cache: true`, `cacheOnly`, `cachedAt`, the `rl_cache_v1:` localStorage cache, the
  built-in auto-retry, `trackRequest` / connection-state counters, `markShowingCached`.
- **Retries:** reads retry twice with backoff on connection errors only (never on 4xx or code bugs).
  Saves retry until they succeed while the failure is a connection error; any other error is shown.
- **Freshness:** `staleTime` 30s by default; refetch on window focus and reconnect.
- **Saved copies:** the query cache is persisted for **30 days** and cleared on logout and when a
  different user signs in (same privacy rule as today). Cache `buster` = `CACHE_SHAPE_VERSION` in
  `queries/queryClient.js`, **not** the app version: changing the buster throws away queued saves too,
  so bump it only for a release that changes cached data shapes.
- **Workout saves:** one `saveSession` mutation with a `mutationKey` + `setMutationDefaults` (so a
  queued save still knows how to send itself after the app restarts) and a per-day `scope`
  (`session-<templateId>-<date>`) so saves for one day go out strictly in order. Mark Complete is a
  mutation in the same scope, so it always lands after the day's last save.
- **Kept on purpose:** WorkoutSession's in-session draft backup (`replab:session:*`) — it protects
  typed numbers that haven't been saved yet, which is a different job from the server cache.
- **Upgrade safety:** on first run of the new version, any old `wf-pending-complete-*` keys and
  unsent `replab:session:*` backups are turned into queued mutations, then old `rl_cache_v1:` keys
  are deleted. Nobody mid-workout during the update loses sets.
- **Scope of screens:** real app screens only. Prototype/test pages (`*Test.jsx`, `NikeTestHomepage`,
  `Brainstorm`, etc.) keep calling `api()` directly. Admin, trainer and workout-dashboard pages are
  server-rendered and unaffected.

## Behavior that must keep working

Checked off in phase 7. Anything that can't be kept goes to Will as a question first.

**Loading / viewing**
- [ ] Workouts home paints instantly from the saved copy, then refreshes (top card, Resume, last workout, totals, PR stats, schedule today/tomorrow, featured program, pending shares)
- [ ] Calendar week/month views, completed markers, remembered week/month and place on Back
- [ ] Workout opened before on this phone opens offline; "Showing saved data from <time>" appears
- [ ] Workout never opened on this phone shows the "you're offline…" message
- [ ] Exercise library + muscle pills, saved exercises pinned on top
- [ ] Bottom-nav play button (today's unfinished workout), missed-workouts prompt
- [ ] Progress, PRs by muscle, History, Session detail/summary, Profile, Community

**Saving**
- [ ] Set check/uncheck autosaves immediately; structure changes autosave after 1.5s; manual Save
- [ ] Locked checked sets, goal overrides (long-press), set types, supersets, section headers, smart cardio fields, cardio acceleration entries
- [ ] PR detection + Monolith PR toast after a save; PR dates kept
- [ ] Overwrite protection (409) on Calendar copy / cold open of a logged day
- [ ] Mark Complete online and offline; Undo Completion; completion verses / milestone
- [ ] Calendar: copy (with/without Use Reps), move, delete, rest day, rename (linked everywhere)
- [ ] Create/Edit workout, Create program, AI generator, Save to My Workouts, sharing/invites
- [ ] Saves made offline survive closing the app and send when back online, in order

**Status UI**
- [ ] Yellow "Slow connection — still trying" banner only for real slowness
- [ ] Saving… / Saved indicator in the session
- [ ] New: "N changes waiting to sync"
- [ ] Logout clears all saved data; switching accounts never shows the previous user's data

## Phases

Each phase ends with a commit on `tanstack-query` (pushed), and the app must build and work at the
end of every phase — unconverted screens keep using `api()` until their phase.

0. **Prep** — ✅ done 2026-10-10. Tag + branch, this doc, `CLAUDE.md` pointer. Installed `@tanstack/react-query` 5.104, persist-client, async-storage-persister, `idb-keyval`, `@capacitor/network` 8 (native projects not synced yet — run `npx cap sync` before the phase 8 mobile builds), and dev-only Devtools, Vitest 3, jsdom, Testing Library, MSW 2, fake-indexeddb. `npm test` in `client/` runs `src/**/*.test.js(x)`; setup in `src/test/` (MSW fake server; the test `fetch` resolves relative URLs and handles abort signals itself because Node's fetch rejects jsdom's). Baseline `src/api.test.js` (6 tests) pins today's `api()` behavior, including the `cache: true` regression. Added `/errors` to the Vite dev proxy.
1. **Foundation** — ✅ done 2026-10-10. In `src/queries/`: `queryClient.js` (client, retry rules, IndexedDB persister, `clearQueryCache`, `getPendingSaveCount`), `QueryProvider.jsx` (restore, then resume queued saves; Devtools in dev), `network.js` (Capacitor Network → `onlineManager`), `keys.js` (key factory + `fetchPath`), `mutationDefaults.js` (empty registry for phase 4), `status.js` (`usePendingSaveCount`, `useSavedDataNotice`). `api.js`: `autoRetry: false` option (one attempt, banner tracking kept) and `onApiCacheClear` so logout/account switch wipes the query cache. Layout shows "N changes waiting to sync"; Profile logout warns (decision 9). Tests: 16 passing (retry rules, saved copy survives restart, offline save survives restart and sends once, per-day order, logout wipe, provider renders). Original plan text:
   `QueryClient` + persisted provider, `onlineManager` (Capacitor Network), query-key factory (`src/queries/keys.js`), slimmed `api.js` (old options still accepted as no-ops until phase 6), status banner + sync count driven by query/mutation caches, cache wipe on logout/user switch. Tests for each.
2. **Simple reads** — ✅ done 2026-10-10 (after phase 3). `useExercises` is a `useQuery` hook shared by every screen (10-min freshness, optimistic favorites via `setQueryData`, only refreshed by changes to `/exercises` via `meta.refreshOnWritesTo`). BottomNav is a quiet query (`meta.quiet`: one attempt, never drives the banner) re-checked on route change and app focus. History, Progress, Session detail and Session summary use `useApiQuery` (new in `queries/status.js`) — they now show the saved copy offline (they used to just fail) and "Tap to retry" refetches instead of reloading the page. Profile and Community keep their one-time loads into editable state (a live hook could overwrite an edit in progress) via `loadPathOrSaved`. Missed-workouts prompt uses `loadPath`. Bugs found and fixed: (a) TanStack's default pauses loads while the device reports offline, so a screen with nothing saved would spin forever instead of showing its error — queries now use `networkMode: 'always'` (saves still pause offline); (b) the broad "mark stale on any change" rule would have reloaded the whole exercise library in every exercise card on every workout autosave — queries can now scope it. Tests: 50 client tests pass (exercise library sharing/favorites/rollback/no reload on autosave, bottom nav, History/Progress/Session detail online/offline/retry). Original plan text: `useExercises`, BottomNav, missed-workouts prompt, Progress, History, SessionDetail/Summary, Profile, Community.
3. **Workouts home + Calendar** — ✅ done 2026-10-10 (before phase 2, at Will's request). Approach: both pages keep their own state and render logic (7.6k + 2.1k lines; a hooks rewrite was judged too risky) and load through `queries/data.js` — `loadPath` / `savedPath` / `savedAt`, drop-in replacements for `api(…, { cache: true })` / `cacheOnly` / `cachedAt` backed by the shared TanStack cache. Every successful change made through `api()` (any screen) marks all cached reads stale (`onApiWrite`; `{ invalidate: false }` opts out). Old saved copies (`rl_cache_v1:`) are imported into the TanStack cache at start-up so offline viewing survives the update. Bugs found and fixed by the new tests: (a) `gcTime` of 30 days overflowed `setTimeout` and dropped every unwatched query the moment it loaded — now `Infinity`; (b) if the device restore took >1.5s, offline Workouts showed a blank screen — both pages now fall back to the saved copy when the live load fails; (c) TanStack retries made the banner flash "Couldn't reach RepLab" on the first dropped attempt — the banner now follows TanStack's retry state (slow while retrying, failed after the last retry). Screen tests render the real Workouts and Calendar pages against MSW: online, offline with a saved copy, offline with copies from the old version, offline with nothing saved. 35 client tests pass. Original plan text: shared queries (programs, templates, sessions, schedule, PRs) and their writes (schedule edits, copy, move, delete, rest day, rename) with an invalidation map.
4. **WorkoutSession** — ✅ done 2026-10-10. `queries/sessionMutations.js`: `SAVE_SESSION` and `COMPLETE_SESSION` mutations (registered via `mutationDefaults.js` so restored ones can resume), per-day `scope` so a day's saves and completion go out strictly in order, `startMutation` (resolves `sent` / `queued` so `handleSave` keeps its `true` / `'connection'` / `false` contract), `latestPendingSave`, `cancelPendingComplete`. WorkoutSession: autosave/manual save and Mark Complete go through the queue; "Not saved yet — will retry" and "Completed on this phone — will sync" are derived from it (`useMutationState`); the 15s retry loops and the `wf-pending-complete-*` key are gone (an old key is moved onto the queue on open); Undo before sync removes the queued completion; loads use `loadPath` / `savedPath`, and go saved-copy-first when the Capacitor network status says offline. Kept: the typed-numbers backup (`replab:session:*`), PR check after a save, 409 overwrite protection, tutorial mode. Pre-existing data-loss risks fixed: (a) reopening a workout with unsent sets showed the older server copy and the next autosave overwrote them — the loader now shows the newest unsent save; (b) reopening offline after sets had synced showed the copy from first open (same overwrite) — each successful save/complete now updates that day's saved copy. Also: `loadPath` recovers when a refresh cancels it mid-load. Not changed: the hidden legacy blue cardio card (fails offline as before); the in-session "Save to My Workouts" and rename (rename is queued in phase 5 per decision 10). Every workout autosave still marks cached reads stale (decided harmless: nothing on the session screen watches them live, and the exercise library is scoped out). Tests: 65 client tests pass, including 7 driving the real session screen (online save, offline sets sent in order on reconnect, offline Mark Complete then save→complete order, reopen shows unsent sets with the backup removed, Undo before sync, server-rejected save shows an error and isn't queued, old-version completion carried over). Original plan text: load via queries; `initialize`, `saveSession`, `completeSession` mutations with offline persistence and per-day scope; PR refresh; cardio entries; old-localStorage upgrade step; remove the 15s retry loops and pending-complete keys.
5. **Remaining writes** — ✅ done 2026-10-10. `queries/edits.js`: one `QUEUED_EDIT` mutation (registered in `mutationDefaults.js`) that sends any self-contained change, all in one scope so they go out in the order made (last change wins). `queueEdit({ path, method, body, patch })` updates the saved copies right away from a small `patch` description (`schedule`, `scheduleClearFrom`, `templateRename`, `templateDelete`, `templateProgram`, `templateReorder`, `programRename`, `programDelete`), puts them back if the server refuses, and while an edit waits every fresh load shows it on top of the server's older data (`keys.js` `fetchPath` overlay) — so a reload can't flash the old state or lose it. Queued (decision 10): Calendar assign/move a workout to a day, clear a day, rest day, skip (pull workouts up), clear calendar from a date; Workouts rest day, add to a day, rename workout, rename program, delete workout/program/week, move workout to a program, reorder; rename inside a session and on Session summary. Need a connection (say "You're offline — try again when connected." up front via `requireOnline()` / `offlineMessage()`): copy, start empty / log as you go, push schedule back, Save to My Workouts, create/edit workout, create program, AI generator, Begin Program, sharing/invites, trainer workouts, missed-workouts Resume/Skip, Profile settings and photo (these used to fail silently or with a generic error). Edit Workout stays online-only (Claude's call: it replaces the whole exercise list and can create custom exercises, so a late-arriving queued copy could overwrite newer edits from another device). `api.js` now also treats the Capacitor network status as offline for those (`setOfflineCheck`, set in `queries/network.js`). Create/Edit Workout read their lists with `loadPathOrSaved` (open offline with the saved copy). Tests: 78 client tests pass — edit queue unit tests (sent online, refusal rolls back, offline → restart → reload shows the edit → sent once each in order, retry until through, each patch kind) and screen tests (Calendar: clear a day offline → shows at once → still cleared on reopen → sent on reconnect; Start Empty offline says so and sends nothing; session rename offline → new name shows → sent on reconnect).
6. **Cleanup** — ✅ done 2026-10-10. `public/sw.js` → `replab-v7`: caches only the app's own files (static assets cache-first, page loads fall back to the cached shell offline); no API caching, no offline POST queue, no fake `{ queued: true }` replies. Activating v7 deletes v6's caches (including its API copies), and anything still in v6's `replab-sync` queue is sent once (at activation, or after the next online page load) and the queue is deleted. `main.jsx` / `Layout.jsx` no longer talk to the worker about syncing; Layout's offline banner follows TanStack's `onlineManager` (`useIsOnline` in `queries/status.js`; on the web it starts from `navigator.onLine`), and "All changes synced" flashes when the waiting count drops to 0. `api.js`: the `rl_cache_v1:` localStorage cache is gone (`cache: true` writes, `cacheOnly`, `cachedAt`); old copies are still imported once, and each is deleted on a later start once the TanStack cache holds that path. **Kept on purpose (changed from the original plan):** the connection-state counters (`trackRequest`, `getConnectionState` / `subscribeConnection`) and `markShowingCached` — they are how the yellow "Slow connection" banner and "Showing saved data from…" line work (decision 5), now fed by TanStack as well; and `api()`'s built-in retry for reads — screens and actions that still call `api()` directly for a GET (search, sharing, trainer pages, AI, …) keep retrying a dropped connection. Tests: 79 client tests pass.
7. **Full test pass** — automated suite + manual checklist (below). Fix, retest, then ask Will to approve the merge.
   - ✅ Automated (2026-10-10): client 79/79 (`npm test` in `client/`), server 125 passed / 2 skipped (need a real database), `npm run build` passes. Covered by the client suite: Workouts home and Calendar online / offline with a saved copy / old-version copies / nothing saved; exercise library, bottom nav, History, Progress, Session detail; session set saves online and offline, reopen with unsent sets, offline Mark Complete + order, Undo before sync, server-refused save, old-version completion; queued Calendar/Workouts edits and in-session rename; online-only actions say "You're offline"; logout/account switch wipes saved data and queued saves; saved copy and queued saves survive a restart.
   - ⏳ Manual (Will): the checklist and device tests below — website with DevTools Slow 3G / Offline, iPhone + Android airplane mode (needs the phase 8 native build with `npx cap sync` for `@capacitor/network`), two devices, account switch, Coding Errors quiet afterwards.
   - Correction to "Upgrade safety" above: unsent `replab:session:*` backups are not turned into queued saves at start-up; as before, they are restored when that workout is opened and then saved through the queue.
8. **Release** — merge to `main` → website deploy → watch Coding Errors + Sentry for a few days → iOS (Xcode Cloud tag) and Android (.aab) builds.
   - ✅ Merged to `main` 2026-10-11 with Will's approval (merge commit `f3bb7ca`; undo with `git revert -m 1 f3bb7ca`). Website deploying on Render.
   - ⏳ Watch Coding Errors + Sentry; then `npx cap sync` and the iOS/Android builds.
9. **Zod** — schemas for the session, schedule and template routes on the server; reject bad shapes with a 400 that names the field. Decide then whether to share schemas with the client.
   - ✅ Built 2026-10-10 on its own branch **`zod-validation`** (contains this branch plus the Zod work; details in that branch's copy of this doc). Merge it after `tanstack-query` has been live and quiet for a few days.

## Test plan

**Automated (client, Vitest + MSW):** save while online; save while offline → queued → app
"restart" (persist + restore) → back online → sent once, in order; Mark Complete offline then
online; connection error vs. 4xx vs. code bug handling; logout clears cache; user switch; old
localStorage keys upgraded. Server tests (`server/tests`, existing Vitest) keep passing.

**Manual:**
- Website: Chrome with DevTools network throttling (Slow 3G) and Offline.
- iPhone and Android: airplane mode mid-workout → log sets → Mark Complete → force-quit → reopen → airplane mode off → confirm sets and completion on the website.
- Two devices on one account (last save wins).
- Log out → log in as another user → no leftover data.
- Admin → Coding Errors shows nothing new after a test session.

## Open questions

Add questions that come up during implementation here, ask Will, then move the answer to the decision log.

- ~~Note for phase 4: session saves should be targeted.~~ Resolved in phase 4: left broad (see phase 4 notes).
