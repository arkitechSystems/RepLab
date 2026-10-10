import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { server, http, HttpResponse } from '../test/server';
import QueryProvider from '../queries/QueryProvider';
import { resetQueries } from '../test/resetQueries';
import { api } from '../api';
import { useExercises, setExerciseFavorite } from './useExercises';

const LIBRARY = [
  { id: 1, name: 'Squat', muscle: 'quads', tags: [], isFavorite: false },
  { id: 2, name: 'Bench Press', muscle: 'chest', tags: [], isFavorite: false },
];

function libraryHandlers(counter) {
  return [
    http.get('*/exercises', () => { counter.n++; return HttpResponse.json(LIBRARY); }),
    http.get('*/exercises/muscles', () => HttpResponse.json(['quads', 'chest'])),
  ];
}

// Two screens using the library at once (e.g. Library page + a picker).
function Screen({ label }) {
  const { exercises, loading } = useExercises();
  if (loading) return <div>{label}: loading</div>;
  const squat = exercises.find((e) => e.id === 1);
  return <div>{label}: {exercises.length} exercises, squat {squat?.isFavorite ? 'saved' : 'not saved'}</div>;
}

afterEach(resetQueries);

describe('useExercises', () => {
  it('screens share one load of the library', async () => {
    const counter = { n: 0 };
    server.use(...libraryHandlers(counter));
    render(<QueryProvider><Screen label="A" /><Screen label="B" /></QueryProvider>);
    expect(await screen.findByText('A: 2 exercises, squat not saved')).toBeInTheDocument();
    expect(screen.getByText('B: 2 exercises, squat not saved')).toBeInTheDocument();
    expect(counter.n).toBe(1);
  });

  it('a favorite shows on every screen at once, and rolls back if saving fails', async () => {
    const counter = { n: 0 };
    let fail = false;
    server.use(
      ...libraryHandlers(counter),
      http.put('*/exercises/1/favorite', () => (fail ? HttpResponse.json({ error: 'nope' }, { status: 500 }) : HttpResponse.json({ ok: true }))),
    );
    render(<QueryProvider><Screen label="A" /><Screen label="B" /></QueryProvider>);
    await screen.findByText('A: 2 exercises, squat not saved');

    await act(() => setExerciseFavorite(1, true));
    expect(await screen.findByText('A: 2 exercises, squat saved')).toBeInTheDocument();
    expect(await screen.findByText('B: 2 exercises, squat saved')).toBeInTheDocument();
    // Saving a favorite doesn't reload the whole library.
    expect(counter.n).toBe(1);

    fail = true;
    let failed = false;
    await act(async () => { await setExerciseFavorite(1, false).catch(() => { failed = true; }); });
    expect(failed).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText('A: 2 exercises, squat saved')).toBeInTheDocument();
  });

  it("a workout autosave doesn't reload the library; adding an exercise does", async () => {
    const counter = { n: 0 };
    server.use(
      ...libraryHandlers(counter),
      http.post('*/sessions', () => HttpResponse.json({ id: 1 })),
      http.post('*/exercises', () => HttpResponse.json({ id: 3 })),
    );
    render(<QueryProvider><Screen label="A" /></QueryProvider>);
    await screen.findByText('A: 2 exercises, squat not saved');

    await act(() => api('/sessions', { method: 'POST', body: '{}' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(counter.n).toBe(1);

    await act(() => api('/exercises', { method: 'POST', body: '{}' }));
    await waitFor(() => expect(counter.n).toBe(2));
  });
});
