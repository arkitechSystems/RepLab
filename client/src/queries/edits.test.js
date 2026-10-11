// Queued edits outside a workout (migration phase 5, decision 10): rest day,
// rename, delete, move. The saved copies change right away, the edit waits on
// the phone while offline (surviving a restart), loads show it on top of the
// server's older data until it lands, and edits go out once each, in order.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { onlineManager } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { server, http, HttpResponse } from '../test/server';
import { createQueryClient, createPersister, persistOptions, getPendingSaveCount } from './queryClient';
import { registerMutationDefaults } from './mutationDefaults';
import { pathKey, fetchPath } from './keys';
import { queueEdit, applyPatch } from './edits';

const D1 = '2026-10-12';
const D2 = '2026-10-13';
const SCHED = `/schedule?from=2026-10-01&to=2026-10-31`;
const schedule = () => [
  { date: D1, templateId: 10, templateName: 'Legs', customName: null, isRest: false },
  { date: D2, templateId: 11, templateName: 'Push', customName: null, isRest: false },
];
const templates = () => [
  { id: 10, name: 'Legs', programId: 1, isRest: false, sortOrder: 0 },
  { id: 11, name: 'Push', programId: 1, isRest: false, sortOrder: 1 },
  { id: 12, name: 'Pull', programId: 2, isRest: false, sortOrder: 0 },
];

function client() {
  const c = createQueryClient();
  c.setDefaultOptions({ ...c.getDefaultOptions(), mutations: { ...c.getDefaultOptions().mutations, retryDelay: 0 } });
  registerMutationDefaults(c);
  return c;
}
function seed(c) {
  c.setQueryData(pathKey(SCHED), schedule());
  c.setQueryData(pathKey('/templates'), templates());
}
const sched = (c) => c.getQueryData(pathKey(SCHED));

// Records every change the fake server gets, in order; GETs answer the
// server's (old) data.
function recordingServer(log) {
  server.use(
    http.get('*/schedule', () => HttpResponse.json(schedule())),
    http.get('*/templates', () => HttpResponse.json(templates())),
    http.all('*', async ({ request }) => {
      const { pathname } = new URL(request.url);
      const text = await request.text();
      log.push(`${request.method} ${pathname}${text ? ` ${text}` : ''}`);
      return HttpResponse.json({ success: true });
    }),
  );
}

const clearDay = (date) => ({
  path: '/schedule', method: 'PUT', body: { schedule: [{ date, templateId: null }] },
  patch: { kind: 'schedule', days: [{ date, templateId: null }] },
});
const rename = (id, name) => ({
  path: `/templates/${id}/name`, method: 'PUT', body: { name },
  patch: { kind: 'templateRename', id, name },
});

const persister = createPersister();
const persistWith = (c) => ({ ...persistOptions, queryClient: c, persister });
const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => onlineManager.setOnline(true));
afterEach(async () => { onlineManager.setOnline(true); await persister.removeClient(); });

