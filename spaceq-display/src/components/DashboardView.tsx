import React, { useState } from 'react';
import { Business, Location, Device, ContentItem, ActivityLog } from '../types';
import { 
  Tv, 
  ArrowUpRight, 
  Search,
  Filter,
  MoreVertical,
  Activity,
  Plus
} from 'lucide-react';

interface DashboardViewProps {
  businesses: Business[];
  locations: Location[];
  devices: Device[];
  contents: ContentItem[];
  activities: ActivityLog[];
  selectedBusiness: Business;
  darkMode: boolean;
  onNavigateToDevices: () => void;
  onNavigateToContent: () => void;
  onNavigateToPlaylists: () => void;
  onPairNewDevice: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  businesses,
  locations,
  devices,
  contents,
  activities,
  selectedBusiness,
  darkMode,
  onNavigateToDevices,
  onNavigateToContent,
  onNavigateToPlaylists,
  onPairNewDevice,
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  const filteredLocations = locations.filter(l => l.businessId === selectedBusiness.id);
  const filteredDevices = devices.filter(d => d.businessId === selectedBusiness.id);
  const onlineDevices = filteredDevices.filter(d => d.status === 'ONLINE');
  const offlineDevices = filteredDevices.filter(d => d.status === 'OFFLINE');

  const displayedDevices = filteredDevices.filter(d => 
    d.name.toLowerCase().includes(filterQuery.toLowerCase()) || 
    d.ipAddress.includes(filterQuery)
  );

