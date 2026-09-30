import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Light tap for small confirmations (e.g. applauding a Community post).
// Native iOS/Android use the Capacitor Haptics plugin; the web falls back to
// the Vibration API, which Android browsers honor and iPhone Safari ignores.
// Never throws — a missing haptic must never break the tap that caused it.
export function lightTap() {
  try {
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      return;
    }
    navigator.vibrate?.(10);
  } catch {
    /* no-op */
  }
}
