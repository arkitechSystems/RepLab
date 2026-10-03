// Audit the master exercise library's YouTube demo videos with Claude vision.
//
// For each master exercise (created_by IS NULL) this script:
//   1. Pulls the video's YouTube details (title, channel, description, length)
//      and 4 still images YouTube publishes for every video (the cover plus
//      auto frames from the start / middle / end) — all free.
//   2. Asks Claude (cheap model) whether the video actually shows THIS
//      exercise, strict about equipment and variation. Unsure / low-confidence
//      answers are re-checked once with a stronger model.
//   3. With --suggest, searches YouTube for replacements for every flagged row,
//      vision-checks the candidates the same way, and keeps the best 3 matches.
//   4. Writes a review spreadsheet: one row per exercise with the verdict,
//      reason, suggestions and an Action dropdown for Will to fill in. Also a
//      "Possible duplicates" sheet and a "Run info" sheet with costs.
//
// READ-ONLY on the database. Nothing is changed — the spreadsheet is the output.
// Paid calls are cached in server/scripts/.cache/video-audit.json, so re-runs
// (or a run that stopped on the YouTube daily quota) never pay twice.
//
// Run (from server/):
//   node --env-file=.env scripts/audit-exercise-videos.js --ids=552,563,208 --out=../video-audit.xlsx
//   node --env-file=.env scripts/audit-exercise-videos.js --all --only-auto --dry-cost
//   node --env-file=.env scripts/audit-exercise-videos.js --all --suggest --out=../video-audit.xlsx
//
// Flags:
//   --ids=1,2,3 | --limit=N | --all   which exercises (one is required)
//   --only-auto      only videos auto-linked by the script (video_linked_by='claude_code')
//   --suggest        search + vision-check replacements for flagged rows (costs YouTube quota)
//   --out=path.xlsx  spreadsheet path (default ../video-audit-<date>.xlsx)
//   --dry-cost       print the cost / quota estimate only; no Claude calls
//   --verbose
//
// Required env: YOUTUBE_API_KEY, ANTHROPIC_API_KEY, DATABASE_URL.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import ExcelJS from 'exceljs';
import pool from '../dbPool.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// ── CLI ───────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
function opt(name) {
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
}
const flag = (name) => argv.includes(`--${name}`);

const IDS = opt('ids') ? opt('ids').split(',').map((s) => Number(s.trim())).filter(Number.isInteger) : null;
const LIMIT = opt('limit') ? Number(opt('limit')) : null;
const ALL = flag('all');
const ONLY_AUTO = flag('only-auto');
const SUGGEST = flag('suggest');
const DRY_COST = flag('dry-cost');
const VERBOSE = flag('verbose');
const TODAY = new Date().toISOString().slice(0, 10);
const OUT = opt('out') || path.join(here, '..', '..', `video-audit-${TODAY}.xlsx`);

if (!IDS && !LIMIT && !ALL) {
  console.error('Pick exercises with --ids=1,2,3, --limit=N, or --all');
  process.exit(1);
}

const missing = ['YOUTUBE_API_KEY', 'DATABASE_URL', ...(DRY_COST ? [] : ['ANTHROPIC_API_KEY'])]
  .filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')} (run with --env-file=.env)`);
  process.exit(1);
}

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const anthropic = DRY_COST ? null : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Models + pricing ──────────────────────────────────────────────────────

// First pass on every video; re-checks only when the first pass is unsure.
const FIRST_MODEL = 'claude-haiku-4-5';
const RECHECK_MODEL = 'claude-opus-5';
const RECHECK_BELOW = 0.7; // confidence threshold for a re-check
// $ per million tokens (input, output) — Anthropic first-party API.
const PRICING = {
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-opus-5': { in: 5, out: 25 },
};
const PROMPT_VERSION = 'v2'; // bump to invalidate cached verdicts

// ── Cache (resumable runs) ────────────────────────────────────────────────

const CACHE_DIR = path.join(here, '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'video-audit.json');
fs.mkdirSync(CACHE_DIR, { recursive: true });
const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};
let cacheDirty = false;
function cacheGet(key) { return cache[key]; }
function cacheSet(key, value) { cache[key] = value; cacheDirty = true; }
function cacheFlush() {
  if (!cacheDirty) return;
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  cacheDirty = false;
}

