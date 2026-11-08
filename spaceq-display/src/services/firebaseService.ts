import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Business, Location, Device, ContentItem, Playlist, ActivityLog, TeamInvite } from '../types';

// Collection references
const BIZ_COL = 'businesses';
const LOC_COL = 'locations';
const DEV_COL = 'devices';
const CNT_COL = 'contents';
const PL_COL = 'playlists';
const ACT_COL = 'activityLogs';
const USR_COL = 'users';
const INV_COL = 'invites';

// Real-time Subscriptions with Server-Side Tenant Scoping

/** Businesses visible to a Regional Admin: only those in their assigned
 * region(s), via a whitelist query Firestore can verify is safe (unlike an
 * unfiltered collection scan, which region-scoped rules would reject outright). */
export function subscribeBusinessesForRegions(regions: string[], callback: (data: Business[]) => void) {
  if (!auth.currentUser || regions.length === 0) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, BIZ_COL), where('region', 'in', regions.slice(0, 10)));
  return onSnapshot(q, snapshot => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Business)));
  }, error => console.warn('Region businesses subscription error:', error));
}

export function subscribeBusinesses(callback: (data: Business[]) => void, businessId?: string, role?: string) {
  if (!auth.currentUser) {
    callback([]);
    return () => {};
  }
  const isSuperAdmin = role === 'SUPER_ADMIN';
  let q: any;

  if (isSuperAdmin) {
    q = collection(db, BIZ_COL);
  } else if (businessId) {
    q = query(collection(db, BIZ_COL), where('id', '==', businessId));
  } else {
    callback([]);
    return () => {};
  }

  return onSnapshot(q, (snapshot: any) => {
    const items: Business[] = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Business));
    callback(items);
  }, (error: any) => {
    console.warn('Businesses subscription error:', error);
  });
}

export function subscribeLocations(callback: (data: Location[]) => void, businessId?: string, role?: string) {
  if (!auth.currentUser) {
    callback([]);
    return () => {};
  }
  const isSuperAdmin = role === 'SUPER_ADMIN';
  let q: any;

  if (isSuperAdmin) {
    q = collection(db, LOC_COL);
  } else if (businessId) {
    q = query(collection(db, LOC_COL), where('businessId', '==', businessId));
  } else {
    callback([]);
    return () => {};
  }

  return onSnapshot(q, (snapshot: any) => {
    const items: Location[] = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Location));
    callback(items);
  }, (error: any) => {
    console.warn('Locations subscription error:', error);
  });
}

export function subscribeDevices(callback: (data: Device[]) => void, businessId?: string, role?: string) {
  if (!auth.currentUser) {
    callback([]);
    return () => {};
  }
  const isSuperAdmin = role === 'SUPER_ADMIN';
  let q: any;

  if (isSuperAdmin) {
    q = collection(db, DEV_COL);
  } else if (businessId) {
    q = query(collection(db, DEV_COL), where('businessId', '==', businessId));
  } else {
    callback([]);
    return () => {};
  }

  return onSnapshot(q, (snapshot: any) => {
    const items: Device[] = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Device));
    callback(items);
  }, (error: any) => {
    console.warn('Devices subscription error:', error);
  });
}

export function subscribeContents(callback: (data: ContentItem[]) => void, businessId?: string, role?: string) {
  if (!auth.currentUser) {
    callback([]);
    return () => {};
  }
  const isSuperAdmin = role === 'SUPER_ADMIN';
  let q: any;

  if (isSuperAdmin) {
    q = collection(db, CNT_COL);
  } else if (businessId) {
    q = query(collection(db, CNT_COL), where('businessId', '==', businessId));
  } else {
    callback([]);
    return () => {};
  }

  return onSnapshot(q, (snapshot: any) => {
    const items: ContentItem[] = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as ContentItem));
    callback(items);
  }, (error: any) => {
    console.warn('Contents subscription error:', error);
  });
}

export function subscribePlaylists(callback: (data: Playlist[]) => void, businessId?: string, role?: string) {
  if (!auth.currentUser) {
    callback([]);
    return () => {};
  }
  const isSuperAdmin = role === 'SUPER_ADMIN';
  let q: any;

  if (isSuperAdmin) {
    q = collection(db, PL_COL);
  } else if (businessId) {
    q = query(collection(db, PL_COL), where('businessId', '==', businessId));
  } else {
    callback([]);
    return () => {};
  }

  return onSnapshot(q, (snapshot: any) => {
    const items: Playlist[] = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Playlist));
    callback(items);
  }, (error: any) => {
    console.warn('Playlists subscription error:', error);
  });
}

export function subscribeActivities(callback: (data: ActivityLog[]) => void, businessId?: string, role?: string) {
  if (!auth.currentUser) {
    callback([]);
    return () => {};
  }
  const isSuperAdmin = role === 'SUPER_ADMIN';
  let q: any;

  if (isSuperAdmin) {
    q = query(collection(db, ACT_COL), orderBy('timestamp', 'desc'), limit(30));
  } else if (businessId) {
    q = query(collection(db, ACT_COL), where('businessId', '==', businessId), orderBy('timestamp', 'desc'), limit(30));
  } else {
    callback([]);
    return () => {};
  }

  return onSnapshot(q, (snapshot: any) => {
    const items: ActivityLog[] = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as ActivityLog));
    callback(items);
  }, (error: any) => {
    const fallbackQ = isSuperAdmin 
      ? collection(db, ACT_COL) 
      : query(collection(db, ACT_COL), where('businessId', '==', businessId));
    return onSnapshot(fallbackQ, (snapshot: any) => {
      const items: ActivityLog[] = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as ActivityLog));
      callback(items);
    });
  });
}

