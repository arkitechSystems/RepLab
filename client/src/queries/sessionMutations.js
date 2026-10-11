// Workout-session saves and Mark Complete as TanStack Query mutations
// (migration phase 4). Each is queued per workout day (scope), so a day's
// saves and its completion reach the server strictly in order; while the
// device is offline they wait on the phone (persisted across restarts) and
// are sent on reconnect. Connection failures are retried until they get
// through (queryClient shouldRetrySave).
import { api } from '../api';
import { keys } from './keys';

export const SAVE_SESSION = ['sessions', 'save'];
export const COMPLETE_SESSION = ['sessions', 'complete'];

export function sessionScope(templateId, date) {
  return { id: `session-${Number(templateId)}-${date}` };
}

// WorkoutSession's in-session backup of typed numbers (same key it uses).
function backupKey(templateId, date) {
  return `replab:session:${templateId}:${date}`;
}

// Unsent saves / completions for one workout day, oldest first.
export function pendingForDay(client, mutationKey, templateId, date) {
  const scopeId = sessionScope(templateId, date).id;
  return client.getMutationCache().getAll()
    .filter((m) => m.state.status === 'pending'
      && m.options.scope?.id === scopeId
      && JSON.stringify(m.options.mutationKey) === JSON.stringify(mutationKey));
}

// The newest unsent save's body for a day ({ entries, notes, workoutData, … }),
// or null. The server doesn't have it yet, so a reopened workout must show
// this rather than the older server copy — otherwise the next autosave would
// overwrite the unsent sets.
export function latestPendingSave(client, templateId, date) {
  const pending = pendingForDay(client, SAVE_SESSION, templateId, date);
  return pending.length ? pending[pending.length - 1].state.variables?.body ?? null : null;
}

// Edit the saved copy of a workout day (/sessions/by-template/:id/:date), if
// there is one. Its "stale" mark from the save is kept, so the next online
// open still reloads it from the server.
function updateSavedDay(client, templateId, date, update) {
  const key = keys.sessionDay(templateId, date);
  if (client.getQueryData(key) === undefined) return;
  const { isInvalidated } = client.getQueryState(key);
  client.setQueryData(key, (day) => (day ? update(day) : day));
  if (isInvalidated) client.invalidateQueries({ queryKey: key, exact: true, refetchType: 'none' });
}

export function registerSessionMutations(client) {
  client.setMutationDefaults(SAVE_SESSION, {
    mutationFn: async ({ body }) => {
      const res = await api('/sessions', { method: 'POST', body: JSON.stringify(body), autoRetry: false });
      // Server error envelope on a 2xx: treat as a failed save.
      if (res && res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: (_data, { body }) => {
      // Keep this day's saved copy in step with what the server now has, so
      // reopening the workout offline shows these sets — not the copy from
      // when it was first opened (whose next autosave would overwrite them).
      updateSavedDay(client, body.templateId, body.date, (day) => ({
        ...day, workoutData: body.workoutData, entries: body.entries, notes: body.notes,
      }));
      // Once nothing newer is waiting for this day, the backup has been
      // delivered: mark it submitted so a later restore won't pick it up.
      if (pendingForDay(client, SAVE_SESSION, body.templateId, body.date).length <= 1) {
        try {
          localStorage.setItem(backupKey(body.templateId, body.date), JSON.stringify({ submitted: true, updatedAt: Date.now() }));
          localStorage.removeItem(backupKey(body.templateId, body.date));
        } catch {}
      }
    },
  });

  client.setMutationDefaults(COMPLETE_SESSION, {
    mutationFn: ({ templateId, date, completed }) => api('/sessions/complete', {
      method: 'PUT',
      body: JSON.stringify({ templateId: Number(templateId), date, completed }),
      autoRetry: false,
    }),
    onSuccess: (_data, { templateId, date, completed }) => {
      updateSavedDay(client, templateId, date, (day) => ({ ...day, completed }));
      if (completed) {
        try { localStorage.removeItem(backupKey(templateId, date)); } catch {}
      }
    },
  });
}

// Starts a queued mutation and resolves as soon as the caller knows what
// happened to it:
//   { outcome: 'sent', data }     the server confirmed it
//   { outcome: 'queued', done }   offline, connection trouble, or waiting on an
//                                 earlier one for the same day — it carries on
//                                 in the background; `done` settles when sent
// Rejects with the error when the server refused it (no retry).
export function startMutation(client, { mutationKey, scope }, variables) {
  const mutation = client.getMutationCache().build(client, { mutationKey, scope });
  const done = mutation.execute(variables);
  return new Promise((resolve, reject) => {
    let finished = false;
    let unsubscribe = () => {};
    const finish = (fn, value) => {
      if (finished) return;
      finished = true;
      unsubscribe();
      fn(value);
    };
    const check = () => {
      const s = mutation.state;
      if (s.status === 'pending' && (s.isPaused || s.failureCount > 0)) finish(resolve, { outcome: 'queued', done });
    };
    unsubscribe = client.getMutationCache().subscribe((event) => { if (event.mutation === mutation) check(); });
    done.then((data) => finish(resolve, { outcome: 'sent', data }), (err) => finish(reject, err));
    check();
  });
}

// Undo a completion that hasn't reached the server: drop it from the queue if
// it hasn't been sent yet; if one is already on its way, queue an "undo"
// after it. Returns true when something was queued or removed.
export function cancelPendingComplete(client, templateId, date) {
  const pending = pendingForDay(client, COMPLETE_SESSION, templateId, date)
    .filter((m) => m.state.variables?.completed === true);
  if (!pending.length) return false;
  let inFlight = false;
  for (const m of pending) {
    if (m.state.isPaused) client.getMutationCache().remove(m);
    else inFlight = true;
  }
  if (inFlight) {
    startMutation(client, { mutationKey: COMPLETE_SESSION, scope: sessionScope(templateId, date) },
      { templateId, date, completed: false }).catch(() => {});
  }
  return true;
}
