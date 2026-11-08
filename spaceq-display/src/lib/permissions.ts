import { UserRole } from '../types';

export type PermissionAction =
  | 'manageTeam'
  | 'manageDevices'
  | 'manageLocations'
  | 'manageContent'
  | 'managePlaylists'
  | 'manageBusinessSettings';

/**
 * Role → allowed actions, within the user's own business.
 * SUPER_ADMIN and REGIONAL_ADMIN bypass this entirely (checked separately):
 * Super Admin can do anything across every tenant, Regional Admin the same
 * but only within businesses whose region they've been assigned.
 *
 *  BUSINESS_OWNER — everything in their business, including team & billing.
 *  MANAGER        — day-to-day operations: devices, locations, content, playlists.
 *  DESIGNER       — content creation only: uploads and playlists, no devices/team.
 *  VIEWER         — read-only. Can see dashboards, devices, content, playlists,
 *                   but can't create, edit, or delete anything.
 */
const MATRIX: Record<Exclude<UserRole, 'SUPER_ADMIN' | 'REGIONAL_ADMIN'>, PermissionAction[]> = {
  BUSINESS_OWNER: ['manageTeam', 'manageDevices', 'manageLocations', 'manageContent', 'managePlaylists', 'manageBusinessSettings'],
  MANAGER: ['manageDevices', 'manageLocations', 'manageContent', 'managePlaylists'],
  DESIGNER: ['manageContent', 'managePlaylists'],
  VIEWER: [],
};

export function can(role: UserRole | undefined, action: PermissionAction): boolean {
  if (!role) return false;
  if (role === 'SUPER_ADMIN' || role === 'REGIONAL_ADMIN') return true;
  return MATRIX[role]?.includes(action) ?? false;
}

export function roleLabel(role: UserRole | undefined): string {
  switch (role) {
    case 'SUPER_ADMIN': return 'Super Admin';
    case 'REGIONAL_ADMIN': return 'Regional Admin';
    case 'BUSINESS_OWNER': return 'Business Owner';
    case 'MANAGER': return 'Manager';
    case 'DESIGNER': return 'Designer';
    case 'VIEWER': return 'Viewer';
    default: return 'Unknown';
  }
}

export const ASSIGNABLE_ROLES: Exclude<UserRole, 'SUPER_ADMIN' | 'REGIONAL_ADMIN'>[] = ['MANAGER', 'DESIGNER', 'VIEWER', 'BUSINESS_OWNER'];

