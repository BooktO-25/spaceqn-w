import React, { useState, useEffect, useRef } from 'react';
import { Device, Playlist } from '../types';
import { isBroadcastActive } from '../lib/scheduling';
import { Rocket, Tv, ListMusic, Clock, ChevronUp, Radio, X } from 'lucide-react';

const DURATIONS: { label: string; seconds: number | null }[] = [
  { label: '5 min', seconds: 5 * 60 },
  { label: '30 min', seconds: 30 * 60 },
  { label: '1 hour', seconds: 60 * 60 },
  { label: 'Until landed', seconds: null },
];

function formatRemaining(expiresAt: string | null): string {
  if (!expiresAt) return 'No timer';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Ending…';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `T–${m}:${s}`;
}

interface AnnouncementViewProps {
  devices: Device[];
  playlists: Playlist[];
  darkMode: boolean;
  onLaunch: (deviceIds: string[], playlistId: string, durationSeconds: number | null) => Promise<void>;
  onLand: (deviceId: string) => Promise<void>;
}

export const AnnouncementView: React.FC<AnnouncementViewProps> = ({ devices, playlists, darkMode, onLaunch, onLand }) => {
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(devices.map(d => d.id));
  const [playlistId, setPlaylistId] = useState(playlists[0]?.id || '');
  const [durationIdx, setDurationIdx] = useState(1);
  const [phase, setPhase] = useState<'idle' | 'launching'>('idle');
  const [, forceTick] = useState(0);

  // Re-render every second so countdowns stay live.
  useEffect(() => {
    const t = setInterval(() => forceTick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const liveDevices = devices.filter(d => isBroadcastActive(d));
  const allSelected = selectedDeviceIds.length === devices.length && devices.length > 0;

  const toggleDevice = (id: string) => {
    setSelectedDeviceIds(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };
  const toggleAll = () => setSelectedDeviceIds(allSelected ? [] : devices.map(d => d.id));

  const canLaunch = selectedDeviceIds.length > 0 && !!playlistId && phase === 'idle';

  const doLaunch = async () => {
    if (!canLaunch) return;
    setPhase('launching');
    await onLaunch(selectedDeviceIds, playlistId, DURATIONS[durationIdx].seconds);
    setPhase('idle');
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Rocket className="w-6 h-6 text-rose-500" /> Announcement
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Push a playlist live on any screen right now — it takes over the whole screen, overriding whatever it's normally set to show, until you land it.
        </p>
      </div>

      {/* Currently live */}
      {liveDevices.length > 0 && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-rose-500 uppercase tracking-wider">
            <Radio className="w-3.5 h-3.5 animate-pulse" /> Live now
          </div>
          {liveDevices.map(d => {
            const pl = playlists.find(p => p.id === d.broadcastOverride?.playlistId);
            return (
              <div key={d.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-950/5 dark:bg-white/5">
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{d.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{pl?.name || 'Unknown playlist'}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-[11px] text-rose-500 font-bold">{formatRemaining(d.broadcastOverride?.expiresAt ?? null)}</span>
                  <button
                    onClick={() => onLand(d.id)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-bold"
                  >
                    Land Now
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Playlist picker */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          <ListMusic className="w-3.5 h-3.5" /> What plays
        </label>
        {playlists.length === 0 ? (
          <p className="text-xs text-slate-400">No playlists yet — create one in the Playlists tab first.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {playlists.map(pl => (
              <button
                key={pl.id}
                onClick={() => setPlaylistId(pl.id)}
                className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                  playlistId === pl.id
                    ? 'border-rose-500 bg-rose-500/10'
                    : darkMode ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="text-xs font-semibold">{pl.name}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{pl.items.length} slides</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Device targeting */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Tv className="w-3.5 h-3.5" /> Where
          </label>
          <button onClick={toggleAll} className="text-[11px] font-bold text-rose-500">
            {allSelected ? 'Clear' : 'Select all'}
          </button>
        </div>
        {devices.length === 0 ? (
          <p className="text-xs text-slate-400">No paired devices yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {devices.map(d => {
              const on = selectedDeviceIds.includes(d.id);
              const live = isBroadcastActive(d);
              return (
                <button
                  key={d.id}
                  onClick={() => toggleDevice(d.id)}
                  className={`relative text-left px-3 py-2.5 rounded-xl border transition-colors overflow-hidden ${
                    on ? 'border-rose-500 bg-rose-500/10' : darkMode ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Radio className={`w-3 h-3 shrink-0 ${on ? 'text-rose-500' : 'text-slate-500'}`} />
                    <span className="text-[11.5px] font-semibold truncate">{d.name}</span>
                  </div>
                  {live && <span className="text-[9px] font-bold text-rose-500 mt-0.5 block">Already live</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Duration */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          <Clock className="w-3.5 h-3.5" /> For how long
        </label>
        <div className="flex gap-2 flex-wrap">
          {DURATIONS.map((d, i) => (
            <button
              key={d.label}
              onClick={() => setDurationIdx(i)}
              className={`px-4 py-2 rounded-lg text-xs font-bold font-mono border transition-colors ${
                durationIdx === i
                  ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                  : darkMode ? 'border-slate-700 bg-slate-800/60 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Launch controls — a plain button (primary, accessible) plus the
          rocket swipe as a fun optional way to trigger the exact same
          action. Neither is required to use the other. */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-6">
        <button
          onClick={doLaunch}
          disabled={!canLaunch}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-600/20 disabled:opacity-40 disabled:shadow-none transition-all"
        >
          {phase === 'launching' ? 'Launching…' : `Push Live on ${selectedDeviceIds.length || 0} Screen${selectedDeviceIds.length === 1 ? '' : 's'}`}
        </button>
        <RocketLever disabled={!canLaunch} firing={phase === 'launching'} onLaunch={doLaunch} />
      </div>
    </div>
  );
};

/** The fun, optional way to trigger the same launch — press and drag up.
 * Pure pointer events (works identically on touch and mouse), no external
 * animation library, matching the rest of this codebase's drag patterns. */
const RocketLever: React.FC<{ disabled: boolean; firing: boolean; onLaunch: () => void }> = ({ disabled, firing, onLaunch }) => {
  const TRACK = 90;
  const THRESHOLD = 0.72;
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragState = useRef({ startY: 0, startOffset: 0 });

  const progress = Math.min(1, -offsetY / TRACK);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragState.current = { startY: e.clientY, startOffset: offsetY };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dy = e.clientY - dragState.current.startY;
    setOffsetY(Math.max(-TRACK, Math.min(0, dragState.current.startOffset + dy)));
  };
  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    if (progress >= THRESHOLD && !disabled) {
      setOffsetY(-TRACK);
      setTimeout(() => { onLaunch(); setOffsetY(0); }, 200);
    } else {
      setOffsetY(0);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-14" style={{ height: TRACK + 56 }}>
        <div className="absolute left-1/2 -translate-x-1/2 bottom-11 w-[3px] rounded-full bg-slate-300 dark:bg-slate-700 overflow-hidden" style={{ height: TRACK }}>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-rose-600 to-rose-400" style={{ height: `${progress * 100}%`, transition: dragging ? 'none' : 'height 0.3s ease-out' }} />
        </div>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{
            touchAction: 'none',
            transform: `translateY(${firing ? offsetY - 140 : offsetY}px)`,
            opacity: firing ? 0 : 1,
            transition: dragging ? 'none' : firing ? 'transform 0.4s ease-in, opacity 0.4s ease-in' : 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}
          className={`absolute left-1/2 -translate-x-1/2 bottom-3 w-14 h-14 rounded-2xl flex items-center justify-center ${
            disabled ? 'cursor-not-allowed' : dragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          <div
            className={`absolute inset-0 rounded-2xl border flex items-center justify-center shadow-lg ${
              disabled ? 'bg-slate-300 dark:bg-slate-700 border-slate-400 dark:border-slate-600' : 'border-rose-300/50'
            }`}
            style={disabled ? undefined : { background: 'linear-gradient(to bottom, #e11d48, #9f1239)' }}
          >
            <ChevronUp className={`w-3.5 h-3.5 absolute top-1.5 ${disabled ? 'text-slate-400' : 'text-white/50'}`} />
            <Rocket className={`w-6 h-6 ${disabled ? 'text-slate-400' : 'text-white'}`} />
          </div>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 max-w-[90px] leading-tight">
        or press &amp; drag the rocket up
      </p>
    </div>
  );
};
