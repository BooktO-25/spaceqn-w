import React, { useState, useEffect, useRef } from 'react';
import { Business, Location, Device, Playlist, LayoutMode, DeviceZone } from '../types';
import { useAuth } from '../context/AuthContext';
import { can } from '../lib/permissions';
import { effectiveStatus, formatLastSeen } from '../lib/deviceStatus';
import { resolveAllPanePlaylistIds, allAssignedPlaylistIds } from '../lib/scheduling';
import { LAYOUT_TEMPLATES, LAYOUT_TEMPLATE_CATEGORIES, getLayoutTemplate, LayoutTemplate } from '../data/layoutTemplates';
import { 
  Tv, 
  Wifi, 
  WifiOff, 
  Trash2, 
  ExternalLink, 
  PlusCircle, 
  Key, 
  Compass, 
  HardDrive, 
  ListMusic, 
  CheckCircle2,
  Sliders,
  Copy,
  CalendarClock,
  Lock,
  X,
  RefreshCw
} from 'lucide-react';

interface DeviceManagerViewProps {
  devices: Device[];
  businesses: Business[];
  locations: Location[];
  playlists: Playlist[];
  selectedBusiness: Business;
  onClaimDevice: (code: string, name: string, locationId: string, playlistId: string, orientation: 'LANDSCAPE' | 'PORTRAIT', assignedPlaylistIds?: string[]) => Promise<void>;
  initialClaimCode?: string | null;
  onClaimCodeConsumed?: () => void;
  onUpdateDeviceLayout: (deviceId: string, layoutMode: LayoutMode, assignedPlaylistIds: string[], defaultPlaylistId: string, zones: DeviceZone[], rotation: 0 | 90 | 180 | 270, zoneWeights: number[], layoutTemplateId?: string) => void;
  onSyncDevice: (deviceId: string) => Promise<void>;
  onDeleteDevice: (id: string) => void;
  onLaunchPlayer: (deviceId: string) => void;
  darkMode: boolean;
}

