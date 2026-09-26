import React, { useState } from 'react';
import { Shield, Sun, User as UserIcon, Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiRequest, setAuthToken } from '../lib/api';
import { User } from '../../shared/types';

interface AuthModalProps {
  isInitialized: boolean;
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isInitialized, onSuccess }) => {
  const [isFirstRun, setIsFirstRun] = useState(!isInitialized);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isFirstRun) {
        const res = await apiRequest('/api/auth/first-run-setup', {
          method: 'POST',
          body: JSON.stringify({
            name,
            username,
            password,
            confirm_password: confirmPassword,
          }),
        });
        if (res?.sessionId) setAuthToken(res.sessionId);
        onSuccess(res.user);
      } else {
        const res = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        });
        if (res?.sessionId) setAuthToken(res.sessionId);
        onSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (uname: string, role?: string) => {
    setUsername(uname);
    setPassword('Solar@123');
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest('/api/auth/quick-login', {
        method: 'POST',
        body: JSON.stringify({ username: uname, role }),
      });
      if (res?.sessionId) {
        setAuthToken(res.sessionId);
      }
      onSuccess(res.user);
    } catch (err: any) {
      try {
        const loginRes = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: uname, password: 'Solar@123' }),
        });
        if (loginRes?.sessionId) {
          setAuthToken(loginRes.sessionId);
        }
        onSuccess(loginRes.user);
      } catch (innerErr: any) {
        setError(innerErr.message || err.message || 'Quick login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="auth-container"
      className="min-h-screen bg-slate-50 relative flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden"
    >
      {/* Subtle ambient solar radial gradient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-100/40 via-slate-50 to-slate-100/60 -z-10 pointer-events-none" />

      <div className="w-full max-w-md">
        {/* Main Light Theme Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 relative">
          {/* Brand Header */}
          <div className="flex items-center gap-3.5 mb-6 pb-5 border-b border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-600 shadow-2xs shrink-0">
              <Sun className="w-6 h-6 fill-amber-400/40 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Solar ERP</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  v8
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Lead Team Module • Enterprise Suite
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs font-semibold animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isFirstRun ? (
              <>
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="inline-flex items-center gap-1.5 text-amber-900 text-xs font-bold mb-1">
                    <Shield className="w-3.5 h-3.5 text-amber-600" /> First-Run Owner Setup
                  </div>
                  <p className="text-xs text-amber-800/90 leading-relaxed">
                    No accounts exist in the database. Initialize the system by configuring the primary Owner account.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Owner Username
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. owner"
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-2xs"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-2xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-2xs"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              id="auth-submit-button"
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-md shadow-amber-500/20 hover:shadow-lg hover:shadow-amber-500/30 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : isFirstRun ? (
                <>
                  <span>Create Owner & Initialize System</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Role Tester Pills */}
          {!isFirstRun && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Quick Test Switcher
                </p>
                <span className="text-[11px] text-slate-400 font-medium">Click to auto-fill</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('owner', 'OWNER')}
                  className="p-2.5 bg-slate-50 hover:bg-amber-50/70 border border-slate-200/80 hover:border-amber-300/80 rounded-xl text-left transition-all text-slate-700 hover:text-slate-900 flex items-center justify-between group shadow-2xs active:scale-[0.98] cursor-pointer"
                >
                  <span className="font-semibold text-xs">👑 Owner</span>
                  <span className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-amber-800 bg-white group-hover:bg-amber-100/70 border border-slate-200/70 group-hover:border-amber-200/80 px-1.5 py-0.5 rounded-md transition-colors">
                    owner
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('manager', 'MANAGER')}
                  className="p-2.5 bg-slate-50 hover:bg-amber-50/70 border border-slate-200/80 hover:border-amber-300/80 rounded-xl text-left transition-all text-slate-700 hover:text-slate-900 flex items-center justify-between group shadow-2xs active:scale-[0.98] cursor-pointer"
                >
                  <span className="font-semibold text-xs">📊 Manager</span>
                  <span className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-amber-800 bg-white group-hover:bg-amber-100/70 border border-slate-200/70 group-hover:border-amber-200/80 px-1.5 py-0.5 rounded-md transition-colors">
                    manager
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('lead1', 'LEAD')}
                  className="p-2.5 bg-slate-50 hover:bg-amber-50/70 border border-slate-200/80 hover:border-amber-300/80 rounded-xl text-left transition-all text-slate-700 hover:text-slate-900 flex items-center justify-between group shadow-2xs active:scale-[0.98] cursor-pointer"
                >
                  <span className="font-semibold text-xs">⚡ Lead Team 1</span>
                  <span className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-amber-800 bg-white group-hover:bg-amber-100/70 border border-slate-200/70 group-hover:border-amber-200/80 px-1.5 py-0.5 rounded-md transition-colors">
                    lead1
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('lead2', 'LEAD')}
                  className="p-2.5 bg-slate-50 hover:bg-amber-50/70 border border-slate-200/80 hover:border-amber-300/80 rounded-xl text-left transition-all text-slate-700 hover:text-slate-900 flex items-center justify-between group shadow-2xs active:scale-[0.98] cursor-pointer"
                >
                  <span className="font-semibold text-xs">⚡ Lead Team 2</span>
                  <span className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-amber-800 bg-white group-hover:bg-amber-100/70 border border-slate-200/70 group-hover:border-amber-200/80 px-1.5 py-0.5 rounded-md transition-colors">
                    lead2
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('instmgr', 'INSTALLATION_MANAGER')}
                  className="p-2.5 bg-slate-50 hover:bg-blue-50/70 border border-slate-200/80 hover:border-blue-300/80 rounded-xl text-left transition-all text-slate-700 hover:text-slate-900 flex items-center justify-between group shadow-2xs active:scale-[0.98] cursor-pointer"
                >
                  <span className="font-semibold text-xs">🛠️ Inst Mgr</span>
                  <span className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-blue-700 bg-white group-hover:bg-blue-100/70 border border-slate-200/70 group-hover:border-blue-200/80 px-1.5 py-0.5 rounded-md transition-colors">
                    instmgr
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('instmember', 'INSTALLATION_MEMBER')}
                  className="p-2.5 bg-slate-50 hover:bg-blue-50/70 border border-slate-200/80 hover:border-blue-300/80 rounded-xl text-left transition-all text-slate-700 hover:text-slate-900 flex items-center justify-between group shadow-2xs active:scale-[0.98] cursor-pointer"
                >
                  <span className="font-semibold text-xs">👷 Inst Member</span>
                  <span className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-blue-700 bg-white group-hover:bg-blue-100/70 border border-slate-200/70 group-hover:border-blue-200/80 px-1.5 py-0.5 rounded-md transition-colors">
                    instmember
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('reg1', 'REGISTRATION')}
                  className="p-2.5 bg-slate-50 hover:bg-emerald-50/70 border border-slate-200/80 hover:border-emerald-300/80 rounded-xl text-left transition-all text-slate-700 hover:text-slate-900 flex items-center justify-between group shadow-2xs active:scale-[0.98] cursor-pointer"
                >
                  <span className="font-semibold text-xs">📋 Registration</span>
                  <span className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-emerald-700 bg-white group-hover:bg-emerald-100/70 border border-slate-200/70 group-hover:border-emerald-200/80 px-1.5 py-0.5 rounded-md transition-colors">
                    reg1
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('accounts', 'ACCOUNTS')}
                  className="p-2.5 bg-slate-50 hover:bg-emerald-50/70 border border-slate-200/80 hover:border-emerald-300/80 rounded-xl text-left transition-all text-slate-700 hover:text-slate-900 flex items-center justify-between group shadow-2xs active:scale-[0.98] cursor-pointer"
                >
                  <span className="font-semibold text-xs">💰 Accounts</span>
                  <span className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-emerald-700 bg-white group-hover:bg-emerald-100/70 border border-slate-200/70 group-hover:border-emerald-200/80 px-1.5 py-0.5 rounded-md transition-colors">
                    accounts
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('dispatch', 'DISPATCH')}
                  className="p-2.5 bg-slate-50 hover:bg-amber-50/70 border border-slate-200/80 hover:border-amber-300/80 rounded-xl text-left transition-all text-slate-700 hover:text-slate-900 flex items-center justify-between group shadow-2xs active:scale-[0.98] cursor-pointer"
                >
                  <span className="font-semibold text-xs">🚚 Dispatch Team</span>
                  <span className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-amber-800 bg-white group-hover:bg-amber-100/70 border border-slate-200/70 group-hover:border-amber-200/80 px-1.5 py-0.5 rounded-md transition-colors">
                    dispatch
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('service1', 'SERVICE')}
                  className="p-2.5 bg-slate-50 hover:bg-amber-50/70 border border-slate-200/80 hover:border-amber-300/80 rounded-xl text-left transition-all text-slate-700 hover:text-slate-900 flex items-center justify-between group shadow-2xs active:scale-[0.98] cursor-pointer"
                >
                  <span className="font-semibold text-xs">🎧 Service Desk</span>
                  <span className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-amber-800 bg-white group-hover:bg-amber-100/70 border border-slate-200/70 group-hover:border-amber-200/80 px-1.5 py-0.5 rounded-md transition-colors">
                    service1
                  </span>
                </button>
              </div>

              <p className="text-[11px] text-slate-500 mt-3 text-center">
                Default password for all seeded accounts:{' '}
                <code className="font-mono font-semibold text-slate-700 bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded">
                  Solar@123
                </code>
              </p>
            </div>
          )}
        </div>

        {/* Footer brand note */}
        <div className="mt-5 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <Sun className="w-3.5 h-3.5 text-amber-500/80" />
          <span>Solar ERP Enterprise Solutions</span>
          <span>•</span>
          <span>Brighter Homes. Greener Tomorrow.</span>
        </div>
      </div>
    </div>
  );
};
