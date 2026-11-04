// Exercise search shared by every exercise search box — the app (client/),
// the server (GET /exercises, Trainer Central, admin workout manager) and the
// server-rendered /workouts dashboard pages (served as a browser script by
// server/routes/workoutDashboard.js).
//
// - Gym abbreviations: "db row" finds "Dumbbell Row", "rdl" finds "Romanian
//   Deadlift", and a name written with an abbreviation ("BB Squats",
//   "Hammer Curl (DB)") is found by the long form too.
// - Word by word: every typed word must match (as typed, or one of its
//   expansions); punctuation/hyphens are ignored ("pull ups" = "Pull-Ups").
// - Ranking: name starts with the query > whole-word matches > partial
//   matches; ties keep the order of the list passed in.
// - Spelling fallback: when fewer than `minResults` (3) exercises match, the
//   closest spellings (Fuse.js) fill the gap and come back separately as
//   `suggestions` so screens can label them "Closest matches".
//
// No imports on purpose: Fuse.js is handed in by each side
// (createExerciseSearch(Fuse)), so this file runs unchanged in Vite, Node and
// a plain <script> tag. Keep it that way — the dashboard serves this file's
// text with the `export` keywords stripped.

// Abbreviation → what it stands for (all lowercase, punctuation-free, the way
// normalizeExerciseText leaves names). A typed word matches when it OR any
// expansion appears in the name. Check new entries against real exercise
// names (server/seedExercises.js, client/src/utils/exerciseLibrary.js).
export const EXERCISE_ABBREVIATIONS = {
  bb: ['barbell'],
  db: ['dumbbell'],
  dbs: ['dumbbell'],
  kb: ['kettlebell'],
  kbs: ['kettlebell swing'],
  ez: ['ez bar'],
  ezbar: ['ez bar'],
  sm: ['smith machine'],
  bw: ['bodyweight', 'body weight'],
  ohp: ['overhead press'],
  oh: ['overhead'],
  rdl: ['romanian deadlift'],
  sldl: ['stiff leg deadlift', 'stiff legged deadlift'],
  dl: ['deadlift'],
  sl: ['single leg'],
  sa: ['single arm'],
  ghr: ['glute ham raise'],
  cgbp: ['close grip bench press'],
  cg: ['close grip'],
  wg: ['wide grip'],
  bp: ['bench press'],
  ssb: ['safety squat bar'],
  bss: ['bulgarian split squat'],
  hspu: ['handstand push up'],
  ht: ['hip thrust'],
  lp: ['leg press'],
  lpd: ['lat pulldown'],
  tbar: ['t bar'],
  pullup: ['pull up'],
  pullups: ['pull up'],
  pushup: ['push up'],
  pushups: ['push up'],
  chinup: ['chin up'],
  chinups: ['chin up'],
  situp: ['sit up'],
  situps: ['sit up'],
  skullcrusher: ['skull crusher'],
  skullcrushers: ['skull crusher'],
  facepull: ['face pull'],
  facepulls: ['face pull'],
};

// Fuse.js settings for the spelling fallback. threshold 0.45 = fairly
// forgiving (a couple of wrong/swapped letters in a short word);
// ignoreLocation so a typo late in a long name still counts. (If that finds
// too few, searchExercises tops up with threshold 1 = next-closest names.)
export const FUSE_OPTIONS = {
  keys: ['norm', 'expanded'],
  threshold: 0.45,
  ignoreLocation: true,
  includeScore: true,
  minMatchCharLength: 2,
};

