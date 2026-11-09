import React, { useEffect, useMemo, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import QRCode from 'qrcode';
import { db } from '../lib/firebase';
import { Device } from '../types';
import { Globe2, Monitor, QrCode, Save, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react';

type Scope = 'GLOBAL' | 'DEVICES';
type Contact = { name: string; role: string; phone: string };
type QrConfig = {
  enabled: boolean;
  deviceIds: string[];
  pageTitle: string;
  introText: string;
  showRateCard: boolean;
  showOffer: boolean;
  offerTitle: string;
  offerMessage: string;
  showContacts: boolean;
  showWhatsApp: boolean;
  contacts: Contact[];
  size: number;
  x: number;
  y: number;
  foreground: string;
  background: string;
  label: string;
  showLabel: boolean;
};

const defaultContacts: Contact[] = [
  { name: 'Surya', role: 'Display Incharge', phone: '9494492902' },
  { name: 'Anil', role: 'Operational Incharge', phone: '7981287404' },
  { name: 'Meghnadh', role: 'Co-ordinator', phone: '9989631475' },
];

const emptyQr = (): QrConfig => ({
  enabled: false,
  deviceIds: [],
  pageTitle: 'SPACEQ Display Advertising',
  introText: 'Scan to explore our advertising network, rate card, current offers and contact our team.',
  showRateCard: true,
  showOffer: true,
  offerTitle: 'Advertise across Nellore',
  offerMessage: 'Reach customers across 17 digital screens in 10 locations. Contact our team to discuss a campaign for your business.',
  showContacts: true,
  showWhatsApp: true,
  contacts: defaultContacts.map(contact => ({ ...contact })),
  size: 150,
  x: 88,
  y: 72,
  foreground: '#102A43',
  background: '#FFFFFF',
  label: 'Scan for rate card, offers & contact details',
  showLabel: true,
});

const mergeQr = (stored: any): QrConfig => {
  const base = emptyQr();
  if (!stored || typeof stored !== 'object') return base;
  return {
    ...base,
    ...stored,
    contacts: Array.isArray(stored.contacts) && stored.contacts.length
      ? stored.contacts.map((contact: any, index: number) => ({
          ...base.contacts[index] || { name: '', role: '', phone: '' },
          ...contact,
        }))
      : base.contacts,
    deviceIds: Array.isArray(stored.deviceIds) ? stored.deviceIds : [],
  };
};

export const QrEditor: React.FC<{ businessId: string; devices: Device[]; darkMode: boolean }> = ({ businessId, devices, darkMode }) => {
  const [scope, setScope] = useState<Scope>('GLOBAL');
  const [globalQr, setGlobalQr] = useState<QrConfig>(emptyQr());
  const [deviceQr, setDeviceQr] = useState<QrConfig>(emptyQr());
  const [qr, setQr] = useState<QrConfig>(emptyQr());
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const previewStageRef = useRef<HTMLDivElement>(null);

  const panel = darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-gray-200 text-gray-900';

  useEffect(() => {
    if (!businessId) return;
    const stopGlobal = onSnapshot(doc(db, 'scrollingMessages', businessId), snapshot => {
      setGlobalQr(mergeQr(snapshot.exists() ? snapshot.data().qr : null));
    });
    const stopDevices = onSnapshot(doc(db, 'scrollingMessages', businessId + '_devices'), snapshot => {
      setDeviceQr(mergeQr(snapshot.exists() ? snapshot.data().qr : null));
    });
    return () => { stopGlobal(); stopDevices(); };
  }, [businessId]);

  useEffect(() => {
    setQr(mergeQr(scope === 'GLOBAL' ? globalQr : deviceQr));
  }, [scope, globalQr, deviceQr]);

  const selectedDeviceId = qr.deviceIds[0] || devices[0]?.id || '';
  const infoUrl = useMemo(() => {
    const url = new URL('/info', window.location.origin);
    url.searchParams.set('businessId', businessId);
    if (scope === 'DEVICES' && selectedDeviceId) url.searchParams.set('deviceId', selectedDeviceId);
    return url.toString();
  }, [businessId, scope, selectedDeviceId]);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(infoUrl, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: qr.foreground, light: qr.background },
    }).then(dataUrl => { if (active) setPreviewUrl(dataUrl); })
      .catch(error => { console.error('QR preview generation failed:', error); if (active) setPreviewUrl(''); });
    return () => { active = false; };
  }, [infoUrl, qr.foreground, qr.background]);

  const update = (patch: Partial<QrConfig>) => setQr(previous => ({ ...previous, ...patch }));
  const updateContact = (index: number, patch: Partial<Contact>) => {
    setQr(previous => ({
      ...previous,
      contacts: previous.contacts.map((contact, contactIndex) =>
        contactIndex === index ? { ...contact, ...patch } : contact
      ),
    }));
  };

  const save = async () => {
    if (scope === 'DEVICES' && !qr.deviceIds.length) {
      setNotice('Select at least one display for this QR campaign.');
      return;
    }
    if (qr.showContacts && qr.contacts.some(contact => !contact.name.trim() || !contact.phone.trim())) {
      setNotice('Enter a name and phone number for each visible contact.');
      return;
    }
    setSaving(true);
    setNotice('');
    try {
      const id = scope === 'GLOBAL' ? businessId : businessId + '_devices';
      const savedQr = {
        ...qr,
        deviceIds: scope === 'GLOBAL' ? [] : qr.deviceIds,
      };
      await setDoc(doc(db, 'scrollingMessages', id), {
        businessId,
        scope,
        qr: savedQr,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      setNotice('QR campaign saved and published. Displays will update automatically.');
    } catch (error: any) {
      setNotice(error?.message || 'Could not save QR settings. Check Firestore permissions.');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = `mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ${darkMode ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-gray-200 bg-white text-gray-900'}`;
  const selected = (id: string) => qr.deviceIds.includes(id);

  const handleQrPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const handleQrPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !previewStageRef.current) return;
    const bounds = previewStageRef.current.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.round(((event.clientX - bounds.left) / bounds.width) * 100);
    const y = Math.round(((event.clientY - bounds.top) / bounds.height) * 100);
    update({
      x: Math.max(5, Math.min(95, x)),
      y: Math.max(5, Math.min(95, y)),
    });
  };

  const stopQrDragging = () => setIsDragging(false);

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl border p-5 space-y-5 ${panel}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold"><QrCode size={19}/> QR Information Campaign</h2>
            <p className="mt-1 text-xs text-slate-500">Show a scannable QR code on your displays. Visitors open a public page with your rate card, offers and contact details.</p>
          </div>
          <button onClick={() => update({ enabled: !qr.enabled })} className={`rounded-full px-5 py-2 text-sm font-bold ${qr.enabled ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
            {qr.enabled ? 'ON · ACTIVE' : 'OFF · PAUSED'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setScope('GLOBAL')} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${scope === 'GLOBAL' ? 'bg-blue-600 text-white' : 'bg-slate-500/10'}`}>
            <Globe2 size={15}/> Global
          </button>
          <button onClick={() => setScope('DEVICES')} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${scope === 'DEVICES' ? 'bg-blue-600 text-white' : 'bg-slate-500/10'}`}>
            <Monitor size={15}/> Selected devices
          </button>
        </div>
        {scope === 'DEVICES' && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {devices.map(device => (
              <label key={device.id} className="flex items-center gap-2 rounded-lg border border-slate-500/20 p-3 text-sm">
                <input type="checkbox" checked={selected(device.id)} onChange={event => update({ deviceIds: event.target.checked ? [...qr.deviceIds, device.id] : qr.deviceIds.filter(id => id !== device.id) })}/>
                {device.name}
              </label>
            ))}
            {!devices.length && <p className="text-xs text-slate-500">No displays are available for this business yet.</p>}
          </div>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <div className={`rounded-2xl border p-5 space-y-5 ${panel}`}>
          <div>
            <h3 className="font-bold">Information page content</h3>
            <p className="mt-1 text-xs text-slate-500">Edit what visitors see after scanning the display QR code.</p>
          </div>
          <label className="block text-sm font-semibold">Page heading<input className={fieldClass} value={qr.pageTitle} onChange={event => update({ pageTitle: event.target.value })}/></label>
          <label className="block text-sm font-semibold">Introduction<textarea className={fieldClass} rows={2} value={qr.introText} onChange={event => update({ introText: event.target.value })}/></label>

          <div className="rounded-xl border border-slate-500/20 p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={qr.showOffer} onChange={event => update({ showOffer: event.target.checked })}/> Show campaign offer</label>
            {qr.showOffer && <>
              <label className="block text-sm">Offer heading<input className={fieldClass} value={qr.offerTitle} onChange={event => update({ offerTitle: event.target.value })}/></label>
              <label className="block text-sm">Offer details<textarea className={fieldClass} rows={3} value={qr.offerMessage} onChange={event => update({ offerMessage: event.target.value })}/></label>
            </>}
          </div>

          <div className="rounded-xl border border-slate-500/20 p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={qr.showRateCard} onChange={event => update({ showRateCard: event.target.checked })}/> Include advertising rate card link</label>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={qr.showContacts} onChange={event => update({ showContacts: event.target.checked })}/> Show contact team</label>
            {qr.showContacts && <>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={qr.showWhatsApp} onChange={event => update({ showWhatsApp: event.target.checked })}/> Show WhatsApp buttons</label>
              <div className="grid gap-3 md:grid-cols-3">
                {qr.contacts.map((contact, index) => (
                  <div key={index} className="rounded-xl border border-slate-500/20 p-3 space-y-2">
                    <p className="text-xs font-extrabold text-teal-500">CONTACT {index + 1}</p>
                    <input aria-label={`Contact ${index + 1} name`} className={fieldClass} placeholder="Name" value={contact.name} onChange={event => updateContact(index, { name: event.target.value })}/>
                    <input aria-label={`Contact ${index + 1} role`} className={fieldClass} placeholder="Role" value={contact.role} onChange={event => updateContact(index, { role: event.target.value })}/>
                    <input aria-label={`Contact ${index + 1} phone`} className={fieldClass} placeholder="Phone number" inputMode="tel" value={contact.phone} onChange={event => updateContact(index, { phone: event.target.value })}/>
                  </div>
                ))}
              </div>
            </>}
          </div>

          <div>
            <h3 className="font-bold">On-screen QR appearance</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">QR size · {qr.size}px<input type="range" min="90" max="300" value={qr.size} onChange={event => update({ size: +event.target.value })} className="mt-2 block w-full"/></label>
              <label className="text-sm">Horizontal position · {qr.x}%<input type="range" min="5" max="95" value={qr.x} onChange={event => update({ x: +event.target.value })} className="mt-2 block w-full"/></label>
              <label className="text-sm">Vertical position · {qr.y}%<input type="range" min="5" max="95" value={qr.y} onChange={event => update({ y: +event.target.value })} className="mt-2 block w-full"/></label>
              <label className="text-sm">QR foreground<input type="color" value={qr.foreground} onChange={event => update({ foreground: event.target.value })} className="mt-2 block h-10 w-full"/></label>
              <label className="text-sm">QR background<input type="color" value={qr.background} onChange={event => update({ background: event.target.value })} className="mt-2 block h-10 w-full"/></label>
              <label className="block text-sm">Caption<input className={fieldClass} value={qr.label} onChange={event => update({ label: event.target.value })}/></label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={qr.showLabel} onChange={event => update({ showLabel: event.target.checked })}/> Display QR caption</label>
          </div>

          <button disabled={saving} onClick={save} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 font-bold text-white hover:bg-rose-500 disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} {saving ? 'Publishing…' : 'Save & Publish QR'}
          </button>
          {notice && <p className="flex items-center gap-2 text-xs text-slate-400"><CheckCircle2 size={14} className="text-emerald-500"/>{notice}</p>}
        </div>

        <div className={`h-fit rounded-2xl border p-5 ${panel}`}>
          <h3 className="font-bold">QR live preview</h3>
          <p className="mt-1 text-xs text-slate-500">This sample points to the public information page.</p>
          <div
            ref={previewStageRef}
            className="relative mt-5 aspect-video w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950"
            style={{ touchAction: 'none' }}
          >
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-semibold tracking-[0.25em] text-slate-700">
              DISPLAY PREVIEW
            </div>
            {previewUrl ? (
              <div
                role="button"
                tabIndex={0}
                aria-label="Drag QR code to reposition it"
                aria-roledescription="draggable"
                onPointerDown={handleQrPointerDown}
                onPointerMove={handleQrPointerMove}
                onPointerUp={stopQrDragging}
                onPointerCancel={stopQrDragging}
                onLostPointerCapture={stopQrDragging}
                onDragStart={event => event.preventDefault()}
                className={`absolute z-10 flex max-w-[42%] flex-col items-center rounded-lg p-2 text-center shadow-2xl select-none touch-none ${isDragging ? 'cursor-grabbing ring-2 ring-teal-400' : 'cursor-grab hover:ring-2 hover:ring-teal-400/70'}`}
                style={{
                  left: `${qr.x}%`,
                  top: `${qr.y}%`,
                  width: `${Math.max(70, Math.min(140, qr.size * 0.55))}px`,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: qr.background,
                  color: qr.foreground,
                }}
              >
                <img
                  src={previewUrl}
                  alt="Preview of the public information QR code"
                  draggable={false}
                  className="pointer-events-none block h-auto w-full"
                />
                {qr.showLabel && <p className="pointer-events-none mt-1.5 w-full break-words text-[9px] font-bold leading-tight">{qr.label}</p>}
              </div>
            ) : <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-slate-500"/></div>}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <p className="text-slate-500">{isDragging ? 'Release to set QR position' : 'Drag the QR code inside the preview to move it.'}</p>
            <p className="font-semibold tabular-nums text-teal-500">X: {qr.x}% · Y: {qr.y}%</p>
          </div>
          <a href={infoUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-teal-500 hover:text-teal-400">
            Open public information page <ExternalLink size={13}/>
          </a>
          <p className="mt-3 break-all text-[10px] leading-4 text-slate-500">{infoUrl}</p>
        </div>
      </div>
    </div>
  );
};
