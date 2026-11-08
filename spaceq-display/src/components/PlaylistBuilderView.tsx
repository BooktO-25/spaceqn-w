import React, { useState } from 'react';
import { Business, ContentItem, Playlist, ScheduleRule, MediaFraming } from '../types';
import { useAuth } from '../context/AuthContext';
import { can } from '../lib/permissions';
import { DAY_LABELS } from '../lib/scheduling';
import { 
  ListMusic, 
  Plus, 
  Trash2, 
  Clock, 
  Repeat, 
  Shuffle, 
  Calendar, 
  ArrowUp, 
  ArrowDown, 
  SlidersHorizontal, 
  Play, 
  Check, 
  Sparkles,
  X
} from 'lucide-react';

interface PlaylistBuilderViewProps {
  playlists: Playlist[];
  contents: ContentItem[];
  selectedBusiness: Business;
  onUpdatePlaylist: (updatedPlaylist: Playlist) => void;
  onCreatePlaylist: (name: string, description: string) => void;
  darkMode: boolean;
}

export const PlaylistBuilderView: React.FC<PlaylistBuilderViewProps> = ({
  playlists,
  contents,
  selectedBusiness,
  onUpdatePlaylist,
  onCreatePlaylist,
  darkMode,
}) => {
  const { userProfile } = useAuth();
  const canManage = can(userProfile?.role, 'managePlaylists');

  const bizPlaylists = playlists.filter(p => p.businessId === selectedBusiness.id);
  const bizContents = contents.filter(c => c.businessId === selectedBusiness.id);

  const [activePlaylistId, setActivePlaylistId] = useState<string>(bizPlaylists[0]?.id || '');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [framingItemId, setFramingItemId] = useState<string | null>(null);
  const [framingDraft, setFramingDraft] = useState<MediaFraming>({ fit: 'COVER', zoom: 1, positionX: 50, positionY: 50, rotation: 0 });

  const [newPlName, setNewPlName] = useState('');
  const [newPlDesc, setNewPlDesc] = useState('');

  // Schedule modal inputs
  const [schName, setSchName] = useState('Breakfast Special Schedule');
  const [schStartTime, setSchStartTime] = useState('07:00');
  const [schEndTime, setSchEndTime] = useState('11:00');
  const [schDays, setSchDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [schPriority, setSchPriority] = useState(10);

  const toggleDay = (day: number) => {
    setSchDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort());
  };

  const activePlaylist = playlists.find(p => p.id === activePlaylistId) || bizPlaylists[0];

  const openFramingEditor = (item: Playlist['items'][number]) => {
    setFramingItemId(item.id);
    setFramingDraft({
      fit: item.framing?.fit || 'COVER',
      zoom: item.framing?.zoom || 1,
      positionX: item.framing?.positionX ?? 50,
      positionY: item.framing?.positionY ?? 50,
      rotation: item.framing?.rotation || 0,
    });
  };

  const saveFraming = () => {
    if (!activePlaylist || !framingItemId) return;
    const items = activePlaylist.items.map(item =>
      item.id === framingItemId ? { ...item, framing: framingDraft } : item
    );
    onUpdatePlaylist({ ...activePlaylist, items });
    setFramingItemId(null);
  };

  const resetFraming = () => {
    setFramingDraft({ fit: 'COVER', zoom: 1, positionX: 50, positionY: 50, rotation: 0 });
  };


  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlName.trim()) return;
    onCreatePlaylist(newPlName, newPlDesc);
    setNewPlName('');
    setNewPlDesc('');
    setShowCreateModal(false);
  };

  const handleAddItemToPlaylist = (contentId: string) => {
    if (!activePlaylist) return;
    const newItem = {
      id: `pli-${Date.now()}`,
      contentId,
      order: activePlaylist.items.length + 1,
      customDurationSeconds: 10,
      transitionEffect: 'FADE' as const,
    };
    onUpdatePlaylist({
      ...activePlaylist,
      items: [...activePlaylist.items, newItem],
    });
  };

  const handleRemoveItem = (itemId: string) => {
    if (!activePlaylist) return;
    onUpdatePlaylist({
      ...activePlaylist,
      items: activePlaylist.items.filter(i => i.id !== itemId),
    });
  };

  const handleMoveItem = (index: number, direction: 'UP' | 'DOWN') => {
    if (!activePlaylist) return;
    const items = [...activePlaylist.items];
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;

    const temp = items[index];
    items[index] = items[targetIdx];
    items[targetIdx] = temp;

    // re-index order
    items.forEach((item, idx) => { item.order = idx + 1; });

    onUpdatePlaylist({
      ...activePlaylist,
      items,
    });
  };

  const handleAddScheduleRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlaylist || schDays.length === 0) return;
    const newRule: ScheduleRule = {
      id: `sch-${Date.now()}`,
      name: schName,
      startTime: schStartTime,
      endTime: schEndTime,
      daysOfWeek: schDays,
      priority: schPriority,
    };
    onUpdatePlaylist({
      ...activePlaylist,
      schedules: [...(activePlaylist.schedules || []), newRule],
    });
    setShowScheduleModal(false);
  };

  const handleRemoveScheduleRule = (ruleId: string) => {
    if (!activePlaylist) return;
    onUpdatePlaylist({
      ...activePlaylist,
      schedules: (activePlaylist.schedules || []).filter(s => s.id !== ruleId),
    });
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Playlist Timeline & Daypart Scheduler</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Arrange media playback sequences, slide durations, motion transitions, and automated time-slot rules.
          </p>
        </div>

        {canManage && (
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Playlist
        </button>
        )}
      </div>

      {/* Playlist Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {bizPlaylists.map((pl) => (
          <button
            key={pl.id}
            onClick={() => setActivePlaylistId(pl.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
              activePlaylistId === pl.id
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : darkMode
                  ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ListMusic className="w-4 h-4" />
            <span>{pl.name}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/20">
              {pl.items.length} items
            </span>
          </button>
        ))}
      </div>

      {activePlaylist && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Timeline Sequence */}
          <div className={`p-6 rounded-2xl border lg:col-span-2 space-y-6 ${
            darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">{activePlaylist.name} Sequence</h2>
                <p className="text-xs text-slate-400">{activePlaylist.description}</p>
              </div>

              {/* Loop / Shuffle Controls */}
              <div className="flex items-center gap-3 text-xs">
                <button
                  onClick={() => onUpdatePlaylist({ ...activePlaylist, loop: !activePlaylist.loop })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold ${
                    activePlaylist.loop
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                      : 'text-slate-400 border-slate-700'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" /> Loop
                </button>
                <button
                  onClick={() => onUpdatePlaylist({ ...activePlaylist, shuffle: !activePlaylist.shuffle })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold ${
                    activePlaylist.shuffle
                      ? 'bg-purple-500/10 text-purple-500 border-purple-500/30'
                      : 'text-slate-400 border-slate-700'
                  }`}
                >
                  <Shuffle className="w-3.5 h-3.5" /> Shuffle
                </button>
              </div>
            </div>

            {/* Sequence List */}
            <div className="space-y-3">
              {activePlaylist.items.map((item, index) => {
                const content = contents.find(c => c.id === item.contentId);

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                      darkMode ? 'bg-slate-800/50 border-slate-700/60' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-500 text-xs font-bold flex items-center justify-center shrink-0">
                        #{index + 1}
                      </span>

                      {content?.type === 'IMAGE' ? (
                        <img src={content.url} alt="" className="w-12 h-10 object-cover rounded-lg shrink-0" />
                      ) : (
                        <div className="w-12 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                          {content?.type}
                        </div>
                      )}

                      <div className="min-w-0">
                        <h4 className="text-xs font-bold truncate">{content?.title || 'Media Asset'}</h4>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-0.5">
                          <span>Transition: {item.transitionEffect}</span>
                          {item.framing && <span>Frame: {item.framing.fit.toLowerCase()} · {item.framing.zoom.toFixed(1)}×</span>}
                          <span>Default: {content?.durationSeconds}s</span>
                        </div>
                      </div>
                    </div>

                    {/* Order & Settings */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-900 px-2 py-1 rounded-lg text-xs">
                        <Clock className="w-3.5 h-3.5 text-rose-500" />
                        <input
                          type="number"
                          min={3}
                          max={300}
                          value={item.customDurationSeconds || 10}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const updatedItems = [...activePlaylist.items];
                            updatedItems[index].customDurationSeconds = val;
                            onUpdatePlaylist({ ...activePlaylist, items: updatedItems });
                          }}
                          className="w-10 text-center bg-transparent font-mono font-bold outline-none"
                        />
                        <span className="text-[10px] text-slate-400">sec</span>
                      </div>

                      {canManage && (
                      <button
                        onClick={() => openFramingEditor(item)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-bold ${
                          item.framing
                            ? 'border-rose-500/40 text-rose-500 bg-rose-500/5'
                            : 'border-slate-300 dark:border-slate-700 text-slate-400'
                        }`}
                        title="Crop, zoom and position this media inside this playlist/grid zone"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        Frame
                      </button>
                      )}

                      {canManage && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveItem(index, 'UP')}
                          disabled={index === 0}
                          className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveItem(index, 'DOWN')}
                          disabled={index === activePlaylist.items.length - 1}
                          className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      )}

                      {canManage && (
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Schedule Section */}
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-rose-500" />
                  <h3 className="text-sm font-bold">Automated Time Schedules (Dayparting)</h3>
                </div>
                {canManage && (
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-rose-500 hover:bg-slate-200"
                >
                  + Add Time Rule
                </button>
                )}
              </div>

              {(!activePlaylist.schedules || activePlaylist.schedules.length === 0) && (
                <p className="text-xs text-slate-400">
                  No schedule rules yet — this playlist plays whenever it's assigned as a device's default. Add a rule to make it take over automatically during specific hours (e.g. lunch menu 12–2pm), on a device that has multiple playlists assigned.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activePlaylist.schedules?.map((sch) => (
                  <div key={sch.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1 bg-slate-50 dark:bg-slate-800/30 relative">
                    {canManage && (
                      <button
                        onClick={() => handleRemoveScheduleRule(sch.id)}
                        className="absolute top-2 right-2 text-slate-400 hover:text-rose-500"
                        title="Remove schedule"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <p className="font-bold pr-4">{sch.name}</p>
                    <p className="text-slate-400 font-mono">
                      {sch.startTime} - {sch.endTime}
                    </p>
                    <p className="text-slate-400">
                      {sch.daysOfWeek.length === 7 ? 'Every day' : sch.daysOfWeek.map(d => DAY_LABELS[d]).join(', ')}
                      {' · priority '}{sch.priority}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Media Selector Sidebar */}
          <div className={`p-6 rounded-2xl border space-y-4 ${
            darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <h3 className="text-sm font-bold">Available Media Assets</h3>
            <p className="text-xs text-slate-400">Click to append asset to current timeline</p>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {bizContents.map((c) => (
                <div
                  key={c.id}
                  onClick={() => canManage && handleAddItemToPlaylist(c.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                    canManage ? 'cursor-pointer hover:border-rose-500' : 'cursor-default opacity-70'
                  } ${
                    darkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold truncate">{c.title}</p>
                    <p className="text-[10px] text-slate-400">{c.type} · {c.durationSeconds}s</p>
                  </div>
                  <Plus className="w-4 h-4 text-rose-500 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Per-item framing editor */}
      {framingItemId && activePlaylist && (() => {
        const frameItem = activePlaylist.items.find(i => i.id === framingItemId);
        const frameContent = contents.find(c => c.id === frameItem?.contentId);
        if (!frameItem || !frameContent) return null;
        const previewStyle: React.CSSProperties = {
          objectFit: framingDraft.fit === 'COVER' ? 'cover' : 'contain',
          objectPosition: `${framingDraft.positionX}% ${framingDraft.positionY}%`,
          transform: `scale(${framingDraft.zoom}) rotate(${framingDraft.rotation}deg)`,
          transformOrigin: 'center center',
        };
        return (
          <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 rounded-2xl border space-y-5 ${
              darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold">Frame Media for This Zone</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {frameContent.title} · Original file stays unchanged. These settings apply only to this playlist item/grid zone.
                  </p>
                </div>
                <button onClick={() => setFramingItemId(null)} className="p-2 rounded-lg hover:bg-slate-800/60"><X className="w-4 h-4" /></button>
              </div>

              <div className="grid lg:grid-cols-[1.35fr_1fr] gap-6">
                <div>
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-slate-800">
                    {(frameContent.type === 'IMAGE' || frameContent.type === 'VIDEO') ? (
                      frameContent.type === 'IMAGE' ? (
                        <img src={frameContent.url} alt="" className="w-full h-full" style={previewStyle} />
                      ) : (
                        <video src={frameContent.url} muted autoPlay loop playsInline className="w-full h-full" style={previewStyle} />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">Preview framing applies to uploaded image/video media.</div>
                    )}
                    <div className="absolute inset-0 pointer-events-none border border-white/20" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">Preview uses the same crop/position rules that the TV player will use.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-2">Fit mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['COVER','CONTAIN'] as const).map(v => (
                        <button key={v} onClick={() => setFramingDraft(d => ({...d, fit: v}))}
                          className={`px-3 py-2 rounded-lg border text-xs font-bold ${framingDraft.fit === v ? 'bg-rose-600 text-white border-rose-600' : 'border-slate-700 text-slate-400'}`}>
                          {v === 'COVER' ? 'Fill / Crop' : 'Fit / Letterbox'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {([
                    ['Zoom', 'zoom', 1, 3, 0.05, '×'],
                    ['Horizontal position', 'positionX', 0, 100, 1, '%'],
                    ['Vertical position', 'positionY', 0, 100, 1, '%'],
                  ] as const).map(([label, key, min, max, step, suffix]) => (
                    <div key={key}>
                      <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
                        <span>{label}</span>
                        <span>{String(framingDraft[key])}{suffix}</span>
                      </div>
                      <input
                        type="range" min={min} max={max} step={step}
                        value={framingDraft[key]}
                        onChange={e => setFramingDraft(d => ({...d, [key]: Number(e.target.value)}))}
                        className="w-full accent-rose-600"
                      />
                    </div>
                  ))}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-2">Rotation</label>
                    <div className="grid grid-cols-4 gap-2">
                      {([0,90,180,270] as const).map(v => (
                        <button key={v} onClick={() => setFramingDraft(d => ({...d, rotation: v}))}
                          className={`px-2 py-2 rounded-lg border text-xs font-bold ${framingDraft.rotation === v ? 'bg-rose-600 text-white border-rose-600' : 'border-slate-700 text-slate-400'}`}>
                          {v}°
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button onClick={resetFraming} className="px-3 py-2 rounded-lg border border-slate-700 text-xs font-semibold text-slate-400">Reset</button>
                    <button onClick={() => setFramingItemId(null)} className="px-3 py-2 rounded-lg border border-slate-700 text-xs font-semibold">Cancel</button>
                    <button onClick={saveFraming} className="flex-1 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold">Save Framing</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-2xl border space-y-4 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <h3 className="text-base font-bold">Create New Display Playlist</h3>
            <form onSubmit={handleCreatePlaylist} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Playlist Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lunch Hours Menu Specials"
                  value={newPlName}
                  onChange={(e) => setNewPlName(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border outline-none ${
                    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Description</label>
                <input
                  type="text"
                  placeholder="Brief note on target displays..."
                  value={newPlDesc}
                  onChange={(e) => setNewPlDesc(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border outline-none ${
                    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 text-white font-semibold shadow-sm"
                >
                  Create Playlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-2xl border space-y-4 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <h3 className="text-base font-bold">Add Automated Time-Slot Rule</h3>
            <form onSubmit={handleAddScheduleRule} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Schedule Name</label>
                <input
                  type="text"
                  required
                  value={schName}
                  onChange={(e) => setSchName(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border outline-none ${
                    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Start Time</label>
                  <input
                    type="time"
                    required
                    value={schStartTime}
                    onChange={(e) => setSchStartTime(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border outline-none ${
                      darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">End Time</label>
                  <input
                    type="time"
                    required
                    value={schEndTime}
                    onChange={(e) => setSchEndTime(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border outline-none ${
                      darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Days Active</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DAY_LABELS.map((label, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`w-9 h-9 rounded-lg text-[10px] font-bold border transition-colors ${
                        schDays.includes(idx)
                          ? 'bg-rose-600 border-rose-600 text-white'
                          : darkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {schDays.length === 0 && <p className="text-rose-500 text-[10px] mt-1">Pick at least one day.</p>}
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Priority <span className="text-slate-500 font-normal">(higher wins if two schedules overlap)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={schPriority}
                  onChange={(e) => setSchPriority(Number(e.target.value))}
                  className={`w-full p-2.5 rounded-xl border outline-none ${
                    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={schDays.length === 0}
                  className="px-5 py-2 rounded-xl bg-rose-600 text-white font-semibold shadow-sm disabled:opacity-50"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
