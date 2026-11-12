import React, { useState, useEffect, useRef } from 'react';
import { Device, Playlist, ContentItem } from '../types';
import { getLayoutTemplate } from '../data/layoutTemplates';
import { PlayerPane } from './PlayerPane';
import { CampaignPlaybackOverlay } from './CampaignPlaybackOverlay';
import { isBroadcastActive } from '../lib/scheduling';
import { QrDisplayOverlay } from './QrDisplayOverlay';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
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
  activeCampaigns?: any[];
  defaultLayerConfig?: any;
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
  activeCampaigns = [],
  defaultLayerConfig,
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
  const [scrollingConfig, setScrollingConfig] = useState<any>(null);
  const [frameConfig, setFrameConfig] = useState<any>(null);
  const [cubeConfig, setCubeConfig] = useState<any>(null);
  const [mascotConfig, setMascotConfig] = useState<any>(null);
  const [qrConfig, setQrConfig] = useState<any>(null);
  const [campaignIsPlaying, setCampaignIsPlaying] = useState(false);

  // Shared ticker subscription: this component powers both the dashboard
  // live preview and the physical kiosk display.
  useEffect(() => {
    // Clear the previous device's ticker immediately while the new device's
    // global and selected-device settings are being loaded.
    setScrollingConfig(null);
    setFrameConfig(null);
    setCubeConfig(null);
    setMascotConfig(null);
    setQrConfig(null);
    if (!device.businessId) return;

    const globalRef = doc(db, 'scrollingMessages', device.businessId);
    const deviceRef = doc(db, 'scrollingMessages', `${device.businessId}_devices`);
    let globalConfig: any = null;
    let deviceConfig: any = null;
    let globalLoaded = false;
    let deviceLoaded = false;

    const publish = () => {
      // Wait for both documents so the global ticker cannot briefly flash
      // before a selected-device override is received.
      if (!globalLoaded || !deviceLoaded) return;

      const globalIsActive =
        globalConfig?.enabled &&
        typeof globalConfig.message === 'string' &&
        globalConfig.message.trim();

      // GLOBAL is the master rule: while enabled, every display follows it,
      // regardless of any saved device-specific configuration.
      // Only when GLOBAL is OFF may a selected device use its own config.
      const selectedForThisDevice =
        Array.isArray(deviceConfig?.deviceIds) &&
        deviceConfig.deviceIds.includes(device.id);

      const activeConfig = globalIsActive
        ? globalConfig
        : selectedForThisDevice
          ? deviceConfig
          : null;

      setScrollingConfig(
        activeConfig?.enabled && typeof activeConfig.message === 'string' && activeConfig.message.trim()
          ? activeConfig
          : null
      );

      // Each feature stores its selected-device IDs inside its own config.
      // Keep its targeting independent so a ticker selection cannot accidentally
      // enable a frame, cube, or mascot on the same device.
      const selectedFrame = Array.isArray(deviceConfig?.frame?.deviceIds)
        && deviceConfig.frame.deviceIds.includes(device.id)
        ? deviceConfig.frame : null;
      const globalFrame = globalConfig?.frame;
      const activeFrame = globalFrame?.enabled ? globalFrame : selectedFrame;
      setFrameConfig(activeFrame?.enabled ? activeFrame : null);

      const selectedCube = Array.isArray(deviceConfig?.cube?.deviceIds)
        && deviceConfig.cube.deviceIds.includes(device.id)
        ? deviceConfig.cube : null;
      const globalCube = globalConfig?.cube;
      const activeCube = globalCube?.enabled ? globalCube : selectedCube;
      setCubeConfig(activeCube?.enabled ? activeCube : null);

      const selectedMascot = Array.isArray(deviceConfig?.mascot?.deviceIds)
        && deviceConfig.mascot.deviceIds.includes(device.id)
        ? deviceConfig.mascot : null;
      const globalMascot = globalConfig?.mascot;
      const activeMascot = globalMascot?.enabled ? globalMascot : selectedMascot;
      setMascotConfig(activeMascot?.enabled ? activeMascot : null);

      // QR information campaigns use their own device assignment list.
      // Global QR stays the master; otherwise a device-selected QR can run.
      const selectedQr = Array.isArray(deviceConfig?.qr?.deviceIds)
        && deviceConfig.qr.deviceIds.includes(device.id)
        ? deviceConfig.qr : null;
      const globalQr = globalConfig?.qr;
      const useDeviceQr = !globalQr?.enabled && !!selectedQr?.enabled;
      const activeQr = globalQr?.enabled ? globalQr : selectedQr;
      setQrConfig(activeQr?.enabled ? { ...activeQr, deviceScope: useDeviceQr } : null);
    };

    const stopGlobal = onSnapshot(
      globalRef,
      snap => { globalConfig = snap.exists() ? snap.data() : null; globalLoaded = true; publish(); },
      error => { console.warn('Global scrolling message listener:', error); globalLoaded = true; publish(); }
    );
    const stopDevice = onSnapshot(
      deviceRef,
      snap => { deviceConfig = snap.exists() ? snap.data() : null; deviceLoaded = true; publish(); },
      error => { console.warn('Device scrolling message listener:', error); deviceLoaded = true; publish(); }
    );

    return () => { stopGlobal(); stopDevice(); };
  }, [device.businessId, device.id]);

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
        {frameConfig?.enabled && (
          <>
            {frameConfig.mode === 'UPLOAD' && frameConfig.imageUrl && (
              <img src={frameConfig.imageUrl} alt="" className="pointer-events-none absolute inset-0 w-full h-full object-fill" style={{ zIndex: 2147483646 }} />
            )}
            <div
              className={`sq-frame sq-frame--${frameConfig.template || 'aurora'} ${frameConfig.colorMode === 'RGB' ? 'sq-frame--rgb' : ''} ${frameConfig.colorMode === 'PATTERN' ? 'sq-frame--pattern' : ''}`}
              style={{ zIndex: 2147483647, '--sq-frame-color': frameConfig.color || '#00B3A4' } as React.CSSProperties}
            />
          </>
        )}
        <style>{`
          .sq-frame{position:absolute;inset:0;pointer-events:none;--sq-frame-color:#00B3A4}
          .sq-frame:before{content:'';position:absolute;pointer-events:none}
          .sq-frame--aurora:before{inset:0;border:10px solid transparent;border-image:linear-gradient(120deg,#00e5ff,#7c3aed,#ff2d95,#facc15,#00e5ff) 1;filter:drop-shadow(0 0 8px #00e5ff);animation:sq-hue 4s linear infinite}
          .sq-frame--orbit:before{inset:0;border:8px dashed #00e5ff;box-shadow:inset 0 0 12px #00e5ff,0 0 12px #00e5ff;animation:sq-orbit 5s linear infinite}
          .sq-frame--pulse:before{inset:5px;border:8px solid var(--sq-frame-color);box-shadow:inset 0 0 20px var(--sq-frame-color),0 0 20px var(--sq-frame-color);animation:sq-pulse 2s ease-in-out infinite}
          .sq-frame--corner:before{inset:0;background:linear-gradient(var(--sq-frame-color),var(--sq-frame-color)) left top/48px 5px no-repeat,linear-gradient(var(--sq-frame-color),var(--sq-frame-color)) left top/5px 48px no-repeat,linear-gradient(var(--sq-frame-color),var(--sq-frame-color)) right top/48px 5px no-repeat,linear-gradient(var(--sq-frame-color),var(--sq-frame-color)) right top/5px 48px no-repeat,linear-gradient(var(--sq-frame-color),var(--sq-frame-color)) left bottom/48px 5px no-repeat,linear-gradient(var(--sq-frame-color),var(--sq-frame-color)) left bottom/5px 48px no-repeat,linear-gradient(var(--sq-frame-color),var(--sq-frame-color)) right bottom/48px 5px no-repeat,linear-gradient(var(--sq-frame-color),var(--sq-frame-color)) right bottom/5px 48px no-repeat;animation:sq-corner 2s ease-in-out infinite alternate}
          .sq-frame--luxury:before{inset:5px;border:3px double #d6ad55;box-shadow:inset 0 0 0 3px #5b421c,0 0 12px #d6ad55}
          .sq-frame--rgb{animation:sq-hue 3s linear infinite}
          .sq-frame--pattern:before{inset:0;border:10px solid transparent;border-image:repeating-linear-gradient(45deg,#f59e0b 0 8px,#7c3aed 8px 16px,#06b6d4 16px 24px) 1}
          @keyframes sq-hue{to{filter:hue-rotate(360deg)}}
          @keyframes sq-orbit{to{filter:hue-rotate(360deg)}}
          @keyframes sq-pulse{0%,100%{opacity:.5;box-shadow:inset 0 0 8px var(--sq-frame-color),0 0 8px var(--sq-frame-color)}50%{opacity:1;box-shadow:inset 0 0 28px var(--sq-frame-color),0 0 28px var(--sq-frame-color)}}
          @keyframes sq-corner{from{filter:brightness(.65)}to{filter:brightness(1.8)}}
        `}</style>
        {cubeConfig?.enabled && (() => {
          const size = Math.max(40, Math.min(500, Number(cubeConfig.size) || 140));
          const width = Math.max(30, Math.min(800, Number(cubeConfig.width) || size));
          const height = Math.max(30, Math.min(800, Number(cubeConfig.height) || size));
          const depth = Math.min(width, height);
          const renderMode = cubeConfig.renderMode || '3D';
          const screenRotation = [0,90,180,270].includes(Number(cubeConfig.screenRotation)) ? Number(cubeConfig.screenRotation) : 0;
          const faces = cubeConfig.faces || {};
          const names = ['front','right','back','left','top','bottom'];
          const half = size / 2;
          const faceTransforms: Record<string,string> = {
            front: `translateZ(${depth/2}px)`,
            right: `rotateY(90deg) translateZ(${width/2}px)`,
            back: `rotateY(180deg) translateZ(${depth/2}px)`,
            left: `rotateY(-90deg) translateZ(${width/2}px)`,
            top: `rotateX(90deg) translateZ(${height/2}px)`,
            bottom: `rotateX(-90deg) translateZ(${height/2}px)`,
          };
          const mode = cubeConfig.mode || 'CONTINUOUS';
          const axis = cubeConfig.axis || 'Y';
          const direction = cubeConfig.direction === 'ANTICLOCKWISE' ? 'reverse' : 'normal';
          const speed = Math.max(2, 20 - (Number(cubeConfig.speed) || 12));
          const duration = mode === 'FACE_BY_FACE' ? Math.max(1, Number(cubeConfig.pauseSeconds) || 2) * 6 : speed;
          const animationName = renderMode === '3D' && mode === 'CONTINUOUS' ? (axis === 'X' ? 'sq-cube-spin-x' : axis === 'BOTH' ? 'sq-cube-spin-both' : 'sq-cube-spin-y') : renderMode === '3D' && mode === 'FACE_BY_FACE' ? 'sq-cube-steps' : undefined;
          return (
            <div className="pointer-events-none absolute" style={{ zIndex: 2147483647, left: `${cubeConfig.x ?? 88}%`, top: `${cubeConfig.y ?? 16}%`, width: renderMode === '2D' ? width : width, height, transform: `translate(-50%,-50%) rotate(${screenRotation}deg)`, perspective: 1000 }}>
              <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: renderMode === '2D' ? 'none' : mode === 'MANUAL' ? `rotateX(${Number(cubeConfig.angleX) || 0}deg) rotateY(${Number(cubeConfig.angleY) || 0}deg)` : 'rotateX(-18deg) rotateY(-25deg)', animation: animationName ? `${animationName} ${duration}s linear infinite` : undefined, animationDirection: direction }}>
                {(renderMode === '2D' ? ['front'] : names).map(name => {
                  const face = faces[name] || {};
                  const faceDimensions:Record<string,React.CSSProperties>={front:{width,height},back:{width,height},right:{width:depth,height,left:(width-depth)/2},left:{width:depth,height,left:(width-depth)/2},top:{width,height:depth,top:(height-depth)/2},bottom:{width,height:depth,top:(height-depth)/2}};
                  return <div key={name} style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxSizing: 'border-box', backfaceVisibility: 'hidden', ...faceDimensions[name], transform: renderMode === '2D' ? 'none' : faceTransforms[name], background: face.background || '#B5121B', color: face.color || '#FFFFFF', border: '1px solid rgba(255,255,255,.55)', fontSize: Math.max(10, size * .12), fontWeight: 800, textAlign: 'center', padding: 6 }}>
                    {face.type === 'IMAGE' && face.imageUrl ? <img src={face.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ overflowWrap: 'anywhere' }}>{face.text || 'YOUR AD HERE'}</span>}
                  </div>;
                })}
              </div>
              <style>{`@keyframes sq-cube-spin-y{from{transform:rotateX(-18deg) rotateY(0)}to{transform:rotateX(-18deg) rotateY(360deg)}}@keyframes sq-cube-spin-x{from{transform:rotateX(0) rotateY(-18deg)}to{transform:rotateX(360deg) rotateY(-18deg)}}@keyframes sq-cube-spin-both{from{transform:rotateX(0) rotateY(0)}to{transform:rotateX(360deg) rotateY(360deg)}}@keyframes sq-cube-steps{0%,12%{transform:rotateX(-18deg) rotateY(0)}16.66%,29%{transform:rotateX(-18deg) rotateY(-60deg)}33.33%,45%{transform:rotateX(-18deg) rotateY(-120deg)}50%,62%{transform:rotateX(-18deg) rotateY(-180deg)}66.66%,79%{transform:rotateX(-18deg) rotateY(-240deg)}83.33%,95%{transform:rotateX(-18deg) rotateY(-300deg)}100%{transform:rotateX(-18deg) rotateY(-360deg)}}`}</style>
            </div>
          );
        })()}
        {mascotConfig?.enabled && (() => {
          const mascotEmojis:Record<string,string>={buddy:'🧑🏻‍💼',chef:'👨🏻‍🍳',robot:'🤖',cat:'🐱',fox:'🦊',bear:'🐻',astronaut:'🧑🏻‍🚀',mascot:'⭐'};
          const animation=String(mascotConfig.animation||'BOUNCE').toLowerCase();
          const animationName=animation==='idle'?'none':`sq-mascot-${animation}`;
          const size=Math.max(60,Math.min(420,Number(mascotConfig.size)||190));
          return <div className="pointer-events-none absolute" style={{zIndex:2147483646,left:`${mascotConfig.x??82}%`,top:`${mascotConfig.y??68}%`,width:size,height:size,transform:'translate(-50%,-50%)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            {mascotConfig.showBubble!==false&&mascotConfig.message&&<div style={{maxWidth:size*1.8,marginBottom:8,borderRadius:18,background:'#fff',color:'#172033',padding:'9px 13px',fontSize:Math.max(12,size*.085),fontWeight:800,lineHeight:1.25,textAlign:'center',boxShadow:'0 5px 18px rgba(0,0,0,.28)'}}>{mascotConfig.message}</div>}
            <div style={{width:size*.82,height:size*.82,display:'flex',alignItems:'center',justifyContent:'center',animation:animationName==='none'?'none':`${animationName} 2s ease-in-out infinite`,transformOrigin:'50% 85%'}}>
              {mascotConfig.imageUrl?<img src={mascotConfig.imageUrl} alt="" style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<span style={{fontSize:size*.68,lineHeight:1}}>{mascotEmojis[mascotConfig.character]||'🧑🏻‍💼'}</span>}
            </div>
            {mascotConfig.name&&<span style={{marginTop:2,color:'#fff',fontSize:Math.max(10,size*.07),fontWeight:800,textShadow:'0 2px 5px #000'}}>{mascotConfig.name}</span>}
            <style>{`@keyframes sq-mascot-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}@keyframes sq-mascot-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}@keyframes sq-mascot-wave{0%,100%{transform:rotate(0)}25%{transform:rotate(-9deg)}75%{transform:rotate(9deg)}}@keyframes sq-mascot-dance{0%,100%{transform:rotate(0) translateY(0)}25%{transform:rotate(-8deg) translateY(-8px)}75%{transform:rotate(8deg) translateY(-8px)}}`}</style>
          </div>;
        })()}
        {scrollingConfig?.enabled && scrollingConfig.message && (() => {
          const direction = scrollingConfig.direction || 'RIGHT_TO_LEFT';
          const vertical = direction === 'TOP_TO_BOTTOM' || direction === 'BOTTOM_TO_TOP';
          const rotation = [0, 90, 180, 270].includes(Number(scrollingConfig.rotation)) ? Number(scrollingConfig.rotation) : 0;
          const positionTop = scrollingConfig.position === 'TOP' ? '0%' : scrollingConfig.position === 'MIDDLE' ? '50%' : '100%';
          const positionTransform = scrollingConfig.position === 'TOP' ? '0%' : scrollingConfig.position === 'MIDDLE' ? '-50%' : '-100%';
          return (
            <div
              className="pointer-events-none absolute overflow-hidden whitespace-nowrap"
              style={{
                zIndex: 2147483647,
                left: `${scrollingConfig.xPercent ?? 50}%`,
                top: `${scrollingConfig.yPercent ?? (scrollingConfig.position === 'TOP' ? 10 : scrollingConfig.position === 'MIDDLE' ? 50 : 90)}%`,
                width: rotation === 90 || rotation === 270 ? `${stageSize.height}px` : '100%',
                height: `${Math.ceil((scrollingConfig.fontSize || 32) * 1.1) + Math.max(2, Math.round((scrollingConfig.fontSize || 32) * 0.12)) * 2}px`,
                transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                transformOrigin: 'center',
                boxSizing: 'border-box',
                backgroundColor: scrollingConfig.backgroundTransparent ? 'transparent' : (scrollingConfig.backgroundColor || 'transparent'),
                color: scrollingConfig.color || '#fff',
                fontFamily: scrollingConfig.fontFamily || 'Arial',
                fontSize: `${scrollingConfig.fontSize || 32}px`,
                lineHeight: 1.1,
                padding: `${Math.max(2, Math.round((scrollingConfig.fontSize || 32) * 0.12))}px 0`,
                textShadow: 'none',
                boxShadow: 'none',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  minWidth: vertical ? undefined : 'max-content',
                  whiteSpace: 'nowrap',
                  paddingLeft: direction === 'RIGHT_TO_LEFT' ? '100%' : 0,
                  animation: `spaceq-scroll-${direction.toLowerCase()} ${Math.max(8, 120 - (scrollingConfig.speed || 24))}s linear infinite`,
                }}
              >{scrollingConfig.message}</div>
              <style>{`
                @keyframes spaceq-scroll-right_to_left{from{transform:translateX(0)}to{transform:translateX(-100%)}}
                @keyframes spaceq-scroll-left_to_right{from{transform:translateX(-100%)}to{transform:translateX(0)}}
                @keyframes spaceq-scroll-top_to_bottom{from{transform:translateY(-100%)}to{transform:translateY(100vh)}}
                @keyframes spaceq-scroll-bottom_to_top{from{transform:translateY(100vh)}to{transform:translateY(-100%)}}
              `}</style>
            </div>
          );
        })()}
        {qrConfig?.enabled && (
          <QrDisplayOverlay
            config={qrConfig}
            url={(() => {
              const url = new URL('/info', window.location.origin);
              url.searchParams.set('businessId', device.businessId || '');
              if (qrConfig.deviceScope) url.searchParams.set('deviceId', device.id);
              return url.toString();
            })()}
          />
        )}

        {kioskMode && !panePlaylists.some(pl => (pl?.items || []).some(item => contents.some(content => content.id === item.contentId))) && !campaignIsPlaying && !isBroadcastActive(device) && (
          <div aria-label="SPACEQ default advertise here slide" className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 overflow-hidden" style={{ zIndex: 2147483645, backgroundColor: defaultLayerConfig?.backgroundColor || '#071A35', backgroundImage: defaultLayerConfig?.backgroundImageUrl ? `linear-gradient(rgba(0,0,0,.48),rgba(0,0,0,.58)),url(\"${defaultLayerConfig.backgroundImageUrl}\")` : `radial-gradient(circle at 85% 15%, ${(defaultLayerConfig?.accentColor || '#00B3A4')}55, transparent 38%)`, backgroundSize: 'cover', backgroundPosition: 'center', color: defaultLayerConfig?.textColor || '#FFFFFF' }}>
            <div className="text-xs font-bold tracking-[.35em] mb-6" style={{ color: defaultLayerConfig?.accentColor || '#00B3A4' }}>SPACEQ DIGITAL DISPLAYS</div>
            <div className="text-4xl md:text-6xl font-black tracking-tight leading-tight">{defaultLayerConfig?.headline || 'ADVERTISE HERE'}</div>
            <div className="max-w-3xl mt-5 text-lg md:text-2xl opacity-90">{defaultLayerConfig?.subheading || 'Reach more customers with SPACEQ digital displays.'}</div>
            <div className="mt-8 rounded-full px-7 py-4 font-bold text-base md:text-xl" style={{ background: defaultLayerConfig?.accentColor || '#00B3A4', color: '#071A35' }}>{defaultLayerConfig?.contact || 'For advertising enquiries: 9494492902'}</div>
            <div className="absolute bottom-5 text-xs tracking-[.2em] opacity-75">{defaultLayerConfig?.footer || 'LOCAL • REGIONAL • BRAND ADVERTISING'}</div>
          </div>
        )}

        {kioskMode && activeCampaigns.length > 0 && (
          <CampaignPlaybackOverlay
            deviceId={device.id}
            businessId={device.businessId}
            campaigns={activeCampaigns}
            contents={contents}
            suspended={isBroadcastActive(device)}
            onPlayingChange={setCampaignIsPlaying}
          />
        )}
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
