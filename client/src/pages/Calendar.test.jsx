// Calendar on TanStack Query (migration phase 3): loads live, falls back to
// the saved copy offline, and only errors when there's nothing saved.
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { server, http, HttpResponse } from '../test/server';
import { renderScreen, signIn } from '../test/renderScreen';
import { onlineHandlers, offlineHandlers, WORKOUT_NAME, TODAY } from '../test/fixtures';
import { queryClient, getPendingSaveCount } from '../queries/queryClient';
import { resetQueries } from '../test/resetQueries';
import Calendar from './Calendar';

afterEach(resetQueries);

describe('Calendar', () => {
  it("loads live and shows today's workout", async () => {
    signIn();
    const requests = [];
    server.use(...onlineHandlers(requests));
    renderScreen(<Calendar />);
    expect(await screen.findByText(WORKOUT_NAME)).toBeInTheDocument();
    expect(screen.queryByText('Failed to load calendar data')).toBeNull();
    expect(requests.filter((r) => r === 'GET /templates')).toHaveLength(1);
  });

  it('offline, shows the saved copy from an earlier visit instead of an error', async () => {
    signIn();
    server.use(...onlineHandlers());
    const first = renderScreen(<Calendar />);
    await screen.findByText(WORKOUT_NAME);
    first.unmount();

    server.use(...offlineHandlers());
    renderScreen(<Calendar />);
    expect(await screen.findByText(WORKOUT_NAME)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 3500));
    expect(screen.getByText(WORKOUT_NAME)).toBeInTheDocument();
    expect(screen.queryByText('Failed to load calendar data')).toBeNull();
  }, 15000);

  it('offline with nothing saved, shows the load error', async () => {
    signIn();
    server.use(...offlineHandlers());
    renderScreen(<Calendar />);
    await waitFor(() => expect(screen.getByText('Failed to load calendar data')).toBeInTheDocument(), { timeout: 8000 });
  }, 15000);
});

// Phase 5 (decision 10): calendar edits made offline show right away, survive
// leaving the screen, and are sent on reconnect.
describe('Calendar edits offline', () => {
  it('clearing a day offline shows at once, stays cleared on reopen, and is sent on reconnect', async () => {
    signIn();
    const state = { down: false, sent: [] };
    server.use(
      http.all('*', () => (state.down ? HttpResponse.error() : undefined)),
      http.put('*/schedule', async ({ request }) => { state.sent.push(await request.json()); return HttpResponse.json({ success: true }); }),
      ...onlineHandlers(),
    );
    const first = renderScreen(<Calendar />);
    await screen.findByText(WORKOUT_NAME);

    state.down = true;
    onlineManager.setOnline(false);
    fireEvent.click(screen.getByLabelText(`Edit ${format(new Date(), 'EEEE, MMM d')}`));
    fireEvent.click(await screen.findByText('Clear — No Workout'));
    await waitFor(() => expect(screen.queryByText(WORKOUT_NAME)).toBeNull());
    expect(getPendingSaveCount(queryClient)).toBe(1);
    expect(state.sent).toEqual([]);

    first.unmount();
    renderScreen(<Calendar />);
    expect(await screen.findByText('No schedule set up yet')).toBeInTheDocument();
    expect(screen.queryByText(WORKOUT_NAME)).toBeNull();

    state.down = false;
    onlineManager.setOnline(true);
    await waitFor(() => expect(state.sent).toEqual([{ schedule: [{ date: TODAY, templateId: null }] }]));
    await waitFor(() => expect(getPendingSaveCount(queryClient)).toBe(0));
  }, 20000);

  it('starting an empty workout needs the server, so offline it says so instead of failing halfway', async () => {
    signIn();
    const sent = [];
    server.use(
      http.post('*/sessions/start-empty', () => { sent.push('start-empty'); return HttpResponse.json({ templateId: 99 }); }),
      ...onlineHandlers(),
    );
    renderScreen(<Calendar />);
    await screen.findByText(WORKOUT_NAME);
    onlineManager.setOnline(false);
    // A day with no workout (next week, so it's always a different day).
    fireEvent.click(screen.getByLabelText('Next'));
    fireEvent.click(await screen.findByLabelText(`Edit ${format(addDays(new Date(), 7), 'EEEE, MMM d')}`));
    fireEvent.click(await screen.findByText('Start Empty Workout'));
    fireEvent.click(await screen.findByText('Confirm'));
    expect((await screen.findAllByText("You're offline — try again when connected.")).length).toBeGreaterThan(0);
    expect(sent).toEqual([]);
    expect(getPendingSaveCount(queryClient)).toBe(0);
  });
});