// ── Usage / cost tracking ─────────────────────────────────────────────────

const usage = {}; // model -> { calls, input, output, cachedCalls }
function trackUsage(model, u, fromCache = false) {
  const m = (usage[model] ||= { calls: 0, input: 0, output: 0, cachedCalls: 0 });
  if (fromCache) { m.cachedCalls++; return; }
  m.calls++;
  m.input += u?.input_tokens || 0;
  m.output += u?.output_tokens || 0;
}
function costOf(model, input, output) {
  const p = PRICING[model];
  return p ? (input * p.in + output * p.out) / 1e6 : 0;
}
function totalCost() {
  return Object.entries(usage).reduce((s, [m, u]) => s + costOf(m, u.input, u.output), 0);
}

// ── YouTube ───────────────────────────────────────────────────────────────

let ytUnits = 0;
async function ytFetch(url, units, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.ok) { ytUnits += units; return res.json(); }
    const body = await res.text().catch(() => '');
    if (res.status === 403 && /quota/i.test(body)) {
      throw Object.assign(new Error('YouTube daily quota exhausted — re-run tomorrow; cached work is kept.'), { quota: true });
    }
    if (res.status === 429 && attempt < retries) {
      await new Promise((r) => setTimeout(r, [5, 15, 45][attempt] * 1000));
      continue;
    }
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 200)}`);
  }
}

function parseIsoDuration(iso) {
  const m = typeof iso === 'string' && iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

// videos.list — 1 quota unit per call of up to 50 ids. Cached per id.
async function fetchVideoDetails(ids) {
  const out = {};
  const need = [];
  for (const id of ids) {
    const hit = cacheGet(`yt:${id}`);
    if (hit) out[id] = hit; else need.push(id);
  }
  for (let i = 0; i < need.length; i += 50) {
    const batch = need.slice(i, i + 50);
    const params = new URLSearchParams({ part: 'snippet,contentDetails,status', id: batch.join(','), key: YOUTUBE_API_KEY });
    const data = await ytFetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, 1);
    const found = new Set();
    for (const it of data.items || []) {
      found.add(it.id);
      const d = {
        available: it.status?.privacyStatus !== 'private',
        title: it.snippet?.title || '',
        channelTitle: it.snippet?.channelTitle || '',
        description: (it.snippet?.description || '').slice(0, 600),
        durationSec: parseIsoDuration(it.contentDetails?.duration),
        embeddable: it.status?.embeddable !== false,
      };
      out[it.id] = d;
      cacheSet(`yt:${it.id}`, d);
    }
    for (const id of batch) {
      if (!found.has(id)) {
        out[id] = { available: false };
        cacheSet(`yt:${id}`, out[id]);
      }
    }
  }
  cacheFlush();
  return out;
}

// search.list — 100 quota units per call. Cached per query.
async function searchYouTube(query) {
  const key = `search:${query.toLowerCase()}`;
  const hit = cacheGet(key);
  if (hit) return hit;
  const params = new URLSearchParams({ part: 'snippet', type: 'video', q: query, maxResults: '8', key: YOUTUBE_API_KEY });
  const data = await ytFetch(`https://www.googleapis.com/youtube/v3/search?${params}`, 100);
  const ids = (data.items || []).map((it) => it.id?.videoId).filter(Boolean);
  cacheSet(key, ids);
  cacheFlush();
  return ids;
}

