import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Business } from '../types';
import {
  subscribeBusinesses,
  findUserByEmail,
  setRegionalAdmin,
  updateBusinessRegion,
  PlatformUser,
} from '../services/firebaseService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Building2, MapPin, UserPlus, ShieldCheck, Search, LogOut, Check } from 'lucide-react';

export const SuperAdminConsole: React.FC = () => {
  const { userProfile, logout } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [regionalAdmins, setRegionalAdmins] = useState<PlatformUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [newRegion, setNewRegion] = useState('');
  const [status, setStatus] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsub = subscribeBusinesses(setBusinesses, '', 'SUPER_ADMIN');
    const unsubAdmins = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'REGIONAL_ADMIN')),
      snap => setRegionalAdmins(snap.docs.map(d => ({ uid: d.id, ...d.data() } as PlatformUser)))
    );
    return () => { unsub(); unsubAdmins(); };
  }, []);

  const knownRegions: string[] = Array.from(new Set<string>(businesses.map(b => b.region).filter((r): r is string => !!r))).sort();

  const filteredBusinesses = businesses.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.region || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleRegion = (region: string) => {
    setSelectedRegions(prev => prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]);
  };

  const handleAddNewRegion = () => {
    const r = newRegion.trim();
    if (!r) return;
    if (!selectedRegions.includes(r)) setSelectedRegions(prev => [...prev, r]);
    setNewRegion('');
  };

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (selectedRegions.length === 0) {
      setStatus({ type: 'error', text: 'Pick at least one region for this admin to manage.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const user = await findUserByEmail(inviteEmail.trim());
      if (!user) {
        setStatus({ type: 'error', text: 'No account with that email yet — they need to sign up in the app first, then you can promote them here.' });
        return;
      }
      if (user.role === 'SUPER_ADMIN') {
        setStatus({ type: 'error', text: 'That account is already a Super Admin.' });
        return;
      }
      await setRegionalAdmin(user.uid, selectedRegions);
      setStatus({ type: 'success', text: `${user.displayName || user.email} is now a Regional Admin for: ${selectedRegions.join(', ')}` });
      setInviteEmail('');
      setSelectedRegions([]);
    } catch (err: any) {
      setStatus({ type: 'error', text: err?.message || 'Could not update that account.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegionEdit = (businessId: string, region: string) => {
    updateBusinessRegion(businessId, region).catch(err => console.warn('Region update failed:', err));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold">SPACEQ Platform Admin</h1>
            <p className="text-[10px] text-slate-500">{userProfile?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Promote to Regional Admin */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-2"><UserPlus className="w-4 h-4 text-rose-500" /> Appoint a Regional Admin</h2>
          <p className="text-[11px] text-slate-400">
            A Regional Admin can fully manage every business inside the region(s) you assign — but nothing outside them. The person must already have a SPACEQ account (any role) before you can promote them.
          </p>

          {status && (
            <div className={`p-2.5 rounded-lg text-xs font-medium ${status.type === 'error' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
              {status.text}
            </div>
          )}

          <form onSubmit={handlePromote} className="space-y-3">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="person@email.com"
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 outline-none"
            />

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Regions to grant</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {knownRegions.map(region => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => toggleRegion(region)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 ${
                      selectedRegions.includes(region)
                        ? 'bg-rose-600 border-rose-600 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {selectedRegions.includes(region) && <Check className="w-3 h-3" />}
                    {region}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  placeholder="Or add a new region name..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 outline-none"
                />
                <button type="button" onClick={handleAddNewRegion} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold">
                  Add
                </button>
              </div>
              {selectedRegions.length > 0 && (
                <p className="text-[10px] text-slate-400 mt-1.5">Selected: {selectedRegions.join(', ')}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-60"
            >
              {isSubmitting ? 'Working...' : 'Promote to Regional Admin'}
            </button>
          </form>
        </div>

        {/* Current Regional Admins */}
        {regionalAdmins.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Regional Admins ({regionalAdmins.length})</h2>
            {regionalAdmins.map(a => (
              <div key={a.uid} className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/60 text-xs">
                <div>
                  <span className="font-semibold">{a.displayName || a.email}</span>
                  <span className="text-slate-500 ml-2">{a.email}</span>
                </div>
                <div className="flex gap-1.5">
                  {(a.assignedRegions || []).map(r => (
                    <span key={r} className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 text-[10px] font-bold">{r}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* All Businesses */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">All Customers ({businesses.length})</h2>
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or region..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            {filteredBusinesses.map(biz => (
              <div key={biz.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/60 text-xs">
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-rose-500" />
                  <div>
                    <p className="font-semibold">{biz.name}</p>
                    <p className="text-[10px] text-slate-500">{biz.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  <input
                    defaultValue={biz.region || ''}
                    onBlur={(e) => e.target.value !== (biz.region || '') && handleRegionEdit(biz.id, e.target.value)}
                    placeholder="Unassigned region"
                    className="px-2 py-1 text-[11px] rounded-lg bg-slate-800 border border-slate-700 outline-none w-40 text-right"
                  />
                </div>
              </div>
            ))}
            {filteredBusinesses.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-6">No businesses match that search.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
