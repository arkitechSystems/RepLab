// Workouts home on TanStack Query (migration phase 3): loads live, falls back
// to the saved copy offline (including copies saved by the pre-migration
// cache), and only errors when there's nothing saved.
import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { server } from '../test/server';
import { renderScreen, signIn } from '../test/renderScreen';
import { onlineHandlers, offlineHandlers, WORKOUT_NAME, programs, templates, schedule, TODAY } from '../test/fixtures';
import { queryClient, persister } from '../queries/queryClient';
import Workouts from './Workouts';

afterEach(async () => {
  queryClient.clear();
  await persister.removeClient();
});

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

function nextDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(y, m - 1, d + 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}
