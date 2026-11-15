import { Device } from '../types';

export type CampaignBookingType = 'network' | 'screen' | 'hybrid';
export type CampaignStatus = 'draft' | 'held' | 'confirmed' | 'scheduled' | 'live' | 'paused' | 'completed' | 'cancelled' | 'shortfall';
export type MissedPlayPolicy = 'extend' | 'redistribute' | 'manual';

export interface ScreenGuarantee {
  screenId: string;
  plays: number;
}

export interface ScreenAllocation {
  screenId: string;
  networkPlays: number;
  screenSpecificPlays: number;
  totalGuaranteedPlays: number;
}

export interface DailyScreenSchedule {
  screenId: string;
  date: string;
  plannedPlays: number;
}

export interface ScreenCapacity {
  screenId: string;
  maxCampaignPlaysPerDay: number;
  reservedPlaysByDate?: Record<string, number>;
}

export interface CampaignPlanInput {
  bookingType: CampaignBookingType;
  networkPoolPlays: number;
  selectedScreenIds: string[];
  screenGuarantees: ScreenGuarantee[];
  startDate: string;
  endDate: string;
  dailyCapacities: Record<string, number>;
  missedPlayPolicy: MissedPlayPolicy;
}

export interface CampaignPlan {
  allocations: ScreenAllocation[];
  schedules: DailyScreenSchedule[];
  totalGuaranteedPlays: number;
  dates: string[];
}

function assertPositiveInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(label + ' must be a non-negative whole number.');
}

export function getDateKeys(startDate: string, endDate: string): string[] {
  const start = new Date(startDate + 'T12:00:00.000Z');
  const end = new Date(endDate + 'T12:00:00.000Z');
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) {
    throw new Error('Choose a valid campaign date range.');
  }
  const dates: string[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
    if (dates.length > 93) throw new Error('Campaigns can be scheduled for up to 93 days at a time.');
  }
  return dates;
}

/** Equal network allocation with deterministic remainder rotation. */
export function allocateEqually(totalPlays: number, screenIds: string[], rotationSeed = 0): Record<string, number> {
  assertPositiveInteger(totalPlays, 'Network plays');
  const ids = [...new Set(screenIds)].sort();
  if (!ids.length) throw new Error('Select at least one screen.');
  const base = Math.floor(totalPlays / ids.length);
  const remainder = totalPlays % ids.length;
  const offset = ((rotationSeed % ids.length) + ids.length) % ids.length;
  const result: Record<string, number> = {};
  ids.forEach((id, index) => {
    const rank = (index - offset + ids.length) % ids.length;
    result[id] = base + (rank < remainder ? 1 : 0);
  });
  return result;
}

/**
 * Distributes each screen's guarantee as evenly as possible over eligible
 * dates without exceeding that screen's configured daily campaign capacity.
 */
export function buildCampaignPlan(input: CampaignPlanInput): CampaignPlan {
  const ids = [...new Set(input.selectedScreenIds)].sort();
  if (!ids.length) throw new Error('Select at least one screen.');
  assertPositiveInteger(input.networkPoolPlays, 'Network plays');

  const guarantees = new Map<string, number>();
  for (const item of input.screenGuarantees) {
    if (!ids.includes(item.screenId)) throw new Error('A screen-specific guarantee references an unselected screen.');
    assertPositiveInteger(item.plays, 'Screen-specific plays');
    guarantees.set(item.screenId, (guarantees.get(item.screenId) || 0) + item.plays);
  }

  if (input.bookingType === 'network' && [...guarantees.values()].some(Boolean)) {
    throw new Error('Network-only bookings cannot include screen-specific guarantees.');
  }
  if (input.bookingType === 'screen' && input.networkPoolPlays > 0) {
    throw new Error('Screen-only bookings cannot include a network pool.');
  }
  if (input.bookingType === 'hybrid' && input.networkPoolPlays === 0 && ![...guarantees.values()].some(Boolean)) {
    throw new Error('A hybrid booking needs a network pool or at least one screen guarantee.');
  }

  const network = input.bookingType === 'screen'
    ? Object.fromEntries(ids.map(id => [id, 0]))
    : allocateEqually(input.networkPoolPlays, ids);
  const allocations: ScreenAllocation[] = ids.map(screenId => {
    const screenSpecificPlays = guarantees.get(screenId) || 0;
    const networkPlays = network[screenId] || 0;
    return { screenId, networkPlays, screenSpecificPlays, totalGuaranteedPlays: networkPlays + screenSpecificPlays };
  });

  const dates = getDateKeys(input.startDate, input.endDate);
  const schedules: DailyScreenSchedule[] = [];
  for (const allocation of allocations) {
    let remaining = allocation.totalGuaranteedPlays;
    const perDayCapacity = input.dailyCapacities[allocation.screenId] || 0;
    assertPositiveInteger(perDayCapacity, 'Daily capacity for ' + allocation.screenId);
    if (remaining > 0 && perDayCapacity <= 0) throw new Error('Configure a campaign capacity greater than zero for every selected screen.');
    const base = dates.length ? Math.floor(remaining / dates.length) : 0;
    const extra = dates.length ? remaining % dates.length : 0;
    const desired = dates.map((date, index) => base + (index < extra ? 1 : 0));
    // Move overflow forward into dates with remaining headroom. This keeps the
    // total guarantee intact while respecting daily capacity.
    const planned = dates.map(() => 0);
    for (let i = 0; i < dates.length; i++) {
      const add = Math.min(desired[i], perDayCapacity);
      planned[i] += add;
      let overflow = desired[i] - add;
      for (let j = i + 1; j < dates.length && overflow > 0; j++) {
        const room = perDayCapacity - planned[j];
        const moved = Math.min(room, overflow);
        planned[j] += moved;
        overflow -= moved;
      }
      if (overflow > 0) throw new Error('Insufficient daily capacity on ' + allocation.screenId + '. Reduce plays or extend the campaign dates.');
    }
    planned.forEach((plays, index) => {
      if (plays > 0) schedules.push({ screenId: allocation.screenId, date: dates[index], plannedPlays: plays });
    });
    remaining -= planned.reduce((sum, plays) => sum + plays, 0);
    if (remaining !== 0) throw new Error('The scheduler could not allocate all guaranteed plays.');
  }

  return {
    allocations,
    schedules,
    totalGuaranteedPlays: allocations.reduce((sum, item) => sum + item.totalGuaranteedPlays, 0),
    dates
  };
}

/** Delivery status is derived from immutable events, not from player claims about totals. */
export function getDeliveryRate(guaranteed: number, completed: number): number {
  if (guaranteed <= 0) return 0;
  return Math.min(100, Math.round((completed / guaranteed) * 10000) / 100);
}

export function isValidCompletedPlayback(event: {
  campaignId?: string;
  screenId?: string;
  creativeId?: string;
  startedAt?: string;
  completedAt?: string;
  actualDurationSeconds?: number;
  expectedDurationSeconds?: number;
}): boolean {
  if (!event.campaignId || !event.screenId || !event.creativeId || !event.startedAt || !event.completedAt) return false;
  const start = new Date(event.startedAt).getTime();
  const end = new Date(event.completedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
  if (!Number.isFinite(event.actualDurationSeconds) || (event.actualDurationSeconds || 0) <= 0) return false;
  return !event.expectedDurationSeconds || (event.actualDurationSeconds || 0) >= event.expectedDurationSeconds * 0.9;
}

export function getEligibleScreens(devices: Device[]): Device[] {
  return devices.filter(device => Boolean(device.businessId) && device.status !== 'PAIRING');
}
