import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc, collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Device, Location } from '../types';
import { useAuth } from '../context/AuthContext';
import { buildCampaignPlan, CampaignBookingType, getDeliveryRate, getEligibleScreens } from '../lib/campaignEngine';
import { CalendarDays, Megaphone, Plus, RefreshCw, ShieldCheck, Tv, X } from 'lucide-react';

interface CampaignManagerViewProps {
  businessId: string;
  devices: Device[];
  locations: Location[];
  darkMode: boolean;
}

interface CampaignRecord {
  id: string;
  businessId: string;
  name: string;
  advertiserName: string;
  bookingType: CampaignBookingType;
  status: string;
  startDate: string;
  endDate: string;
  totalGuaranteedPlays: number;
  completedPlays?: number;
  allocations?: { screenId: string; networkPlays: number; screenSpecificPlays: number; totalGuaranteedPlays: number }[];
  selectedScreenIds?: string[];
  creativeUrl: string;
  creativeDurationSeconds: number;
  createdAt?: any;
}

const fieldClass = 'w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-rose-500';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50';

export const CampaignManagerView: React.FC<CampaignManagerViewProps> = ({ businessId, devices, locations, darkMode }) => {
  const { userProfile } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [capacities, setCapacities] = useState<Record<string, number>>({});
  const [capacityInputs, setCapacityInputs] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [advertiserName, setAdvertiserName] = useState('');
  const [bookingType, setBookingType] = useState<CampaignBookingType>('hybrid');
  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>([]);
  const [networkPoolPlays, setNetworkPoolPlays] = useState('3000');
  const [screenGuarantees, setScreenGuarantees] = useState<Record<string, string>>({});
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date(Date.now() + 29 * 86400000).toISOString().slice(0, 10));
  const [creativeUrl, setCreativeUrl] = useState('');
  const [creativeDurationSeconds, setCreativeDurationSeconds] = useState('15');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const eligibleDevices = useMemo(() => getEligibleScreens(devices), [devices]);
  const locationName = (deviceId: string) => {
    const device = eligibleDevices.find(item => item.id === deviceId);
    return locations.find(location => location.id === device?.locationId)?.name || 'Unassigned location';
  };

  useEffect(() => {
    const campaignQuery = query(collection(db, 'campaigns'), where('businessId', '==', businessId));
    return onSnapshot(campaignQuery, snapshot => {
      setCampaigns(snapshot.docs.map(item => {
        const data = item.data() as Partial<CampaignRecord>;
        return {
          ...data,
          id: item.id,
          businessId: String(data.businessId || businessId),
          name: String(data.name || 'Untitled campaign'),
          advertiserName: String(data.advertiserName || '—'),
          bookingType: data.bookingType || 'hybrid',
          status: String(data.status || 'unknown'),
          startDate: String(data.startDate || ''),
          endDate: String(data.endDate || ''),
          totalGuaranteedPlays: Number(data.totalGuaranteedPlays) || 0,
          completedPlays: Number(data.completedPlays) || 0,
          creativeUrl: String(data.creativeUrl || ''),
          creativeDurationSeconds: Number(data.creativeDurationSeconds) || 15,
        } as CampaignRecord;
      }).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      setCampaignsLoading(false);
    }, err => { setError('Could not load campaign bookings: ' + err.message); setCampaignsLoading(false); });
  }, [businessId]);

  useEffect(() => {
    if (!eligibleDevices.length) return;
    const unsubs = eligibleDevices.map(device => onSnapshot(doc(db, 'campaignInventory', device.id), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setCapacities(prev => ({ ...prev, [device.id]: Number(data.maxCampaignPlaysPerDay) || 0 }));
        setCapacityInputs(prev => ({ ...prev, [device.id]: String(Number(data.maxCampaignPlaysPerDay) || '') }));
      }
    }, () => undefined));
    return () => unsubs.forEach(unsub => unsub());
  }, [eligibleDevices]);

  const exportCampaignReport = (campaign: CampaignRecord) => {
    const rows = [
      ['Campaign ID', campaign.id],
      ['Campaign', campaign.name],
      ['Advertiser', campaign.advertiserName],
      ['Booking model', campaign.bookingType],
      ['Status', campaign.status],
      ['Start date', campaign.startDate],
      ['End date', campaign.endDate],
      ['Guaranteed plays', String(campaign.totalGuaranteedPlays || 0)],
      ['Completed plays (trusted events only)', String(campaign.completedPlays || 0)],
      ['Remaining plays', String(Math.max(0, (campaign.totalGuaranteedPlays || 0) - (campaign.completedPlays || 0)))],
      ['Delivery percentage', getDeliveryRate(campaign.totalGuaranteedPlays || 0, campaign.completedPlays || 0) + '%'],
      ['Evidence status', 'Device-reported browser playback events; not hardware-attested proof of physical screen visibility']
    ];
    const csv = rows.map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'campaign-' + campaign.id + '-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleScreen = (id: string) => {
    setSelectedScreenIds(prev => prev.includes(id) ? prev.filter(value => value !== id) : [...prev, id]);
  };

  const saveCapacity = async (device: Device) => {
    const value = Number(capacityInputs[device.id]);
    if (!Number.isSafeInteger(value) || value < 0) {
      setError('Capacity must be a non-negative whole number of plays per day.');
      return;
    }
    setBusy(true); setError(''); setSuccess('');
    try {
      await runTransaction(db, async transaction => {
        const ref = doc(db, 'campaignInventory', device.id);
        const snap = await transaction.get(ref);
        const existing = snap.exists() ? snap.data() : {};
        if (existing.businessId && existing.businessId !== businessId) throw new Error('This screen belongs to another business.');
        transaction.set(ref, {
          businessId, screenId: device.id, screenName: device.name,
          maxCampaignPlaysPerDay: value,
          reservedPlaysByDate: existing.reservedPlaysByDate || {},
          updatedAt: serverTimestamp()
        }, { merge: true });
      });
      setCapacities(prev => ({ ...prev, [device.id]: value }));
      setSuccess('Capacity saved for ' + device.name + '.');
    } catch (err: any) { setError(err.message || 'Could not save screen capacity.'); }
    finally { setBusy(false); }
  };

  const changeCampaignStatus = async (campaign: CampaignRecord, action: 'pause' | 'resume' | 'cancel') => {
    setBusy(true); setError(''); setSuccess('');
    try {
      if (action === 'cancel' && !window.confirm('Cancel this campaign and release its remaining reserved inventory?')) return;
      const nextStatus = action === 'pause' ? 'paused' : action === 'resume' ? 'scheduled' : 'cancelled';
      const ids = campaign.allocations?.map(item => item.screenId) || campaign.selectedScreenIds || [];
      await runTransaction(db, async transaction => {
        const campaignRef = doc(db, 'campaigns', campaign.id);
        const campaignSnap = await transaction.get(campaignRef);
        if (!campaignSnap.exists() || campaignSnap.data().businessId !== businessId) throw new Error('Campaign not found in this business.');
        const schedules = await Promise.all(ids.map(id => transaction.get(doc(db, 'campaignSchedules', campaign.id + '_' + id))));
        const inventories = action === 'cancel'
          ? await Promise.all(ids.map(id => transaction.get(doc(db, 'campaignInventory', id))))
          : [];
        if (action === 'cancel') {
          schedules.forEach((scheduleSnap, index) => {
            if (!scheduleSnap.exists() || !inventories[index].exists()) return;
            const schedule = scheduleSnap.data();
            const inventory = inventories[index].data();
            if (inventory?.businessId !== businessId) throw new Error('Inventory ownership mismatch.');
            const reserved = { ...(inventory?.reservedPlaysByDate || {}) };
            Object.entries(schedule.datePlays || {}).forEach(([date, plays]) => {
              reserved[date] = Math.max(0, (Number(reserved[date]) || 0) - Number(plays || 0));
            });
            transaction.update(doc(db, 'campaignInventory', ids[index]), { reservedPlaysByDate: reserved, updatedAt: serverTimestamp() });
            transaction.update(doc(db, 'campaignSchedules', campaign.id + '_' + ids[index]), { status: 'cancelled', updatedAt: serverTimestamp() });
          });
        } else {
          schedules.forEach((snap, index) => {
            if (snap.exists()) transaction.update(doc(db, 'campaignSchedules', campaign.id + '_' + ids[index]), { status: nextStatus === 'paused' ? 'paused' : 'published', updatedAt: serverTimestamp() });
          });
        }
        transaction.update(campaignRef, { status: nextStatus, updatedAt: serverTimestamp(), ...(action === 'cancel' ? { cancelledAt: serverTimestamp() } : {}) });
      });
      setSuccess(action === 'cancel' ? 'Campaign cancelled and reserved inventory released.' : action === 'pause' ? 'Campaign paused.' : 'Campaign resumed.');
    } catch (err: any) {
      setError(err.message || 'Could not update campaign status.');
    } finally { setBusy(false); }
  };

  const createCampaign = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setSuccess('');
    try {
      if (!name.trim() || !advertiserName.trim()) throw new Error('Enter the campaign and advertiser names.');
      if (!creativeUrl.trim()) throw new Error('Enter a publicly accessible creative URL.');
      if (!selectedScreenIds.length) throw new Error('Select at least one screen.');
      const guarantees = selectedScreenIds.map(screenId => ({ screenId, plays: Number(screenGuarantees[screenId] || 0) }));
      const networkPlays = Number(networkPoolPlays);
      const dailyCapacities = Object.fromEntries(selectedScreenIds.map(id => [id, capacities[id] || 0]));
      const plan = buildCampaignPlan({
        bookingType, networkPoolPlays: bookingType === 'screen' ? 0 : networkPlays,
        selectedScreenIds, screenGuarantees: bookingType === 'network' ? [] : guarantees,
        startDate, endDate, dailyCapacities, missedPlayPolicy: 'manual'
      });
      const duration = Number(creativeDurationSeconds);
      if (![10, 15, 20, 30, 60].includes(duration)) throw new Error('Choose a supported creative duration (10, 15, 20, 30 or 60 seconds).');
      const campaignRef = doc(collection(db, 'campaigns'));
      const allocationRefs = plan.allocations.map(item => ({ item, ref: doc(db, 'campaignAllocations', campaignRef.id + '_' + item.screenId) }));
      const scheduleRefs = plan.allocations.map(item => ({
        item,
        ref: doc(db, 'campaignSchedules', campaignRef.id + '_' + item.screenId)
      }));
      const capacityRefs = selectedScreenIds.map(id => ({ id, ref: doc(db, 'campaignInventory', id) }));

      await runTransaction(db, async transaction => {
        const capacitySnaps = await Promise.all(capacityRefs.map(item => transaction.get(item.ref)));
        const reservedByScreen: Record<string, Record<string, number>> = {};
        capacitySnaps.forEach((snap, index) => {
          const screenId = capacityRefs[index].id;
          if (!snap.exists()) throw new Error('Set a daily campaign capacity for ' + (eligibleDevices.find(d => d.id === screenId)?.name || screenId) + ' first.');
          const data = snap.data();
          if (data.businessId !== businessId) throw new Error('Screen capacity is not owned by this business.');
          const reserved = { ...(data.reservedPlaysByDate || {}) };
          reservedByScreen[screenId] = reserved;
        });

        for (const schedule of plan.schedules) {
          const refIndex = capacityRefs.findIndex(item => item.id === schedule.screenId);
          const snap = capacitySnaps[refIndex];
          const data = snap.data()!;
          const max = Number(data.maxCampaignPlaysPerDay) || 0;
          const already = reservedByScreen[schedule.screenId][schedule.date] || 0;
          if (schedule.plannedPlays + already > max) {
            throw new Error('Capacity conflict on ' + schedule.date + ' for ' + (eligibleDevices.find(d => d.id === schedule.screenId)?.name || schedule.screenId) + '. Available: ' + Math.max(0, max - already) + ' plays.');
          }
          reservedByScreen[schedule.screenId][schedule.date] = already + schedule.plannedPlays;
        }

        capacityRefs.forEach((item, index) => transaction.update(item.ref, {
          reservedPlaysByDate: reservedByScreen[item.id],
          updatedAt: serverTimestamp()
        }));

        transaction.set(campaignRef, {
          businessId, name: name.trim(), advertiserName: advertiserName.trim(),
          bookingType, distributionMode: 'equal', status: 'scheduled',
          startDate, endDate, selectedScreenIds,
          networkPoolPlays: bookingType === 'screen' ? 0 : networkPlays,
          screenGuarantees: bookingType === 'network' ? [] : guarantees,
          totalGuaranteedPlays: plan.totalGuaranteedPlays,
          completedPlays: 0, scheduledPlays: plan.totalGuaranteedPlays,
          creativeUrl: creativeUrl.trim(), creativeDurationSeconds: duration,
          missedPlayPolicy: 'manual', offlinePolicy: 'queue',
          allocationPolicy: 'equal', createdBy: userProfile?.uid || '',
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });

        allocationRefs.forEach(({ item, ref }) => transaction.set(ref, {
          businessId, campaignId: campaignRef.id, screenId: item.screenId,
          networkPlays: item.networkPlays, screenSpecificPlays: item.screenSpecificPlays,
          totalGuaranteedPlays: item.totalGuaranteedPlays,
          scheduledPlays: item.totalGuaranteedPlays, completedPlays: 0,
          remainingPlays: item.totalGuaranteedPlays, status: 'reserved',
          createdAt: serverTimestamp()
        }));

        scheduleRefs.forEach(({ item, ref }) => {
          const daily = plan.schedules.filter(schedule => schedule.screenId === item.screenId);
          transaction.set(ref, {
            businessId, campaignId: campaignRef.id, screenId: item.screenId,
            datePlays: Object.fromEntries(daily.map(schedule => [schedule.date, schedule.plannedPlays])),
            plannedPlays: item.totalGuaranteedPlays, completedPlays: 0,
            creativeUrl: creativeUrl.trim(), creativeDurationSeconds: duration,
            scheduleVersion: 1, status: 'published', updatedAt: serverTimestamp()
          });
        });
      });

      setName(''); setAdvertiserName(''); setCreativeUrl('');
      setSuccess('Campaign scheduled successfully. Equal allocations and screen reservations have been saved.');
    } catch (err: any) {
      setError(err.message || 'Could not create campaign.');
    } finally { setBusy(false); }
  };

  const panel = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const text = darkMode ? 'text-slate-100' : 'text-slate-900';

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className={'text-2xl font-extrabold ' + text}>DOOH Campaign Engine</h1>
          <p className={'mt-1 text-xs ' + muted}>Hybrid bookings · Equal network allocation · Screen-specific guarantees · Inventory reservations</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-500"><ShieldCheck className="h-4 w-4"/> UAT campaign engine</span>
      </div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-400">{error}<button className="float-right" onClick={() => setError('')}><X className="h-4 w-4"/></button></div>}
      {success && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">{success}</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={'rounded-2xl border p-4 ' + panel}><p className={'text-xs ' + muted}>Campaigns</p><p className={'mt-1 text-2xl font-black ' + text}>{campaigns.length}</p></div>
        <div className={'rounded-2xl border p-4 ' + panel}><p className={'text-xs ' + muted}>Guaranteed plays</p><p className={'mt-1 text-2xl font-black ' + text}>{campaigns.reduce((sum, c) => sum + (c.totalGuaranteedPlays || 0), 0).toLocaleString('en-IN')}</p></div>
        <div className={'rounded-2xl border p-4 ' + panel}><p className={'text-xs ' + muted}>Completed plays</p><p className={'mt-1 text-2xl font-black ' + text}>{campaigns.reduce((sum, c) => sum + (c.completedPlays || 0), 0).toLocaleString('en-IN')}</p></div>
      </div>

      <section className={'rounded-2xl border p-5 ' + panel}>
        <div className="mb-4 flex items-center gap-2"><Tv className="h-5 w-5 text-rose-500"/><div><h2 className={'font-bold ' + text}>Screen inventory capacity</h2><p className={'text-xs ' + muted}>Configure the maximum campaign plays per screen per day. No assumed default capacity is applied.</p></div></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {eligibleDevices.map(device => (
            <div key={device.id} className={'rounded-xl border p-3 ' + (darkMode ? 'border-slate-700' : 'border-slate-200')}>
              <p className={'text-sm font-bold ' + text}>{device.name}</p><p className={'mb-2 text-[11px] ' + muted}>{locationName(device.id)} · {device.orientation}</p>
              <div className="flex gap-2"><input className={fieldClass} type="number" min="0" step="1" placeholder="Plays / day" value={capacityInputs[device.id] || ''} onChange={e => setCapacityInputs(prev => ({ ...prev, [device.id]: e.target.value }))}/><button disabled={busy} onClick={() => void saveCapacity(device)} className="rounded-lg bg-slate-700 px-3 text-xs font-bold text-white">Save</button></div>
              <p className={'mt-1 text-[10px] ' + muted}>Current capacity: {(capacities[device.id] || 0).toLocaleString('en-IN')} plays/day</p>
            </div>
          ))}
          {!eligibleDevices.length && <p className={'text-sm ' + muted}>No paired screens are available for this business.</p>}
        </div>
      </section>

      <section className={'rounded-2xl border p-5 ' + panel}>
        <div className="mb-4 flex items-center gap-2"><Plus className="h-5 w-5 text-rose-500"/><div><h2 className={'font-bold ' + text}>Create campaign booking</h2><p className={'text-xs ' + muted}>Network plays are split equally. Screen guarantees are added on top.</p></div></div>
        <form onSubmit={createCampaign} className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            <label className={'space-y-1 text-xs font-semibold ' + muted}>Campaign name<input required className={fieldClass} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. December festive offer"/></label>
            <label className={'space-y-1 text-xs font-semibold ' + muted}>Advertiser / business<input required className={fieldClass} value={advertiserName} onChange={e => setAdvertiserName(e.target.value)} placeholder="Advertiser name"/></label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className={'space-y-1 text-xs font-semibold ' + muted}>Booking model<select className={fieldClass} value={bookingType} onChange={e => setBookingType(e.target.value as CampaignBookingType)}><option value="hybrid">Hybrid</option><option value="network">Network-wide</option><option value="screen">Screen-specific</option></select></label>
            <label className={'space-y-1 text-xs font-semibold ' + muted}>Start date<input required type="date" className={fieldClass} value={startDate} onChange={e => setStartDate(e.target.value)}/></label>
            <label className={'space-y-1 text-xs font-semibold ' + muted}>End date<input required type="date" className={fieldClass} value={endDate} onChange={e => setEndDate(e.target.value)}/></label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className={'space-y-1 text-xs font-semibold ' + muted}>Network pool plays<input type="number" min="0" step="1" disabled={bookingType === 'screen'} className={fieldClass} value={networkPoolPlays} onChange={e => setNetworkPoolPlays(e.target.value)}/></label>
            <label className={'space-y-1 text-xs font-semibold ' + muted}>Creative duration<select className={fieldClass} value={creativeDurationSeconds} onChange={e => setCreativeDurationSeconds(e.target.value)}>{[10,15,20,30,60].map(value => <option key={value} value={value}>{value} seconds</option>)}</select></label>
          </div>
          <label className={'block space-y-1 text-xs font-semibold ' + muted}>Creative URL<input required type="url" className={fieldClass} value={creativeUrl} onChange={e => setCreativeUrl(e.target.value)} placeholder="https://... image or video URL"/><span className="block text-[10px] font-normal">Use an existing publicly accessible media URL. This form does not upload files.</span></label>

          <div>
            <div className="mb-2 flex items-center justify-between"><h3 className={'text-sm font-bold ' + text}>Select screens</h3><span className={'text-xs ' + muted}>{selectedScreenIds.length} selected</span></div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {eligibleDevices.map(device => {
                const selected = selectedScreenIds.includes(device.id);
                return <div key={device.id} className={'rounded-xl border p-3 ' + (selected ? 'border-rose-500/60 bg-rose-500/5' : darkMode ? 'border-slate-700' : 'border-slate-200')}>
                  <label className="flex cursor-pointer items-start gap-2"><input type="checkbox" checked={selected} onChange={() => toggleScreen(device.id)} className="mt-1 accent-rose-500"/><span className="min-w-0 flex-1"><span className={'block text-sm font-bold ' + text}>{device.name}</span><span className={'block text-[10px] ' + muted}>{locationName(device.id)} · {device.orientation}</span></span></label>
                  {selected && bookingType !== 'network' && <label className={'mt-3 block text-[10px] font-semibold ' + muted}>Extra guaranteed plays on this screen<input className={fieldClass + ' mt-1'} type="number" min="0" step="1" value={screenGuarantees[device.id] || ''} onChange={e => setScreenGuarantees(prev => ({ ...prev, [device.id]: e.target.value }))} placeholder="0"/></label>}
                  <p className={'mt-2 text-[10px] ' + (capacities[device.id] ? 'text-emerald-500' : 'text-amber-500')}>{capacities[device.id] ? capacities[device.id] + ' plays/day capacity configured' : 'Capacity not configured'}</p>
                </div>;
              })}
            </div>
          </div>
          <div className="rounded-xl bg-slate-800/70 p-3 text-xs text-slate-300"><p className="font-bold text-white">Booking safeguards</p><p className="mt-1">Equal split across selected screens · Screen guarantees are additive · Daily capacity is reserved transactionally · Unavailable capacity rejects the booking instead of silently reducing plays · Missed delivery is flagged for manual resolution.</p></div>
          <button type="submit" disabled={busy} className={buttonClass}>{busy ? <RefreshCw className="h-4 w-4 animate-spin"/> : <CalendarDays className="h-4 w-4"/>}{busy ? 'Processing…' : 'Validate capacity & schedule campaign'}</button>
        </form>
      </section>

      <section className={'rounded-2xl border p-5 ' + panel}>
        <div className="mb-4 flex items-center gap-2"><Megaphone className="h-5 w-5 text-rose-500"/><div><h2 className={'font-bold ' + text}>Campaign bookings</h2><p className={'text-xs ' + muted}>Bookings, guarantees and delivery status.</p></div></div>
        <div className="space-y-3">
          {campaigns.map(campaign => {
            const rate = getDeliveryRate(campaign.totalGuaranteedPlays, campaign.completedPlays || 0);
            return <div key={campaign.id} className={'rounded-xl border p-4 ' + (darkMode ? 'border-slate-700' : 'border-slate-200')}>
              <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className={'font-bold ' + text}>{campaign.name}</h3><p className={'text-xs ' + muted}>{campaign.advertiserName} · {campaign.bookingType} · {campaign.startDate} to {campaign.endDate}</p></div><span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-400">{campaign.status}</span></div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><p className={muted}>Guaranteed</p><p className={'font-bold ' + text}>{(Number(campaign.totalGuaranteedPlays) || 0).toLocaleString('en-IN')}</p></div><div><p className={muted}>Completed</p><p className={'font-bold ' + text}>{(campaign.completedPlays || 0).toLocaleString('en-IN')}</p></div><div><p className={muted}>Delivery</p><p className={'font-bold ' + text}>{rate}%</p></div></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700"><div className="h-full rounded-full bg-emerald-500" style={{ width: rate + '%' }}/></div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={busy} onClick={() => exportCampaignReport(campaign)} className="rounded-lg bg-slate-700 px-3 py-1.5 text-[11px] font-bold text-white">Export CSV report</button>
                {campaign.status !== 'cancelled' && campaign.status !== 'completed' && (
                  <>
                    {campaign.status === 'paused'
                      ? <button disabled={busy} onClick={() => void changeCampaignStatus(campaign, 'resume')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white">Resume</button>
                      : <button disabled={busy} onClick={() => void changeCampaignStatus(campaign, 'pause')} className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white">Pause</button>}
                    <button disabled={busy} onClick={() => void changeCampaignStatus(campaign, 'cancel')} className="rounded-lg bg-rose-700 px-3 py-1.5 text-[11px] font-bold text-white">Cancel & release inventory</button>
                  </>
                )}
              </div>
              <p className={'mt-2 text-[10px] ' + muted}>Campaign ID: {campaign.id}</p>
            </div>;
          })}
          {campaignsLoading ? <p className={'py-8 text-center text-sm ' + muted}>Loading campaign bookings…</p> : !campaigns.length && <p className={'py-8 text-center text-sm ' + muted}>No campaigns created for this business yet.</p>}
        </div>
      </section>
    </div>
  );
};
