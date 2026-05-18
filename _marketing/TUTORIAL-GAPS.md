# REPLAB Tutorial Coverage Audit

_Audit date: 2026-05-17. Scope: `client/src/components/Tutorial.jsx` + `client/src/data/tutorialSteps.js` (Phase 1A "Browse → Pick → Begin" flow) and the in-session walkthrough in `client/src/pages/WorkoutSession.jsx` (`tutorialMode`). Test-route pages and gated sections (Featured, Challenges, Trainer dashboard) are out of scope._

## Summary

REPLAB ships **two** tutorials that together cover roughly **40%** of the surface area a new user touches in their first session. The Phase 1A tutorial is short and tight (6 spotlight steps covering only the "pick a pre-built program → schedule" flow); the in-session tutorial is much deeper (13 spotlight steps after the recent `plate-calc` + `full-screen` additions). The biggest uncovered surfaces are **outside the session**: the create-workout flow (no tutorial despite the Phase 1A "Create My Own Workout" branch deep-linking via `?tutorialPointer=create`), the Calendar page (zero tutorial coverage), the Profile page (zero coverage of preferences, metrics, share-activity, subscription, account controls), the Utilities page (zero coverage of the seven tool rows), the post-workout share menu, PB celebration, and exercise-card secondary controls (Demo, PRs, exit-workout, viewfinder placement, full-screen nav arrows). The Welcome onboarding shows a static 4-screen carousel + 1RM collection step (`client/src/pages/Welcome.jsx:7`) but no anchored spotlights, and Signup has no in-form guidance for the password rules or referral fields.

## Tutorial inventory

### Phase 1A — Browse → Pick → Begin
Defined in `client/src/data/tutorialSteps.js:2-58`. Rendered by `client/src/components/Tutorial.jsx` (intro + choice screens at `Tutorial.jsx:109-256`, spotlight loop at `Tutorial.jsx:258-475`). Entry point: the **Tutorial** card on the Workouts page (`client/src/pages/Workouts.jsx:5709-5755`).

| # | Step id / target | Title | Description (abridged) | Spotlights | File:line |
|---|---|---|---|---|---|
| Pre | _intro screen_ | "How can we help you get started?" | Two big cards: Find/Create a Workout, How to Log Your Workouts | (modal, no target) | `Tutorial.jsx:109-180` |
| Pre | _choice screen_ | "How would you like to get started?" | Follow Pre-Built Program / Create My Own | (modal, no target) | `Tutorial.jsx:183-256` |
| 1 | `browse-library` | Browse Workout Library | Tap to browse pre-built programs | `[data-tutorial="browse-library"]` Browse card on Workouts hub | `tutorialSteps.js:3-11` |
| 2 | `program-card` | Pick a Program | Tap a program to preview | First program card under Browse | `tutorialSteps.js:12-23` |
| 3 | `begin-program-btn` (+ `week-card`) | Two Ways to Add Workouts | Begin Program OR tap a week | Begin button + first week card | `tutorialSteps.js:24-37` |
| 4 | `week-add-btn` (`id: week-add`) | Add a Workout | Schedule one workout to a day | First non-rest workout's "Add" button | `tutorialSteps.js:38-47` |
| 5 | `begin-modal` (`id: begin-modal`) | Choose When to Start | Start Today vs. Choose Date | The Begin Program confirmation modal | `tutorialSteps.js:48-57` |

### In-session — TutorialWorkout
Sample workout launched from the intro's "How to Log Your Workouts" button → `/tutorial/workout` (`Tutorial.jsx:153`). Steps fire from `WorkoutSession.jsx:4039-4234`; target map at `WorkoutSession.jsx:240-255`.

