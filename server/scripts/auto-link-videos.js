// Auto-link YouTube demo videos to exercises in the REPLAB master library.
//
// For each exercise where exercises.video_id IS NULL, this script:
//   1. Searches YouTube for "{name} form demo" — first restricted to the
//      FlexXP channel, then (optionally) falling back to a general search.
//   2. Pulls duration + metadata for each candidate via videos.list.
//   3. Filters out anything longer than --max-duration seconds.
//   4. Asks Claude to pick the best demo using a strict ranking prompt.
//   5. In --dry-run (default) prints a table. In --apply, writes video_id back.
//
// Run:
//   node --env-file=.env server/scripts/auto-link-videos.js --dry-run
//   node --env-file=.env server/scripts/auto-link-videos.js --apply
//
// Required env: YOUTUBE_API_KEY, ANTHROPIC_API_KEY, DATABASE_URL.
//
// Quota warning: YouTube search costs 100 units/call. A 200-exercise run with
// the FlexXP-then-general fallback can easily eat 40k+ units against the
// default 10k daily quota — the script prints an estimate at startup and
// requires Y to continue (or --yes to skip the prompt).

import pool from '../dbPool.js';
import Anthropic from '@anthropic-ai/sdk';
import readline from 'node:readline';

// ── CLI parsing ───────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

function getFlag(name) {
  return argv.includes(`--${name}`);
}

function getOpt(name, fallback) {
  const idx = argv.indexOf(`--${name}`);
  if (idx === -1 || idx === argv.length - 1) return fallback;
  return argv[idx + 1];
}

const APPLY = getFlag('apply');
const DRY_RUN = !APPLY; // dry-run is the default; --apply opts in
const VERBOSE = getFlag('verbose');
const YES = getFlag('yes');
const FALLBACK_GENERAL = !getFlag('no-fallback-general'); // default true
const GENERAL_ONLY = getFlag('general-only'); // skip channel-first phase entirely
const EXERCISE_NAME = getOpt('exercise', null);
const MAX_DURATION = Number(getOpt('max-duration', 90));
const CHANNEL_NAME = getOpt('channel', 'FlexXP');
const LIMIT = getOpt('limit', null) ? Number(getOpt('limit', null)) : null;
const MODEL = getOpt('model', 'claude-haiku-4-5-20251001');

// ── Env validation ────────────────────────────────────────────────────────

const REQUIRED_ENV = ['YOUTUBE_API_KEY', 'ANTHROPIC_API_KEY', 'DATABASE_URL'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  console.error('Set them in .env at the repo root and re-run with --env-file=.env');
  process.exit(1);
}

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Rate limiting ─────────────────────────────────────────────────────────

// Simple sliding-window throttles. YouTube: 5 req/sec. Claude: 1 req/sec.
class RateLimiter {
  constructor(maxPerSecond) {
    this.interval = 1000 / maxPerSecond;
    this.lastCall = 0;
  }
  async wait() {
    const now = Date.now();
    const elapsed = now - this.lastCall;
    if (elapsed < this.interval) {
      await new Promise((r) => setTimeout(r, this.interval - elapsed));
    }
    this.lastCall = Date.now();
  }
}

const ytLimiter = new RateLimiter(5);
const claudeLimiter = new RateLimiter(1);

// ── Helpers ───────────────────────────────────────────────────────────────

function parseIsoDuration(iso) {
  // Parses PT#H#M#S into seconds. Returns 0 if unparseable.
  if (!iso || typeof iso !== 'string') return 0;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const [, h = 0, mn = 0, s = 0] = m;
  return Number(h) * 3600 + Number(mn) * 60 + Number(s);
}

async function ytFetch(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    await ytLimiter.wait();
    const res = await fetch(url);
    if (res.ok) return res.json();

    const body = await res.text().catch(() => '');

    // 429 = per-minute search rate limit on the project. Back off and retry —
    // YouTube's "Search Queries per minute" window is usually short, so a few
    // seconds of sleep is enough to recover. Daily quota exhaustion looks the
    // same on the wire; if it's truly daily, the retries fail and we throw.
    if (res.status === 429 && attempt < retries) {
      const delaySec = [5, 15, 45][attempt] ?? 60;
      console.log(`    ⏸ YouTube 429 — backing off ${delaySec}s (retry ${attempt + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, delaySec * 1000));
      continue;
    }

    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 300)}`);
  }
}

