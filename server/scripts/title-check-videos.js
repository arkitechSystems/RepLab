// Video audit, step 1: a free title check of every master exercise's demo
// video. For each YouTube-linked master exercise it fetches the video's
// title / channel / status (videos.list, 1 quota unit per 50 videos — no AI,
// no cost) and compares the title with the exercise name:
//   • Likely wrong — video deleted/private, or the title shares none of the
//                    exercise's main words.
//   • Check        — equipment or variation in the name that the title
//                    contradicts or leaves out (barbell vs dumbbell, incline
//                    vs flat, single-arm, banded, ...), or extras in the title
//                    that the name doesn't have.
//   • Match        — nothing suspicious in the title.
// Writes a review spreadsheet with an Action column. READ-ONLY on the DB.
//
// Run (from server/):
//   node --env-file=.env scripts/title-check-videos.js
//   node --env-file=.env scripts/title-check-videos.js --out=../video-title-check.xlsx
//
// Required env: YOUTUBE_API_KEY, DATABASE_URL.

import ExcelJS from 'exceljs';
import pool from '../dbPool.js';

const outArg = process.argv.find((a) => a.startsWith('--out='));
const today = new Date().toISOString().slice(0, 10);
const OUT = outArg ? outArg.slice(6) : `../video-title-check-${today}.xlsx`;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
if (!YOUTUBE_API_KEY) { console.error('YOUTUBE_API_KEY is missing from .env'); process.exit(1); }

// ── Text normalisation ────────────────────────────────────────────────────

const ALIASES = [
  [/\bdb\b/g, 'dumbbell'], [/\bdumbell\b/g, 'dumbbell'], [/\bbb\b/g, 'barbell'], [/\bkb\b/g, 'kettlebell'],
  [/\bez[- ]?bar\b/g, 'ezbar'], [/\btrap[- ]?bar\b/g, 'trapbar'], [/\bhex[- ]?bar\b/g, 'trapbar'],
  [/\bsmith machine\b/g, 'smith'], [/\bresistance bands?\b/g, 'band'], [/\bmini[- ]?bands?\b/g, 'band'], [/\bbanded\b/g, 'band'],
  [/\bone[- ]arm\b/g, 'singlearm'], [/\bsingle[- ]arm\b/g, 'singlearm'], [/\bunilateral\b/g, 'singlearm'],
  [/\bone[- ]leg\b/g, 'singleleg'], [/\bsingle[- ]leg\b/g, 'singleleg'],
  [/\bclose[- ]grip\b/g, 'closegrip'], [/\bwide[- ]grip\b/g, 'widegrip'], [/\bb[- ]stance\b/g, 'bstance'],
  [/\brdls?\b/g, 'romanian'], [/\bpull[- ]ups?\b/g, 'pullup'], [/\bchin[- ]ups?\b/g, 'chinup'], [/\bpush[- ]ups?\b/g, 'pushup'],
  [/\bsit[- ]ups?\b/g, 'situp'], [/\bstep[- ]ups?\b/g, 'stepup'], [/\bpulley\b/g, 'cable'],
];

function norm(text) {
  let t = ` ${String(text || '').toLowerCase().replace(/[’']/g, '')} `;
  for (const [re, to] of ALIASES) t = t.replace(re, to);
  return t.replace(/[^a-z0-9]+/g, ' ').trim();
}
const stem = (w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const tokens = (text) => new Set(norm(text).split(' ').filter(Boolean).map(stem));

const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'smith', 'band', 'kettlebell', 'ezbar', 'trapbar', 'landmine', 'sled', 'trx'];
const VARIATIONS = ['incline', 'decline', 'flat', 'seated', 'standing', 'lying', 'kneeling', 'singlearm', 'singleleg', 'reverse',
  'closegrip', 'widegrip', 'neutral', 'hammer', 'sumo', 'romanian', 'bulgarian', 'front', 'overhead', 'bstance', 'deficit',
  'pause', 'hanging', 'decline', 'lateral', 'rear', 'pronated', 'supinated', 'goblet', 'split'];
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'with', 'to', 'on', 'of', 'for', 'in', 'how', 'do', 'form', 'proper',
  'correct', 'tutorial', 'exercise', 'technique', 'guide', 'way', 'best', 'perfect', 'shorts', 'short', 'video', 'demo',
  'mistake', 'tip', 'workout', 'beginner', 'grip', 'up', 'down', 'x', 'v']);
const TAG_WORDS = new Set([...EQUIPMENT, ...VARIATIONS]);

function compare(name, title) {
  const n = tokens(name);
  const t = tokens(title);
  const tSquashed = norm(title).replace(/ /g, '');
  const reasons = [];

  // Equipment
  const nEq = EQUIPMENT.filter((e) => n.has(e) && !(e === 'machine' && n.has('smith')));
  const tEq = EQUIPMENT.filter((e) => t.has(e) && !(e === 'machine' && t.has('smith')));
  for (const e of nEq) {
    if (!t.has(e)) {
      const other = tEq.filter((x) => !nEq.includes(x));
      reasons.push(other.length ? `Title says ${other.join('/')}, not ${e}` : `Title doesn't mention ${e}`);
    }
  }
  for (const e of tEq) if (!nEq.includes(e) && !reasons.some((r) => r.includes(e))) reasons.push(`Title adds ${e}`);

  // Variations
  for (const v of VARIATIONS) {
    if (n.has(v) && !t.has(v)) reasons.push(`Title doesn't mention ${v}`);
    else if (!n.has(v) && t.has(v)) reasons.push(`Title adds ${v}`);
  }

  // Main words: the name's words that aren't equipment / variation / filler.
  const core = [...n].filter((w) => !TAG_WORDS.has(w) && !STOP.has(w) && w.length > 2);
  const coreHit = core.some((w) => t.has(w) || tSquashed.includes(w));

  let result;
  if (core.length && !coreHit) { result = 'Likely wrong'; reasons.unshift('Title shares none of the main words'); }
  else if (reasons.some((r) => r.startsWith('Title says'))) result = 'Check';
  else if (reasons.length) result = 'Check';
  else result = 'Match';
  return { result, reasons: [...new Set(reasons)] };
}

