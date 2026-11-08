import { useEffect, useRef, useState } from 'react';
import { Device } from '../types';
import { isDeviceStale } from './deviceStatus';

export function useOfflineAlerts(devices: Device[], enabled: boolean) {
  const [, forceTick] = useState(0);
  const previouslyStale = useRef<Set<string>>(new Set());

  // Re-evaluate staleness every 15s so the dashboard reflects reality without
  // needing a page refresh.
  useEffect(() => {
    const interval = setInterval(() => forceTick(t => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  const now = Date.now();
  const staleDevices = devices.filter(d => isDeviceStale(d, now));

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const currentStaleIds = new Set(staleDevices.map(d => d.id));
    for (const device of staleDevices) {
      if (!previouslyStale.current.has(device.id)) {
        try {
          new Notification('Display went offline', {
            body: `${device.name} hasn't checked in — it may be off, unplugged, or lost connection.`,
            tag: `device-offline-${device.id}`,
          });
        } catch {
          // Notification API can throw in some contexts (e.g. insecure origin); ignore.
        }
      }
    }
    previouslyStale.current = currentStaleIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staleDevices.map(d => d.id).join(','), enabled]);

  return { staleDevices };
}

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationsGranted() {
  return notificationsSupported() && Notification.permission === 'granted';
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}