async function resolveChannelId(name) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(name)}&maxResults=1&key=${YOUTUBE_API_KEY}`;
  const data = await ytFetch(url);
  if (VERBOSE) console.log('Channel lookup raw:', JSON.stringify(data, null, 2));
  const item = data.items?.[0];
  if (!item) return null;
  return {
    channelId: item.snippet?.channelId || item.id?.channelId,
    channelTitle: item.snippet?.channelTitle || item.snippet?.title,
  };
}

async function searchYouTube({ query, channelId }) {
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    q: query,
    maxResults: '5',
    key: YOUTUBE_API_KEY,
  });
  if (channelId) params.set('channelId', channelId);
  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  const data = await ytFetch(url);
  if (VERBOSE) console.log(`Search "${query}" channelId=${channelId || 'ALL'}:`, JSON.stringify(data.items?.map((i) => i.snippet?.title), null, 2));
  return (data.items || [])
    .map((it) => ({
      videoId: it.id?.videoId,
      title: it.snippet?.title,
      channelTitle: it.snippet?.channelTitle,
      description: it.snippet?.description || '',
    }))
    .filter((v) => v.videoId);
}

async function fetchVideoDetails(videoIds) {
  if (!videoIds.length) return [];
  const params = new URLSearchParams({
    part: 'contentDetails,snippet,statistics',
    id: videoIds.join(','),
    key: YOUTUBE_API_KEY,
  });
  const url = `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
  const data = await ytFetch(url);
  if (VERBOSE) console.log(`Video details for ${videoIds.length} ids: got ${data.items?.length}`);
  return (data.items || []).map((it) => ({
    videoId: it.id,
    title: it.snippet?.title,
    channelTitle: it.snippet?.channelTitle,
    description: (it.snippet?.description || '').slice(0, 200),
    durationSec: parseIsoDuration(it.contentDetails?.duration),
    viewCount: Number(it.statistics?.viewCount || 0),
  }));
}

function buildPrompt(exercise, candidates) {
  return `You are helping link YouTube demo videos to a strength-training exercise library.

EXERCISE: ${exercise.name} (target muscle: ${exercise.muscle_group})

CANDIDATES:
${JSON.stringify(candidates, null, 2)}

RANKING CRITERIA (in priority order):
1. Clearly demonstrates the full ${exercise.name} movement with good form visible.
2. Shorter is better — prefer the shortest that still meets criterion 1.
3. Has a voiceover explaining form cues / setup / common mistakes (preferred over music-only or text-overlay-only videos).
4. Prefer FlexXP channel videos (where outsideFlexXP is false).

OUTPUT FORMAT (strict — one line):
PICK <videoId> | <one-line reason>
or
NONE | <one-line reason no candidate works>

Do not output anything else.`;
}

async function askClaude(exercise, candidates) {
  await claudeLimiter.wait();
  const prompt = buildPrompt(exercise, candidates);
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = resp.content?.map((c) => (c.type === 'text' ? c.text : '')).join('').trim();
  if (VERBOSE) console.log('Claude raw:', text);
  return text;
}

