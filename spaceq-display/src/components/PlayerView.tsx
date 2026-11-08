import React, { useState, useEffect, useRef } from 'react';
import { Device, Playlist, ContentItem } from '../types';
import { getLayoutTemplate } from '../data/layoutTemplates';
import { PlayerPane } from './PlayerPane';
import {
  Wifi,
  WifiOff,
  Tv,
  Compass,
  HardDrive,
  Activity,
  X,
  Clock,
  Maximize,
  Minimize
} from 'lucide-react';

interface PlayerViewProps {
  device: Device;
  /** One entry for a normal full-screen device, or one per split zone
   * (2 or 3) for a split-layout device — see resolveAllPanePlaylistIds(). */
  panePlaylists: (Playlist | undefined)[];
  contents: ContentItem[];
  onHeartbeat: (deviceId: string) => void;
  onExitPlayer?: () => void;
  darkMode: boolean;
  /** Kiosk mode hides the exit/preview-only controls, for real TV deployments. */
  kioskMode?: boolean;
  /** Fires whenever zone 0's active content changes — used by the real
   * kiosk to record playback telemetry. Left undefined in the dashboard
   * preview, which shouldn't count as real playback. */
  onPlaybackStart?: (event: { contentId: string; title: string; durationSeconds: number }) => void;
}

