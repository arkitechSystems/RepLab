// Workouts home on TanStack Query (migration phase 3): loads live, falls back
// to the saved copy offline (including copies saved by the pre-migration
// cache), and only errors when there's nothing saved.
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { server, http, HttpResponse } from '../test/server';
import { renderScreen, signIn } from '../test/renderScreen';
import { onlineHandlers, offlineHandlers, WORKOUT_NAME, programs, templates, schedule, TODAY } from '../test/fixtures';
import { resetQueries } from '../test/resetQueries';
import Workouts from './Workouts';
import EditWorkout from './EditWorkout';

afterEach(resetQueries);

describe('Workouts home', () => {
  it("loads live and shows today's workout, asking for each list once", async () => {
    signIn();
    const requests = [];
    server.use(...onlineHandlers(requests));
    renderScreen(<Workouts />);
    expect(await screen.findAllByText(WORKOUT_NAME)).not.toHaveLength(0);
    expect(screen.queryByText('Failed to load workouts')).toBeNull();
    expect(requests.filter((r) => r === 'GET /programs')).toHaveLength(1);
    expect(requests.filter((r) => r === 'GET /templates')).toHaveLength(1);
  });

  it('offline, shows the saved copy from an earlier visit instead of an error', async () => {
    signIn();
    server.use(...onlineHandlers());
    const first = renderScreen(<Workouts />);
    await screen.findAllByText(WORKOUT_NAME);
    first.unmount();

    server.use(...offlineHandlers());
    renderScreen(<Workouts />);
    expect(await screen.findAllByText(WORKOUT_NAME)).not.toHaveLength(0);
    // Give the live load time to fail (2 retries) — the saved copy stays.
    await new Promise((r) => setTimeout(r, 3500));
    expect(screen.getAllByText(WORKOUT_NAME)).not.toHaveLength(0);
    expect(screen.queryByText('Failed to load workouts')).toBeNull();
  }, 15000);

  it('offline right after the update, shows saved copies made by the old version', async () => {
    signIn();
    const legacy = (path, data) => localStorage.setItem(`rl_cache_v1:37:${path}`, JSON.stringify({ at: Date.now() - 60000, data }));
    legacy('/programs', programs);
    legacy('/templates', templates);
    legacy('/sessions', []);
    legacy(`/schedule?from=${TODAY}&to=${nextDay(TODAY)}`, schedule);
    server.use(...offlineHandlers());
    renderScreen(<Workouts />);
    expect(await screen.findAllByText(WORKOUT_NAME)).not.toHaveLength(0);
  }, 15000);

  it('offline with nothing saved, shows the load error', async () => {
    signIn();
    server.use(...offlineHandlers());
    renderScreen(<Workouts />);
    await waitFor(() => expect(screen.getByText('Failed to load workouts')).toBeInTheDocument(), { timeout: 8000 });
  }, 15000);
});