export const DeviceManagerView: React.FC<DeviceManagerViewProps> = ({
  devices,
  businesses,
  locations,
  playlists,
  selectedBusiness,
  onClaimDevice,
  initialClaimCode,
  onClaimCodeConsumed,
  onUpdateDeviceLayout,
  onSyncDevice,
  onDeleteDevice,
  onLaunchPlayer,
  darkMode,
}) => {
  const { userProfile } = useAuth();
  const canManage = can(userProfile?.role, 'manageDevices');

  const [showPairModal, setShowPairModal] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [deviceName, setDeviceName] = useState('New Smart Display');
  const [locationId, setLocationId] = useState(locations.filter(l => l.businessId === selectedBusiness.id)[0]?.id || '');
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>(
    playlists.filter(p => p.businessId === selectedBusiness.id)[0]?.id ? [playlists.filter(p => p.businessId === selectedBusiness.id)[0].id] : []
  );
  const [defaultPlaylistId, setDefaultPlaylistId] = useState(playlists.filter(p => p.businessId === selectedBusiness.id)[0]?.id || '');
  const [orientation, setOrientation] = useState<'LANDSCAPE' | 'PORTRAIT'>('LANDSCAPE');
  const [scheduleDeviceId, setScheduleDeviceId] = useState<string | null>(null);
  const [pairError, setPairError] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [syncingDeviceId, setSyncingDeviceId] = useState<string | null>(null);

  // Arrived here via a scanned QR code — jump straight to the pairing form
  // with the code already filled in, no typing required.
  useEffect(() => {
    if (initialClaimCode && canManage) {
      setEnteredCode(initialClaimCode);
      setShowPairModal(true);
      onClaimCodeConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialClaimCode]);

  const filteredDevices = devices.filter(d => d.businessId === selectedBusiness.id);
  const bizLocations = locations.filter(l => l.businessId === selectedBusiness.id);
  const bizPlaylists = playlists.filter(p => p.businessId === selectedBusiness.id);

  const togglePlaylistSelection = (id: string) => {
    setSelectedPlaylistIds(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      if (!next.includes(defaultPlaylistId)) setDefaultPlaylistId(next[0] || '');
      return next;
    });
  };

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = enteredCode.replace(/\s|-/g, '');
    if (!code || !deviceName || !defaultPlaylistId) return;
    setPairError('');
    setIsPairing(true);
    try {
      await onClaimDevice(code, deviceName, locationId, defaultPlaylistId, orientation, selectedPlaylistIds);
      setShowPairModal(false);
      setEnteredCode('');
    } catch (err: any) {
      setPairError(err?.message || 'Could not connect this display.');
    } finally {
      setIsPairing(false);
    }
  };

  const handleSyncClick = async (deviceId: string) => {
    setSyncingDeviceId(deviceId);
    try {
      await onSyncDevice(deviceId);
    } catch (error: any) {
      console.warn('Display sync request failed:', error);
    } finally {
      setSyncingDeviceId(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Smart Display Manager</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Remotely manage, pair, sync, and monitor hardware displays across all commercial locations.
          </p>
        </div>

        {canManage ? (
          <button
            onClick={() => setShowPairModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            <Key className="w-4 h-4" />
            Pair New Display (6-Digit Code)
          </button>
        ) : (
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <Lock className="w-3.5 h-3.5" /> View-only access
          </span>
        )}
      </div>

      {/* Device Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDevices.map((device) => {
          const status = effectiveStatus(device);
          const isOnline = status === 'ONLINE';
          const loc = locations.find(l => l.id === device.locationId);
          const isSplit = device.layoutMode && device.layoutMode !== 'SINGLE';
          const panePlaylistIds = resolveAllPanePlaylistIds(device, playlists);
          const panePlaylistNames = panePlaylistIds.map(id => playlists.find(p => p.id === id)?.name || 'Default Loop');
          const activePl = playlists.find(p => p.id === panePlaylistIds[0]);
          const assignedCount = allAssignedPlaylistIds(device).length;

          return (
            <div
              key={device.id}
              className={`p-6 rounded-2xl border space-y-4 transition-all ${
                darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              } ${status === 'OFFLINE' ? 'ring-1 ring-rose-500/40' : ''}`}
            >
              {/* Card Top Row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                    isOnline 
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    <Tv className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold">{device.name}</h3>
                    <p className="text-[10px] text-slate-400 font-mono">ID: {device.id}</p>
                  </div>
                </div>

                {/* Status Badge */}
                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  isOnline
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                    : device.status === 'PAIRING'
                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30 animate-pulse'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}>
                  {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {status}
                </span>
              </div>

              {/* Specs & Location Info */}
              <div className="space-y-2 text-xs divide-y divide-slate-100 dark:divide-slate-800/60 pt-1">
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Location:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {loc ? `${loc.name} (${loc.city})` : 'Unassigned'}
                  </span>
                </div>

                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Pairing Code:</span>
                  <span className="font-mono font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">
                    {device.pairingCode}
                  </span>
                </div>

                <div className="flex justify-between py-1">
                  <span className="text-slate-400">{isSplit ? 'Playing Now:' : 'Playing Now:'}</span>
                  {isSplit ? (
                    <span className="font-medium text-slate-700 dark:text-slate-200 text-right">
                      {panePlaylistNames.map((n, i) => (
                        <div key={i} className="truncate max-w-[160px]">Z{i + 1}: {n}</div>
                      ))}
                    </span>
                  ) : (
                    <span className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1 truncate max-w-[150px]">
                      <ListMusic className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      {activePl ? activePl.name : 'Default Loop'}
                    </span>
                  )}
                </div>

                {isSplit && (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Screen Split:</span>
                    <span className="font-medium text-blue-400">
                      {device.layoutTemplateId ? (getLayoutTemplate(device.layoutTemplateId)?.name || 'Custom template') : device.layoutMode === 'SPLIT_3' ? '3-way split' : device.layoutMode === 'GRID_4' ? '2×2 grid' : '2-way split'}
                    </span>
                  </div>
                )}

                {!isSplit && assignedCount > 1 && (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Scheduled Playlists:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{assignedCount} assigned</span>
                  </div>
                )}

                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Screen Layout:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5 text-blue-500" />
                    {device.orientation}
                  </span>
                </div>

                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Edge Cache:</span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {device.storageCachedMb.toFixed(1)} MB Cached
                  </span>
                </div>

                {(device.totalPlaybackSeconds || device.totalPlaybackCount) ? (
                  <>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Ad Runtime:</span>
                      <span className="font-mono font-semibold text-emerald-500">
                        {(() => {
                          const total = Math.max(0, Math.floor(device.totalPlaybackSeconds || 0));
                          const h = Math.floor(total / 3600);
                          const m = Math.floor((total % 3600) / 60);
                          const sec = total % 60;
                          return `${h}h ${m}m ${sec}s`;
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Verified Plays:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{device.totalPlaybackCount || 0}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Last Ad:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[170px]">{device.lastPlayedContentTitle || '—'}</span>
                    </div>
                  </>
                ) : null}

                <div className="flex justify-between py-1 text-[10px]">
                  <span className="text-slate-400">Last Seen:</span>
                  <span className={status === 'OFFLINE' ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                    {formatLastSeen(device.lastSeenAt)}
                  </span>
                </div>

                {device.lastSyncAt && (
                  <div className="flex justify-between py-1 text-[10px]">
                    <span className="text-slate-400">Last Sync:</span>
                    <span className={device.lastSyncStatus === 'FAILED' ? 'text-rose-400 font-bold' : device.lastSyncStatus === 'COMPLETED' ? 'text-emerald-500 font-semibold' : 'text-amber-400 font-semibold'}>
                      {device.lastSyncStatus || 'REQUESTED'} · {formatLastSeen(device.lastSyncAt)}
                    </span>
                  </div>
                )}
                {device.lastSyncStatus === 'FAILED' && device.lastSyncError && (
                  <p className="text-[10px] text-rose-400 bg-rose-500/5 border border-rose-500/10 rounded-lg px-2 py-1">
                    {device.lastSyncError}
                  </p>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                <button
                  onClick={() => onLaunchPlayer(device.id)}
                  title="Preview this display inside the dashboard"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Preview
                </button>

                {canManage && (
                  <button
                    onClick={() => void handleSyncClick(device.id)}
                    disabled={syncingDeviceId === device.id}
                    title="Force this display to re-sync configuration and reload"
                    className="p-2 rounded-xl border border-blue-200 dark:border-blue-900/60 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-wait"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingDeviceId === device.id ? 'animate-spin' : ''}`} />
                  </button>
                )}

                {canManage && (
                  <>
                    <button
                      onClick={() => setScheduleDeviceId(device.id)}
                      title="Assign playlists & schedule"
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                    </button>



                    <button
                      onClick={() => onDeleteDevice(device.id)}
                      title="Unpair & Delete Device"
                      className="p-2 rounded-xl border border-rose-200 dark:border-rose-950 text-rose-500 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pairing Modal */}
      {showPairModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg p-6 rounded-2xl border space-y-6 max-h-[90vh] overflow-y-auto ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  <Key className="w-4 h-4" />
                </span>
                <h3 className="text-lg font-extrabold">Connect a Display</h3>
              </div>
              <p className="text-xs text-slate-400">
                On the TV, open <span className="font-mono font-bold text-rose-400">{window.location.origin}/tv</span> — it will show a 6-digit code. Enter that code below.
              </p>
            </div>

            {pairError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                {pairError}
              </div>
            )}

            <form onSubmit={handlePairSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Code Shown On The TV</label>
                <input
                  type="text"
                  required
                  placeholder="482913"
                  value={enteredCode}
                  onChange={(e) => setEnteredCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  className={`w-full p-3 rounded-xl font-mono text-center tracking-widest text-lg font-bold border outline-none ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-rose-400' : 'bg-slate-50 border-slate-200 text-rose-600'
                  }`}
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Device Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Billing Counter TV"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border outline-none ${
                    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Assign Location</label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border outline-none ${
                    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {bizLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.city})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">
                  Assign Playlists <span className="text-slate-500 font-normal">(pick one or more — add time schedules per playlist in Playlists tab for dayparting)</span>
                </label>
                <div className={`space-y-1.5 p-2 rounded-xl border max-h-40 overflow-y-auto ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                  {bizPlaylists.length === 0 && (
                    <p className="text-slate-400 p-2">No playlists yet — create one in the Playlists tab first.</p>
                  )}
                  {bizPlaylists.map(pl => (
                    <label key={pl.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-500/10 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPlaylistIds.includes(pl.id)}
                        onChange={() => togglePlaylistSelection(pl.id)}
                      />
                      <span className="flex-1">{pl.name}</span>
                      {(pl.schedules?.length || 0) > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold">
                          {pl.schedules!.length} schedule{pl.schedules!.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {selectedPlaylistIds.length > 1 && (
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Default / Fallback Playlist</label>
                  <select
                    value={defaultPlaylistId}
                    onChange={(e) => setDefaultPlaylistId(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border outline-none ${
                      darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    {selectedPlaylistIds.map(id => {
                      const pl = bizPlaylists.find(p => p.id === id);
                      return pl ? <option key={id} value={id}>{pl.name}</option> : null;
                    })}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">Plays whenever none of the other playlists' schedules are active.</p>
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Screen Orientation</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setOrientation('LANDSCAPE')}
                    className={`p-3 rounded-xl border font-semibold flex items-center justify-center gap-2 ${
                      orientation === 'LANDSCAPE'
                        ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                        : darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    Landscape 16:9
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation('PORTRAIT')}
                    className={`p-3 rounded-xl border font-semibold flex items-center justify-center gap-2 ${
                      orientation === 'PORTRAIT'
                        ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                        : darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    Portrait 9:16
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPairModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!defaultPlaylistId || isPairing}
                  className="px-5 py-2 rounded-xl bg-rose-600 text-white font-semibold shadow-sm disabled:opacity-50"
                >
                  {isPairing ? 'Connecting…' : 'Confirm & Activate Display'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Playlist Assignment Modal */}
      {scheduleDeviceId && (() => {
        const device = devices.find(d => d.id === scheduleDeviceId);
        if (!device) return null;
        const initialAssigned = device.assignedPlaylistIds?.length ? device.assignedPlaylistIds : (device.activePlaylistId ? [device.activePlaylistId] : []);
        return (
          <EditDeviceLayoutModal
            device={device}
            bizPlaylists={bizPlaylists}
            initialAssigned={initialAssigned}
            darkMode={darkMode}
            onClose={() => setScheduleDeviceId(null)}
            onSave={(layoutMode, singleAssigned, singleDefault, zones, rotation, zoneWeights, layoutTemplateId) => {
              onUpdateDeviceLayout(device.id, layoutMode, singleAssigned, singleDefault, zones, rotation, zoneWeights, layoutTemplateId);
              setScheduleDeviceId(null);
            }}
          />
        );
      })()}
    </div>
  );
};

/** A checklist of playlists to assign + a default/fallback picker. Used once
 * for a normal full-screen device, or once per zone for a split layout. */

const LAYOUT_OPTIONS: { value: LayoutMode; label: string; zones: number }[] = [
  { value: 'SINGLE', label: 'Full Screen', zones: 1 },
  { value: 'SPLIT_2', label: 'Split 2', zones: 2 },
  { value: 'SPLIT_3', label: 'Split 3', zones: 3 },
  { value: 'GRID_4', label: 'Grid 2×2', zones: 4 },
];

/** Small thumbnail preview of a layout template, shown on its picker button. */
const LayoutPreviewIcon: React.FC<{ mode: LayoutMode; orientation: 'LANDSCAPE' | 'PORTRAIT'; active: boolean }> = ({ mode, orientation, active }) => {
  const color = active ? 'bg-rose-500' : 'bg-slate-500';
  const border = active ? 'border-rose-500/50' : 'border-slate-600';

  if (mode === 'GRID_4') {
    return (
      <div className={`w-9 h-6 rounded border grid grid-cols-2 grid-rows-2 gap-[2px] p-[2px] ${border}`}>
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`rounded-sm ${color} opacity-70`} />)}
      </div>
    );
  }
  const count = mode === 'SPLIT_3' ? 3 : mode === 'SPLIT_2' ? 2 : 1;
  const isPortraitStack = orientation === 'PORTRAIT';
  return (
    <div className={`w-9 h-6 rounded border flex ${isPortraitStack ? 'flex-col' : 'flex-row'} gap-[2px] p-[2px] ${border}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`flex-1 rounded-sm ${color} opacity-70`} />
      ))}
    </div>
  );
};

const TemplatePreview: React.FC<{
  template: LayoutTemplate;
  active?: boolean;
  compact?: boolean;
  orientation?: 'LANDSCAPE' | 'PORTRAIT';
}> = ({ template, active = false, compact = false, orientation = 'LANDSCAPE' }) => {
  const names: string[] = Array.from(new Set<string>(template.areas.flatMap(row => row.trim().split(/\s+/))));
  const aspect = orientation === 'PORTRAIT' ? 'aspect-[9/16]' : 'aspect-[16/9]';
  return (
    <div
      className={`${compact ? 'w-full max-w-[108px]' : 'w-full'} ${aspect} rounded-xl overflow-hidden border grid gap-1 p-1 transition-all ${
        active ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/5' : 'border-slate-700 bg-slate-950'
      }`}
      style={{
        gridTemplateColumns: `repeat(${template.columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${template.rows}, minmax(0, 1fr))`,
        gridTemplateAreas: template.areas.map(row => `'${row.trim().replace(/\s+/g, ' ')}'`).join(' '),
      }}
      aria-label={`${template.name} preview`}
    >
      {names.map((name, i) => {
        const cellCount = template.areas.flatMap(row => row.trim().split(/\s+/)).filter(v => v === name).length;
        return (
          <div
            key={name}
            className={`min-w-0 min-h-0 rounded-md flex items-center justify-center text-[8px] font-bold ${
              i === 0 ? 'bg-rose-500/75' : 'bg-slate-700/90'
            } text-white`}
            style={{ gridArea: name }}
          >
            {!compact && (cellCount > 1 ? 'MAIN' : name.replace('z', ''))}
          </div>
        );
      })}
    </div>
  );
};

/** Browse-and-search gallery for the 128 preset grid templates — an
 * alternative to the 4 basic layouts above, for anyone who wants a more
 * elaborate arrangement (an asymmetric "featured" zone, a mosaic, etc.)
 * without hand-building it. */
const TemplateLibrary: React.FC<{
  selectedId?: string;
  darkMode: boolean;
  orientation: 'LANDSCAPE' | 'PORTRAIT';
  onSelect: (template: LayoutTemplate) => void;
}> = ({ selectedId, darkMode, orientation, onSelect }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'ALL' | typeof LAYOUT_TEMPLATE_CATEGORIES[number]>('ALL');
  const selected = getLayoutTemplate(selectedId);
  const filtered = LAYOUT_TEMPLATES.filter(t =>
    (category === 'ALL' || t.category === category) &&
    `${t.name} ${t.description}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className={`rounded-2xl border p-3 ${darkMode ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold">More layouts (128 templates)</div>
          {selected ? (
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">Selected: <span className="font-semibold">{selected.name}</span> · {selected.zoneCount} zones</div>
          ) : (
            <div className="text-[10px] text-slate-500 mt-0.5">Browse asymmetric, mosaic, and editorial layouts.</div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 px-3 py-2 rounded-lg bg-rose-500 text-white text-[10px] font-bold hover:bg-rose-600 transition-colors"
        >
          {selected ? 'Change template' : 'Browse templates'}
        </button>
      </div>

      {selected && (
        <div className="mt-3 flex items-center gap-3">
          <div className="w-24 shrink-0">
            <TemplatePreview template={selected} active orientation={orientation} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold truncate">{selected.name}</div>
            <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{selected.description}</div>
            <div className="text-[9px] text-slate-500 mt-1">{selected.columns}×{selected.rows} · {selected.zoneCount} zones · {selected.category}</div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-4xl max-h-[88vh] rounded-2xl border shadow-2xl overflow-hidden ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className={`px-5 py-4 border-b flex items-center justify-between gap-4 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div>
                <div className="text-sm font-bold">Choose a grid template</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Pick one and continue.</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg border text-slate-500 hover:text-slate-900 dark:hover:text-white">×</button>
            </div>

            <div className={`p-4 border-b ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  autoFocus
                  placeholder="Search layouts…"
                  className={`flex-1 px-3 py-2.5 rounded-lg border text-xs outline-none ${darkMode ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                />
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {(['ALL', ...LAYOUT_TEMPLATE_CATEGORIES] as const).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c as any)}
                      className={`px-3 py-2 rounded-lg text-[10px] font-bold whitespace-nowrap border ${
                        category === c ? 'border-rose-500 bg-rose-500/10 text-rose-500' : darkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'
                      }`}
                    >{c === 'ALL' ? 'All' : c}</button>
                  ))}
                </div>
              </div>
              <div className="mt-2 text-[9px] text-slate-500">{filtered.length} layouts available</div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[58vh]">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filtered.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { onSelect(t); setOpen(false); }}
                    className={`text-left rounded-xl border p-2.5 transition-all ${
                      selectedId === t.id
                        ? 'border-rose-500 bg-rose-500/10 ring-1 ring-rose-500/20'
                        : darkMode ? 'border-slate-800 bg-slate-950 hover:border-slate-600' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <TemplatePreview template={t} compact orientation={orientation} active={selectedId === t.id} />
                    <div className="mt-2 text-[10px] font-bold truncate">{t.name}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">{t.zoneCount} zones · {t.category}</div>
                  </button>
                ))}
              </div>
              {filtered.length === 0 && (
                <div className="py-12 text-center text-xs text-slate-500">No templates match your search.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** A draggable chip representing one playlist — dragged from the tray and
 * dropped onto a zone in the visual canvas below. */
/** One zone box inside the visual canvas: shows assigned playlists as small
 * pills. Highlight state (whether a drag is currently over it) is computed
 * by the parent drag controller and passed in — this component itself has
 * no drag logic, so it behaves identically for mouse and touch. */
/** A checklist of playlists to assign to one zone + a default/fallback
 * picker. Plain checkboxes and a dropdown — no drag gestures involved, so
 * it behaves identically on a phone, tablet, or desktop with a mouse. */
const PlaylistPicker: React.FC<{
  bizPlaylists: Playlist[];
  assigned: string[];
  defaultId: string;
  onToggle: (id: string) => void;
  onDefaultChange: (id: string) => void;
  darkMode: boolean;
}> = ({ bizPlaylists, assigned, defaultId, onToggle, onDefaultChange, darkMode }) => (
  <>
    <div className={`space-y-1.5 p-2 rounded-xl border max-h-44 overflow-y-auto text-xs ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
      {bizPlaylists.length === 0 && (
        <p className="text-slate-400 p-2">No playlists yet — create one in the Playlists tab first.</p>
      )}
      {bizPlaylists.map(pl => (
        <label key={pl.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-500/10 cursor-pointer">
          <input type="checkbox" checked={assigned.includes(pl.id)} onChange={() => onToggle(pl.id)} className="w-4 h-4 shrink-0" />
          <span className="flex-1">{pl.name}</span>
          {(pl.schedules?.length || 0) > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold">
              {pl.schedules!.length} schedule{pl.schedules!.length > 1 ? 's' : ''}
            </span>
          )}
        </label>
      ))}
    </div>

    {assigned.length > 0 && (
      <div className="mt-2">
        <label className="block text-slate-400 mb-1 text-xs font-medium">Default / Fallback Playlist</label>
        <select
          value={defaultId}
          onChange={(e) => onDefaultChange(e.target.value)}
          className={`w-full p-2.5 rounded-xl border outline-none text-xs ${
            darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}
        >
          {assigned.map(id => {
            const pl = bizPlaylists.find(p => p.id === id);
            return pl ? <option key={id} value={id}>{pl.name}</option> : null;
          })}
        </select>
      </div>
    )}
  </>
);

const EditDeviceLayoutModal: React.FC<{
  device: Device;
  bizPlaylists: Playlist[];
  initialAssigned: string[];
  darkMode: boolean;
  onClose: () => void;
  onSave: (layoutMode: LayoutMode, singleAssigned: string[], singleDefault: string, zones: DeviceZone[], rotation: 0 | 90 | 180 | 270, zoneWeights: number[], layoutTemplateId?: string) => void;
}> = ({ device, bizPlaylists, initialAssigned, darkMode, onClose, onSave }) => {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(device.layoutTemplateId ? 'CUSTOM' : (device.layoutMode || 'SINGLE'));
  const [layoutTemplateId, setLayoutTemplateId] = useState<string | undefined>(device.layoutTemplateId);
  const selectedTemplate = getLayoutTemplate(layoutTemplateId);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(device.rotation || 0);

  const zoneCount = selectedTemplate?.zoneCount || LAYOUT_OPTIONS.find(o => o.value === layoutMode)?.zones || 1;
  const [zoneWeights, setZoneWeights] = useState<number[]>(
    device.zoneWeights?.length ? [...device.zoneWeights, 1, 1, 1].slice(0, 4) : [1, 1, 1, 1]
  );

  // Single (full-screen) state
  const [assigned, setAssigned] = useState<string[]>(
    device.layoutMode === 'SINGLE' || !device.layoutMode ? initialAssigned : []
  );
  const [defaultId, setDefaultId] = useState(
    device.layoutMode === 'SINGLE' || !device.layoutMode ? (device.activePlaylistId || initialAssigned[0] || '') : ''
  );

  // Split/grid state — one entry per possible zone. Seeded from the
  // device's REAL current zones ONLY when the zone count matches —
  // otherwise starts empty rather than mis-mapping mismatched data.
  const makeInitialZones = (): DeviceZone[] => {
    const currentCount = device.layoutTemplateId
      ? (getLayoutTemplate(device.layoutTemplateId)?.zoneCount || 0)
      : (LAYOUT_OPTIONS.find(o => o.value === (device.layoutMode || 'SINGLE'))?.zones || 1);
    if (device.zones?.length === currentCount && currentCount > 1) return device.zones;
    return [];
  };
  const [zones, setZones] = useState<DeviceZone[]>(() => {
    const seeded = makeInitialZones();
    if (seeded.length === zoneCount) return seeded;
    return Array.from({ length: zoneCount }, (_, i) => ({ id: `zone-${i}`, assignedPlaylistIds: [], defaultPlaylistId: '' }));
  });
  const [activeZoneTab, setActiveZoneTab] = useState(0);

  const handleLayoutChange = (mode: LayoutMode) => {
    setLayoutMode(mode);
    setLayoutTemplateId(undefined);
    const count = LAYOUT_OPTIONS.find(o => o.value === mode)?.zones || 1;
    setActiveZoneTab(0);
    if (mode === 'SINGLE') return; // uses `assigned`/`defaultId` state, untouched here
    setZones(prev => {
      if (prev.length === count) return prev;
      const next = Array.from({ length: count }, (_, i) => prev[i] || { id: `zone-${i}`, assignedPlaylistIds: [], defaultPlaylistId: '' });
      return next;
    });
  };

  const handleTemplateSelect = (template: LayoutTemplate) => {
    setLayoutMode('CUSTOM');
    setLayoutTemplateId(template.id);
    setActiveZoneTab(0);
    setZones(prev => Array.from({ length: template.zoneCount }, (_, i) => prev[i] || { id: `zone-${i}`, assignedPlaylistIds: [], defaultPlaylistId: '' }));
  };

  const toggleSingle = (id: string) => {
    setAssigned(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      if (!next.includes(defaultId)) setDefaultId(next[0] || '');
      return next;
    });
  };

  const toggleZonePlaylist = (zoneIndex: number, id: string) => {
    setZones(prev => prev.map((z, i) => {
      if (i !== zoneIndex) return z;
      const next = z.assignedPlaylistIds.includes(id)
        ? z.assignedPlaylistIds.filter(p => p !== id)
        : [...z.assignedPlaylistIds, id];
      const nextDefault = next.includes(z.defaultPlaylistId) ? z.defaultPlaylistId : (next[0] || '');
      return { ...z, assignedPlaylistIds: next, defaultPlaylistId: nextDefault };
    }));
  };
  const setZoneDefault = (zoneIndex: number, id: string) => {
    setZones(prev => prev.map((z, i) => (i === zoneIndex ? { ...z, defaultPlaylistId: id } : z)));
  };

  const canSave = layoutMode === 'SINGLE' ? !!defaultId : zones.every(z => z.defaultPlaylistId);

  const handleSubmit = () => {
    if (!canSave) return;
    if (layoutMode === 'SINGLE') {
      onSave(layoutMode, assigned, defaultId, [], rotation, [], undefined);
    } else {
      onSave(layoutMode, [], '', zones, rotation, zoneWeights.slice(0, zoneCount), layoutTemplateId);
    }
  };

  const isEqualWeights = (w: number[]) => w.slice(0, zoneCount).every(v => v === w[0]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className={`w-full max-w-lg p-4 sm:p-6 rounded-2xl border space-y-5 max-h-[95vh] overflow-y-auto ${
        darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div>
          <h3 className="text-base font-bold">Screen Layout & Playlists — {device.name}</h3>
          <p className="text-[11px] text-slate-400 mt-1">
            Pick a layout, then check off which playlists play in each zone. Add time-of-day schedules to a playlist from the Playlists tab.
          </p>
        </div>

        <div>
          <label className="block text-slate-400 mb-1.5 text-xs font-medium">Screen Layout</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {LAYOUT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleLayoutChange(opt.value)}
                className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-colors ${
                  layoutMode === opt.value
                    ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                    : darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <LayoutPreviewIcon mode={opt.value} orientation={device.orientation} active={layoutMode === opt.value} />
                {opt.label}
              </button>
            ))}
          </div>
          {layoutMode !== 'SINGLE' && layoutMode !== 'CUSTOM' && (
            <p className="text-[10px] text-slate-500 mt-1.5">
              {device.orientation === 'PORTRAIT' ? 'Zones stack top to bottom.' : 'Zones sit side by side.'}
            </p>
          )}

          <div className="mt-3">
            <TemplateLibrary
              selectedId={layoutTemplateId}
              darkMode={darkMode}
              orientation={device.orientation}
              onSelect={handleTemplateSelect}
            />
          </div>
        </div>

        {layoutMode === 'SINGLE' ? (
          <PlaylistPicker
            bizPlaylists={bizPlaylists}
            assigned={assigned}
            defaultId={defaultId}
            onToggle={toggleSingle}
            onDefaultChange={setDefaultId}
            darkMode={darkMode}
          />
        ) : (
          <div>
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {Array.from({ length: zoneCount }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveZoneTab(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    activeZoneTab === i
                      ? 'bg-rose-600 text-white'
                      : darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Zone {i + 1}
                  {!zones[i]?.defaultPlaylistId && <span className="ml-1 text-amber-400">•</span>}
                </button>
              ))}
            </div>
            <PlaylistPicker
              bizPlaylists={bizPlaylists}
              assigned={zones[activeZoneTab]?.assignedPlaylistIds || []}
              defaultId={zones[activeZoneTab]?.defaultPlaylistId || ''}
              onToggle={(id) => toggleZonePlaylist(activeZoneTab, id)}
              onDefaultChange={(id) => setZoneDefault(activeZoneTab, id)}
              darkMode={darkMode}
            />

            {layoutMode !== 'GRID_4' && layoutMode !== 'CUSTOM' && (
              <div className="mt-4">
                <label className="block text-slate-400 mb-1.5 text-xs font-medium">Zone Sizes</label>
                <div className="flex gap-2 flex-wrap">
                  {(zoneCount === 2
                    ? [{ label: 'Equal', w: [1, 1] }, { label: 'Main 70/30', w: [7, 3] }, { label: 'Main 60/40', w: [3, 2] }]
                    : [{ label: 'Equal', w: [1, 1, 1] }, { label: 'Center Focus', w: [1, 2, 1] }, { label: 'Main + 2', w: [4, 1, 1] }]
                  ).map(preset => {
                    const isActive = JSON.stringify(zoneWeights.slice(0, zoneCount)) === JSON.stringify(preset.w);
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setZoneWeights(preset.w)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                          isActive
                            ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                            : darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-slate-400 mb-1.5 text-xs font-medium">Physical Screen Rotation</label>
          <p className="text-[10px] text-slate-500 mb-1.5">If the TV is mounted sideways, rotate the output to match — the content itself doesn't need to change.</p>
          <div className="grid grid-cols-4 gap-2">
            {([0, 90, 180, 270] as const).map(deg => (
              <button
                key={deg}
                type="button"
                onClick={() => setRotation(deg)}
                className={`py-2 rounded-xl border text-[11px] font-bold transition-colors ${
                  rotation === deg
                    ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                    : darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                {deg}°
              </button>
            ))}
          </div>
        </div>

        {!canSave && (
          <p className="text-[10px] text-amber-500 font-semibold">
            {layoutMode === 'SINGLE' ? 'Pick at least one playlist before you can save.' : 'Every zone needs a playlist before you can save.'}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2 text-xs">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSave}
            className="px-5 py-2 rounded-xl bg-rose-600 text-white font-semibold shadow-sm disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
