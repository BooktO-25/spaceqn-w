import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { uploadToCloudinary } from '../lib/cloudinary';
import { Device } from '../types';
import { ImagePlus, Save, Monitor, Globe2, Loader2, Sparkles } from 'lucide-react';
import { ScrollingTextView } from './ScrollingTextView';
import { CubeEditor } from './CubeEditor';
import { MascotEditor } from './MascotEditor';

type Scope = 'GLOBAL' | 'DEVICES';
type FrameMode = 'TEMPLATE' | 'UPLOAD';
type ColorMode = 'SINGLE' | 'RGB' | 'PATTERN';
type FrameConfig = {
  enabled: boolean;
  mode: FrameMode;
  template: string;
  imageUrl: string;
  colorMode: ColorMode;
  color: string;
  pattern: string;
  deviceIds: string[];
};
const templates = [
  { id: 'aurora', name: 'Aurora Flow', description: 'Animated gradient border' },
  { id: 'orbit', name: 'Orbit Dash', description: 'Moving luminous dash border' },
  { id: 'pulse', name: 'Pulse Glow', description: 'Breathing neon light' },
  { id: 'corner', name: 'Corner Sweep', description: 'Animated corner accents' },
  { id: 'luxury', name: 'Luxury Double', description: 'Elegant double-line gold frame' },
];
const emptyFrame = (): FrameConfig => ({
  enabled: false, mode: 'TEMPLATE', template: 'classic', imageUrl: '',
  colorMode: 'SINGLE', color: '#00B3A4', pattern: 'STRIPES', deviceIds: [],
});

