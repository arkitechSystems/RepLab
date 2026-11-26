// Offline FAQ matcher for the Help chat. No network, no AI: it scores each
// FAQ entry in client/src/data/helpFaq.js against the typed question.
//
// How it works:
//   1. The question is split into words, filler words ("how", "do", "I",
//      "the"...) are dropped, words are trimmed to a simple stem ("workouts"
//      -> "workout") and mapped to one spelling ("routine" -> "workout").
//   2. Words the FAQ never uses are typo-corrected against the FAQ's own
//      vocabulary with Fuse.js ("calender" -> "calendar"), double-checked by
//      edit distance so a correction is never a wild guess.
//   3. Each entry is scored on how much of the question its question /
//      alternate phrasings / keywords cover (rarer words count more), plus a
//      little for how much of the phrasing the question covers.
//
// searchHelp(query) returns
//   { status: 'answer',  match, confidence, suggestions }  — confident match
//   { status: 'suggest', match: null, suggestions: [up to 3] } — weak match
//   { status: 'none',    match: null, suggestions: [] }      — nothing fits

import Fuse from 'fuse.js';
import { HELP_FAQ } from '../data/helpFaq.js';

// Words that carry no meaning for matching.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'for', 'with',
  'by', 'from', 'into', 'onto', 'about', 'as', 'it', 'its', 'this', 'that',
  'these', 'those', 'there', 'here', 'i', 'im', 'me', 'my', 'mine', 'we',
  'our', 'you', 'your', 'yours', 'u', 'ur', 'is', 'am', 'are', 'was', 'were',
  'be', 'been', 'being', 'do', 'does', 'did', 'doing', 'done', 'can', 'could',
  'would', 'should', 'will', 'shall', 'may', 'might', 'must', 'have', 'has',
  'had', 'how', 'what', 'whats', 'where', 'when', 'which', 'who', 'why',
  'please', 'pls', 'plz', 'help', 'want', 'wanna', 'need', 'trying', 'try',
  'tried', 'way', 'get', 'got', 'some', 'any', 'just', 'so', 'up', 'out',
  'if', 'then', 'than', 'too', 'also', 'very', 'really', 'thing', 'things',
  'app', 'replab', 'possible', 'able', 'there', 'one', 'still', 'again',
  'tell', 'know', 'let', 'lets', 'go', 'going', 'use', 'using', 'thanks',
  'thank', 'hi', 'hello', 'hey', 'ok', 'okay', 'to', 'not', 'dont', 'cant',
  'isnt', 'doesnt', 'wont', 'didnt', 'all', 'each', 'every', 'long', 'much',
]);

// One spelling per idea (applied after stemming).
const SYNONYMS = {
  creat: 'create', routine: 'workout', exercis: 'exercise', lift: 'exercise', movement: 'exercise',
  plan: 'program', split: 'program', block: 'program',
  begin: 'start', launch: 'start', kick: 'start',
  make: 'create', new: 'create', build: 'create', setup: 'create', design: 'create',
  remove: 'delete', erase: 'delete', trash: 'delete', discard: 'delete',
  edit: 'change', modify: 'change', update: 'change', adjust: 'change', alter: 'change',
  rename: 'name',
  pb: 'pr', prs: 'pr', pbs: 'pr', record: 'pr', best: 'pr',
  track: 'log', enter: 'log',
  calender: 'calendar', calandar: 'calendar', schedul: 'schedule',
  date: 'day', today: 'today', tomorrow: 'day',
  pw: 'password', passcode: 'password', pwd: 'password',
  login: 'sign', signin: 'sign', logon: 'sign',
  signup: 'account', register: 'account', registr: 'account',
  logout: 'signout', signout: 'signout',
  mode: 'theme', color: 'theme', colour: 'theme', appearance: 'theme',
  dark: 'dark', light: 'light',
  notif: 'notification', alert: 'notification', reminder: 'notification', push: 'notification',
  plates: 'plate', barbell: 'bar',
  chart: 'progress', graph: 'progress', stat: 'progress', statistic: 'progress',
  past: 'history', previous: 'history', old: 'history', finished: 'history',
  rest: 'rest', break: 'rest', pause: 'rest',
  video: 'video', demo: 'video', clip: 'video',
  share: 'share', send: 'share', friend: 'share',
  feed: 'community', social: 'community',
  wifi: 'offline', internet: 'offline', connection: 'offline', signal: 'offline',
  email: 'email', mail: 'email', contact: 'support', bug: 'support', crash: 'support',
  feedback: 'support',
  missed: 'miss', acount: 'account', accout: 'account',
  weight: 'weight', wt: 'weight', lbs: 'weight', kg: 'weight', pound: 'weight',
  rep: 'rep', reps: 'rep', repetition: 'rep',
  set: 'set', sets: 'set',
  goal: 'goal', target: 'goal',
  superset: 'superset', circuit: 'superset', pair: 'superset',
  dropset: 'drop', warmup: 'warm', warm: 'warm',
  copy: 'duplicate', clone: 'duplicate',
  add: 'add', insert: 'add', put: 'add', assign: 'add',
};

