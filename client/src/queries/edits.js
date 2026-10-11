// Self-contained edits made outside a workout — rest day, rename, delete,
// move/assign a workout to a day, reorder (decision 10 in
// docs/tanstack-query-migration.md) — as queued TanStack Query mutations.
//
// queueEdit() changes the screen's saved copies right away (optimistic), then
// sends the request. Offline or on a dropped connection it waits on the phone
// (persisted across restarts, counted in "N changes waiting to sync") and is
// sent on reconnect; all edits go out in the order they were made, so the
// last change wins (decision 4). An edit the server refuses is rolled back
// and the error is shown.
//
// Each edit carries a `patch`: a small description of the change ({ kind,
// …fields }) that PATCHERS below know how to apply to cached data. Patches are
// also applied on top of every fresh load while their edit is still waiting
// (keys.js fetchPath overlay), so a reload can't show the old data before the
// edit reaches the server.
//
// Multi-step changes that need the server's answer first (copy a workout,
// start empty, create a workout/program, sharing) are NOT queued: they call
// api() directly and show offlineMessage() when there's no connection.
import { onlineManager } from '@tanstack/react-query';
import { api, OFFLINE_MESSAGE } from '../api';
import { queryClient as appQueryClient } from './queryClient';
import { setFetchOverlay } from './keys';
import { startMutation } from './sessionMutations';

export const QUEUED_EDIT = ['edits', 'send'];
// One queue for all of these edits: strictly in the order they were made.
const EDIT_SCOPE = { id: 'edits' };

const sameKey = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isList = (key, name) => key.length === 1 && key[0] === name;
// '/schedule?from=…&to=…' (not /schedule/today, /schedule/missed).
const isScheduleRange = (key) => key[0] === 'schedule' && key.length === 2 && typeof key[1] === 'object' && key[1].from;

function templateFromCache(client, id) {
  const list = client.getQueryData(['templates']);
  return Array.isArray(list) ? list.find((t) => t.id === id) : undefined;
}

