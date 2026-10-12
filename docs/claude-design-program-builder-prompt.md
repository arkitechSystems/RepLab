# Claude Design prompt — Trainer Central Program Builder

Paste everything below the line into Claude Design.

---

Design the **Program Builder** for RepLab, a strength-training app (web + iOS/Android via
Capacitor; design mobile-first at 390px wide, then a desktop layout at 1280px). It lives in
**Trainer Central**, where trainers build workouts and multi-week programs and assign them to
clients or themselves. Regular users get the same builder for their own programs.

## Brand and visual style
- Dark theme by default: page and cards near-black (#111111 / #1A1A1A / #222222), white text,
  grey secondary text (#888888).
- Accent red #EF4444 (pressed #DC2626); green #22C55E for success / "done"; amber #EAB308 for
  warnings. Workout-type colour chips may use blue #3B82F6, purple #A855F7, orange #F97316,
  cyan #06B6D4, pink #EC4899.
- Type: Space Grotesk (headings, UI), DM Mono / JetBrains Mono (small uppercase labels, numbers,
  set tables, letter-spaced 0.12–0.16em), Inter for dense UI text.
- Feel: bold, athletic, uncluttered; big tap targets (44px+); one-handed use on a phone.

## The flow to design (screens + states)

### 1. Start: name, split, cycle, length
- Program name, description, program type (Hypertrophy, Strength, Hybrid, Conditioning, Shred,
  Hypertrophy & Strength, Glute-Focused, Other).
- **Split** picker with presets as visual cards plus Custom: Full Body, Upper / Lower,
  Push / Pull / Legs, Bro Split (one muscle group a day), Custom. Picking a preset pre-fills
  the first cycle with named workout days and rest days (e.g. Full Body → Mon Full Body A,
  Tue Rest, Wed Full Body B, Thu Rest, Fri Full Body C, Sat Rest, Sun Rest), which the user can
  change.
- **Cycle** (the repeating block): "Repeats every 1 week" by default; also 2 weeks (e.g. A/B
  weeks), or a custom number of days (e.g. a 4-day or 10-day rotation that ignores weekdays).
- **Length**: number of weeks (1–52), with an optional start date.

### 2. The program calendar (the heart of the builder)
- A calendar/grid of the whole program: weeks as rows, 7 days as columns on desktop; on phone,
  a week-at-a-time strip with swipe between weeks plus a compact full-program overview.
- Users **type directly into a day** to name it ("Push A", "Legs", "Upper Power") or mark it
  **Rest**. Typing a name that already exists links that day to the same workout (autocomplete
  from workouts already in the program); a new name creates a new empty workout.
- **Cycle fill**: the user fills the first cycle only; every later week is generated
  automatically and shown as "repeat" days (visually lighter / linked icon). Editing a repeat
  day asks: change only this day, or this day in every cycle.
- Each day cell shows: workout name, colour chip for the workout, number of exercises, a status
  dot (empty / in progress / complete), and for repeat weeks the progression applied (e.g.
  "+5%").
- Drag a workout to another day; long-press / right-click menu: rename, make rest day,
  duplicate, clear, "apply to every cycle".
- **Click / tap a day to open its workout editor** (screen 3). Empty days open straight into
  "Add first exercise".

### 3. Workout editor (opens from a calendar day)
Must look like RepLab's in-workout exercise cards so trainers build exactly what clients see:
- Workout name + notes at the top; optional **section titles** between cards ("Warm-Up",
  "Finisher") with section notes.
- One **exercise card** per exercise, stacked vertically: dark header bar with the exercise name
  (search the RepLab exercise library — show muscle group and a "demo video" badge — or add a
  custom exercise with a muscle group), superset letter (A, B… — cards sharing a letter are
  visually grouped as A1, A2), coach notes.
- Under the header, **one row per set**: Set # · Type · Goal Wt (lbs) · Goal Reps · Rep Range.
  Set types (badge abbreviations): Regular (REG), Warm Up (WU), Touch Up (TU), Drop Set (DS),
  Rest Pause (RP), Super Set (SS), Alternating Set (Alt), Pre-Exhaust (PrEx). Add set / remove
  set controls; reorder exercises (up/down or drag). These are GOALS — no "actual" columns here.
- Navigation back to the calendar and to the previous/next training day without closing.
- Banner when editing a day that repeats: "Editing Week 1 · changes apply to all 8 weeks"
  with a toggle "only this week".

### 4. Auto-Progression (global progression rules)
A panel (from the calendar toolbar) that makes later weeks progressively harder without editing
each day; the result is a starting point the trainer reviews and adjusts.
- Rule builder: **what** (weight, reps, or sets), **how much** (% or fixed amount, e.g. +2.5% or
  +5 lb or +1 rep), **how often** (every week, every cycle, or every session of that workout),
  **scope** (whole program, one workout, one exercise, or one muscle group), optional **cap**
  (max reps → then reset reps and add weight, i.e. double progression) and optional **deload**
  (e.g. every 4th week at 60–70%).
- Live preview table: exercise × week showing the resulting goal weights/reps, with changed
  cells highlighted; per-cell manual override that's marked as "edited by trainer" and is kept
  when rules change.
- **Rounding** (show the setting and explain it in the UI): goal weights round to loadable
  increments for the equipment, defaulting from the exercise:
  barbell / Smith machine / trap bar → 5 lb (2.5 lb plate per side); dumbbell → 5 lb
  (2.5 lb under 25 lb); machine / cable stack → 5 lb; kettlebell → nearest common bell;
  bodyweight → no weight (progress reps instead). Trainer can override per exercise
  (1 / 2.5 / 5 / 10 lb). Rounding is applied to the **running total from the starting weight**,
  not week to week, so small percentages still add up: 100 lb at +2%/week → 100, 100 (102.0→100),
  105 (104.0→105), 105 (106.1→105), 110 (108.2→110)… never stalling forever. Never round a
  progression below the previous week unless a deload is set.

### 5. Review & assign
- Summary: weeks, cycle, workouts, total sessions, progression rules, warnings (empty days,
  unnamed workouts, custom exercises without a muscle group, supersets with only one exercise).
- Actions: Save program, Assign to client(s) / myself with a start date, Export to spreadsheet,
  **Import from spreadsheet** (RepLab's Excel / Google Sheets template — the builder and the
  template hold the same fields and stay in sync).

## Deliverables
- Mobile (390px) and desktop (1280px) for screens 1–5, including empty, filled, error and
  "repeat week" states, the type-into-a-day interaction, the day → workout editor transition,
  and the Auto-Progression preview with rounding visible.
- A small component sheet: day cell (all states), exercise card, set row with type badges,
  progression rule row, rounding control.
