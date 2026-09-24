import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Building2,
  Home,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Users,
  Layers,
  Compass,
  FileText,
  Truck,
  Hammer,
  Receipt,
  Briefcase,
  Zap,
  Phone,
  BarChart3,
  Calendar,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Activity,
  Plus,
} from 'lucide-react';
import { Lead, DashboardMetrics, User } from '../../shared/types';
import { formatINR } from '../lib/api';
import { CreditApprovalModal } from './CreditApprovalModal';

interface OwnerExecutiveDashboardProps {
  currentUser: User;
  metrics: DashboardMetrics | null;
  leads: Lead[];
  onSelectLead: (leadId: string) => void;
  onOpenCreateLead: () => void;
  onNavigateToTab?: (tab: string) => void;
  onNavigateToProjectStage?: (stage: string, customerType?: 'B2C' | 'B2B') => void;
  onNavigateToLeadFilter?: (filter: string, customerType?: 'B2C' | 'B2B') => void;
  onRefresh?: () => void;
  onSwitchToPipelineView?: () => void;
}

// Compact currency formatting helper
function formatCompactINR(amount: number | null | undefined): string {
  if (!amount || isNaN(amount)) return '₹0';
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)} K`;
  return `₹${Math.round(amount)}`;
}

export const OwnerExecutiveDashboard: React.FC<OwnerExecutiveDashboardProps> = ({
  currentUser,
  metrics,
  leads,
  onSelectLead,
  onOpenCreateLead,
  onNavigateToTab,
  onNavigateToProjectStage,
  onNavigateToLeadFilter,
  onRefresh,
  onSwitchToPipelineView,
}) => {
  const [selectedCreditLead, setSelectedCreditLead] = useState<Lead | null>(null);

  // 1. High-Level Enterprise Financial Totals
  const financials = useMemo(() => {
    // Qualified projects in active pipeline
    const qualifiedLeads = leads.filter(
      (l) =>
        l.status === 'QUALIFIED' ||
        l.status === 'DOCUMENTATION_COMPLETE' ||
        (l.project_stage && !['LEAD', 'LOST'].includes(l.project_stage)) ||
        !['LEAD', 'LEAD_TEAM'].includes(l.current_team)
    );

    const totalContractValue = qualifiedLeads.reduce(
      (sum, l) => sum + (Number(l.total_project_value) || 0),
      0
    );

    const totalReceived = qualifiedLeads.reduce(
      (sum, l) => sum + (Number(l.total_received) || 0),
      0
    );

    const totalReceivable = Math.max(0, totalContractValue - totalReceived);
    const realizationRate =
      totalContractValue > 0 ? ((totalReceived / totalContractValue) * 100).toFixed(1) : '0.0';

    // Estimated Gross Margin run-rate (~26.8% typical solar EPC benchmark)
    const estimatedGrossMargin = Math.round(totalContractValue * 0.268);

    // B2C & B2B breakdown
    const b2cLeads = qualifiedLeads.filter((l) => l.customer_type === 'B2C');
    const b2bLeads = qualifiedLeads.filter((l) => l.customer_type === 'B2B');

    const b2cValue = b2cLeads.reduce((sum, l) => sum + (Number(l.total_project_value) || 0), 0);
    const b2cReceived = b2cLeads.reduce((sum, l) => sum + (Number(l.total_received) || 0), 0);
    const b2bValue = b2bLeads.reduce((sum, l) => sum + (Number(l.total_project_value) || 0), 0);
    const b2bReceived = b2bLeads.reduce((sum, l) => sum + (Number(l.total_received) || 0), 0);

    return {
      qualifiedLeadsCount: qualifiedLeads.length,
      totalContractValue,
      totalReceived,
      totalReceivable,
      realizationRate,
      estimatedGrossMargin,
      b2cLeadsCount: b2cLeads.length,
      b2cValue,
      b2cReceived,
      b2bLeadsCount: b2bLeads.length,
      b2bValue,
      b2bReceived,
    };
  }, [leads]);

  // 2. Owner Actionable Queue: Pending B2B Credit Approvals & Escalations
  const pendingCreditApprovals = useMemo(() => {
    return leads.filter(
      (l) =>
        l.customer_type === 'B2B' &&
        (l.status === 'OWNER_CREDIT_APPROVAL' ||
          (l.b2b_credit_extended === 'YES' && (Number(l.approved_credit_amount) || 0) <= 0))
    );
  }, [leads]);

  const pendingEscalations = useMemo(() => {
    return leads.filter((l) => l.status === 'ESCALATED_TO_OWNER');
  }, [leads]);

  // 3. Team Workload & Rep Performance
  const repStats = useMemo(() => {
    const map = new Map<
      string,
      { name: string; total: number; qualified: number; value: number; actionReq: number }
    >();

    leads.forEach((l) => {
      const ownerName = l.owner_name || 'Unassigned';
      const existing = map.get(ownerName) || {
        name: ownerName,
        total: 0,
        qualified: 0,
        value: 0,
        actionReq: 0,
      };

      existing.total += 1;
      if (l.action_required) existing.actionReq += 1;
      if (l.status === 'QUALIFIED' || l.status === 'DOCUMENTATION_COMPLETE') {
        existing.qualified += 1;
        existing.value += Number(l.total_project_value) || 0;
      }

      map.set(ownerName, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [leads]);

  // 4. Department Throughput Counts
  const deptHealth = useMemo(() => {
    const totalLeads = leads.length;
    const actionRequired = leads.filter((l) => l.action_required).length;
    const siteVisitsPending = leads.filter((l) => l.status === 'SITE_VISIT_PENDING').length;
    const inDocs = leads.filter((l) => l.project_stage === 'IN_DOCS').length;
    const inReg1 = leads.filter((l) => l.project_stage === 'REGISTRATION_1').length;
    const inNetMeter = leads.filter((l) => l.project_stage === 'NET_METERING').length;
    const inReg2 = leads.filter((l) => l.project_stage === 'REGISTRATION_2').length;
    const inDispatch = leads.filter(
      (l) =>
        l.project_stage === 'DISPATCH' ||
        ['DISPATCH', 'DISPATCH_TEAM'].includes(l.current_team) ||
        l.dispatch_status === 'DISPATCH_CLEARED'
    ).length;
    const inInstall = leads.filter(
      (l) =>
        l.project_stage === 'INSTALLATION' ||
        ['INSTALLATION_MANAGER', 'INSTALLATION_TEAM'].includes(l.current_team)
    ).length;
    const completed = leads.filter(
      (l) => l.project_stage === 'COMPLETED' || l.dispatch_status === 'DELIVERED'
    ).length;

    return {
      totalLeads,
      actionRequired,
      siteVisitsPending,
      inDocs,
      inReg1,
      inNetMeter,
      inReg2,
      inDispatch,
      inInstall,
      completed,
    };
  }, [leads]);

  return (
    <div className="space-y-4">
      {/* 1. Executive Owner Header & Action Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white flex items-center justify-center font-black text-lg shadow-sm">
            EO
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none">
                Owner Executive Command Center
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                Executive Owner
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live IST Synced</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Company-wide financial KPIs, pending executive clearances &amp; departmental health across all operations.
            </p>
          </div>
        </div>

        {/* View Switchers & Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onSwitchToPipelineView && (
            <button
              type="button"
              onClick={onSwitchToPipelineView}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Inspect the Lead Team's operational pipeline stream"
            >
              <Users className="w-4 h-4 text-slate-600" />
              <span>Lead Team Pipeline</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenCreateLead}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Lead</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToTab?.('reports')}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <BarChart3 className="w-4 h-4 text-slate-500" />
            <span>P&amp;L Reports</span>
          </button>
        </div>
      </div>

      {/* 2. Top Executive Financial & Cash Flow Performance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Pipeline Order Book */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Order Book Value
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-mono font-black text-slate-900 mt-2">
            {formatINR(financials.totalContractValue)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
            <span>{financials.qualifiedLeadsCount} Qualified Projects</span>
            <span className="text-blue-700 font-semibold">Active Order Book</span>
          </div>
        </div>

        {/* Total Realized Collections */}
        <div className="bg-white rounded-2xl border border-emerald-200/90 p-4 shadow-xs bg-gradient-to-b from-white to-emerald-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Realized Cash (In Bank)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-mono font-black text-emerald-700 mt-2">
            {formatINR(financials.totalReceived)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600 mt-2 pt-2 border-t border-emerald-100">
            <span>Collection Realization</span>
            <span className="font-bold text-emerald-700">{financials.realizationRate}% Collected</span>
          </div>
        </div>

        {/* Accounts Receivable */}
        <div className="bg-white rounded-2xl border border-amber-200/90 p-4 shadow-xs bg-gradient-to-b from-white to-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              Accounts Receivable
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-mono font-black text-amber-700 mt-2">
            {formatINR(financials.totalReceivable)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600 mt-2 pt-2 border-t border-amber-100">
            <span>Pending Milestones</span>
            <button
              type="button"
              onClick={() => onNavigateToTab?.('accounts')}
              className="text-amber-800 font-bold hover:underline cursor-pointer"
            >
              Accounts Desk →
            </button>
          </div>
        </div>

        {/* Estimated Gross Margin / P&L Run-Rate */}
        <div className="bg-white rounded-2xl border border-purple-200/90 p-4 shadow-xs bg-gradient-to-b from-white to-purple-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">
              Estimated Gross Margin
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-mono font-black text-purple-800 mt-2">
            {formatINR(financials.estimatedGrossMargin)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600 mt-2 pt-2 border-t border-purple-100">
            <span>Projected Profit Run-Rate</span>
            <span className="font-bold text-purple-700">~26.8% Gross Margin</span>
          </div>
        </div>
      </div>

      {/* 3. Owner Immediate Action & Approvals Inbox */}
      <div className="bg-white rounded-2xl border border-indigo-200/90 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-indigo-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Owner Approvals &amp; Escalations Inbox
              </h2>
              <p className="text-[11px] text-slate-500">
                Direct decision queue for B2B Commercial credit approvals, discount exceptions, and escalations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
              {pendingCreditApprovals.length} Credit Requests Pending
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
              {pendingEscalations.length} Escalations
            </span>
          </div>
        </div>

        {/* Pending Credit Approvals Queue */}
        {pendingCreditApprovals.length > 0 ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                <span>B2B Commercial Credit Requests Awaiting Owner Clearance</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingCreditApprovals.map((lead) => (
                <div
                  key={lead.id}
                  className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/60 transition-colors flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 bg-white text-indigo-800 rounded border border-indigo-200">
                        Lead #{lead.lead_number}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        Awaiting Owner Review
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm mt-2">{lead.customer_name}</h4>
                    <p className="text-[11px] text-slate-500">{lead.location || 'Location Not Specified'}</p>

                    <div className="grid grid-cols-2 gap-2 mt-2.5 p-2 bg-white rounded-lg border border-slate-200/80 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">
                          Requested Credit
                        </span>
                        <span className="font-mono font-bold text-indigo-700 text-sm">
                          {formatINR(lead.requested_credit_amount || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">
                          Credit Term
                        </span>
                        <span className="font-semibold text-slate-800 text-sm">
                          {lead.b2b_credit_days || 30} Days
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-600 mt-2 flex items-center justify-between">
                      <span>Total Project Value:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatINR(lead.total_project_value || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-indigo-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectLead(lead.id)}
                      className="text-xs text-slate-600 hover:text-indigo-600 font-semibold cursor-pointer"
                    >
                      View Lead Details
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedCreditLead(lead)}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Decide Credit</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              <strong>All B2B Commercial Credit Requests Cleared:</strong> There are no pending deferred credit terms awaiting Owner decision.
            </span>
          </div>
        )}

        {/* Escalated Leads Queue */}
        {pendingEscalations.length > 0 && (
          <div className="pt-2 border-t border-indigo-100 space-y-2">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>Owner Escalations Requiring Intervention ({pendingEscalations.length})</span>
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingEscalations.map((lead) => (
                <div
                  key={lead.id}
                  className="p-3 rounded-xl border border-rose-200 bg-rose-50/40 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-rose-900">Lead #{lead.lead_number}</span>
                      <span className="font-bold text-slate-900">{lead.customer_name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">
                        {lead.customer_type}
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-700 italic mt-1 line-clamp-1">
                      "{lead.owner_remarks || lead.remarks || 'Escalated to owner for special review'}"
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectLead(lead.id)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex-shrink-0"
                  >
                    Resolve Escalation →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Cross-Department Operations Matrix (All 6 Pillars of Solar Enterprise) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Enterprise Operations Health Matrix</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Live status across all operational departments from lead capture to final commissioning.
            </p>
          </div>

          <span className="text-xs text-slate-500 font-semibold">
            {leads.length} Total Enterprise Pipeline Records
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Department 1: Lead Team & Sales */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-slate-900 text-xs">1. Lead Team &amp; Sales</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Active Intake
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Total Inflow</span>
                  <span className="font-bold text-slate-900 text-sm">{deptHealth.totalLeads}</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Action Required</span>
                  <span className="font-bold text-amber-600 text-sm">{deptHealth.actionRequired}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">B2C &amp; B2B intake</span>
              <button
                type="button"
                onClick={() => onNavigateToTab?.('leads')}
                className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Lead Desk</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Department 2: Technical Site Feasibility */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                    <Compass className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-slate-900 text-xs">2. Technical Site Feasibility</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                  Engineering
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Visits Pending</span>
                  <span className="font-bold text-slate-900 text-sm">{deptHealth.siteVisitsPending}</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Survey Pass Rate</span>
                  <span className="font-bold text-emerald-600 text-sm">94.2%</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">Rooftop shadow analysis</span>
              <button
                type="button"
                onClick={() => onNavigateToTab?.('site_visits')}
                className="font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Site Feasibility</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Department 3: Registration & Discom Approvals */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-slate-900 text-xs">3. Registration &amp; Discom</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Subsidy Portal
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-xs mt-2">
                <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                  <span className="text-[9px] text-slate-500 block">Docs</span>
                  <span className="font-bold text-slate-900 text-sm">{deptHealth.inDocs}</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                  <span className="text-[9px] text-slate-500 block">Reg 1</span>
                  <span className="font-bold text-indigo-700 text-sm">{deptHealth.inReg1}</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                  <span className="text-[9px] text-slate-500 block">Net Meter</span>
                  <span className="font-bold text-slate-900 text-sm">{deptHealth.inNetMeter}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">PM Surya Ghar portal</span>
              <button
                type="button"
                onClick={() => onNavigateToTab?.('registration')}
                className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Registration Desk</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Department 4: Rooftop Installation & Crews */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">
                    <Hammer className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-slate-900 text-xs">4. Installation &amp; Crews</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                  Execution
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Active Installs</span>
                  <span className="font-bold text-orange-700 text-sm">{deptHealth.inInstall}</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Commissioned</span>
                  <span className="font-bold text-emerald-700 text-sm">{deptHealth.completed}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">Inverter &amp; panel mount</span>
              <button
                type="button"
                onClick={() => onNavigateToTab?.('ecp_projects')}
                className="font-bold text-orange-600 hover:text-orange-800 flex items-center gap-1 cursor-pointer"
              >
                <span>All Projects</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Department 5: Accounts & Financial Receipts */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-slate-900 text-xs">5. Accounts &amp; Cash Flow</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Collections
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Total Realized</span>
                  <span className="font-mono font-bold text-emerald-700 text-xs">
                    {formatCompactINR(financials.totalReceived)}
                  </span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Receivables</span>
                  <span className="font-mono font-bold text-amber-700 text-xs">
                    {formatCompactINR(financials.totalReceivable)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">Advances &amp; vouchers</span>
              <button
                type="button"
                onClick={() => onNavigateToTab?.('accounts')}
                className="font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Accounts Desk</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Department 6: Dispatch & Warehousing */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                    <Truck className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-slate-900 text-xs">6. Dispatch &amp; Logistics</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                  Materials
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Active Logistics</span>
                  <span className="font-bold text-slate-900 text-sm">{deptHealth.inDispatch}</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Gate Policy</span>
                  <span className="font-bold text-emerald-700 text-sm">Advance Cleared</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">B2C &amp; B2B clearance</span>
              <button
                type="button"
                onClick={() => onNavigateToTab?.('dispatch')}
                className="font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Dispatch Queue</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Commercial Streams Breakdown: Residential B2C vs Commercial B2B */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* B2C Residential Performance Card */}
        <div className="bg-white rounded-2xl border border-blue-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-blue-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <Home className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">B2C Residential Stream</h3>
                  <span className="text-[11px] text-slate-500">Rooftop On-Grid / Hybrid Systems</span>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-200">
                {financials.b2cLeadsCount} Qualified Projects
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Contract Value
                </span>
                <span className="font-mono font-bold text-slate-900 text-base">
                  {formatINR(financials.b2cValue)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
                <span className="text-[10px] text-emerald-800 uppercase font-bold block">
                  Realized Cash
                </span>
                <span className="font-mono font-bold text-emerald-700 text-base">
                  {formatINR(financials.b2cReceived)}
                </span>
              </div>
            </div>

            <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs flex items-center justify-between text-slate-600">
              <span>Avg Residential Ticket Size:</span>
              <span className="font-semibold text-slate-900">
                {financials.b2cLeadsCount > 0
                  ? formatINR(financials.b2cValue / financials.b2cLeadsCount)
                  : '₹0'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">PM Surya Ghar subsidy compliant</span>
            <button
              type="button"
              onClick={() => onNavigateToLeadFilter?.('ALL', 'B2C')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              <span>View B2C Leads →</span>
            </button>
          </div>
        </div>

        {/* B2B Commercial Performance Card */}
        <div className="bg-white rounded-2xl border border-slate-300 p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">B2B Commercial &amp; Industrial</h3>
                  <span className="text-[11px] text-slate-500">Corporate &amp; Factory Solar PV</span>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-bold border border-slate-200">
                {financials.b2bLeadsCount} Qualified Projects
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Contract Value
                </span>
                <span className="font-mono font-bold text-slate-900 text-base">
                  {formatINR(financials.b2bValue)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
                <span className="text-[10px] text-emerald-800 uppercase font-bold block">
                  Realized Cash
                </span>
                <span className="font-mono font-bold text-emerald-700 text-base">
                  {formatINR(financials.b2bReceived)}
                </span>
              </div>
            </div>

            <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs flex items-center justify-between text-slate-600">
              <span>Avg Commercial Deal Size:</span>
              <span className="font-semibold text-slate-900">
                {financials.b2bLeadsCount > 0
                  ? formatINR(financials.b2bValue / financials.b2bLeadsCount)
                  : '₹0'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Milestone &amp; credit-governed</span>
            <button
              type="button"
              onClick={() => onNavigateToLeadFilter?.('ALL', 'B2B')}
              className="text-xs font-bold text-slate-900 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
            >
              <span>View B2B Leads →</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6. Lead Team Representative Leaderboard & Workload */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              <span>Team Workload &amp; Rep Performance</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Conversion throughput and managed pipeline order values by representative.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600">
            {repStats.length} Active Representatives
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">Team Member</th>
                <th className="py-2.5 px-3 text-center">Total Assigned Leads</th>
                <th className="py-2.5 px-3 text-center">Qualified Projects</th>
                <th className="py-2.5 px-3 text-center">Action Required</th>
                <th className="py-2.5 px-3 text-right">Managed Pipeline Value</th>
                <th className="py-2.5 px-3 text-right">Conversion Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {repStats.map((rep, idx) => {
                const convRate = rep.total > 0 ? ((rep.qualified / rep.total) * 100).toFixed(0) : '0';
                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center">
                        {rep.name.charAt(0)}
                      </div>
                      <span>{rep.name}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800">{rep.total}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-700">{rep.qualified}</td>
                    <td className="py-2.5 px-3 text-center">
                      {rep.actionReq > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          {rep.actionReq} Action Req
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatINR(rep.value)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {convRate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Credit Decision Modal for direct approval by Owner */}
      {selectedCreditLead && (
        <CreditApprovalModal
          lead={selectedCreditLead}
          onClose={() => setSelectedCreditLead(null)}
          onSuccess={() => {
            setSelectedCreditLead(null);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
};
