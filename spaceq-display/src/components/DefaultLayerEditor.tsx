import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { uploadToCloudinary } from '../lib/cloudinary';
import { Device } from '../types';
import { ImagePlus, Save, Globe2, Monitor, Loader2, RotateCcw } from 'lucide-react';

type Scope = 'GLOBAL' | 'DEVICES';
type SlideConfig = {
  enabled: boolean;
  headline: string;
  subheading: string;
  contact: string;
  footer: string;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  backgroundImageUrl: string;
  deviceIds: string[];
};
const defaults = (): SlideConfig => ({
  enabled: true,
  headline: 'ADVERTISE HERE',
  subheading: 'Reach more customers with SPACEQ digital displays.',
  contact: 'For advertising enquiries: 9494492902',
  footer: 'LOCAL • REGIONAL • BRAND ADVERTISING',
  backgroundColor: '#071A35',
  accentColor: '#00B3A4',
  textColor: '#FFFFFF',
  backgroundImageUrl: '',
  deviceIds: [],
});

export const DefaultLayerEditor: React.FC<{ businessId: string; devices: Device[]; darkMode: boolean }> = ({ businessId, devices, darkMode }) => {
  const [scope, setScope] = useState<Scope>('GLOBAL');
  const [globalConfig, setGlobalConfig] = useState<SlideConfig>(defaults());
  const [deviceConfig, setDeviceConfig] = useState<SlideConfig>(defaults());
  const [config, setConfig] = useState<SlideConfig>(defaults());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const panel = darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-gray-200 text-gray-900';
  const field = `w-full rounded-lg border p-2.5 text-sm ${darkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`;

  useEffect(() => {
    if (!businessId) return;
    const stopGlobal = onSnapshot(doc(db, 'defaultDisplaySlides', businessId), snap => {
      setGlobalConfig({ ...defaults(), ...(snap.exists() ? snap.data() : {}) } as SlideConfig);
    }, error => setNotice(error.message));
    const stopDevices = onSnapshot(doc(db, 'defaultDisplaySlides', businessId + '_devices'), snap => {
      setDeviceConfig({ ...defaults(), ...(snap.exists() ? snap.data() : {}) } as SlideConfig);
    }, error => setNotice(error.message));
    return () => { stopGlobal(); stopDevices(); };
  }, [businessId]);

  useEffect(() => {
    setConfig(scope === 'GLOBAL' ? globalConfig : deviceConfig);
  }, [scope, globalConfig, deviceConfig]);

  const update = (patch: Partial<SlideConfig>) => setConfig(prev => ({ ...prev, ...patch }));
  const uploadBackground = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setNotice('Choose an image file.'); return; }
    if (file.size > 15 * 1024 * 1024) { setNotice('Image must be 15 MB or smaller.'); return; }
    setUploading(true); setNotice('');
    try {
      const result = await uploadToCloudinary(file, () => {});
      update({ backgroundImageUrl: result.url });
      setNotice('Background uploaded. Save & Publish to apply it.');
    } catch (error: any) { setNotice(error?.message || 'Image upload failed.'); }
    finally { setUploading(false); }
  };
  const save = async () => {
    if (scope === 'DEVICES' && config.deviceIds.length === 0) { setNotice('Select at least one display.'); return; }
    setSaving(true); setNotice('');
    try {
      const id = scope === 'GLOBAL' ? businessId : businessId + '_devices';
      await setDoc(doc(db, 'defaultDisplaySlides', id), {
        ...config, enabled: true, businessId, scope,
        deviceIds: scope === 'GLOBAL' ? [] : config.deviceIds,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      setNotice('Default display slide saved and published.');
    } catch (error: any) { setNotice(error?.message || 'Could not save default slide.'); }
    finally { setSaving(false); }
  };

  return <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
    <div><p className="text-xs font-bold uppercase tracking-widest text-rose-500">Playback fallback</p><h1 className="text-2xl font-bold mt-1">Default Display Layer</h1><p className="text-sm text-slate-500 mt-1">This slide appears automatically when the screen has no playable manual playlist content and no campaign is currently playing.</p></div>
    <div className={`rounded-2xl border p-5 space-y-5 ${panel}`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Fallback slide settings</h2><p className="text-xs text-slate-500">Global settings apply to every screen. Selected-device settings override global settings for chosen screens.</p></div><span className="rounded-full bg-emerald-500/10 text-emerald-500 px-3 py-1 text-xs font-bold">Always enabled</span></div>
      <div className="flex gap-2">
        <button onClick={() => setScope('GLOBAL')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${scope === 'GLOBAL' ? 'bg-blue-600 text-white' : 'bg-slate-500/10'}`}><Globe2 className="inline mr-2" size={15}/>Global</button>
        <button onClick={() => setScope('DEVICES')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${scope === 'DEVICES' ? 'bg-blue-600 text-white' : 'bg-slate-500/10'}`}><Monitor className="inline mr-2" size={15}/>Selected devices</button>
      </div>
      {scope === 'DEVICES' && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{devices.map(d => <label key={d.id} className="flex items-center gap-2 p-3 rounded-lg border border-slate-500/20 text-sm"><input type="checkbox" checked={config.deviceIds.includes(d.id)} onChange={e => update({ deviceIds: e.target.checked ? [...config.deviceIds,d.id] : config.deviceIds.filter(x => x !== d.id) })}/>{d.name}</label>)}</div>}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <label className="block text-sm font-semibold">Main headline<input className={field + ' mt-1'} maxLength={60} value={config.headline} onChange={e => update({ headline: e.target.value })}/></label>
          <label className="block text-sm font-semibold">Supporting message<textarea className={field + ' mt-1'} rows={3} maxLength={180} value={config.subheading} onChange={e => update({ subheading: e.target.value })}/></label>
          <label className="block text-sm font-semibold">Contact line<input className={field + ' mt-1'} maxLength={100} value={config.contact} onChange={e => update({ contact: e.target.value })}/></label>
          <label className="block text-sm font-semibold">Footer / service line<input className={field + ' mt-1'} maxLength={100} value={config.footer} onChange={e => update({ footer: e.target.value })}/></label>
          <div className="grid grid-cols-3 gap-3">
            <label className="text-xs font-semibold">Background<input type="color" className="mt-2 block w-full h-10" value={config.backgroundColor} onChange={e => update({ backgroundColor: e.target.value })}/></label>
            <label className="text-xs font-semibold">Accent<input type="color" className="mt-2 block w-full h-10" value={config.accentColor} onChange={e => update({ accentColor: e.target.value })}/></label>
            <label className="text-xs font-semibold">Text<input type="color" className="mt-2 block w-full h-10" value={config.textColor} onChange={e => update({ textColor: e.target.value })}/></label>
          </div>
          <div className="rounded-xl border border-dashed border-slate-500/40 p-4 space-y-2"><p className="text-sm font-semibold">Optional background image</p><input type="file" accept="image/*" onChange={e => uploadBackground(e.target.files?.[0])} className="block w-full text-sm"/>{uploading && <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="animate-spin" size={14}/>Uploading…</p>}{config.backgroundImageUrl && <button onClick={() => update({ backgroundImageUrl: '' })} className="text-xs text-rose-500">Remove background image</button>}<p className="text-xs text-slate-500">Upload a landscape or portrait background; it will fill the physical screen.</p></div>
          <div className="flex flex-wrap gap-2"><button onClick={() => update(defaults())} className="px-4 py-2 rounded-lg border border-slate-500/30 text-sm"><RotateCcw className="inline mr-2" size={14}/>Reset editor</button><button disabled={saving || uploading} onClick={save} className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-sm flex items-center gap-2"><Save size={15}/>{saving ? 'Publishing…' : 'Save & Publish'}</button></div>
          {notice && <p className="text-xs text-slate-500">{notice}</p>}
        </div>
        <div><p className="text-sm font-semibold mb-2">Live preview · 16:9</p><div className="relative aspect-video rounded-xl overflow-hidden flex flex-col items-center justify-center text-center p-8" style={{ backgroundColor: config.backgroundColor, backgroundImage: config.backgroundImageUrl ? `linear-gradient(rgba(0,0,0,.48),rgba(0,0,0,.58)),url("${config.backgroundImageUrl}")` : `radial-gradient(circle at 85% 15%, ${config.accentColor}55, transparent 38%)`, backgroundSize: 'cover', backgroundPosition: 'center', color: config.textColor }}>
            <div className="text-xs font-bold tracking-[.35em] mb-5" style={{ color: config.accentColor }}>SPACEQ DIGITAL DISPLAYS</div>
            <div className="text-4xl md:text-5xl font-black tracking-tight leading-tight">{config.headline || 'ADVERTISE HERE'}</div>
            <div className="max-w-xl mt-4 text-base md:text-lg opacity-90">{config.subheading}</div>
            <div className="mt-7 rounded-full px-6 py-3 font-bold text-sm md:text-base" style={{ background: config.accentColor, color: '#071A35' }}>{config.contact}</div>
            <div className="absolute bottom-4 text-[10px] tracking-[.2em] opacity-75">{config.footer}</div>
          </div><p className="text-xs text-slate-500 mt-2">The preview updates as you edit. The TV receives saved changes automatically.</p></div>
      </div>
    </div>
  </div>;
};
