import React, { useState, useEffect } from 'react';
import {
  Business,
  Location,
  Device,
  ContentItem,
  Playlist,
  ActivityLog,
  ContentType,
  LayoutMode,
  DeviceZone,
  TransitionEffect,
  PageContent
} from './types';

import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { LandingGate } from './components/LandingGate';
import { BusinessOnboarding } from './components/BusinessOnboarding';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { BusinessHierarchyView } from './components/BusinessHierarchyView';
import { DeviceManagerView } from './components/DeviceManagerView';
import { ContentLibraryView } from './components/ContentLibraryView';
import { PlaylistBuilderView } from './components/PlaylistBuilderView';
import { PlayerView } from './components/PlayerView';
import { TeamView } from './components/TeamView';
import { AnnouncementView } from './components/AnnouncementView';
import { FeatureEditorView } from './components/FeatureEditorView';
import { CampaignHubView } from './components/CampaignHubView';
import { CampaignDeploymentView } from './components/CampaignDeploymentView';
import { PublicCampaignReport } from './components/PublicCampaignReport';
import { DefaultLayerEditor } from './components/DefaultLayerEditor';
import { SuperAdminConsole } from './components/SuperAdminConsole';
import { ShieldOff } from 'lucide-react';
import { useOfflineAlerts, notificationsGranted, requestNotificationPermission } from './lib/useOfflineAlerts';
import { effectiveStatus, formatLastSeen } from './lib/deviceStatus';
import { resolveAllPanePlaylistIds } from './lib/scheduling';
import { getLayoutTemplate } from './data/layoutTemplates';
import { can } from './lib/permissions';
import { doc, getDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from './lib/firebase';

import {
  subscribeBusinesses,
  subscribeBusinessesForRegions,
  subscribeLocations,
  subscribeDevices,
  subscribeContents,
  subscribePlaylists,
  subscribeActivities,
  saveDevice,
  requestDeviceSync,
  deleteDevice as firestoreDeleteDevice,
  saveContent,
  deleteContent as firestoreDeleteContent,
  savePlaylist,
  saveBusiness,
  saveLocation,
  logActivity
} from './services/firebaseService';

function MainApplication({ isAdminEntrance = false }: { isAdminEntrance?: boolean }) {
  const { user, userProfile, loading: authLoading, logout } = useAuth();

  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Captured once, from the URL the app was first loaded with — survives the
  // whole login flow since this is a single-page app (no hard navigation
  // happens between scanning the QR code and finishing sign-in).
  const [pendingClaimCode, setPendingClaimCode] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('claim')
  );

  // Multi-Tenant States (Synced with Firestore). These start EMPTY — no baked-in
  // demo businesses — and only populate once a real, authenticated tenant's data
  // streams in via the subscriptions below.
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);

  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('ALL');

  const [devices, setDevices] = useState<Device[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  // Standalone Fullscreen Player Mode
  const [playerDeviceId, setPlayerDeviceId] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => notificationsGranted());

  // Hooks must run on every render regardless of the auth-gating early
  // returns below, so this lives here rather than after them.
  const { staleDevices } = useOfflineAlerts(devices, notificationsEnabled);

  // Once we have a real, ready dashboard (signed in + business selected),
  // if the app was opened via a QR-code claim link, jump to Devices and
  // clean the code out of the URL so refreshing doesn't re-trigger it.
  useEffect(() => {
    if (!pendingClaimCode) return;
    if (!user || !userProfile || !userProfile.businessId || !selectedBusiness) return;
    setActiveTab('devices');
    const url = new URL(window.location.href);
    url.searchParams.delete('claim');
    window.history.replaceState({}, '', url.toString());
  }, [pendingClaimCode, user, userProfile, selectedBusiness]);

  const handleToggleNotifications = async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      return;
    }
    const granted = await requestNotificationPermission();
    setNotificationsEnabled(granted);
  };

  // 1. Subscribe to real-time streams, scoped to the signed-in user's own
  // tenant — or, for SUPER_ADMIN, everything; or for REGIONAL_ADMIN, just
  // the businesses in their assigned region(s) and (once picked) whichever
  // single one they're currently viewing.
  const isSuperAdmin = userProfile?.role === 'SUPER_ADMIN';
  const isRegionalAdmin = userProfile?.role === 'REGIONAL_ADMIN';

  useEffect(() => {
    if (!user || authLoading || !userProfile) return;
    // Everyone except Super Admin / Regional Admin needs a real businessId
    // before there's anything to load.
    if (!userProfile.businessId && !isSuperAdmin && !isRegionalAdmin) return;

    const unsubBiz = isRegionalAdmin
      ? subscribeBusinessesForRegions(userProfile.assignedRegions || [], setBusinesses)
      : subscribeBusinesses(setBusinesses, userProfile.businessId, userProfile.role);

    // For a normal tenant user or Super Admin, scope everything below to
    // userProfile.businessId (or unscoped for Super Admin, as before). For
    // a Regional Admin, scope to whichever business they've currently
    // selected in the switcher — nothing until they've picked one.
    const scopeBusinessId = isRegionalAdmin ? (selectedBusiness?.id || '') : userProfile.businessId;
    const scopeRole = isRegionalAdmin ? 'REGIONAL_ADMIN' : userProfile.role;
    const skipTenantData = isRegionalAdmin && !scopeBusinessId;

    if (skipTenantData) {
      setLocations([]); setDevices([]); setContents([]); setPlaylists([]); setActivities([]);
      return () => { unsubBiz(); };
    }

    const unsubLoc = subscribeLocations(data => setLocations(data), scopeBusinessId, scopeRole);
    const unsubDev = subscribeDevices(data => setDevices(data), scopeBusinessId, scopeRole);
    const unsubCnt = subscribeContents(data => setContents(data), scopeBusinessId, scopeRole);
    const unsubPl = subscribePlaylists(data => setPlaylists(data), scopeBusinessId, scopeRole);
    const unsubAct = subscribeActivities(data => setActivities(data), scopeBusinessId, scopeRole);

    return () => {
      unsubBiz();
      unsubLoc();
      unsubDev();
      unsubCnt();
      unsubPl();
      unsubAct();
    };
  }, [user, userProfile, authLoading, isSuperAdmin, isRegionalAdmin, isRegionalAdmin ? selectedBusiness?.id : null]);

  // 2. Tenant Isolation based on Auth Role
  const visibleBusinesses = (isSuperAdmin || isRegionalAdmin)
    ? businesses
    : businesses.filter(b => b.id === userProfile?.businessId);

  useEffect(() => {
    if (!isSuperAdmin && !isRegionalAdmin && userProfile?.businessId) {
      const tenantBiz = businesses.find(b => b.id === userProfile.businessId);
      if (tenantBiz && selectedBusiness?.id !== tenantBiz.id) {
        setSelectedBusiness(tenantBiz);
      }
    } else if ((isSuperAdmin || isRegionalAdmin) && !selectedBusiness && businesses.length > 0) {
      setSelectedBusiness(businesses[0]);
    }
  }, [userProfile, businesses, isSuperAdmin, isRegionalAdmin, selectedBusiness]);

  // Quick Action Handlers (Writing to Firestore Backend)
  /**
   * Claims a device that's already sitting on the /tv pairing screen
   * showing a code. We look that code up by document ID (devices/{code} —
   * the code IS the permanent device ID, see KioskDisplay.tsx), verify it's
   * genuinely unclaimed, and update it in place. The TV's own onSnapshot
   * listener picks up the change instantly and switches to playback — no
   * URL, no reload, no login on the TV side ever.
   */
  const handleClaimDevice = async (
    code: string,
    name: string,
    locationId: string,
    playlistId: string,
    orientation: 'LANDSCAPE' | 'PORTRAIT',
    assignedPlaylistIds?: string[]
  ) => {
    const ref = doc(db, 'devices', code);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      throw new Error("No display found with that code. Make sure the TV is powered on, showing the code, and connected to the internet.");
    }
    const existing = snap.data() as Device;
    if (existing.status !== 'PAIRING' || existing.businessId) {
      throw new Error('That code has already been used to connect a different display. Ask the TV to show a fresh code (unplug/replug it, or clear its browser data), then try again.');
    }

    const updated: Partial<Device> = {
      name,
      businessId: selectedBusiness!.id,
      locationId,
      activePlaylistId: playlistId,
      assignedPlaylistIds: assignedPlaylistIds && assignedPlaylistIds.length ? assignedPlaylistIds : [playlistId],
      // A freshly claimed device always starts as a clean single-screen
      // display, regardless of anything that might have been set on this
      // device ID/code before (e.g. reused hardware from earlier testing).
      // Split-screen is something you turn on deliberately afterward.
      layoutMode: 'SINGLE',
      zones: [],
      zoneWeights: [],
      status: 'ONLINE',
      orientation,
      lastSeenAt: new Date().toISOString(),
      tags: ['New Display', orientation],
    };
    await updateDoc(ref, updated as any);

    const claimedDevice: Device = { ...existing, ...updated, id: code, pairingCode: code } as Device;
    setDevices(prev => [claimedDevice, ...prev.filter(d => d.id !== code)]);

    await logActivity({
      businessId: selectedBusiness!.id,
      userEmail: userProfile?.email || 'owner@spaceq.io',
      action: 'Connected New Display Device',
      targetType: 'DEVICE',
      targetName: name,
      timestamp: new Date().toISOString(),
    });
  };

  /** Updates which playlists are deployed to an already-paired device, and
   * which one is the fallback/default when no schedule rule is active. */
  const handleUpdateDeviceLayout = async (
    deviceId: string,
    layoutMode: LayoutMode,
    assignedPlaylistIds: string[],
    defaultPlaylistId: string,
    zones: DeviceZone[],
    rotation: 0 | 90 | 180 | 270,
    zoneWeights: number[],
    layoutTemplateId?: string
  ) => {
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) return;
    const updated: Device = layoutMode === 'SINGLE'
      ? { ...dev, layoutMode, zones: [], assignedPlaylistIds, activePlaylistId: defaultPlaylistId, rotation, zoneWeights: [], layoutTemplateId: undefined }
      : { ...dev, layoutMode, zones, rotation, zoneWeights, layoutTemplateId };
    setDevices(prev => prev.map(d => d.id === deviceId ? updated : d));
    await saveDevice(updated);
    await logActivity({
      businessId: dev.businessId,
      userEmail: userProfile?.email || 'owner@spaceq.io',
      action: layoutMode === 'SINGLE' ? 'Updated Device Playlist Schedule' : `Set Split-Screen Layout (${layoutTemplateId ? getLayoutTemplate(layoutTemplateId)?.name || layoutMode : layoutMode})`,
      targetType: 'DEVICE',
      targetName: dev.name,
      timestamp: new Date().toISOString(),
    });
  };

  /** Announcement / Launch Control — pushes one playlist live on the
   * selected devices immediately, overriding whatever they'd normally be
   * showing (their usual split layout, zones, and dayparting schedule),
   * until it's landed or the timer runs out. Business Owner only — same
   * boundary as everything else here, enforced by only rendering the
   * Announcement tab for that role (see Sidebar.tsx); Firestore rules
   * still stop this from ever touching another business's devices. */
  const handleLaunchBroadcast = async (deviceIds: string[], playlistId: string, durationSeconds: number | null) => {
    if (!selectedBusiness) return;
    const startedAt = new Date().toISOString();
    const expiresAt = durationSeconds !== null ? new Date(Date.now() + durationSeconds * 1000).toISOString() : null;

    await Promise.all(deviceIds.map(async (deviceId) => {
      const dev = devices.find(d => d.id === deviceId);
      if (!dev) return;
      const updated: Device = { ...dev, broadcastOverride: { playlistId, startedAt, expiresAt } };
      setDevices(prev => prev.map(d => d.id === deviceId ? updated : d));
      await saveDevice(updated);
    }));

    await logActivity({
      businessId: selectedBusiness.id,
      userEmail: userProfile?.email || 'owner@spaceq.io',
      action: `Launched Announcement on ${deviceIds.length} device(s)`,
      targetType: 'DEVICE',
      targetName: playlists.find(p => p.id === playlistId)?.name || playlistId,
      timestamp: new Date().toISOString(),
    });
  };

  const handleLandBroadcast = async (deviceId: string) => {
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) return;
    // saveDevice() writes with merge:true, so simply omitting the field
    // from the object would NOT actually clear it in Firestore — the live
    // kiosk (subscribed via onSnapshot) would keep seeing the stale
    // override forever. deleteField() is what genuinely removes it.
    const { broadcastOverride, ...rest } = dev;
    setDevices(prev => prev.map(d => d.id === deviceId ? (rest as Device) : d));
    await updateDoc(doc(db, 'devices', deviceId), { broadcastOverride: deleteField() });
    await logActivity({
      businessId: dev.businessId,
      userEmail: userProfile?.email || 'owner@spaceq.io',
      action: 'Landed Announcement',
      targetType: 'DEVICE',
      targetName: dev.name,
      timestamp: new Date().toISOString(),
    });
  };

  const handleSyncDevice = async (deviceId: string) => {
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) return;
    const commandId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `sync-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // Optimistically show the troubleshooting state while the command is
    // being written. The kiosk will acknowledge it and then hard-reload.
    const requested: Device = {
      ...dev,
      status: 'SYNCING',
      syncCommandId: commandId,
      syncCommandAt: new Date().toISOString(),
      lastSyncStatus: 'REQUESTED',
      lastSyncError: '',
    };
    setDevices(prev => prev.map(d => d.id === deviceId ? requested : d));

    try {
      await requestDeviceSync(deviceId, commandId);
      await logActivity({
        businessId: dev.businessId,
        userEmail: userProfile?.email || 'owner@spaceq.io',
        action: 'Requested Display Sync',
        targetType: 'DEVICE',
        targetName: dev.name,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      setDevices(prev => prev.map(d => d.id === deviceId ? {
        ...d,
        status: dev.status,
        lastSyncStatus: 'FAILED',
        lastSyncError: error instanceof Error ? error.message : 'Could not send sync command',
      } : d));
      throw error;
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    setDevices(prev => prev.filter(d => d.id !== deviceId));
    await firestoreDeleteDevice(deviceId);
  };

  const handleAddContent = async (
    title: string,
    type: ContentType,
    url: string,
    durationSeconds: number,
    tags: string[],
    fileSizeBytes?: number,
    transitionEffect?: TransitionEffect,
    pageContent?: PageContent
  ) => {
    const sizeBytes = fileSizeBytes ?? 0;
    const newItem: ContentItem = {
      id: `cnt-${Date.now()}`,
      businessId: selectedBusiness!.id,
      title,
      type,
      url,
      durationSeconds,
      fileSizeBytes: sizeBytes,
      tags,
      transitionEffect: transitionEffect || 'FADE',
      ...(pageContent ? { pageContent } : {}),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setContents(prev => [newItem, ...prev]);
    await saveContent(newItem);

    const sizeMb = sizeBytes / (1024 * 1024);
    const updatedBiz = {
      ...selectedBusiness!,
      totalStorageUsedMb: selectedBusiness!.totalStorageUsedMb + sizeMb,
    };
    setSelectedBusiness(updatedBiz);
    await saveBusiness(updatedBiz);

    await logActivity({
      businessId: selectedBusiness!.id,
      userEmail: userProfile?.email || 'owner@spaceq.io',
      action: 'Uploaded Content Asset',
      targetType: 'CONTENT',
      targetName: title,
      timestamp: new Date().toISOString()
    });
  };

  const handleDeleteContent = async (contentId: string) => {
    setContents(prev => prev.filter(c => c.id !== contentId));
    await firestoreDeleteContent(contentId);
  };

  const handleCreatePlaylist = async (name: string, description: string) => {
    const newPl: Playlist = {
      id: `pl-${Date.now()}`,
      businessId: selectedBusiness!.id,
      name,
      description,
      loop: true,
      shuffle: false,
      items: [],
      schedules: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setPlaylists(prev => [newPl, ...prev]);
    await savePlaylist(newPl);

    await logActivity({
      businessId: selectedBusiness!.id,
      userEmail: userProfile?.email || 'owner@spaceq.io',
      action: 'Created New Playlist',
      targetType: 'PLAYLIST',
      targetName: name,
      timestamp: new Date().toISOString()
    });
  };

  const handleUpdatePlaylist = async (updatedPlaylist: Playlist) => {
    // Every playlist mutation gets a fresh revision timestamp. The kiosk uses
    // this together with the item structure to reset playback immediately when
    // an existing playlist is edited in place.
    const nextPlaylist: Playlist = {
      ...updatedPlaylist,
      updatedAt: new Date().toISOString(),
    };
    await savePlaylist(nextPlaylist);
    setPlaylists(prev => prev.map(p => p.id === nextPlaylist.id ? nextPlaylist : p));
  };

  const handleAddBusiness = async (name: string, brandColor: string) => {
    const newBiz: Business = {
      id: `biz-${Date.now()}`,
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      brandColor,
      createdAt: new Date().toISOString(),
      totalStorageUsedMb: 0,
    };
    setBusinesses(prev => [...prev, newBiz]);
    setSelectedBusiness(newBiz);
    await saveBusiness(newBiz);
  };

  const handleAddLocation = async (businessId: string, name: string, city: string, address: string) => {
    const newLoc: Location = {
      id: `loc-${Date.now()}`,
      businessId,
      name,
      city,
      country: 'India',
      address,
      createdAt: new Date().toISOString(),
    };
    setLocations(prev => [...prev, newLoc]);
    await saveLocation(newLoc);
  };

  const handleHeartbeat = async (deviceId: string) => {
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) return;
    const updated = { ...dev, lastSeenAt: new Date().toISOString() };
    setDevices(prev => prev.map(d => d.id === deviceId ? updated : d));
    await saveDevice(updated);
  };

  // 3. Auth gating: show a real landing/login screen (not a fake dashboard with
  // placeholder data) until the visitor is signed in and has a business.
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        <div className="flex items-center gap-3 text-sm">
          <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          Loading SPACEQ Display…
        </div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return <LandingGate darkMode={darkMode} />;
  }

  if (isAdminEntrance) {
    if (userProfile.role === 'SUPER_ADMIN') {
      return <SuperAdminConsole />;
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950 text-slate-300 p-8 text-center">
        <ShieldOff className="w-10 h-10 text-slate-600" />
        <p className="text-sm font-bold">This area is for platform administrators only.</p>
        <p className="text-xs text-slate-500 max-w-sm">
          Your account ({userProfile.email}) doesn't have Super Admin access. If you're trying to manage your own business, use the normal app link instead of this one.
        </p>
        <button onClick={logout} className="text-xs font-semibold text-rose-400 underline">Sign out</button>
      </div>
    );
  }

  if (!userProfile.businessId) {
    return <BusinessOnboarding darkMode={darkMode} />;
  }

  if (!selectedBusiness) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        <div className="flex items-center gap-3 text-sm">
          <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          Loading your workspace…
        </div>
      </div>
    );
  }

  // Standalone Player Mode
  if (playerDeviceId) {
    const playerDevice = devices.find(d => d.id === playerDeviceId);

    // Never silently substitute a different device here — that's exactly
    // how a device's preview could end up showing another device's split
    // layout if this one hasn't finished syncing into `devices` yet.
    if (!playerDevice) {
      return (
        <div className="fixed inset-0 z-50 bg-black text-white flex flex-col items-center justify-center gap-4">
          <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Loading this display's data…</p>
          <button onClick={() => setPlayerDeviceId(null)} className="text-xs font-semibold text-rose-400 underline">
            Cancel
          </button>
        </div>
      );
    }

    const panePlaylistIds = resolveAllPanePlaylistIds(playerDevice, playlists);
    const panePlaylists = panePlaylistIds.map(id => playlists.find(p => p.id === id));

    return (
      <PlayerView
        key={playerDevice.id}
        device={playerDevice}
        panePlaylists={panePlaylists}
        contents={contents}
        onHeartbeat={handleHeartbeat}
        onExitPlayer={() => setPlayerDeviceId(null)}
        darkMode={darkMode}
      />
    );
  }

  const bizDevices = devices.filter(d => d.businessId === selectedBusiness!.id);
  const onlineDevicesCount = bizDevices.filter(d => effectiveStatus(d) === 'ONLINE').length;
  const totalDevicesCount = bizDevices.length;
  const bizStaleDevices = staleDevices.filter(d => d.businessId === selectedBusiness!.id);

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors ${
      darkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#F8F9FA] text-[#111827]'
    }`}>
      {/* Top Header */}
      <Header
        businesses={visibleBusinesses}
        selectedBusiness={selectedBusiness}
        onSelectBusiness={setSelectedBusiness}
        locations={locations}
        selectedLocationId={selectedLocationId}
        onSelectLocationId={setSelectedLocationId}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onOpenLivePlayer={() => setPlayerDeviceId(devices.find(d => d.businessId === selectedBusiness!.id)?.id || devices[0]?.id || 'dev-8801')}
        activeTab={activeTab}
        onOpenMobileNav={() => setMobileNavOpen(true)}
      />

      <div className="flex-1 flex">
        {/* Left Drawer Navigation */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onlineCount={onlineDevicesCount}
          totalDevicesCount={totalDevicesCount}
          staleCount={bizStaleDevices.length}
          notificationsEnabled={notificationsEnabled}
          onToggleNotifications={handleToggleNotifications}
          darkMode={darkMode}
          isMobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />

        {/* Main Content Stage View */}
        <main className="flex-1 overflow-y-auto">
          {bizStaleDevices.length > 0 && activeTab !== 'devices' && (
            <div className={`mx-6 lg:mx-8 mt-6 p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold ${
              darkMode ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-600'
            }`}>
              <span>
                {bizStaleDevices.length} display{bizStaleDevices.length > 1 ? 's' : ''} not checking in — {bizStaleDevices.slice(0, 3).map(d => d.name).join(', ')}
                {bizStaleDevices.length > 3 ? ` +${bizStaleDevices.length - 3} more` : ''}
              </span>
              <button onClick={() => setActiveTab('devices')} className="underline shrink-0">View Devices</button>
            </div>
          )}
          {activeTab === 'overview' && (
            <DashboardView
              businesses={visibleBusinesses}
              locations={locations}
              devices={devices}
              contents={contents}
              activities={activities}
              selectedBusiness={selectedBusiness}
              darkMode={darkMode}
              onNavigateToDevices={() => setActiveTab('devices')}
              onNavigateToContent={() => setActiveTab('content')}
              onNavigateToPlaylists={() => setActiveTab('playlists')}
              onPairNewDevice={() => setActiveTab('devices')}
            />
          )}

          {activeTab === 'businesses' && (
            <BusinessHierarchyView
              businesses={visibleBusinesses}
              locations={locations}
              devices={devices}
              selectedBusiness={selectedBusiness}
              onSelectBusiness={setSelectedBusiness}
              onAddBusiness={handleAddBusiness}
              onAddLocation={handleAddLocation}
              darkMode={darkMode}
            />
          )}

          {activeTab === 'devices' && (
            <DeviceManagerView
              devices={devices}
              businesses={visibleBusinesses}
              locations={locations}
              playlists={playlists}
              selectedBusiness={selectedBusiness}
              onClaimDevice={handleClaimDevice}
              initialClaimCode={pendingClaimCode}
              onClaimCodeConsumed={() => setPendingClaimCode(null)}
              onUpdateDeviceLayout={handleUpdateDeviceLayout}
              onSyncDevice={handleSyncDevice}
              onDeleteDevice={handleDeleteDevice}
              onLaunchPlayer={(id) => setPlayerDeviceId(id)}
              darkMode={darkMode}
            />
          )}

          {activeTab === 'campaigns' && selectedBusiness && (
            <CampaignHubView businessId={selectedBusiness.id} devices={bizDevices} contents={contents.filter(c => c.businessId === selectedBusiness.id)} darkMode={darkMode} />
          )}

          {activeTab === 'campaign-deployment' && selectedBusiness && (
            <CampaignDeploymentView businessId={selectedBusiness.id} devices={bizDevices} contents={contents.filter(c => c.businessId === selectedBusiness.id)} darkMode={darkMode} />
          )}

          {activeTab === 'content' && (
            <ContentLibraryView
              contents={contents}
              selectedBusiness={selectedBusiness}
              onAddContent={handleAddContent}
              onDeleteContent={handleDeleteContent}
              darkMode={darkMode}
            />
          )}

          {activeTab === 'playlists' && (
            <PlaylistBuilderView
              playlists={playlists}
              contents={contents}
              selectedBusiness={selectedBusiness}
              onUpdatePlaylist={handleUpdatePlaylist}
              onCreatePlaylist={handleCreatePlaylist}
              darkMode={darkMode}
            />
          )}

          {activeTab === 'scrolling' && selectedBusiness && (
            <FeatureEditorView businessId={selectedBusiness.id} devices={bizDevices} darkMode={darkMode} />
          )}

          {activeTab === 'default-layer' && selectedBusiness && (
            <DefaultLayerEditor businessId={selectedBusiness.id} devices={bizDevices} darkMode={darkMode} />
          )}

          {activeTab === 'team' && (
            <TeamView
              selectedBusiness={selectedBusiness}
              darkMode={darkMode}
            />
          )}

          {activeTab === 'announcement' && (
            <AnnouncementView
              devices={bizDevices}
              playlists={playlists.filter(p => p.businessId === selectedBusiness!.id)}
              darkMode={darkMode}
              onLaunch={handleLaunchBroadcast}
              onLand={handleLandBroadcast}
            />
          )}

          {activeTab === 'player' && (
            <div className="p-8 text-center space-y-4">
              <h2 className="text-xl font-bold">Edge Display Player Launcher</h2>
              <p className="text-xs text-slate-400">Launch fullscreen player preview for active smart displays</p>
              {devices.length > 0 ? (
                <button
                  onClick={() => setPlayerDeviceId(devices[0].id)}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all"
                >
                  Launch {devices[0].name || 'Display'} Player
                </button>
              ) : (
                <p className="text-xs text-slate-500">Pair a display first to launch a player preview.</p>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Global Auth & Switcher Modal */}
      <AuthModal darkMode={darkMode} />
    </div>
  );
}

export default function App({ isAdminEntrance = false }: { isAdminEntrance?: boolean }) {
  const reportParams = new URLSearchParams(window.location.search);
  if (reportParams.has('campaignReport')) return <PublicCampaignReport campaignId={reportParams.get('campaignReport') || ''} token={reportParams.get('token') || ''} />;
  return (
    <AuthProvider>
      <MainApplication isAdminEntrance={isAdminEntrance} />
    </AuthProvider>
  );
}
