// Query keys and the shared fetcher. A key is the API path split into its
// segments, plus the query string as an object:
//   '/schedule?from=a&to=b'          → ['schedule', { from: 'a', to: 'b' }]
//   '/sessions/by-template/835/2026-10-07' → ['sessions', 'by-template', '835', '2026-10-07']
// so related data invalidates together: ['schedule'] covers every schedule
// range, ['sessions'] every session view, ['pbs'] every PR view.
import { api } from '../api';

export function pathKey(path) {
  const [pathname, search = ''] = String(path).split('?');
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const params = Object.fromEntries(new URLSearchParams(search));
  return Object.keys(params).length ? [...segments, params] : segments;
}

// Named keys for the common paths (same shape as pathKey of the path).
export const keys = {
  programs: () => pathKey('/programs'),
  templates: () => pathKey('/templates'),
  sessions: () => pathKey('/sessions'),
  sessionsCompleted: () => pathKey('/sessions/completed'),
  sessionDay: (templateId, date) => pathKey(`/sessions/by-template/${templateId}/${date}`),
  lastEntries: (templateId) => pathKey(`/sessions/last-entries/${templateId}`),
  schedule: (from, to) => pathKey(`/schedule?from=${from}&to=${to}`),
  pbs: (templateId) => pathKey(`/pbs?templateId=${templateId}`),
  pbStats: () => pathKey('/pbs/stats'),
  pbsByBodyPart: () => pathKey('/pbs/by-body-part'),
  pbsAllByMuscle: () => pathKey('/pbs/all-by-muscle'),
  metrics: () => pathKey('/metrics'),
  exercises: () => pathKey('/exercises'),
  exerciseMuscles: () => pathKey('/exercises/muscles'),
  sharingPending: () => pathKey('/sharing/pending'),
  sharingAccepted: () => pathKey('/sharing/accepted'),
};

// queryFn for a GET: one attempt through api() (TanStack does the retrying),
// cancelled when the query is.
export function fetchPath(path) {
  return ({ signal }) => api(path, { signal, autoRetry: false });
}