  return (
    <div className={`p-6 lg:p-8 space-y-8 min-h-full transition-colors ${
      darkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#F8F9FA] text-[#111827]'
    }`}>
      
      {/* 4 Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
        {/* Active Displays */}
        <div className={`p-5 rounded-2xl border shadow-sm transition-colors ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'
        }`}>
          <p className="text-xs text-gray-500 font-medium mb-1">Active Displays</p>
          <div className="flex items-end gap-2">
            <h3 className="text-2xl font-bold tracking-tight">{filteredDevices.length}</h3>
            <span className="text-[10px] text-green-600 font-bold mb-1">{onlineDevices.length} Online</span>
          </div>
          <div className="mt-3 w-full bg-gray-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-black dark:bg-white h-full transition-all" 
              style={{ width: filteredDevices.length > 0 ? `${(onlineDevices.length / filteredDevices.length) * 100}%` : '0%' }}
            />
          </div>
        </div>

        {/* Offline Warnings */}
        <div className={`p-5 rounded-2xl border shadow-sm transition-colors ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'
        }`}>
          <p className="text-xs text-gray-500 font-medium mb-1">Offline Warnings</p>
          <div className="flex items-end gap-2">
            <h3 className="text-2xl font-bold tracking-tight">{offlineDevices.length}</h3>
            <span className="text-[10px] text-red-500 font-bold mb-1">
              {offlineDevices.length > 0 ? 'Requires Action' : 'All Healthy'}
            </span>
          </div>
          <div className="mt-3 w-full bg-gray-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-red-400 h-full transition-all" 
              style={{ width: filteredDevices.length > 0 ? `${(offlineDevices.length / filteredDevices.length) * 100}%` : '0%' }}
            />
          </div>
        </div>

        {/* Locations */}
        <div className={`p-5 rounded-2xl border shadow-sm transition-colors ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'
        }`}>
          <p className="text-xs text-gray-500 font-medium mb-1">Locations</p>
          <h3 className="text-2xl font-bold tracking-tight">{filteredLocations.length}</h3>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
            <span className="text-[10px] text-gray-400 font-medium">Across {filteredLocations.length} Branches</span>
          </div>
        </div>

        {/* Storage Utilization */}
        <div className={`p-5 rounded-2xl border shadow-sm transition-colors ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'
        }`}>
          <p className="text-xs text-gray-500 font-medium mb-1">Storage Utilization</p>
          <div className="flex items-end gap-2">
            <h3 className="text-2xl font-bold uppercase tracking-tight">
              {selectedBusiness.totalStorageUsedMb ? selectedBusiness.totalStorageUsedMb.toFixed(1) : '0.0'}
              <span className="text-sm text-gray-400 font-medium ml-1">mb</span>
            </h3>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 font-medium">Total Capacity: 2.0 GB Cloud Edge</p>
        </div>
      </div>

      {/* Main Section: Live Monitors & Activity Feed */}
      <div className="flex flex-col lg:flex-row gap-6 min-h-0">
        
        {/* Device Table Container */}
        <div className={`flex-[3] rounded-2xl border shadow-sm flex flex-col overflow-hidden transition-colors ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'
        }`}>
          <div className={`p-4 border-b flex items-center justify-between ${
            darkMode ? 'border-slate-800' : 'border-gray-100'
          }`}>
            <span className="text-sm font-bold">Live Monitors</span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Filter displays..." 
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className={`text-xs px-3 py-1.5 rounded-md border outline-none w-36 transition-colors ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-gray-50 border-gray-200 text-gray-800'
                  }`}
                />
              </div>
              <button onClick={onPairNewDevice} className={`p-1.5 rounded-md transition-colors ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
                <Plus className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className={darkMode ? 'bg-slate-800/60 border-b border-slate-800' : 'bg-gray-50 border-b border-gray-100'}>
                <tr>
                  <th className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-3">Device Name</th>
                  <th className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-3">Location</th>
                  <th className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-3">Status</th>
                  <th className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-3">Health & Cache</th>
                  <th className="text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${darkMode ? 'divide-slate-800' : 'divide-gray-50'}`}>
                {displayedDevices.map((device) => {
                  const loc = locations.find(l => l.id === device.locationId);
                  const isOnline = device.status === 'ONLINE';
                  const isSyncing = device.status === 'SYNCING';

                  return (
                    <tr key={device.id} className={`transition-colors group ${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-gray-50'}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                            darkMode ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'
                          }`}>
                            <Tv className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold block">{device.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono">{device.ipAddress}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400 font-medium">
                        {loc ? `${loc.name} (${loc.city})` : 'Unassigned'}
                      </td>
                      <td className="px-6 py-4">
                        {isOnline ? (
                          <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-emerald-500/10 dark:text-emerald-400 text-[10px] font-bold border border-green-200 dark:border-emerald-500/20">
                            ONLINE
                          </span>
                        ) : isSyncing ? (
                          <span className="px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600 dark:bg-amber-500/10 dark:text-amber-400 text-[10px] font-bold border border-yellow-200 dark:border-amber-500/20">
                            SYNCING
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-rose-500/10 dark:text-rose-400 text-[10px] font-bold border border-red-200 dark:border-rose-500/20">
                            DISCONNECTED
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-24 bg-gray-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${isOnline ? 'bg-green-500' : isSyncing ? 'bg-yellow-400' : 'bg-red-400'}`} 
                            style={{ width: isOnline ? '94%' : isSyncing ? '42%' : '15%' }} 
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={onNavigateToDevices} className="text-gray-300 group-hover:text-black dark:group-hover:text-white transition-colors">
                          <ArrowUpRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Network Activity Sidebar */}
        <div className={`flex-1 rounded-2xl border shadow-sm flex flex-col min-w-0 transition-colors ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'
        }`}>
          <div className={`p-4 border-b flex items-center justify-between ${darkMode ? 'border-slate-800' : 'border-gray-100'}`}>
            <span className="text-sm font-bold">Network Activity</span>
            <span className="text-[10px] text-gray-400 font-mono">{selectedBusiness.name}</span>
          </div>

          <div className="p-5 space-y-4 overflow-hidden">
            {activities.filter(a => a.businessId === selectedBusiness.id).length > 0 ? (
              activities
                .filter(a => a.businessId === selectedBusiness.id)
                .slice(0, 4)
                .map((act) => (
                  <div key={act.id} className="flex gap-3 items-start">
                    <div className="w-1 h-8 bg-blue-500 rounded-full shrink-0 mt-0.5" />
                    <div className="overflow-hidden">
                      <p className="text-[11px] font-semibold leading-tight truncate">{act.action}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">{act.targetName} • {act.userEmail}</p>
                      <span className="text-[9px] text-gray-400 font-medium">
                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
            ) : (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-1 h-8 bg-blue-500 rounded-full shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold leading-tight">Sync Stream Established</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{selectedBusiness.name} Edge Cloud</p>
                    <span className="text-[10px] text-blue-500 font-medium">Live</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-1 h-8 bg-emerald-500 rounded-full shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold leading-tight">Media Storage Initialized</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Bucket allocated for tenant</p>
                    <span className="text-[10px] text-gray-400 font-medium">Active</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tenant Traffic Histogram */}
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-3">Edge Bandwidth ({selectedBusiness.name})</p>
              <div className="flex items-end gap-1.5 h-12">
                <div className="flex-1 bg-gray-100 dark:bg-slate-800 h-[20%] rounded-sm" />
                <div className="flex-1 bg-gray-100 dark:bg-slate-800 h-[45%] rounded-sm" />
                <div className="flex-1 bg-gray-100 dark:bg-slate-800 h-[70%] rounded-sm" />
                <div className={`flex-1 h-[100%] rounded-sm ${darkMode ? 'bg-white' : 'bg-black'}`} />
                <div className="flex-1 bg-gray-100 dark:bg-slate-800 h-[60%] rounded-sm" />
                <div className="flex-1 bg-gray-100 dark:bg-slate-800 h-[35%] rounded-sm" />
                <div className="flex-1 bg-gray-100 dark:bg-slate-800 h-[50%] rounded-sm" />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Footer Quick Status */}
      <footer className={`flex flex-col sm:flex-row justify-between items-center text-[10px] text-gray-400 pt-4 border-t shrink-0 ${
        darkMode ? 'border-slate-800' : 'border-gray-200/80'
      }`}>
        <div className="flex gap-6 mb-2 sm:mb-0">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> API Latency: 42ms
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Database: Connected
          </span>
        </div>
        <div className="font-medium">SPACEQ v1.4.2 (Production) • Cloud Managed Display OS</div>
      </footer>
    </div>
  );
};

