// Renders a real app screen with the app's providers, signed in as a test
// user, for screen-level tests. The API is the MSW fake server.
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import QueryProvider from '../queries/QueryProvider';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { ConfirmProvider } from '../context/ConfirmContext';
import { TutorialProvider } from '../context/TutorialContext';
import { VideoPlayerProvider } from '../context/VideoPlayerContext';
import { setApiToken } from '../api';

export const TEST_USER = { id: 37, username: 'tester', firstName: 'Test', email: 'test@example.com', hasPassword: true };
// A JWT-shaped token whose payload carries the user id (api.js reads it).
export const TEST_TOKEN = `x.${btoa(JSON.stringify({ userId: TEST_USER.id }))}.y`;

export function signIn() {
  setApiToken(TEST_TOKEN);
  localStorage.setItem('replab_user', JSON.stringify(TEST_USER));
  // Skip first-run tutorials and prompts that would cover the screen.
  localStorage.setItem('replab_tutorial_completed', 'true');
  localStorage.setItem('wf-tutorial-done', 'true');
}

// Any other route: says so, with where the screen navigated to (and its
// location state) for tests to check.
function OtherPage() {
  const location = useLocation();
  return (
    <>
      <div>other page</div>
      <div data-testid="location">{location.pathname + location.search}</div>
      <div data-testid="location-state">{JSON.stringify(location.state ?? null)}</div>
    </>
  );
}

// route: a path, or { pathname, state } to open the screen with location state.
export function renderScreen(element, { path = '/', route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <QueryProvider>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <TutorialProvider>
                <VideoPlayerProvider>
                  <Routes>
                    <Route path={path} element={element} />
                    <Route path="*" element={<OtherPage />} />
                  </Routes>
                </VideoPlayerProvider>
              </TutorialProvider>
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </QueryProvider>
    </MemoryRouter>,
  );
}
