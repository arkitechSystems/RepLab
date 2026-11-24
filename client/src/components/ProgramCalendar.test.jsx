// Program builder (sample calendar): the Calendar page's weekly cards and
// monthly grid drawn as Week N / Day 1–7, and its edits saved with one
// PUT /programs/:id/layout.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { server, http, HttpResponse } from '../test/server';
import { renderScreen, signIn } from '../test/renderScreen';
import { resetQueries } from '../test/resetQueries';
import ProgramCalendar from './ProgramCalendar';
import Workouts from '../pages/Workouts';

afterEach(resetQueries);

const ex = (name) => ({ name, setType: 'straight', sets: [{ plannedReps: 8, suggestedWeight: 135 }] });
const tmpl = (id, name, sortOrder, extra = {}) => ({
  id, name, programId: 2, userId: 37, isRest: false, sortOrder, exercises: [ex('Bench Press')], ...extra,
});

// 8 days = Week 1 full + Week 2 Day 1 (the rest of Week 2 is empty).
const programTemplates = [
  tmpl(21, 'Push', 0), tmpl(22, 'Pull', 1), tmpl(23, 'Rest', 2, { isRest: true, exercises: [] }), tmpl(24, 'Legs', 3),
  tmpl(25, 'Rest', 4, { isRest: true, exercises: [] }), tmpl(26, 'Push', 5), tmpl(27, 'Rest', 6, { isRest: true, exercises: [] }),
  tmpl(28, 'Pull', 7),
];
const program = { id: 2, name: 'Summer Cut', userId: 37, programDetails: null, templates: programTemplates };
const myWorkout = { id: 90, name: 'Arm Blaster', programId: 1, userId: 37, isRest: false, sortOrder: 0, exercises: [ex('Curl')] };
const programs = [{ id: 1, name: 'My Workouts', userId: 37 }, { id: 2, name: 'Summer Cut', userId: 37 }];

function renderCalendar(props = {}) {
  signIn();
  return renderScreen(
    <ProgramCalendar program={program} allTemplates={[...programTemplates, myWorkout]} programs={programs} editable view="week" {...props} />,
  );
}

function captureLayout() {
  const bodies = [];
  server.use(http.put('*/programs/2/layout', async ({ request }) => {
    const body = await request.json();
    bodies.push(body);
    return HttpResponse.json({ programId: 2, templateIds: [], startWeekday: body.startWeekday ?? null });
  }));
  return bodies;
}