// Very small stemmer — just enough that plurals / -ing / -ed forms match.
export function stem(word) {
  let w = word;
  if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed') && !w.endsWith('eed')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) w = w.slice(0, -1);
  return w;
}

function canon(word) {
  // Look up the raw word first ("calender"), then its stem ("schedul").
  if (SYNONYMS[word]) return SYNONYMS[word];
  const s = stem(word);
  return SYNONYMS[s] || s;
}

// Split text into canonical tokens. Joins a few common two-word phrases first
// so "sign in" / "log in" / "warm up" / "drop set" stay together.
export function tokenize(text) {
  const cleaned = String(text || '')
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/\bsign[\s-]+in\b/g, ' signin ')
    .replace(/\blog[\s-]+in\b/g, ' signin ')
    .replace(/\bsign[\s-]+up\b/g, ' signup ')
    .replace(/\blog[\s-]+out\b/g, ' signout ')
    .replace(/\bsign[\s-]+out\b/g, ' signout ')
    .replace(/\bwarm[\s-]+ups?\b/g, ' warmup ')
    .replace(/\bdrop[\s-]+sets?\b/g, ' dropset ')
    .replace(/\bsuper[\s-]+sets?\b/g, ' superset ')
    .replace(/\bset[\s-]+up\b/g, ' setup ')
    .replace(/\bpersonal (best|record)s?\b/g, ' pr ')
    .replace(/[^a-z0-9]+/g, ' ');
  const out = [];
  for (const raw of cleaned.split(' ')) {
    if (!raw || STOPWORDS.has(raw)) continue;
    const t = canon(raw);
    if (t && !STOPWORDS.has(t)) out.push(t);
  }
  return out;
}

// Damerau-Levenshtein (optimal string alignment) distance, for vetting
// Fuse's typo corrections.
export function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

const ANSWER_THRESHOLD = 0.55; // best score needed to answer outright
const SUGGEST_THRESHOLD = 0.25; // below this nothing is offered
const CLEAR_LEAD = 0.06; // how far ahead the best must be when it's not a near-perfect match

