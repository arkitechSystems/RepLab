# REPLAB — App Store + Play Store Metadata

Refreshed **2026-05-19** for submission day. All character-limit-bound
fields counted and reported at the bottom. No emojis (Apple rejects
them in name/subtitle/keywords). Brand wordmark is **REPLAB** (all
caps) per the brand rule.

## What's live in v1 (source of truth for marketing copy)

- 322 exercises in the master library (post-cleanup).
- Pre-built library programs accessible to every user:
  Jeff Nippard's Push Pull Legs, Jim Stoppani's Shortcut to Shred,
  Robin Gallant's Intensive Max Glute Hypertrophy, Muscle & Fitness
  5000 Rep Arm Specialization, Katie Sonier's 6-Week Glute Building,
  Athlean-X Summer Shred, Bro Split, Mike Mentzer Heavy Duty, and
  glute programs.
- Custom-program builder, calendar/schedule, full session logging,
  PR auto-detection, progress charts, plate calculator (long-press a
  weight or tap the **PC** button mid-session), full-screen workout
  mode (viewfinder icon on each exercise card), 1RM estimator, HIIT
  timer, rest timers, cardio logging across 7 machine types.
- Personalized push notifications (workout reminders at the user's
  usual workout time, PR celebrations, weekly summary).
- Welcome email + tutorial that auto-launches after the 1RM step in
  the signup flow.
- iOS Free-only on launch. Stripe + AI Workout Generator are present
  in the codebase but hidden from iOS native users per Apple 3.1.1.