describe('ProgramCalendar week view', () => {
  it('shows Week 1 of 2 as Day 1–7 cards and pages to Week 2', () => {
    renderCalendar();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('WEEK 1OF 2');
    expect(screen.getAllByText('Push')).toHaveLength(2);
    expect(screen.getAllByText('Legs').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rest Day').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Previous week')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Next week'));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('WEEK 2OF 2');
    expect(screen.getByText('Pull')).toBeInTheDocument();
    expect(screen.getAllByText('Tap to add a workout')).toHaveLength(6);
  });

  it('adds a copy of a workout from this program to an empty day', async () => {
    const bodies = captureLayout();
    const onSaved = vi.fn().mockResolvedValue(undefined);
    renderCalendar({ initialWeek: 1, onSaved });
    fireEvent.click(screen.getAllByText('Tap to add a workout')[0]);
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('Week 2 · Day 2')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByText('Add a workout from this program'));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Legs'));
    await waitFor(() => expect(bodies).toHaveLength(1));
    const slots = bodies[0].slots;
    expect(slots).toHaveLength(14);
    expect(slots[0]).toEqual({ templateId: 21 });
    expect(slots[7]).toEqual({ templateId: 28 });
    expect(slots[8]).toEqual({ copyOf: 24 });
    expect(slots.slice(9)).toEqual(Array(5).fill({ rest: true }));
    expect(bodies[0].startWeekday).toBeUndefined();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('copies one of My Workouts, and the filled-day menu offers View / Edit / Swap / Move / Remove', async () => {
    const bodies = captureLayout();
    renderCalendar({ initialWeek: 1 });
    fireEvent.click(screen.getAllByText('Tap to add a workout')[0]);
    fireEvent.click(screen.getByText('Copy from My Workouts'));
    fireEvent.click(screen.getByText('Arm Blaster'));
    await waitFor(() => expect(bodies[0]?.slots[8]).toEqual({ copyOf: 90 }));

    fireEvent.click(screen.getByText('Pull'));
    const sheet = screen.getByRole('dialog');
    for (const label of ['View', 'Edit', 'Swap', 'Move to another day', 'Remove']) {
      expect(within(sheet).getByText(label)).toBeInTheDocument();
    }
    fireEvent.click(within(sheet).getByText('View'));
    expect(within(screen.getByRole('dialog')).getByText('Bench Press')).toBeInTheDocument();
  });

  it('moves a workout by swapping days', async () => {
    const bodies = captureLayout();
    renderCalendar();
    fireEvent.click(screen.getByText('Legs'));
    fireEvent.click(screen.getByText('Move to another day'));
    fireEvent.click(screen.getByLabelText('Move to Week 1 · Day 1'));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0].slots.slice(0, 4)).toEqual([{ templateId: 24 }, { templateId: 22 }, { templateId: 23 }, { templateId: 21 }]);
  });

  it('a start weekday labels the days and is saved with the layout', async () => {
    const bodies = captureLayout();
    renderCalendar();
    fireEvent.change(screen.getByLabelText('Day 1 is'), { target: { value: '1' } });
    await waitFor(() => expect(bodies[0]?.startWeekday).toBe(1));
    renderCalendar({ program: { ...program, programDetails: { startWeekday: 1 } } });
    expect(screen.getAllByText('Mon').length).toBeGreaterThan(0);
  });

  it('offline, says so instead of saving', async () => {
    const bodies = captureLayout();
    const { onlineManager } = await import('@tanstack/react-query');
    onlineManager.setOnline(false);
    try {
      renderCalendar({ initialWeek: 1 });
      fireEvent.click(screen.getAllByText('Tap to add a workout')[0]);
      fireEvent.click(screen.getByText('Mark as rest day'));
      expect(await screen.findByText(/offline/i)).toBeInTheDocument();
      expect(bodies).toHaveLength(0);
    } finally {
      onlineManager.setOnline(true);
    }
  });
});

describe('ProgramCalendar month view', () => {
  it('draws up to 4 weeks per page with the Calendar month cells and legend', () => {
    renderCalendar({ view: 'month' });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('WEEKS 1–2OF 2');
    expect(screen.getByText('D1')).toBeInTheDocument();
    expect(screen.getByLabelText('Week 1 · Day 4: Legs')).toBeInTheDocument();
    expect(screen.getByLabelText('Week 2 · Day 3: Empty')).toBeInTheDocument();
    expect(screen.getByText('Legend')).toBeInTheDocument();
  });
});

describe('library programs', () => {
  it('are view-only: a workout opens its exercises, empty days do nothing, no week controls', () => {
    renderCalendar({ editable: false, program: { ...program, userId: null } });
    expect(screen.queryByText('+ Add Week')).toBeNull();
    expect(screen.queryByLabelText('Day 1 is')).toBeNull();
    fireEvent.click(screen.getByText('Legs'));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('Bench Press')).toBeInTheDocument();
    expect(within(sheet).queryByText('Remove')).toBeNull();
  });
});

describe('Workouts program page', () => {
  it('opens a program straight onto its sample calendar (after Create Program)', async () => {
    signIn();
    server.use(
      http.get('*/programs', () => HttpResponse.json(programs)),
      http.get('*/templates', () => HttpResponse.json(programTemplates)),
      http.all('*', () => HttpResponse.json([])),
    );
    renderScreen(<Workouts />, {
      route: { pathname: '/', state: { openSection: 'my', openProgram: 2, programView: 'week', programWeek: 0 } },
    });
    expect(await screen.findByText('Sample Calendar')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Program view' })).toBeInTheDocument();
    expect(screen.getAllByText('Legs').length).toBeGreaterThan(0);
    // List shows the existing workout cards again.
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    await waitFor(() => expect(screen.queryByText('Sample Calendar')).toBeNull());
  });
});