export function createHelpSearch(entries = HELP_FAQ) {
  // Pre-tokenize every entry.
  const docs = entries.map((entry) => {
    const phrasings = [entry.question, ...(entry.alternates || [])]
      .map((p) => tokenize(p))
      .filter((t) => t.length > 0);
    const keywords = new Set((entry.keywords || []).flatMap((k) => tokenize(k)));
    const bag = new Set([...phrasings.flat(), ...keywords]);
    return { entry, phrasings, keywords, bag };
  });

  // Inverse document frequency: words used by fewer entries count more.
  const df = new Map();
  for (const doc of docs) for (const t of doc.bag) df.set(t, (df.get(t) || 0) + 1);
  const N = docs.length;
  const idf = (t) => {
    const n = df.get(t);
    if (!n) return Math.log(1 + N / 2); // unknown word: mid weight
    return Math.log(1 + N / n);
  };

  const vocab = [...df.keys()];
  const fuse = new Fuse(vocab, { includeScore: true, threshold: 0.4, ignoreLocation: true });

  // Map a query token onto the FAQ vocabulary: exact, then prefix, then typo.
  // Returns [{ token, weight }] (empty when nothing close exists).
  const correctionCache = new Map();
  function resolve(token) {
    if (df.has(token)) return { token, weight: 1 };
    if (correctionCache.has(token)) return correctionCache.get(token);
    let result = null;
    if (token.length >= 4) {
      const prefixHit = vocab.find((v) => v.length > token.length && v.startsWith(token));
      if (prefixHit) result = { token: prefixHit, weight: 0.9 };
    }
    if (!result && token.length >= 4) {
      const maxDist = token.length >= 8 ? 2 : 1;
      const hits = fuse.search(token, { limit: 8 });
      let best = null;
      for (const h of hits) {
        const dist = editDistance(token, h.item);
        if (dist > maxDist) continue;
        // Prefer the closest word; on a tie, one with the same first letter.
        const sameStart = h.item[0] === token[0];
        if (!best || dist < best.dist || (dist === best.dist && sameStart && !best.sameStart)) {
          best = { token: h.item, dist, sameStart };
        }
      }
      if (best) result = { token: best.token, weight: best.dist === 1 ? 0.85 : 0.7 };
    }
    correctionCache.set(token, result);
    return result;
  }

  function scoreAll(query) {
    const raw = tokenize(query);
    const seen = new Set();
    const qTokens = [];
    for (const t of raw) {
      const r = resolve(t);
      const key = r ? r.token : t;
      if (seen.has(key)) continue;
      seen.add(key);
      qTokens.push({ token: key, weight: r ? r.weight : 0, known: !!r });
    }
    if (!qTokens.some((q) => q.known)) return { qTokens, scored: [] };

    const qTotal = qTokens.reduce((s, q) => s + idf(q.token), 0);

    const scored = docs.map((doc) => {
      // Best single phrasing: question coverage (70%) + phrasing coverage (30%).
      let best = 0;
      for (const p of doc.phrasings) {
        const pSet = new Set(p);
        let qHit = 0;
        for (const q of qTokens) if (pSet.has(q.token)) qHit += idf(q.token) * q.weight;
        const pTotal = [...pSet].reduce((s, t) => s + idf(t), 0);
        const qSet = new Set(qTokens.filter((q) => q.known).map((q) => q.token));
        let pHit = 0;
        for (const t of pSet) if (qSet.has(t)) pHit += idf(t);
        const s = 0.7 * (qHit / qTotal) + 0.3 * (pTotal ? pHit / pTotal : 0);
        if (s > best) best = s;
      }
      // Whole entry (all phrasings + keywords): question coverage only.
      let bagHit = 0;
      for (const q of qTokens) if (doc.bag.has(q.token)) bagHit += idf(q.token) * q.weight;
      const bagScore = bagHit / qTotal;
      const score = 0.75 * best + 0.25 * bagScore;
      return { entry: doc.entry, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return { qTokens, scored };
  }

  function search(query) {
    const { scored } = scoreAll(query);
    if (!scored.length || scored[0].score < SUGGEST_THRESHOLD) {
      return { status: 'none', match: null, confidence: scored[0]?.score || 0, suggestions: [] };
    }
    const [top, second] = scored;
    const lead = top.score - (second ? second.score : 0);
    // A near-perfect match only needs to be ahead at all; a so-so one must be clearly ahead.
    const confident = top.score >= ANSWER_THRESHOLD && lead >= (top.score >= 0.85 ? 0.01 : CLEAR_LEAD);
    const suggestions = scored
      .filter((s) => s.score >= SUGGEST_THRESHOLD)
      .slice(0, 3)
      .map((s) => s.entry);
    if (confident) {
      return {
        status: 'answer',
        match: top.entry,
        confidence: top.score,
        suggestions: suggestions.filter((e) => e.id !== top.entry.id),
      };
    }
    return { status: 'suggest', match: null, confidence: top.score, suggestions };
  }

  return { search, scoreAll };
}

let defaultSearch = null;
export function searchHelp(query) {
  if (!defaultSearch) defaultSearch = createHelpSearch(HELP_FAQ);
  return defaultSearch.search(query);
}

export function getFaqById(id) {
  return HELP_FAQ.find((e) => e.id === id) || null;
}
