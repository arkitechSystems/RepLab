// Shared plate calculator math + plate denominations. Used by both
// /plate-calculator (the Utilities page) and PlateCalculatorModal (the
// in-session popup) so the two surfaces don't drift on plate sizes,
// colors, or greedy-fill behavior.
//
// Visual rendering (PlateBlock, LegPressIcon) lives in the consuming
// components — only the math + the data tables that drive the math live
// here so we can keep the shared surface as small as possible.

// Bar weight options shown in the bar selector. value is the actual
// weight; label is the user-visible string.
export const BAR_OPTIONS = [
  { value: 45, label: '45 lb (Olympic)' },
  { value: 35, label: '35 lb' },
  { value: 25, label: '25 lb' },
  { value: 15, label: '15 lb' },
  { value: 0,  label: 'No bar (DBs / fixed)' },
];

// Each plate has its weight, a color and a contrasting text color used
// in the chip swatches, a render height that matches the visual size of
// real plates (45 lb = tallest, 2.5 = shortest), and a label string
// shown on the chip and the plate block. Ordered heaviest → lightest
// for the greedy fill in computePlatesPerSide().
export const PLATES = [
  { lb: 45,  color: '#1f2937', text: '#fff', height: 92, label: '45' },
  { lb: 35,  color: '#fbbf24', text: '#000', height: 78, label: '35' },
  { lb: 25,  color: '#16a34a', text: '#fff', height: 70, label: '25' },
  { lb: 10,  color: '#ffffff', text: '#000', height: 58, label: '10' },
  { lb: 5,   color: '#3b82f6', text: '#fff', height: 48, label: '5' },
  { lb: 2.5, color: '#ef4444', text: '#fff', height: 40, label: '2.5' },
];

// Plate denominations available in the manual +/- chip. Common gym
// plates only — fractional 2.5s aren't included since users rarely
// "+5 lb" per side using fractionals.
export const QUICK_PLATES = [5, 10, 25, 35, 45];

// Greedy-fill plates per side for the given per-side weight. Walks
// PLATES heaviest → lightest, taking as many of each as fit before
// moving on to the next denomination. Returns:
//   { plates: [{ lb, color, text, height, label, count }, ...],
//     leftover: number }
// `leftover` is the unfilled remainder per side after using all
// standard denominations (e.g. 2.5 lb for 51 → 49 fillable + 2 leftover).
export function computePlatesPerSide(perSideWeight) {
  const out = [];
  let remaining = perSideWeight;
  for (const p of PLATES) {
    const count = Math.floor(remaining / p.lb);
    if (count > 0) {
      out.push({ ...p, count });
      remaining = +(remaining - count * p.lb).toFixed(3);
    }
  }
  return { plates: out, leftover: remaining };
}