// The My Workouts page (Workouts → My Workouts): month groups, Move, Edit.
describe('My Workouts page', () => {
  const myPrograms = [
    { id: 1, name: 'My Workouts', userId: 37 },
    { id: 2, name: 'Push Pull Legs', userId: 37, sortOrder: 1 },
  ];
  const ex = [{ name: 'Squat', sets: [{ plannedReps: 5, suggestedWeight: 100 }] }];
  const myTemplates = [
    { id: 21, name: 'Undated Workout', programId: 1, userId: 37, exercises: ex, isRest: false, sortOrder: 0, createdAt: null },
    { id: 22, name: 'October Early', programId: 1, userId: 37, exercises: ex, isRest: false, sortOrder: 1, createdAt: '2026-10-03T12:00:00Z' },
    { id: 23, name: 'October Late', programId: 1, userId: 37, exercises: ex, isRest: false, sortOrder: 2, createdAt: '2026-10-28T12:00:00Z' },
    { id: 24, name: 'November Newest', programId: 1, userId: 37, exercises: ex, isRest: false, sortOrder: 3, createdAt: '2026-11-20T12:00:00Z' },
    { id: 30, name: 'Push', programId: 2, userId: 37, exercises: ex, isRest: false, sortOrder: 0, createdAt: '2026-09-01T12:00:00Z' },
  ];
  function handlers(requests = []) {
    return [
      http.get('*/programs', () => HttpResponse.json(myPrograms)),
      http.get('*/templates', () => HttpResponse.json(myTemplates)),
      http.put('*/templates/:id/program', async ({ request, params }) => {
        requests.push({ id: Number(params.id), body: await request.json() });
        return HttpResponse.json({ id: Number(params.id), programId: 2, programName: 'Push Pull Legs', slotIndex: 8, week: 2, day: 2 });
      }),
      http.all('*', () => HttpResponse.json([])),
    ];
  }
  const openMyWorkouts = () => renderScreen(<Workouts />, { route: { pathname: '/', state: { openSection: 'my' } } });
  const cardOf = async (name) => (await screen.findByText(name)).closest('[data-testid="my-workout-card"]');

  it('groups workouts by month created, newest first, undated ones last under EARLIER', async () => {
    signIn();
    server.use(...handlers());
    openMyWorkouts();
    await screen.findByText('November Newest');
    const groups = screen.getAllByTestId('workout-month-group');
    expect(groups.map((g) => g.querySelector('h4').textContent)).toEqual(['NOVEMBER 2026', 'OCTOBER 2026', 'EARLIER']);
    expect(within(groups[1]).getAllByTestId('my-workout-card').map((c) => c.textContent))
      .toEqual([expect.stringContaining('October Late'), expect.stringContaining('October Early')]);
    expect(within(groups[2]).getByText('Undated Workout')).toBeInTheDocument();
    // Workouts in other programs aren't in the list.
    expect(screen.getAllByTestId('my-workout-card')).toHaveLength(4);
  });

  it('Move puts the workout in the program and says where it landed', async () => {
    signIn();
    const requests = [];
    server.use(...handlers(requests));
    openMyWorkouts();
    fireEvent.click(within(await cardOf('November Newest')).getByRole('button', { name: 'Move' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Push Pull Legs/ }));
    expect(await screen.findByText('Moved to Push Pull Legs — Week 2, Day 2.')).toBeInTheDocument();
    expect(requests).toEqual([{ id: 24, body: { programId: 2 } }]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Move with no other programs: Create a Program makes one and moves the workout into it', async () => {
    signIn();
    const moves = [];
    const created = [];
    server.use(
      http.get('*/programs', () => HttpResponse.json([myPrograms[0]])),
      http.get('*/templates', () => HttpResponse.json(myTemplates.filter((t) => t.programId === 1))),
      http.post('*/programs', async ({ request }) => {
        created.push(await request.json());
        return HttpResponse.json({ id: 5, userId: 37, name: 'Arm Plan', description: '' }, { status: 201 });
      }),
      http.put('*/templates/:id/program', async ({ request, params }) => {
        moves.push({ id: Number(params.id), body: await request.json() });
        return HttpResponse.json({ id: Number(params.id), programId: 5, programName: 'Arm Plan', slotIndex: 0, week: 1, day: 1 });
      }),
      http.all('*', () => HttpResponse.json([])),
    );
    openMyWorkouts();
    fireEvent.click(within(await cardOf('October Late')).getByRole('button', { name: 'Move' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create a Program' }));
    fireEvent.change(screen.getByLabelText('New program name'), { target: { value: 'Arm Plan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create & Move' }));
    expect(await screen.findByText('Moved to Arm Plan — Week 1, Day 1.')).toBeInTheDocument();
    expect(created).toEqual([{ name: 'Arm Plan' }]);
    expect(moves).toEqual([{ id: 23, body: { programId: 5 } }]);
  });

  it('the Edit button opens Edit Workout marked as coming from My Workouts', async () => {
    signIn();
    server.use(...handlers());
    openMyWorkouts();
    fireEvent.click(within(await cardOf('October Early')).getByRole('button', { name: 'Edit October Early' }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/clientworkouts/edit/22?from=my');
  });

  it('Edit Workout opened from My Workouts goes back there after saving', async () => {
    signIn();
    const saves = [];
    server.use(
      http.get('*/templates', () => HttpResponse.json(myTemplates)),
      http.put('*/templates/:id', async ({ request, params }) => {
        saves.push({ id: Number(params.id), body: await request.json() });
        return HttpResponse.json({ id: Number(params.id) });
      }),
      http.all('*', () => HttpResponse.json([])),
    );
    renderScreen(<EditWorkout />, { path: '/clientworkouts/edit/:id', route: '/clientworkouts/edit/22?from=my' });
    expect(await screen.findByRole('button', { name: /Back to My Workouts/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByTestId('location')).toHaveTextContent(/^\/app$/);
    expect(screen.getByTestId('location-state')).toHaveTextContent('{"openSection":"my"}');
    expect(saves[0].id).toBe(22);
  });
});

function nextDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(y, m - 1, d + 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}
