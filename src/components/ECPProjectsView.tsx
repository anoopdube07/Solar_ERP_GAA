import React, { useState } from 'react';
import {
  Layers,
  FileCheck,
  Search,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Lead, User } from '../../shared/types';
import { formatINR } from '../lib/api';
import { formatToIST } from '../../shared/timezone';

interface ECPProjectsViewProps {
  leads: Lead[];
  currentUser?: User;
  onSelectLead: (leadId: string, initialTab?: 'documents' | 'commercial') => void;
  onRefresh?: () => void;
  initialStageFilter?: string;
  initialCustomerTypeFilter?: 'ALL' | 'B2C' | 'B2B';
  onClearInitialFilter?: () => void;
}

export const ECPProjectsView: React.FC<ECPProjectsViewProps> = ({
  leads,
  currentUser,
  onSelectLead,
  onRefresh,
  initialStageFilter,
  initialCustomerTypeFilter,
  onClearInitialFilter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>(initialStageFilter || 'ALL');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'ALL' | 'B2C' | 'B2B'>(initialCustomerTypeFilter || 'ALL');
  const isLeadUser = currentUser?.role === 'LEAD';

  React.useEffect(() => {
    if (initialStageFilter !== undefined) {
      setStageFilter(initialStageFilter);
    }
  }, [initialStageFilter]);

  React.useEffect(() => {
    if (initialCustomerTypeFilter !== undefined) {
      setCustomerTypeFilter(initialCustomerTypeFilter);
    }
  }, [initialCustomerTypeFilter]);

  // Filter leads to those eligible for or within the ECP Project pipeline:
  // - Status is QUALIFIED (undergoing documentation)
  // - Status is DOCUMENTATION_COMPLETE or has reached a downstream project stage
  // Pre-qualification leads (SITE_VISIT_PENDING, PENDING, LOST) are excluded.
  const allEcpProjects = leads.filter((lead) => {
    if (
      lead.status === 'SITE_VISIT_PENDING' ||
      lead.status === 'PENDING' ||
      lead.status === 'LOST' ||
      lead.status === 'ESCALATED_TO_OWNER'
    ) {
      return false;
    }
    const isEcpStage =
      lead.status === 'QUALIFIED' ||
      lead.status === 'DOCUMENTATION_COMPLETE' ||
      (Boolean(lead.project_stage) && !['LEAD', 'LOST'].includes(lead.project_stage as string));
    return isEcpStage;
  });

  // Calculate top KPI numbers
  const inDocsCount = allEcpProjects.filter(
    (l) => l.project_stage === 'IN_DOCS' || ((l.status === 'QUALIFIED' || l.documentation_status === 'PENDING') && ['LEAD', 'LEAD_TEAM'].includes(l.current_team))
  ).length;

  const reg1Count = allEcpProjects.filter(
    (l) => l.project_stage === 'REGISTRATION_1' || l.current_team === 'REGISTRATION_1'
  ).length;

  const netMeteringCount = allEcpProjects.filter(
    (l) => l.project_stage === 'NET_METERING'
  ).length;

  const reg2Count = allEcpProjects.filter(
    (l) => l.project_stage === 'REGISTRATION_2'
  ).length;

  const dispatchCount = allEcpProjects.filter(
    (l) => l.project_stage === 'DISPATCH' || ['DISPATCH', 'DISPATCH_TEAM'].includes(l.current_team)
  ).length;

  const installationCount = allEcpProjects.filter(
    (l) =>
      l.project_stage === 'INSTALLATION' ||
      (['INSTALLATION_MANAGER', 'INSTALLATION_TEAM'].includes(l.current_team) &&
        l.status !== 'SITE_VISIT_PENDING')
  ).length;

  const completedCount = allEcpProjects.filter(
    (l) => l.project_stage === 'COMPLETED' || (l.customer_type === 'B2B' && (l.status === 'DOCUMENTATION_COMPLETE' || l.dispatch_status === 'DELIVERED'))
  ).length;

  // B2B specific counts
  const b2bCreditCount = allEcpProjects.filter(
    (l) =>
      l.customer_type === 'B2B' &&
      ((l.b2b_credit_extended === 'YES' && l.owner_credit_decision !== 'APPROVED') ||
        l.status === 'OWNER_CREDIT_APPROVAL' ||
        l.status === 'ESCALATED_TO_OWNER')
  ).length;

  const b2bAccountsCount = allEcpProjects.filter(
    (l) =>
      l.customer_type === 'B2B' &&
      (l.current_team === 'ACCOUNTS' ||
        l.current_team === 'ACCOUNTS_PLACEHOLDER' ||
        l.dispatch_status === 'PENDING_ADVANCE' ||
        l.project_stage === 'ACCOUNTS')
  ).length;

  const b2bDispatchCount = allEcpProjects.filter(
    (l) =>
      l.customer_type === 'B2B' &&
      (l.project_stage === 'DISPATCH' ||
        ['DISPATCH', 'DISPATCH_TEAM'].includes(l.current_team) ||
        ['READY_FOR_DISPATCH', 'DISPATCHED'].includes(l.dispatch_status as string))
  ).length;

  const b2bCompletedCount = allEcpProjects.filter(
    (l) =>
      l.customer_type === 'B2B' &&
      (l.project_stage === 'COMPLETED' ||
        l.status === 'DOCUMENTATION_COMPLETE' ||
        l.dispatch_status === 'DELIVERED')
  ).length;

  const totalValue = allEcpProjects.reduce((sum, l) => sum + (Number(l.total_project_value) || 0), 0);

  // Filtered list
  const filteredProjects = allEcpProjects.filter((lead) => {
    // Search query
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      lead.customer_name.toLowerCase().includes(q) ||
      lead.mobile_number.includes(q) ||
      lead.lead_number.toString().includes(q) ||
      (lead.location && lead.location.toLowerCase().includes(q));

    // Customer type
    const matchesType = customerTypeFilter === 'ALL' || lead.customer_type === customerTypeFilter;

    // Stage filter
    let matchesStage = true;
    if (stageFilter === 'ALL') {
      matchesStage = true;
    } else if (stageFilter === 'IN_DOCS') {
      matchesStage =
        lead.project_stage === 'IN_DOCS' ||
        ((lead.status === 'QUALIFIED' || lead.documentation_status === 'PENDING') &&
          ['LEAD', 'LEAD_TEAM'].includes(lead.current_team));
    } else if (stageFilter === 'REGISTRATION_1') {
      matchesStage =
        lead.project_stage === 'REGISTRATION_1' ||
        lead.current_team === 'REGISTRATION_1' ||
        (lead.status === 'DOCUMENTATION_COMPLETE' &&
          !['INSTALLATION_MANAGER', 'INSTALLATION_TEAM', 'DISPATCH', 'DISPATCH_TEAM'].includes(
            lead.current_team
          ));
    } else if (stageFilter === 'NET_METERING') {
      matchesStage = lead.project_stage === 'NET_METERING';
    } else if (stageFilter === 'REGISTRATION_2') {
      matchesStage = lead.project_stage === 'REGISTRATION_2';
    } else if (stageFilter === 'DISPATCH') {
      matchesStage =
        lead.project_stage === 'DISPATCH' ||
        ['DISPATCH', 'DISPATCH_TEAM'].includes(lead.current_team) ||
        ['READY_FOR_DISPATCH', 'DISPATCHED'].includes(lead.dispatch_status as string);
    } else if (stageFilter === 'INSTALLATION') {
      matchesStage =
        lead.project_stage === 'INSTALLATION' ||
        (['INSTALLATION_MANAGER', 'INSTALLATION_TEAM'].includes(lead.current_team) &&
          lead.status !== 'SITE_VISIT_PENDING');
    } else if (stageFilter === 'CREDIT_APPROVAL') {
      matchesStage =
        (lead.b2b_credit_extended === 'YES' && lead.owner_credit_decision !== 'APPROVED') ||
        lead.status === 'OWNER_CREDIT_APPROVAL' ||
        lead.status === 'ESCALATED_TO_OWNER';
    } else if (stageFilter === 'ACCOUNTS') {
      matchesStage =
        lead.current_team === 'ACCOUNTS' ||
        lead.current_team === 'ACCOUNTS_PLACEHOLDER' ||
        lead.dispatch_status === 'PENDING_ADVANCE' ||
        lead.project_stage === 'ACCOUNTS';
    } else if (stageFilter === 'COMPLETED') {
      matchesStage =
        lead.project_stage === 'COMPLETED' ||
        (lead.customer_type === 'B2B' && (lead.status === 'DOCUMENTATION_COMPLETE' || lead.dispatch_status === 'DELIVERED'));
    }

    return matchesSearch && matchesType && matchesStage;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ECP Projects</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
              {allEcpProjects.length} Active Projects
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Empanelled Channel Partner & PM Surya Ghar Rooftop Documentation & Registration Workspace.
          </p>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Projects</span>
          </button>
        )}
      </div>

      {/* 2. Top Metric Cards */}
      {customerTypeFilter === 'B2B' ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div
            onClick={() => { setStageFilter('ALL'); onClearInitialFilter?.(); }}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              stageFilter === 'ALL'
                ? 'bg-blue-50/90 border-blue-300 ring-2 ring-blue-500 shadow-xs'
                : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-500">All B2B Projects</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{allEcpProjects.filter(l => l.customer_type === 'B2B').length}</div>
          </div>

          <div
            onClick={() => setStageFilter('CREDIT_APPROVAL')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              stageFilter === 'CREDIT_APPROVAL'
                ? 'bg-rose-50/90 border-rose-300 ring-2 ring-rose-500 shadow-xs'
                : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="text-[11px] font-semibold text-rose-700">Credit Approval Pending</div>
            <div className="text-xl font-bold text-rose-900 mt-0.5">{b2bCreditCount}</div>
          </div>

          <div
            onClick={() => setStageFilter('DISPATCH')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              stageFilter === 'DISPATCH'
                ? 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-500 shadow-xs'
                : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="text-[11px] font-semibold text-indigo-700">Dispatch</div>
            <div className="text-xl font-bold text-indigo-900 mt-0.5">{b2bDispatchCount}</div>
          </div>

          <div
            onClick={() => setStageFilter('ACCOUNTS')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              stageFilter === 'ACCOUNTS'
                ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-500 shadow-xs'
                : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="text-[11px] font-semibold text-amber-700">Account</div>
            <div className="text-xl font-bold text-amber-900 mt-0.5">{b2bAccountsCount}</div>
          </div>

          <div
            onClick={() => setStageFilter('COMPLETED')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              stageFilter === 'COMPLETED'
                ? 'bg-emerald-50/90 border-emerald-300 ring-2 ring-emerald-500 shadow-xs'
                : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="text-[11px] font-semibold text-emerald-700">Completed</div>
            <div className="text-xl font-bold text-emerald-900 mt-0.5">{b2bCompletedCount}</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          <div
            onClick={() => { setStageFilter('ALL'); onClearInitialFilter?.(); }}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              stageFilter === 'ALL'
                ? 'bg-blue-50/90 border-blue-300 ring-2 ring-blue-500 shadow-xs'
                : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-500">All Projects</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{allEcpProjects.length}</div>
          </div>

          <div
            onClick={() => setStageFilter('IN_DOCS')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              stageFilter === 'IN_DOCS'
                ? 'bg-purple-50/90 border-purple-300 ring-2 ring-purple-500 shadow-xs'
                : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-500">Documentation</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{inDocsCount}</div>
          </div>

          <div
            onClick={() => setStageFilter('REGISTRATION_1')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              stageFilter === 'REGISTRATION_1'
                ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-500 shadow-xs'
                : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-500">Registration 1</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{reg1Count}</div>
          </div>

          <div
            onClick={() => setStageFilter('NET_METERING')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              stageFilter === 'NET_METERING'
                ? 'bg-teal-50/90 border-teal-300 ring-2 ring-teal-500 shadow-xs'
                : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-500">Net Metering</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{netMeteringCount}</div>
          </div>

          <div
            onClick={() => setStageFilter('REGISTRATION_2')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              stageFilter === 'REGISTRATION_2'
                ? 'bg-cyan-50/90 border-cyan-300 ring-2 ring-cyan-500 shadow-xs'
                : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-500">Registration 2</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{reg2Count}</div>
          </div>

          <div
            onClick={() => setStageFilter('DISPATCH')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              stageFilter === 'DISPATCH'
                ? 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-500 shadow-xs'
                : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-500">Dispatch</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{dispatchCount}</div>
          </div>

          <div
            onClick={() => setStageFilter('INSTALLATION')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              stageFilter === 'INSTALLATION'
                ? 'bg-orange-50/90 border-orange-300 ring-2 ring-orange-500 shadow-xs'
                : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-500">Installation</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{installationCount}</div>
          </div>

          <div
            onClick={() => setStageFilter('COMPLETED')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              stageFilter === 'COMPLETED'
                ? 'bg-emerald-50/90 border-emerald-300 ring-2 ring-emerald-500 shadow-xs'
                : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-500">Completed</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{completedCount}</div>
          </div>
        </div>
      )}

      {/* 3. Table with Filter Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
        {/* Search & Tabs */}
        <div className="p-3.5 border-b border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/60">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search project, customer, mobile..."
              className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto text-xs">
            {/* Quick Stage Filters (hidden for Lead user) */}
            {!isLeadUser && (
              <div className="flex bg-slate-200/60 p-1 rounded-xl overflow-x-auto shrink-0">
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'IN_DOCS', label: 'Docs' },
                  { id: 'REGISTRATION_1', label: 'Reg 1' },
                  { id: 'NET_METERING', label: 'Net Metering' },
                  { id: 'REGISTRATION_2', label: 'Reg 2' },
                  { id: 'DISPATCH', label: 'Dispatch' },
                  { id: 'INSTALLATION', label: 'Installation' },
                  { id: 'COMPLETED', label: 'Completed' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStageFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                      stageFilter === tab.id
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {/* Customer Type Filter */}
            <select
              value={customerTypeFilter}
              onChange={(e) => setCustomerTypeFilter(e.target.value as any)}
              className="bg-white border border-slate-300 text-slate-700 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 shadow-xs shrink-0 font-medium"
            >
              <option value="ALL">All Types (B2C & B2B)</option>
              <option value="B2C">B2C Only</option>
              <option value="B2B">B2B Only</option>
            </select>

            {(stageFilter !== 'ALL' || customerTypeFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setStageFilter('ALL');
                  setCustomerTypeFilter('ALL');
                  onClearInitialFilter?.();
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 shrink-0"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Mobile ECP Card List (shown on < 768px screens for touch-friendly mobile usability) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredProjects.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs px-4">
              <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-600">No ECP Projects found</p>
              <p className="text-xs text-slate-400 mt-1">
                {searchTerm || stageFilter !== 'ALL'
                  ? 'Try adjusting your search query or stage filters.'
                  : 'No qualified projects are currently in ECP workflow.'}
              </p>
            </div>
          ) : (
            filteredProjects.map((lead) => {
              const isHandedOff = lead.current_team !== 'LEAD';
              return (
                <div
                  key={`mobile-ecp-${lead.id}`}
                  onClick={() => onSelectLead(lead.id, 'documents')}
                  className="p-3.5 hover:bg-slate-50 active:bg-blue-50/40 transition-colors cursor-pointer space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-blue-600 text-xs bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                        #{lead.lead_number}
                      </span>
                      <span className="font-bold text-slate-900 text-sm truncate">
                        {lead.customer_name}
                      </span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                      {lead.customer_type}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono text-[11px]">📱 {lead.mobile_number}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        lead.current_team?.includes('REGISTRATION')
                          ? 'bg-teal-50 text-teal-700 border-teal-200'
                          : lead.current_team?.includes('DISPATCH')
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : lead.current_team?.includes('INSTALLATION')
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {lead.current_team ? lead.current_team.replace(/_/g, ' ') : 'Lead Team'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    {lead.status === 'DOCUMENTATION_COMPLETE' ||
                    lead.documentation_status === 'COMPLETED' ||
                    isHandedOff ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Completed</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                        <Clock className="w-3 h-3" />
                        <span>In Progress</span>
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLead(lead.id, 'documents');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold shadow-xs"
                      >
                        <FileCheck className="w-3 h-3" />
                        <span>ECP Docs</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLead(lead.id);
                        }}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop ECP Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Lead / Project ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Type</th>
                {currentUser?.role !== 'INSTALLATION_MEMBER' && (
                  <th className="py-3 px-4">Project Value</th>
                )}
                <th className="py-3 px-4">ECP Documentation Gate</th>
                <th className="py-3 px-4">Current Team</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={currentUser?.role !== 'INSTALLATION_MEMBER' ? 7 : 6} className="py-12 text-center text-slate-400">
                    <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-600">No ECP Projects found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchTerm || stageFilter !== 'ALL'
                        ? 'Try clearing your search or filter filters.'
                        : 'Move leads to "Qualified" to start ECP document verification.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredProjects.map((lead) => {
                  const isHandedOff =
                    lead.status === 'DOCUMENTATION_COMPLETE' ||
                    lead.current_team === 'REGISTRATION_1' ||
                    lead.current_team === 'REGISTRATION_TEAM';

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                        LD-2025-{String(lead.lead_number).padStart(4, '0')}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{lead.customer_name}</div>
                        <div className="text-[11px] text-slate-500">{lead.location || 'Location not specified'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            lead.customer_type === 'B2B'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {lead.customer_type}
                        </span>
                      </td>
                      {currentUser?.role !== 'INSTALLATION_MEMBER' && (
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {formatINR(lead.total_project_value || 0)}
                        </td>
                      )}
                      <td className="py-3.5 px-4">
                        {lead.status === 'DOCUMENTATION_COMPLETE' ||
                        lead.documentation_status === 'COMPLETED' ||
                        isHandedOff ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Gate Verified • Completed</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <Clock className="w-3 h-3" />
                            <span>Documents In Progress</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            lead.current_team?.includes('REGISTRATION')
                              ? 'bg-teal-50 text-teal-700 border-teal-200'
                              : lead.current_team?.includes('DISPATCH')
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : lead.current_team?.includes('INSTALLATION')
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {lead.current_team ? lead.current_team.replace(/_/g, ' ') : 'Lead Team'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectLead(lead.id, 'documents')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold transition-colors shadow-xs"
                          >
                            <FileCheck className="w-3 h-3" />
                            <span>ECP Workspace</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectLead(lead.id)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                          >
                            Details
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
    </div>
  );
};
