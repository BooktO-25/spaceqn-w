import React, { useEffect, useState } from 'react';
import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { ContentItem, Device } from '../types';
import { Megaphone, Plus, Users, CalendarDays, Tv, Trash2, Pencil, X, Save, BarChart3 } from 'lucide-react';
import { CampaignDeliveryReport } from './CampaignDeliveryReport';

type Advertiser = {
  id: string; businessId: string; name: string; contactPerson: string;
  phone: string; email: string; category: string; notes: string; createdAt: string;
};
type Campaign = {
  id: string; businessId: string; advertiserId: string; advertiserName: string;
  name: string; contentId: string; contentTitle: string; deviceIds: string[];
  startDate: string; endDate: string; playsPerScreenPerDay: number;
  monthlyPrice: number; status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  createdAt: string; updatedAt: string;
};

interface Props { businessId: string; devices: Device[]; contents: ContentItem[]; darkMode: boolean; }

const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-500/30';
const blankAdvertiser = { name: '', contactPerson: '', phone: '', email: '', category: 'Other', notes: '' };
const blankCampaign = { advertiserId: '', name: '', contentId: '', deviceIds: [] as string[], startDate: new Date().toISOString().slice(0,10), endDate: '', playsPerScreenPerDay: 40, monthlyPrice: 0 };