describe('queued edits', () => {
  it('online: sent right away, and the saved copy shows the change', async () => {
    const log = [];
    recordingServer(log);
    const c = client();
    seed(c);
    await expect(queueEdit(clearDay(D1), c)).resolves.toMatchObject({ outcome: 'sent' });
    expect(log).toEqual([`PUT /schedule {"schedule":[{"date":"${D1}","templateId":null}]}`]);
    expect(sched(c).map((r) => r.date)).toEqual([D2]);
  });

  it('a server refusal is shown (rejects) and the saved copy is put back', async () => {
    server.use(http.put('*/templates/10/name', () => HttpResponse.json({ error: 'Template not found' }, { status: 404 })));
    const c = client();
    seed(c);
    await expect(queueEdit(rename(10, 'Legs Day'), c)).rejects.toMatchObject({ status: 404 });
    expect(c.getQueryData(pathKey('/templates'))[0].name).toBe('Legs');
    expect(sched(c)[0].templateName).toBe('Legs');
    expect(getPendingSaveCount(c)).toBe(0);
  });

  it('offline: shows right away, waits on the phone through a restart, then goes out once each, in order', async () => {
    const log = [];
    recordingServer(log);
    onlineManager.setOnline(false);
    const before = client();
    seed(before);
    expect((await queueEdit(rename(10, 'Legs Day'), before)).outcome).toBe('queued');
    expect((await queueEdit(clearDay(D2), before)).outcome).toBe('queued');
    expect(getPendingSaveCount(before)).toBe(2);
    expect(sched(before)).toEqual([{ date: D1, templateId: 10, templateName: 'Legs Day', customName: null, isRest: false }]);
    await persistQueryClientSave(persistWith(before));

    const after = client();
    await persistQueryClientRestore(persistWith(after));
    expect(getPendingSaveCount(after)).toBe(2);
    expect(sched(after).map((r) => r.templateName)).toEqual(['Legs Day']);

    // A reload while they wait shows them on top of the server's older data.
    const fresh = await after.fetchQuery({ queryKey: pathKey(SCHED), queryFn: fetchPath(SCHED), staleTime: 0 });
    expect(fresh.map((r) => r.templateName)).toEqual(['Legs Day']);

    onlineManager.setOnline(true);
    await after.resumePausedMutations();
    await tick(50);
    expect(log).toEqual([
      'PUT /templates/10/name {"name":"Legs Day"}',
      `PUT /schedule {"schedule":[{"date":"${D2}","templateId":null}]}`,
    ]);
    expect(getPendingSaveCount(after)).toBe(0);
  });

  it('a dropped connection queues it and keeps retrying until it gets through', async () => {
    let n = 0;
    server.use(http.delete('*/templates/11', () => { n++; return n < 3 ? HttpResponse.error() : HttpResponse.json({ success: true }); }));
    const c = client();
    seed(c);
    const result = await queueEdit({ path: '/templates/11', method: 'DELETE', patch: { kind: 'templateDelete', id: 11 } }, c);
    expect(result.outcome).toBe('queued');
    expect(c.getQueryData(pathKey('/templates')).map((t) => t.id)).toEqual([10, 12]);
    await result.done;
    expect(n).toBe(3);
  });
});

describe('what each edit changes in the saved copies', () => {
  const c = client();
  seed(c);
  const key = pathKey(SCHED);

  it('assigning a workout to a day adds it with its name; rest and clear', () => {
    const days = [{ date: '2026-10-14', templateId: 12 }, { date: D1, isRest: true }, { date: D2, templateId: null }];
    expect(applyPatch(c, key, schedule(), { kind: 'schedule', days })).toEqual([
      { date: D1, templateId: null, templateName: null, customName: null, isRest: true },
      { date: '2026-10-14', templateId: 12, templateName: 'Pull', customName: null, isRest: false },
    ]);
  });

  it('only touches days inside the loaded range', () => {
    const days = [{ date: '2026-11-02', templateId: 12 }];
    expect(applyPatch(c, key, schedule(), { kind: 'schedule', days })).toEqual(schedule());
  });

  it('clearing the calendar from a date', () => {
    expect(applyPatch(c, key, schedule(), { kind: 'scheduleClearFrom', from: D2 }).map((r) => r.date)).toEqual([D1]);
  });

  it('deleting a program removes it, its workouts and their calendar days', () => {
    const patch = { kind: 'programDelete', id: 1, templateIds: [10, 11] };
    expect(applyPatch(c, pathKey('/programs'), [{ id: 1 }, { id: 2 }], patch)).toEqual([{ id: 2 }]);
    expect(applyPatch(c, pathKey('/templates'), templates(), patch).map((t) => t.id)).toEqual([12]);
    expect(applyPatch(c, key, schedule(), patch)).toEqual([]);
  });

  it('moving and reordering workouts', () => {
    const moved = applyPatch(c, pathKey('/templates'), templates(), { kind: 'templateProgram', id: 12, programId: 1 });
    expect(moved[2].programId).toBe(1);
    const reordered = applyPatch(c, pathKey('/templates'), templates(), { kind: 'templateReorder', programId: 1, templateIds: [11, 10] });
    expect(reordered.map((t) => t.sortOrder)).toEqual([1, 0, 0]);
  });

  it('leaves unrelated data alone', () => {
    const data = { show: true };
    expect(applyPatch(c, pathKey('/schedule/today?date=2026-10-12'), data, { kind: 'scheduleClearFrom', from: D1 })).toBe(data);
  });
});
