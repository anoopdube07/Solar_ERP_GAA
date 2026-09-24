import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Building2,
  User as UserIcon,
  Phone,
  MapPin,
  Calendar,
  Layers,
  ArrowRight,
  Hammer,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  RegistrationLeadItem,
  RegistrationMetrics,
  RegistrationStage,
  User,
} from '../../shared/types';
import { apiRequest, formatINR } from '../lib/api';
import { RegistrationTaskModal } from './RegistrationTaskModal';

interface RegistrationWorkspaceProps {
  currentUser?: User;
  onOpenLeadDetails: (leadId: string) => void;
  initialQueueFilter?: 'ALL' | 'REG_1' | 'NET_METERING' | 'REG_2';
}

export const RegistrationWorkspace: React.FC<RegistrationWorkspaceProps> = ({
  currentUser,
  onOpenLeadDetails,
  initialQueueFilter = 'ALL',
}) => {
  const [leads, setLeads] = useState<RegistrationLeadItem[]>([]);
  const [metrics, setMetrics] = useState<RegistrationMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [queueFilter, setQueueFilter] = useState<
    'ALL' | 'REG_1' | 'NET_METERING' | 'REG_2' | 'ACTIONABLE' | 'DELAYED' | 'COMPLETED'
  >(initialQueueFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [financingFilter, setFinancingFilter] = useState<'ALL' | 'YES' | 'NO'>('ALL');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'ALL' | 'B2C' | 'B2B'>('ALL');

  // Selected lead for task processing modal
  const [selectedLeadForTask, setSelectedLeadForTask] = useState<RegistrationLeadItem | null>(null);

  const fetchWorkspaceData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [leadsRes, metricsRes] = await Promise.all([
        apiRequest<{ leads: RegistrationLeadItem[] }>('/api/registration/leads'),
        apiRequest<{ metrics: RegistrationMetrics }>('/api/registration/metrics'),
      ]);

      setLeads(leadsRes.leads || []);
      setMetrics(metricsRes.metrics || null);
    } catch (err: any) {
      console.error('Error fetching registration data:', err);
      setError(err.message || 'Failed to load registration queue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWorkspaceData();
  }, []);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // 1. Queue Filter
      if (queueFilter === 'REG_1') {
        if (lead.stage !== 'REGISTRATION_1' || lead.overall_status === 'COMPLETED') return false;
      } else if (queueFilter === 'NET_METERING') {
        if (lead.stage !== 'NET_METERING' || lead.overall_status === 'COMPLETED') return false;
      } else if (queueFilter === 'REG_2') {
        if (lead.stage !== 'REGISTRATION_2' || lead.overall_status === 'COMPLETED') return false;
      } else if (queueFilter === 'ACTIONABLE') {
        if (lead.overall_status !== 'ACTIONABLE') return false;
      } else if (queueFilter === 'DELAYED') {
        if (!lead.is_delayed || lead.overall_status === 'COMPLETED') return false;
      } else if (queueFilter === 'COMPLETED') {
        if (lead.overall_status !== 'COMPLETED') return false;
      }

      // 2. Financing Filter
      if (financingFilter === 'YES' && !lead.financing_required) return false;
      if (financingFilter === 'NO' && lead.financing_required) return false;

      // 3. Customer Type Filter
      if (customerTypeFilter !== 'ALL' && lead.customer_type !== customerTypeFilter) return false;

      // 4. Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = lead.customer_name.toLowerCase().includes(q);
        const matchesPhone = lead.mobile_number.includes(q);
        const matchesId = `ld-${lead.lead_number}`.includes(q);
        const matchesLocation = (lead.location || '').toLowerCase().includes(q);
        const matchesTask = (lead.current_task_name || '').toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesId && !matchesLocation && !matchesTask) {
          return false;
        }
      }

      return true;
    });
  }, [leads, queueFilter, financingFilter, customerTypeFilter, searchQuery]);

  return (
    <div className="space-y-4 pb-12">
      {/* Top Banner / Breadcrumb & Status */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
              Registration Operations
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-medium text-slate-500">
              Role: {currentUser?.role || 'REGISTRATION'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Registration Team Workspace
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Operational cockpit for Registration 1, Net Metering coordination, and Registration 2 asset creation & completion.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => fetchWorkspaceData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-all shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Queue
          </button>
        </div>
      </div>

      {/* 5 Summary Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Reg 1 */}
        <button
          type="button"
          onClick={() => setQueueFilter('REG_1')}
          className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
            queueFilter === 'REG_1'
              ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-500'
              : 'bg-white text-slate-800 border-slate-200/90 hover:border-indigo-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                queueFilter === 'REG_1' ? 'text-indigo-200' : 'text-slate-500'
              }`}
            >
              Reg 1 Queue
            </span>
            <FileText
              className={`w-4 h-4 ${
                queueFilter === 'REG_1' ? 'text-indigo-200' : 'text-indigo-600'
              }`}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black">
              {metrics ? metrics.reg1_pending : 0}
            </span>
            <span
              className={`text-[11px] font-medium ${
                queueFilter === 'REG_1' ? 'text-indigo-200' : 'text-slate-500'
              }`}
            >
              Pending
            </span>
          </div>
          <div
            className={`mt-1.5 text-[11px] truncate ${
              queueFilter === 'REG_1' ? 'text-indigo-200' : 'text-slate-500'
            }`}
          >
            Application & CVA Sign
          </div>
        </button>

        {/* Card 2: Net Metering */}
        <button
          type="button"
          onClick={() => setQueueFilter('NET_METERING')}
          className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
            queueFilter === 'NET_METERING'
              ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-500'
              : 'bg-white text-slate-800 border-slate-200/90 hover:border-blue-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                queueFilter === 'NET_METERING' ? 'text-blue-200' : 'text-slate-500'
              }`}
            >
              Net Metering
            </span>
            <Zap
              className={`w-4 h-4 ${
                queueFilter === 'NET_METERING' ? 'text-blue-200' : 'text-blue-600'
              }`}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black">
              {metrics ? metrics.net_metering_pending : 0}
            </span>
            <span
              className={`text-[11px] font-medium ${
                queueFilter === 'NET_METERING' ? 'text-blue-200' : 'text-slate-500'
              }`}
            >
              Active
            </span>
          </div>
          <div
            className={`mt-1.5 text-[11px] truncate ${
              queueFilter === 'NET_METERING' ? 'text-blue-200' : 'text-slate-500'
            }`}
          >
            DCR & Bi-Directional Meter
          </div>
        </button>

        {/* Card 3: Reg 2 */}
        <button
          type="button"
          onClick={() => setQueueFilter('REG_2')}
          className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
            queueFilter === 'REG_2'
              ? 'bg-teal-600 text-white border-teal-700 shadow-md ring-2 ring-teal-500'
              : 'bg-white text-slate-800 border-slate-200/90 hover:border-teal-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                queueFilter === 'REG_2' ? 'text-teal-200' : 'text-slate-500'
              }`}
            >
              Reg 2 Queue
            </span>
            <ShieldCheck
              className={`w-4 h-4 ${
                queueFilter === 'REG_2' ? 'text-teal-200' : 'text-teal-600'
              }`}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black">
              {metrics ? metrics.reg2_pending : 0}
            </span>
            <span
              className={`text-[11px] font-medium ${
                queueFilter === 'REG_2' ? 'text-teal-200' : 'text-slate-500'
              }`}
            >
              Pending
            </span>
          </div>
          <div
            className={`mt-1.5 text-[11px] truncate ${
              queueFilter === 'REG_2' ? 'text-teal-200' : 'text-slate-500'
            }`}
          >
            Asset Creation & Completion
          </div>
        </button>

        {/* Card 4: Total Pending */}
        <button
          type="button"
          onClick={() => setQueueFilter('ALL')}
          className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
            queueFilter === 'ALL'
              ? 'bg-slate-800 text-white border-slate-900 shadow-md ring-2 ring-slate-600'
              : 'bg-white text-slate-800 border-slate-200/90 hover:border-slate-400 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                queueFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              Total Pending
            </span>
            <Layers
              className={`w-4 h-4 ${
                queueFilter === 'ALL' ? 'text-slate-300' : 'text-slate-600'
              }`}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black">
              {metrics ? metrics.total_pending : 0}
            </span>
            <span
              className={`text-[11px] font-medium ${
                queueFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              Projects
            </span>
          </div>
          <div
            className={`mt-1.5 text-[11px] truncate ${
              queueFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'
            }`}
          >
            All Active Stages
          </div>
        </button>

        {/* Card 5: Delayed Work */}
        <button
          type="button"
          onClick={() => setQueueFilter('DELAYED')}
          className={`col-span-2 sm:col-span-1 p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
            queueFilter === 'DELAYED'
              ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-500'
              : 'bg-white text-slate-800 border-slate-200/90 hover:border-rose-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                queueFilter === 'DELAYED' ? 'text-rose-200' : 'text-rose-600'
              }`}
            >
              Delayed Work
            </span>
            <AlertTriangle
              className={`w-4 h-4 ${
                queueFilter === 'DELAYED' ? 'text-rose-200' : 'text-rose-600'
              }`}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-rose-600">
              <span className={queueFilter === 'DELAYED' ? 'text-white' : ''}>
                {metrics ? metrics.delayed_count : 0}
              </span>
            </span>
            <span
              className={`text-[11px] font-medium ${
                queueFilter === 'DELAYED' ? 'text-rose-200' : 'text-rose-600'
              }`}
            >
              SLA Alert
            </span>
          </div>
          <div
            className={`mt-1.5 text-[11px] truncate ${
              queueFilter === 'DELAYED' ? 'text-rose-200' : 'text-slate-500'
            }`}
          >
            Age &gt; 5 Days in Stage
          </div>
        </button>
      </div>

      {/* Operational Notice / Guide Banner */}
      <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 text-indigo-900 text-xs flex items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start sm:items-center gap-2.5">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5 sm:mt-0" />
          <span>
            <span className="font-bold">Workflow Sequence:</span> Registration 1 (Consumer Request, CVA & Feasibility) &rarr; Net Metering (Photos, DCR, Approvals & Installation meter close) &rarr; Registration 2 (Asset Creation, Completion Certificate & Bank Final Payment).
          </span>
        </div>
        <div className="hidden lg:flex items-center gap-2 text-[11px] text-indigo-700 shrink-0 font-medium">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
          Backend authoritative rules enforced
        </div>
      </div>

      {/* Work Queue & Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Navigation Tabs */}
        <div className="border-b border-slate-200 px-4 sm:px-5 pt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none">
            {[
              { id: 'ALL', label: 'All Registration Work' },
              { id: 'REG_1', label: 'Registration 1' },
              { id: 'NET_METERING', label: 'Net Metering' },
              { id: 'REG_2', label: 'Registration 2' },
              { id: 'ACTIONABLE', label: 'My Actionable Tasks' },
              { id: 'DELAYED', label: 'Delayed (> 5 Days)' },
              { id: 'COMPLETED', label: 'Recently Completed' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setQueueFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  queueFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="pb-2 text-xs font-semibold text-slate-500">
            {filteredLeads.length} {filteredLeads.length === 1 ? 'project' : 'projects'} in view
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, LD ID, mobile, location..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                &times;
              </button>
            )}
          </div>

          {/* Secondary Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Customer Type Filter */}
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs text-slate-600">
              <span className="text-slate-400 font-medium">Type:</span>
              <select
                value={customerTypeFilter}
                onChange={(e) => setCustomerTypeFilter(e.target.value as any)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Types</option>
                <option value="B2C">B2C (Residential)</option>
                <option value="B2B">B2B (Commercial)</option>
              </select>
            </div>

            {/* Financing Filter */}
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs text-slate-600">
              <span className="text-slate-400 font-medium">Financing:</span>
              <select
                value={financingFilter}
                onChange={(e) => setFinancingFilter(e.target.value as any)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All (Loan & Cash)</option>
                <option value="YES">Financing: YES</option>
                <option value="NO">Financing: NO</option>
              </select>
            </div>
          </div>
        </div>

        {/* Work Queue Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-3">ECP ID</th>
                <th className="py-3 px-3">Stage</th>
                <th className="py-3 px-4">Current Task</th>
                <th className="py-3 px-3 text-center">Financing</th>
                <th className="py-3 px-3">Days / SLA</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs font-medium">Loading Registration work queue...</p>
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No projects in this queue</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {queueFilter === 'DELAYED'
                        ? 'Great job! No registration tasks are currently overdue.'
                        : 'Adjust filters or check back when new projects complete documentation.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const isStageReg1 = lead.stage === 'REGISTRATION_1';
                  const isStageNet = lead.stage === 'NET_METERING';
                  const isStageReg2 = lead.stage === 'REGISTRATION_2';

                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        lead.is_delayed ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Customer Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">
                          {lead.customer_name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-slate-500 text-[11px]">
                          <span>{lead.mobile_number}</span>
                          {lead.location && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[140px]">{lead.location}</span>
                            </>
                          )}
                          {lead.capacity_kwp && (
                            <>
                              <span>•</span>
                              <span className="font-semibold text-indigo-700">
                                {lead.capacity_kwp} kWp
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* ECP ID */}
                      <td className="py-3.5 px-3">
                        <button
                          type="button"
                          onClick={() => onOpenLeadDetails(lead.id)}
                          className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                        >
                          LD-{lead.lead_number}
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </button>
                        <span className="text-[10px] text-slate-400 block font-medium">
                          {lead.customer_type}
                        </span>
                      </td>

                      {/* Stage Badge */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {isStageReg1 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <FileText className="w-3 h-3" /> Registration 1
                          </span>
                        ) : isStageNet ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Zap className="w-3 h-3" /> Net Metering
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                            <ShieldCheck className="w-3 h-3" /> Registration 2
                          </span>
                        )}
                      </td>

                      {/* Current Task */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          {lead.current_task_code === 'CLOSE_NET_METERING' ? (
                            <Hammer className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          ) : lead.overall_status === 'COMPLETED' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          )}
                          <span className="truncate max-w-[220px]">
                            {lead.current_task_name || 'Tasks in progress'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {lead.completed_tasks_count} of {lead.total_tasks_count} tasks completed
                        </div>
                      </td>

                      {/* Financing */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            lead.financing_required
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {lead.financing_required ? 'YES' : 'NO'}
                        </span>
                      </td>

                      {/* Days in Stage / SLA */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-bold ${
                              lead.is_delayed ? 'text-rose-600' : 'text-slate-700'
                            }`}
                          >
                            {lead.days_in_stage} {lead.days_in_stage === 1 ? 'day' : 'days'}
                          </span>
                          {lead.is_delayed && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                              OVERDUE
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block">SLA: 5 Days</span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            lead.overall_status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : lead.overall_status === 'ACTIONABLE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                              : lead.overall_status === 'BLOCKED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {lead.overall_status === 'ACTIONABLE'
                            ? 'Ready'
                            : lead.overall_status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedLeadForTask(lead)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-2xs flex items-center gap-1"
                          >
                            Process Task
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenLeadDetails(lead.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Open Full ECP Details"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task Modal */}
      {selectedLeadForTask && (
        <RegistrationTaskModal
          leadItem={selectedLeadForTask}
          currentUser={currentUser}
          onClose={() => setSelectedLeadForTask(null)}
          onTaskCompleted={() => {
            fetchWorkspaceData();
          }}
          onOpenLeadDetails={onOpenLeadDetails}
        />
      )}
    </div>
  );
};
