// Tells TanStack Query whether the device is online: queries wait and saves
// pause while offline, and both resume on reconnect. On iOS/Android the
// Capacitor Network plugin is the source (navigator.onLine is unreliable in
// the WebView); on the web, TanStack's default browser online/offline events.
import { onlineManager } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

export function setupOnlineManager() {
  if (!Capacitor.isNativePlatform()) return;
  onlineManager.setEventListener((setOnline) => {
    let handle = null;
    let stopped = false;
    Network.getStatus().then((s) => setOnline(s.connected)).catch(() => {});
    Network.addListener('networkStatusChange', (s) => setOnline(s.connected))
      .then((h) => { if (stopped) h.remove(); else handle = h; })
      .catch(() => {});
    return () => { stopped = true; handle?.remove(); };
  });
}
