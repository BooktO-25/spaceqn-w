/**
 * SPACEQ Display - Domain Types
 * Multi-Tenant Digital Signage Operating System
 */

export type UserRole = 'SUPER_ADMIN' | 'REGIONAL_ADMIN' | 'BUSINESS_OWNER' | 'MANAGER' | 'DESIGNER' | 'VIEWER';

export type TransitionEffect = 'FADE' | 'SLIDE' | 'ZOOM' | 'NONE';

export type ContentType = 'IMAGE' | 'VIDEO' | 'PDF' | 'YOUTUBE' | 'WEBSITE' | 'CANVA' | 'TEMPLATE';

export type PageTemplateId = 'ANNOUNCEMENT' | 'OFFER' | 'MENU' | 'QUOTE';

/** A curated look — background + accent colors chosen to always look good
 * together, so a non-technical business owner can't accidentally pick an
 * unreadable combination the way a raw color picker would allow. */
export interface PageTheme {
  id: string;
  label: string;
  bg: string;       // CSS background (solid or gradient)
  text: string;      // primary text color
  accent: string;    // accent color for badges/dividers/prices
  textDim: string;   // secondary text color
  onAccent: string;  // text color to use ON TOP of the accent color (badges)
}

export const PAGE_THEMES: PageTheme[] = [
  { id: 'midnight', label: 'Midnight', bg: 'linear-gradient(135deg,#0F172A,#1E293B)', text: '#FFFFFF', accent: '#F43F5E', textDim: '#94A3B8', onAccent: '#FFFFFF' },
  { id: 'cream', label: 'Cream & Clay', bg: '#F4F1EA', text: '#2A2118', accent: '#C2622E', textDim: '#7A6E5D', onAccent: '#FFFFFF' },
  { id: 'emerald', label: 'Emerald', bg: 'linear-gradient(135deg,#064E3B,#065F46)', text: '#ECFDF5', accent: '#34D399', textDim: '#A7F3D0', onAccent: '#053B2D' },
  { id: 'sunset', label: 'Sunset', bg: 'linear-gradient(135deg,#7C2D12,#C2410C)', text: '#FFF7ED', accent: '#FDBA74', textDim: '#FED7AA', onAccent: '#7C2D12' },
  { id: 'royal', label: 'Royal', bg: 'linear-gradient(135deg,#312E81,#4338CA)', text: '#EEF2FF', accent: '#FBBF24', textDim: '#C7D2FE', onAccent: '#312E81' },
  { id: 'paper', label: 'Paper White', bg: '#FFFFFF', text: '#0F172A', accent: '#0F172A', textDim: '#64748B', onAccent: '#FFFFFF' },
];

/** Structured content for a no-code page — rendered natively (no iframe, no
 * external hosting), so it caches and plays offline exactly like an image.
 * Fields used vary by templateId; see PageContentRenderer. */
export interface PageContent {
  templateId: PageTemplateId;
  themeId: string;
  headline?: string;
  subheading?: string;
  bodyText?: string;
  badgeText?: string;       // e.g. "50% OFF" for the OFFER template
  attribution?: string;     // e.g. quote author, for the QUOTE template
  imageUrl?: string;        // optional supporting image
  items?: { label: string; price: string }[]; // for the MENU template
}


export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'PAIRING' | 'SYNCING';

export type ScreenOrientation = 'LANDSCAPE' | 'PORTRAIT';

/** How many independent zones the screen is divided into. Each zone plays
 * its own playlist(s), fully independently — its own schedule, its own
 * rotation timer. SINGLE = the whole screen is one zone (the original,
 * default behavior). Split direction follows orientation: LANDSCAPE splits
 * into side-by-side columns, PORTRAIT splits into stacked rows. */
export type LayoutMode = 'SINGLE' | 'SPLIT_2' | 'SPLIT_3' | 'GRID_4' | 'CUSTOM';

export interface DeviceZone {
  id: string;
  /** All playlists deployed to this zone — same dayparting rules as a
   * single-screen device apply, scoped to just this zone. */
  assignedPlaylistIds: string[];
  /** Fallback playlist for this zone when no schedule rule is active. */
  defaultPlaylistId: string;
}

export function zoneCountFor(layoutMode: LayoutMode | undefined): number {
  if (layoutMode === 'SPLIT_2') return 2;
  if (layoutMode === 'SPLIT_3') return 3;
  if (layoutMode === 'GRID_4') return 4;
  return 1;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  brandColor?: string;
  /** Free-text geography label (e.g. "Nellore, Andhra Pradesh") — lets a
   * Super Admin appoint Regional Admins scoped to a set of these. */
  region?: string;
  createdAt: string;
  totalStorageUsedMb: number;
}

export interface Location {
  id: string;
  businessId: string;
  name: string;
  address: string;
  city: string;
  country: string;
  createdAt: string;
}