export const PlayerView: React.FC<PlayerViewProps> = ({
  device,
  panePlaylists,
  contents,
  onHeartbeat,
  onExitPlayer,
  darkMode,
  kioskMode = false,
  onPlaybackStart,
}) => {
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const [heartbeatCounter, setHeartbeatCounter] = useState(30);
  const [orientation, setOrientation] = useState<'LANDSCAPE' | 'PORTRAIT'>(device.orientation || 'LANDSCAPE');
  const [primaryStatus, setPrimaryStatus] = useState({ index: 0, total: 1, title: 'System Idle', durationSeconds: 10 });

  // Keep the real kiosk in sync when the dashboard changes the physical
  // orientation. The preview toggle below can still temporarily switch the
  // view for testing, but a new device orientation always wins.
  useEffect(() => {
    setOrientation(device.orientation || 'LANDSCAPE');
  }, [device.orientation]);
  // "Fill Screen" — requests real browser Fullscreen API AND hides our own
  // header/footer chrome, so one click shows exactly what a customer would
  // see, edge to edge, even when previewing from inside the dashboard.
  const [isFullscreen, setIsFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Measure the actual player stage instead of using viewport dimensions.
  // This is important in dashboard preview mode, where the stage is smaller
  // than the browser viewport. A 90°/270° rotation must swap the measured
  // width/height or the rotated canvas can be clipped/appear blank.
  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setStageSize({
        width: Math.max(0, Math.round(rect.width)),
        height: Math.max(0, Math.round(rect.height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [orientation, kioskMode, isFullscreen]);

  const toggleFillScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await rootRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch (err) {
      // Some browsers block this without a direct user gesture or in
      // certain contexts (e.g. cross-origin iframes) — fail quietly and
      // still let the person use it as a chrome-only toggle below.
      console.warn('Fullscreen request failed:', err);
    }
  };

  const hideChrome = kioskMode || isFullscreen;

  const isSplit = panePlaylists.length > 1;

  // Heartbeat countdown loop (30s)
  useEffect(() => {
    const interval = setInterval(() => {
      setHeartbeatCounter((prev) => {
        if (prev <= 1) {
          if (!isSimulatedOffline) {
            onHeartbeat(device.id);
          }
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [device.id, isSimulatedOffline, onHeartbeat]);

  const cachedItemsCount = panePlaylists.reduce((sum, p) => sum + (p?.items.length || 0), 0);

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between overflow-hidden select-none">
      {/* Top Telemetry Overlay Bar — dashboard preview only. A real kiosk/TV
          screen (kioskMode) shows nothing but the content itself. */}
      {!hideChrome && (
      <div className="p-3 bg-slate-950/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between text-xs z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-rose-500">
            <Tv className="w-4 h-4" />
            <span>SPACEQ EDGE PLAYER</span>
          </div>
          <span className="text-slate-500">•</span>
          <span className="font-semibold text-slate-300">{device.name}</span>
          {isSplit && (
            <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 text-[10px] font-bold">
              Split {panePlaylists.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Heartbeat Status */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <Activity className={`w-3.5 h-3.5 ${isSimulatedOffline ? 'text-rose-500' : 'text-emerald-400 animate-pulse'}`} />
            <span>Heartbeat: {heartbeatCounter}s</span>
          </div>

          {/* Playback queue indicator — this reflects the content currently
              resolved into the player; it is not a claim of offline media
              persistence unless a device-side cache is actually configured. */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
            <HardDrive className="w-3 h-3" />
            <span>Playback Queue ({cachedItemsCount} items)</span>
          </div>

          {/* Offline Toggle Simulation (preview only) */}
          <button
            onClick={() => setIsSimulatedOffline(!isSimulatedOffline)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
              isSimulatedOffline
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            }`}
          >
            {isSimulatedOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
            {isSimulatedOffline ? 'Simulate Offline Mode' : 'Cloud Online'}
          </button>

          {/* Orientation Toggle */}
          <button
            onClick={() => setOrientation(orientation === 'LANDSCAPE' ? 'PORTRAIT' : 'LANDSCAPE')}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            title="Toggle Orientation"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>

          {/* Fill Screen — real Fullscreen API + hides our own chrome too */}
          <button
            onClick={toggleFillScreen}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[11px] font-bold"
            title="Fill Screen (exactly what customers see)"
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
            Fill Screen
          </button>

          {/* Exit Player Button (dashboard preview only) */}
          {onExitPlayer && (
            <button
              onClick={onExitPlayer}
              className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold"
              title="Exit Fullscreen Player"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      )}

      {/* Main Display Stage Container */}
      <div ref={stageRef} className={`flex-1 relative bg-slate-950 overflow-hidden ${
        orientation === 'PORTRAIT' && !kioskMode ? 'max-w-[500px] mx-auto border-x border-white/10 rounded-2xl shadow-2xl' : ''
      }`}>
        {/* Physical screen rotation wrapper — compensates for a TV mounted
            sideways. Uses absolute positioning directly (not percentage
            width/height through nested flex containers) since that's a much
            more reliable way to size this across browsers — percentage
            sizing chained through several nested flex layers, especially
            switching between row/column direction for portrait, is a
            well-known source of content silently collapsing to invisible
            in real browsers even when it looks fine in a quick check. */}
        <div
          className="absolute origin-center"
          style={
            device.rotation === 90 || device.rotation === 270
              ? {
                  top: '50%',
                  left: '50%',
                  width: stageSize.height || '100%',
                  height: stageSize.width || '100%',
                  transform: `translate(-50%, -50%) rotate(${device.rotation}deg)`,
                }
              : device.rotation === 180
                ? { inset: 0, transform: 'rotate(180deg)' }
                : { inset: 0 }
          }
        >
        {/* Offline Warning Banner overlay */}
        {isSimulatedOffline && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-amber-500/90 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-2xl animate-pulse">
            <WifiOff className="w-4 h-4" />
            <span>INTERNET DISCONNECTED — CONTINUING OFF-LINE PLAYBACK FROM EDGE CACHE</span>
          </div>
        )}

        {/* Pairing Mode View (If device is unpaired) */}
        {device.status === 'PAIRING' ? (
          <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center p-8 space-y-6 max-w-md">
            <div className="w-16 h-16 rounded-3xl bg-rose-600 text-white flex items-center justify-center mx-auto shadow-2xl shadow-rose-600/50">
              <Tv className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-extrabold tracking-tight">SPACEQ DISPLAY OS</h2>
              <p className="text-xs text-slate-400">Device is waiting to be paired with SPACEQ Cloud</p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pairing Code</p>
              <div className="text-4xl font-mono font-black text-rose-500 tracking-widest">
                {device.pairingCode}
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Log into your SPACEQ Dashboard, go to Devices, click "Pair New Display", and enter this code.
            </p>
          </div>
          </div>
        ) : (
          /* One pane for a normal device, a 2x2 grid for GRID_4, or 2-3
             side by side (landscape) / stacked (portrait) for a split-
             screen device. Zones use zoneWeights for uneven splits (e.g. a
             70/30 main+side layout) when set, otherwise split evenly.
             absolute inset-0 here too — no percentage width/height, so
             nothing to silently collapse. */
          device.layoutTemplateId && getLayoutTemplate(device.layoutTemplateId) ? (
            (() => {
              const template = getLayoutTemplate(device.layoutTemplateId)!;
              return (
                <div
                  className="absolute inset-0 grid gap-px bg-white/10"
                  style={{ gridTemplateColumns: `repeat(${template.columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${template.rows}, minmax(0, 1fr))`, gridTemplateAreas: template.areas.map(row => `'${row}'`).join(' ') }}
                >
                  {panePlaylists.map((pl, i) => (
                    <div key={i} className="bg-slate-950 min-w-0 min-h-0" style={{ gridArea: `z${i + 1}` }}>
                      <PlayerPane
                        playlist={pl}
                        contents={contents}
                        zoneLabel={`Zone ${i + 1}`}
                        onStatusChange={i === 0 ? setPrimaryStatus : undefined}
                        onPlaybackStart={i === 0 ? onPlaybackStart : undefined}
                      />
                    </div>
                  ))}
                </div>
              );
            })()
          ) : device.layoutMode === 'GRID_4' ? (
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px bg-white/10">
              {panePlaylists.map((pl, i) => (
                <div key={i} className="bg-slate-950 min-w-0 min-h-0">
                  <PlayerPane
                    playlist={pl}
                    contents={contents}
                    zoneLabel={`Zone ${i + 1}`}
                    onStatusChange={i === 0 ? setPrimaryStatus : undefined}
                    onPlaybackStart={i === 0 ? onPlaybackStart : undefined}
                  />
                </div>
              ))}
            </div>
          ) : (
          <div className={`absolute inset-0 flex ${orientation === 'PORTRAIT' ? 'flex-col' : 'flex-row'}`}>
            {panePlaylists.map((pl, i) => {
              const weight = device.zoneWeights?.[i] ?? 1;
              return (
              <React.Fragment key={i}>
                {i > 0 && (
                  <div className={orientation === 'PORTRAIT' ? 'h-px w-full bg-white/10 shrink-0' : 'w-px h-full bg-white/10 shrink-0'} />
                )}
                <div className="min-w-0 min-h-0" style={{ flexGrow: weight, flexBasis: 0 }}>
                  <PlayerPane
                    playlist={pl}
                    contents={contents}
                    zoneLabel={isSplit ? `Zone ${i + 1}` : undefined}
                    onStatusChange={i === 0 ? setPrimaryStatus : undefined}
                    onPlaybackStart={i === 0 ? onPlaybackStart : undefined}
                  />
                </div>
              </React.Fragment>
              );
            })}
          </div>
          )
        )}
        </div>
      </div>

      {/* Bottom Status Ticker — dashboard preview only */}
      {!hideChrome && (
      <div className="p-2.5 bg-slate-950/90 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 z-20">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-200">
            {isSplit ? 'Zone 1: ' : ''}Playing Slide {primaryStatus.index + 1} of {primaryStatus.total}
          </span>
          <span>•</span>
          <span className="truncate max-w-[250px]">
            {primaryStatus.title}
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px]">
          <Clock className="w-3 h-3 text-rose-500" />
          <span>Next Slide in {primaryStatus.durationSeconds}s</span>
        </div>
      </div>
      )}
    </div>
  );
};
