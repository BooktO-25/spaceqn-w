import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ArrowLeft, ArrowUpRight, MessageCircle, Phone, TicketPercent, UserRound, Wifi } from 'lucide-react';

type Contact = { name: string; role: string; phone: string };
type PublicQrInfo = {
  pageTitle: string;
  introText: string;
  showRateCard: boolean;
  showOffer: boolean;
  offerTitle: string;
  offerMessage: string;
  showContacts: boolean;
  showWhatsApp: boolean;
  contacts: Contact[];
};

const defaultInfo: PublicQrInfo = {
  pageTitle: 'SPACEQ Display Advertising',
  introText: 'Explore our digital advertising network, current offers and contact our team.',
  showRateCard: true,
  showOffer: true,
  offerTitle: 'Advertise across Nellore',
  offerMessage: 'Reach customers across 17 digital screens in 10 locations. Contact our team to discuss a campaign for your business.',
  showContacts: true,
  showWhatsApp: true,
  contacts: [
    { name: 'Surya', role: 'Display Incharge', phone: '9494492902' },
    { name: 'Anil', role: 'Operational Incharge', phone: '7981287404' },
    { name: 'Meghnadh', role: 'Co-ordinator', phone: '9989631475' },
  ],
};

const whatsappUrl = (phone: string) => {
  const digits = (phone || '').replace(/\D/g, '');
  const international = digits.startsWith('91') ? digits : `91${digits}`;
  return `https://wa.me/${international}`;
};

export const PublicInfoPage: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const businessId = params.get('businessId') || '';
  const deviceId = params.get('deviceId') || '';
  const [info, setInfo] = useState<PublicQrInfo>(defaultInfo);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!businessId) {
        setLoadError('This QR link is missing its business reference.');
        setLoading(false);
        return;
      }
      try {
        const [globalSnapshot, deviceSnapshot] = await Promise.all([
          getDoc(doc(db, 'scrollingMessages', businessId)),
          deviceId ? getDoc(doc(db, 'scrollingMessages', businessId + '_devices')) : Promise.resolve(null),
        ]);

        const globalQr = globalSnapshot.exists() ? globalSnapshot.data().qr : null;
        const deviceQr = deviceSnapshot?.exists() ? deviceSnapshot.data().qr : null;
        const deviceMatches = !!deviceId
          && deviceQr?.enabled
          && Array.isArray(deviceQr.deviceIds)
          && deviceQr.deviceIds.includes(deviceId);

        // Global is the master. A selected-device page is used only while
        // the global QR feature is disabled, matching the signage player.
        const selectedConfig = globalQr?.enabled ? globalQr : deviceMatches ? deviceQr : globalQr;
        if (active) {
          setInfo({
            ...defaultInfo,
            ...(selectedConfig || {}),
            contacts: Array.isArray(selectedConfig?.contacts) && selectedConfig.contacts.length
              ? selectedConfig.contacts
              : defaultInfo.contacts,
          });
          setLoadError('');
        }
      } catch (error: any) {
        console.error('Public QR information page load failed:', error);
        if (active) setLoadError('We could not load the latest campaign details. Please use the contact options below.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [businessId, deviceId]);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-3 no-underline">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white"><Wifi size={20}/></span>
            <span>
              <span className="block text-sm font-black tracking-wide">SPACEQ DISPLAY</span>
              <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-500">Advertising network</span>
            </span>
          </a>
          <a href="/rate-card" className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-900">
            Rate card <ArrowUpRight size={14}/>
          </a>
        </header>

        <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl sm:p-9">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-teal-400">Thanks for scanning</p>
          <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-4xl">{info.pageTitle}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">{info.introText}</p>
          {loading && <p className="mt-5 text-xs text-slate-500">Loading current campaign information…</p>}
          {loadError && <p className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-200">{loadError}</p>}
        </section>

        {!loading && info.showOffer && (
          <section className="mt-5 rounded-2xl border border-amber-400/40 bg-amber-300 p-5 text-slate-950 sm:p-6">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider"><TicketPercent size={16}/> Current campaign / offer</div>
            <h2 className="mt-3 text-2xl font-black">{info.offerTitle}</h2>
            <p className="mt-2 text-sm leading-6">{info.offerMessage}</p>
          </section>
        )}

        {!loading && info.showRateCard && (
          <section className="mt-5 flex flex-col justify-between gap-4 rounded-2xl border border-teal-400/30 bg-slate-900 p-5 sm:flex-row sm:items-center sm:p-6">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-teal-400">Advertising packages</p>
              <h2 className="mt-1 text-xl font-black">Explore the screen advertising rate card</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">Compare coverage, monthly packages and daily add-ons.</p>
            </div>
            <a href="/rate-card" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-teal-300">
              View rate card <ArrowUpRight size={16}/>
            </a>
          </section>
        )}

        {!loading && info.showContacts && (
          <section className="mt-8">
            <div className="mb-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-rose-400">Speak to our team</p>
              <h2 className="mt-1 text-2xl font-black">Contact details</h2>
              <p className="mt-1 text-xs text-slate-400">Call or message the team for advertising enquiries and campaign support.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {info.contacts.map((contact, index) => (
                <article key={`${contact.phone}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-teal-300"><UserRound size={18}/></div>
                  <h3 className="font-extrabold">{contact.name}</h3>
                  <p className="mt-0.5 text-[11px] text-slate-400">{contact.role}</p>
                  <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-200 hover:text-teal-300">
                    <Phone size={14}/> {contact.phone}
                  </a>
                  {info.showWhatsApp && (
                    <a href={whatsappUrl(contact.phone)} target="_blank" rel="noreferrer" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500">
                      <MessageCircle size={14}/> WhatsApp
                    </a>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-8 flex flex-col justify-between gap-3 border-t border-slate-800 pt-5 text-[10px] text-slate-500 sm:flex-row sm:items-center">
          <span>SPACEQ Display · Digital out-of-home advertising</span>
          <a href="/rate-card" className="inline-flex items-center gap-1 font-bold text-slate-300 hover:text-teal-300"><ArrowLeft size={12}/> Advertising rate card</a>
        </footer>
      </div>
    </div>
  );
};