// The cover image plus YouTube's auto frames from the start, middle and end of
// the video (480×360), falling back to smaller sizes. YouTube answers a missing
// frame with HTTP 200 and a ~1 KB grey "…" placeholder, so tiny images are
// treated as missing — a placeholder misled the model in testing.
const PLACEHOLDER_MAX_BYTES = 2500;
async function fetchFrames(videoId) {
  const frames = [];
  for (const [label, names] of [
    ['cover image', ['hqdefault', 'mqdefault']],
    ['frame near the start', ['hq1', 'mq1', '1']],
    ['frame from the middle', ['hq2', 'mq2', '2']],
    ['frame near the end', ['hq3', 'mq3', '3']],
  ]) {
    for (const name of names) {
      const res = await fetch(`https://img.youtube.com/vi/${videoId}/${name}.jpg`).catch(() => null);
      if (!res?.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      // The small 120×90 frames are legitimately ~3 KB; only the 480×360 and
      // 320×180 sizes are checked against the placeholder size.
      if (name !== '1' && name !== '2' && name !== '3' && buf.length < PLACEHOLDER_MAX_BYTES) continue;
      if (buf.length < 1500) continue;
      frames.push({ label, data: buf.toString('base64') });
      break;
    }
  }
  return frames;
}

// ── Claude vision check ───────────────────────────────────────────────────

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['match', 'wrong_variation', 'wrong_exercise', 'unsure'] },
    confidence: { type: 'number' },
    reason: { type: 'string' },
    equipment_seen: { type: 'string' },
    name_issue: { type: 'string' },
    muscle_group_ok: { type: 'boolean' },
    suggested_muscle_group: { type: 'string' },
  },
  required: ['verdict', 'confidence', 'reason', 'equipment_seen', 'name_issue', 'muscle_group_ok', 'suggested_muscle_group'],
  additionalProperties: false,
};

let MUSCLE_GROUPS = [];

function buildPrompt(exercise, video) {
  return `You are auditing the exercise library of a strength-training app. Each exercise has one YouTube demo video. Decide whether this video demonstrates THIS exact exercise.

EXERCISE
- Name: ${exercise.name}
- Muscle group in the app: ${exercise.muscle_group}
- Tags: ${(exercise.tags || []).join(', ') || '(none)'}

VIDEO (from YouTube)
- Title: ${video.title}
- Channel: ${video.channelTitle}
- Length: ${video.durationSec}s
- Description: ${video.description || '(none)'}

The images below are the video's cover image and still frames from its start, middle and end.

How to judge:
- Be strict about equipment and variation. A barbell exercise needs a barbell; "banded" needs a resistance band; dumbbell vs barbell vs cable vs machine vs bodyweight vs kettlebell must match; single-arm vs both arms, single-leg vs both, incline vs flat vs decline, seated vs standing must match. If the name lists two pieces of equipment (e.g. "Banded Barbell"), both must be present.
- Use the frames as the main evidence and the title/description as supporting evidence. Cover images can be stylised; trust the frames more.
- Be lenient about channel, presenter, gym, camera angle, music or video style.
- "match": clearly this exercise and variation. "wrong_variation": same movement but different equipment or variation (e.g. a band-only glute bridge for "Banded Barbell Glute Bridge"). "wrong_exercise": a different movement. "unsure": the frames and text don't show enough to tell.
- confidence: 0 to 1, how sure you are of the verdict.
- reason: one short plain-English sentence a non-expert can read, naming what you saw (e.g. "Shows a resistance-band glute bridge; no barbell visible").
- equipment_seen: the equipment visible in the frames, comma-separated, or "none visible".
- name_issue: if the exercise NAME itself looks misspelled, unclear or non-standard, suggest a better name in a few words; otherwise "".
- muscle_group_ok: whether "${exercise.muscle_group}" is the right primary group from this list: ${MUSCLE_GROUPS.join(', ')}. If not, put the right one in suggested_muscle_group; otherwise "".`;
}

async function claudeCheck(model, exercise, video, frames) {
  const content = [];
  for (const f of frames) {
    content.push({ type: 'text', text: `Image: ${f.label}` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: f.data } });
  }
  content.push({ type: 'text', text: buildPrompt(exercise, video) });

  const isOpus = model === RECHECK_MODEL;
  const params = {
    model,
    max_tokens: isOpus ? 16000 : 1024,
    messages: [{ role: 'user', content }],
    output_config: { format: { type: 'json_schema', schema: VERDICT_SCHEMA } },
  };
  // Opus 5: adaptive thinking is on by default; server-side refusal fallback
  // so a rare policy decline still returns an answer.
  const resp = isOpus
    ? await anthropic.beta.messages.create({
      ...params,
      output_config: { ...params.output_config, effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })
    : await anthropic.messages.create(params);

  trackUsage(model, resp.usage);
  if (resp.stop_reason === 'refusal') {
    return { result: { verdict: 'unsure', confidence: 0, reason: 'Model declined to judge this video.', equipment_seen: '', name_issue: '', muscle_group_ok: true, suggested_muscle_group: '' }, usage: resp.usage };
  }
  const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    result = { verdict: 'unsure', confidence: 0, reason: 'Could not read the model response.', equipment_seen: '', name_issue: '', muscle_group_ok: true, suggested_muscle_group: '' };
  }
  result.confidence = Math.max(0, Math.min(1, Number(result.confidence) || 0));
  return { result, usage: resp.usage };
}

