import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Device } from '../types';
import { Download, RefreshCw, AlertCircle, CheckCircle2, Clock3 } from 'lucide-react';

type Campaign = {
  id: string;
  businessId: string;
  name: string;
  advertiserName?: string;
  contentId: string;
  contentTitle?: string;
  deviceIds: string[];
  startDate: string;
  endDate: string;
  playsPerScreenPerDay: number;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
};
type PlayLog = {
  id: string;
  businessId: string;
  campaignId: string;
  campaignName?: string;
  deviceId: string;
  contentId?: string;
  startedAt?: string;
  createdAt?: string;
  completed?: boolean;
  durationSeconds?: number;
};
interface Props { businessId: string; campaigns: Campaign[]; devices: Device[]; darkMode: boolean; }

const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const monthStart = () => `${isoToday().slice(0,7)}-01`;
const daysInclusive = (from: string, to: string) => {
  if (!from || !to || to < from) return 0;
  const a = new Date(from + 'T00:00:00Z').getTime();
  const b = new Date(to + 'T00:00:00Z').getTime();
  return Math.floor((b-a)/86400000)+1;
};
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const CampaignDeliveryReport: React.FC<Props> = ({ businessId, campaigns, devices, darkMode }) => {
  const [logs, setLogs] = useState<PlayLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(isoToday);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState('');

  const panel = darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-gray-200 text-gray-900';
  const muted = darkMode ? 'text-slate-400' : 'text-gray-500';
  const field = `rounded-lg border px-3 py-2 text-sm ${darkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`;

  useEffect(() => {
    if (!businessId) { setLogs([]); setLoading(false); return; }
    setLoading(true);
    const q = query(collection(db, 'campaignPlayLogs'), where('businessId', '==', businessId));
    const unsubscribe = onSnapshot(q, snapshot => {
      setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PlayLog)));
      setError('');
      setLoading(false);
    }, err => {
      setError(err.message || 'Could not load proof-of-play records.');
      setLoading(false);
    });
    return unsubscribe;
  }, [businessId]);

  const report = useMemo(() => {
    const selectedCampaigns = campaigns.filter(c => c.status !== 'DRAFT');
    const inRangeLogs = logs.filter(log => {
      const stamp = log.startedAt || log.createdAt || '';
      const date = stamp.slice(0,10);
      return date && date >= fromDate && date <= toDate;
    });
    const rows = selectedCampaigns.map(c => {
      const campaignStart = c.startDate > fromDate ? c.startDate : fromDate;
      const campaignEnd = c.endDate < toDate ? c.endDate : toDate;
      const days = daysInclusive(campaignStart, campaignEnd);
      const screens = c.deviceIds || [];
      const target = Math.max(0, Math.floor(Number(c.playsPerScreenPerDay) || 0));
      const committed = days * screens.length * target;
      const campaignLogs = inRangeLogs.filter(l => l.campaignId === c.id);
      const delivered = campaignLogs.filter(l => l.completed === true).length;
      const unconfirmed = campaignLogs.filter(l => l.completed !== true).length;
      const pending = Math.max(0, committed - delivered);
      const achievement = committed ? delivered / committed * 100 : 0;
      const screenRows = screens.map(deviceId => {
        const device = devices.find(d => d.id === deviceId);
        const screenLogs = campaignLogs.filter(l => l.deviceId === deviceId);
        const screenDelivered = screenLogs.filter(l => l.completed === true).length;
        const screenUnconfirmed = screenLogs.filter(l => l.completed !== true).length;
        const screenCommitted = days * target;
        return {
          deviceId, name: device?.name || deviceId, committed: screenCommitted,
          delivered: screenDelivered, unconfirmed: screenUnconfirmed,
          pending: Math.max(0, screenCommitted - screenDelivered),
          achievement: screenCommitted ? screenDelivered / screenCommitted * 100 : 0,
        };
      });
      return { campaign: c, days, committed, delivered, unconfirmed, pending, achievement, screenRows };
    });
    return {
      rows,
      committed: rows.reduce((n,r) => n+r.committed,0),
      delivered: rows.reduce((n,r) => n+r.delivered,0),
      unconfirmed: rows.reduce((n,r) => n+r.unconfirmed,0),
      pending: rows.reduce((n,r) => n+r.pending,0),
    };
  }, [campaigns, devices, logs, fromDate, toDate]);

  const createClientLink = async (row: typeof report.rows[number]) => {
    setSharingId(row.campaign.id); setShareMessage('');
    try {
      if (!globalThis.crypto?.getRandomValues || !globalThis.crypto?.subtle) throw new Error('Secure link generation requires a modern HTTPS browser.');
      const bytes = new Uint8Array(32);
      globalThis.crypto.getRandomValues(bytes);
      const token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
      const tokenHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      const snapshot = {
        campaignName: row.campaign.name,
        advertiserName: row.campaign.advertiserName || 'Advertiser',
        status: row.campaign.status,
        fromDate, toDate,
        committed: row.committed, delivered: row.delivered,
        pending: row.pending, unconfirmed: row.unconfirmed,
        achievement: Number(row.achievement.toFixed(1)),
        screens: row.screenRows.map(s => ({ name: s.name, committed: s.committed, delivered: s.delivered, pending: s.pending, unconfirmed: s.unconfirmed, achievement: Number(s.achievement.toFixed(1)) })),
        generatedAt: new Date().toISOString(),
        methodology: 'Delivered plays count only completed kiosk proof-of-play records received by SPACEQ. This is a play-count report, not a measurement of unique viewers or audience impressions.'
      };
      await setDoc(doc(db, 'campaignPublicReports', row.campaign.id), {
        shareTokenHash: tokenHash,
        publicReport: snapshot,
        shareUpdatedAt: new Date().toISOString()
      });
      const url = new URL(window.location.href);
      url.search = '';
      url.searchParams.set('campaignReport', row.campaign.id);
      url.searchParams.set('token', token);
      await navigator.clipboard.writeText(url.toString());
      setShareMessage('Client-only link copied. Creating a new link will invalidate the previous one.');
    } catch (err) {
      setShareMessage(err instanceof Error ? err.message : 'Could not create the client report link.');
    } finally { setSharingId(null); }
  };

  const percent = report.committed ? report.delivered / report.committed * 100 : 0;
  const exportCsv = () => {
    const header = ['Campaign','Advertiser','Status','Screen','From','To','Days','Committed plays','Delivered plays','Unconfirmed logs','Pending plays','Delivery %'];
    const lines = [header.map(csvCell).join(',')];
    report.rows.forEach(row => {
      row.screenRows.forEach(screen => lines.push([
        row.campaign.name, row.campaign.advertiserName || '', row.campaign.status, screen.name,
        fromDate, toDate, row.days, screen.committed, screen.delivered, screen.unconfirmed,
        screen.pending, screen.achievement.toFixed(1)
      ].map(csvCell).join(',')));
      if (!row.screenRows.length) lines.push([
        row.campaign.name, row.campaign.advertiserName || '', row.campaign.status, 'No screens',
        fromDate, toDate, row.days, row.committed, row.delivered, row.unconfirmed,
        row.pending, row.achievement.toFixed(1)
      ].map(csvCell).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `spaceq-delivery-${fromDate}-to-${toDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-lg font-bold">Campaign delivery</h2><p className={`text-xs mt-1 ${muted}`}>Committed plays versus confirmed proof of play, by campaign and screen.</p></div>
        <div className="flex flex-wrap items-end gap-2">
          <label className={`text-xs ${muted}`}>From date<input type="date" className={`block mt-1 ${field}`} value={fromDate} max={toDate} onChange={e=>setFromDate(e.target.value)}/></label>
          <label className={`text-xs ${muted}`}>To date<input type="date" className={`block mt-1 ${field}`} value={toDate} min={fromDate} onChange={e=>setToDate(e.target.value)}/></label>
          <button onClick={exportCsv} disabled={!report.rows.length} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-40"><Download size={15}/> Export CSV</button>
        </div>
      </div>

      {shareMessage && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-500">{shareMessage}</div>}
      {error && <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-500 flex gap-2"><AlertCircle size={16} className="shrink-0"/><span>Proof-of-play records could not be loaded: {error}. Check the campaignPlayLogs read rule for this business.</span></div>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          {label:'Committed plays',value:report.committed,icon:Clock3},
          {label:'Delivered plays',value:report.delivered,icon:CheckCircle2},
          {label:'Pending plays',value:report.pending,icon:AlertCircle},
          {label:'Delivery achievement',value:`${percent.toFixed(1)}%`,icon:BarIcon},
        ].map(item => <div key={item.label} className={`rounded-xl border p-4 ${panel}`}><div className={`flex items-center gap-2 text-xs ${muted}`}><item.icon size={15}/>{item.label}</div><div className="text-2xl font-bold mt-2 tabular-nums">{typeof item.value === 'number' ? item.value.toLocaleString('en-IN') : item.value}</div></div>)}
      </div>

      <div className={`rounded-xl border p-4 ${panel}`}>
        <div className="flex justify-between text-xs mb-2"><span className={muted}>Overall delivery</span><strong>{percent.toFixed(1)}%</strong></div>
        <div className={`h-3 rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`}><div className="h-full rounded-full bg-emerald-500" style={{width:`${Math.min(100,percent)}%`}}/></div>
        <div className={`flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs ${muted}`}><span>Unconfirmed logs: <strong>{report.unconfirmed.toLocaleString('en-IN')}</strong></span><span>Reporting period: {fromDate} to {toDate}</span><span>{loading ? 'Refreshing records…' : `${logs.length.toLocaleString('en-IN')} total log records loaded`}</span></div>
      </div>

      {!report.rows.length ? <div className={`rounded-xl border p-8 text-center ${panel}`}><p className="font-semibold">No campaigns to report</p><p className={`text-xs mt-1 ${muted}`}>Non-draft campaigns will appear here.</p></div> :
        <div className="space-y-3">
          {report.rows.map(row => <div key={row.campaign.id} className={`rounded-xl border p-4 ${panel}`}>
            <div className="flex flex-wrap justify-between gap-2"><div><div className="font-semibold">{row.campaign.name}</div><div className={`text-xs mt-1 ${muted}`}>{row.campaign.advertiserName || 'Advertiser'} · {row.campaign.status} · {row.days} committed day(s)</div></div><div className="flex items-center gap-3"><div className="text-right"><div className="text-lg font-bold tabular-nums">{row.achievement.toFixed(1)}%</div><div className={`text-[11px] ${muted}`}>delivery</div></div><button onClick={() => createClientLink(row)} disabled={sharingId === row.campaign.id} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold disabled:opacity-50">{sharingId === row.campaign.id ? "Creating…" : "Copy client link"}</button></div></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs"><div><div className={muted}>Committed</div><strong className="text-base">{row.committed.toLocaleString('en-IN')}</strong></div><div><div className={muted}>Delivered</div><strong className="text-base text-emerald-500">{row.delivered.toLocaleString('en-IN')}</strong></div><div><div className={muted}>Pending</div><strong className="text-base">{row.pending.toLocaleString('en-IN')}</strong></div><div><div className={muted}>Unconfirmed</div><strong className="text-base text-amber-500">{row.unconfirmed.toLocaleString('en-IN')}</strong></div></div>
            <div className={`h-2 rounded-full overflow-hidden mt-3 ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`}><div className="h-full bg-emerald-500" style={{width:`${Math.min(100,row.achievement)}%`}}/></div>
            <div className="mt-4 overflow-x-auto"><table className="w-full text-xs min-w-[620px]"><thead><tr className={`text-left ${muted}`}><th className="py-2 pr-3">Screen</th><th className="py-2 pr-3 text-right">Committed</th><th className="py-2 pr-3 text-right">Delivered</th><th className="py-2 pr-3 text-right">Pending</th><th className="py-2 pr-3 text-right">Unconfirmed</th><th className="py-2 text-right">Delivery</th></tr></thead><tbody>{row.screenRows.map(screen => <tr key={screen.deviceId} className="border-t border-slate-500/15"><td className="py-2 pr-3 font-medium">{screen.name}</td><td className="py-2 pr-3 text-right tabular-nums">{screen.committed.toLocaleString('en-IN')}</td><td className="py-2 pr-3 text-right tabular-nums text-emerald-500">{screen.delivered.toLocaleString('en-IN')}</td><td className="py-2 pr-3 text-right tabular-nums">{screen.pending.toLocaleString('en-IN')}</td><td className="py-2 pr-3 text-right tabular-nums text-amber-500">{screen.unconfirmed.toLocaleString('en-IN')}</td><td className="py-2 text-right tabular-nums">{screen.achievement.toFixed(1)}%</td></tr>)}</tbody></table></div>
          </div>)}
        </div>
      }

      <p className={`text-[11px] leading-relaxed ${muted}`}>Method: commitment = daily plays per screen × assigned screens × campaign days overlapping the selected date range. Delivered counts only logs marked completed. Unconfirmed counts attempted plays without a completed flag. A play that failed to write any log cannot be counted here. Campaigns in PAUSED status are still included in the contractual commitment for their configured campaign dates; adjust the campaign dates if the contract was formally paused.</p>
    </div>
  );
};

const BarIcon: React.FC<{size?: number}> = ({size=15}) => <span style={{display:'inline-flex',width:size,height:size,alignItems:'center',justifyContent:'center',fontWeight:800}}>％</span>;
