// RepLab Community sharing toggles (Profile → App Preferences → RepLab
// Community). Keys match GET/PUT /community/settings; `all` is the master.
// `noun` is used in the turn-off prompt ("New PRs won't be shared…").
export const COMMUNITY_SHARE_CATEGORIES = [
  { key: 'pr', label: 'PRs', noun: 'PRs', helper: 'New personal records you hit during workouts.' },
  { key: 'program', label: 'Programs started', noun: 'program starts', helper: 'Featured or library programs, when you tap Begin Program and pick a start date.' },
  { key: 'programComplete', label: 'Programs completed', noun: 'program completions', helper: 'When you finish a featured or library program you started.' },
  { key: 'streak', label: 'Workout streaks', noun: 'workout streaks', helper: 'Every 5 days in a row you complete a workout (5, 10, 15…).' },
];

const SHARE_KEYS = COMMUNITY_SHARE_CATEGORIES.map((c) => c.key);

// Optimistic copy of what the server does with one toggle change: the master
// switches every category with it; turning a category on while the master is
// off turns the master back on. Turning every category off leaves the master on.
export function applyCommunityToggle(settings, category, enabled) {
  if (category === 'all') {
    const next = { ...settings, all: enabled };
    for (const key of SHARE_KEYS) next[key] = enabled;
    return next;
  }
  return { ...settings, [category]: enabled, ...(enabled ? { all: true } : {}) };
}
