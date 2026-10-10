// Workout session saves on TanStack Query (migration phase 4), driven through
// the real screen: set checks autosave through the per-day queue, offline
// sets and Mark Complete wait on the phone and go out in order on reconnect,
// a reopened workout shows its unsent sets, and a completion queued by the
// old version is carried over.
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { server, http, HttpResponse } from '../test/server';
import { renderScreen, signIn } from '../test/renderScreen';
import { resetQueries } from '../test/resetQueries';
import { TODAY as D } from '../test/fixtures';
import { queryClient, getPendingSaveCount } from '../queries/queryClient';
import WorkoutSession from './WorkoutSession';

afterEach(resetQueries);

const ROUTE = { path: '/session/:templateId/:date', route: `/session/835/${D}` };
const SESSION = {
  id: 77, templateId: 835, date: D, completed: false, notes: {}, entries: [],
  workoutData: {
    name: 'Rehab Leg Workout',
    exercises: [{ name: 'Leg Extension', setType: 'straight', sets: [{ setNumber: 1, plannedReps: 10, suggestedWeight: 20 }, { setNumber: 2, plannedReps: 10, suggestedWeight: 20 }] }],
  },
};

// A server that answers the workout and records saves/completions in order.
// `state.down` makes every request fail like a dropped connection.
function fakeServer(state) {
  server.use(
    http.all('*', ({ request }) => {
      if (state.down) return HttpResponse.error();
      return undefined; // fall through to the handlers below
    }),
    http.get(`*/sessions/by-template/835/${D}`, () => HttpResponse.json(state.session ?? SESSION)),
    http.post('*/sessions', async ({ request }) => {
      const body = await request.json();
      state.log.push(`save reps=${body.entries.map((e) => e.reps).join(',')} done=${body.entries.map((e) => (e.isCompleted ? 1 : 0)).join(',')}`);
      return HttpResponse.json({ id: 77 }, { status: 201 });
    }),
    http.put('*/sessions/complete', async ({ request }) => {
      state.log.push(`complete ${(await request.json()).completed}`);
      return HttpResponse.json({ success: true });
    }),
    http.all('*', () => HttpResponse.json([])),
  );
}

function goOffline(state) { state.down = true; onlineManager.setOnline(false); }
function goOnline(state) { state.down = false; onlineManager.setOnline(true); }

async function openWorkout() {
  const view = renderScreen(<WorkoutSession />, ROUTE);
  fireEvent.click(await screen.findByText('Begin Workout'));
  // Follow-up gate (e.g. warm-up) has its own Begin Workout button.
  const again = screen.queryAllByText('Begin Workout');
  if (again.length > 1) fireEvent.click(again[again.length - 1]);
  await screen.findByText(/Mark Complete/);
  return view;
}

function logSet(n, reps) {
  fireEvent.change(screen.getByLabelText(`Set ${n} reps`), { target: { value: String(reps) } });
  fireEvent.click(screen.getAllByLabelText('Mark set complete')[0]);
}

