import React, { useState } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Compass,
  AlertCircle,
  Eye,
  Building2,
  User as UserIcon,
  Calendar,
  Edit3,
} from 'lucide-react';
import { Lead, User } from '../../shared/types';
import { formatINR } from '../lib/api';
import { formatToIST } from '../../shared/timezone';

interface LeadTableProps {
  leads: Lead[];
  onSelectLead: (leadId: string) => void;
  activeFilter: string;
  onClearFilter: () => void;
  currentUser?: User;
  initialCustomerTypeFilter?: 'ALL' | 'B2C' | 'B2B';
}

export const LeadTable: React.FC<LeadTableProps> = ({
  leads,
  onSelectLead,
  activeFilter,
  onClearFilter,
  currentUser,
  initialCustomerTypeFilter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'ALL' | 'B2C' | 'B2B'>(initialCustomerTypeFilter || 'ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const isLeadUser = currentUser?.role === 'LEAD';

  React.useEffect(() => {
    if (initialCustomerTypeFilter !== undefined) {
      setCustomerTypeFilter(initialCustomerTypeFilter);
    }
  }, [initialCustomerTypeFilter]);

  // Filter leads
  const filteredLeads = leads.filter((lead) => {
    // Search query matches customer name, mobile, or lead number
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      lead.customer_name.toLowerCase().includes(q) ||
      lead.mobile_number.includes(q) ||
      lead.lead_number.toString().includes(q) ||
      (lead.location && lead.location.toLowerCase().includes(q));

    // Customer type filter
    const matchesType = customerTypeFilter === 'ALL' || lead.customer_type === customerTypeFilter;

    // Status filter
    const matchesStatus = statusFilter === 'ALL' || lead.status === statusFilter;

    // Metric card activeFilter
    let matchesCardFilter = true;
    if (activeFilter === 'MY_LEADS' || activeFilter === 'ALL') {
      matchesCardFilter = true;
    } else if (activeFilter === 'PENDING_ACTION' || activeFilter === 'ACTION_REQUIRED') {
      matchesCardFilter =
        lead.status !== 'LOST' &&
        lead.status !== 'SITE_VISIT_PENDING' &&
        lead.status !== 'ESCALATED_TO_OWNER' &&
        lead.status !== 'OWNER_CREDIT_APPROVAL' &&
        ['LEAD', 'LEAD_TEAM'].includes(lead.current_team) &&
        (Boolean(lead.action_required) || lead.status === 'PENDING');
    } else if (activeFilter === 'PENDING' || activeFilter === 'NEW') {
      matchesCardFilter = lead.status === 'PENDING';
    } else if (activeFilter === 'FOLLOWUPS' || activeFilter === 'FOLLOW_UP') {
      const hasFollowUp = Boolean(
        (lead.follow_up_count && Number(lead.follow_up_count) > 0) ||
        lead.has_follow_up ||
        (lead.follow_ups && lead.follow_ups.length > 0)
      );
      matchesCardFilter =
        hasFollowUp && (lead.status === 'PENDING' || lead.status === 'SITE_VISIT_PENDING');
    } else if (activeFilter === 'ESCALATED' || activeFilter === 'ESCALATED_TO_OWNER') {
      matchesCardFilter =
        lead.status === 'ESCALATED_TO_OWNER' ||
        lead.status === 'OWNER_CREDIT_APPROVAL' ||
        lead.current_team === 'OWNER';
    } else if (activeFilter === 'SITE_VISIT_PENDING' || activeFilter === 'SITE_VISIT') {
      matchesCardFilter = lead.status === 'SITE_VISIT_PENDING';
    } else if (activeFilter === 'SITE_VISITS_COMPLETED') {
      matchesCardFilter = lead.status === 'PENDING' && lead.current_team === 'LEAD_TEAM' && lead.action_required;
    } else if (activeFilter === 'ESCALATIONS_RETURNED') {
      matchesCardFilter = lead.status === 'PENDING' && lead.current_team === 'LEAD_TEAM' && lead.action_required;
    } else if (activeFilter === 'CREDIT_RETURNED') {
      matchesCardFilter = lead.status === 'PENDING' && lead.current_team === 'LEAD_TEAM' && lead.action_required;
    } else if (
      activeFilter === 'QUALIFIED' ||
      activeFilter === 'QUALIFIED_DOCS' ||
      activeFilter === 'IN_DOCUMENTATION' ||
      activeFilter === 'IN_DOCS' ||
      activeFilter === 'IN_DOCS_STAGE'
    ) {
      matchesCardFilter =
        lead.status === 'QUALIFIED' ||
        lead.documentation_status === 'PENDING' ||
        lead.status === 'DOCUMENTATION_COMPLETE';
    } else if (activeFilter === 'REGISTRATION' || activeFilter === 'REGISTRATION_STAGE') {
      matchesCardFilter =
        lead.status === 'DOCUMENTATION_COMPLETE' ||
        lead.current_team === 'REGISTRATION_1' ||
        lead.current_team === 'REGISTRATION_TEAM';
    } else if (activeFilter === 'LOST' || activeFilter === 'LOST_STAGE') {
      matchesCardFilter = lead.status === 'LOST';
    }

    return matchesSearch && matchesType && matchesStatus && matchesCardFilter;
  });

  const getFilterDisplayName = (filter: string) => {
    switch (filter) {
      case 'ALL':
        return 'Total Leads';
      case 'PENDING_ACTION':
      case 'ACTION_REQUIRED':
        return 'Action Required';
      case 'ESCALATED':
      case 'ESCALATED_TO_OWNER':
        return 'Escalated to Owner';
      case 'SITE_VISIT_PENDING':
      case 'SITE_VISIT':
        return 'Site Visit Pending';
      case 'MY_LEADS':
        return 'My Leads';
      case 'FOLLOWUPS':
      case 'FOLLOW_UP':
        return 'In Follow-up';
      case 'QUALIFIED':
      case 'QUALIFIED_DOCS':
        return 'Qualified (ECP Pending Documentation)';
      case 'IN_DOCS':
      case 'IN_DOCS_STAGE':
      case 'IN_DOCUMENTATION':
        return 'In ECP Documentation';
      case 'REGISTRATION':
      case 'REGISTRATION_STAGE':
        return 'Moved to Registration';
      case 'LOST':
      case 'LOST_STAGE':
        return 'Lost Leads';
      case 'NEW':
        return 'New / Unassigned';
      default:
        return filter.replace(/_/g, ' ');
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
      {/* Search & Filter Bar */}
      <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/60">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search name, mobile, lead #, city..."
            className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto text-xs">
          {/* Active Card Filter Indicator */}
          {activeFilter !== 'ALL' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl font-semibold">
              <span>Filter: {getFilterDisplayName(activeFilter)} ({filteredLeads.length})</span>
              <button
                type="button"
                onClick={onClearFilter}
                className="hover:text-blue-900 font-bold ml-1 text-sm leading-none"
              >
                &times;
              </button>
            </div>
          )}

          {/* Type Filter */}
          <select
            aria-label="Filter by customer type"
            value={customerTypeFilter}
            onChange={(e) => setCustomerTypeFilter(e.target.value as any)}
            className="bg-white border border-slate-300 text-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Types (B2C & B2B)</option>
            <option value="B2C">B2C (Residential)</option>
            <option value="B2B">B2B (Commercial)</option>
          </select>

          {/* Status Filter */}
          <select
            aria-label="Filter by lead status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-300 text-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="SITE_VISIT_PENDING">SITE VISIT PENDING</option>
            <option value="ESCALATED_TO_OWNER">ESCALATED TO OWNER</option>
            <option value="OWNER_CREDIT_APPROVAL">OWNER CREDIT APPROVAL</option>
            <option value="QUALIFIED">QUALIFIED</option>
            <option value="DOCUMENTATION_COMPLETE">DOCUMENTATION COMPLETE</option>
            <option value="LOST">LOST</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4 w-20">Lead #</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Project Value</th>
              <th className="py-3 px-4">Status & Team</th>
              {!isLeadUser && <th className="py-3 px-4">Assigned Owner</th>}
              <th className="py-3 px-4">Created (IST)</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={isLeadUser ? 7 : 8} className="py-12 text-center text-slate-400">
                  No leads found matching current filters.
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => {
                const isLeadActionRequired =
                  lead.status !== 'LOST' &&
                  lead.status !== 'SITE_VISIT_PENDING' &&
                  lead.status !== 'ESCALATED_TO_OWNER' &&
                  lead.status !== 'OWNER_CREDIT_APPROVAL' &&
                  ['LEAD', 'LEAD_TEAM'].includes(lead.current_team) &&
                  (Boolean(lead.action_required) || lead.status === 'PENDING');

                return (
                  <tr
                    key={lead.id}
                    onClick={() => onSelectLead(lead.id)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    {/* Lead Number */}
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">
                      #{lead.lead_number}
                    </td>

                    {/* Customer Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {lead.customer_name}
                        </span>
                        {isLeadActionRequired && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-50 text-rose-600 border border-rose-200 text-[9px] font-extrabold uppercase">
                            Action Req
                          </span>
                        )}
                      </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span>📱 {lead.mobile_number}</span>
                      {lead.location && <span>• {lead.location}</span>}
                    </div>
                  </td>

                  {/* Type */}
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        lead.customer_type === 'B2B'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {lead.customer_type === 'B2B' ? (
                        <Building2 className="w-3 h-3" />
                      ) : (
                        <UserIcon className="w-3 h-3" />
                      )}
                      {lead.customer_type}
                    </span>
                  </td>

                  {/* Project Value */}
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    {formatINR(lead.total_project_value)}
                  </td>

                  {/* Status & Team */}
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1 items-start">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          lead.status === 'DOCUMENTATION_COMPLETE' || lead.current_team === 'REGISTRATION_1'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : lead.status === 'QUALIFIED'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : lead.status === 'LOST'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : lead.status === 'SITE_VISIT_PENDING'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : lead.status === 'ESCALATED_TO_OWNER'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : lead.status === 'OWNER_CREDIT_APPROVAL'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {lead.status === 'QUALIFIED' && lead.current_team === 'LEAD'
                          ? 'QUALIFIED (DOCS PENDING)'
                          : lead.status.replace(/_/g, ' ')}
                      </span>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-500">Team: {lead.current_team}</span>
                        {(lead.has_follow_up || (lead.follow_up_count && lead.follow_up_count > 0)) && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 border border-sky-200">
                            📞 In Follow-up ({lead.follow_up_count || 1})
                          </span>
                        )}
                        {lead.documentation_status === 'PENDING' && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            Docs In-Progress
                          </span>
                        )}
                        {lead.documentation_status === 'COMPLETED' && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ Docs Complete
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Assigned Lead Owner - Hidden for Lead Team users */}
                  {!isLeadUser && (
                    <td className="py-3 px-4 text-slate-700">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-xs text-slate-900">{lead.owner_name}</span>
                        {currentUser && currentUser.id === lead.owner_id ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 w-fit">
                            Assigned (Edit Rights)
                          </span>
                        ) : currentUser && currentUser.role !== 'OWNER' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded w-fit">
                            View Only
                          </span>
                        ) : null}
                      </div>
                    </td>
                  )}

                  {/* Created At */}
                  <td className="py-3 px-4 text-slate-500 text-[11px] font-mono">
                    {formatToIST(lead.created_at)}
                  </td>

                  {/* Action */}
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLead(lead.id);
                      }}
                      className={`px-2.5 py-1 rounded-lg transition-colors inline-flex items-center gap-1 text-[11px] font-semibold ${
                        currentUser && (currentUser.id === lead.owner_id || currentUser.role === 'OWNER')
                          ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {currentUser && (currentUser.id === lead.owner_id || currentUser.role === 'OWNER') ? (
                        <>
                          <Edit3 className="w-3 h-3 text-blue-600" />
                          <span>Edit</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span>View</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        </table>
      </div>

      <div className="p-3 bg-slate-50/80 border-t border-slate-200 text-[11px] text-slate-500 flex justify-between items-center">
        <span>Showing {filteredLeads.length} of {leads.length} leads in your visibility scope</span>
        <span>Timezone: Asia/Kolkata (IST)</span>
      </div>
    </div>
  );
};
