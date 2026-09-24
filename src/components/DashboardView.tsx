import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Phone,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  Building2,
  Calendar,
  Layers,
  Home,
  AlertTriangle,
  ArrowRight,
  FileText,
  Truck,
  Wrench,
  BadgeCheck,
  Send,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  CreditCard,
  Briefcase,
  X,
} from 'lucide-react';
import { Lead, DashboardMetrics, User, TodayFollowUpItem } from '../../shared/types';
import { formatINR, apiRequest } from '../lib/api';
import { formatToIST } from '../../shared/timezone';
import { OwnerExecutiveDashboard } from './OwnerExecutiveDashboard';

export interface DashboardViewProps {
  currentUser?: User;
  metrics: DashboardMetrics | null;
  leads: Lead[];
  onSelectLead: (leadId: string) => void;
  onOpenCreateLead: () => void;
  onViewAllLeads: () => void;
  activeFilter?: string;
  onSelectFilter?: (filter: string) => void;
  onNavigateToTab?: (tab: string) => void;
  onSwitchUser?: (username: string, role?: string) => void;
  onNavigateToProjectStage?: (stage: string, customerType?: 'B2C' | 'B2B') => void;
  onNavigateToLeadFilter?: (filter: string, customerType?: 'B2C' | 'B2B') => void;
  onRefresh?: () => void;
}

