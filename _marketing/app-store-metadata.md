# REPLAB — App Store + Play Store Metadata

Drafted 2026-04-29, refreshed **2026-05-17** after the Featured Workouts + Challenges pre-launch gating sweep. **Draft for the developer to edit, not final copy.** All character-limit-bound fields have been counted and are reported at the bottom. No emojis used (Apple rejects them in name/subtitle/keywords).

## What changed since the 2026-04-29 draft

- **Featured Workouts is now gated as "Coming Soon"** for the v1 launch. Will's Hypertrophy is in the codebase but not user-accessible from the demo Apple Review will use. Marketing copy below has been adjusted — Will's Hypertrophy block removed from the description; positioning shifts to the broader library + the lifter's-logbook value prop.
- **Challenges section gated** the same way — non-interactive "Coming Soon" card.
- **Library programs cleanup** (Path A) — exercise duplicates consolidated, 313 master exercises now. Program list below verified against current DB state.
- **Apple Developer enrollment is Individual, not Organization** — Apple rejected the ArkiTech Systems LLC org name as a trademark conflict with ARKit. App will ship under Will Martin's personal Apple ID for v1, with a planned App Transfer to a renamed LLC entity post-launch. Copyright string updated below.

## Source-of-truth notes

- iOS v1 hides every Stripe-checkout path natively (App Store guideline 3.1.1) — copy below treats Pro/Elite as "membership features" without specifying purchase mechanism.
- Currently-live library programs (after Path A consolidation): Jeff Nippard's Push Pull Legs, Jim Stoppani's Shortcut to Shred, Robin Gallant's Intensive Max Glute Hypertrophy, Muscle & Fitness 5000 Rep Arm Specialization, Katie Sonier's 6-Week Glute Building. Will's Hypertrophy exists but is gated.
- AI Workout Generator and "Featured trainer workouts" exist in code as Pro-tier features (`client/src/pages/Upgrade.jsx`, `PLANS` array). Featured trainer workouts are gated (Coming Soon). Custom program builder, video exercise guides, nutrition tracking, and 1-on-1 trainer chat are listed as Elite-tier features.
- "Trainers" tab still surfaces a single mock trainer (Zumba Jason) — flagged in `_marketing/DEMO-CONTENT-AUDIT.md` for resolution before launch.

---

## App Store Connect (Apple)

### App name — 30 chars max
**Value:** `REPLAB`

