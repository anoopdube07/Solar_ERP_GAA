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
    <div id="auth-container" className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <Sun className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Solar ERP</h1>
            <p className="text-xs text-slate-400 font-medium">Lead Team Module • Version 8</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isFirstRun ? (
            <>
              <div className="mb-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold rounded-full mb-2">
                  <Shield className="w-3.5 h-3.5" /> First-Run Owner Setup
                </div>
                <p className="text-xs text-slate-400">
                  No accounts exist in the database. Initialize the system by configuring the primary Owner.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rajesh Sharma"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Owner Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. owner"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            id="auth-submit-button"
            className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            {loading ? (
              'Authenticating...'
            ) : isFirstRun ? (
              <>
                Create Owner & Initialize System <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                Sign In to Workspace <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Role Tester Pills */}
        {!isFirstRun && (
          <div className="mt-8 pt-6 border-t border-slate-700/60">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Quick Test Switcher (Seed Accounts)
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('owner', 'OWNER')}
                className="p-2 bg-slate-900/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-left transition-colors text-slate-300 flex items-center justify-between"
              >
                <span>👑 Owner</span>
                <span className="text-[10px] text-amber-400">owner</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('manager', 'MANAGER')}
                className="p-2 bg-slate-900/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-left transition-colors text-slate-300 flex items-center justify-between"
              >
                <span>📊 Manager</span>
                <span className="text-[10px] text-amber-400">manager</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('lead1', 'LEAD')}
                className="p-2 bg-slate-900/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-left transition-colors text-slate-300 flex items-center justify-between"
              >
                <span>⚡ Lead Team 1</span>
                <span className="text-[10px] text-amber-400">lead1</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('lead2', 'LEAD')}
                className="p-2 bg-slate-900/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-left transition-colors text-slate-300 flex items-center justify-between"
              >
                <span>⚡ Lead Team 2</span>
                <span className="text-[10px] text-amber-400">lead2</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('instmgr', 'INSTALLATION_MANAGER')}
                className="p-2 bg-slate-900/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-left transition-colors text-slate-300 flex items-center justify-between"
              >
                <span>🛠️ Inst Mgr</span>
                <span className="text-[10px] text-blue-400">instmgr</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('instmember', 'INSTALLATION_MEMBER')}
                className="p-2 bg-slate-900/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-left transition-colors text-slate-300 flex items-center justify-between"
              >
                <span>👷 Inst Member</span>
                <span className="text-[10px] text-blue-400">instmember</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('reg1', 'REGISTRATION')}
                className="p-2 bg-slate-900/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-left transition-colors text-slate-300 flex items-center justify-between"
              >
                <span>📋 Registration</span>
                <span className="text-[10px] text-emerald-400">reg1</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('accounts', 'ACCOUNTS')}
                className="p-2 bg-slate-900/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-left transition-colors text-slate-300 flex items-center justify-between"
              >
                <span>💰 Accounts</span>
                <span className="text-[10px] text-emerald-400">accounts</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('dispatch', 'DISPATCH')}
                className="p-2 bg-slate-900/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-left transition-colors text-slate-300 flex items-center justify-between"
              >
                <span>🚚 Dispatch Team</span>
                <span className="text-[10px] text-amber-400">dispatch</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 text-center">
              Password for all seeded accounts: <code className="text-slate-300">Solar@123</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
