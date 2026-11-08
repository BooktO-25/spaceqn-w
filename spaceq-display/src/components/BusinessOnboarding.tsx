import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Building2, ArrowRight, LogOut } from 'lucide-react';

export const BusinessOnboarding: React.FC<{ darkMode: boolean }> = ({ darkMode }) => {
  const { userProfile, completeBusinessOnboarding, logout } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) return;
    setError('');
    setIsSubmitting(true);
    try {
      await completeBusinessOnboarding(businessName.trim());
    } catch (err: any) {
      setError(err?.message || 'Could not create your business. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center px-6 ${
      darkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#F8F9FA] text-[#111827]'
    }`}>
      <div className={`w-full max-w-sm rounded-2xl border shadow-2xl p-6 space-y-5 ${
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'
      }`}>
        <div className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center">
          <Building2 className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <h1 className="text-lg font-extrabold">Welcome, {userProfile?.displayName?.split(' ')[0] || 'there'} 👋</h1>
          <p className="text-xs text-slate-400">
            One last step — name your business to create your own private workspace.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            required
            autoFocus
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. Ramesh's Restaurant"
            className={`w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-colors ${
              darkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-gray-50 border-gray-200 focus:border-black'
            }`}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? 'Creating your workspace...' : 'Create My Workspace'}
            {!isSubmitting && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </form>

        <button
          onClick={logout}
          className="w-full text-[11px] text-slate-500 hover:text-rose-500 flex items-center justify-center gap-1.5 transition-colors"
        >
          <LogOut className="w-3 h-3" />
          Sign out instead
        </button>
      </div>
    </div>
  );
};
