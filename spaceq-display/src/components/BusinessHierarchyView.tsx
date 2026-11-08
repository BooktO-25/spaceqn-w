import React, { useState } from 'react';
import { Business, Location, Device } from '../types';
import { useAuth } from '../context/AuthContext';
import { Building2, MapPin, Tv, Plus, Check, ChevronRight, ShieldAlert } from 'lucide-react';

interface BusinessHierarchyViewProps {
  businesses: Business[];
  locations: Location[];
  devices: Device[];
  selectedBusiness: Business;
  onSelectBusiness: (biz: Business) => void;
  onAddBusiness: (name: string, brandColor: string) => void;
  onAddLocation: (businessId: string, name: string, city: string, address: string) => void;
  darkMode: boolean;
}

export const BusinessHierarchyView: React.FC<BusinessHierarchyViewProps> = ({
  businesses,
  locations,
  devices,
  selectedBusiness,
  onSelectBusiness,
  onAddBusiness,
  onAddLocation,
  darkMode,
}) => {
  const { userProfile } = useAuth();
  const isBusinessOwner = userProfile?.role === 'BUSINESS_OWNER';

  const [showBizModal, setShowBizModal] = useState(false);
  const [showLocModal, setShowLocModal] = useState(false);

  const [newBizName, setNewBizName] = useState('');
  const [newBizColor, setNewBizColor] = useState('#E11D48');

  const [newLocName, setNewLocName] = useState('');
  const [newLocCity, setNewLocCity] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');

  const currentLocations = locations.filter(l => l.businessId === selectedBusiness.id);

  const handleCreateBusiness = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBizName.trim()) return;
    onAddBusiness(newBizName, newBizColor);
    setNewBizName('');
    setShowBizModal(false);
  };

  const handleCreateLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim() || !newLocCity.trim()) return;
    onAddLocation(selectedBusiness.id, newLocName, newLocCity, newLocAddress || 'Main Street');
    setNewLocName('');
    setNewLocCity('');
    setNewLocAddress('');
    setShowLocModal(false);
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {isBusinessOwner ? `${selectedBusiness.name} Locations` : 'Business & Location Hierarchy'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isBusinessOwner 
              ? `Manage location branches and active displays for ${selectedBusiness.name}.`
              : 'Multi-tenant SaaS organization structure. Businesses contain Locations, which contain Smart TV Displays.'
            }
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isBusinessOwner && (
            <button
              onClick={() => setShowBizModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Business
            </button>
          )}
          <button
            onClick={() => setShowLocModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Location
          </button>
        </div>
      </div>

      {isBusinessOwner && (
        <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/10 flex items-center gap-3 text-xs text-blue-500 font-medium">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Tenant Isolation Active: You are logged in as the Business Owner for <strong>{selectedBusiness.name}</strong>. Cross-tenant businesses are hidden for security.</span>
        </div>
      )}

      {/* Business Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {businesses.map((biz) => {
          const isSelected = biz.id === selectedBusiness.id;
          const bizLocs = locations.filter(l => l.businessId === biz.id);
          const bizDevs = devices.filter(d => d.businessId === biz.id);

          return (
            <div
              key={biz.id}
              onClick={() => onSelectBusiness(biz)}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                isSelected
                  ? 'border-black dark:border-white bg-gray-50 dark:bg-slate-800/80 ring-2 ring-black/10 dark:ring-white/10'
                  : darkMode
                    ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    : 'bg-white border-gray-100 hover:border-gray-300 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: biz.brandColor || '#E11D48' }}
                  >
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold">{biz.name}</h3>
                    <p className="text-[10px] text-slate-400 font-mono">/{biz.slug}</p>
                  </div>
                </div>

                {isSelected && (
                  <span className="p-1 rounded-full bg-rose-500 text-white">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>{bizLocs.length} Locations</span>
                <span>{bizDevs.length} Devices</span>
                <span>{biz.totalStorageUsedMb.toFixed(0)} MB</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Business Detail View */}
      <div className={`p-6 rounded-2xl border space-y-6 ${
        darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: selectedBusiness.brandColor || '#E11D48' }}
            >
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{selectedBusiness.name}</h2>
              <p className="text-xs text-slate-400">
                Created on {new Date(selectedBusiness.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <span className="text-xs font-mono px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
            Tenant ID: {selectedBusiness.id}
          </span>
        </div>

        {/* Locations List under selected business */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Assigned Locations ({currentLocations.length})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentLocations.map((loc) => {
              const locDevices = devices.filter(d => d.locationId === loc.id);

              return (
                <div
                  key={loc.id}
                  className={`p-4 rounded-xl border space-y-3 ${
                    darkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-rose-500" />
                      <h4 className="text-sm font-bold">{loc.name}</h4>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {loc.city}, {loc.country}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">{loc.address}</p>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Tv className="w-3.5 h-3.5" /> {locDevices.length} Connected Displays
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      {locDevices.filter(d => d.status === 'ONLINE').length} Online
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Business Modal */}
      {showBizModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-2xl border space-y-4 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <h3 className="text-base font-bold">Create New Business Tenant</h3>
            <form onSubmit={handleCreateBusiness} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Business Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metro Coffee House"
                  value={newBizName}
                  onChange={(e) => setNewBizName(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border outline-none ${
                    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Brand Theme Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newBizColor}
                    onChange={(e) => setNewBizColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                  />
                  <span className="font-mono text-slate-400">{newBizColor}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBizModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold"
                >
                  Create Business
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Location Modal */}
      {showLocModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-2xl border space-y-4 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <h3 className="text-base font-bold">Add Location to {selectedBusiness.name}</h3>
            <form onSubmit={handleCreateLocation} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Branch / Location Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nellore Branch"
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border outline-none ${
                    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">City</label>
                  <input
                    type="text"
                    required
                    placeholder="Nellore"
                    value={newLocCity}
                    onChange={(e) => setNewLocCity(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border outline-none ${
                      darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Street Address</label>
                  <input
                    type="text"
                    placeholder="12 Main Rd"
                    value={newLocAddress}
                    onChange={(e) => setNewLocAddress(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border outline-none ${
                      darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLocModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold"
                >
                  Save Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
