import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Business, UserRole, TeamInvite } from '../types';
import { can, roleLabel, ASSIGNABLE_ROLES } from '../lib/permissions';
import {
  subscribeBusinessMembers,
  subscribeInvites,
  createInvite,
  revokeInvite,
  updateMemberRole,
  BusinessMember,
} from '../services/firebaseService';
import { UserPlus, Mail, ShieldCheck, Trash2, Users, Clock, X } from 'lucide-react';

interface TeamViewProps {
  selectedBusiness: Business;
  darkMode: boolean;
}

const ROLE_DESCRIPTIONS: Record<Exclude<UserRole, 'SUPER_ADMIN' | 'REGIONAL_ADMIN'>, string> = {
  BUSINESS_OWNER: 'Full control — devices, content, playlists, team, and business settings.',
  MANAGER: 'Runs day-to-day operations — devices, locations, content, and playlists. Cannot manage the team.',
  DESIGNER: 'Content only — uploads media and builds playlists. Cannot touch devices or the team.',
  VIEWER: 'Read-only — can see dashboards, devices, and content, but cannot create, edit, or delete anything.',
};

export const TeamView: React.FC<TeamViewProps> = ({ selectedBusiness, darkMode }) => {
  const { userProfile } = useAuth();
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<UserRole, 'SUPER_ADMIN' | 'REGIONAL_ADMIN'>>('MANAGER');
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState('');

  const canManageTeam = can(userProfile?.role, 'manageTeam');

  useEffect(() => {
    const unsubM = subscribeBusinessMembers(selectedBusiness.id, setMembers);
    const unsubI = subscribeInvites(selectedBusiness.id, setInvites);
    return () => { unsubM(); unsubI(); };
  }, [selectedBusiness.id]);

  const pendingInvites = invites.filter((i: any) => i.status === 'PENDING');

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    if (members.some(m => m.email.toLowerCase() === email)) {
      setError('This person is already on the team.');
      return;
    }
    if (pendingInvites.some((i: any) => i.email === email)) {
      setError('There is already a pending invite for this email.');
      return;
    }

    setIsInviting(true);
    try {
      await createInvite({
        businessId: selectedBusiness.id,
        email,
        role: inviteRole,
        invitedByEmail: userProfile?.email || '',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      });
      setInviteEmail('');
    } catch (err: any) {
      setError(err?.message || 'Could not send invite.');
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Users className="w-5 h-5 text-rose-500" /> Team
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Who has access to {selectedBusiness.name}, and what they can do.
        </p>
      </div>

      {!canManageTeam && (
        <div className={`p-3 rounded-xl text-xs ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>
          You can see the team, but only a Business Owner can invite people or change roles.
        </div>
      )}

      {canManageTeam && (
        <div className={`p-5 rounded-2xl border space-y-3 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <h2 className="text-sm font-bold flex items-center gap-2"><UserPlus className="w-4 h-4 text-rose-500" /> Invite someone</h2>
          {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@email.com"
                className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                }`}
              />
            </div>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className={`px-3 py-2 text-xs rounded-xl border outline-none ${
                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
              }`}
            >
              {ASSIGNABLE_ROLES.map(r => (
                <option key={r} value={r}>{roleLabel(r)}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={isInviting}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold disabled:opacity-60"
            >
              {isInviting ? 'Sending...' : 'Send Invite'}
            </button>
          </form>
          <p className="text-[10px] text-slate-400">{ROLE_DESCRIPTIONS[inviteRole]}</p>
        </div>
      )}

      {pendingInvites.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending Invites</h2>
          {pendingInvites.map((inv: any) => (
            <div key={inv.id} className={`flex items-center justify-between p-3 rounded-xl border ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-amber-500" />
                <div>
                  <p className="text-xs font-semibold">{inv.email}</p>
                  <p className="text-[10px] text-slate-400">Invited as {roleLabel(inv.role)} — waiting for them to sign up</p>
                </div>
              </div>
              {canManageTeam && (
                <button
                  onClick={() => revokeInvite(inv.id)}
                  className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500"
                  title="Revoke invite"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Members ({members.length})</h2>
        {members.map(member => (
          <div key={member.uid} className={`flex items-center justify-between p-3 rounded-xl border ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {member.displayName?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  {member.displayName}
                  {member.role === 'BUSINESS_OWNER' && <ShieldCheck className="w-3 h-3 text-rose-500" />}
                </p>
                <p className="text-[10px] text-slate-400">{member.email}</p>
              </div>
            </div>

            {canManageTeam && member.uid !== userProfile?.uid ? (
              <select
                value={member.role}
                onChange={(e) => updateMemberRole(member.uid, e.target.value)}
                className={`px-2 py-1.5 text-[11px] rounded-lg border outline-none ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                }`}
              >
                {ASSIGNABLE_ROLES.map(r => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
            ) : (
              <span className="text-[11px] font-semibold text-slate-400">{roleLabel(member.role as UserRole)}{member.uid === userProfile?.uid ? ' (you)' : ''}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