- **NOT marketed in v1 copy** (gated behind feature flags or hidden
  on iOS): Featured Workouts (incl. Will's Hypertrophy), Challenges,
  Trainers, AI Workout Generator. Do not surface these in App Store
  copy until the gating is lifted.

## Apple Developer enrollment

Individual enrollment under **Will Martin** (the LLC org-enrollment
hit a trademark conflict with ARKit; switching to Individual to ship
v1 on time). Plan: post-launch App Transfer to a renamed LLC entity.

- Copyright string: `© 2026 Will Martin`
- Seller / Account Holder: `Will Martin`

---

## App Store Connect (Apple)

### App name — 30 chars max
**Value:** `REPLAB` (6 chars)

> The on-device home-screen label (`CFBundleDisplayName` in
> `ios/App/App/Info.plist`) uses mixed-case `RepLab` by personal
> preference. That field is independent of this one. Set the App
> Store Connect **App name** to `REPLAB`.

### Subtitle — 30 chars max
**Value:** `Strength & Hypertrophy Coach` (28 chars)

### Promotional Text — 170 chars max
Editable after launch without resubmission. Use for time-sensitive
callouts.

**Recommended (157 chars):**
```
Plan your splits, log every set, and chase progressive overload. REPLAB ships with a full library of pro-designed programs and a plate calculator built in.
```

### Description — 4000 chars max
(AI generator and Featured Workouts intentionally omitted — see
"What's live in v1" above.)

```
REPLAB is a workout tracker for people who actually lift. Plan your splits, log every set, and chase progressive overload — without the bloat.

— WHAT YOU GET —
- Workout logger built for the gym floor — clean, fast, one-handed
- Full-screen workout mode — focus on one exercise at a time, swipe between them
- Personal best tracking — PRs auto-detected by weight, reps, and volume
- Progress page — see exercise-by-exercise progressive overload with Last 30 Days stats
- Weekly calendar that knows your splits
- Program library with pre-built splits from Jeff Nippard, Jim Stoppani, Robin Gallant, Katie Sonier, Muscle & Fitness, Athlean-X, and more
- Build and edit your own programs from scratch
- 322 exercises with form videos hosted on the REPLAB CDN
- Plate calculator — long-press any weight to load it with the right plates, with Both Sides / One Side / Machine modes
- 1RM estimator, HIIT timer, rest timers, session notes, cardio logging across 7 machine types
- Personalized reminders at your usual workout time, PR celebrations, and a weekly summary
- Sync across iOS and the web — your data follows you

— WHO IT'S FOR —
Lifters running a structured split. Hypertrophy and strength athletes who want to track progressive overload without spreadsheets. Coaches running clients through programmed work. Anyone who wants their training log to be as serious as their training.

— ABOUT YOUR DATA —
Your training data is yours. We don't sell it, we don't share it with ad networks, we don't run third-party trackers across other apps. Your account, your custom exercises, and your private programs are visible only to you. Delete your account from Profile -> Delete Account at any time; the wipe is immediate.

— BUILT BY LIFTERS, FOR LIFTERS —
REPLAB was built because the existing apps either bury you in features you don't need or hide the ones you do. We focused on the loop that matters: plan, log, progress, repeat.

REPLAB is a fitness app, not a medical device or substitute for medical advice. Talk to a qualified professional before starting any new exercise program, especially if you have an existing condition or injury.

Questions or feedback? https://replab-fitness.com/support
```
(Approximate length: ~2,060 chars — well under the 4000 cap.)

### "What's New in Version" — 4000 chars max (v1.0 first release)

```
Welcome to REPLAB.

This is v1.0 — the first public release. Plan your splits, log every set, and chase progressive overload with a logger built for the gym floor.

- Full-screen workout mode for focused training
- 322-exercise library with form videos
- Pre-built programs from Jeff Nippard, Jim Stoppani, Athlean-X, and more
- Plate calculator, 1RM estimator, HIIT and rest timers
- PR auto-detection and progress tracking
- Personalized workout reminders

Thanks for being an early lifter. Got feedback? hit us at support@replab-fitness.com.
```

### Keywords — 100 chars max, comma-separated, NO SPACES
**Value (97 chars):**
```
workout,hypertrophy,gym,strength,bodybuilding,lifting,muscle,fitness,trainer,split,reps,PRs,coach
```

Reasoning: high-intent search terms only. Skipped filler words and
skipped "tracker" (matched implicitly via subtitle). Apple matches
partials across name + subtitle so `tracker`, `training`, and
`exercise` are recoverable without using keyword budget on them.

### URLs

- **Marketing URL:** `https://replab-fitness.com`
- **Support URL:** `https://replab-fitness.com/support`
- **Privacy Policy URL:** `https://replab-fitness.com/privacy`

### Copyright / Seller

- **Copyright string:** `© 2026 Will Martin`
- **Seller name (App Store Connect Account Holder):** `Will Martin`
- **Display name in App Store:** `Will Martin`

Post-launch transfer plan: move the app to a renamed LLC entity via
Apple's App Transfer. Copyright string will flip to
`© 2026 [LLC Entity Name]` then. Privacy + Terms continue to
reference the LLC as the legal entity; only the App Store seller
identity is personal for v1.

### Categories

- **Primary:** Health & Fitness
- **Secondary:** Sports

> Open question: Will may prefer **Lifestyle** as the secondary if he
> wants reach outside the athletics audience. Recommendation stays
> **Sports** because the app's core loop is structured training, not
> general wellness — that aligns with how App Store browsers filter.

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
| Medical/treatment information | None (fitness app — explicitly disclaimed in description) |
| Contests | None |
| Unrestricted web access | No (no third-party browser embedded) |
| Gambling and contests | No |
| User-generated content | Minimal — workout notes are private |

Result: 4+.

---

## Play Store (Google)

(Retained from earlier draft. Play allows the Pro-tier surface to
remain visible since Android keeps Stripe billing, so the Play copy
can mention membership features.)

### App name — 50 chars max
**Value:** `REPLAB: Strength & Hypertrophy` (30 chars)

### Short description — 80 chars max
**Value:** `Workout tracker for lifters. Programs, PRs, and progressive overload.` (69 chars)

### Full description — 4000 chars max
Reuse the App Store description above. Play allows light HTML; swap
the `—` block headers for `<b>` tags if you want them bolded.

### Tags / categories
- **Application type:** App
- **Category:** Health & Fitness
- **Tags:** Workout, Strength training, Bodybuilding, Hypertrophy,
  Personal trainer (pick the closest 5 from Play's fixed taxonomy
  dropdown when filling the form).

### Content rating
- **Everyone** (no violence, no sexual content, no profanity, no
  controlled-substance references, no gambling, minimal UGC).

---

## Length-check report

| Field | Limit | Value | Length |
|---|---|---|---|
| App Store app name | 30 | `REPLAB` | 6 |
| App Store subtitle | 30 | `Strength & Hypertrophy Coach` | 28 |
| App Store promo text | 170 | (see above) | 157 |
| App Store keywords | 100 | (see above) | 97 |
| App Store description | 4000 | (see above) | ~2,060 |
| App Store "What's New" | 4000 | (see above) | ~480 |
| Play app name | 50 | `REPLAB: Strength & Hypertrophy` | 30 |
| Play short description | 80 | (see above) | 69 |
| Play full description | 4000 | (see above) | ~2,060 |

All within limits.

---

## TODOs / decisions for the developer

1. **Secondary category** — recommendation is **Sports**. Confirm
   you don't want **Lifestyle** instead.
2. **Phone number for App Review contact** — surface or remove the
   placeholder line in `app-review-notes.md`.
3. **Promo text rotation** — the version above is the launch hook.
   Plan to refresh after launch novelty fades (promo text is editable
   without resubmission).
4. **Localization** — English-only for v1. Non-English stores need
   freshly localized keywords (rebuild around local search intent,
   don't translate).
5. **App Transfer plan** — once the LLC entity is renamed and Apple
   accepts a new D-U-N-S-backed enrollment, run App Transfer and
   update the copyright string + seller name.
6. **Post-launch copy refresh** — when the Featured Workouts,
   Challenges, Trainers, or AI Generator gates are lifted, re-add
   them to the description (don't forget the AI generator's Pro-only
   framing).
