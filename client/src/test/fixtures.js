// Fake API data for screen tests: one user-owned workout scheduled today.
import { http, HttpResponse } from './server';

const d = new Date();
export const TODAY = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const WORKOUT_NAME = 'Rehab Leg Workout';
export const programs = [{ id: 1, name: 'My Workouts', userId: 37 }];
export const templates = [{ id: 10, name: WORKOUT_NAME, programId: 1, userId: 37, exercises: [], isRest: false, sortOrder: 0 }];
export const schedule = [{ date: TODAY, templateId: 10, templateName: WORKOUT_NAME, isRest: false }];

// Handlers for a working server. Paths not listed answer [] and are
// recorded in `requests` (method + path) along with the listed ones.
export function onlineHandlers(requests = []) {
  const log = (request) => requests.push(`${request.method} ${new URL(request.url).pathname}`);
  return [
    http.get('*/programs', ({ request }) => { log(request); return HttpResponse.json(programs); }),
    http.get('*/templates', ({ request }) => { log(request); return HttpResponse.json(templates); }),
    http.get('*/schedule', ({ request }) => { log(request); return HttpResponse.json(schedule); }),
    http.all('*', ({ request }) => { log(request); return HttpResponse.json([]); }),
  ];
}

// Every request fails as if the connection dropped.
export function offlineHandlers() {
  return [http.all('*', () => HttpResponse.error())];
}