// Lowercase, drop apostrophes, turn every other non-letter/digit (hyphens,
// parentheses, &, /) into a space, collapse spaces.
export function normalizeExerciseText(text) {
  return String(text == null ? '' : text)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function words(norm) {
  return norm ? norm.split(' ') : [];
}

// A typed word plus what it could stand for: its abbreviation expansions and,
// for a plural like "curls" or "ups", the singular.
function wordVariants(word) {
  const out = [word];
  const exp = EXERCISE_ABBREVIATIONS[word];
  if (exp) out.push(...exp);
  if (!exp && word.length >= 3 && word.endsWith('s')) {
    const single = word.slice(0, -1);
    out.push(single);
    const exp2 = EXERCISE_ABBREVIATIONS[single];
    if (exp2) out.push(...exp2);
  }
  return out;
}

// The phrase with every abbreviation swapped for its first expansion.
function expandPhrase(norm) {
  return words(norm)
    .map((w) => (EXERCISE_ABBREVIATIONS[w] ? EXERCISE_ABBREVIATIONS[w][0] : w))
    .join(' ');
}

function prepare(name) {
  const norm = normalizeExerciseText(name);
  const expanded = expandPhrase(norm);
  return { norm, expanded, text: expanded === norm ? norm : norm + ' ' + expanded };
}

// 0 = name starts with the query, 1 = every word is a whole word in the name,
// 2 = every word appears somewhere in the name, -1 = no match.
function rankName(rec, query) {
  const padded = ' ' + rec.text + ' ';
  let allWhole = true;
  for (const variants of query.variants) {
    let found = false;
    let whole = false;
    for (const v of variants) {
      if (padded.includes(' ' + v + ' ')) { found = true; whole = true; break; }
      if (!found && rec.text.includes(v)) found = true;
    }
    if (!found) return -1;
    if (!whole) allWhole = false;
  }
  for (const p of query.phrases) {
    if (rec.norm.startsWith(p) || rec.expanded.startsWith(p)) return 0;
  }
  return allWhole ? 1 : 2;
}

function prepareQuery(rawQuery) {
  const norm = normalizeExerciseText(rawQuery);
  const ws = words(norm);
  const expanded = expandPhrase(norm);
  return {
    norm,
    expanded,
    variants: ws.map(wordVariants),
    phrases: expanded === norm ? [norm] : [norm, expanded],
  };
}

// True when `name` matches `query` (abbreviations, word by word; no spelling
// fallback). An empty query matches everything.
export function matchesExerciseQuery(name, query) {
  const q = prepareQuery(query);
  if (!q.norm) return true;
  return rankName(prepare(name), q) >= 0;
}

const defaultGetName = (item) => (typeof item === 'string' ? item : item && item.name);

// Build the search for one Fuse.js class (each side imports its own copy).
export function createExerciseSearch(Fuse) {
  // searchExercises(list, query, options) → { matches, suggestions }
  //   list         exercises (objects with .name, or plain name strings)
  //   options.getName     how to read a name (default: item.name / the string)
  //   options.minResults  fill with closest spellings up to this many (3; 0 = off)
  //   options.uniqueNames drop later items whose name repeats (case-insensitive)
  // `matches` are the real hits, best first. `suggestions` are the spelling
  // fallback (never repeats a match) — show them after the matches with a
  // small "Closest matches" label. An empty query returns the whole list as
  // `matches` and no suggestions.
  function searchExercises(list, query, options = {}) {
    const getName = options.getName || defaultGetName;
    const minResults = options.minResults == null ? 3 : options.minResults;
    let items = Array.isArray(list) ? list : [];
    if (options.uniqueNames) {
      const seen = new Set();
      items = items.filter((item) => {
        const key = String(getName(item) || '').toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    const q = prepareQuery(query);
    if (!q.norm) return { matches: items.slice(), suggestions: [] };

    const ranked = [];
    const rest = [];
    items.forEach((item, index) => {
      const rec = prepare(getName(item));
      const rank = rankName(rec, q);
      if (rank >= 0) ranked.push({ item, rank, index });
      else rest.push({ item, norm: rec.norm, expanded: rec.expanded });
    });
    ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
    const matches = ranked.map((r) => r.item);

    const needed = minResults - matches.length;
    if (needed <= 0 || rest.length === 0 || !Fuse) return { matches, suggestions: [] };

    // Score the raw query and its abbreviation-expanded form; keep each
    // exercise's best score. First pass: real near-misses (FUSE_OPTIONS
    // threshold). If that still leaves fewer than `minResults`, a second pass
    // with no cut-off tops up with the next-closest names, so there are
    // always enough rows to pick from.
    const fuzzyRank = (threshold) => {
      const fuse = new Fuse(rest, { ...FUSE_OPTIONS, threshold });
      const best = new Map();
      for (const pattern of q.phrases) {
        for (const r of fuse.search(pattern)) {
          const prev = best.get(r.refIndex);
          if (prev == null || r.score < prev) best.set(r.refIndex, r.score);
        }
      }
      return [...best.entries()].sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(([i]) => i);
    };
    let picked = fuzzyRank(FUSE_OPTIONS.threshold).slice(0, needed);
    if (picked.length < needed && picked.length < rest.length) {
      const have = new Set(picked);
      picked = picked.concat(fuzzyRank(1).filter((i) => !have.has(i)).slice(0, needed - picked.length));
    }
    const suggestions = picked.map((i) => rest[i].item);
    return { matches, suggestions };
  }

  // Matches followed by suggestions in one array (handy for simple lists).
  function searchExerciseList(list, query, options) {
    const { matches, suggestions } = searchExercises(list, query, options);
    return matches.concat(suggestions);
  }

  return { searchExercises, searchExerciseList, matchesExerciseQuery, normalizeExerciseText };
}
