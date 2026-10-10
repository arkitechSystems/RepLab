// How each kind of queued save is sent. A save restored from storage after an
// app restart carries only its mutationKey and variables, so the mutationFn
// (and what to refresh afterwards) must be registered here, by key, before
// the cache is restored.
//
// Every entry needs:
//   mutationKey  e.g. ['sessions', 'save']
//   mutationFn   (variables) => api(...) — one attempt, { autoRetry: false }
//   onSuccess    invalidate the queries the save changed
// and callers should pass scope: { id } so saves for the same thing (one
// workout day) go out strictly in order.
//
// Filled in as screens are converted (session saves land in phase 4).
export function registerMutationDefaults(client) { // eslint-disable-line no-unused-vars
}
