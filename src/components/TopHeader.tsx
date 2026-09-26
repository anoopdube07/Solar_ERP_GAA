import React, { useState, useEffect } from 'react';
import {
  Sun,
  Bell,
  Menu,
  ChevronDown,
  LogOut,
  Users,
  Settings,
  Shield,
} from 'lucide-react';
import { User, UserRole } from '../../shared/types';
import { formatToIST } from '../../shared/timezone';

interface TopHeaderProps {
  currentUser: User;
  onLogout: () => void;
  onOpenSettings?: () => void;
  onSwitchUser: (username: string, role?: string) => void;
  onToggleMobileSidebar: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentUser,
  onLogout,
  onOpenSettings,
  onSwitchUser,
  onToggleMobileSidebar,
}) => {
  const [currentTime, setCurrentTime] = useState(formatToIST(new Date(), true));
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(formatToIST(new Date(), true));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'OWNER':
        return 'System Owner';
      case 'MANAGER':
        return 'Sales Manager';
      case 'LEAD':
        return 'Lead Team';
      case 'INSTALLATION_MANAGER':
        return 'Installation Manager';
      case 'INSTALLATION_MEMBER':
        return 'Field Technician';
      case 'REGISTRATION':
        return 'Registration Team';
      case 'ACCOUNTS':
        return 'Accounts Team';
      case 'DISPATCH':
        return 'Dispatch Team';
      case 'SERVICE':
        return 'After-Sales & Service';
      default:
        return role;
    }
  };

  const getInitials = (name: string, role: string) => {
    if (role === 'LEAD') return 'L1';
    if (role === 'OWNER') return 'SO';
    if (role === 'MANAGER') return 'SM';
    if (role === 'INSTALLATION_MANAGER') return 'IM';
    if (role === 'REGISTRATION') return 'RG';
    if (role === 'ACCOUNTS') return 'AC';
    if (role === 'DISPATCH') return 'DP';
    if (role === 'SERVICE') return 'SV';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left side: Mobile menu toggle & Logo info */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
            <Sun className="w-4 h-4 fill-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm tracking-tight">Solar ERP</span>
              <span className="hidden sm:inline-block text-slate-300">|</span>
              <span className="hidden sm:inline-block text-xs text-slate-500 font-medium">
                Brighter Homes. Greener Tomorrow.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Time, Notifications & User avatar pill */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Date and Time (IST) */}
        <div className="hidden md:flex items-center text-xs text-slate-500 font-medium bg-slate-50 border border-slate-200/60 px-3 py-1.5 rounded-xl">
          <span>{currentTime} (IST)</span>
        </div>

        {/* Notification Bell */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            3
          </span>
        </button>

        {/* Quick Settings Shortcut - ONLY for System Owner */}
        {onOpenSettings && currentUser.role === 'OWNER' && (
          <button
            type="button"
            onClick={onOpenSettings}
            title="Configure Custom Lead Form Fields & System Settings"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Settings & Masters</span>
          </button>
        )}

        {/* User Pill with Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all text-left"
          >
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
              {getInitials(currentUser.name, currentUser.role)}
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-bold text-slate-800 leading-tight">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-slate-500">{getRoleLabel(currentUser.role)}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {/* User Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1">
              <div className="px-3.5 py-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-800">{currentUser.name}</p>
                <p className="text-[11px] text-slate-500">@{currentUser.username}</p>
                <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded-md border border-blue-100">
                  {getRoleLabel(currentUser.role)}
                </span>
              </div>

              {/* Quick Role / User Switching for convenience in testing */}
              <div className="px-3.5 py-2 border-b border-slate-100">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>Switch User Role</span>
                </p>
                <div className="space-y-1">
                  {[
                    { u: 'lead1', role: 'LEAD', label: 'Lead User 1 (Lead Team)' },
                    { u: 'manager', role: 'MANAGER', label: 'Sales Manager' },
                    { u: 'owner', role: 'OWNER', label: 'System Owner' },
                    { u: 'instmgr', role: 'INSTALLATION_MANAGER', label: 'Installation Manager' },
                    { u: 'instmember', role: 'INSTALLATION_MEMBER', label: 'Installation Crew Lead' },
                    { u: 'reg1', role: 'REGISTRATION', label: 'Registration Team' },
                    { u: 'accounts', role: 'ACCOUNTS', label: 'Accounts Team (Receipts & Follow-ups)' },
                    { u: 'dispatch', role: 'DISPATCH', label: 'Dispatch Team (Logistics & Shipments)' },
                    { u: 'service1', role: 'SERVICE', label: 'After-Sales & Service Desk' },
                  ].map((item) => (
                    <button
                      key={item.u}
                      onClick={() => {
                        onSwitchUser(item.u, item.role);
                        setShowUserMenu(false);
                      }}
                      className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                        currentUser.username === item.u
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {onOpenSettings && currentUser.role === 'OWNER' && (
                <button
                  onClick={() => {
                    onOpenSettings();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  <span>Master Settings</span>
                </button>
              )}

              <button
                onClick={() => {
                  onLogout();
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors border-t border-slate-100"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