export const FeatureEditorView: React.FC<{ businessId: string; devices: Device[]; darkMode: boolean }> = ({ businessId, devices, darkMode }) => {
  const [feature, setFeature] = useState<'TICKER' | 'FRAMES' | 'CUBE' | 'MASCOT'>('TICKER');
  const [scope, setScope] = useState<Scope>('GLOBAL');
  const [globalFrame, setGlobalFrame] = useState<FrameConfig>(emptyFrame());
  const [deviceFrame, setDeviceFrame] = useState<FrameConfig>(emptyFrame());
  const [frame, setFrame] = useState<FrameConfig>(emptyFrame());
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const panel = darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-gray-200 text-gray-900';

  useEffect(() => {
    if (!businessId) return;
    const stopGlobal = onSnapshot(doc(db, 'scrollingMessages', businessId), snap => {
      const data = snap.exists() ? snap.data() : {};
      setGlobalFrame(data.frame || emptyFrame());
    });
    const stopDevices = onSnapshot(doc(db, 'scrollingMessages', businessId + '_devices'), snap => {
      const data = snap.exists() ? snap.data() : {};
      setDeviceFrame(data.frame || emptyFrame());
    });
    return () => { stopGlobal(); stopDevices(); };
  }, [businessId]);

  useEffect(() => {
    setFrame(scope === 'GLOBAL' ? globalFrame : deviceFrame);
  }, [scope, globalFrame, deviceFrame]);

  const update = (patch: Partial<FrameConfig>) => setFrame(prev => ({ ...prev, ...patch }));
  const handleUpload = async (file?: File) => {
    if (!file) return;
    if (file.type !== 'image/png') { setNotice('Please upload a transparent PNG frame.'); return; }
    if (file.size > 15 * 1024 * 1024) { setNotice('PNG must be 15 MB or smaller.'); return; }
    setUploading(true); setNotice('');
    try {
      const result = await uploadToCloudinary(file, () => {});
      update({ mode: 'UPLOAD', imageUrl: result.url });
      setNotice('Frame PNG uploaded. Save & Publish to apply it.');
    } catch (e: any) {
      setNotice(e?.message || 'Frame upload failed.');
    } finally { setUploading(false); }
  };

  const saveFrame = async () => {
    if (scope === 'DEVICES' && !frame.deviceIds.length) { setNotice('Select at least one display.'); return; }
    if (frame.mode === 'UPLOAD' && !frame.imageUrl) { setNotice('Upload a PNG frame first.'); return; }
    setSaving(true); setNotice('');
    try {
      const id = scope === 'GLOBAL' ? businessId : businessId + '_devices';
      await setDoc(doc(db, 'scrollingMessages', id), {
        businessId, scope, frame: { ...frame, deviceIds: scope === 'GLOBAL' ? [] : frame.deviceIds },
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      setNotice('Frame settings saved and published.');
    } catch (e: any) { setNotice(e?.message || 'Could not save frame settings.'); }
    finally { setSaving(false); }
  };

  const previewFrameClass = 'sq-frame sq-frame--' + frame.template + (frame.colorMode === 'RGB' ? ' sq-frame--rgb' : '') + (frame.colorMode === 'PATTERN' ? ' sq-frame--pattern' : '');
  const previewFrameStyle: React.CSSProperties = { '--sq-frame-color': frame.color || '#00B3A4' } as React.CSSProperties;

  return <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
    <style>{`.sq-frame{position:absolute;inset:0;pointer-events:none;--sq-frame-color:#00B3A4}
.sq-frame:before{content:'';position:absolute;pointer-events:none}
.sq-frame--aurora:before{inset:0;border:9px solid transparent;border-image:linear-gradient(120deg,#00e5ff,#7c3aed,#ff2d95,#facc15,#00e5ff) 1;filter:drop-shadow(0 0 7px #00e5ff);animation:sq-hue 4s linear infinite}
.sq-frame--orbit:before{inset:0;border:8px dashed #00e5ff;box-shadow:inset 0 0 12px #00e5ff,0 0 12px #00e5ff;animation:sq-orbit 5s linear infinite}
.sq-frame--pulse:before{inset:5px;border:8px solid var(--sq-frame-color);box-shadow:inset 0 0 20px var(--sq-frame-color),0 0 20px var(--sq-frame-color);animation:sq-pulse 2s ease-in-out infinite}
.sq-frame--corner:before{inset:0;background:linear-gradient(var(--sq-frame-color),var(--sq-frame-color)) left top/42px 5px no-repeat,linear-gradient(var(--sq-frame-color),var(--sq-frame-color)) left top/5px 42px no-repeat,linear-gradient(var(--sq-frame-color),var(--sq-frame-color)) right top/42px 5px no-repeat,linear-gradient(var(--sq-frame-color),var(--sq-frame-color)) right top/5px 42px no-repeat,linear-gradient(var(--sq-frame-color),var(--sq-frame-color)) left bottom/42px 5px no-repeat,linear-gradient(var(--sq-frame-color),var(--sq-frame-color)) left bottom/5px 42px no-repeat,linear-gradient(var(--sq-frame-color),var(--sq-frame-color)) right bottom/42px 5px no-repeat,linear-gradient(var(--sq-frame-color),var(--sq-frame-color)) right bottom/5px 42px no-repeat;animation:sq-corner 2s ease-in-out infinite alternate}
.sq-frame--luxury:before{inset:5px;border:3px double #d6ad55;box-shadow:inset 0 0 0 3px #5b421c,0 0 12px #d6ad55}
.sq-frame--rgb{animation:sq-hue 3s linear infinite}
.sq-frame--pattern:before{inset:0;border:10px solid transparent;border-image:repeating-linear-gradient(45deg,#f59e0b 0 8px,#7c3aed 8px 16px,#06b6d4 16px 24px) 1}
@keyframes sq-hue{to{filter:hue-rotate(360deg)}}
@keyframes sq-orbit{to{filter:hue-rotate(360deg)}}
@keyframes sq-pulse{0%,100%{opacity:.5;box-shadow:inset 0 0 8px var(--sq-frame-color),0 0 8px var(--sq-frame-color)}50%{opacity:1;box-shadow:inset 0 0 28px var(--sq-frame-color),0 0 28px var(--sq-frame-color)}}
@keyframes sq-corner{from{filter:brightness(.65)}to{filter:brightness(1.8)}}`}</style>

    <div><p className="text-xs font-bold uppercase tracking-widest text-rose-500">Management</p><h1 className="text-2xl font-bold mt-1">Feature Editor</h1><p className="text-sm text-slate-500 mt-1">Manage on-screen scrolling messages and decorative display frames.</p></div>
    <div className="flex flex-wrap gap-2">
      <button onClick={() => setFeature('TICKER')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${feature === 'TICKER' ? 'bg-blue-600 text-white' : 'bg-slate-500/10'}`}>Scrolling Text</button>
      <button onClick={() => setFeature('FRAMES')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${feature === 'FRAMES' ? 'bg-blue-600 text-white' : 'bg-slate-500/10'}`}><Sparkles className="inline mr-2" size={15}/>Frames</button>
      <button onClick={() => setFeature('CUBE')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${feature === 'CUBE' ? 'bg-blue-600 text-white' : 'bg-slate-500/10'}`}>3D Rotating Cube</button>
      <button onClick={() => setFeature('MASCOT')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${feature === 'MASCOT' ? 'bg-blue-600 text-white' : 'bg-slate-500/10'}`}>Interactive Mascot</button>
    </div>
    {feature === 'TICKER' ? <ScrollingTextView businessId={businessId} devices={devices} darkMode={darkMode}/> : feature === 'CUBE' ? <CubeEditor businessId={businessId} devices={devices} darkMode={darkMode}/> : feature === 'MASCOT' ? <MascotEditor businessId={businessId} devices={devices} darkMode={darkMode}/> : <>
      <div className={`rounded-2xl border p-5 space-y-5 ${panel}`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Frame broadcast</h2><p className="text-xs text-slate-500">Global frame is the master. Selected-device frames take over only while Global is OFF.</p></div><button onClick={() => update({ enabled: !frame.enabled })} className={`rounded-full px-5 py-2 text-sm font-bold ${frame.enabled ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200'}`}>{frame.enabled ? 'ON · ACTIVE' : 'OFF · PAUSED'}</button></div>
        <div className="flex gap-2"><button onClick={() => setScope('GLOBAL')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${scope === 'GLOBAL' ? 'bg-blue-600 text-white' : 'bg-slate-500/10'}`}><Globe2 className="inline mr-2" size={15}/>Global</button><button onClick={() => setScope('DEVICES')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${scope === 'DEVICES' ? 'bg-blue-600 text-white' : 'bg-slate-500/10'}`}><Monitor className="inline mr-2" size={15}/>Selected devices</button></div>
        {scope === 'DEVICES' && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{devices.map(d => <label key={d.id} className="flex items-center gap-2 p-3 rounded-lg border border-slate-500/20 text-sm"><input type="checkbox" checked={frame.deviceIds.includes(d.id)} onChange={e => update({ deviceIds: e.target.checked ? [...frame.deviceIds,d.id] : frame.deviceIds.filter(x => x !== d.id) })}/>{d.name}</label>)}</div>}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex gap-2"><button onClick={() => update({ mode: 'TEMPLATE' })} className={`px-3 py-2 rounded-lg text-sm ${frame.mode === 'TEMPLATE' ? 'bg-rose-600 text-white' : 'bg-slate-500/10'}`}>Built-in templates</button><button onClick={() => update({ mode: 'UPLOAD' })} className={`px-3 py-2 rounded-lg text-sm ${frame.mode === 'UPLOAD' ? 'bg-rose-600 text-white' : 'bg-slate-500/10'}`}><ImagePlus className="inline mr-1" size={15}/>Upload PNG</button></div>
            {frame.mode === 'TEMPLATE' ? <div className="grid grid-cols-2 gap-2">{templates.map(t => <button key={t.id} onClick={() => update({ template: t.id })} className={`text-left rounded-xl border p-3 ${frame.template === t.id ? 'border-rose-500 bg-rose-500/10' : 'border-slate-500/20'}`}><div className="font-semibold text-sm">{t.name}</div><div className="text-xs text-slate-500 mt-1">{t.description}</div></button>)}</div> : <div className="rounded-xl border border-dashed border-slate-500/40 p-5 space-y-3"><input type="file" accept="image/png" onChange={e => handleUpload(e.target.files?.[0])} className="block w-full text-sm"/>{uploading && <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="animate-spin" size={14}/>Uploading PNG…</p>}{frame.imageUrl && <p className="text-xs text-emerald-500">PNG frame uploaded and ready.</p>}<p className="text-xs text-slate-500">Use a transparent PNG with the artwork around the edges and a clear centre for the display content.</p></div>}
            <div><p className="text-sm font-semibold mb-2">Frame colour effect</p><div className="flex flex-wrap gap-2">{(['SINGLE','RGB','PATTERN'] as ColorMode[]).map(m => <button key={m} onClick={() => update({ colorMode: m })} className={`px-3 py-2 rounded-lg text-xs font-bold ${frame.colorMode === m ? 'bg-blue-600 text-white' : 'bg-slate-500/10'}`}>{m === 'RGB' ? 'RGB rotating' : m === 'PATTERN' ? 'Pattern' : 'Single colour'}</button>)}</div></div>
            {frame.colorMode === 'SINGLE' && <label className="block text-sm">Frame colour<input type="color" value={frame.color} onChange={e => update({ color: e.target.value })} className="block mt-2 h-10 w-full"/></label>}
            {frame.colorMode === 'PATTERN' && <label className="block text-sm">Pattern<select value={frame.pattern} onChange={e => update({ pattern: e.target.value })} className="block mt-2 w-full rounded-lg border border-slate-500/30 bg-transparent p-2"><option value="STRIPES">Diagonal stripes</option><option value="CHECKER">Checkerboard</option><option value="DOTS">Dots</option><option value="CHEVRON">Chevron</option></select></label>}
            <button disabled={saving || uploading} onClick={saveFrame} className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 px-4 py-3 text-white font-bold flex items-center justify-center gap-2"><Save size={16}/>{saving ? 'Publishing…' : 'Save & Publish'}</button>
            {notice && <p className="text-xs text-slate-500">{notice}</p>}
          </div>
          <div><p className="text-sm font-semibold mb-2">Live frame preview</p><div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center"><div className="absolute inset-5 flex items-center justify-center text-slate-600 text-xs tracking-widest">DISPLAY CONTENT AREA</div>{frame.mode === 'UPLOAD' && frame.imageUrl ? <img src={frame.imageUrl} className="absolute inset-0 w-full h-full object-fill pointer-events-none" alt="Uploaded frame preview"/> : <div className={previewFrameClass} style={previewFrameStyle}/>}</div><p className="text-xs text-slate-500 mt-2">Preview is illustrative; the saved frame is rendered over every active display in the selected scope.</p></div>
        </div>
      </div>
    </>}
  </div>;
};