describe('Workout session saving', () => {
  it('online: checking a set saves it', async () => {
    signIn();
    const state = { log: [] };
    fakeServer(state);
    await openWorkout();
    logSet(1, 12);
    await waitFor(() => expect(state.log).toContain('save reps=12,0 done=1,0'));
    expect(getPendingSaveCount(queryClient)).toBe(0);
  });

  it('offline: sets wait on the phone ("Not saved yet — will retry") and are sent in order on reconnect', async () => {
    signIn();
    const state = { log: [] };
    fakeServer(state);
    await openWorkout();
    goOffline(state);
    logSet(1, 12);
    expect(await screen.findByText('Not saved yet — will retry')).toBeInTheDocument();
    logSet(2, 10);
    await waitFor(() => expect(getPendingSaveCount(queryClient)).toBe(2));
    expect(state.log).toEqual([]);

    goOnline(state);
    await waitFor(() => expect(state.log).toEqual(['save reps=12,0 done=1,0', 'save reps=12,10 done=1,1']));
    await waitFor(() => expect(screen.queryByText('Not saved yet — will retry')).toBeNull());
  }, 15000);

  it('offline Mark Complete: shows complete, then sends the saves and the completion in order', async () => {
    signIn();
    const state = { log: [] };
    fakeServer(state);
    await openWorkout();
    goOffline(state);
    logSet(1, 12);
    fireEvent.click(await screen.findByText(/Mark Complete — 1\/2 Sets/));
    expect(await screen.findByText('Completed on this phone — will sync')).toBeInTheDocument();
    expect(state.log).toEqual([]);

    goOnline(state);
    await waitFor(() => expect(state.log.at(-1)).toBe('complete true'));
    expect(state.log.filter((l) => l.startsWith('save')).length).toBeGreaterThan(0);
    expect(state.log.indexOf('complete true')).toBe(state.log.length - 1);
  }, 15000);

  it('reopening a workout with unsent sets shows those sets, not the older server copy', async () => {
    signIn();
    const state = { log: [] };
    fakeServer(state);
    const first = await openWorkout();
    goOffline(state);
    logSet(1, 15);
    await waitFor(() => expect(getPendingSaveCount(queryClient)).toBe(1));

    // Leave and reopen, still offline. The typed-numbers backup is removed
    // so the sets can only come from the unsent save itself.
    first.unmount();
    localStorage.removeItem(`replab:session:835:${D}`);
    expect(localStorage.getItem(`replab:session:835:${D}`)).toBeNull();
    renderScreen(<WorkoutSession />, ROUTE);
    // Offline: the saved copy and the queued sets show without waiting on retries.
    const reps = await screen.findByLabelText('Set 1 reps', {}, { timeout: 2000 });
    expect(reps).toHaveValue(15);
  }, 15000);

  it('undoing a completion that has not synced takes it off the queue', async () => {
    signIn();
    const state = { log: [] };
    fakeServer(state);
    await openWorkout();
    goOffline(state);
    logSet(1, 12);
    fireEvent.click(await screen.findByText(/Mark Complete — 1\/2 Sets/));
    await screen.findByText('Completed on this phone — will sync');
    fireEvent.click(await screen.findByRole('button', { name: /Undo Completion/i }));
    await waitFor(() => expect(screen.queryByText('Completed on this phone — will sync')).toBeNull());

    goOnline(state);
    await waitFor(() => expect(getPendingSaveCount(queryClient)).toBe(0));
    expect(state.log.some((l) => l.startsWith('complete'))).toBe(false);
  }, 15000);

  // Like the Oct 5 bug: the server answers but rejects the save. That must be
  // shown, not quietly queued forever.
  it('a save the server rejects shows an error and is not queued', async () => {
    signIn();
    const state = { log: [] };
    fakeServer(state);
    server.use(http.post('*/sessions', () => HttpResponse.json({ error: 'Internal server error' }, { status: 500 })));
    await openWorkout();
    logSet(1, 12);
    fireEvent.click(await screen.findByText(/Mark Complete — 1\/2 Sets/));
    expect((await screen.findAllByText(/Couldn't save your workout/)).length).toBeGreaterThan(0);
    expect(getPendingSaveCount(queryClient)).toBe(0);
    expect(screen.queryByText('Completed on this phone — will sync')).toBeNull();
  }, 15000);

  it('a completion queued by the old version is moved onto the new queue and sent', async () => {
    signIn();
    const state = { log: [], session: { ...SESSION, entries: [{ exerciseName: 'Leg Extension', setNumber: 1, weight: 20, reps: 12, isCompleted: true }] } };
    fakeServer(state);
    localStorage.setItem(`wf-pending-complete-835-${D}`, String(Date.now()));
    renderScreen(<WorkoutSession />, ROUTE);
    await waitFor(() => expect(state.log.at(-1)).toBe('complete true'));
    expect(localStorage.getItem(`wf-pending-complete-835-${D}`)).toBeNull();
  }, 15000);
});
