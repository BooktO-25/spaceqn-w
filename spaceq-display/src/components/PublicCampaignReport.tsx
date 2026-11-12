import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Printer, ShieldCheck, AlertCircle } from 'lucide-react';

type PublicReportData = {
  campaignName: string; advertiserName: string; status: string;
  fromDate: string; toDate: string; committed: number; delivered: number;
  pending: number; unconfirmed: number; achievement: number;
  screens: Array<{name:string;committed:number;delivered:number;pending:number;unconfirmed:number;achievement:number}>;
  generatedAt: string; methodology: string;
};

export const PublicCampaignReport: React.FC<{campaignId:string;token:string}> = ({campaignId,token}) => {
  const [report,setReport] = useState<PublicReportData|null>(null);
  const [state,setState] = useState<'loading'|'ready'|'invalid'|'error'>('loading');
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        if (!campaignId || !token || !/^[a-zA-Z0-9_-]{1,150}$/.test(campaignId)) { if(alive)setState('invalid'); return; }
        const snap = await getDoc(doc(db,'campaignPublicReports',campaignId));
        if (!snap.exists()) { if(alive)setState('invalid'); return; }
        const data = snap.data();
        const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
        const hash = Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
        if (!data.shareTokenHash || hash !== data.shareTokenHash || !data.publicReport) { if(alive)setState('invalid'); return; }
        if(alive) { setReport(data.publicReport as PublicReportData); setState('ready'); }
      } catch { if(alive)setState('error'); }
    };
    load();
    return () => { alive=false; };
  },[campaignId,token]);

  const number = (n:number) => Number(n||0).toLocaleString('en-IN');
  const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm';
  if (state !== 'ready' || !report) return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6"><div className="max-w-md rounded-2xl bg-white border border-slate-200 p-8 text-center shadow-sm">{state==='loading' ? <div className="text-slate-600">Loading campaign report…</div> : <><AlertCircle className="mx-auto text-rose-600 mb-3" size={30}/><h1 className="font-bold text-xl text-slate-900">Report link unavailable</h1><p className="text-sm text-slate-500 mt-2">This link may be invalid, expired or replaced by a newer report link. Please contact SPACEQ for an updated link.</p></>}</div></main>;
  const pct = Math.min(100,Math.max(0,report.achievement||0));
  return <main className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-8"><div className="max-w-4xl mx-auto space-y-5">
    <header className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-200 pb-5"><div><div className="text-xs font-bold tracking-[.25em] text-blue-800">SPACEQ DISPLAY</div><h1 className="text-2xl sm:text-3xl font-bold mt-2">Campaign delivery report</h1><p className="text-sm text-slate-500 mt-1">Prepared for {report.advertiserName}</p></div><button onClick={()=>window.print()} className="print:hidden px-4 py-2 rounded-lg bg-blue-800 text-white text-sm font-semibold flex items-center gap-2"><Printer size={16}/> Print / Save as PDF</button></header>
    <section className={card}><div className="flex flex-wrap justify-between gap-3"><div><div className="text-xs uppercase tracking-wide text-slate-500">Campaign</div><h2 className="text-xl font-bold mt-1">{report.campaignName}</h2><p className="text-sm text-slate-500 mt-1">{report.fromDate} to {report.toDate} · {report.status}</p></div><div className="text-sm text-slate-500 flex items-center gap-1"><ShieldCheck size={16} className="text-emerald-600"/> Private campaign report</div></div></section>
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">{[{label:'Committed plays',value:number(report.committed)},{label:'Delivered plays',value:number(report.delivered)},{label:'Pending plays',value:number(report.pending)},{label:'Delivery achieved',value:pct.toFixed(1)+'%'}].map(x=><div key={x.label} className={card}><div className="text-xs text-slate-500">{x.label}</div><div className="text-2xl font-bold mt-2">{x.value}</div></div>)}</section>
    <section className={card}><div className="flex justify-between text-sm mb-2"><span className="text-slate-600">Delivery achievement</span><strong>{pct.toFixed(1)}%</strong></div><div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{width:pct+'%'}}/></div><p className="text-xs text-slate-500 mt-3">Unconfirmed play records: {number(report.unconfirmed)}</p></section>
    <section className={card}><h3 className="font-bold mb-3">Screen-wise delivery</h3><div className="overflow-x-auto"><table className="w-full text-sm min-w-[620px]"><thead><tr className="text-left text-slate-500 border-b"><th className="py-2">Screen / location</th><th className="py-2 text-right">Committed</th><th className="py-2 text-right">Delivered</th><th className="py-2 text-right">Pending</th><th className="py-2 text-right">Unconfirmed</th><th className="py-2 text-right">Delivery</th></tr></thead><tbody>{report.screens.map((s,i)=><tr key={i} className="border-b border-slate-100"><td className="py-3 font-medium">{s.name}</td><td className="py-3 text-right">{number(s.committed)}</td><td className="py-3 text-right text-emerald-700">{number(s.delivered)}</td><td className="py-3 text-right">{number(s.pending)}</td><td className="py-3 text-right">{number(s.unconfirmed)}</td><td className="py-3 text-right">{s.achievement.toFixed(1)}%</td></tr>)}</tbody></table></div></section>
    <footer className="text-xs leading-relaxed text-slate-500 space-y-2"><p>{report.methodology}</p><p>Report generated: {new Date(report.generatedAt).toLocaleString('en-IN')}</p><p>SPACEQ Display · Campaign performance statement</p></footer>
  </div><style>{'@media print { body { background: white !important; } main { padding: 0 !important; } button { display: none !important; } .shadow-sm { box-shadow: none !important; } }'}</style></main>;
};
