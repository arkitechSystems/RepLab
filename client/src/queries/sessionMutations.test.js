import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { onlineManager } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { server, http, HttpResponse } from '../test/server';
import { createQueryClient, createPersister, persistOptions, getPendingSaveCount } from './queryClient';
import {
  SAVE_SESSION, COMPLETE_SESSION, sessionScope, registerSessionMutations,
  startMutation, latestPendingSave, pendingForDay, cancelPendingComplete,
} from './sessionMutations';

const T = 835;
const D = '2026-10-07';
const scope = sessionScope(T, D);
const body = (n) => ({ templateId: T, date: D, entries: [{ exerciseName: 'Squat', setNumber: 1, weight: n, reps: 5 }], notes: {}, workoutData: { name: 'Legs', exercises: [] }, confirmOverwrite: true });
const save = (client, n) => startMutation(client, { mutationKey: SAVE_SESSION, scope }, { body: body(n) });
const complete = (client, completed = true) => startMutation(client, { mutationKey: COMPLETE_SESSION, scope }, { templateId: T, date: D, completed });

function client() {
  const c = createQueryClient();
  c.setDefaultOptions({ ...c.getDefaultOptions(), mutations: { ...c.getDefaultOptions().mutations, retryDelay: 0 } });
  registerSessionMutations(c);
  return c;
}

// Records every request the fake server gets, in order.
function recordingServer(log) {
  server.use(
    http.post('*/sessions', async ({ request }) => { const b = await request.json(); log.push(`save ${b.entries[0].weight}`); return HttpResponse.json({ id: 1 }, { status: 201 }); }),
    http.put('*/sessions/complete', async ({ request }) => { const b = await request.json(); log.push(`complete ${b.completed}`); return HttpResponse.json({ success: true }); }),
  );
}

const persister = createPersister();
const persistWith = (c) => ({ ...persistOptions, queryClient: c, persister });
const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => onlineManager.setOnline(true));
afterEach(async () => { onlineManager.setOnline(true); await persister.removeClient(); });

describe('workout saves', () => {
  it('online: sent right away', async () => {
    const log = [];
    recordingServer(log);
    await expect(save(client(), 100)).resolves.toMatchObject({ outcome: 'sent' });
    expect(log).toEqual(['save 100']);
  });

  it('a server refusal is reported, not retried', async () => {
    let n = 0;
    server.use(http.post('*/sessions', () => { n++; return HttpResponse.json({ error: 'column "is_completed" is of type boolean' }, { status: 500 }); }));
    await expect(save(client(), 100)).rejects.toMatchObject({ status: 500 });
    expect(n).toBe(1);
  });

  it('a dropped connection queues it and keeps retrying until it gets through', async () => {
    let n = 0;
    const log = [];
    server.use(http.post('*/sessions', async ({ request }) => {
      n++;
      if (n < 3) return HttpResponse.error();
      log.push((await request.json()).entries[0].weight);
      return HttpResponse.json({ id: 1 });
    }));
    const result = await save(client(), 120);
    expect(result.outcome).toBe('queued');
    await result.done;
    expect(log).toEqual([120]);
  });

  it('offline: saves and Mark Complete wait on the phone, survive a restart, then go out once each, in order', async () => {
    const log = [];
    recordingServer(log);
    onlineManager.setOnline(false);
    const before = client();
    expect((await save(before, 100)).outcome).toBe('queued');
    expect((await save(before, 110)).outcome).toBe('queued');
    expect((await complete(before)).outcome).toBe('queued');
    expect(getPendingSaveCount(before)).toBe(3);
    expect(latestPendingSave(before, T, D).entries[0].weight).toBe(110);
    await persistQueryClientSave(persistWith(before));

    const after = client();
    await persistQueryClientRestore(persistWith(after));
    expect(getPendingSaveCount(after)).toBe(3);
    expect(latestPendingSave(after, T, D).entries[0].weight).toBe(110);
    onlineManager.setOnline(true);
    await after.resumePausedMutations();
    await tick(50);
    expect(log).toEqual(['save 100', 'save 110', 'complete true']);
    expect(getPendingSaveCount(after)).toBe(0);
  });

  // Regression (pre-existing): the offline copy of a workout day only updated
  // when the day was loaded, so reopening it offline after logging sets showed
  // the older copy — and the next autosave sent that over the newer sets.
  it("updates the day's saved copy to what was just saved, and to completed after Mark Complete", async () => {
    recordingServer([]);
    const c = client();
    const key = ['sessions', 'by-template', String(T), D];
    c.setQueryData(key, { id: 9, completed: false, entries: [], workoutData: { name: 'Legs', exercises: [] }, notes: {} });
    await save(c, 140);
    expect(c.getQueryData(key).entries[0].weight).toBe(140);
    expect(c.getQueryData(key).id).toBe(9);
    await complete(c);
    expect(c.getQueryData(key).completed).toBe(true);
  });

  it("clears the workout's typed-numbers backup once the last save lands", async () => {
    recordingServer([]);
    localStorage.setItem(`replab:session:${T}:${D}`, JSON.stringify({ entries: {}, submitted: false }));
    await save(client(), 100);
    expect(localStorage.getItem(`replab:session:${T}:${D}`)).toBeNull();
  });
});

describe('undoing a completion that has not synced', () => {
  it('drops it from the queue', async () => {
    const log = [];
    recordingServer(log);
    onlineManager.setOnline(false);
    const c = client();
    await save(c, 100);
    await complete(c);
    expect(cancelPendingComplete(c, T, D)).toBe(true);
    expect(pendingForDay(c, COMPLETE_SESSION, T, D)).toHaveLength(0);
    onlineManager.setOnline(true);
    await c.resumePausedMutations();
    await tick(50);
    expect(log).toEqual(['save 100']);
  });

  it('returns false when there is nothing to undo', () => {
    expect(cancelPendingComplete(client(), T, D)).toBe(false);
  });
});
