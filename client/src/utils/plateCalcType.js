// Default plate-calculator setup for an exercise, used when the in-session
// PlateCalculatorModal opens on a card for the first time (the user's own
// last setup on that card still wins). The /plate-calculator Utilities page
// does NOT use this — it always opens on Both Sides.
//
// Returns { type, bar }:
//   'both'    — barbell, plates on both sides (bar = barbell weight)
//   'machine' — plate-loaded machine, plates on both sides, no bar
//   'one'     — single loading point, no bar (landmine, T-bar, dip/pull-up
//               belt, sled, reverse hyper)
//
// Rules run on the lowercased name, first match wins. Exercises that don't
// take plates at all (dumbbell, cable, band, bodyweight) fall through to the
// barbell default — same as before this existed.

const FREE_LOAD = [
  /landmine/,
  /meadows row/,
  /\bt[- ]?bar\b/,
  // Bodyweight lifts only take plates via a dip/pull-up belt.
  /\b(pull|chin)-?ups?\b/,
  /\bdips?\b/,
  /\bsled\b/,
  /reverse hyper/,
];

// No plates involved — skip the machine / EZ rules (e.g. "Dumbbell Isolateral
// Skull Crusher", "Cable Hip Abduction", "EZ-Bar Cable Curl"). Assisted
// machines use a counterweight stack, so they're checked before Free Load too.
const ASSISTED = /\bassisted\b/;
const NON_PLATE = /\b(dumbbell|db|kettlebell|cable|swiss ball|rowing machine)\b/;

const MACHINE = [
  /\bmachine\b/,
  /hammer strength/,
  /plate[- ]loaded/,
  /iso-?lateral/,
  /leg press/,
  /hack squat/,
  /pendulum squat/,
  /belt squat/,
  /(seated|standing) calf raise/,
  /chest-supported row/,
  /\bpec deck\b/,
  /\bleg (extension|curl)s?\b/,
  /\b(seated|lying|prone) (leg|hamstring) curl/,
];

// Smith machine is a guided barbell: plates go on both sides of a bar.
const SMITH = /\bsmith\b/;
const EZ_BAR = /\bez[- ]?bar\b/;

export function plateCalcDefaults(exerciseName) {
  const n = String(exerciseName || '').toLowerCase();
  const DEFAULT = { type: 'both', bar: 45 };
  if (SMITH.test(n)) return DEFAULT;
  if (ASSISTED.test(n)) return DEFAULT;
  if (FREE_LOAD.some((re) => re.test(n))) return { type: 'one', bar: 0 };
  if (NON_PLATE.test(n)) return DEFAULT;
  if (MACHINE.some((re) => re.test(n))) return { type: 'machine', bar: 0 };
  // EZ curl bars are ~25 lb, not a 45 lb Olympic bar.
  if (EZ_BAR.test(n)) return { type: 'both', bar: 25 };
  return DEFAULT;
}