// One verdict per (exercise, video): cheap model first, re-check if unsure.
async function judge(exercise, videoId, video, { allowRecheck = true } = {}) {
  const key = `verdict:${PROMPT_VERSION}:${exercise.id}:${exercise.name}:${videoId}:${allowRecheck ? 'rc' : 'norc'}`;
  const hit = cacheGet(key);
  if (hit) {
    trackUsage(hit.model, null, true);
    return hit;
  }
  const frames = await fetchFrames(videoId);
  let { result } = await claudeCheck(FIRST_MODEL, exercise, video, frames);
  let model = FIRST_MODEL;
  // Re-check anything the first pass would flag (not just low confidence) so
  // Will only sees flags the stronger model agrees with — the cheap model
  // reports ~0.95 confidence almost always, so confidence alone isn't enough.
  if (allowRecheck && (result.verdict !== 'match' || result.confidence < RECHECK_BELOW)) {
    if (VERBOSE) console.log(`    ↻ re-checking with ${RECHECK_MODEL} (${result.verdict}, ${result.confidence})`);
    ({ result } = await claudeCheck(RECHECK_MODEL, exercise, video, frames));
    model = RECHECK_MODEL;
  }
  const entry = { ...result, model, frames: frames.length };
  cacheSet(key, entry);
  cacheFlush();
  return entry;
}

// ── Replacement suggestions ───────────────────────────────────────────────

async function suggestReplacements(exercise, currentVideoId) {
  const ids = (await searchYouTube(`${exercise.name} form`)).filter((id) => id !== currentVideoId);
  if (!ids.length) return [];
  const details = await fetchVideoDetails(ids);
  const candidates = ids
    .map((id) => ({ id, ...details[id] }))
    .filter((c) => c.available && c.embeddable !== false && c.durationSec > 0)
    // Prefer short demos (under 4 min); keep search relevance order otherwise.
    .sort((a, b) => (a.durationSec > 240) - (b.durationSec > 240))
    .slice(0, 6);
  const scored = [];
  for (const c of candidates) {
    const v = await judge(exercise, c.id, c, { allowRecheck: false });
    if (v.verdict === 'match') scored.push({ id: c.id, title: c.title, durationSec: c.durationSec, confidence: v.confidence });
  }
  return scored
    .sort((a, b) => b.confidence - a.confidence || a.durationSec - b.durationSec)
    .slice(0, 3);
}

// ── Possible duplicates ───────────────────────────────────────────────────

function normalizeName(n) {
  return n.toLowerCase()
    .replace(/\bdumbbells?\b/g, 'db').replace(/\bbarbells?\b/g, 'bb')
    .replace(/\bez[- ]?bar\b/g, 'ezbar').replace(/\bpush[- ]?ups?\b/g, 'pushup')
    .replace(/\bpull[- ]?ups?\b/g, 'pullup').replace(/\bchin[- ]?ups?\b/g, 'chinup')
    .replace(/\bbanded\b/g, 'band')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/).filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ');
}
function levenshtein(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}
// Same words except one long word that's 1–2 letters off ("Romanain" vs
// "Romanian"). Short words are left alone so "db" vs "bb" (Dumbbell vs
// Barbell) or "back" vs "hack" never count as typos.
// Word pairs that look like typos of each other but name different exercises.
const DISTINCT_WORDS = [
  ['abduction', 'adduction'], ['incline', 'decline'], ['pullup', 'pushup'],
  ['pronated', 'supinated'], ['flexion', 'extension'],
].map((p) => p.sort().join('|'));
function isTypoPair(a, b) {
  const wa = a.split(' ');
  const wb = b.split(' ');
  if (wa.length !== wb.length) return false;
  const diffs = wa.map((w, i) => [w, wb[i]]).filter(([x, y]) => x !== y);
  if (diffs.length !== 1) return false;
  const [x, y] = diffs[0];
  if (DISTINCT_WORDS.includes([x, y].sort().join('|'))) return false;
  return Math.min(x.length, y.length) >= 5 && levenshtein(x, y) <= 2;
}

