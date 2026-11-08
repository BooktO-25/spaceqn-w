import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Tv,
  FolderOpen,
  ListMusic,
  PlaySquare,
  ShieldCheck,
  User,
  Users,
  AlertTriangle,
  Bell,
  BellOff,
  Rocket
} from 'lucide-react';
import { roleLabel } from '../lib/permissions';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onlineCount: number;
  totalDevicesCount: number;
  staleCount: number;
  darkMode: boolean;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
  /** Mobile-only slide-out drawer state — always visible on desktop
   * regardless of these. */
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onlineCount,
  totalDevicesCount,
  staleCount,
  darkMode,
  notificationsEnabled,
  onToggleNotifications,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { userProfile, openAuthModal } = useAuth();

  const handleSelectTab = (tab: string) => {
    onSelectTab(tab);
    onCloseMobile?.(); // picking a section also closes the mobile drawer
  };

  const managementItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { 
      id: 'businesses', 
      label: userProfile?.role === 'BUSINESS_OWNER' ? 'My Business & Locations' : 'Businesses & Tenants', 
      icon: Building2 
    },
    { id: 'devices', label: 'Devices', icon: Tv, badge: `${onlineCount}/${totalDevicesCount}`, alertBadge: staleCount > 0 ? staleCount : undefined },
    ...(userProfile?.role === 'BUSINESS_OWNER' || userProfile?.role === 'SUPER_ADMIN' || userProfile?.role === 'REGIONAL_ADMIN'
      ? [{ id: 'announcement', label: 'Announcement', icon: Rocket }]
      : []),
    { id: 'team', label: 'Team', icon: Users },
  ];

  const studioItems = [
    { id: 'content', label: 'Media Assets', icon: FolderOpen },
    { id: 'playlists', label: 'Playlists', icon: ListMusic },
  ];

  const systemItems = [
    { id: 'player', label: 'Live Edge Player', icon: PlaySquare },
  ];

  return (
    <>
      {/* Backdrop — mobile only, tap to close */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
        />
      )}
      <aside className={`w-64 border-r flex flex-col justify-between shrink-0 transition-colors select-none
        fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:static md:translate-x-0 md:z-auto
        ${
        darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-gray-200 text-gray-700'
      }`}>
      {/* Brand & Nav Header */}
      <div>
        <div className={`p-5 border-b flex items-center gap-3 ${
          darkMode ? 'border-slate-800' : 'border-gray-100'
        }`}>
          <div className="w-8 h-8 bg-black dark:bg-white rounded flex items-center justify-center shadow-sm">
            <div className="w-4 h-4 border-2 border-white dark:border-black rounded-sm rotate-45" />
          </div>
          <div>
            <span className={`font-bold text-xl tracking-tight ${darkMode ? 'text-white' : 'text-black'}`}>
              SPACEQ<span className="text-rose-500">.</span>
            </span>
            <p className="text-[10px] text-gray-400 font-medium -mt-1">Display OS Enterprise</p>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="p-4 space-y-5">
          {/* Management Group */}
          <div>
            <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Management
            </div>
            <div className="mt-1 space-y-1">
              {managementItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium text-xs transition-all ${
                      isActive
                        ? darkMode
                          ? 'bg-slate-800 text-white font-semibold'
                          : 'bg-gray-100 text-black font-semibold'
                        : darkMode
                          ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {item.alertBadge !== undefined && (
                        <span className="flex items-center gap-1 bg-rose-500/15 text-rose-500 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          <AlertTriangle className="w-2.5 h-2.5" /> {item.alertBadge}
                        </span>
                      )}
                      {item.badge && (
                        <span className="bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Studio Group */}
          <div>
            <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Studio & Content
            </div>
            <div className="mt-1 space-y-1">
              {studioItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium text-xs transition-all ${
                      isActive
                        ? darkMode
                          ? 'bg-slate-800 text-white font-semibold'
                          : 'bg-gray-100 text-black font-semibold'
                        : darkMode
                          ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* System & Specs Group */}
          <div>
            <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              System Telemetry
            </div>
            <div className="mt-1 space-y-1">
              {systemItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium text-xs transition-all ${
                      isActive
                        ? darkMode
                          ? 'bg-slate-800 text-white font-semibold'
                          : 'bg-gray-100 text-black font-semibold'
                        : darkMode
                          ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      </div>

      {/* User Profile Card Footer */}
      <div className={`p-4 border-t space-y-2 ${darkMode ? 'border-slate-800' : 'border-gray-100'}`}>
        <button
          onClick={onToggleNotifications}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold transition-colors ${
            notificationsEnabled
              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
              : darkMode ? 'bg-slate-800/70 text-slate-400 border border-slate-700/60' : 'bg-gray-50 text-gray-500 border border-gray-200'
          }`}
        >
          {notificationsEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          {notificationsEnabled ? 'Offline Alerts On' : 'Enable Offline Alerts'}
        </button>

        <button
          onClick={openAuthModal}
          className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl transition-all cursor-pointer ${
            darkMode ? 'bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60' : 'bg-gray-50 hover:bg-gray-100 border border-gray-200/80'
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 to-indigo-600 shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="overflow-hidden flex-1">
            <p className={`text-xs font-semibold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {userProfile?.displayName || 'User Profile'}
            </p>
            <p className="text-[10px] text-gray-500 truncate capitalize flex items-center gap-1">
              {userProfile?.role === 'SUPER_ADMIN' ? (
                <ShieldCheck className="w-3 h-3 text-rose-500" />
              ) : (
                <User className="w-3 h-3 text-blue-500" />
              )}
              <span>{roleLabel(userProfile?.role)}</span>
            </p>
          </div>
        </button>
      </div>
    </aside>
    </>
  );
};