function parseClaudeResponse(text, candidateIds) {
  if (!text) return { kind: 'error', reason: 'empty response' };
  const firstLine = text.split('\n')[0].trim();
  const pickMatch = firstLine.match(/^PICK\s+(\S+)\s*(?:\|\s*(.*))?$/i);
  if (pickMatch) {
    const id = pickMatch[1];
    const reason = (pickMatch[2] || '').trim();
    if (!candidateIds.includes(id)) {
      return { kind: 'error', reason: `Claude picked unknown id "${id}" (hallucination)` };
    }
    return { kind: 'pick', videoId: id, reason };
  }
  const noneMatch = firstLine.match(/^NONE\s*(?:\|\s*(.*))?$/i);
  if (noneMatch) {
    return { kind: 'none', reason: (noneMatch[1] || '').trim() };
  }
  return { kind: 'error', reason: `unparseable response: "${firstLine.slice(0, 120)}"` };
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('─────────────────────────────────────────────');
  console.log(' RepLab — auto-link YouTube demos to exercises');
  console.log('─────────────────────────────────────────────');
  console.log(`Mode:             ${APPLY ? 'APPLY (writes to DB)' : 'DRY-RUN (no writes)'}`);
  console.log(`Search mode:      ${GENERAL_ONLY ? 'GENERAL-ONLY' : `${CHANNEL_NAME}-first` + (FALLBACK_GENERAL ? ' + general fallback' : '')}`);
  console.log(`Max duration:     ${MAX_DURATION}s`);
  console.log(`Model:            ${MODEL}`);
  if (EXERCISE_NAME) console.log(`Exercise filter:  ${EXERCISE_NAME}`);
  if (LIMIT) console.log(`Limit:            ${LIMIT}`);
  console.log('');

  // 1. Resolve channel id (skipped in general-only mode — saves 100 quota units)
  let channel = null;
  if (!GENERAL_ONLY) {
    try {
      channel = await resolveChannelId(CHANNEL_NAME);
      if (channel) {
        console.log(`Resolved channel "${channel.channelTitle}" -> ${channel.channelId}`);
      } else {
        console.warn(`Could not resolve channelId for "${CHANNEL_NAME}". Will filter by channelTitle in snippets instead.`);
      }
    } catch (err) {
      console.warn(`Channel lookup failed: ${err.message}. Will filter by channelTitle in snippets instead.`);
    }
  }

  // 2. Load target exercises
  let exercises;
  if (EXERCISE_NAME) {
    const r = await pool.query(
      `SELECT id, name, muscle_group, video_id FROM exercises
       WHERE LOWER(name) = LOWER($1) AND created_by IS NULL`,
      [EXERCISE_NAME]
    );
    exercises = r.rows;
    if (!exercises.length) {
      console.error(`No master exercise found with name="${EXERCISE_NAME}"`);
      await pool.end();
      process.exit(1);
    }
  } else {
    const r = await pool.query(
      `SELECT id, name, muscle_group, video_id FROM exercises
       WHERE video_id IS NULL AND created_by IS NULL
       ORDER BY LOWER(name)`
    );
    exercises = r.rows;
  }
  if (LIMIT) exercises = exercises.slice(0, LIMIT);

  console.log(`\nTarget exercises: ${exercises.length}`);
  if (!exercises.length) {
    console.log('Nothing to do — every master exercise already has a video_id.');
    await pool.end();
    return;
  }

  // 3. Quota estimate + confirm
  // Per-exercise cost: 1 channel-first search (100) + 1 general search (100) + 1 videos.list (1) = 201 in worst case.
  // General-only: 1 search (100) + 1 videos.list (1) = 101 per exercise, no upfront channel lookup.
  // Channel-first best case (FlexXP has results): 101 per exercise.
  const bestCase = GENERAL_ONLY
    ? exercises.length * 101
    : exercises.length * 101 + 100;
  const worstCase = GENERAL_ONLY
    ? exercises.length * 101
    : exercises.length * 201 + 100;
  console.log(`\nEstimated YouTube quota: ${bestCase}–${worstCase} units (daily quota typically 10,000).`);
  if (worstCase > 10000) {
    console.warn('Worst-case exceeds default daily quota. Consider --limit to chunk this work.');
  }
  if (!YES) {
    const ans = await prompt('Continue? (y/N) ');
    if (ans.trim().toLowerCase() !== 'y') {
      console.log('Aborted.');
      await pool.end();
      return;
    }
  }

  // 4. Process each exercise
  const stats = { processed: 0, linked: 0, skipped: 0, none: 0, errored: 0 };
  const ABORT_AFTER_CONSECUTIVE_429 = 5;
  let consecutive429s = 0;
  let abortedEarly = false;

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const label = `[${i + 1}/${exercises.length}] ${ex.name} (${ex.muscle_group})`;
    console.log(`\n${label}`);
    stats.processed++;

    try {
      const query = `${ex.name} form demo`;

      // 4a. First pass — channel-restricted search (skipped in general-only mode)
      let rawCandidates = [];
      if (!GENERAL_ONLY) {
        if (channel?.channelId) {
          rawCandidates = await searchYouTube({ query, channelId: channel.channelId });
        } else {
          // No channelId — search broadly and filter by channelTitle later
          const all = await searchYouTube({ query, channelId: null });
          rawCandidates = all.filter(
            (c) => (c.channelTitle || '').toLowerCase() === CHANNEL_NAME.toLowerCase()
          );
        }
      }

      let candidates = [];
      if (rawCandidates.length) {
        const detailed = await fetchVideoDetails(rawCandidates.map((c) => c.videoId));
        candidates = detailed
          .filter((v) => v.durationSec > 0 && v.durationSec <= MAX_DURATION)
          .map((v) => ({ ...v, outsideFlexXP: false }));
      }

      // 4b. Fallback — general search (or primary, in general-only mode)
      if (!candidates.length && (FALLBACK_GENERAL || GENERAL_ONLY)) {
        const general = await searchYouTube({ query, channelId: null });
        if (general.length) {
          const detailed = await fetchVideoDetails(general.map((c) => c.videoId));
          candidates = detailed
            .filter((v) => v.durationSec > 0 && v.durationSec <= MAX_DURATION)
            .map((v) => ({
              ...v,
              outsideFlexXP: (v.channelTitle || '').toLowerCase() !== CHANNEL_NAME.toLowerCase(),
            }));
        }
      }

      if (!candidates.length) {
        console.log(`  ⊘ Skipped: no candidates under ${MAX_DURATION}s`);
        stats.skipped++;
        continue;
      }

      // 4c. Ask Claude
      const candidateIds = candidates.map((c) => c.videoId);
      const claudeText = await askClaude(ex, candidates);
      const decision = parseClaudeResponse(claudeText, candidateIds);

      if (decision.kind === 'error') {
        console.log(`  ⚠ Skipped: ${decision.reason}`);
        stats.errored++;
        continue;
      }
      if (decision.kind === 'none') {
        console.log(`  ✗ NONE | ${decision.reason}`);
        stats.none++;
        continue;
      }

      // decision.kind === 'pick'
      const picked = candidates.find((c) => c.videoId === decision.videoId);
      const channelLabel = picked.outsideFlexXP ? picked.channelTitle : 'FlexXP';
      console.log(`  ✓ Picked: ${picked.videoId} (${channelLabel}, ${picked.durationSec}s) — "${decision.reason}"`);

      if (APPLY) {
        const r = await pool.query(
          `UPDATE exercises SET video_id = $1, video_linked_by = 'claude_code' WHERE id = $2`,
          [picked.videoId, ex.id]
        );
        console.log(`  → wrote: UPDATE exercises SET video_id='${picked.videoId}', video_linked_by='claude_code' WHERE id=${ex.id} (${r.rowCount} row)`);
      } else {
        console.log(`  → would write: UPDATE exercises SET video_id='${picked.videoId}', video_linked_by='claude_code' WHERE id=${ex.id}`);
      }
      stats.linked++;
      consecutive429s = 0;
    } catch (err) {
      console.error(`  ⚠ Error processing "${ex.name}": ${err.message}`);
      if (VERBOSE) console.error(err);
      stats.errored++;

      // Circuit-breaker: if YouTube returns 429 even after the per-request
      // backoff retries, that almost always means the daily quota is gone
      // (per-minute would have cleared during the retries). Bail rather
      // than spend hours of wall time grinding 65s of retries per exercise.
      if (/YouTube API 429/.test(err.message)) {
        consecutive429s++;
        if (consecutive429s >= ABORT_AFTER_CONSECUTIVE_429) {
          console.error(`\n✋ Aborting: ${consecutive429s} consecutive 429s after retries — daily YouTube quota is likely exhausted. Re-run after midnight Pacific.`);
          abortedEarly = true;
          break;
        }
      } else {
        consecutive429s = 0;
      }
    }
  }

  // 5. Summary
  console.log('\n─────────────────────────────────');
  if (abortedEarly) console.log(`Aborted early after ${stats.processed}/${exercises.length} exercises (quota likely exhausted)`);
  console.log(`Processed: ${stats.processed}`);
  console.log(`Linked:    ${stats.linked}  ${APPLY ? '(written)' : '(would link in --apply mode)'}`);
  console.log(`Skipped:   ${stats.skipped}   (no candidates)`);
  console.log(`NONE:      ${stats.none}   (Claude rejected all candidates)`);
  if (stats.errored) console.log(`Errored:   ${stats.errored}   (skipped due to API/parse errors)`);
  console.log('─────────────────────────────────');
  if (DRY_RUN) console.log('Run with --apply to write to DB.');
}

// ── Entry point ───────────────────────────────────────────────────────────

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await pool.end(); } catch { /* already closed */ }
  });