function findDuplicates(rows) {
  const norm = rows.map((r) => ({ ...r, n: normalizeName(r.name), set: normalizeName(r.name).split(' ').sort().join(' ') }));
  const pairs = [];
  for (let i = 0; i < norm.length; i++) {
    for (let j = i + 1; j < norm.length; j++) {
      const a = norm[i]; const b = norm[j];
      let why = null;
      if (a.n === b.n) why = 'Same name after normalizing (spelling / plural / DB vs Dumbbell)';
      // Word order matters for directions ("High-to-Low" vs "Low-to-High").
      else if (a.set === b.set && !/\bto\b/.test(a.n)) why = 'Same words in a different order';
      else if (isTypoPair(a.n, b.n)) why = 'Nearly identical spelling (possible typo)';
      if (why) pairs.push({ a, b, why });
    }
  }
  return pairs;
}

// ── Spreadsheet ───────────────────────────────────────────────────────────

const VERDICT_LABEL = {
  match: '✅ Matches',
  wrong_variation: '⚠️ Wrong variation',
  wrong_exercise: '❌ Wrong exercise',
  unsure: '❓ Unsure',
  no_video: '— No video',
  unavailable: '❌ Video unavailable',
  self_hosted: '— Own video (not checked)',
};
const VERDICT_ORDER = ['wrong_exercise', 'unavailable', 'wrong_variation', 'unsure', 'no_video', 'match', 'self_hosted'];
const ACTIONS = ['Keep', 'Use suggestion 1', 'Use suggestion 2', 'Use suggestion 3', 'Paste new ID', 'Remove video', 'Rename', 'Change muscle group'];

