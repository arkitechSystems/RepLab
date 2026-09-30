// Shared by the Exercise Library list and the Exercise Detail prev/next
// arrows so both agree on order and on each exercise's detail URL.
import { getDetailSlugs, slugify } from '../data/exercises/index.js';

const DETAIL_PAGES = getDetailSlugs();

// Alphabetical, case-insensitive, with names starting with a digit
// ("1-Arm Lat Pull-In") after all lettered names instead of first.
const startsWithDigit = (n) => /^\d/.test(n.trim());
export function compareExerciseNames(a, b) {
  return (startsWithDigit(a) - startsWithDigit(b))
    || a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

// Hand-authored exercises have their own slug in DETAIL_PAGES; everything
// else uses slugify(name).
export function exerciseDetailUrl(name) {
  return DETAIL_PAGES[name] || `/exercises/${slugify(name)}`;
}
