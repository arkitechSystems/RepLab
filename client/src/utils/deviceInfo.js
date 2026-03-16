/**
 * Get device info string for signup tracking.
 * Uses Capacitor Device plugin for native apps (detailed model + OS),
 * falls back to User-Agent parsing on web.
 */
export async function getDeviceInfo() {
  try {
    const { Device } = await import('@capacitor/device');
    const info = await Device.getInfo();
    // info.platform: 'ios' | 'android' | 'web'
    if (info.platform !== 'web') {
      // Native app — rich device info
      const parts = [];
      if (info.model) parts.push(info.model); // e.g. "iPhone 15 Pro"
      if (info.operatingSystem && info.osVersion) parts.push(`${info.operatingSystem} ${info.osVersion}`); // e.g. "ios 18.2"
      if (info.manufacturer && !info.model?.toLowerCase().includes(info.manufacturer.toLowerCase())) {
        parts.unshift(info.manufacturer); // e.g. "Samsung"
      }
      return parts.join(' · ') || `${info.platform} device`;
    }
  } catch {
    // Capacitor not available — we're on web
  }
  // Web fallback — return null, let server parse User-Agent
  return null;
}