export interface Device {
  id: string;
  pairingCode: string;
  name: string;
  businessId: string;
  locationId: string;
  /** Fallback playlist used when no schedule rule is currently active. */
  activePlaylistId?: string;
  /** All playlists deployed to this device. Whichever has a matching, highest-
   * priority ScheduleRule for "now" wins; if none match, activePlaylistId plays.
   * Falls back to [activePlaylistId] for devices paired before this existed. */
  assignedPlaylistIds?: string[];
  /** Screen split configuration. Absent/SINGLE = normal full-screen device
   * using activePlaylistId/assignedPlaylistIds above as before (fully
   * backward compatible with every device paired before this existed).
   * When SPLIT_2/SPLIT_3, `zones` holds one entry per region instead and
   * activePlaylistId/assignedPlaylistIds are ignored. */
  layoutMode?: LayoutMode;
  /** Set when layoutMode is 'CUSTOM' — references one of the 128 preset
   * grid templates in data/layoutTemplates.ts. */
  layoutTemplateId?: string;
  /** A manual broadcast override — takes over the ENTIRE physical screen
   * with one playlist, regardless of normal layout/zones/schedules, until
   * it's landed or expires. Set by an Announcement launch. */
  broadcastOverride?: {
    playlistId: string;
    startedAt: string;
    expiresAt: string | null; // null = runs until manually landed
  };
  zones?: DeviceZone[];
  /** Relative weights for each zone's width (landscape splits) or height
   * (portrait splits) — e.g. [2,1] makes the first zone twice as wide as
   * the second. Defaults to equal weights (all 1s) when absent. Length
   * should match the zone count for the current layoutMode. */
  zoneWeights?: number[];
  /** Physical screen rotation in degrees — for a TV mounted sideways.
   * Rotates the ENTIRE rendered output; the content itself is unaffected,
   * this just compensates for how the panel is physically mounted. */
  rotation?: 0 | 90 | 180 | 270;
  status: DeviceStatus;
  orientation: ScreenOrientation;
  ipAddress: string;
  appVersion: string;
  lastSeenAt: string;
  registeredAt: string;
  storageCachedMb: number;
  tags: string[];
  /** Playback telemetry reported by the kiosk player — "proof of play" data.
   * Only these fields (plus lastSeenAt/status) can be written by an
   * unauthenticated kiosk; see firestore.rules. */
  totalPlaybackSeconds?: number;
  totalPlaybackCount?: number;
  lastPlaybackAt?: string;
  lastPlayedContentId?: string;
  lastPlayedContentTitle?: string;
  lastPlaybackDurationSeconds?: number;
  /** Remote troubleshooting command issued by the dashboard. The kiosk consumes a unique command id. */
  syncCommandId?: string;
  syncCommandAt?: string;
  lastSyncCommandId?: string;
  lastSyncAt?: string;
  lastSyncStatus?: 'REQUESTED' | 'SYNCING' | 'COMPLETED' | 'FAILED';
  lastSyncError?: string;
}

export interface ContentItem {
  id: string;
  businessId: string;
  title: string;
  type: ContentType;
  url: string;
  thumbnailUrl?: string;
  durationSeconds: number; // default duration
  fileSizeBytes: number;
  tags: string[];
  /** How this slide transitions in when it becomes active. Defaults to FADE
   * when absent (keeps older content items looking the same as before). */
  transitionEffect?: TransitionEffect;
  /** Only present when type === 'TEMPLATE' — a no-code page built inside
   * SpaceQ instead of an uploaded file or external URL. */
  pageContent?: PageContent;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleRule {
  id: string;
  name: string;
  startTime: string; // e.g. "07:00"
  endTime: string;   // e.g. "11:00"
  daysOfWeek: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  priority: number;   // Higher number = higher priority
}

export interface MediaFraming {
  fit: 'COVER' | 'CONTAIN';
  zoom: number;       // 1.0 = normal, 1.0–3.0
  positionX: number;  // 0–100, 50 = center
  positionY: number;  // 0–100, 50 = center
  rotation: 0 | 90 | 180 | 270;
}

export interface PlaylistItem {
  id: string;
  contentId: string;
  order: number;
  customDurationSeconds?: number;
  transitionEffect: 'FADE' | 'SLIDE_LEFT' | 'SLIDE_RIGHT' | 'ZOOM' | 'NONE';
  /** Per-playlist-item/per-grid-zone media framing. Original asset is untouched. */
  framing?: MediaFraming;
}

export interface Playlist {
  id: string;
  businessId: string;
  name: string;
  description: string;
  items: PlaylistItem[];
  loop: boolean;
  shuffle: boolean;
  schedules?: ScheduleRule[];
  createdAt: string;
  updatedAt: string;
}

export interface DevicePairingRequest {
  pairingCode: string;
  deviceName: string;
  businessId: string;
  locationId: string;
  orientation: ScreenOrientation;
}

export interface ActivityLog {
  id: string;
  businessId: string;
  userEmail: string;
  action: string;
  targetType: 'DEVICE' | 'PLAYLIST' | 'CONTENT' | 'LOCATION' | 'BUSINESS';
  targetName: string;
  timestamp: string;
}

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED';

export interface TeamInvite {
  id: string;
  businessId: string;
  email: string; // stored lowercase
  role: Exclude<UserRole, 'SUPER_ADMIN' | 'REGIONAL_ADMIN'>;
  invitedByEmail: string;
  status: InviteStatus;
  createdAt: string;
}