| # | Step key | Target | Title | Description (abridged) | File:line |
|---|---|---|---|---|---|
| 1 | `begin-workout` | `[data-tutorial="begin-workout-btn"]` | Begin Your Workout | Tap Begin Workout to start the session | `WorkoutSession.jsx:4042-4050` |
| 2 | `timer` | `[data-tutorial="workout-timer"]` | Workout Timer | Total time + pop-out + lock toggle | `WorkoutSession.jsx:4051-4058` |
| 3 | `rest` | `[data-tutorial="rest-timer"]` | Rest Timer | Start Rest, duration dropdown, pop-out, lock, audio cue | `WorkoutSession.jsx:4059-4066` |
| 4 | `exercise-card` | `[data-tutorial="exercise-card"]` | Exercise Card | Intro to the card structure | `WorkoutSession.jsx:4067-4075` |
| 5 | `exercise-header` | `[data-tutorial="move-buttons"]` | Reorder Exercises | Up/down arrows | `WorkoutSession.jsx:4076-4083` |
| 6 | `swap-exercise` | `[data-tutorial="swap-button"]` | Swap Exercise | Substitute current exercise | `WorkoutSession.jsx:4084-4091` |
| 7 | `add-delete-exercise` | `[data-tutorial="add-delete-buttons"]` | Add & Remove Exercises | Plus / X, with Demo callout | `WorkoutSession.jsx:4092-4099` |
| 8 | `set-controls` | `[data-tutorial="set-controls"]` | Add & Remove Sets | Add Set, Remove, long-press to delete | `WorkoutSession.jsx:4100-4107` |
| 9 | `set-row` | `[data-tutorial="set-row"]` | Tracking a Set | Checkmark, Type, Goal Wt, Actual Wt, Goal Reps, Actual Reps | `WorkoutSession.jsx:4108-4115` |
| 10 | `plate-calc` | `[data-tutorial="plate-calc"]` | Plate Calculator | ⚖ icon + long-press on weight input | `WorkoutSession.jsx:4116-4123` |
| 11 | `full-screen` | `[data-tutorial="full-screen"]` | Full-Screen Mode | Viewfinder, ←/→ navigation, Profile default | `WorkoutSession.jsx:4124-4131` |
| 12 | `session-settings` | `[data-tutorial="session-settings"]` | Display Settings | Goal Weight/Reps + Set Type toggles | `WorkoutSession.jsx:4132-4139` |
| 13 | `exercise-notes` | `[data-tutorial="exercise-notes"]` | Exercise Notes | Form cues / how it felt | `WorkoutSession.jsx:4140-4147` |
| 14 | `mark-complete` | `[data-tutorial="mark-complete"]` | Complete Your Workout | Mark Complete + summary | `WorkoutSession.jsx:4148-4156` |

> Note: the session-settings copy still says "Goal Weight / Reps + Set Type" but the live menu now also exposes **Light/Dark Cards** (`WorkoutSession.jsx:2855-2867`) and **Full-Screen Mode toggle** (`WorkoutSession.jsx:2874-2880`) — see Step 12 stale-copy note in High-priority gaps.

## Orphans + breaks

### Orphaned `data-tutorial` markers (in DOM but no tutorial step targets them)
- **`data-tutorial="create-btn"`** — rendered on the "+ Create" header button at `Workouts.jsx:4734-4746`. Used only by an in-page "tutorialPointer" spotlight (`Workouts.jsx:1173`, `5955-6016`) triggered when the user takes the "Create My Own Workout" choice. Not part of either tutorial system's step list. Either remove or hook into Phase 1B.
- **`data-tutorial="start-today-btn"`** — rendered inside the Begin modal at `Workouts.jsx:2902`. Phase 1A step 5 spotlights the parent `begin-modal` container instead, so this finer-grained marker is orphaned.
- **`data-tutorial="my-workouts"`** — rendered on the "My Workouts" hub card at `Workouts.jsx:5343` (commented out) and `Workouts.jsx:5380` (live). No tutorial step references it.
- **`data-tutorial="nav-workouts"` / `nav-calendar` / `nav-utilities` / `nav-profile`** — rendered on every BottomNav tab (`BottomNav.jsx:68`). Zero tutorial steps reference them. They are clearly seeded for a future "Tour of the tabs" but currently dead.

### Broken spotlights (step references a selector that doesn't exist)
None observed. Every selector in `tutorialSteps.js` and the `WorkoutSession.jsx` target map matches at least one live `data-tutorial="..."` attribute in the codebase (the in-session steps additionally rely on `exercise-card`, `move-buttons`, `set-row`, `plate-calc`, `full-screen`, etc. all being conditionally rendered by `dataTutorial` prop drilling on the first exercise card in tutorial mode, which is fine).

> Risk: Phase 1A step 3 references both `begin-program-btn` and `week-card` simultaneously, but the live page renders **three** different `data-tutorial="begin-program-btn"` instances (`Workouts.jsx:183`, `908`, `2072`, `2267`) depending on the user's current subview. `document.querySelector` picks the first match — usually OK but worth knowing.

## Gap analysis tables

### Critical priority — a new user almost certainly will not discover this without a pointer

