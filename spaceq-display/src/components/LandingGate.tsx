import React from 'react';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';
import { Tv, UploadCloud, LayoutGrid, ShieldCheck } from 'lucide-react';

export const LandingGate: React.FC<{ darkMode: boolean }> = ({ darkMode }) => {
  const { openAuthModal } = useAuth();

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-6 py-16 ${
      darkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#F8F9FA] text-[#111827]'
    }`}>
      <div className="w-full max-w-md text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-rose-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-rose-600/30">
          <Tv className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">SPACEQ Display</h1>
          <p className="text-sm text-slate-400">
            Manage digital signage for your business — upload content, build playlists, and push them to every screen in your locations.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-left">
          <Feature icon={<UploadCloud className="w-4 h-4" />} label="Upload content" darkMode={darkMode} />
          <Feature icon={<LayoutGrid className="w-4 h-4" />} label="Build playlists" darkMode={darkMode} />
          <Feature icon={<ShieldCheck className="w-4 h-4" />} label="Private & isolated" darkMode={darkMode} />
        </div>

        <button
          onClick={openAuthModal}
          className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-600/20 transition-colors"
        >
          Sign In or Create Your Business Account
        </button>

        <p className="text-[11px] text-slate-500">
          Every business gets its own private, isolated workspace — your content and devices are never visible to anyone else.
        </p>
      </div>

      <AuthModal darkMode={darkMode} />
    </div>
  );
};

const Feature: React.FC<{ icon: React.ReactNode; label: string; darkMode: boolean }> = ({ icon, label, darkMode }) => (
  <div className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-[10px] font-semibold ${
    darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-gray-200 text-gray-600'
  }`}>
    <span className="text-rose-500">{icon}</span>
    {label}
  </div>
);
