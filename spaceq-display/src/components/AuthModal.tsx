import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  X,
  ShieldCheck,
  Mail,
  Lock,
  Building2,
  LogOut,
  UserPlus,
  LogIn
} from 'lucide-react';

interface AuthModalProps {
  darkMode: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ darkMode }) => {
  const {
    userProfile,
    isAuthModalOpen,
    closeAuthModal,
    loginWithEmail,
    signupWithEmail,
    loginWithGoogle,
    authError,
    logout
  } = useAuth();

  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to login with provided credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await signupWithEmail(email, password, displayName || 'Business Owner', businessName);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setErrorMsg('');
    setIsGoogleSubmitting(true);
    try {
      await loginWithGoogle();
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const shownError = errorMsg || authError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden transition-all ${
        darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-gray-100 text-gray-900'
      }`}>

        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between ${
          darkMode ? 'border-slate-800 bg-slate-800/50' : 'border-gray-100 bg-gray-50'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-black text-white dark:bg-white dark:text-black flex items-center justify-center font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-rose-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Sign in to SPACEQ Display</h2>
              <p className="text-[10px] text-gray-400">Your business, your devices, your content</p>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-800 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Active Account Card */}
        {userProfile && (
          <div className="p-4 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border-b border-rose-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs">
                  {userProfile.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold leading-tight">{userProfile.displayName}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      userProfile.role === 'SUPER_ADMIN'
                        ? 'bg-rose-500 text-white'
                        : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300'
                    }`}>
                      {userProfile.role}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{userProfile.email}</p>
                </div>
              </div>

              <button
                onClick={logout}
                className="text-[10px] font-semibold text-rose-500 hover:text-rose-400 flex items-center gap-1 border border-rose-500/20 px-2 py-1 rounded-md hover:bg-rose-500/10 transition-colors"
              >
                <LogOut className="w-3 h-3" />
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-gray-100 dark:border-slate-800 text-xs font-semibold">
          <button
            onClick={() => { setMode('LOGIN'); setErrorMsg(''); }}
            className={`flex-1 py-3 text-center transition-colors border-b-2 ${
              mode === 'LOGIN'
                ? 'border-rose-500 text-rose-500 font-bold'
                : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('SIGNUP'); setErrorMsg(''); }}
            className={`flex-1 py-3 text-center transition-colors border-b-2 ${
              mode === 'SIGNUP'
                ? 'border-rose-500 text-rose-500 font-bold'
                : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-slate-200'
            }`}
          >
            Create Business Account
          </button>
        </div>

        <div className="p-5 space-y-4">
          {shownError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs leading-relaxed">
              {shownError}
            </div>
          )}

          {mode === 'LOGIN' && (
            <form onSubmit={handleEmailLogin} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@business.com"
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none transition-colors ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-gray-50 border-gray-200 focus:border-black'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none transition-colors ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-gray-50 border-gray-200 focus:border-black'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold text-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <LogIn className="w-4 h-4" />
                {isSubmitting ? 'Signing In...' : 'Sign In'}
              </button>

              <GoogleDivider />
              <GoogleButton darkMode={darkMode} onClick={handleGoogle} loading={isGoogleSubmitting} />
            </form>
          )}

          {mode === 'SIGNUP' && (
            <form onSubmit={handleEmailSignup} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="John Doe"
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none transition-colors ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-gray-50 border-gray-200 focus:border-black'
                  }`}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Business Name
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="My Restaurant / My Store"
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none transition-colors ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-gray-50 border-gray-200 focus:border-black'
                    }`}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Creates a brand-new, private workspace just for you. Were you invited to a team instead? Leave this blank — we'll match your invite by email automatically.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@mybusiness.com"
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none transition-colors ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-gray-50 border-gray-200 focus:border-black'
                  }`}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none transition-colors ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-gray-50 border-gray-200 focus:border-black'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-rose-600 text-white font-semibold text-xs hover:bg-rose-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <UserPlus className="w-4 h-4" />
                {isSubmitting ? 'Creating Account...' : 'Create Business Account'}
              </button>

              <GoogleDivider />
              <GoogleButton darkMode={darkMode} onClick={handleGoogle} loading={isGoogleSubmitting} label="Sign Up with Google" />
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const GoogleDivider: React.FC = () => (
  <div className="relative my-4 text-center">
    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-slate-800" /></div>
    <span className="relative px-2 text-[10px] text-gray-400 bg-white dark:bg-slate-900">OR</span>
  </div>
);

const GoogleButton: React.FC<{ darkMode: boolean; onClick: () => void; loading: boolean; label?: string }> = ({
  darkMode, onClick, loading, label = 'Continue with Google'
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    className={`w-full py-2 rounded-xl border font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
      darkMode ? 'border-slate-700 bg-slate-800 hover:bg-slate-700' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
    }`}
  >
    <svg className="w-4 h-4" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.6 4.5-5.9 7.7-11.3 7.7-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 3.1l5.4-5.4C34.5 5.5 29.5 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5 44.5 35.3 44.5 24c0-1.2-.1-2.4-.3-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6 4.4C13.9 15.6 18.6 12.5 24 12.5c3.1 0 5.9 1.1 8 3.1l5.4-5.4C34.5 6.5 29.5 4.5 24 4.5c-7.6 0-14.1 4.3-17.7 10.2z"/>
      <path fill="#4CAF50" d="M24 44.5c5.4 0 10.3-1.9 14-5.4l-6.4-5.3c-2 1.4-4.6 2.2-7.6 2.2-5.3 0-9.8-3.4-11.4-8.1l-6.2 4.8C9.9 39.5 16.4 44.5 24 44.5z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.2-2.2 4.1-4 5.5l6.4 5.3C40.9 36.1 44.5 30.8 44.5 24c0-1.2-.1-2.4-.3-3.5z"/>
    </svg>
    {loading ? 'Connecting...' : label}
  </button>
);