// Compact currency formatter for high-density cards
function formatCompactINR(amount: number | null | undefined): string {
  if (!amount || isNaN(amount)) return '₹0';
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)} K`;
  return `₹${Math.round(amount)}`;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  metrics,
  leads,
  onSelectLead,
  onOpenCreateLead,
  onViewAllLeads,
  onNavigateToTab,
  onNavigateToProjectStage,
  onNavigateToLeadFilter,
  onRefresh,
}) => {
  const isExecutive = currentUser?.role === 'OWNER' || currentUser?.role === 'MANAGER';
  const [dashboardMode, setDashboardMode] = useState<'EXECUTIVE' | 'PIPELINE' | 'BOTH'>(
    isExecutive ? 'EXECUTIVE' : 'PIPELINE'
  );
  const [activeTabSection, setActiveTabSection] = useState<'ALL' | 'B2C' | 'B2B'>('ALL');
  const [todayFollowUps, setTodayFollowUps] = useState<TodayFollowUpItem[]>([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
  const [showFollowUpsDrawer, setShowFollowUpsDrawer] = useState(false);

  // Fetch today's followups
  useEffect(() => {
    let isMounted = true;
    const fetchFollowUps = async () => {
      setLoadingFollowUps(true);
      try {
        const res = await apiRequest('/api/dashboard');
        if (isMounted && res.today_followups) {
          setTodayFollowUps(res.today_followups);
        }
      } catch (err) {
        console.error('Failed to load today followups:', err);
      } finally {
        if (isMounted) setLoadingFollowUps(false);
      }
    };
    fetchFollowUps();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute metrics with server data + client fallback
  const getCategoryData = (type: 'B2C' | 'B2B') => {
    const serverType = type === 'B2C' ? metrics?.b2c : metrics?.b2b;
    const typeLeads = leads.filter((l) => l.customer_type === type);

    const totalLeads = serverType?.total_leads ?? typeLeads.length;
    const siteVisitPending =
      serverType?.site_visit_pending ??
      typeLeads.filter((l) => l.status === 'SITE_VISIT_PENDING').length;
    const actionRequired =
      serverType?.action_required ??
      typeLeads.filter(
        (l) =>
          l.status !== 'LOST' &&
          l.status !== 'SITE_VISIT_PENDING' &&
          l.status !== 'ESCALATED_TO_OWNER' &&
          l.status !== 'OWNER_CREDIT_APPROVAL' &&
          ['LEAD', 'LEAD_TEAM'].includes(l.current_team) &&
          (Boolean(l.action_required) || l.status === 'PENDING')
      ).length;
    const followUpScheduled =
      serverType?.follow_up_scheduled ??
      typeLeads.filter(
        (l) =>
          l.has_follow_up &&
          l.status !== 'LOST' &&
          l.status !== 'QUALIFIED' &&
          l.status !== 'DOCUMENTATION_COMPLETE'
      ).length;
    const escalated =
      serverType?.escalated ??
      typeLeads.filter(
        (l) =>
          l.status === 'ESCALATED_TO_OWNER' ||
          l.status === 'OWNER_CREDIT_APPROVAL' ||
          l.current_team === 'OWNER'
      ).length;
    const lost = serverType?.lost ?? typeLeads.filter((l) => l.status === 'LOST').length;

    const qualifiedLeads = typeLeads.filter(
      (l) =>
        l.status === 'QUALIFIED' ||
        l.status === 'DOCUMENTATION_COMPLETE' ||
        (l.project_stage && !['LEAD', 'LOST'].includes(l.project_stage)) ||
        !['LEAD', 'LEAD_TEAM'].includes(l.current_team)
    );

    const qualifiedTotal = serverType?.qualified_total ?? qualifiedLeads.length;

    // B2C Stages (7 stages)
    const b2cStages = {
      in_docs:
        serverType?.stages?.in_docs ??
        qualifiedLeads.filter(
          (l) =>
            l.project_stage === 'IN_DOCS' ||
            ((l.status === 'QUALIFIED' || l.documentation_status === 'PENDING') &&
              ['LEAD', 'LEAD_TEAM'].includes(l.current_team))
        ).length,
      registration_1:
        serverType?.stages?.registration_1 ??
        qualifiedLeads.filter(
          (l) => l.project_stage === 'REGISTRATION_1' || l.current_team === 'REGISTRATION_1'
        ).length,
      net_metering:
        serverType?.stages?.net_metering ??
        qualifiedLeads.filter((l) => l.project_stage === 'NET_METERING').length,
      registration_2:
        serverType?.stages?.registration_2 ??
        qualifiedLeads.filter((l) => l.project_stage === 'REGISTRATION_2').length,
      dispatch:
        serverType?.stages?.dispatch ??
        qualifiedLeads.filter(
          (l) =>
            l.project_stage === 'DISPATCH' || ['DISPATCH', 'DISPATCH_TEAM'].includes(l.current_team)
        ).length,
      installation:
        serverType?.stages?.installation ??
        qualifiedLeads.filter(
          (l) =>
            l.project_stage === 'INSTALLATION' ||
            ['INSTALLATION_MANAGER', 'INSTALLATION_TEAM'].includes(l.current_team)
        ).length,
      completed:
        serverType?.stages?.completed ??
        qualifiedLeads.filter((l) => l.project_stage === 'COMPLETED').length,
    };

    // B2B Stages (ONLY 4 stages: Credit Approval pending with owner, Dispatch, Account, Completed)
    const b2bStages = {
      credit_approval_pending:
        serverType?.b2b_stages?.credit_approval_pending ??
        qualifiedLeads.filter(
          (l) =>
            (l.b2b_credit_extended === 'YES' && l.owner_credit_decision !== 'APPROVED') ||
            l.status === 'OWNER_CREDIT_APPROVAL' ||
            l.status === 'ESCALATED_TO_OWNER'
        ).length,
      dispatch:
        serverType?.b2b_stages?.dispatch ??
        qualifiedLeads.filter(
          (l) =>
            l.project_stage === 'DISPATCH' ||
            ['DISPATCH', 'DISPATCH_TEAM'].includes(l.current_team) ||
            ['READY_FOR_DISPATCH', 'DISPATCHED'].includes(l.dispatch_status as string)
        ).length,
      account:
        serverType?.b2b_stages?.account ??
        qualifiedLeads.filter(
          (l) =>
            l.current_team === 'ACCOUNTS' ||
            l.current_team === 'ACCOUNTS_PLACEHOLDER' ||
            l.dispatch_status === 'PENDING_ADVANCE' ||
            l.project_stage === 'ACCOUNTS'
        ).length,
      completed:
        serverType?.b2b_stages?.completed ??
        qualifiedLeads.filter(
          (l) =>
            l.project_stage === 'COMPLETED' ||
            l.status === 'DOCUMENTATION_COMPLETE' ||
            l.dispatch_status === 'DELIVERED'
        ).length,
    };

    const totalReceived =
      serverType?.total_received ??
      qualifiedLeads.reduce((sum, l) => sum + (Number(l.total_received) || 0), 0);

    const totalContractValue =
      serverType?.total_contract_value ??
      qualifiedLeads.reduce((sum, l) => sum + (Number(l.total_project_value) || 0), 0);

    const totalReceivable =
      serverType?.total_receivable ?? Math.max(0, totalContractValue - totalReceived);

    return {
      totalLeads,
      siteVisitPending,
      actionRequired,
      followUpScheduled,
      escalated,
      lost,
      qualifiedTotal,
      b2cStages,
      b2bStages,
      totalReceived,
      totalReceivable,
      totalContractValue,
    };
  };

  const b2c = useMemo(() => getCategoryData('B2C'), [metrics, leads]);
  const b2b = useMemo(() => getCategoryData('B2B'), [metrics, leads]);

  // Handlers for interactive tile clicks
  const handleLeadTileClick = (filter: string, type: 'B2C' | 'B2B') => {
    if (onNavigateToLeadFilter) {
      onNavigateToLeadFilter(filter, type);
    } else {
      onViewAllLeads();
    }
  };

  const handleStageTileClick = (stage: string, type: 'B2C' | 'B2B') => {
    if (onNavigateToProjectStage) {
      onNavigateToProjectStage(stage, type);
    } else if (onNavigateToTab) {
      onNavigateToTab('ecp_projects');
    }
  };

  return (
    <div className="space-y-4 max-w-full">
      {/* 0. Executive Role Perspective Switcher Bar (Only for Owner & Manager) */}
      {isExecutive && (
        <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 rounded-2xl border border-purple-200/90 px-4 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-700 text-white flex items-center justify-center font-black text-xs shadow-xs">
              EO
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900">
                  {currentUser?.role === 'OWNER' ? 'Executive Owner Command Center' : 'Sales Management Command'}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 border border-purple-200">
                  {currentUser?.role === 'OWNER' ? 'System Owner' : 'Sales Manager'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Switch between high-level executive KPIs &amp; operational lead team pipelines.
              </p>
            </div>
          </div>

          <div className="flex items-center bg-white p-1 rounded-xl border border-purple-200 text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => setDashboardMode('EXECUTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dashboardMode === 'EXECUTIVE'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Executive Command Center
            </button>
            <button
              type="button"
              onClick={() => setDashboardMode('PIPELINE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dashboardMode === 'PIPELINE'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lead Team Pipeline
            </button>
            <button
              type="button"
              onClick={() => setDashboardMode('BOTH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dashboardMode === 'BOTH'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Combined View
            </button>
          </div>
        </div>
      )}

      {/* 1. Render Owner Executive Dashboard in EXECUTIVE or BOTH mode */}
      {(dashboardMode === 'EXECUTIVE' || dashboardMode === 'BOTH') && isExecutive && (
        <OwnerExecutiveDashboard
          currentUser={
            currentUser || {
              id: '',
              username: 'owner',
              name: 'Owner',
              role: 'OWNER',
              active: true,
              created_at: '',
              updated_at: '',
              last_login_at: null,
            }
          }
          metrics={metrics}
          leads={leads}
          onSelectLead={onSelectLead}
          onOpenCreateLead={onOpenCreateLead}
          onNavigateToTab={onNavigateToTab}
          onNavigateToProjectStage={onNavigateToProjectStage}
          onNavigateToLeadFilter={onNavigateToLeadFilter}
          onRefresh={onRefresh}
          onSwitchToPipelineView={() => setDashboardMode('PIPELINE')}
        />
      )}

      {/* 2. Render Operational Pipeline section in PIPELINE mode, BOTH mode, or for non-executive roles */}
      {(dashboardMode === 'PIPELINE' || dashboardMode === 'BOTH' || !isExecutive) && (
        <div className="space-y-3.5">
          {/* Section Divider if in Combined View */}
          {dashboardMode === 'BOTH' && (
            <div className="pt-2 border-t-2 border-dashed border-slate-200">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-2">
                Operational Sales Stream (Lead Team View)
              </span>
            </div>
          )}

          {/* Ultra-Compact Pipeline Header & Quick Actions Toolbar */}
          <div className="bg-white rounded-xl border border-slate-200/90 px-3.5 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-lg text-white flex items-center justify-center font-black text-sm shadow-xs ${
                  isExecutive ? 'bg-indigo-600' : 'bg-blue-600'
                }`}
              >
                {isExecutive ? 'EP' : 'L'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-none">
                    {isExecutive ? 'Lead Operations Pipeline' : 'Lead Team Dashboard'}
                  </h1>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      isExecutive
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {isExecutive ? 'Executive Oversight' : 'IST Active'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                  Direct pipeline tracking for B2C Residential &amp; B2B Commercial projects
                </p>
              </div>
            </div>

        {/* View Switcher & Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Segmented View Control */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setActiveTabSection('ALL')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                activeTabSection === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Side-by-Side
            </button>
            <button
              type="button"
              onClick={() => setActiveTabSection('B2C')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                activeTabSection === 'B2C'
                  ? 'bg-blue-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              B2C Only
            </button>
            <button
              type="button"
              onClick={() => setActiveTabSection('B2B')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                activeTabSection === 'B2B'
                  ? 'bg-slate-900 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              B2B Only
            </button>
          </div>

          {/* Quick Action Buttons */}
          <button
            type="button"
            onClick={onOpenCreateLead}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Lead</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFollowUpsDrawer(!showFollowUpsDrawer)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              todayFollowUps.length > 0
                ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
            title="View today's scheduled client follow-ups"
          >
            <Phone className="w-3.5 h-3.5 text-indigo-600" />
            <span>Today's Calls</span>
            <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
              {todayFollowUps.length}
            </span>
          </button>

          <button
            type="button"
            onClick={onViewAllLeads}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>Leads</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToTab?.('ecp_projects')}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>Projects</span>
          </button>
        </div>
      </div>

      {/* 2. Today's Follow-ups Collapsible / Notification Strip (Minimizes scrolling impact) */}
      {showFollowUpsDrawer && (
        <div className="bg-white rounded-xl border border-indigo-200 p-3.5 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-indigo-100 mb-2.5">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-900">
                Today's Scheduled Follow-ups ({todayFollowUps.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowFollowUpsDrawer(false)}
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {todayFollowUps.length === 0 ? (
            <div className="py-3 text-center text-xs text-slate-500">
              No follow-ups due today. All prospective clients are up to date!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {todayFollowUps.map((fu) => (
                <div
                  key={fu.id}
                  className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 truncate">{fu.customer_name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                        {fu.customer_type}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">{fu.mobile_number}</div>
                    <div className="text-[10px] text-slate-600 line-clamp-1 mt-1 italic">
                      "{fu.remarks || 'Follow-up scheduled'}"
                    </div>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-slate-200 flex items-center justify-between">
                    <a
                      href={`tel:${fu.mobile_number}`}
                      className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      <span>Call</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => onSelectLead(fu.lead_id)}
                      className="text-[11px] font-semibold text-slate-700 hover:text-blue-600"
                    >
                      Open Lead →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. High-Density Pipeline Cards (Side-by-Side on desktop for zero/least scrolling) */}
      <div
        className={`grid gap-3.5 ${
          activeTabSection === 'ALL' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
        }`}
      >
        {/* ======================= B2C SECTION ======================= */}
        {(activeTabSection === 'ALL' || activeTabSection === 'B2C') && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 flex flex-col justify-between space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Home className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-black text-slate-900">B2C Residential Pipeline</h2>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      Rooftop
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleLeadTileClick('ALL', 'B2C')}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <span>View Stream ({b2c.totalLeads})</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* A. Lead Status KPI Tiles (6 items) */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Lead Status
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center">
                {/* Total */}
                <div
                  onClick={() => handleLeadTileClick('ALL', 'B2C')}
                  className="p-1.5 sm:p-2 rounded-lg border border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/50 cursor-pointer transition-all"
                  title="Click to view all B2C leads"
                >
                  <div className="text-[10px] font-semibold text-slate-500 truncate">Total</div>
                  <div className="text-base sm:text-lg font-black text-slate-900">{b2c.totalLeads}</div>
                </div>
                {/* Site Visit */}
                <div
                  onClick={() => handleLeadTileClick('SITE_VISIT_PENDING', 'B2C')}
                  className="p-1.5 sm:p-2 rounded-lg border border-sky-200 hover:border-sky-400 bg-sky-50/40 hover:bg-sky-50/70 cursor-pointer transition-all"
                  title="Click to view B2C site visits pending"
                >
                  <div className="text-[10px] font-semibold text-sky-700 truncate">Site Visit</div>
                  <div className="text-base sm:text-lg font-black text-sky-900">{b2c.siteVisitPending}</div>
                </div>
                {/* Action Required */}
                <div
                  onClick={() => handleLeadTileClick('PENDING_ACTION', 'B2C')}
                  className="p-1.5 sm:p-2 rounded-lg border border-amber-200 hover:border-amber-400 bg-amber-50/40 hover:bg-amber-50/70 cursor-pointer transition-all"
                  title="Click to view B2C action required"
                >
                  <div className="text-[10px] font-semibold text-amber-700 truncate">Action Req</div>
                  <div className="text-base sm:text-lg font-black text-amber-900">{b2c.actionRequired}</div>
                </div>
                {/* Follow-up */}
                <div
                  onClick={() => handleLeadTileClick('FOLLOW_UP', 'B2C')}
                  className="p-1.5 sm:p-2 rounded-lg border border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50/70 cursor-pointer transition-all"
                  title="Click to view B2C follow-up scheduled"
                >
                  <div className="text-[10px] font-semibold text-indigo-700 truncate">Follow-up</div>
                  <div className="text-base sm:text-lg font-black text-indigo-900">{b2c.followUpScheduled}</div>
                </div>
                {/* Escalated */}
                <div
                  onClick={() => handleLeadTileClick('ESCALATED', 'B2C')}
                  className="p-1.5 sm:p-2 rounded-lg border border-rose-200 hover:border-rose-400 bg-rose-50/40 hover:bg-rose-50/70 cursor-pointer transition-all"
                  title="Click to view B2C escalated leads"
                >
                  <div className="text-[10px] font-semibold text-rose-700 truncate">Escalated</div>
                  <div className="text-base sm:text-lg font-black text-rose-900">{b2c.escalated}</div>
                </div>
                {/* Lost */}
                <div
                  onClick={() => handleLeadTileClick('LOST', 'B2C')}
                  className="p-1.5 sm:p-2 rounded-lg border border-slate-200 hover:border-slate-400 bg-slate-50/40 hover:bg-slate-100 cursor-pointer transition-all"
                  title="Click to view B2C lost leads"
                >
                  <div className="text-[10px] font-semibold text-slate-500 truncate">Lost</div>
                  <div className="text-base sm:text-lg font-black text-slate-700">{b2c.lost}</div>
                </div>
              </div>
            </div>

            {/* B. B2C Qualified Stages (All 7 Stages) */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                <span>Qualified Stages ({b2c.qualifiedTotal})</span>
                <span className="text-[9px] text-slate-400 font-normal italic">
                  Click tile to filter Projects
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 text-center">
                {/* In Docs */}
                <div
                  onClick={() => handleStageTileClick('IN_DOCS', 'B2C')}
                  className="p-1.5 rounded-lg border border-purple-200 hover:border-purple-400 bg-purple-50/40 hover:bg-purple-50 cursor-pointer transition-all"
                  title="Click to filter B2C Projects by Documentation stage"
                >
                  <div className="text-[10px] font-bold text-purple-700 truncate">Docs</div>
                  <div className="text-sm sm:text-base font-extrabold text-purple-900">
                    {b2c.b2cStages.in_docs}
                  </div>
                </div>
                {/* Reg 1 */}
                <div
                  onClick={() => handleStageTileClick('REGISTRATION_1', 'B2C')}
                  className="p-1.5 rounded-lg border border-amber-200 hover:border-amber-400 bg-amber-50/40 hover:bg-amber-50 cursor-pointer transition-all"
                  title="Click to filter B2C Projects by Registration 1"
                >
                  <div className="text-[10px] font-bold text-amber-700 truncate">Reg 1</div>
                  <div className="text-sm sm:text-base font-extrabold text-amber-900">
                    {b2c.b2cStages.registration_1}
                  </div>
                </div>
                {/* Net Meter */}
                <div
                  onClick={() => handleStageTileClick('NET_METERING', 'B2C')}
                  className="p-1.5 rounded-lg border border-teal-200 hover:border-teal-400 bg-teal-50/40 hover:bg-teal-50 cursor-pointer transition-all"
                  title="Click to filter B2C Projects by Net Metering"
                >
                  <div className="text-[10px] font-bold text-teal-700 truncate">Net Meter</div>
                  <div className="text-sm sm:text-base font-extrabold text-teal-900">
                    {b2c.b2cStages.net_metering}
                  </div>
                </div>
                {/* Reg 2 */}
                <div
                  onClick={() => handleStageTileClick('REGISTRATION_2', 'B2C')}
                  className="p-1.5 rounded-lg border border-cyan-200 hover:border-cyan-400 bg-cyan-50/40 hover:bg-cyan-50 cursor-pointer transition-all"
                  title="Click to filter B2C Projects by Registration 2"
                >
                  <div className="text-[10px] font-bold text-cyan-700 truncate">Reg 2</div>
                  <div className="text-sm sm:text-base font-extrabold text-cyan-900">
                    {b2c.b2cStages.registration_2}
                  </div>
                </div>
                {/* Dispatch */}
                <div
                  onClick={() => handleStageTileClick('DISPATCH', 'B2C')}
                  className="p-1.5 rounded-lg border border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50 cursor-pointer transition-all"
                  title="Click to filter B2C Projects by Dispatch"
                >
                  <div className="text-[10px] font-bold text-indigo-700 truncate">Dispatch</div>
                  <div className="text-sm sm:text-base font-extrabold text-indigo-900">
                    {b2c.b2cStages.dispatch}
                  </div>
                </div>
                {/* Installation */}
                <div
                  onClick={() => handleStageTileClick('INSTALLATION', 'B2C')}
                  className="p-1.5 rounded-lg border border-orange-200 hover:border-orange-400 bg-orange-50/40 hover:bg-orange-50 cursor-pointer transition-all"
                  title="Click to filter B2C Projects by Installation"
                >
                  <div className="text-[10px] font-bold text-orange-700 truncate">Install</div>
                  <div className="text-sm sm:text-base font-extrabold text-orange-900">
                    {b2c.b2cStages.installation}
                  </div>
                </div>
                {/* Completed */}
                <div
                  onClick={() => handleStageTileClick('COMPLETED', 'B2C')}
                  className="p-1.5 rounded-lg border border-emerald-200 hover:border-emerald-400 bg-emerald-50/40 hover:bg-emerald-50 cursor-pointer transition-all col-span-2 sm:col-span-1"
                  title="Click to filter B2C Projects by Completed"
                >
                  <div className="text-[10px] font-bold text-emerald-700 truncate">Completed</div>
                  <div className="text-sm sm:text-base font-extrabold text-emerald-900">
                    {b2c.b2cStages.completed}
                  </div>
                </div>
              </div>
            </div>

            {/* C. Qualified Financials */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-medium block">Total Value</span>
                <span className="font-bold text-slate-900">{formatCompactINR(b2c.totalContractValue)}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-emerald-600 font-semibold block">Total Received</span>
                <span className="font-bold text-emerald-700">{formatCompactINR(b2c.totalReceived)}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-amber-600 font-semibold block">Receivable</span>
                <span className="font-bold text-amber-700">{formatCompactINR(b2c.totalReceivable)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ======================= B2B SECTION ======================= */}
        {/* Strictly has ONLY: Credit Approval pending with owner, Dispatch, Account, Completed. */}
        {/* NO Installation, NO Registration 1 & 2, NO Net Meter, NO In Doc. */}
        {(activeTabSection === 'ALL' || activeTabSection === 'B2B') && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 flex flex-col justify-between space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-black text-slate-900">B2B Commercial Pipeline</h2>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                      Commercial & Industrial
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleLeadTileClick('ALL', 'B2B')}
                className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1"
              >
                <span>View Stream ({b2b.totalLeads})</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* A. Lead Status KPI Tiles (6 items) */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Lead Status
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center">
                {/* Total */}
                <div
                  onClick={() => handleLeadTileClick('ALL', 'B2B')}
                  className="p-1.5 sm:p-2 rounded-lg border border-slate-200 hover:border-purple-400 bg-slate-50 hover:bg-purple-50/50 cursor-pointer transition-all"
                  title="Click to view all B2B leads"
                >
                  <div className="text-[10px] font-semibold text-slate-500 truncate">Total</div>
                  <div className="text-base sm:text-lg font-black text-slate-900">{b2b.totalLeads}</div>
                </div>
                {/* Site Visit */}
                <div
                  onClick={() => handleLeadTileClick('SITE_VISIT_PENDING', 'B2B')}
                  className="p-1.5 sm:p-2 rounded-lg border border-sky-200 hover:border-sky-400 bg-sky-50/40 hover:bg-sky-50/70 cursor-pointer transition-all"
                  title="Click to view B2B site visits pending"
                >
                  <div className="text-[10px] font-semibold text-sky-700 truncate">Site Visit</div>
                  <div className="text-base sm:text-lg font-black text-sky-900">{b2b.siteVisitPending}</div>
                </div>
                {/* Action Required */}
                <div
                  onClick={() => handleLeadTileClick('PENDING_ACTION', 'B2B')}
                  className="p-1.5 sm:p-2 rounded-lg border border-amber-200 hover:border-amber-400 bg-amber-50/40 hover:bg-amber-50/70 cursor-pointer transition-all"
                  title="Click to view B2B action required"
                >
                  <div className="text-[10px] font-semibold text-amber-700 truncate">Action Req</div>
                  <div className="text-base sm:text-lg font-black text-amber-900">{b2b.actionRequired}</div>
                </div>
                {/* Follow-up */}
                <div
                  onClick={() => handleLeadTileClick('FOLLOW_UP', 'B2B')}
                  className="p-1.5 sm:p-2 rounded-lg border border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50/70 cursor-pointer transition-all"
                  title="Click to view B2B follow-up scheduled"
                >
                  <div className="text-[10px] font-semibold text-indigo-700 truncate">Follow-up</div>
                  <div className="text-base sm:text-lg font-black text-indigo-900">{b2b.followUpScheduled}</div>
                </div>
                {/* Escalated */}
                <div
                  onClick={() => handleLeadTileClick('ESCALATED', 'B2B')}
                  className="p-1.5 sm:p-2 rounded-lg border border-rose-200 hover:border-rose-400 bg-rose-50/40 hover:bg-rose-50/70 cursor-pointer transition-all"
                  title="Click to view B2B escalated leads"
                >
                  <div className="text-[10px] font-semibold text-rose-700 truncate">Escalated</div>
                  <div className="text-base sm:text-lg font-black text-rose-900">{b2b.escalated}</div>
                </div>
                {/* Lost */}
                <div
                  onClick={() => handleLeadTileClick('LOST', 'B2B')}
                  className="p-1.5 sm:p-2 rounded-lg border border-slate-200 hover:border-slate-400 bg-slate-50/40 hover:bg-slate-100 cursor-pointer transition-all"
                  title="Click to view B2B lost leads"
                >
                  <div className="text-[10px] font-semibold text-slate-500 truncate">Lost</div>
                  <div className="text-base sm:text-lg font-black text-slate-700">{b2b.lost}</div>
                </div>
              </div>
            </div>

            {/* B. B2B Qualified Stages (ONLY 4 Stages: Credit Approval pending with owner, Dispatch, Account, Completed) */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                <span>Qualified Stages ({b2b.qualifiedTotal})</span>
                <span className="text-[9px] text-slate-400 font-normal italic">
                  Click tile to filter Projects
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center">
                {/* 1. Credit Approval pending with owner */}
                <div
                  onClick={() => handleStageTileClick('CREDIT_APPROVAL', 'B2B')}
                  className="p-2 rounded-lg border border-rose-200 hover:border-rose-400 bg-rose-50/40 hover:bg-rose-50 cursor-pointer transition-all flex flex-col justify-between"
                  title="Click to view B2B projects pending owner credit approval"
                >
                  <div className="text-[10px] font-bold text-rose-800 leading-tight">
                    Credit Approval Pending
                  </div>
                  <div className="text-base sm:text-lg font-extrabold text-rose-950 mt-1">
                    {b2b.b2bStages.credit_approval_pending}
                  </div>
                  <div className="text-[9px] text-rose-600 font-semibold mt-0.5">With Owner</div>
                </div>

                {/* 2. Dispatch */}
                <div
                  onClick={() => handleStageTileClick('DISPATCH', 'B2B')}
                  className="p-2 rounded-lg border border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50 cursor-pointer transition-all flex flex-col justify-between"
                  title="Click to view B2B projects in Dispatch"
                >
                  <div className="text-[10px] font-bold text-indigo-800 leading-tight">
                    Dispatch
                  </div>
                  <div className="text-base sm:text-lg font-extrabold text-indigo-950 mt-1">
                    {b2b.b2bStages.dispatch}
                  </div>
                  <div className="text-[9px] text-indigo-600 font-semibold mt-0.5">Logistics</div>
                </div>

                {/* 3. Account */}
                <div
                  onClick={() => handleStageTileClick('ACCOUNTS', 'B2B')}
                  className="p-2 rounded-lg border border-amber-200 hover:border-amber-400 bg-amber-50/40 hover:bg-amber-50 cursor-pointer transition-all flex flex-col justify-between"
                  title="Click to view B2B projects in Accounts"
                >
                  <div className="text-[10px] font-bold text-amber-800 leading-tight">
                    Account
                  </div>
                  <div className="text-base sm:text-lg font-extrabold text-amber-950 mt-1">
                    {b2b.b2bStages.account}
                  </div>
                  <div className="text-[9px] text-amber-600 font-semibold mt-0.5">Payment Desk</div>
                </div>

                {/* 4. Completed */}
                <div
                  onClick={() => handleStageTileClick('COMPLETED', 'B2B')}
                  className="p-2 rounded-lg border border-emerald-200 hover:border-emerald-400 bg-emerald-50/40 hover:bg-emerald-50 cursor-pointer transition-all flex flex-col justify-between"
                  title="Click to view B2B Completed projects"
                >
                  <div className="text-[10px] font-bold text-emerald-800 leading-tight">
                    Completed
                  </div>
                  <div className="text-base sm:text-lg font-extrabold text-emerald-950 mt-1">
                    {b2b.b2bStages.completed}
                  </div>
                  <div className="text-[9px] text-emerald-600 font-semibold mt-0.5">Delivered</div>
                </div>
              </div>
            </div>

            {/* C. Qualified Financials */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-medium block">Total Value</span>
                <span className="font-bold text-slate-900">{formatCompactINR(b2b.totalContractValue)}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-emerald-600 font-semibold block">Total Received</span>
                <span className="font-bold text-emerald-700">{formatCompactINR(b2b.totalReceived)}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-amber-600 font-semibold block">Receivable</span>
                <span className="font-bold text-amber-700">{formatCompactINR(b2b.totalReceivable)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
        </div>
      )}
    </div>
  );
};