| Feature | Where | Suggested step copy | Suggested target marker | Tutorial system |
|---|---|---|---|---|
| **Create-your-own-workout flow** | The intro's second choice ("Create My Own Workout") deep-links to `/?tutorialPointer=create` but only flashes a glow ring on the "+ Create" header button (`Workouts.jsx:5955-6016`). The CreateWorkout page itself has no tutorial. | "Create from Scratch" — "Tap **+ Create** to build a workout. You'll name it, add exercises, set rep targets, and save it to **My Workouts**." Then a second step on the CreateWorkout page: "Add Exercises" — "Search the REPLAB library or type a custom name. You can drag-reorder, set the rest interval, and pick a set type (straight, drop, pyramid)." | `data-tutorial="create-btn"` already exists; add `data-tutorial="add-exercise-search"` + `data-tutorial="save-workout-btn"` inside `CreateWorkout.jsx` | Phase 1B (currently empty in `tutorialSteps.js:61`) |
| **Calendar page — entire screen** | `Calendar.jsx` — month/week toggle, tap-a-day to schedule/swap, rest-day insertion, "copy this week" feature (`Calendar.jsx:44`), workout reordering. | "Your Calendar" — "Tap any day to swap its workout, insert a rest day, or copy the entire week forward. Use the week/month toggle in the top-right to change views." | Add `data-tutorial="calendar-view-toggle"` and `data-tutorial="calendar-day-cell"` on the first weekday cell | New `phase: '2'` tutorial (already a placeholder at `tutorialSteps.js:64`) |
| **Exit-workout / save-and-leave** | The red "Back" / "Exit Tutorial" label in the WorkoutSession header (`WorkoutSession.jsx:2465-2470`). New users routinely worry they will lose data if they back out. | "Leaving Mid-Workout" — "Tap **Back** anytime — REPLAB auto-saves as you go. Your sets stay on the day's card and you can pick up exactly where you left off." | `data-tutorial="exit-workout"` on the back button | In-session (insert after `begin-workout`, before `timer`) |
| **Demo / video button on exercise card** | `ExerciseCard.jsx:327-336` — every exercise has a Demo button that toggles an inline form-cue video. | "Watch the Movement" — "Not sure on form? Tap **Demo** in the card header to play the exercise video right inside the card." | `data-tutorial="demo-button"` | In-session (between `add-delete-exercise` and `set-controls`, or fold into existing step 7 copy) |
| **PRs button on exercise card** | `ExerciseCard.jsx:314-326` — opens the per-exercise PR drawer. | "See Your PRs" — "Tap the **PRs** badge to view your personal records for this exercise — top weight at every rep count." | `data-tutorial="prs-button"` | In-session |
| **Set type cycling (warm-up / drop / failure)** | The Type cell on each set row — tap to cycle. Step 9 (`set-row`) mentions Type exists but never tells the user to tap it. | "Mark Warm-Up & Drop Sets" — "Tap the **Type** cell on any set to mark it as warm-up, drop set, or to failure. Warm-up sets don't count toward PRs." | Use existing `set-row` step — extend copy | In-session (extend existing step) |

### High priority — feature is moderately discoverable but a hint dramatically improves first-run

