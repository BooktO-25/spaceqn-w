import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { ContentItem, Device } from '../types';
import { Activity, CalendarDays, CheckCircle2, CircleAlert, Clock3, Monitor, Radio, Tv } from 'lucide-react';

type Campaign = {
  id: string; businessId: string; advertiserName?: string; name: string;
  contentId?: string; contentTitle?: string; deviceIds?: string[];
  startDate?: string; endDate?: string; playsPerScreenPerDay?: number;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
};
interface Props { businessId: string; devices: Device[]; contents: ContentItem[]; darkMode: boolean; }

export const CampaignDeploymentView: React.FC<Props> = ({ businessId, devices, contents, darkMode }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser || !businessId) { setCampaigns([]); setLoading(false); return; }
    const q = query(collection(db, 'campaigns'), where('businessId', '==', businessId));
    return onSnapshot(q, snap => {
      setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() } as Campaign)));
      setLoading(false); setError('');
    }, e => { setError(e.message); setLoading(false); });
  }, [businessId]);

  const deviceById = useMemo(() => new Map(devices.map(d => [d.id, d])), [devices]);
  const contentById = useMemo(() => new Map(contents.map(c => [c.id, c])), [contents]);
  const active = campaigns.filter(c => c.status === 'ACTIVE');
  const deployedCount = active.filter(c => (c.deviceIds || []).some(id => deviceById.get(id)?.activeCampaignIds?.includes(c.id))).length;
  const screenCount = new Set(active.flatMap(c => c.deviceIds || [])).size;
  const panel = darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-gray-200 text-gray-900';
  const muted = darkMode ? 'text-slate-400' : 'text-gray-500';

  return <div className="p-5 lg:p-8 space-y-6 max-w-7xl mx-auto">
    <header><p className={`text-xs uppercase tracking-widest font-bold ${muted}`}>Operations & delivery</p><h1 className="text-2xl font-bold mt-1">Campaign Deployment</h1><p className={`text-sm mt-1 ${muted}`}>Monitor campaign assignments and device configuration sync.</p></header>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className={`rounded-xl border p-4 ${panel}`}><div className={`flex items-center gap-2 text-xs ${muted}`}><Radio size={15}/>Active campaigns</div><div className="text-2xl font-bold mt-2">{active.length}</div></div>
      <div className={`rounded-xl border p-4 ${panel}`}><div className={`flex items-center gap-2 text-xs ${muted}`}><CheckCircle2 size={15}/>Campaigns with device sync</div><div className="text-2xl font-bold mt-2">{deployedCount}</div></div>
      <div className={`rounded-xl border p-4 ${panel}`}><div className={`flex items-center gap-2 text-xs ${muted}`}><Monitor size={15}/>Target screens</div><div className="text-2xl font-bold mt-2">{screenCount}</div></div>
    </div>
    {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-500 p-3 text-sm">{error}</div>}
    {loading ? <div className={`rounded-xl border p-8 text-center text-sm ${panel}`}>Loading deployment data…</div> :
      !campaigns.length ? <div className={`rounded-xl border p-10 text-center ${panel}`}><Tv className={`mx-auto mb-3 ${muted}`} size={30}/><h3 className="font-semibold">No campaigns found</h3><p className={`text-sm mt-1 ${muted}`}>Create a campaign in Advertisers & Campaigns to see it here.</p></div> :
      <div className="space-y-4">{campaigns.slice().sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(c => {
        const ids = c.deviceIds || [];
        const creative = c.contentId ? contentById.get(c.contentId) : undefined;
        const synced = ids.filter(id => deviceById.get(id)?.activeCampaignIds?.includes(c.id)).length;
        return <section key={c.id} className={`rounded-xl border p-4 ${panel}`}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold">{c.name}</div><div className={`text-xs mt-1 ${muted}`}>{c.advertiserName || 'Advertiser not set'} · {c.contentTitle || creative?.title || 'No creative selected'}</div></div><span className={`text-[10px] font-bold px-2 py-1 rounded-full ${c.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-500' : c.status === 'PAUSED' ? 'bg-amber-500/15 text-amber-500' : 'bg-slate-500/15 '+muted}`}>{c.status}</span></div>
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs ${muted}`}><div><CalendarDays size={13} className="inline mr-1"/>{c.startDate || '—'} – {c.endDate || '—'}</div><div><Activity size={13} className="inline mr-1"/>{c.playsPerScreenPerDay || 0} plays/screen/day</div><div><Tv size={13} className="inline mr-1"/>{ids.length} target screens</div><div><CheckCircle2 size={13} className="inline mr-1"/>{synced}/{ids.length} device IDs synced</div></div>
          {!creative && <div className="mt-3 flex items-center gap-2 text-xs text-amber-500"><CircleAlert size={14}/>Creative missing or unavailable.</div>}
          {c.status === 'ACTIVE' && <div className="mt-3 text-xs text-amber-500"><Clock3 size={13} className="inline mr-1"/>Configuration sync is not proof of playback. Scheduling and proof-of-play are not implemented yet.</div>}
          <div className="mt-4 border-t border-slate-500/20 pt-3 space-y-2"><div className="text-[11px] font-bold uppercase tracking-wide">Screen deployment</div>
            {!ids.length ? <p className={`text-xs ${muted}`}>No screens selected.</p> : ids.map(id => {
              const d = deviceById.get(id);
              const deployed = !!d?.activeCampaignIds?.includes(c.id);
              return <div key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-500/5 px-3 py-2"><div className="min-w-0"><div className="text-sm font-medium truncate">{d?.name || id}</div><div className={`text-[11px] ${muted}`}>{d ? `${d.status} · ${d.locationId || 'Location not set'}` : 'Device not found in current device list'}</div></div><div className={`text-xs font-semibold ${deployed ? 'text-emerald-500' : 'text-amber-500'}`}>{deployed ? 'Campaign ID synced' : 'Not synced to device'}</div></div>;
            })}
          </div>
        </section>;
      })}</div>}
    <p className={`text-xs ${muted}`}>“Campaign ID synced” means the device document contains this campaign ID. It does not mean the creative has been scheduled or played.</p>
  </div>;
};
