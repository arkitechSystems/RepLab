// Query keys and the shared fetcher. Keys mirror the API path so related
// data invalidates together: invalidating ['schedule'] refreshes every
// schedule range, ['pbs'] every PR view, and so on.
import { api } from '../api';

export const keys = {
  programs: () => ['programs'],
  templates: () => ['templates'],
  sessions: () => ['sessions'],
  sessionsCompleted: () => ['sessions', 'completed'],
  sessionDay: (templateId, date) => ['sessions', 'by-template', Number(templateId), date],
  lastEntries: (templateId) => ['sessions', 'last-entries', Number(templateId)],
  schedule: (from, to) => ['schedule', { from, to }],
  scheduleToday: (date) => ['schedule', 'today', date],
  scheduleMissed: (today) => ['schedule', 'missed', today],
  pbs: (templateId) => ['pbs', { templateId: Number(templateId) }],
  pbStats: () => ['pbs', 'stats'],
  pbsByBodyPart: () => ['pbs', 'by-body-part'],
  pbsAllByMuscle: () => ['pbs', 'all-by-muscle'],
  metrics: () => ['metrics'],
  exercises: () => ['exercises'],
  exerciseMuscles: () => ['exercises', 'muscles'],
  sharingPending: () => ['sharing', 'pending'],
  sharingAccepted: () => ['sharing', 'accepted'],
};

// queryFn for a GET: one attempt through api() (TanStack does the retrying),
// cancelled when the query is.
export function fetchPath(path) {
  return ({ signal }) => api(path, { signal, autoRetry: false });
}
