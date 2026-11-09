import React from 'react';
import { Business, Location } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  MapPin, 
  Sun, 
  Moon, 
  Play, 
  Plus,
  User,
  ShieldCheck,
  Database,
  Menu,
  FileText
} from 'lucide-react';

interface HeaderProps {
  businesses: Business[];
  selectedBusiness: Business;
  onSelectBusiness: (biz: Business) => void;
  locations: Location[];
  selectedLocationId: string;
  onSelectLocationId: (locId: string) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenLivePlayer: () => void;
  activeTab: string;
  onOpenMobileNav?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  businesses,
  selectedBusiness,
  onSelectBusiness,
  locations,
  selectedLocationId,
  onSelectLocationId,
  darkMode,
  onToggleDarkMode,
  onOpenLivePlayer,
  activeTab,
  onOpenMobileNav,
}) => {
  const { userProfile, openAuthModal } = useAuth();
  const filteredLocations = locations.filter(l => l.businessId === selectedBusiness.id);

  return (
    <header className={`h-16 border-b px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors ${
      darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-gray-200 text-gray-900'
    }`}>
      {/* Title & Network Status Subtitle */}
      <div className="flex items-center gap-3 sm:gap-6 min-w-0">
        {onOpenMobileNav && (
          <button
            onClick={onOpenMobileNav}
            className={`md:hidden p-2 -ml-2 rounded-lg shrink-0 ${darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-gray-100 text-gray-600'}`}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight flex items-center gap-2">
            {userProfile?.role === 'BUSINESS_OWNER' ? (
              <>
                <span>{selectedBusiness.name} Portal</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  Tenant
                </span>
              </>
            ) : (
              <>
                <span>Super Admin Portal</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  Global
                </span>
              </>
            )}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Database className="w-3 h-3 text-emerald-500" />
            <span>Firestore Sync: <span className="text-emerald-500 font-semibold">Online</span></span>
          </p>
        </div>

        <div className="h-6 w-[1px] bg-gray-200 dark:bg-slate-800 hidden md:block" />

        {/* Business Selector */}
        <div className="hidden md:flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400" />
          {userProfile?.role === 'BUSINESS_OWNER' ? (
            <div className={`text-xs font-semibold rounded-lg px-3 py-1.5 border flex items-center gap-2 ${
              darkMode 
                ? 'bg-slate-800/80 border-slate-700 text-slate-200' 
                : 'bg-gray-100 border-gray-200 text-gray-800'
            }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{selectedBusiness.name}</span>
            </div>
          ) : (
            <select
              value={selectedBusiness.id}
              onChange={(e) => {
                const biz = businesses.find(b => b.id === e.target.value);
                if (biz) onSelectBusiness(biz);
              }}
              className={`text-xs font-semibold rounded-lg px-3 py-1.5 border outline-none cursor-pointer transition-colors ${
                darkMode 
                  ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-rose-500' 
                  : 'bg-gray-50 border-gray-200 text-gray-800 focus:border-black'
              }`}
            >
              {businesses.map((biz) => (
                <option key={biz.id} value={biz.id}>
                  {biz.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Location Selector */}
        {filteredLocations.length > 0 && (
          <div className="hidden lg:flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <select
              value={selectedLocationId}
              onChange={(e) => onSelectLocationId(e.target.value)}
              className={`text-xs font-medium rounded-lg px-3 py-1.5 border outline-none cursor-pointer transition-colors ${
                darkMode 
                  ? 'bg-slate-800 border-slate-700 text-slate-300' 
                  : 'bg-gray-50 border-gray-200 text-gray-700'
              }`}
            >
              <option value="ALL">All Locations ({filteredLocations.length})</option>
              {filteredLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.city})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right Action Controls */}
      <div className="flex items-center gap-3">
        {/* User Role Account Button */}
        <button
          onClick={openAuthModal}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
            darkMode ? 'bg-slate-800 border-slate-700 text-white hover:border-rose-500' : 'bg-gray-50 border-gray-200 text-gray-800 hover:border-black'
          }`}
        >
          {userProfile?.role === 'SUPER_ADMIN' ? (
            <ShieldCheck className="w-4 h-4 text-rose-500" />
          ) : (
            <User className="w-4 h-4 text-blue-500" />
          )}
          <span className="hidden sm:inline max-w-[120px] truncate">{userProfile?.displayName || 'Sign In'}</span>
          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
            userProfile?.role === 'SUPER_ADMIN' ? 'bg-rose-500 text-white' : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300'
          }`}>
            {userProfile?.role === 'SUPER_ADMIN' ? 'Admin' : 'Owner'}
          </span>
        </button>

        {/* Public rate card — available to signed-in and public visitors */}
        <a
          href="/rate-card"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${darkMode ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-gray-200 text-gray-700 hover:bg-gray-100'}`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Rate Card</span>
        </a>

        {/* Quick Launch Player */}
        <button
          onClick={onOpenLivePlayer}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span className="hidden sm:inline">Player</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleDarkMode}
          className={`p-2 rounded-lg border transition-colors ${
            darkMode 
              ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700' 
              : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
          }`}
          title="Toggle Theme"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};


