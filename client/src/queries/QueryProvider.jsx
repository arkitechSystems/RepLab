// Wraps the app in the TanStack Query client with the on-device saved cache.
// At start-up the saved cache is restored from IndexedDB; then any saves that
// were still queued when the app closed are sent (in order, per scope).
import { lazy, Suspense, useState } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, persistOptions } from './queryClient';
import { registerMutationDefaults } from './mutationDefaults';
import { setupOnlineManager } from './network';
import { beginCacheRestore, markCacheRestored, importLegacyCache } from './data';

// Queued saves restored from storage only know their mutationKey, so the code
// that sends each kind must be registered before the restore.
registerMutationDefaults(queryClient);
setupOnlineManager();

const Devtools = import.meta.env.DEV
  ? lazy(() => import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })))
  : null;

export default function QueryProvider({ children }) {
  // Before any screen asks for a saved copy (savedPath waits on this).
  useState(beginCacheRestore);
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
      onSuccess={() => { importLegacyCache(); markCacheRestored(); queryClient.resumePausedMutations(); }}
      onError={() => { importLegacyCache(); markCacheRestored(); }}
    >
      {children}
      {Devtools && (
        <Suspense fallback={null}>
          <Devtools initialIsOpen={false} buttonPosition="bottom-left" />
        </Suspense>
      )}
    </PersistQueryClientProvider>
  );
}
