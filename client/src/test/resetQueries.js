// Between screen tests: unmount, then wipe the app's query cache in memory and
// on the (fake) device, so nothing carries over to the next test.
import { cleanup } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { queryClient, persister } from '../queries/queryClient';

export async function resetQueries() {
  cleanup();
  onlineManager.setOnline(true);
  await new Promise((r) => setTimeout(r, 20)); // let any last cache write land
  queryClient.getMutationCache().clear();
  queryClient.clear();
  await persister.removeClient();
}