export const CampaignHubView: React.FC<Props> = ({ businessId, devices, contents, darkMode }) => {
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tab, setTab] = useState<'campaigns' | 'advertisers' | 'delivery'>('campaigns');
  const [showAdvertiserForm, setShowAdvertiserForm] = useState(false);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [advertiserForm, setAdvertiserForm] = useState(blankAdvertiser);
  const [campaignForm, setCampaignForm] = useState(blankCampaign);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const panel = darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-gray-200 text-gray-900';
  const muted = darkMode ? 'text-slate-400' : 'text-gray-500';
  const field = `${inputClass} ${darkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`;

  useEffect(() => {
    if (!auth.currentUser || !businessId) { setAdvertisers([]); setCampaigns([]); return; }
    const aq = query(collection(db, 'advertisers'), where('businessId', '==', businessId));
    const cq = query(collection(db, 'campaigns'), where('businessId', '==', businessId));
    const ua = onSnapshot(aq, snap => setAdvertisers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Advertiser))), e => setError(e.message));
    const uc = onSnapshot(cq, snap => setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() } as Campaign)).sort((a,b) => b.createdAt.localeCompare(a.createdAt))), e => setError(e.message));
    return () => { ua(); uc(); };
  }, [businessId]);

  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length;
  const selectedAdvertiser = advertisers.find(a => a.id === campaignForm.advertiserId);

  const saveAdvertiser = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!auth.currentUser || !advertiserForm.name.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'advertisers'), { ...advertiserForm, name: advertiserForm.name.trim(), businessId, createdAt: new Date().toISOString() });
      setAdvertiserForm(blankAdvertiser); setShowAdvertiserForm(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save advertiser'); }
    finally { setSaving(false); }
  };

  const openNewCampaign = () => {
    setEditingCampaignId(null);
    setCampaignForm({ ...blankCampaign, endDate: new Date(Date.now() + 30*86400000).toISOString().slice(0,10), deviceIds: devices.map(d => d.id) });
    setShowCampaignForm(true);
  };

  const openEditCampaign = (c: Campaign) => {
    setEditingCampaignId(c.id);
    setCampaignForm({ advertiserId: c.advertiserId, name: c.name, contentId: c.contentId, deviceIds: c.deviceIds || [], startDate: c.startDate, endDate: c.endDate, playsPerScreenPerDay: c.playsPerScreenPerDay, monthlyPrice: c.monthlyPrice });
    setShowCampaignForm(true);
  };

  const saveCampaign = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!auth.currentUser || !campaignForm.name.trim() || !campaignForm.advertiserId || !campaignForm.endDate) return;
    if (campaignForm.endDate < campaignForm.startDate || campaignForm.playsPerScreenPerDay < 1) { setError('Check the campaign dates and daily frequency.'); return; }
    setSaving(true);
    try {
      const content = contents.find(c => c.id === campaignForm.contentId);
      const advertiser = selectedAdvertiser || advertisers.find(a => a.id === campaignForm.advertiserId);
      const payload = { ...campaignForm, name: campaignForm.name.trim(), advertiserName: advertiser?.name || '', contentTitle: content?.title || '', businessId, status: (editingCampaignId ? campaigns.find(c => c.id === editingCampaignId)?.status : 'DRAFT') || 'DRAFT', updatedAt: new Date().toISOString() };
      if (editingCampaignId) {
        const existing = campaigns.find(c => c.id === editingCampaignId);
        if (existing?.status === 'ACTIVE') {
          const previousIds = existing.deviceIds || [];
          const nextIds = campaignForm.deviceIds || [];
          for (const id of previousIds.filter(id => !nextIds.includes(id))) {
            await updateDoc(doc(db, 'devices', id), { activeCampaignIds: arrayRemove(editingCampaignId) });
          }
          for (const id of nextIds.filter(id => !previousIds.includes(id))) {
            await updateDoc(doc(db, 'devices', id), { activeCampaignIds: arrayUnion(editingCampaignId) });
          }
        }
        await updateDoc(doc(db, 'campaigns', editingCampaignId), payload);
      } else {
        await addDoc(collection(db, 'campaigns'), { ...payload, createdAt: new Date().toISOString() });
      }
      setShowCampaignForm(false); setEditingCampaignId(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save campaign'); }
    finally { setSaving(false); }
  };

  const setCampaignStatus = async (c: Campaign, status: Campaign['status']) => {
    if (status === 'ACTIVE' && (!c.contentId || !c.deviceIds || c.deviceIds.length === 0)) {
      setError('Add a creative and select at least one screen before activating this campaign.');
      return;
    }
    try {
      if (status === 'ACTIVE') {
        const conflicts = (c.deviceIds || []).flatMap(deviceId => {
          const overlapping = campaigns.filter(other =>
            other.id !== c.id &&
            other.status === 'ACTIVE' &&
            (other.deviceIds || []).includes(deviceId) &&
            other.startDate <= c.endDate &&
            other.endDate >= c.startDate
          );
          const committed = overlapping.reduce((sum, other) => sum + Math.max(0, Number(other.playsPerScreenPerDay) || 0), 0);
          const requested = Math.max(0, Number(c.playsPerScreenPerDay) || 0);
          return committed + requested > 3240
            ? [{ deviceId, committed, requested, total: committed + requested }]
            : [];
        });
        if (conflicts.length) {
          const first = conflicts[0];
          const screenName = devices.find(d => d.id === first.deviceId)?.name || first.deviceId;
          setError(`Capacity exceeded on ${screenName}: ${first.committed} existing + ${first.requested} requested = ${first.total} plays/day. The sellable limit is 3,240 per screen/day.`);
          return;
        }
      }
      // Keep the device's campaign ID list as the kiosk's narrow, exact-document
      // subscription index. The existing manual playlist assignments are untouched.
      for (const deviceId of c.deviceIds || []) {
        await updateDoc(doc(db, 'devices', deviceId), {
          activeCampaignIds: status === 'ACTIVE' ? arrayUnion(c.id) : arrayRemove(c.id),
        });
      }
      await updateDoc(doc(db, 'campaigns', c.id), { status, updatedAt: new Date().toISOString() });
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update campaign deployment'); }
  };

  const removeCampaign = async (c: Campaign) => {
    if (!window.confirm(`Delete campaign "${c.name}"?`)) return;
    try { await deleteDoc(doc(db, 'campaigns', c.id)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not delete campaign'); }
  };

  return (
    <div className="p-5 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className={`text-xs uppercase tracking-widest font-bold ${muted}`}>Sales & delivery</p><h1 className="text-2xl font-bold mt-1">Advertisers & Campaigns</h1><p className={`text-sm mt-1 ${muted}`}>Manage client relationships and the campaigns running across your displays.</p></div>
        <div className="flex gap-2">
          <button onClick={() => { setShowAdvertiserForm(true); setTab('advertisers'); }} className="px-4 py-2 rounded-lg border border-slate-600 text-sm font-semibold flex items-center gap-2"><Plus size={16}/> Advertiser</button>
          <button onClick={openNewCampaign} disabled={!advertisers.length} className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-sm font-semibold flex items-center gap-2"><Plus size={16}/> New campaign</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[{label:'Advertisers',value:advertisers.length,icon:Users},{label:'Total campaigns',value:campaigns.length,icon:Megaphone},{label:'Active campaigns',value:activeCampaigns,icon:CalendarDays}].map(item => <div key={item.label} className={`rounded-xl border p-4 ${panel}`}><div className={`flex items-center gap-2 text-xs ${muted}`}><item.icon size={15}/>{item.label}</div><div className="text-2xl font-bold mt-2">{item.value}</div></div>)}
      </div>

      {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-500 p-3 text-sm">{error}</div>}
      <div className="flex gap-2 border-b border-slate-700/30">
        <button onClick={() => setTab('campaigns')} className={`px-4 py-2 text-sm font-semibold border-b-2 ${tab === 'campaigns' ? 'border-rose-500 text-rose-500' : muted}`}>Campaigns ({campaigns.length})</button>
        <button onClick={() => setTab('advertisers')} className={`px-4 py-2 text-sm font-semibold border-b-2 ${tab === 'advertisers' ? 'border-rose-500 text-rose-500' : muted}`}>Advertisers ({advertisers.length})</button>
        <button onClick={() => setTab('delivery')} className={`px-4 py-2 text-sm font-semibold border-b-2 flex items-center gap-1 ${tab === 'delivery' ? 'border-rose-500 text-rose-500' : muted}`}><BarChart3 size={14}/> Delivery report</button>
      </div>

      {tab === 'delivery' && <CampaignDeliveryReport businessId={businessId} campaigns={campaigns} devices={devices} darkMode={darkMode} />}

      {tab === 'campaigns' && <div className="space-y-3">
        {!campaigns.length ? <div className={`rounded-xl border p-10 text-center ${panel}`}><Megaphone className={`mx-auto mb-3 ${muted}`} size={30}/><h3 className="font-semibold">No campaigns yet</h3><p className={`text-sm mt-1 ${muted}`}>Add an advertiser and create your first campaign.</p></div> :
          campaigns.map(c => <div key={c.id} className={`rounded-xl border p-4 ${panel}`}><div className="flex flex-wrap justify-between gap-3"><div><div className="font-semibold">{c.name}</div><div className={`text-xs mt-1 ${muted}`}>{c.advertiserName} · {c.contentTitle}</div></div><div className="flex items-center gap-2"><span className={`text-[10px] font-bold px-2 py-1 rounded-full ${c.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 '+muted}`}>{c.status}</span><button title="Edit campaign" onClick={() => openEditCampaign(c)} className="p-2 rounded-lg hover:bg-slate-500/10"><Pencil size={15}/></button><button title="Delete campaign" onClick={() => removeCampaign(c)} className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500"><Trash2 size={15}/></button></div></div><div className={`grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs ${muted}`}><div><CalendarDays size={13} className="inline mr-1"/> {c.startDate} – {c.endDate}</div><div><Tv size={13} className="inline mr-1"/> {(c.deviceIds || []).length} screens</div><div>{c.playsPerScreenPerDay} plays/screen/day</div><div>₹{Number(c.monthlyPrice || 0).toLocaleString('en-IN')} / month</div></div><div className="flex gap-2 mt-3">{c.status !== 'ACTIVE' && c.status !== 'COMPLETED' && <button onClick={() => setCampaignStatus(c,'ACTIVE')} className="text-xs font-semibold text-emerald-500">Activate</button>}{c.status === 'ACTIVE' && <button onClick={() => setCampaignStatus(c,'PAUSED')} className="text-xs font-semibold text-amber-500">Pause</button>}{c.status === 'PAUSED' && <button onClick={() => setCampaignStatus(c,'ACTIVE')} className="text-xs font-semibold text-emerald-500">Resume</button>}</div></div>)
        }
      </div>}

      {tab === 'advertisers' && <div className="space-y-3">
        {showAdvertiserForm && <form onSubmit={saveAdvertiser} className={`rounded-xl border p-4 grid grid-cols-1 md:grid-cols-2 gap-3 ${panel}`}><div className="md:col-span-2 flex justify-between"><h3 className="font-semibold">Add advertiser</h3><button type="button" onClick={() => setShowAdvertiserForm(false)}><X size={17}/></button></div><input required placeholder="Business / advertiser name" className={field} value={advertiserForm.name} onChange={e => setAdvertiserForm({...advertiserForm,name:e.target.value})}/><input placeholder="Contact person" className={field} value={advertiserForm.contactPerson} onChange={e => setAdvertiserForm({...advertiserForm,contactPerson:e.target.value})}/><input placeholder="Phone number" className={field} value={advertiserForm.phone} onChange={e => setAdvertiserForm({...advertiserForm,phone:e.target.value})}/><input type="email" placeholder="Email" className={field} value={advertiserForm.email} onChange={e => setAdvertiserForm({...advertiserForm,email:e.target.value})}/><select className={field} value={advertiserForm.category} onChange={e => setAdvertiserForm({...advertiserForm,category:e.target.value})}>{['Other','Jewellery','Healthcare','FMCG','Education','Banking','Retail','Food & Beverage','Automotive','Real Estate','Services'].map(x=><option key={x}>{x}</option>)}</select><input placeholder="Notes" className={field} value={advertiserForm.notes} onChange={e => setAdvertiserForm({...advertiserForm,notes:e.target.value})}/><div className="md:col-span-2 flex justify-end"><button disabled={saving} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold flex items-center gap-2"><Save size={15}/> {saving?'Saving…':'Save advertiser'}</button></div></form>}
        {!advertisers.length ? <div className={`rounded-xl border p-10 text-center ${panel}`}><Users className={`mx-auto mb-3 ${muted}`} size={30}/><h3 className="font-semibold">No advertisers added</h3><p className={`text-sm mt-1 ${muted}`}>Add your first business to start building your client list.</p></div> : advertisers.map(a=><div key={a.id} className={`rounded-xl border p-4 flex flex-wrap justify-between gap-3 ${panel}`}><div><div className="font-semibold">{a.name}</div><div className={`text-xs mt-1 ${muted}`}>{a.category} · {a.contactPerson || 'No contact person'} · {a.phone || a.email || 'No contact details'}</div>{a.notes && <p className={`text-xs mt-2 ${muted}`}>{a.notes}</p>}</div><div className={`text-xs text-right ${muted}`}>{campaigns.filter(c=>c.advertiserId===a.id).length} campaigns</div></div>)}
      </div>}

      {showCampaignForm && <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3"><form onSubmit={saveCampaign} className={`w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border p-5 space-y-4 ${panel}`}><div className="flex justify-between items-center"><h2 className="text-lg font-bold">{editingCampaignId?'Edit campaign':'Create campaign'}</h2><button type="button" onClick={() => setShowCampaignForm(false)}><X/></button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><label className="text-xs space-y-1">Advertiser<select required className={field} value={campaignForm.advertiserId} onChange={e=>setCampaignForm({...campaignForm,advertiserId:e.target.value})}><option value="">Select advertiser</option>{advertisers.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label className="text-xs space-y-1">Campaign name<input required className={field} value={campaignForm.name} onChange={e=>setCampaignForm({...campaignForm,name:e.target.value})} placeholder="e.g. Diwali jewellery campaign"/></label><label className="text-xs space-y-1 md:col-span-2">Creative / media asset (optional for draft)<select className={field} value={campaignForm.contentId} onChange={e=>setCampaignForm({...campaignForm,contentId:e.target.value})}><option value="">Choose later</option>{contents.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><label className="text-xs space-y-1">Start date<input type="date" required className={field} value={campaignForm.startDate} onChange={e=>setCampaignForm({...campaignForm,startDate:e.target.value})}/></label><label className="text-xs space-y-1">End date<input type="date" required min={campaignForm.startDate} className={field} value={campaignForm.endDate} onChange={e=>setCampaignForm({...campaignForm,endDate:e.target.value})}/></label><label className="text-xs space-y-1">Plays per screen / day<input type="number" min="1" max="3240" required className={field} value={campaignForm.playsPerScreenPerDay} onChange={e=>setCampaignForm({...campaignForm,playsPerScreenPerDay:Number(e.target.value)})}/></label><label className="text-xs space-y-1">Monthly campaign fee (₹)<input type="number" min="0" className={field} value={campaignForm.monthlyPrice} onChange={e=>setCampaignForm({...campaignForm,monthlyPrice:Number(e.target.value)})}/></label></div><div><div className="text-xs font-semibold mb-2">Target screens ({campaignForm.deviceIds.length} selected) · optional for draft</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">{devices.map(d=><label key={d.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-slate-500/10"><input type="checkbox" checked={campaignForm.deviceIds.includes(d.id)} onChange={e=>setCampaignForm({...campaignForm,deviceIds:e.target.checked?[...campaignForm.deviceIds,d.id]:campaignForm.deviceIds.filter(id=>id!==d.id)})}/><span className="truncate">{d.name}</span><span className={`ml-auto ${muted}`}>{d.status}</span></label>)}</div></div><div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowCampaignForm(false)} className="px-4 py-2 rounded-lg border border-slate-600 text-sm">Cancel</button><button disabled={saving} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold">{saving?'Saving…':'Save draft / campaign'}</button></div></form></div>}
    </div>
  );
};