// Write Operations (Firestore Mutation Functions)
export async function saveBusiness(biz: Business) {
  if (!auth.currentUser) return;
  await setDoc(doc(db, BIZ_COL, biz.id), biz, { merge: true });
}

export async function saveLocation(loc: Location) {
  if (!auth.currentUser) return;
  await setDoc(doc(db, LOC_COL, loc.id), loc, { merge: true });
}

export async function saveDevice(device: Device) {
  if (!auth.currentUser) return;
  await setDoc(doc(db, DEV_COL, device.id), device, { merge: true });
}

/** Requests a deterministic hard resync on a physical kiosk. The kiosk
 * consumes the unique command ID once and reloads itself after acknowledging
 * it, which gives support staff a reliable troubleshooting escape hatch. */
export async function requestDeviceSync(deviceId: string, commandId: string) {
  if (!auth.currentUser) throw new Error('Authentication required');
  await updateDoc(doc(db, DEV_COL, deviceId), {
    syncCommandId: commandId,
    syncCommandAt: new Date().toISOString(),
    lastSyncStatus: 'REQUESTED',
    lastSyncError: '',
    status: 'SYNCING',
  });
}

export async function deleteDevice(deviceId: string) {
  if (!auth.currentUser) return;
  await deleteDoc(doc(db, DEV_COL, deviceId));
}

export async function saveContent(content: ContentItem) {
  if (!auth.currentUser) return;
  await setDoc(doc(db, CNT_COL, content.id), content, { merge: true });
}

export async function deleteContent(contentId: string) {
  if (!auth.currentUser) return;
  await deleteDoc(doc(db, CNT_COL, contentId));
}

export async function savePlaylist(playlist: Playlist) {
  if (!auth.currentUser) return;
  await setDoc(doc(db, PL_COL, playlist.id), playlist, { merge: true });
}

export async function deletePlaylist(playlistId: string) {
  if (!auth.currentUser) return;
  await deleteDoc(doc(db, PL_COL, playlistId));
}

export async function logActivity(act: Omit<ActivityLog, 'id'>) {
  if (!auth.currentUser) return;
  const id = 'act-' + Date.now();
  await setDoc(doc(db, ACT_COL, id), { id, ...act });
}

// ---- Team & Invites ----

export interface BusinessMember {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
}

export function subscribeBusinessMembers(businessId: string, callback: (members: BusinessMember[]) => void) {
  if (!businessId) { callback([]); return () => {}; }
  const q = query(collection(db, USR_COL), where('businessId', '==', businessId));
  return onSnapshot(q, (snapshot) => {
    const members = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as BusinessMember));
    callback(members);
  }, (error) => console.warn('Business members subscription error:', error));
}

export function subscribeInvites(businessId: string, callback: (invites: TeamInvite[]) => void) {
  if (!businessId) { callback([]); return () => {}; }
  const q = query(collection(db, INV_COL), where('businessId', '==', businessId));
  return onSnapshot(q, (snapshot) => {
    const invites = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TeamInvite));
    callback(invites);
  }, (error) => console.warn('Invites subscription error:', error));
}

export async function createInvite(invite: Omit<TeamInvite, 'id'>) {
  if (!auth.currentUser) return;
  const id = 'inv-' + Date.now();
  await setDoc(doc(db, INV_COL, id), { id, ...invite });
}

export async function revokeInvite(inviteId: string) {
  if (!auth.currentUser) return;
  await updateDoc(doc(db, INV_COL, inviteId), { status: 'REVOKED' });
}

export async function updateMemberRole(uid: string, role: string) {
  if (!auth.currentUser) return;
  await updateDoc(doc(db, USR_COL, uid), { role });
}

/** Looks up a single pending invite for this email (used right after signup). */
export async function findPendingInviteForEmail(email: string): Promise<TeamInvite | null> {
  const q = query(
    collection(db, INV_COL),
    where('email', '==', email.toLowerCase()),
    where('status', '==', 'PENDING')
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as TeamInvite;
}

export async function markInviteAccepted(inviteId: string) {
  await updateDoc(doc(db, INV_COL, inviteId), { status: 'ACCEPTED' });
}

// ---- Super Admin Console ----

export interface PlatformUser {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  businessId: string;
  assignedRegions?: string[];
}

/** Looks up an existing user by email — used by the Super Admin console to
 * find someone to promote to Regional Admin. Only works for Super Admins
 * (see firestore.rules); returns null if no account with that email exists
 * yet (they'd need to sign up first). */
export async function findUserByEmail(email: string): Promise<PlatformUser | null> {
  const q = query(collection(db, USR_COL), where('email', '==', email.toLowerCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...d.data() } as PlatformUser;
}

/** Grants (or revokes, by passing an empty array) Regional Admin status for
 * one or more geographic regions. Super Admin only — enforced in rules. */
export async function setRegionalAdmin(uid: string, regions: string[]) {
  await updateDoc(doc(db, USR_COL, uid), {
    role: regions.length > 0 ? 'REGIONAL_ADMIN' : 'VIEWER',
    assignedRegions: regions,
    businessId: '',
  });
}

export async function updateBusinessRegion(businessId: string, region: string) {
  await updateDoc(doc(db, BIZ_COL, businessId), { region });
}

