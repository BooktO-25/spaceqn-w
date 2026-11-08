import { Device } from '../types';

/** Heartbeats are written every 30s (see PlayerView). Give 3 missed beats of
 * grace before calling a device offline, to absorb normal network jitter. */
export const OFFLINE_THRESHOLD_MS = 90 * 1000;

export function isDeviceStale(device: Device, now: number = Date.now()): boolean {
  if (device.status === 'PAIRING') return false;
  const lastSeen = new Date(device.lastSeenAt).getTime();
  if (Number.isNaN(lastSeen)) return true;
  return now - lastSeen > OFFLINE_THRESHOLD_MS;
}

/** The device's real, live status — ignores the possibly-stale stored
 * `status` field for the ONLINE/OFFLINE distinction (PAIRING/SYNCING pass through). */
export function effectiveStatus(device: Device, now: number = Date.now()): Device['status'] {
  if (device.status === 'PAIRING') return 'PAIRING';
  // SYNCING is a transient command state. If the device has not checked in
  // within the normal stale window, it is genuinely offline and should not
  // remain stuck showing SYNCING forever when a sync was sent to an offline TV.
  if (device.status === 'SYNCING') return isDeviceStale(device, now) ? 'OFFLINE' : 'SYNCING';
  return isDeviceStale(device, now) ? 'OFFLINE' : 'ONLINE';
}

export function minutesSince(iso: string, now: number = Date.now()): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Infinity;
  return Math.floor((now - then) / 60000);
}

export function formatLastSeen(iso: string, now: number = Date.now()): string {
  const mins = minutesSince(iso, now);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
