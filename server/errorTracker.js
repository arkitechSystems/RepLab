// Coding Errors tracker — feeds the admin "Coding Errors" page.
//
// Server: route handlers catch their own errors and console.error() them
// before answering 500, so those errors never reach Express's error
// middleware (or Sentry). installErrorTracker() wraps console.error so every
// Error passed to it is also recorded here, tagged with the request that hit
// it (via AsyncLocalStorage — see requestContext). Client: POST /errors/client
// (routes/errors.js) records browser crashes the same way.
//
// Repeats of one error are grouped by a fingerprint (source + error type +
// normalized message + first frame in our code) into one code_errors row
// with a count. Each group is classified as a likely code bug ('code') or an
// environment problem like a timeout ('runtime'). A group marked fixed that
// happens again is reopened.
import * as Sentry from '@sentry/node';
import crypto from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import pool from './dbPool.js';

const requestStore = new AsyncLocalStorage();

// Express middleware: remembers the current request so errors logged while
// handling it can name the route and user. Mount before the routes.
export function requestContext(req, res, next) {
  requestStore.run({ req }, next);
}

// Postgres SQLSTATE classes that mean the query itself is wrong:
// 42 syntax/type/undefined column, 22 bad data, 23 constraint violation,
// 0A unsupported feature, 2B/25 transaction misuse.
const CODE_SQLSTATE_CLASSES = ['42', '22', '23', '0A', '2B', '25'];
const CODE_JS_ERRORS = ['TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'URIError'];
// Network / environment failures that aren't bugs in our code.
const RUNTIME_PATTERNS = /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|ENOTFOUND|EAI_AGAIN|socket hang up|timeout|terminating connection|Connection terminated|Failed to fetch|Load failed|NetworkError|aborted/i;

export function classifyError({ name, code, message }) {
  if (RUNTIME_PATTERNS.test(String(message || '')) || RUNTIME_PATTERNS.test(String(code || ''))) return 'runtime';
  if (code && typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) {
    return CODE_SQLSTATE_CLASSES.includes(code.slice(0, 2)) ? 'code' : 'runtime';
  }
  if (CODE_JS_ERRORS.includes(name)) return 'code';
  return 'runtime';
}

// Same error, different values → same group: strip numbers, ids and quoted
// values out of the message before hashing.
function normalizeMessage(message) {
  return String(message || '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/"[^"]{0,200}"|'[^']{0,200}'/g, '<v>')
    .replace(/\d+/g, '<n>')
    .slice(0, 300);
}

// First stack frame in our own code ("db.js:1235", "pages/Workouts.jsx:88"),
// skipping node_modules and Node internals.
export function appFrame(stack) {
  for (const line of String(stack || '').split('\n').slice(1)) {
    if (/node_modules|node:internal|\(native\)|<anonymous>/.test(line)) continue;
    const m = line.match(/([^/\\\s(]+\/)?([^/\\\s(]+\.(?:m?js|jsx|ts|tsx)):(\d+)/);
    if (m) return `${m[1] || ''}${m[2]}:${m[3]}`;
  }
  return null;
}

// Route pattern for grouping: "/sessions/by-template/835/2026-10-07" →
// "/sessions/by-template/:n/:n" (query string dropped).
export function routePattern(method, url) {
  if (!url) return null;
  const p = String(url).split('?')[0].replace(/\/\d[\w-]*/g, '/:n');
  return method ? `${method} ${p}` : p;
}

// Don't hit the database more than once per group every few seconds when an
// error repeats in a tight loop; the count still catches up on the next write.
const THROTTLE_MS = 5000;
const pending = new Map(); // fingerprint -> { extra count, last write ms }
let recording = false;

// Records one occurrence. Never throws; failures only go to the original
// console.error so a broken tracker can't break the app.
export async function recordError(input) {
  if (recording) return; // an error while recording an error — don't loop
  const source = input.source === 'client' ? 'client' : 'server';
  const name = String(input.name || 'Error').slice(0, 100);
  const code = input.code != null ? String(input.code).slice(0, 50) : null;
  const message = String(input.message || '(no message)').slice(0, 2000);
  const stack = input.stack ? String(input.stack).slice(0, 8000) : null;
  const location = (input.location || appFrame(stack) || '').slice(0, 300) || null;
  const route = input.route ? String(input.route).slice(0, 300) : null;
  const kind = input.kind || classifyError({ name, code, message });
  const fingerprint = crypto
    .createHash('sha1')
    .update([source, name, code || '', normalizeMessage(message), location || route || ''].join('|'))
    .digest('hex');

  const now = Date.now();
  const p = pending.get(fingerprint);
  if (p && now - p.at < THROTTLE_MS) {
    p.extra++;
    return;
  }
  const extra = p ? p.extra : 0;
  pending.set(fingerprint, { extra: 0, at: now });
  if (pending.size > 500) pending.clear();

  recording = true;
  try {
    await pool.query(
      `INSERT INTO code_errors
         (fingerprint, source, kind, name, code, message, location, route, sample_stack,
          context, count, last_user_id, app_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (fingerprint) DO UPDATE SET
         count = code_errors.count + EXCLUDED.count,
         last_seen = NOW(),
         message = EXCLUDED.message,
         route = COALESCE(EXCLUDED.route, code_errors.route),
         sample_stack = COALESCE(EXCLUDED.sample_stack, code_errors.sample_stack),
         context = COALESCE(EXCLUDED.context, code_errors.context),
         last_user_id = COALESCE(EXCLUDED.last_user_id, code_errors.last_user_id),
         app_version = COALESCE(EXCLUDED.app_version, code_errors.app_version),
         reopened = code_errors.reopened OR code_errors.status = 'fixed',
         status = CASE WHEN code_errors.status = 'fixed' THEN 'open' ELSE code_errors.status END`,
      [
        fingerprint, source, kind, name, code, message, location, route, stack,
        input.context ? String(input.context).slice(0, 1000) : null,
        1 + extra,
        Number.isInteger(input.userId) ? input.userId : null,
        input.appVersion ? String(input.appVersion).slice(0, 50) : null,
      ]
    );
  } catch (err) {
    originalConsoleError?.('[errorTracker] could not record error:', err.message);
  } finally {
    recording = false;
  }
}

let originalConsoleError = null;

// Wraps console.error so every Error logged anywhere on the server is
// recorded (and sent to Sentry, which doesn't see handled errors on its own).
// Text logged alongside the error ("Projects page error:") is kept as context.
export function installErrorTracker() {
  if (originalConsoleError) return;
  originalConsoleError = console.error.bind(console);
  console.error = (...args) => {
    originalConsoleError(...args);
    if (recording) return;
    const err = args.find((a) => a instanceof Error);
    if (!err) return;
    try {
      const req = requestStore.getStore()?.req;
      const context = args
        .filter((a) => typeof a === 'string')
        .join(' ')
        .trim();
      recordError({
        source: 'server',
        name: err.name,
        code: err.code,
        message: err.message,
        stack: err.stack,
        route: req ? routePattern(req.method, req.originalUrl) : null,
        userId: req?.userId,
        context: context || null,
      });
      if (process.env.SENTRY_DSN) {
        Sentry.captureException(err, {
          extra: { context, route: req ? `${req.method} ${req.originalUrl}` : undefined },
        });
      }
    } catch {
      // Recording must never break logging.
    }
  };
}
