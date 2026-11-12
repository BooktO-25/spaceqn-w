import React from 'react';
import { ArrowLeft, Download, MonitorPlay, Printer } from 'lucide-react';

const packages = [
  {
    name: 'Starter',
    price: '₹3,987',
    daily: '₹44.30',
    screens: '3 Standard screens',
    billing: 'Monthly advance',
    badge: '',
    benefits: ['Ready-made ad design', 'QR code on ad', '60-day upgrade credit'],
  },
  {
    name: 'Plus',
    price: '₹5,987',
    daily: '₹39.91',
    screens: '5 screens · 2 Prime + 3 Standard',
    billing: 'Monthly advance',
    badge: '',
    benefits: ['Custom ad design', '1 free ad change / quarter', 'Quarterly proof-of-play photos', '1 screen swap after month 1'],
  },
  {
    name: 'Boost',
    price: '₹9,987',
    daily: '₹33.29',
    screens: '10 screens · 4 Prime + 6 Standard',
    billing: 'Quarterly advance',
    badge: 'MOST POPULAR',
    benefits: ['Monthly ad change', 'Proof photos + QR scan count', '1 Festival Boost / year', 'Up to 2 screen swaps after month 1'],
  },
  {
    name: 'Pro',
    price: '₹14,987',
    daily: '₹31.22',
    screens: '16 screens · 5 Prime + 11 Standard',
    billing: 'Quarterly advance',
    badge: '',
    benefits: ['Short video ad design', '2 Festival Boosts / year', 'Competitor-free Prime screens', '1 free month on renewal'],
  },
  {
    name: 'Elite',
    price: '₹15,787',
    daily: '₹30.95',
    screens: '17 live screens',
    billing: 'Half-yearly advance',
    badge: 'NETWORK-WIDE',
    benefits: ['2 slots on every Prime screen', 'Category-exclusive Prime screens', 'Festival Boost at major festivals', 'Unlimited ad changes', 'Quarterly strategy review'],
  },
];

const addOns = [
  ['Extra repetition · 2nd slot', '₹30', '₹38'],
  ['Extra repetition · 3rd slot', '₹25', '₹32'],
  ['Particular time slot', '₹22', '₹28'],
  ['Extra screen', '₹35', '₹45'],
  ['Scrolling text ticker', '₹18', '₹25'],
  ['3D rotating cube', '₹27', '₹35'],
];