// ── YouTube ───────────────────────────────────────────────────────────────

async function fetchVideos(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const params = new URLSearchParams({ part: 'snippet,status', id: batch.join(','), key: YOUTUBE_API_KEY });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    if (!res.ok) throw new Error(`YouTube API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    for (const it of data.items || []) {
      out[it.id] = {
        title: it.snippet?.title || '',
        channel: it.snippet?.channelTitle || '',
        available: it.status?.privacyStatus !== 'private',
        embeddable: it.status?.embeddable !== false,
      };
    }
    for (const id of batch) if (!out[id]) out[id] = { available: false };
  }
  return out;
}

// ── Main ──────────────────────────────────────────────────────────────────

const ORDER = { 'Likely wrong': 0, Check: 1, Match: 2 };

async function main() {
  const { rows } = await pool.query(
    `SELECT id, name, muscle_group, video_id, video_linked_by
       FROM exercises
      WHERE created_by IS NULL AND COALESCE(hidden_from_library, FALSE) = FALSE
      ORDER BY name`
  );
  const isSelfHosted = (v) => v && (v.startsWith('http') || v.startsWith('/'));
  const yt = rows.filter((r) => r.video_id && !isSelfHosted(r.video_id));
  const noVideo = rows.filter((r) => !r.video_id).length;
  const selfHosted = rows.filter((r) => isSelfHosted(r.video_id)).length;
  console.log(`${rows.length} library exercises: ${yt.length} YouTube, ${selfHosted} RepLab CDN, ${noVideo} with no video.`);

  const videos = await fetchVideos([...new Set(yt.map((r) => r.video_id))]);
  const results = yt.map((r) => {
    const v = videos[r.video_id] || { available: false };
    if (!v.available) return { ...r, ...v, result: 'Likely wrong', reasons: ['Video is deleted or private'] };
    const c = compare(r.name, v.title);
    if (!v.embeddable) c.reasons.push('Video does not allow embedding');
    return { ...r, ...v, ...c, result: !v.embeddable && c.result === 'Match' ? 'Check' : c.result };
  }).sort((a, b) => ORDER[a.result] - ORDER[b.result] || a.name.localeCompare(b.name));

  const counts = results.reduce((m, r) => ({ ...m, [r.result]: (m[r.result] || 0) + 1 }), {});
  console.log(`Likely wrong: ${counts['Likely wrong'] || 0}   Check: ${counts.Check || 0}   Match: ${counts.Match || 0}`);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Title check', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Result', key: 'result', width: 14 },
    { header: 'Exercise', key: 'name', width: 38 },
    { header: 'Muscle group', key: 'muscle_group', width: 14 },
    { header: 'Why', key: 'why', width: 50 },
    { header: 'YouTube title', key: 'title', width: 60 },
    { header: 'Channel', key: 'channel', width: 24 },
    { header: 'Video', key: 'link', width: 44 },
    { header: 'Linked by', key: 'linkedBy', width: 12 },
    { header: 'Action', key: 'action', width: 18 },
    { header: 'New video ID / notes', key: 'notes', width: 30 },
    { header: 'Exercise ID', key: 'id', width: 11 },
  ];
  ws.getRow(1).font = { bold: true };
  const fill = { 'Likely wrong': 'FFF8D7DA', Check: 'FFFFF3CD', Match: 'FFD4EDDA' };
  for (const r of results) {
    const row = ws.addRow({
      result: r.result, name: r.name, muscle_group: r.muscle_group, why: (r.reasons || []).join('; '),
      title: r.title || '', channel: r.channel || '',
      link: { text: `youtube.com/watch?v=${r.video_id}`, hyperlink: `https://www.youtube.com/watch?v=${r.video_id}` },
      linkedBy: r.video_linked_by || '', action: '', notes: '', id: r.id,
    });
    row.getCell('result').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill[r.result] } };
    row.getCell('action').dataValidation = {
      type: 'list', allowBlank: true,
      formulae: ['"Keep,Needs AI check,Paste new ID,Remove video"'],
    };
  }
  ws.autoFilter = { from: 'A1', to: 'K1' };

  const info = wb.addWorksheet('Run info');
  info.addRows([
    ['Run', new Date().toISOString()],
    ['Library exercises', rows.length],
    ['YouTube videos checked', yt.length],
    ['RepLab CDN videos (not checked)', selfHosted],
    ['No video yet', noVideo],
    ['Likely wrong', counts['Likely wrong'] || 0],
    ['Check', counts.Check || 0],
    ['Match', counts.Match || 0],
    ['Cost', '$0 — YouTube titles only, no AI'],
  ]);

  await wb.xlsx.writeFile(OUT);
  console.log(`Spreadsheet: ${OUT}`);
}

main()
  .catch((err) => { console.error('Fatal:', err.message || err); process.exitCode = 1; })
  .finally(async () => { try { await pool.end(); } catch {} });
