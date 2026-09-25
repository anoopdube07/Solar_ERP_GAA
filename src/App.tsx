import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest, setAuthToken, clearAuthToken } from './lib/api';
import { User, Lead, DashboardMetrics, Item, Uom } from '../shared/types';
import { AuthModal } from './components/AuthModal';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { DashboardView } from './components/DashboardView';
import { LeadTable } from './components/LeadTable';
import { ECPProjectsView } from './components/ECPProjectsView';
import { LeadDetailModal } from './components/LeadDetailModal';
import { CreateLeadModal } from './components/CreateLeadModal';
import { SettingsModal } from './components/SettingsModal';
import { SiteVisitsHub } from './components/SiteVisitsHub';
import { RegistrationWorkspace } from './components/RegistrationWorkspace';
import { InstallationManagerWorkspace } from './components/InstallationManagerWorkspace';
import { AccountsWorkspace } from './components/AccountsWorkspace';
import { DispatchWorkspace } from './components/DispatchWorkspace';
import { Clock, Calendar, BarChart3, Plus, ArrowLeft, LayoutDashboard, Users, Layers } from 'lucide-react';

export default function App() {
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // App workspace state
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Filtering & Modals
  const [activeCardFilter, setActiveCardFilter] = useState<string>('ALL');
  const [leadCustomerTypeFilter, setLeadCustomerTypeFilter] = useState<'ALL' | 'B2C' | 'B2B'>('ALL');
  const [projectStageFilter, setProjectStageFilter] = useState<string>('ALL');
  const [projectCustomerTypeFilter, setProjectCustomerTypeFilter] = useState<'ALL' | 'B2C' | 'B2B'>('ALL');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadInitialTab, setSelectedLeadInitialTab] = useState<
    'fields' | 'commercial' | 'documents' | 'followups' | 'site_visits' | 'credit_escalations' | 'history' | undefined
  >(undefined);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Initial Auth & Status check
  const checkAuthStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/api/auth/status');
      if (res.sessionId) {
        setAuthToken(res.sessionId);
      }
      setIsInitialized(res.initialized);
      setCurrentUser(res.user || null);
      if (res.user?.role === 'ACCOUNTS') {
        setActiveTab('accounts');
      } else if (res.user?.role === 'DISPATCH') {
        setActiveTab('dispatch');
      } else if (res.user?.role === 'REGISTRATION') {
        setActiveTab('registration');
      } else if (res.user?.role === 'INSTALLATION_MANAGER' || res.user?.role === 'INSTALLATION_MEMBER') {
        setActiveTab('installation_command');
      }
    } catch (err) {
      console.error('Failed to check auth status:', err);
      // Default to initialized so user can access login form
      setIsInitialized(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Load Workspace Data
  const loadWorkspaceData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [metricsRes, leadsRes, itemsRes, uomsRes, usersRes] = await Promise.all([
        apiRequest('/api/dashboard'),
        apiRequest('/api/leads'),
        apiRequest('/api/items'),
        apiRequest('/api/uoms'),
        apiRequest('/api/users').catch(() => ({ users: [] })), // May 403 for non-owners
      ]);

      setMetrics(metricsRes.metrics || null);
      setLeads(leadsRes.leads || []);
      setItems(itemsRes.items || []);
      setUoms(uomsRes.uoms || []);
      setAllUsers(usersRes.users || []);
    } catch (err) {
      console.error('Failed to load workspace data:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadWorkspaceData();
    }
  }, [currentUser, loadWorkspaceData]);

  // Ensure Dispatch Team role stays on its designated workspace screen
  useEffect(() => {
    if (currentUser?.role === 'DISPATCH' && activeTab !== 'dispatch') {
      setActiveTab('dispatch');
    }
  }, [currentUser?.role, activeTab]);

  // Ensure Accounts Team role stays on valid tabs (Overview or Follow-ups)
  useEffect(() => {
    if (
      currentUser?.role === 'ACCOUNTS' &&
      (activeTab === 'b2c_dispatch' || activeTab === 'b2b_credit' || activeTab === 'receipts')
    ) {
      setActiveTab('accounts');
    }
  }, [currentUser?.role, activeTab]);

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      clearAuthToken();
      setCurrentUser(null);
      setSelectedLeadId(null);
      setShowSettingsModal(false);
      setShowCreateModal(false);
    }
  };

  const handleSwitchUser = async (userIdentifier: string, roleHint?: string) => {
    try {
      const res = await apiRequest('/api/auth/quick-login', {
        method: 'POST',
        body: JSON.stringify({ username: userIdentifier, role: roleHint }),
      });
      if (res.sessionId) {
        setAuthToken(res.sessionId);
      }
      setCurrentUser(res.user);
      setSelectedLeadId(null);
      setActiveCardFilter('ALL');
      if (res.user?.role === 'ACCOUNTS') {
        setActiveTab('accounts');
      } else if (res.user?.role === 'DISPATCH') {
        setActiveTab('dispatch');
      } else if (res.user?.role === 'LEAD' && !['dashboard', 'leads', 'ecp_projects'].includes(activeTab)) {
        setActiveTab('dashboard');
      } else if (res.user?.role === 'REGISTRATION') {
        setActiveTab('registration');
      } else if (res.user?.role === 'INSTALLATION_MANAGER' || res.user?.role === 'INSTALLATION_MEMBER') {
        setActiveTab('installation_command');
      }
    } catch (err: any) {
      console.warn('Quick user switch encountered issue, attempting login fallback:', err?.message);
      try {
        const fallbackRes = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: userIdentifier, password: 'Solar@123' }),
        });
        if (fallbackRes.sessionId) {
          setAuthToken(fallbackRes.sessionId);
        }
        setCurrentUser(fallbackRes.user);
        setSelectedLeadId(null);
        setActiveCardFilter('ALL');
        if (fallbackRes.user?.role === 'ACCOUNTS') {
          setActiveTab('accounts');
        } else if (fallbackRes.user?.role === 'DISPATCH') {
          setActiveTab('dispatch');
        } else if (fallbackRes.user?.role === 'REGISTRATION') {
          setActiveTab('registration');
        } else if (fallbackRes.user?.role === 'INSTALLATION_MANAGER' || fallbackRes.user?.role === 'INSTALLATION_MEMBER') {
          setActiveTab('installation_command');
        }
      } catch (innerErr: any) {
        console.error('User switch failed:', innerErr);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
            Loading Solar ERP Workspace...
          </p>
        </div>
      </div>
    );
  }

  // If not logged in or uninitialized, show Auth Screen
  if (!currentUser || isInitialized === false) {
    return (
      <AuthModal
        isInitialized={Boolean(isInitialized)}
        onSuccess={(user) => {
          setIsInitialized(true);
          setCurrentUser(user);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans">
      {/* Fixed Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCreateLead={() => setShowCreateModal(true)}
        onOpenSettings={currentUser.role === 'OWNER' ? () => setShowSettingsModal(true) : undefined}
        currentUser={currentUser}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Workspace Frame */}
      <div className="lg:pl-64 flex-1 flex flex-col min-w-0">
        <TopHeader
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenSettings={currentUser.role === 'OWNER' ? () => setShowSettingsModal(true) : undefined}
          onSwitchUser={handleSwitchUser}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        {/* Dynamic Tab Body */}
        <main className={`flex-1 w-full mx-auto ${currentUser?.role === 'LEAD' ? 'pb-20 lg:pb-8' : ''} ${activeTab === 'dashboard' || currentUser?.role === 'ACCOUNTS' || activeTab === 'accounts' || activeTab === 'receipts' || activeTab === 'b2c_dispatch' || activeTab === 'b2b_credit' ? 'p-3 sm:p-6 lg:p-8 max-w-7xl' : 'p-4 sm:p-6 lg:p-8 max-w-7xl'}`}>
          {activeTab === 'dashboard' && (
            <DashboardView
              currentUser={currentUser}
              metrics={metrics}
              leads={leads}
              onSelectLead={(id) => {
                setSelectedLeadInitialTab(undefined);
                setSelectedLeadId(id);
              }}
              onOpenCreateLead={() => setShowCreateModal(true)}
              onViewAllLeads={() => {
                setActiveCardFilter('ALL');
                setLeadCustomerTypeFilter('ALL');
                setActiveTab('leads');
              }}
              activeFilter={activeCardFilter}
              onSelectFilter={(filter) => setActiveCardFilter(filter)}
              onNavigateToTab={(tab) => setActiveTab(tab)}
              onSwitchUser={handleSwitchUser}
              onNavigateToProjectStage={(stage, customerType) => {
                setProjectStageFilter(stage);
                if (customerType) setProjectCustomerTypeFilter(customerType);
                setActiveTab('ecp_projects');
              }}
              onNavigateToLeadFilter={(filter, customerType) => {
                setActiveCardFilter(filter);
                if (customerType) setLeadCustomerTypeFilter(customerType);
                setActiveTab('leads');
              }}
              onRefresh={loadWorkspaceData}
            />
          )}

          {activeTab === 'leads' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Lead</h1>
                  <p className="text-xs text-slate-500">
                    Comprehensive view of all prospects and conversion stages.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Lead</span>
                </button>
              </div>

              <LeadTable
                leads={leads}
                onSelectLead={(id) => {
                  setSelectedLeadInitialTab(undefined);
                  setSelectedLeadId(id);
                }}
                activeFilter={activeCardFilter}
                onClearFilter={() => {
                  setActiveCardFilter('ALL');
                  setLeadCustomerTypeFilter('ALL');
                }}
                currentUser={currentUser}
                initialCustomerTypeFilter={leadCustomerTypeFilter}
              />
            </div>
          )}

          {activeTab === 'ecp_projects' && (
            <ECPProjectsView
              leads={leads}
              currentUser={currentUser}
              onSelectLead={(id, initialTab) => {
                setSelectedLeadInitialTab(initialTab);
                setSelectedLeadId(id);
              }}
              onRefresh={loadWorkspaceData}
              initialStageFilter={projectStageFilter}
              initialCustomerTypeFilter={projectCustomerTypeFilter}
              onClearInitialFilter={() => {
                setProjectStageFilter('ALL');
                setProjectCustomerTypeFilter('ALL');
              }}
            />
          )}

          {activeTab === 'followups' && currentUser?.role !== 'ACCOUNTS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Follow-ups Schedule</h1>
                  <p className="text-xs text-slate-500">Scheduled client calls, reminders and prospect check-ins</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Dashboard</span>
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { time: '10:30 AM', name: 'Rajesh Kumar', type: 'B2C', city: 'Pune, MH', note: 'Interested in 5kW Rooftop on-grid system. Requested subsidy breakdown.', phone: '+91 98765 43210', status: 'Urgent' },
                    { time: '12:00 PM', name: 'GreenTech Solutions Ltd', type: 'B2B', city: 'Bengaluru, KA', note: 'Factory roof 35kW installation. Discussing 30-day credit term.', phone: '+91 98234 56780', status: 'Pending' },
                    { time: '03:00 PM', name: 'Amit Patel', type: 'B2C', city: 'Ahmedabad, GJ', note: 'Site visit completed by technician. Reviewing revised bill of quantities.', phone: '+91 98112 23344', status: 'Follow-up' },
                    { time: '04:30 PM', name: 'Sunita Verma', type: 'B2C', city: 'Jaipur, RJ', note: 'Awaiting Aadhaar Card and Discom Consumer bill upload for ECP.', phone: '+91 98998 87766', status: 'Docs Req' },
                  ].map((f, i) => (
                    <div key={i} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            {f.time}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            {f.status}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">{f.name}</h4>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {f.type} • {f.city}
                        </div>
                        <p className="text-xs text-slate-600 mt-2 bg-white p-2.5 rounded-lg border border-slate-100">
                          {f.note}
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                        <span className="text-xs font-mono text-slate-500">{f.phone}</span>
                        <a
                          href={`tel:${f.phone}`}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                        >
                          Call Client
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Calendar & Appointments</h1>
                  <p className="text-xs text-slate-500">Upcoming site visits, owner escalations and consultations</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-xs text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Lead Team Event Calendar</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Synchronized with IST business hours (10:00 AM – 7:00 PM). Automatically blocks slots for confirmed site feasibility visits.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('leads')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    View Leads Pipeline
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Conversion & Pipeline Reports</h1>
                  <p className="text-xs text-slate-500">Funnel throughput, lead velocity, and drop-off analysis</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500">Average Lead-to-Doc Time</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">4.2 Days</div>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-1">↓ 1.1 days vs last month</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500">Site Feasibility Pass Rate</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">88.5%</div>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-1">↑ 4.2% after shadow checks</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500">Credit Approval Conversion</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">92.0%</div>
                  <p className="text-[11px] text-blue-600 font-semibold mt-1">Owner SLA: &lt; 24 hours</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'site_visits' && (
            currentUser.role === 'INSTALLATION_MANAGER' || currentUser.role === 'INSTALLATION_MEMBER' ? (
              <InstallationManagerWorkspace
                currentUser={currentUser}
                initialTab="site_visits"
                onOpenLeadDetails={(leadId) => {
                  setSelectedLeadInitialTab(undefined);
                  setSelectedLeadId(leadId);
                }}
              />
            ) : (
              <SiteVisitsHub
                currentUser={currentUser}
                users={allUsers}
                onOpenLead={(leadId) => {
                  setActiveTab('leads');
                  setSelectedLeadId(leadId);
                }}
              />
            )
          )}

          {(activeTab === 'installation_command' ||
            activeTab === 'installations' ||
            activeTab === 'net_metering' ||
            activeTab === 'team_workload') && (
            <InstallationManagerWorkspace
              currentUser={currentUser}
              initialTab={
                activeTab === 'installations'
                  ? 'installations'
                  : activeTab === 'net_metering'
                  ? 'net_metering'
                  : activeTab === 'team_workload'
                  ? 'team_workload'
                  : 'action_required'
              }
              onOpenLeadDetails={(leadId) => {
                setSelectedLeadInitialTab(undefined);
                setSelectedLeadId(leadId);
              }}
            />
          )}

          {activeTab === 'registration' && (
            <RegistrationWorkspace
              currentUser={currentUser}
              onOpenLeadDetails={(leadId) => {
                setSelectedLeadInitialTab(undefined);
                setSelectedLeadId(leadId);
              }}
            />
          )}

          {(activeTab === 'accounts' ||
            activeTab === 'receipts' ||
            (activeTab === 'b2c_dispatch' && currentUser.role !== 'DISPATCH') ||
            activeTab === 'b2b_credit' ||
            (activeTab === 'followups' && currentUser.role === 'ACCOUNTS')) && (
            <AccountsWorkspace
              currentUser={currentUser}
              initialTab={
                activeTab === 'receipts'
                  ? 'receipts'
                  : activeTab === 'b2c_dispatch'
                  ? 'b2c_dispatch'
                  : activeTab === 'b2b_credit'
                  ? 'b2b_credit'
                  : activeTab === 'followups'
                  ? 'followups'
                  : 'overview'
              }
              onOpenLeadDetails={(leadId) => {
                setSelectedLeadInitialTab(undefined);
                setSelectedLeadId(leadId);
              }}
            />
          )}

          {(activeTab === 'dispatch' ||
            (activeTab === 'b2c_dispatch' && currentUser.role === 'DISPATCH') ||
            activeTab === 'dispatch_gate' ||
            activeTab === 'dispatch_transit') && (
            <DispatchWorkspace
              currentUser={currentUser}
              initialTab={
                activeTab === 'dispatch_gate' || (activeTab === 'b2c_dispatch' && currentUser.role === 'DISPATCH')
                  ? 'gate'
                  : activeTab === 'dispatch_transit'
                  ? 'transit'
                  : 'all'
              }
              onOpenLeadDetails={(leadId) => {
                setSelectedLeadInitialTab(undefined);
                setSelectedLeadId(leadId);
              }}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar strictly for Lead Team Users */}
      {currentUser?.role === 'LEAD' && (
        <nav
          aria-label="Mobile Navigation"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-1.5 shadow-lg flex items-center justify-around pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
              activeTab === 'dashboard'
                ? 'text-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="text-[10px]">Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCardFilter('ALL');
              setLeadCustomerTypeFilter('ALL');
              setActiveTab('leads');
            }}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
              activeTab === 'leads'
                ? 'text-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="text-[10px]">Leads</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex flex-col items-center gap-0.5 -mt-3.5 px-2 py-1 group active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 rounded-full bg-blue-600 group-hover:bg-blue-700 shadow-md flex items-center justify-center text-white">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-bold text-blue-600">New Lead</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setProjectStageFilter('ALL');
              setProjectCustomerTypeFilter('ALL');
              setActiveTab('ecp_projects');
            }}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
              activeTab === 'ecp_projects'
                ? 'text-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span className="text-[10px]">Projects</span>
          </button>
        </nav>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateLeadModal
          onClose={() => setShowCreateModal(false)}
          currentUser={currentUser}
          onOpenSettings={currentUser.role === 'OWNER' ? () => setShowSettingsModal(true) : undefined}
          onSuccess={(leadId) => {
            loadWorkspaceData();
            setSelectedLeadId(leadId);
            setSelectedLeadInitialTab('fields');
          }}
        />
      )}

      {selectedLeadId && (
        <LeadDetailModal
          leadId={selectedLeadId}
          currentUser={currentUser}
          items={items}
          uoms={uoms}
          users={allUsers}
          initialTab={selectedLeadInitialTab}
          onClose={() => {
            setSelectedLeadId(null);
            setSelectedLeadInitialTab(undefined);
          }}
          onRefresh={loadWorkspaceData}
        />
      )}

      {showSettingsModal && currentUser.role === 'OWNER' && (
        <SettingsModal
          currentUser={currentUser}
          onClose={() => setShowSettingsModal(false)}
          onRefresh={loadWorkspaceData}
        />
      )}
    </div>
  );
}
