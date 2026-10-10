// Calendar on TanStack Query (migration phase 3): loads live, falls back to
// the saved copy offline, and only errors when there's nothing saved.
import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { server } from '../test/server';
import { renderScreen, signIn } from '../test/renderScreen';
import { onlineHandlers, offlineHandlers, WORKOUT_NAME } from '../test/fixtures';
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