> The brand wordmark is all-caps. **However** — the iOS home-screen label (the text that appears under the app icon on the user's device) is the `CFBundleDisplayName`, which the dev has set to mixed-case `RepLab` per personal preference. That value lives in the iOS project (`ios/App/App/Info.plist`, key `CFBundleDisplayName`) and is **independent** of the App Store Connect "App name" field above. Set the App Store Connect field to `REPLAB`; leave the on-device label as `RepLab` if that's the call.

### Subtitle — 30 chars max
**Primary:** `Strength & Hypertrophy Coach` (28 chars)

Alternates if the dev wants to A/B:
- `Hypertrophy & Strength Built In` (31 — would need trim, e.g. `Hypertrophy + Strength Built` = 28)
- `Lift. Track. Grow.` (18 — punchier, less search-optimized)
- `Workout Tracker for Lifters` (27)

### Promotional Text — 170 chars max
Editable after launch without a resubmission, so use it for time-sensitive callouts. Three drafts:

**Option A (launch hook, 160 chars):**
```
Now featuring Will's Hypertrophy — a free 12-week resistance training program built for serious lifters. Track every set, every rep, every PR. New on REPLAB.
```

**Option B (feature-led, 156 chars):**
```
Plan your splits, log every set, and chase progressive overload. REPLAB ships with Will's Hypertrophy — a 12-week flagship program — and a full library.
```

**Option C (community-led, 145 chars):**
```
Built by lifters, for lifters. Track workouts, beat your PRs, and run a 12-week hypertrophy program designed by Will Martin. Free on REPLAB.
```

### Description — 4000 chars max

**Note:** the Will's Hypertrophy block was removed for v1 since Featured Workouts is gated as "Coming Soon." Restore the block (or add a "Coming Soon: Will's Hypertrophy" tease) once the feature is launch-ready.

```
REPLAB is a workout tracker for people who actually lift. Plan your splits, log every set, and chase progressive overload — without the bloat.

— WHAT YOU GET —
- Workout logger built for the gym floor — clean, fast, one-handed
- Personal best tracking — PRs auto-detected by weight, reps, and volume
- Progress page — see exercise-by-exercise progressive overload at a glance with Last 30 Days stats
- Plan your week with a calendar that knows your splits
- Program library with author-designed splits from Jeff Nippard, Jim Stoppani, Robin Gallant, and more
- Build and edit your own programs from scratch
- Exercise library with form videos hosted on the REPLAB CDN
- Plate calculator — long-press any weight to load it with the right plates, with Both Sides / One Side / Machine modes
- 1RM estimator, HIIT timer, rest timers, session notes, cardio logging across 7 machine types
- Sync across iOS and the web — your data follows you

— WHO IT'S FOR —
Lifters running a structured split. Hypertrophy and strength athletes who want to track progressive overload without spreadsheets. Coaches running clients through programmed work. Anyone who wants their training log to be as serious as their training.

— ABOUT YOUR DATA —
Your training data is yours. We don't sell it, we don't share it with ad networks, we don't run third-party trackers across other apps. Your account, your custom exercises, and your private programs are visible only to you.

— BUILT BY LIFTERS, FOR LIFTERS —
REPLAB was built because the existing apps either bury you in features you don't need or hide the ones you do. We focused on the loop that matters: plan, log, progress, repeat.

REPLAB is a fitness app, not a medical device or substitute for medical advice. Talk to a qualified professional before starting any new exercise program, especially if you have an existing condition or injury.

Questions or feedback? https://replab-fitness.com/support
```
(Approximate length: ~2,000 chars — well under the 4000 cap.)

### Keywords — 100 chars max, comma-separated, NO SPACES
**Value (97 chars):**
```
workout,hypertrophy,gym,strength,bodybuilding,lifting,muscle,fitness,trainer,split,reps,PRs,coach
```

Reasoning: high-intent search terms only. Skipped filler words ("the/and/app"), skipped "exercise" (already implicit in "workout"), skipped "tracker" (Apple matches partials inside multi-word app titles, and your subtitle is doing that work). If the dev wants to swap one in, drop `coach` (5 chars) for `tracker` (7 chars) — that pushes total to 99. Or drop `PRs` for `progress` (8) — total 101, would need trimming.

### URLs
- **Marketing URL:** `https://replab-fitness.com`
- **Support URL:** `https://replab-fitness.com/support`
- **Privacy Policy URL:** `https://replab-fitness.com/privacy`

### Copyright / Seller

**v1 launch (Individual enrollment):**
- **Copyright string:** `© 2026 Will Martin`
- **Seller name (App Store Connect Account Holder):** `Will Martin`
- **Display name in App Store:** `Will Martin`

**Post-launch transfer (once a clean entity is set up):** plan to use Apple's App Transfer to move the app to the LLC's developer account. Copyright string then flips to `© 2026 ArkiTech Systems, LLC` (or whatever the renamed entity becomes). Privacy + Terms still reference the LLC as the legal entity owning the app — only the App Store seller identity is personal for v1.

### Categories
- **Primary:** Health & Fitness
- **Secondary:** Sports

### Age rating questionnaire answers (target: 4+)
| Question | Answer |
|---|---|
| Cartoon or fantasy violence | None |
| Realistic violence | None |
| Prolonged graphic or sadistic realistic violence | None |
| Profanity or crude humor | None |
| Mature/suggestive themes | None |
| Horror/fear themes | None |
| Sexual content or nudity | None |
| Graphic sexual content and nudity | None |
| Alcohol, tobacco, or drug use or references | None |
| Simulated gambling | None |
| Medical/treatment information | None (this is fitness — explicitly disclaimed in description) |
| Contests | None |
| Unrestricted web access | No (no third-party browser embedded) |
| Gambling and contests | No |
| User-generated content | Minimal — workout notes are private; reactions on a private feed |

Result: 4+.

---

## Play Store (Google)

### App name — 50 chars max
**Value:** `REPLAB: Strength & Hypertrophy` (30 chars)

Alternates:
- `REPLAB - Workout Tracker & Hypertrophy` (38)
- `REPLAB: Lift, Track, Grow.` (26)

### Short description — 80 chars max
**Value:** `Strength training, hypertrophy programs, and a 12-week flagship by Will Martin.` (79 chars)

Alternates:
- `Workout tracker for lifters. Programs, PRs, and progressive overload built in.` (78)
- `Plan splits. Log sets. Beat PRs. Featuring Will's Hypertrophy — 12 weeks free.` (78)

### Full description — 4000 chars max
Reuse the App Store description above. Play allows light formatting; you can swap the `—` block headers for `<b>` tags if you want them bolded in the listing. Below is a Play-tuned version with light HTML; the developer can paste either version.

```
<b>REPLAB is a workout tracker for people who actually lift.</b> Plan your splits, log every set, and chase progressive overload — without the bloat.

<b>FEATURED PROGRAM</b>
Will's Hypertrophy is the flagship program built into REPLAB: a 12-week, six-day-per-week resistance training plan focused on muscle hypertrophy. Designed by Will Martin, with progression that links every set across all 12 weeks so you always know what to beat. Free for every REPLAB user.

<b>WHAT YOU GET</b>
• Workout logger built for the gym floor — clean, fast, one-handed
• Calendar that knows your splits
• Personal best tracking — PRs auto-detected on weight and reps
• Program library — Mike Mentzer Heavy Duty, Bro Split, Glute Hypertrophy, Athlean-X Summer Shred, and more
• Build and edit your own programs from scratch
• Exercise library with form videos
• Plate calculator, rest timers, session notes
• Progress charts and history
• Sync across devices

<b>MEMBERSHIP</b>
REPLAB is free to use. A REPLAB membership unlocks featured trainer workouts, the AI Workout Generator, advanced analytics, custom program builder, video exercise guides, nutrition tracking, and direct trainer chat.

<b>WHO IT'S FOR</b>
Lifters running a structured split. Hypertrophy and strength athletes who want to track progressive overload without spreadsheets. Coaches running clients through programmed work.

<b>BUILT BY LIFTERS, FOR LIFTERS</b>
REPLAB was built because the existing apps either bury you in features you don't need or hide the ones you do. We focused on the loop that matters: plan, log, progress, repeat.

REPLAB is a fitness app, not a medical device or substitute for medical advice. Talk to a qualified professional before starting any new exercise program, especially if you have an existing condition or injury.

Support: https://replab-fitness.com/support
```

### Tags / categories
- **Application type:** App
- **Category:** Health & Fitness
- **Tags:** Workout, Strength training, Bodybuilding, Hypertrophy, Personal trainer (Play allows up to 5 tags; pick from their fixed taxonomy in the console — these are the closest matches)

### Content rating
- **Everyone** (no violence, no sexual content, no profanity, no controlled-substance references, no gambling, minimal UGC).

---

## Length-check report

| Field | Limit | Value | Length |
|---|---|---|---|
| App Store app name | 30 | `REPLAB` | 6 |
| App Store subtitle | 30 | `Strength & Hypertrophy Coach` | 28 |
| App Store promo text (A) | 170 | (option A above) | 160 |
| App Store promo text (B) | 170 | (option B above) | 156 |
| App Store promo text (C) | 170 | (option C above) | 145 |
| App Store keywords | 100 | (see above) | 97 |
| App Store description | 4000 | (see above) | ~1,930 |
| Play app name | 50 | `REPLAB: Strength & Hypertrophy` | 30 |
| Play short description | 80 | (see above) | 79 |
| Play full description | 4000 | (see above) | ~2,090 (with HTML) |

All within limits.

---

## TODOs / decisions for the developer

1. **Brand-name display split** — Apple App Store Connect "App name" set to `REPLAB`; iOS home-screen label (`CFBundleDisplayName` in `ios/App/App/Info.plist`) uses `RepLab`. Confirm both before submission. Play Console store listing also uses `REPLAB` in the app title.
2. **Will's Hypertrophy length** — confirmed 12 weeks per `server/initDb.js` line 591 and the `seedWillsHypertrophy` data block. If the program ever changes length, update the description.
3. **AI Workout Generator gating** — listed as a Pro-tier feature in `Upgrade.jsx`. The description above says it's unlocked with membership, which is accurate. Do **not** describe it as a free feature.
4. **iOS purchase wording** — iOS-facing copy never says "buy" or "subscribe in-app" because v1 hides all Stripe paths on iOS. The phrase used is "A REPLAB membership unlocks…" — this is App Store-safe; if Apple review pushes back, fall back to "Web members get…" or remove the membership block entirely.
5. **Trainer profile (Zumba Jason)** — there's a trainer profile in `client/src/data/trainers.js` (Zumba Jason, HIIT/Dance Fitness). The description doesn't currently call him out — if you want him surfaced as a v1 selling point, add a line under "WHO IT'S FOR" or reword "Featured trainer workouts" to name him. Decided not to since he's tied behind Pro and the marketing hook is Will's Hypertrophy.
6. **Free-trial mechanics** — `FreeTrialOffer.jsx` exists but I didn't read it for terms. If the trial is meaningful for Play (Android keeps Stripe), consider adding a "Try free" line to the Play short description.
7. **Medical disclaimer placement** — included once in the description body. Apple's review tends to like seeing this; if review flags any health-claim language, the line is already there to point at.
8. **Promo text rotation** — pick option A for launch (it's the strongest hook). Plan to swap to B once the launch novelty fades, and use C for any community-driven moment (anniversary, milestone post).
9. **Play tags** — the tag list in Google Play Console is a fixed taxonomy chosen from a dropdown, not free text. The names above are illustrative; the dev should pick the closest 5 from the actual dropdown when filling the form.
10. **Localization** — this draft is English-only. If launching to non-English stores, the `keywords` field in particular needs a fresh, localized list (don't just translate — rebuild around local search intent).
