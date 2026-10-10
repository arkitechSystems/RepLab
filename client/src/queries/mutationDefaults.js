// How each kind of queued save is sent. A save restored from storage after an
// app restart carries only its mutationKey and variables, so the mutationFn
// (and what to refresh afterwards) must be registered here, by key, before
// the cache is restored.
//
// Every entry needs:
//   mutationKey  e.g. ['sessions', 'save']
//   mutationFn   (variables) => api(...) — one attempt, { autoRetry: false }
//   onSuccess    anything to tidy up once the server has it
// and callers should pass scope: { id } so saves for the same thing (one
// workout day) go out strictly in order.
import { registerSessionMutations } from './sessionMutations';

export function registerMutationDefaults(client) {
  registerSessionMutations(client);
}