async function writeWorkbook(results, duplicates, info) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RepLab video audit';

  const ws = wb.addWorksheet('Video Audit', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'ID', key: 'id', width: 7 },
    { header: 'Exercise', key: 'name', width: 30 },
    { header: 'Muscle group', key: 'muscle', width: 13 },
    { header: 'Current video', key: 'link', width: 30 },
    { header: 'YouTube title', key: 'title', width: 40 },
    { header: 'Verdict', key: 'verdict', width: 22 },
    { header: 'Confidence', key: 'confidence', width: 11 },
    { header: 'Reason', key: 'reason', width: 50 },
    { header: 'Equipment seen', key: 'equipment', width: 24 },
    { header: 'Name issue', key: 'nameIssue', width: 24 },
    { header: 'Muscle group OK?', key: 'muscleOk', width: 18 },
    { header: 'Suggestion 1', key: 's1', width: 40 },
    { header: 'Suggestion 2', key: 's2', width: 40 },
    { header: 'Suggestion 3', key: 's3', width: 40 },
    { header: 'Action', key: 'action', width: 20 },
    { header: 'New video ID / name / group', key: 'actionValue', width: 26 },
    { header: 'Checked by', key: 'model', width: 18 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
  ws.autoFilter = { from: 'A1', to: 'Q1' };

  const link = (id, text) => (id ? { text: text || `https://youtu.be/${id}`, hyperlink: `https://youtu.be/${id}` } : '');
  const sorted = [...results].sort((a, b) =>
    VERDICT_ORDER.indexOf(a.verdict) - VERDICT_ORDER.indexOf(b.verdict) || a.name.localeCompare(b.name));
  for (const r of sorted) {
    const s = r.suggestions || [];
    const row = ws.addRow({
      id: r.id,
      name: r.name,
      muscle: r.muscle_group,
      link: link(r.videoId),
      title: r.title || '',
      verdict: VERDICT_LABEL[r.verdict] || r.verdict,
      confidence: r.confidence != null ? Math.round(r.confidence * 100) / 100 : '',
      reason: r.reason || '',
      equipment: r.equipment_seen || '',
      nameIssue: r.name_issue || '',
      muscleOk: r.muscle_group_ok === false ? `No → ${r.suggested_muscle_group || '?'}` : (r.muscle_group_ok ? 'Yes' : ''),
      s1: s[0] ? link(s[0].id, `${s[0].title} (${s[0].id})`) : '',
      s2: s[1] ? link(s[1].id, `${s[1].title} (${s[1].id})`) : '',
      s3: s[2] ? link(s[2].id, `${s[2].title} (${s[2].id})`) : '',
      action: '',
      actionValue: '',
      model: r.model || '',
    });
    row.alignment = { vertical: 'top', wrapText: true };
    for (const key of ['link', 's1', 's2', 's3']) {
      const cell = row.getCell(key);
      if (cell.value && typeof cell.value === 'object') cell.font = { color: { argb: 'FF1155CC' }, underline: true };
    }
    row.getCell('action').dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${ACTIONS.join(',')}"`],
      showErrorMessage: true,
      errorTitle: 'Pick an action',
      error: 'Choose one of the actions from the list.',
    };
  }

  const dup = wb.addWorksheet('Possible duplicates', { views: [{ state: 'frozen', ySplit: 1 }] });
  dup.columns = [
    { header: 'ID A', key: 'ida', width: 7 },
    { header: 'Exercise A', key: 'a', width: 34 },
    { header: 'ID B', key: 'idb', width: 7 },
    { header: 'Exercise B', key: 'b', width: 34 },
    { header: 'Why', key: 'why', width: 46 },
    { header: 'Action', key: 'action', width: 24 },
  ];
  dup.getRow(1).font = { bold: true };
  for (const p of duplicates) {
    const row = dup.addRow({ ida: p.a.id, a: p.a.name, idb: p.b.id, b: p.b.name, why: p.why, action: '' });
    row.getCell('action').dataValidation = {
      type: 'list', allowBlank: true, formulae: ['"Not a duplicate,Consolidate A into B,Consolidate B into A"'],
    };
  }

  const infoWs = wb.addWorksheet('Run info');
  infoWs.columns = [{ header: 'Item', key: 'k', width: 34 }, { header: 'Value', key: 'v', width: 70 }];
  infoWs.getRow(1).font = { bold: true };
  for (const [k, v] of info) infoWs.addRow({ k, v });

  await wb.xlsx.writeFile(OUT);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const { rows: groups } = await pool.query(
    'SELECT DISTINCT muscle_group FROM exercises WHERE created_by IS NULL ORDER BY 1'
  );
  MUSCLE_GROUPS = groups.map((g) => g.muscle_group);

  const { rows: library } = await pool.query(
    `SELECT id, name, muscle_group, tags, video_id, video_linked_by, hidden_from_library
       FROM exercises WHERE created_by IS NULL ORDER BY name`
  );

  let selected = library;
  if (IDS) selected = library.filter((e) => IDS.includes(e.id));
  if (ONLY_AUTO) selected = selected.filter((e) => e.video_linked_by === 'claude_code');
  if (LIMIT) selected = selected.slice(0, LIMIT);
  if (IDS) {
    const missingIds = IDS.filter((id) => !library.some((e) => e.id === id));
    if (missingIds.length) console.log(`Not found in the master library: ${missingIds.join(', ')}`);
  }

  const isSelfHosted = (v) => v && (v.startsWith('http') || v.startsWith('/'));
  const withYouTube = selected.filter((e) => e.video_id && !isSelfHosted(e.video_id));

  // ── Estimate ──
  // Per-call figures from this script's own runs (4 images × ~230 tokens +
  // ~1,000 prompt tokens in, ~100 out). Re-checks assumed on ~25% of videos
  // (every flagged row); --suggest on the same ~25%, ~6 candidate checks each.
  const est = { in: 2000, out: 100, opusIn: 2200, opusOut: 150, recheckRate: 0.25, flagRate: 0.25, candidates: 6 };
  const n = withYouTube.length;
  const firstPass = costOf(FIRST_MODEL, n * est.in, n * est.out);
  const rechecks = costOf(RECHECK_MODEL, n * est.recheckRate * est.opusIn, n * est.recheckRate * est.opusOut);
  const flagged = Math.ceil(n * est.flagRate);
  const suggestCost = costOf(FIRST_MODEL, flagged * est.candidates * est.in, flagged * est.candidates * est.out);
  const quotaAudit = Math.ceil(n / 50);
  const quotaSuggest = flagged * (100 + 1);
  console.log(`\n${selected.length} exercises selected (${n} with a YouTube video).`);
  console.log(`Estimate: first pass ~$${firstPass.toFixed(2)}, re-checks ~$${rechecks.toFixed(2)}${SUGGEST ? `, suggestions ~$${suggestCost.toFixed(2)}` : ''}.`);
  console.log(`YouTube quota: ~${quotaAudit} units for the audit${SUGGEST ? ` + ~${quotaSuggest} units for suggestions (${flagged} searches × 100)` : ''} of 10,000/day.`);
  if (DRY_COST) {
    await pool.end();
    return;
  }

  // ── Audit ──
  const details = await fetchVideoDetails(withYouTube.map((e) => e.video_id));
  const results = [];
  let i = 0;
  for (const e of selected) {
    i++;
    const base = { id: e.id, name: e.name, muscle_group: e.muscle_group, videoId: e.video_id };
    if (!e.video_id) { results.push({ ...base, verdict: 'no_video', reason: 'No video linked yet.' }); continue; }
    if (isSelfHosted(e.video_id)) { results.push({ ...base, videoId: null, verdict: 'self_hosted', reason: `Self-hosted video: ${e.video_id}` }); continue; }
    const v = details[e.video_id];
    if (!v?.available) {
      results.push({ ...base, verdict: 'unavailable', reason: 'YouTube says this video is deleted or private.' });
    } else {
      try {
        const j = await judge(e, e.video_id, v);
        results.push({ ...base, title: v.title, ...j });
        console.log(`[${i}/${selected.length}] ${e.name}: ${VERDICT_LABEL[j.verdict]} (${j.confidence}) — ${j.reason}`);
      } catch (err) {
        if (err instanceof Anthropic.RateLimitError) { console.error('Claude rate limit — stopping; re-run to resume.'); break; }
        if (err instanceof Anthropic.APIError) {
          console.error(`  ${e.name}: Claude API error ${err.status} — ${err.message}`);
          results.push({ ...base, title: v.title, verdict: 'unsure', reason: `Check failed (API ${err.status}); re-run to retry.` });
          continue;
        }
        throw err;
      }
    }
  }

  // ── Suggestions ──
  if (SUGGEST) {
    for (const r of results) {
      if (['match', 'self_hosted'].includes(r.verdict)) continue;
      const e = selected.find((x) => x.id === r.id);
      try {
        r.suggestions = await suggestReplacements(e, r.videoId);
        console.log(`  suggestions for ${r.name}: ${r.suggestions.map((s) => s.id).join(', ') || 'none found'}`);
      } catch (err) {
        if (err.quota) { console.error(err.message); break; }
        throw err;
      }
    }
  }

  // ── Duplicates + workbook ──
  const duplicates = findDuplicates(library);
  const counts = results.reduce((m, r) => ((m[r.verdict] = (m[r.verdict] || 0) + 1), m), {});
  const info = [
    ['Run date', new Date().toISOString()],
    ['Exercises checked', String(results.length)],
    ['Verdicts', Object.entries(counts).map(([k, v]) => `${VERDICT_LABEL[k] || k}: ${v}`).join(' · ')],
    ['First-pass model', FIRST_MODEL],
    ['Re-check model', `${RECHECK_MODEL} (every flagged row, and any match below ${RECHECK_BELOW} confidence)`],
    ...Object.entries(usage).map(([m, u]) => [
      `Usage — ${m}`,
      `${u.calls} paid calls (${u.cachedCalls} from cache), ${u.input} input / ${u.output} output tokens, $${costOf(m, u.input, u.output).toFixed(4)}`,
    ]),
    ['Total cost this run', `$${totalCost().toFixed(4)}`],
    ['YouTube quota used this run', `${ytUnits} units`],
    ['How to use', 'Pick an Action for each flagged row (and fill the column next to it for "Paste new ID", "Rename" or "Change muscle group"). Send the file back and the changes are applied with a backup and a dry run first.'],
  ];
  await writeWorkbook(results, duplicates, info);
  console.log(`\nWrote ${OUT}`);
  console.log(`Cost this run: $${totalCost().toFixed(4)} · YouTube quota: ${ytUnits} units`);
  for (const [m, u] of Object.entries(usage)) {
    console.log(`  ${m}: ${u.calls} calls, ${u.input} in / ${u.output} out tokens (${u.cachedCalls} cached)`);
  }
  await pool.end();
}

main().catch(async (err) => {
  cacheFlush();
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