export const RateCardPage: React.FC = () => {
  const printRateCard = () => window.print();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 9mm; }
          html, body { background: #fff !important; }
          .rate-card-page { background: #fff !important; color: #102a43 !important; }
          .rate-card-page .print-hidden { display: none !important; }
          .rate-card-page .rate-card-panel { break-inside: avoid; box-shadow: none !important; }
          .rate-card-page .rate-card-footer { color: #334155 !important; }
        }
      `}</style>

      <header className="border-b border-slate-800 bg-slate-900/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <a href="/" className="flex items-center gap-3 no-underline">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white">
              <MonitorPlay className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-base font-extrabold tracking-wide text-white">SPACEQ DISPLAY</span>
              <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-400">Advertising network</span>
            </span>
          </a>
          <div className="print-hidden flex items-center gap-2">
            <a href="/" className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800">
              <ArrowLeft className="h-4 w-4" /> Sign in / Workspace
            </a>
            <button onClick={printRateCard} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-500">
              <Download className="h-4 w-4" /> Print / Save PDF
            </button>
          </div>
        </div>
      </header>

      <main className="rate-card-page mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <section className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-teal-400">Nellore · Digital out-of-home advertising</p>
            <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">Screen Advertising <span className="text-teal-400">Rate Card</span></h1>
            <p className="mt-2 text-sm text-slate-400">17 digital screens · 10 locations · Network-wide brand visibility</p>
          </div>
          <p className="max-w-sm text-xs leading-5 text-slate-400">Choose the coverage that fits your campaign. Larger packages reduce the daily cost per screen and expand your local visibility.</p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {packages.map((pkg) => (
            <article key={pkg.name} className={`rate-card-panel relative flex flex-col rounded-2xl border p-4 shadow-xl ${pkg.badge === 'MOST POPULAR' ? 'border-teal-400 bg-slate-900 ring-2 ring-teal-400/20' : 'border-slate-800 bg-slate-900/80'}`}>
              {pkg.badge && <div className={`mb-3 inline-flex self-start rounded-full px-2.5 py-1 text-[9px] font-extrabold tracking-wider ${pkg.badge === 'MOST POPULAR' ? 'bg-teal-400 text-slate-950' : 'bg-amber-300 text-slate-950'}`}>{pkg.badge}</div>}
              {!pkg.badge && <div className="mb-3 h-[22px]" />}
              <h2 className="text-lg font-extrabold capitalize text-white">{pkg.name}</h2>
              <div className="mt-3 text-center">
                <div className="text-2xl font-black tracking-tight text-white">{pkg.daily}</div>
                <div className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">Per screen / day</div>
                <div className="mt-3 text-xl font-extrabold text-teal-300">{pkg.price}</div>
                <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Monthly package</div>
              </div>
              <div className="my-4 rounded-xl bg-slate-800/80 p-3 text-center">
                <div className="text-xs font-bold leading-5 text-slate-100">{pkg.screens}</div>
                <div className="mt-1 text-[10px] text-teal-300">1-month minimum</div>
                <div className="mt-1 text-[10px] text-slate-400">{pkg.billing}</div>
              </div>
              <div className="mt-auto">
                <div className="mb-2 text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Package includes</div>
                <ul className="space-y-2 text-[11px] leading-4 text-slate-300">
                  {pkg.benefits.map(item => <li key={item} className="flex gap-2"><span className="font-bold text-teal-400">✓</span><span>{item}</span></li>)}
                </ul>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-teal-500/30 bg-slate-900/70 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div><p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-teal-300">Two ways to advertise · Same contracted airtime</p><h2 className="mt-1 text-xl font-black text-white">Choose your campaign delivery model</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">Choose fixed screen coverage or pool the same number of ad plays across the SPACEQ network. Both options carry the same package price and contracted 10-second plays.</p></div>
            <span className="rounded-full border border-teal-500/30 px-3 py-1.5 text-[10px] font-bold text-teal-200">10-sec ad · 30-day month · 40 plays/screen/day</span>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-700"><table className="w-full min-w-[720px] border-collapse text-left text-xs"><thead className="bg-slate-800 text-[10px] uppercase tracking-wider text-slate-300"><tr><th className="px-4 py-3">Package</th><th className="px-4 py-3">Fixed screen option</th><th className="px-4 py-3">Monthly contracted plays</th><th className="px-4 py-3">Network frequency option</th></tr></thead><tbody>
            {packages.map((pkg, index) => { const screenCounts = [3, 5, 10, 16, 17]; const monthlyPlays = screenCounts[index] * 40 * 30; return <tr key={pkg.name} className={index % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/50'}><td className="border-t border-slate-800 px-4 py-3 font-bold text-white">{pkg.name}<div className="mt-1 text-[10px] font-medium text-teal-300">{pkg.price}/month</div></td><td className="border-t border-slate-800 px-4 py-3 text-slate-300">{pkg.screens}<div className="mt-1 text-[10px] text-slate-500">40 plays per selected screen per day</div></td><td className="border-t border-slate-800 px-4 py-3 font-extrabold text-white">{monthlyPlays.toLocaleString('en-IN')}<div className="mt-1 text-[10px] font-medium text-slate-500">10-second ad plays / month</div></td><td className="border-t border-slate-800 px-4 py-3 text-slate-300">Same {monthlyPlays.toLocaleString('en-IN')} plays pooled across up to 17 live screens<div className="mt-1 text-[10px] text-teal-300">Approx. {(monthlyPlays / 30).toLocaleString('en-IN', { maximumFractionDigits: 0 })} plays network-wide per day</div></td></tr>; })}
          </tbody></table></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl bg-slate-800/70 p-4"><h3 className="text-xs font-extrabold text-white">A. Fixed screen coverage</h3><p className="mt-1 text-[11px] leading-5 text-slate-400">Your ad appears 40 times per day on each selected screen. Best when you want consistent presence at specific venues.</p></div><div className="rounded-xl bg-slate-800/70 p-4"><h3 className="text-xs font-extrabold text-white">B. Network frequency</h3><p className="mt-1 text-[11px] leading-5 text-slate-400">Your same monthly play allocation is distributed across the network, giving broader location exposure with fewer plays at each individual screen.</p></div></div>
          <p className="mt-3 text-[10px] leading-4 text-slate-500">Frequency delivery is a pooled play commitment, not a promise of 40 plays on every network screen. Actual screen distribution depends on campaign dates, live inventory and venue availability. Plays are playback counts, not unique audience impressions. A 30-day billing month is used for this comparison.</p>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-extrabold text-white">Optional Add-ons</h2>
              <p className="mt-1 text-xs text-slate-400">Daily rates per screen only · no monthly add-on billing shown</p>
            </div>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-[10px] font-semibold text-slate-400">Standard & Prime locations</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-800">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-slate-800 text-[10px] uppercase tracking-wider text-slate-200">
                <tr>
                  <th className="px-4 py-3">Add-on</th>
                  <th className="px-4 py-3 text-center">Standard / screen / day</th>
                  <th className="px-4 py-3 text-center">Prime / screen / day</th>
                </tr>
              </thead>
              <tbody>
                {addOns.map((row, index) => (
                  <tr key={row[0]} className={index % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/60'}>
                    <td className="border-t border-slate-800 px-4 py-3 font-semibold text-slate-200">{row[0]}</td>
                    <td className="border-t border-slate-800 px-4 py-3 text-center font-bold text-teal-300">{row[1]}</td>
                    <td className="border-t border-slate-800 px-4 py-3 text-center font-bold text-amber-300">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Particular time slot means one daily window: morning, afternoon, evening or weekends.</p>
        </section>

        <section className="mt-7 rounded-2xl border border-amber-400/50 bg-amber-300 px-5 py-4 text-slate-950">
          <h2 className="text-sm font-black tracking-wide">FOUNDING MEMBER PRICE LOCK <span className="font-bold">| First 10 advertisers</span></h2>
          <p className="mt-1 text-xs leading-5">Your monthly fee and add-on rates stay the same for as long as you stay, even when we add screens or raise rates. The lock covers the screens and slots in your package; cancelling or lapsing 30+ days ends it.</p>
        </section>

        <footer className="rate-card-footer mt-5 space-y-1 text-[10px] leading-4 text-slate-400">
          <p>• You pay only for screens that are live and playing your ad.</p>
          <p>• Prime means highest-footfall venues (estimated 1,000–2,000 people); footfall figures are estimates, not guaranteed impressions.</p>
          <p>• Festival Boost = 14 days around a festival or exam season. Add-ons run for your package term; time windows can be changed once a quarter; screen swaps and add-ons are subject to availability.</p>
          <p>• You share your offer and logo; we design the ad and confirm it plays correctly before billing starts.</p>
          <p className="pt-2 text-slate-500">All prices shown in Indian Rupees (INR).</p>
        </footer>

        <div className="print-hidden mt-8 flex justify-center">
          <button onClick={printRateCard} className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-extrabold text-slate-950 hover:bg-teal-400">
            <Printer className="h-4 w-4" /> Print or save this rate card as PDF
          </button>
        </div>
      </main>
    </div>
  );
};