| Feature | Where | Suggested step copy | Suggested target marker | Tutorial system |
|---|---|---|---|---|
| **Light / Dark Cards toggle** | Session settings menu `WorkoutSession.jsx:2855-2867`. Step 12 (`session-settings`) copy is now stale — doesn't mention this toggle or the in-session full-screen toggle. | Update existing copy: "...toggle **Goal Weight / Reps**, **Set Type**, **Light/Dark Cards**, and **Full-Screen Mode** on the fly." | (uses existing `session-settings`) | In-session (edit step 12 copy) |
| **Floating timer (pop-out) behavior** | Touched on in steps 2-3 but new users don't realize they can drag it. | Add a beat to step 2: "Once popped out, the timer floats above the page and can be dragged anywhere on screen." | (uses existing `workout-timer`) | In-session (extend) |
| **Profile preferences — defaults** | `Profile.jsx:762-848` — six toggles (full-screen, pin timers, goal columns, set type). Setting these once persists for every future workout. | "Set Your Defaults" — "Open **Profile → App Settings** to set defaults for full-screen mode, timer pinning, and which columns appear on every workout." | `data-tutorial="profile-app-settings"` on the App Settings panel | New "Profile Tour" (Phase 4) — short, 3 steps |
| **Share Activity / privacy toggle** | `Profile.jsx:870-885` — opting in/out of activity feed visibility. | "Activity Privacy" — "**Share Activity** controls whether friends see your workouts in the Community feed. Off by default — flip it on when you're ready." | `data-tutorial="share-activity-toggle"` | New Profile Tour |
| **Workout Summary share menu (post-workout)** | `WorkoutSession.jsx:4640-4720`, opened from the summary screen. Generates a Nike-style shareable image. | "Share Your Workout" — "After Mark Complete, tap **Share** to send a stat card (image or text) to friends — or save as a template to repeat the session." | `data-tutorial="share-menu-btn"` on the Share button in WorkoutSummary | In-session (add after `mark-complete`) |
| **Save as Template (post-workout)** | `WorkoutSession.jsx:4964-4980`. Lets you turn an ad-hoc session into a reusable template. | "Reuse This Workout" — "Tap **+ Save as Template** to drop today's workout into **My Workouts** so you can run it again with one tap." | `data-tutorial="save-as-template-btn"` | In-session (post-summary) |
| **Personal Records page** | `Utilities.jsx:1181-1192` — opens the PRs muscle-group grid. | "Personal Records" — "Visit **Utilities → Personal Records** to see every PR by muscle group, and tap any row to jump back to the session where you hit it." | `data-tutorial="utilities-prs"` | New Utilities Tour |
| **Plate Calculator (standalone)** | `Utilities.jsx:1194-1205`, also at `/plate-calculator`. | "Plate Calculator" — "Loading the bar? **Utilities → Plate Calculator** shows you the exact plates per side for any target weight and bar." | `data-tutorial="utilities-plate-calc"` | New Utilities Tour |
| **1 Rep Max Estimator** | `Utilities.jsx:1207-1218`. | "Estimate Your 1RM" — "Tap **1 Rep Max Estimator** to project your max from any working set. We also pre-fill it from your Personal Records." | `data-tutorial="utilities-1rm"` | New Utilities Tour |
| **Calendar — copy this week forward** | `Calendar.jsx:44-47, 78-95` (the `copyStep` state machine). | "Repeat a Week" — "Long-press a week's header (or use the menu) to copy it forward — perfect when you've nailed a routine and want it again next week." | `data-tutorial="calendar-copy-week"` | New Calendar tutorial |
| **Bottom-tab navigation** | `BottomNav.jsx` — markers exist (`nav-workouts`/`nav-calendar`/`nav-utilities`/`nav-profile`) but no tutorial uses them. | "Tour the App" — four quick steps, one per tab: Workouts hub, Calendar, Utilities, Profile. | Use existing `nav-*` markers | New "First-run app tour" (Welcome modal post-onboarding) |
| **Long-press weight input → plate calculator** | Already documented in step 10 (`plate-calc`) but only mentioned in passing. Most users will miss it. | Reword step 10 to lead with the long-press, since it's the more discoverable use. | (uses existing `plate-calc`) | In-session (rephrase) |

### Medium priority — useful but not blocking

| Feature | Where | Suggested step copy | Suggested target marker | Tutorial system |
|---|---|---|---|---|
| Signup form — password rules | `Signup.jsx:62-66` (8+ chars, 1 uppercase, 1 number, no spaces). | Inline helper text under the password field (not a tutorial overlay) OR a 1-step Signup tutorial spotlighting the password rules. | `data-tutorial="signup-password-rules"` | New Signup tutorial (1 step) |
| Signup form — referral source dropdown | `Signup.jsx:10-18, 29-30`. | "Tell us how you found us" — single step, optional. | `data-tutorial="signup-referral"` | New Signup tutorial |
| Welcome onboarding — 1RM collection | `Welcome.jsx:48, 97-117`. Currently a static screen; no spotlight callout. | Spotlight on the bench/squat/deadlift fields explaining they prime PRs and the Plate Calculator. | `data-tutorial="welcome-maxes"` | Extend Welcome.jsx flow |
| PB Celebration overlay | `PBCelebration.jsx:20`, fired mid-session at `WorkoutSession.jsx:2385`. | "PR Unlocked" — first time the modal appears, add a one-shot caption: "REPLAB watches every set. Beat a weight × reps combo and we celebrate it right here." | `data-tutorial="pb-celebration"` | One-shot first-PR overlay |
| Featured Workouts unlock state | `Workouts.jsx:5203-5256` — card animates open on tap when unlocked. | "Featured Workouts" — "Coming soon: hand-picked guided sessions from REPLAB trainers." | `data-tutorial="featured-card"` (already styled) | Phase 1A (one extra step) |
| Notifications bell | `Workouts.jsx:4747-4761` — shows pending workout shares. | "Workout Invites" — "When a friend shares a program with you, the bell badges it. Tap to accept and drop it into your library." | `data-tutorial="notifications-bell"` | Phase 1A (conditional on count > 0) |
| Set row swipe-to-delete | Mentioned in step 8 (`set-controls`) as "long-press" — actually long-press AND swipe both work. Verify wording. | Audit step 8 copy. | (uses existing `set-controls`) | In-session (verify) |
| Body Heatmap on summary | `BodyHeatmap.jsx` used inside WorkoutSummary. Currently gated per project memory note (`project_body_parts_worked_redesign.md`). | Skip for now — feature is gated. | n/a | n/a |
| Exercise Library + custom exercise add | `Utilities.jsx:1233-1244` → `/exercises`. | "Browse Exercises" — "Search 600+ exercises or add a custom one to your library — useful for movements unique to your gym." | `data-tutorial="utilities-exercise-library"` | New Utilities Tour |
| Calendar — rest day insertion | `Calendar.jsx:39, 224-236`. | "Insert a Rest Day" — "Tap an empty day → **Rest Day** to lock it as recovery. Shows up red on the calendar." | `data-tutorial="calendar-rest-day"` | New Calendar tutorial |
| Profile — change password | `Profile.jsx:1082-1207`. | (Probably skip — discoverable on demand.) | n/a | n/a |
| Profile — Send Feedback | `Profile.jsx:639-735`. | "Feedback" — "Bug or feature idea? Tap **Send Feedback** in Profile. Goes straight to the REPLAB team." | `data-tutorial="profile-feedback"` | New Profile Tour |