// Schedule rows ({ date, templateId, templateName, customName, isRest }) for
// one loaded range, after setting the given days (same rules as the server's
// PUT /schedule: no templateId and not rest = the day is cleared).
function setScheduleDays(client, key, rows, days) {
  const { from, to } = key[1];
  const byDate = new Map(rows.map((r) => [r.date, r]));
  for (const day of days) {
    if (day.date < from || (to && day.date > to)) continue;
    if (day.templateId == null && !day.isRest) { byDate.delete(day.date); continue; }
    const tpl = day.templateId != null ? templateFromCache(client, day.templateId) : undefined;
    byDate.set(day.date, {
      date: day.date,
      templateId: day.isRest ? null : day.templateId ?? null,
      templateName: day.isRest ? null : (day.templateName ?? tpl?.name ?? byDate.get(day.date)?.templateName ?? null),
      customName: null,
      isRest: !!day.isRest || !!tpl?.isRest,
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// kind → (client, key, data, patch) => new data (return `data` unchanged when
// this key isn't affected). Must be safe to apply more than once.
const PATCHERS = {
  // { days: [{ date, templateId, isRest, templateName? }] }
  schedule(client, key, data, { days }) {
    if (!isScheduleRange(key) || !Array.isArray(data)) return data;
    return setScheduleDays(client, key, data, days);
  },
  // { from } — every day from this date on is cleared.
  scheduleClearFrom(_client, key, data, { from }) {
    if (!isScheduleRange(key) || !Array.isArray(data)) return data;
    return data.filter((r) => r.date < from);
  },
  // { id, name } — linked everywhere the workout appears.
  templateRename(_client, key, data, { id, name }) {
    if (isList(key, 'templates') && Array.isArray(data)) {
      return data.map((t) => (t.id === id ? { ...t, name } : t));
    }
    if (isScheduleRange(key) && Array.isArray(data)) {
      return data.map((r) => (r.templateId === id ? { ...r, templateName: name, customName: null } : r));
    }
    if (key[0] === 'sessions' && key[1] === 'by-template' && Number(key[2]) === id && data && typeof data === 'object') {
      return { ...data, customName: null, ...(data.workoutData ? { workoutData: { ...data.workoutData, name } } : {}) };
    }
    return data;
  },
  // { id }
  templateDelete(_client, key, data, { id }) {
    if (isList(key, 'templates') && Array.isArray(data)) return data.filter((t) => t.id !== id);
    if (isScheduleRange(key) && Array.isArray(data)) return data.filter((r) => r.templateId !== id);
    return data;
  },
  // { id, programId }
  templateProgram(_client, key, data, { id, programId }) {
    if (!isList(key, 'templates') || !Array.isArray(data)) return data;
    return data.map((t) => (t.id === id ? { ...t, programId } : t));
  },
  // { programId, templateIds } — new order within the program.
  templateReorder(_client, key, data, { templateIds }) {
    if (!isList(key, 'templates') || !Array.isArray(data)) return data;
    const order = new Map(templateIds.map((tid, i) => [tid, i]));
    return data.map((t) => (order.has(t.id) ? { ...t, sortOrder: order.get(t.id) } : t));
  },
  // { id, name }
  programRename(_client, key, data, { id, name }) {
    if (!isList(key, 'programs') || !Array.isArray(data)) return data;
    return data.map((p) => (p.id === id ? { ...p, name } : p));
  },
  // { id, templateIds } — the program and its workouts.
  programDelete(_client, key, data, { id, templateIds = [] }) {
    const gone = new Set(templateIds);
    if (isList(key, 'programs') && Array.isArray(data)) return data.filter((p) => p.id !== id);
    if (isList(key, 'templates') && Array.isArray(data)) return data.filter((t) => t.programId !== id && !gone.has(t.id));
    if (isScheduleRange(key) && Array.isArray(data)) return data.filter((r) => !gone.has(r.templateId));
    return data;
  },
};

export function applyPatch(client, key, data, patch) {
  const fn = patch && PATCHERS[patch.kind];
  if (!fn || data === undefined) return data;
  try { return fn(client, key, data, patch); } catch { return data; }
}

// Edits not yet confirmed by the server, oldest first.
function pendingEdits(client) {
  return client.getMutationCache().getAll()
    .filter((m) => m.state.status === 'pending' && sameKey(m.options.mutationKey, QUEUED_EDIT));
}

// Fresh data for `key` with every waiting edit applied on top.
export function withPendingEdits(client, key, data) {
  let out = data;
  for (const m of pendingEdits(client)) out = applyPatch(client, key, out, m.state.variables?.patch);
  return out;
}

// Apply a patch to every saved copy it affects. Returns what was there
// before, for a rollback.
function patchSavedCopies(client, patch) {
  const before = [];
  for (const query of client.getQueryCache().getAll()) {
    const { data, dataUpdatedAt, isInvalidated } = query.state;
    const next = applyPatch(client, query.queryKey, data, patch);
    if (next === data) continue;
    before.push({ key: query.queryKey, data, dataUpdatedAt });
    // Keep the copy's time ("Showing saved data from …") and its stale mark.
    client.setQueryData(query.queryKey, next, { updatedAt: dataUpdatedAt || Date.now() });
    if (isInvalidated) client.invalidateQueries({ queryKey: query.queryKey, exact: true, refetchType: 'none' });
  }
  return before;
}

function restoreSavedCopies(client, before) {
  for (const { key, data, dataUpdatedAt } of before) {
    client.setQueryData(key, data, { updatedAt: dataUpdatedAt || Date.now() });
  }
}

export function registerEditMutations(client) {
  client.setMutationDefaults(QUEUED_EDIT, {
    mutationFn: ({ path, method, body }) => api(path, {
      method,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      autoRetry: false,
    }),
    // Refused by the server after waiting in the queue (e.g. the workout was
    // deleted on another device): drop the optimistic copies and reload.
    onError: () => { client.invalidateQueries(); },
  });
  // Loads show waiting edits on top of what the server sent.
  setFetchOverlay((key, data) => withPendingEdits(client, key, data));
}

// Queue an edit: { path, method, body?, patch? }. Resolves
//   { outcome: 'sent', data }    the server confirmed it
//   { outcome: 'queued', done }  waiting on the phone; sent on reconnect
// Rejects (after rolling the saved copies back) when the server refuses it.
// The caller updates its own screen state for both outcomes.
export async function queueEdit({ path, method, body, patch }, client = appQueryClient) {
  const before = patch ? patchSavedCopies(client, patch) : [];
  try {
    return await startMutation(client, { mutationKey: QUEUED_EDIT, scope: EDIT_SCOPE }, { path, method, body, patch });
  } catch (err) {
    restoreSavedCopies(client, before);
    throw err;
  }
}

// Message for a change that needs a connection (not queued) and failed:
// the offline / connection wording when that's why, else the fallback.
export function offlineMessage(err, fallback) {
  if (err?.isOffline) return OFFLINE_MESSAGE;
  if (err?.isConnectionError) return err.message || fallback;
  return fallback;
}

// For multi-step changes that need the server (copy, start empty, …): throws
// the offline error up front instead of failing halfway through.
export function requireOnline() {
  if (onlineManager.isOnline() && !(typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  const err = new Error(OFFLINE_MESSAGE);
  err.isConnectionError = true;
  err.isOffline = true;
  throw err;
}
