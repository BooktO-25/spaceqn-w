import React, { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, increment, collection, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Device, Playlist, ContentItem } from '../types';
import { PlayerView } from './PlayerView';
import { resolveAllPanePlaylistIds, allAssignedPlaylistIds } from '../lib/scheduling';
import { Tv, Copy, CheckCircle2, Maximize } from 'lucide-react';
import QRCode from 'qrcode';

const STORAGE_KEY = 'spaceq_device_id';
const APP_VERSION = 'v2.2.2-kiosk';
const OFFLINE_SNAPSHOT_KEY = 'spaceq_offline_cycle_v1';

function generateCode(): string {
  // 6-digit numeric code, easy to read and type from across a room.
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * The TV/kiosk entry point. Every physical display opens the exact same
 * fixed URL (no device ID, no business ID, nothing identifying in the URL
 * at all). On first load it mints its own 6-digit pairing code, creates an
 * unclaimed placeholder device doc using that code as its permanent ID, and
 * displays the code full-screen. A Business Owner enters that code once in
 * their dashboard to claim it. From then on this same browser reconnects to
 * the same device ID forever (stored in localStorage) — no new code is ever
 * generated again unless the device is unpaired/deleted or local storage is
 * cleared, matching "don't regenerate while still active."
 *
 * Crucially: this never calls Firebase Auth (no signInAnonymously). Reusing
 * the same Auth session for kiosk + dashboard was what caused real logins to
 * get silently clobbered when a kiosk tab was open — removing auth from this
 * path entirely fixes that at the root.
 */
export const KioskDisplay: React.FC = () => {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [device, setDevice] = useState<Device | null | undefined>(undefined); // undefined = loading
  const [scrollingConfig, setScrollingConfig] = useState<any>(null);
  const [assignedPlaylists, setAssignedPlaylists] = useState<Playlist[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [remoteSyncing, setRemoteSyncing] = useState(false);
  const syncCommandInFlightRef = useRef<string | null>(null);
  // Forgets this device's identity and starts over with a brand-new code.
  // Used only when the device is explicitly deleted/unpaired from the dashboard.
  const resetPairing = () => {
    localStorage.removeItem(STORAGE_KEY);
    setDeviceId(null);
    setDevice(undefined);
    setAssignedPlaylists([]);
    setContents([]);
  };

  // Re-check schedules every 20s so dayparting takes effect live.
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(interval);
  }, []);

  // 1. Establish (or reuse) this device's permanent ID.
  // Establishes (or reuses) this device's permanent ID. Runs on initial
  // mount and again only when an explicit unpair/delete clears the local ID.
  useEffect(() => {
    if (deviceId !== null) return; // already have one, nothing to do

    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      setDeviceId(existing);
      return;
    }

    let cancelled = false;
    const create = async () => {
      // Extremely small chance of collision on a 6-digit code; retry a
      // couple of times with a fresh code if the doc somehow already exists.
      for (let attempt = 0; attempt < 5; attempt++) {
        if (cancelled) return;
        const code = generateCode();
        const ref = doc(db, 'devices', code);
        try {
          await setDoc(ref, {
            id: code,
            pairingCode: code,
            name: 'Unpaired Display',
            businessId: '',
            locationId: '',
            status: 'PAIRING',
            orientation: 'LANDSCAPE',
            ipAddress: '',
            appVersion: APP_VERSION,
            lastSeenAt: new Date().toISOString(),
            registeredAt: new Date().toISOString(),
            storageCachedMb: 0,
            tags: [],
          }, { merge: false });
          if (cancelled) return;
          localStorage.setItem(STORAGE_KEY, code);
          setDeviceId(code);
          return;
        } catch (err) {
          // Rules reject this if a doc with that code already exists (see
          // firestore.rules) — just try another code.
          continue;
        }
      }
      console.error('Could not generate a pairing code after several attempts. Will retry automatically.');
    };
    create();
    return () => { cancelled = true; };
  }, [deviceId]);

  // Restore the last known complete cycle immediately so a reboot with no
  // internet still has a device, playlist and content snapshot to render.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(OFFLINE_SNAPSHOT_KEY);
      if (!raw) return;
      const snapshot = JSON.parse(raw);
      if (snapshot.device) setDevice(snapshot.device as Device);
      if (Array.isArray(snapshot.assignedPlaylists)) setAssignedPlaylists(snapshot.assignedPlaylists as Playlist[]);
      if (Array.isArray(snapshot.contents)) setContents(snapshot.contents as ContentItem[]);
    } catch (err) {
      console.warn('Offline snapshot restore failed:', err);
    }
  }, []);

  // 2. Subscribe to our own device doc once we have an ID.
  useEffect(() => {
    if (!deviceId) return;
    const unsub = onSnapshot(
      doc(db, 'devices', deviceId),
      snap => {
        if (!snap.exists()) {
          // Unpaired / deleted from the dashboard — forget this ID and
          // start over with a brand-new code, no restart needed.
          resetPairing();
          return;
        }
        setDevice({ id: snap.id, ...snap.data() } as Device);
      },
      err => {
        console.error('Device subscription error:', err);
        // A transient listener error must never destroy the device identity.
        // Firestore will reconnect the listener when the network recovers.
      }
    );
    return () => unsub();
  }, [deviceId]);

  // Remote troubleshooting sync. The dashboard writes a unique command ID to
  // the device document. The kiosk consumes it once, acknowledges it, then
  // acknowledges it once and lets the existing Firestore listeners reconcile
  // the device without reloading the WebView. This keeps the current frame
  // visible and makes the console Sync button a non-destructive troubleshoot
  // action. The completed marker prevents repeat consumption.
  useEffect(() => {
    const commandId = device?.syncCommandId;
    if (!deviceId || !commandId || !device) return;
    if (device.lastSyncCommandId === commandId && device.lastSyncStatus === 'COMPLETED') return;
    if (syncCommandInFlightRef.current === commandId) return;

    syncCommandInFlightRef.current = commandId;
    setRemoteSyncing(true);

    const runRemoteSync = async () => {
      try {
        await updateDoc(doc(db, 'devices', deviceId), {
          status: 'SYNCING',
          lastSyncCommandId: commandId,
          lastSyncAt: new Date().toISOString(),
          lastSyncStatus: 'COMPLETED',
          lastSyncError: '',
        });
        // Do NOT reload the WebView. A full-page reload causes a visible
        // blackout/flicker and re-creates every media element. Firestore
        // listeners already receive the latest device/playlist/content state.
        // Keep the current frame playing while those listeners settle.
        await new Promise(resolve => setTimeout(resolve, 350));
      } catch (error: any) {
        console.warn('Remote sync failed:', error);
        try {
          await updateDoc(doc(db, 'devices', deviceId), {
            status: 'ONLINE',
            lastSyncCommandId: commandId,
            lastSyncAt: new Date().toISOString(),
            lastSyncStatus: 'FAILED',
            lastSyncError: error?.message || 'Remote sync failed',
          });
        } catch {
          // If the network is unavailable there is nothing else to write.
        }
        syncCommandInFlightRef.current = null;
        setRemoteSyncing(false);
      }
    };

    void runRemoteSync();
  }, [deviceId, device?.syncCommandId, device?.lastSyncCommandId, device?.lastSyncStatus]);

  // IMPORTANT: do not reset pairing just because Firestore has been quiet.
  // onSnapshot only emits when the document changes; a healthy device can
  // legitimately receive no document event for longer than 45 seconds.
  // Resetting the pairing ID here used to create new devices during transient
  // network/background-throttling periods and was a major source of "old
  // screen / wrong device" behaviour. A real missing device is handled by
  // the explicit !snap.exists() path above.
  // 3. Once claimed (has a businessId), subscribe to every playlist assigned
  // to any zone (or the whole screen, for a normal SINGLE-layout device).
  useEffect(() => {
    if (!device || !device.businessId) {
      setAssignedPlaylists([]);
      return;
    }

    const assignedIds = allAssignedPlaylistIds(device);

    // Remove playlists that are no longer deployed to this device immediately.
    // Without this, an old playlist could remain in memory after a layout/schedule
    // change and continue to be rendered until the page was refreshed.
    setAssignedPlaylists(prev => prev.filter(p => assignedIds.includes(p.id)));

    if (assignedIds.length === 0) {
      setAssignedPlaylists([]);
      return;
    }

    const unsubs = assignedIds.map(id =>
      onSnapshot(
        doc(db, 'playlists', id),
        snap => {
          if (!snap.exists()) {
            setAssignedPlaylists(prev => prev.filter(p => p.id !== id));
            return;
          }
          const pl = { id: snap.id, ...snap.data() } as Playlist;
          setAssignedPlaylists(prev => {
            const next = prev.filter(p => p.id !== pl.id);
            next.push(pl);
            return next;
          });
        },
        err => console.warn(`Playlist ${id} subscription error:`, err)
      )
    );

    return () => unsubs.forEach(u => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device?.businessId, device?.assignedPlaylistIds?.join(','), device?.activePlaylistId, device?.layoutMode, JSON.stringify(device?.zones)]);

  const panePlaylistIds = device ? resolveAllPanePlaylistIds(device, assignedPlaylists, now) : [undefined];
  const panePlaylists = panePlaylistIds.map(id => assignedPlaylists.find(p => p.id === id));

  // 4. Subscribe to content referenced by all assigned playlists, by exact ID.
  useEffect(() => {
    const contentIds: string[] = Array.from(new Set<string>(
      assignedPlaylists
        .flatMap(p => p.items || [])
        .map(i => i.contentId)
        .filter((id): id is string => Boolean(id))
    ));

    // Prune content that is no longer referenced by any active playlist.
    // This prevents deleted/replaced content from surviving in player memory.
    setContents(prev => prev.filter(c => contentIds.includes(c.id)));

    if (contentIds.length === 0) {
      setContents([]);
      return;
    }

    const unsubs = contentIds.map(id =>
      onSnapshot(
        doc(db, 'contents', id),
        snap => {
          if (!snap.exists()) {
            setContents(prev => prev.filter(c => c.id !== id));
            return;
          }
          const item = { id: snap.id, ...snap.data() } as ContentItem;
          setContents(prev => {
            const next = prev.filter(c => c.id !== item.id);
            next.push(item);
            return next;
          });
        },
        err => console.warn(`Content ${id} subscription error:`, err)
      )
    );

    return () => unsubs.forEach(u => u());
    // Rebuild subscriptions when the actual referenced content IDs change,
    // not merely when the playlist IDs stay the same.
  }, [assignedPlaylists.map(p => p.items?.map(i => i.contentId).join(',') || '').join('|')]);

  // Persist the last complete cycle. A transient Firestore disconnect must
  // never erase the only known-good offline state.
  useEffect(() => {
    if (!device?.businessId || assignedPlaylists.length === 0 || contents.length === 0) return;
    try {
      localStorage.setItem(OFFLINE_SNAPSHOT_KEY, JSON.stringify({
        savedAt: Date.now(),
        device,
        assignedPlaylists,
        contents,
      }));
    } catch (err) {
      console.warn('Offline snapshot save failed:', err);
    }
  }, [device, assignedPlaylists, contents]);

  // Proactively download all assigned image/video assets into the native cache.
  // This runs in the background and never blocks current playback.
  useEffect(() => {
    if (!device?.businessId) return;
    for (const item of contents) {
      if (item.type !== 'IMAGE' && item.type !== 'VIDEO') continue;
      try { (window as any).SpaceQNative?.cacheMedia?.(item.url); } catch {}
    }
  }, [device?.businessId, contents]);

  // 5. Heartbeat + playback telemetry. The kiosk is unauthenticated, so
  // Firestore rules intentionally allow only the specific fields touched
  // below (see firestore.rules — the heartbeat rule's allowed-field list).
  // Playback time is conservative: only time the player was actually
  // showing that item counts, and it's capped so a stuck clock can't
  // credit runaway numbers.
  const playbackRef = useRef<{ contentId: string; title: string; durationSeconds: number; startedAtMs: number } | null>(null);
  const playbackFlushInFlightRef = useRef(false);

  const flushPlaybackTelemetry = async (countPlay: boolean, resetClock: boolean = true) => {
    if (!deviceId || !playbackRef.current || playbackFlushInFlightRef.current) return;
    const current = playbackRef.current;
    const elapsed = Math.max(0, Math.min((Date.now() - current.startedAtMs) / 1000, Math.max(current.durationSeconds + 5, 10)));
    if (elapsed < 0.25) return;

    playbackFlushInFlightRef.current = true;
    try {
      await updateDoc(doc(db, 'devices', deviceId), {
        totalPlaybackSeconds: increment(Math.round(elapsed * 10) / 10),
        ...(countPlay ? { totalPlaybackCount: increment(1) } : {}),
        lastPlaybackAt: new Date().toISOString(),
        lastPlayedContentId: current.contentId,
        lastPlayedContentTitle: current.title,
        lastPlaybackDurationSeconds: Math.round(elapsed * 10) / 10,
      });
      if (resetClock && playbackRef.current?.contentId === current.contentId) {
        playbackRef.current = { ...current, startedAtMs: Date.now() };
      }
    } catch (err) {
      console.warn('Playback telemetry failed (requires the extended Firestore rule — see docs):', err);
    } finally {
      playbackFlushInFlightRef.current = false;
    }
  };

  const handlePlaybackStart = (event: { contentId: string; title: string; durationSeconds: number }) => {
    const previous = playbackRef.current;
    if (previous) {
      void flushPlaybackTelemetry(true);
    }
    playbackRef.current = { ...event, startedAtMs: Date.now() };
  };

  useEffect(() => {
    if (!deviceId || !device) return;
    const beat = async () => {
      await flushPlaybackTelemetry(false);
      updateDoc(doc(db, 'devices', deviceId), {
        lastSeenAt: new Date().toISOString(),
        status: device.businessId ? 'ONLINE' : 'PAIRING',
      }).catch(err => console.warn('Heartbeat failed:', err));
    };
    beat();
    const interval = setInterval(beat, 30000);
    return () => clearInterval(interval);
  }, [deviceId, device?.businessId]);

  const handleCopyCode = () => {
    if (!device?.pairingCode) return;
    navigator.clipboard?.writeText(device.pairingCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate a QR code that deep-links straight into the claim flow — scan
  // it on a phone/laptop already signed in and it jumps right to "confirm
  // this display" with the code pre-filled, no typing required.
  useEffect(() => {
    if (!device?.pairingCode || device.businessId) {
      setQrDataUrl(null);
      return;
    }
    const claimUrl = `${window.location.origin}/?claim=${device.pairingCode}`;
    QRCode.toDataURL(claimUrl, {
      width: 260,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(err => console.warn('QR generation failed:', err));
  }, [device?.pairingCode, device?.businessId]);

  useEffect(() => {
    if (!device?.businessId) { setScrollingConfig(null); return; }
    const q = query(collection(db, 'scrollingMessages'), where('businessId', '==', device.businessId));
    return onSnapshot(q, snapshot => {
      const configs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const selected = configs.find(c => c.scope === 'DEVICES' && c.enabled && (c.deviceIds || []).includes(device.id));
      const global = configs.find(c => c.scope === 'GLOBAL' && c.enabled);
      setScrollingConfig(selected || global || null);
    }, error => console.warn('Scrolling message listener:', error));
  }, [device?.businessId, device?.id]);

  // --- Render states ---

  if (!deviceId || device === undefined) {
    return (
      <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-center gap-4">
        <Tv className="w-10 h-10 text-slate-500 animate-pulse" />
        <p className="text-xs text-slate-400">Connecting to SPACEQ Cloud…</p>
      </div>
    );
  }

  if (device && device.businessId) {
    // Claimed — play content.
    return (
      <div className="fixed inset-0">
        <PlayerView
          device={device}
          panePlaylists={panePlaylists}
          contents={contents}
          onHeartbeat={() => {}}
          darkMode={true}
          kioskMode
          onPlaybackStart={handlePlaybackStart}
        />
        {scrollingConfig?.enabled && scrollingConfig.message && (
          <div className={`pointer-events-none absolute left-0 right-0 z-[60] overflow-hidden whitespace-nowrap py-2 ${scrollingConfig.position === 'TOP' ? 'top-0' : scrollingConfig.position === 'MIDDLE' ? 'top-1/2 -translate-y-1/2' : 'bottom-0'}`}
            style={{ backgroundColor: scrollingConfig.backgroundColor || 'transparent', color: scrollingConfig.color || '#fff', fontFamily: scrollingConfig.fontFamily || 'Arial', fontSize: `${scrollingConfig.fontSize || 32}px` }}>
            <div style={{ display: 'inline-block', paddingLeft: '100%', animation: `spaceq-kiosk-marquee ${Math.max(8, 120 - (scrollingConfig.speed || 24))}s linear infinite` }}>{scrollingConfig.message}</div>
            <style>{'@keyframes spaceq-kiosk-marquee{0%{transform:translateX(0)}100%{transform:translateX(-100%)}}'}</style>
          </div>
        )}
        {/* Remote sync is intentionally non-visual: never interrupt playback. */}
        <FullscreenTapButton />
      </div>
    );
  }

  // Unclaimed — show the pairing code full-screen.
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white flex flex-col items-center justify-center gap-8 p-8">
      <div className="flex items-center gap-3 text-slate-400">
        <Tv className="w-6 h-6" />
        <span className="text-sm font-semibold tracking-wide">SPACEQ Display</span>
      </div>

      <div className="flex items-center gap-12">
        <div className="text-center space-y-3">
          <p className="text-lg text-slate-300">Enter this code in your SPACEQ dashboard:</p>
          <div
            onClick={handleCopyCode}
            className="text-8xl font-black tracking-[0.25em] text-rose-500 font-mono cursor-pointer select-all"
          >
            {device?.pairingCode?.match(/.{1,3}/g)?.join(' ') || '------'}
          </div>
          <button
            onClick={handleCopyCode}
            className="mx-auto flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-slate-700"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy code'}
          </button>
        </div>

        {qrDataUrl && (
          <>
            <div className="w-px h-40 bg-slate-800" />
            <div className="text-center space-y-3">
              <p className="text-sm text-slate-400 max-w-[220px]">Or scan with your phone —<br/>jumps straight to pairing</p>
              <div className="bg-white p-3 rounded-2xl inline-block">
                <img src={qrDataUrl} alt="Scan to pair this display" width={180} height={180} />
              </div>
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-slate-500 max-w-md text-center">
        Dashboard → Devices → Pair New Display, then enter this code — or scan the QR code above from a phone that's already signed in. This screen will switch to your content automatically, no reload needed.
      </p>
    </div>
  );
};

/**
 * A small, unobtrusive tap target for browsers that opened this page as a
 * normal tab (not launched with a real --kiosk browser flag) — one tap
 * requests true browser Fullscreen, hiding the browser's own address bar
 * and tabs. Devices that ARE launched in real kiosk mode already have no
 * browser chrome at all, so this button is harmless and simply unused there.
 * Browsers require a direct user gesture for this API, so it can't be
 * triggered automatically on page load.
 */
const FullscreenTapButton: React.FC = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  if (isFullscreen) return null;

  return (
    <button
      onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
      className="absolute bottom-3 right-3 z-50 p-2 rounded-full bg-black/40 text-white/60 hover:text-white hover:bg-black/70 transition-colors"
      title="Fill Screen"
    >
      <Maximize className="w-4 h-4" />
    </button>
  );
};