### Low priority — nice-to-have, mostly self-explanatory

| Feature | Where | Suggested step copy | Suggested target marker | Tutorial system |
|---|---|---|---|---|
| Workouts page search | `Workouts.jsx:4727-4733` + `Workouts.jsx:4820-4900`. | "Find a workout fast — tap the magnifying glass to search programs and individual workouts." | `data-tutorial="workouts-search"` | Phase 1A (optional) |
| Browse Library inline search | `Workouts.jsx:3994-4046` — search inside Browse Library. | Duplicate of above; skip or fold in. | n/a | n/a |
| Profile photo upload | `Profile.jsx:514` → photo menu modal. | Discoverable. | n/a | n/a |
| Bible verse preference | `Profile.jsx:887-902`. | Discoverable; verse picker explains itself. | n/a | n/a |
| Body metrics save | `Profile.jsx:916-980`. | Discoverable from labels. | n/a | n/a |
| HIIT Timer | `Utilities.jsx:1220-1231`. | Modal explains itself. | n/a | n/a |
| Community / Progress utility rows | `Utilities.jsx:1155-1180`. | Discoverable from the row subtitle copy. | n/a | n/a |
| Export My Data / Delete Account | `Profile.jsx:1230-1257`. | Compliance feature — surface in policy copy, not tutorial. | n/a | n/a |
| Legal links (Terms, Privacy) | `Profile.jsx:1260-1264`. | Discoverable. | n/a | n/a |
| WorkoutSummary "View Workout" button | `WorkoutSession.jsx:4982-5006`. | Self-explanatory label. | n/a | n/a |
| Pre-begin Summary preview | `WorkoutSession.jsx:2541-2554` ("View Summary" before Begin). | Could note: "Preview the full workout before you start." | `data-tutorial="prebegin-summary"` | In-session (insert before step 1) |

## Recommended next tutorial work

If Will only has 30 minutes:

1. **Write a Calendar tutorial (4 steps)** — currently zero coverage and Calendar is the second-most-visited screen. Spotlight: view toggle, day cell tap, rest-day insertion, copy-week. Use the existing `phase: '2'` placeholder in `tutorialSteps.js`.
2. **Build the Phase 1B "Create My Own Workout" tutorial (3 steps)** — the intro screen already advertises this path; right now it just glows the "+ Create" button and leaves the user alone in CreateWorkout. Spotlight: name field, add-exercise search, save button.
3. **Insert two new in-session steps: Demo and Exit-Workout** — both are critical, both have markers easy to add (`data-tutorial="demo-button"`, `data-tutorial="exit-workout"`), both demonstrably reduce day-one drop-off ("am I going to lose my workout?").
4. **Refresh stale step 12 copy** (`session-settings`) — it predates Light/Dark Cards + in-session Full-Screen toggle. Two-minute edit, big polish win.
5. **Add a one-shot "PR Unlocked" caption to PBCelebration** — single highest-emotion moment of the app; a one-line caption ("REPLAB just tracked this as a personal record") will convert that surprise into retention.
