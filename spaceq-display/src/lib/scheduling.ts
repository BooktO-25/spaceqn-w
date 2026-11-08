import { Device, DeviceZone, Playlist, ScheduleRule, zoneCountFor } from '../types';
import { getLayoutTemplate } from '../data/layoutTemplates';

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDateInRange(rule: ScheduleRule, now: Date): boolean {
  // Schedule dates are entered as local calendar dates. Using toISOString()
  // here silently converted them to UTC and could shift a rule by one day
  // around midnight in India and other positive-offset time zones.
  const dateStr = localDateString(now);
  if (rule.startDate && dateStr < rule.startDate) return false;
  if (rule.endDate && dateStr > rule.endDate) return false;
  return true;
}

/**
 * Whether a single ScheduleRule is active at `now`. Supports same-day windows
 * (e.g. 07:00–11:00) and overnight windows that cross midnight (e.g. 22:00–02:00).
 */
export function isScheduleRuleActive(rule: ScheduleRule, now: Date = new Date()): boolean {
  if (!isDateInRange(rule, now)) return false;

  const day = now.getDay(); // 0=Sun..6=Sat
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = timeToMinutes(rule.startTime);
  const endMin = timeToMinutes(rule.endTime);

  if (startMin <= endMin) {
    // Same-day window: day must be in daysOfWeek, and time within [start,end).
    return rule.daysOfWeek.includes(day) && nowMin >= startMin && nowMin < endMin;
  }

  // Overnight window (e.g. 22:00 -> 02:00): active either from start-to-midnight
  // on a listed day, or from midnight-to-end on the day AFTER a listed day.
  const prevDay = (day + 6) % 7;
  const activeLateSegment = rule.daysOfWeek.includes(day) && nowMin >= startMin;
  const activeEarlySegment = rule.daysOfWeek.includes(prevDay) && nowMin < endMin;
  return activeLateSegment || activeEarlySegment;
}

/**
 * Core resolver shared by both full-screen devices and individual split
 * zones: given a set of assigned playlist IDs, a default/fallback ID, and
 * "now", figures out which playlist should actually be playing.
 *   1. Look at every schedule rule across every assigned playlist.
 *   2. Keep only the ones active at `now`.
 *   3. The highest-priority match wins (ties broken by first found).
 *   4. If nothing matches, fall back to the default playlist.
 */
function resolvePlaylistId(
  assignedIds: string[],
  defaultId: string | undefined,
  playlists: Playlist[],
  now: Date
): string | undefined {
  const assigned = playlists.filter(p => assignedIds.includes(p.id));

  let bestPlaylistId: string | undefined;
  let bestPriority = -Infinity;

  for (const playlist of assigned) {
    for (const rule of playlist.schedules || []) {
      if (isScheduleRuleActive(rule, now) && rule.priority > bestPriority) {
        bestPriority = rule.priority;
        bestPlaylistId = playlist.id;
      }
    }
  }

  return bestPlaylistId || defaultId || assignedIds[0];
}

/** Resolves the active playlist for a normal, full-screen (SINGLE layout) device. */
export function resolveActivePlaylistId(
  device: Device,
  playlists: Playlist[],
  now: Date = new Date()
): string | undefined {
  const assignedIds = device.assignedPlaylistIds?.length
    ? device.assignedPlaylistIds
    : device.activePlaylistId
      ? [device.activePlaylistId]
      : [];
  return resolvePlaylistId(assignedIds, device.activePlaylistId, playlists, now);
}

/** Resolves the active playlist for one split-screen zone. */
export function resolveZonePlaylistId(
  zone: DeviceZone,
  playlists: Playlist[],
  now: Date = new Date()
): string | undefined {
  const assignedIds = zone.assignedPlaylistIds?.length ? zone.assignedPlaylistIds : (zone.defaultPlaylistId ? [zone.defaultPlaylistId] : []);
  return resolvePlaylistId(assignedIds, zone.defaultPlaylistId, playlists, now);
}

/** Whether this device currently has a live, unexpired broadcast override. */
export function isBroadcastActive(device: Device, now: Date = new Date()): boolean {
  const override = device.broadcastOverride;
  if (!override) return false;
  if (override.expiresAt === null) return true;
  return new Date(override.expiresAt).getTime() > now.getTime();
}

/**
 * Resolves the active playlist for EVERY pane a device should render right
 * now — a 1-element array for a normal SINGLE-layout device, or one entry
 * per zone for a split-screen device. This is the single function the
 * kiosk/dashboard preview need to call.
 *
 * A live broadcast override (see Announcement / Launch Control) always
 * wins first — it takes over the WHOLE physical screen with one playlist,
 * regardless of the device's normal layout, zones, or dayparting schedule.
 */
export function resolveAllPanePlaylistIds(
  device: Device,
  playlists: Playlist[],
  now: Date = new Date()
): (string | undefined)[] {
  if (isBroadcastActive(device, now)) {
    return [device.broadcastOverride!.playlistId];
  }
  if (device.layoutMode && device.layoutMode !== 'SINGLE' && device.zones?.length) {
    return device.zones
      .slice(0, device.layoutTemplateId ? (getLayoutTemplate(device.layoutTemplateId)?.zoneCount || device.zones.length) : zoneCountFor(device.layoutMode))
      .map(zone => resolveZonePlaylistId(zone, playlists, now));
  }
  return [resolveActivePlaylistId(device, playlists, now)];
}

/** Every playlist ID a device could possibly need right now (across all
 * zones/schedules), for subscribing to the right set of Firestore docs. */
export function allAssignedPlaylistIds(device: Device): string[] {
  const ids = new Set<string>();

  if (device.layoutMode && device.layoutMode !== 'SINGLE' && device.zones?.length) {
    device.zones.forEach(zone => {
      const zoneIds = zone.assignedPlaylistIds?.length
        ? zone.assignedPlaylistIds
        : (zone.defaultPlaylistId ? [zone.defaultPlaylistId] : []);
      zoneIds.forEach(id => ids.add(id));
    });
  } else {
    const assigned = device.assignedPlaylistIds?.length
      ? device.assignedPlaylistIds
      : (device.activePlaylistId ? [device.activePlaylistId] : []);
    assigned.forEach(id => ids.add(id));
  }

  // A broadcast may intentionally target a playlist that is not part of the
  // device's normal schedule. Subscribe to it as well, otherwise Launch
  // Control can resolve the override correctly but have no playlist document
  // available to render.
  if (device.broadcastOverride?.playlistId) {
    ids.add(device.broadcastOverride.playlistId);
  }

  return Array.from(ids);
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

