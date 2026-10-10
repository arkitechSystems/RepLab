// Bottom-nav play button on TanStack Query (migration phase 2): shown when
// today has an unfinished workout, re-checked on every route change, keeps
// its last answer when a check fails, and never drives the connection banner.
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { server, http, HttpResponse } from '../test/server';
import { signIn } from '../test/renderScreen';
import { resetQueries } from '../test/resetQueries';
import QueryProvider from '../queries/QueryProvider';
import { getConnectionState } from '../api';
import BottomNav from './BottomNav';

afterEach(resetQueries);

function GoTo({ to }) {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(to)}>go {to}</button>;
}

function renderNav() {
  return render(
    <MemoryRouter initialEntries={['/app']}>
      <QueryProvider>
        <GoTo to="/calendar" />
        <GoTo to="/history" />
        <BottomNav />
      </QueryProvider>
    </MemoryRouter>,
  );
}

const sealShown = (container) => !container.querySelector('.nv-seal').classList.contains('nv-seal-hidden');

describe('BottomNav play button', () => {
  it('appears when today has an unfinished workout and re-checks on each route change', async () => {
    signIn();
    let checks = 0;
    let show = true;
    server.use(http.get('*/schedule/today', () => { checks++; return HttpResponse.json({ show }); }));
    const { container } = renderNav();
    await waitFor(() => expect(sealShown(container)).toBe(true));
    expect(checks).toBe(1);

    show = false; // e.g. the workout was just marked complete
    fireEvent.click(screen.getByText('go /calendar'));
    await waitFor(() => expect(sealShown(container)).toBe(false));
    expect(checks).toBe(2);
  });

  it('keeps the last answer when a check fails, without touching the connection banner', async () => {
    signIn();
    let fail = false;
    server.use(http.get('*/schedule/today', () => (fail ? HttpResponse.error() : HttpResponse.json({ show: true }))));
    const { container } = renderNav();
    await waitFor(() => expect(sealShown(container)).toBe(true));

    fail = true;
    fireEvent.click(screen.getByText('go /history'));
    await new Promise((r) => setTimeout(r, 100));
    expect(sealShown(container)).toBe(true);
    expect(getConnectionState()).toBe('ok');
  });
});
