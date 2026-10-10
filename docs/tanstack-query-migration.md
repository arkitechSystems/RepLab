# TanStack Query migration

Project to move RepLab's client data loading, caching, retries and offline saving onto
TanStack Query, so one well-tested library owns that logic in place of the hand-built layers
that caused the Oct 2026 bugs. Server-side Zod checks are the final phase.

**Read this first if you're picking the project up on another computer or Claude login.**
Decisions below are settled. Add new questions and answers to the decision log as they come up.

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
  different user signs in (same privacy rule as today). Cache `buster` = app version, so a release
  that changes data shapes starts clean.
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
1. **Foundation** — `QueryClient` + persisted provider, `onlineManager` (Capacitor Network), query-key factory (`src/queries/keys.js`), slimmed `api.js` (old options still accepted as no-ops until phase 6), status banner + sync count driven by query/mutation caches, cache wipe on logout/user switch. Tests for each.
2. **Simple reads** — `useExercises`, BottomNav, missed-workouts prompt, Progress, History, SessionDetail/Summary, Profile, Community.
3. **Workouts home + Calendar** — shared queries (programs, templates, sessions, schedule, PRs) and their writes (schedule edits, copy, move, delete, rest day, rename) with an invalidation map.
4. **WorkoutSession** — load via queries; `initialize`, `saveSession`, `completeSession` mutations with offline persistence and per-day scope; PR refresh; cardio entries; old-localStorage upgrade step; remove the 15s retry loops and pending-complete keys.
5. **Remaining writes** — CreateWorkout, EditWorkout, CreateProgram, AI generator, Profile settings, sharing/invites.
6. **Cleanup** — delete the old cache/banner code in `api.js`, strip API handling from `public/sw.js` (bump cache name), remove dead code.
7. **Full test pass** — automated suite + manual checklist (below). Fix, retest, then ask Will to approve the merge.
8. **Release** — merge to `main` → website deploy → watch Coding Errors + Sentry for a few days → iOS (Xcode Cloud tag) and Android (.aab) builds.
9. **Zod** — schemas for the session, schedule and template routes on the server; reject bad shapes with a 400 that names the field. Decide then whether to share schemas with the client.

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

- _(none yet)_
