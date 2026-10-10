// History, Progress and Session detail on TanStack Query (migration phase 2):
// live data, the saved copy offline (new — these used to just fail), and
// an error with a working "Tap to retry" when there's nothing saved.
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { server, http, HttpResponse } from '../test/server';
import { renderScreen, signIn } from '../test/renderScreen';
import { offlineHandlers, WORKOUT_NAME, TODAY } from '../test/fixtures';
import { resetQueries } from '../test/resetQueries';
import History from './History';
import Progress from './Progress';
import SessionDetail from './SessionDetail';

afterEach(resetQueries);

const SESSIONS = [{ id: 501, templateId: 10, templateName: WORKOUT_NAME, date: TODAY, completed: true, entries: [] }];
const sessionsOnline = () => http.get('*/sessions', () => HttpResponse.json(SESSIONS));
const SESSION = { id: 501, templateId: 10, templateName: WORKOUT_NAME, date: TODAY, entries: [], workoutData: { name: WORKOUT_NAME, exercises: [] } };

describe('History', () => {
  it('shows past workouts', async () => {
    signIn();
    server.use(sessionsOnline());
    renderScreen(<History />);
    expect((await screen.findAllByText(WORKOUT_NAME)).length).toBeGreaterThan(0);
  });

  it('offline, shows the saved copy from an earlier visit', async () => {
    signIn();
    server.use(sessionsOnline());
    const first = renderScreen(<History />);
    await screen.findAllByText(WORKOUT_NAME);
    first.unmount();
    server.use(...offlineHandlers());
    renderScreen(<History />);
    expect((await screen.findAllByText(WORKOUT_NAME)).length).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 3500));
    expect(screen.queryByText('Failed to load session history')).toBeNull();
  }, 15000);

  it('with nothing saved, shows the error, and Tap to retry loads once back online', async () => {
    signIn();
    server.use(...offlineHandlers());
    renderScreen(<History />);
    expect(await screen.findByText('Failed to load session history', {}, { timeout: 8000 })).toBeInTheDocument();
    server.use(sessionsOnline());
    fireEvent.click(screen.getByText('Tap to retry'));
    expect((await screen.findAllByText(WORKOUT_NAME)).length).toBeGreaterThan(0);
  }, 15000);
});

describe('Progress', () => {
  it('with nothing saved, shows the error, and Tap to retry loads once back online', async () => {
    signIn();
    server.use(...offlineHandlers());
    renderScreen(<Progress />);
    expect(await screen.findByText('Failed to load progress data', {}, { timeout: 8000 })).toBeInTheDocument();
    server.use(http.get('*/sessions/progress-overload', () => HttpResponse.json([])));
    fireEvent.click(screen.getByText('Tap to retry'));
    expect(await screen.findByText('Nothing logged yet')).toBeInTheDocument();
  }, 15000);
});

describe('Session detail', () => {
  it('shows the session', async () => {
    signIn();
    server.use(http.get('*/sessions/501', () => HttpResponse.json(SESSION)), http.all('*', () => HttpResponse.json([])));
    renderScreen(<SessionDetail />, { path: '/sessions/:id', route: '/sessions/501' });
    expect((await screen.findAllByText(WORKOUT_NAME)).length).toBeGreaterThan(0);
  });

  it('with nothing saved, shows the error', async () => {
    signIn();
    server.use(...offlineHandlers());
    renderScreen(<SessionDetail />, { path: '/sessions/:id', route: '/sessions/501' });
    expect(await screen.findByText('Failed to load session', {}, { timeout: 8000 })).toBeInTheDocument();
  }, 15000);
});
