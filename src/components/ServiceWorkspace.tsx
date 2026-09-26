import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Zap,
  Wrench,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  Filter,
  User as UserIcon,
  Phone,
  MapPin,
  Calendar,
  Layers,
  ShieldCheck,
  ChevronRight,
  Info,
  Star,
  Cpu,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import type {
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  Lead,
  ServiceComplaint,
  ServiceMetrics,
  User,
} from '../../shared/types.ts';
import { apiRequest } from '../lib/api.ts';
import { RegisterComplaintModal } from './RegisterComplaintModal.tsx';
import { ComplaintDetailModal } from './ComplaintDetailModal.tsx';

interface ServiceWorkspaceProps {
  currentUser?: User;
  onOpenLeadDetails?: (leadId: string) => void;
}

const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  INVERTER_FAULT: 'Inverter Fault',
  GENERATION_DROP: 'Low Generation',
  PHYSICAL_DAMAGE: 'Panel Damage',
  GRID_TRIPPING: 'Grid Tripping',
  NET_METER_ISSUE: 'Net Metering',
  WIRING_LEAKAGE: 'ACDB / Wiring',
  APP_OFFLINE: 'App Offline',
  OTHER: 'General Service',
};

const STATUS_CONFIG: Record<
  ComplaintStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  OPEN: { label: 'Open (Triage)', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  ASSIGNED: { label: 'Assigned', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  WAITING_PARTS: { label: 'Waiting Parts', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  RESOLVED: { label: 'Resolved', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  CLOSED: { label: 'Closed', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
};

export const ServiceWorkspace: React.FC<ServiceWorkspaceProps> = ({
  currentUser,
  onOpenLeadDetails,
}) => {
  const [complaints, setComplaints] = useState<ServiceComplaint[]>([]);
  const [metrics, setMetrics] = useState<ServiceMetrics | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlySlaAlerts, setOnlySlaAlerts] = useState(false);

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<ServiceComplaint | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const fetchWorkspaceData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [complaintsRes, metricsRes, leadsRes, usersRes] = await Promise.all([
        apiRequest('/api/complaints'),
        apiRequest('/api/complaints/metrics'),
        apiRequest('/api/leads').catch(() => ({ leads: [] })),
        apiRequest('/api/users').catch(() => ({ users: [] })),
      ]);

      setComplaints(complaintsRes.complaints || []);
      setMetrics(metricsRes.metrics || null);
      setLeads(leadsRes.leads || []);
      setAllUsers(usersRes.users || []);
    } catch (err) {
      console.error('Failed to load service complaints data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaceData();
  }, [fetchWorkspaceData]);

  // Refresh single complaint details if detail modal is open
  const handleRefreshSingle = async () => {
    if (selectedComplaint) {
      try {
        const res = await apiRequest(`/api/complaints/${selectedComplaint.id}`);
        if (res.complaint) {
          setSelectedComplaint(res.complaint);
        }
      } catch (_) {}
    }
    fetchWorkspaceData(true);
  };

  // Filtered complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      // Status filter
      if (statusFilter !== 'ALL' && c.status !== statusFilter) {
        return false;
      }
      // Priority filter
      if (priorityFilter !== 'ALL' && c.priority !== priorityFilter) {
        return false;
      }
      // Category filter
      if (categoryFilter !== 'ALL' && c.category !== categoryFilter) {
        return false;
      }
      // SLA alert only
      if (onlySlaAlerts) {
        const isClosed = c.status === 'RESOLVED' || c.status === 'CLOSED';
        const isOverdue = new Date(c.sla_due_at).getTime() < Date.now();
        if (isClosed || !isOverdue) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTicket = c.ticket_number.toLowerCase().includes(q);
        const matchCustomer = c.customer_name.toLowerCase().includes(q);
        const matchPhone = c.customer_phone.toLowerCase().includes(q);
        const matchCity = (c.city || '').toLowerCase().includes(q);
        const matchSerial = (c.inverter_serial || '').toLowerCase().includes(q);
        const matchTitle = c.title.toLowerCase().includes(q);
        const matchAssignee = (c.assigned_to_name || '').toLowerCase().includes(q);
        if (
          !matchTicket &&
          !matchCustomer &&
          !matchPhone &&
          !matchCity &&
          !matchSerial &&
          !matchTitle &&
          !matchAssignee
        ) {
          return false;
        }
      }
      return true;
    });
  }, [complaints, statusFilter, priorityFilter, categoryFilter, onlySlaAlerts, searchQuery]);

  return (
    <div className="space-y-4 pb-12">
      {/* Top Banner / Breadcrumb & Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              After-Sales & Customer Care
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-medium text-slate-500">
              Role: {currentUser?.role || 'SERVICE'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Service & Complaints Desk
            </h1>
            <div className="relative group/info inline-flex items-center">
              <button
                type="button"
                className="p-1 rounded-full text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-help focus:outline-hidden"
                aria-label="Service Desk Information"
              >
                <Info className="w-4 h-4" />
              </button>
              <div className="absolute left-0 sm:left-1/2 sm:-translate-x-1/2 top-full mt-1.5 z-50 hidden group-hover/info:block w-80 p-3 bg-slate-900 text-white text-xs rounded-xl shadow-xl pointer-events-none transition-all">
                <div className="font-medium leading-relaxed">
                  Operational cockpit to register after-sales complaints, assign technicians, track SLA response times, and record warranty resolution for solar rooftop customers.
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700/80 text-[11px] text-slate-300 leading-normal">
                  <span className="font-bold text-amber-400">Workflow:</span> Register Ticket &rarr; Assign Field Engineer &rarr; Diagnosis & Spares &rarr; Resolution & Customer Rating.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => fetchWorkspaceData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register Complaint</span>
          </button>
        </div>
      </div>

      {/* 6 KPI Metrics Summary Tiles (Interactive Filters) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Tile 1: Total */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('ALL');
            setOnlySlaAlerts(false);
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            statusFilter === 'ALL' && !onlySlaAlerts
              ? 'bg-slate-900 text-white border-slate-950 shadow-md ring-2 ring-slate-700'
              : 'bg-white text-slate-800 border-slate-200/90 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">
              Total Tickets
            </span>
            <Layers className="w-4 h-4 opacity-75" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black">
            {metrics?.total_complaints || 0}
          </div>
          <div className="text-[11px] opacity-75 truncate mt-0.5">All Recorded</div>
        </button>

        {/* Tile 2: Open / Unassigned */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('OPEN');
            setOnlySlaAlerts(false);
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            statusFilter === 'OPEN' && !onlySlaAlerts
              ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md ring-2 ring-amber-400 font-bold'
              : 'bg-white text-slate-800 border-slate-200/90 hover:border-amber-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Unassigned
            </span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-amber-950">
            {metrics?.open_unassigned || 0}
          </div>
          <div className="text-[11px] text-amber-800 truncate mt-0.5">Needs Triage</div>
        </button>

        {/* Tile 3: In Progress */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('IN_PROGRESS');
            setOnlySlaAlerts(false);
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            statusFilter === 'IN_PROGRESS' && !onlySlaAlerts
              ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-500'
              : 'bg-white text-slate-800 border-slate-200/90 hover:border-indigo-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">
              In Progress
            </span>
            <Wrench className="w-4 h-4 opacity-75" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black">
            {metrics?.in_progress || 0}
          </div>
          <div className="text-[11px] opacity-75 truncate mt-0.5">Field Diagnosis</div>
        </button>

        {/* Tile 4: Awaiting Parts */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('WAITING_PARTS');
            setOnlySlaAlerts(false);
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            statusFilter === 'WAITING_PARTS' && !onlySlaAlerts
              ? 'bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-500'
              : 'bg-white text-slate-800 border-slate-200/90 hover:border-purple-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">
              OEM Parts
            </span>
            <Cpu className="w-4 h-4 opacity-75" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black">
            {metrics?.waiting_parts || 0}
          </div>
          <div className="text-[11px] opacity-75 truncate mt-0.5">Warranty Claim</div>
        </button>

        {/* Tile 5: Resolved */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('RESOLVED');
            setOnlySlaAlerts(false);
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            statusFilter === 'RESOLVED' && !onlySlaAlerts
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-500'
              : 'bg-white text-slate-800 border-slate-200/90 hover:border-emerald-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">
              Resolved
            </span>
            <CheckCircle2 className="w-4 h-4 opacity-75" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black">
            {metrics?.resolved_count || 0}
          </div>
          <div className="text-[11px] opacity-75 truncate mt-0.5">Fixed & Closed</div>
        </button>

        {/* Tile 6: SLA Breached Alert */}
        <button
          type="button"
          onClick={() => {
            setOnlySlaAlerts(!onlySlaAlerts);
            setStatusFilter('ALL');
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            onlySlaAlerts
              ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-500 font-bold'
              : (metrics?.sla_breached || 0) > 0
              ? 'bg-rose-50 text-rose-900 border-rose-300 hover:border-rose-400'
              : 'bg-white text-slate-800 border-slate-200/90'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              SLA Overdue
            </span>
            <AlertTriangle className={`w-4 h-4 ${(metrics?.sla_breached || 0) > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-rose-600">
            <span className={onlySlaAlerts ? 'text-white' : ''}>
              {metrics?.sla_breached || 0}
            </span>
          </div>
          <div className="text-[11px] opacity-80 truncate mt-0.5">Target Breached</div>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Ticket #, Customer, Phone, City, Inverter Serial..."
            className="w-full pl-10 pr-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Select */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setOnlySlaAlerts(false);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-amber-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open (Unassigned)</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="WAITING_PARTS">Waiting Parts</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          {/* Priority Select */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-amber-500"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical (24h SLA)</option>
            <option value="HIGH">High (48h SLA)</option>
            <option value="MEDIUM">Medium (72h SLA)</option>
            <option value="LOW">Low (5 Days)</option>
          </select>

          {/* Category Select */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-amber-500"
          >
            <option value="ALL">All Categories</option>
            <option value="INVERTER_FAULT">Inverter Fault</option>
            <option value="GENERATION_DROP">Generation Drop</option>
            <option value="GRID_TRIPPING">Grid Tripping</option>
            <option value="APP_OFFLINE">Monitoring Offline</option>
            <option value="WIRING_LEAKAGE">Wiring / ACDB</option>
            <option value="PHYSICAL_DAMAGE">Panel Damage</option>
            <option value="NET_METER_ISSUE">Net Metering</option>
            <option value="OTHER">General Support</option>
          </select>

          {/* Clear Filter button if active */}
          {(statusFilter !== 'ALL' || priorityFilter !== 'ALL' || categoryFilter !== 'ALL' || searchQuery || onlySlaAlerts) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
                setCategoryFilter('ALL');
                setSearchQuery('');
                setOnlySlaAlerts(false);
              }}
              className="px-2.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Complaints Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/90 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Ticket & Date</th>
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-4">Complaint Title & Category</th>
                <th className="py-3 px-4">Priority & SLA</th>
                <th className="py-3 px-4">Field Assignee</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
                      <span>Loading service tickets...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredComplaints.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <ShieldCheck className="w-8 h-8 text-slate-300" />
                      <span className="font-semibold text-slate-600 text-sm">
                        No Complaints Matching Query
                      </span>
                      <span className="text-xs text-slate-400">
                        Try modifying search or clear filters to view tickets.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredComplaints.map((comp) => {
                  const statusBadge = STATUS_CONFIG[comp.status] || STATUS_CONFIG.OPEN;
                  const isClosed = comp.status === 'RESOLVED' || comp.status === 'CLOSED';
                  const slaTime = new Date(comp.sla_due_at).getTime();
                  const isOverdue = !isClosed && slaTime < Date.now();
                  const hoursLeft = Math.round((slaTime - Date.now()) / (1000 * 60 * 60));

                  return (
                    <tr
                      key={comp.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => {
                        setSelectedComplaint(comp);
                        setShowDetailModal(true);
                      }}
                    >
                      {/* Ticket # & Date */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900">
                          {comp.ticket_number}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px]">
                            {comp.reported_channel}
                          </span>
                          <span>{new Date(comp.reported_at).toLocaleDateString('en-IN')}</span>
                        </div>
                      </td>

                      {/* Customer Details */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{comp.customer_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{comp.customer_phone}</span>
                        </div>
                        {comp.city && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {comp.city} {comp.system_capacity_kw ? `• ${comp.system_capacity_kw} kW` : ''}
                          </div>
                        )}
                      </td>

                      {/* Issue & Category */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-800 line-clamp-1">
                          {comp.title}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {CATEGORY_LABELS[comp.category] || comp.category}
                          </span>
                          {comp.inverter_serial && (
                            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                              SN: {comp.inverter_serial}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Priority & SLA */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              comp.priority === 'CRITICAL'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : comp.priority === 'HIGH'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {comp.priority}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px]">
                          {isClosed ? (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Completed
                            </span>
                          ) : isOverdue ? (
                            <span className="text-rose-600 font-bold flex items-center gap-1 animate-pulse">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              SLA Breached
                            </span>
                          ) : (
                            <span className="text-slate-600 font-medium flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              Due in {hoursLeft}h
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Field Assignee */}
                      <td className="py-3.5 px-4">
                        {comp.assigned_to_name ? (
                          <div>
                            <div className="font-semibold text-slate-900">
                              {comp.assigned_to_name}
                            </div>
                            <div className="text-[10px] text-slate-400">Field Assigned</div>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                        >
                          {statusBadge.label}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedComplaint(comp);
                            setShowDetailModal(true);
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Manage</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Complaint Modal */}
      <RegisterComplaintModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onSuccess={(_complaint) => {
          fetchWorkspaceData(true);
        }}
        leads={leads}
        users={allUsers}
      />

      {/* Complaint Detail & Workflow Modal */}
      <ComplaintDetailModal
        isOpen={showDetailModal}
        complaint={selectedComplaint}
        currentUser={currentUser}
        users={allUsers}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedComplaint(null);
        }}
        onRefresh={handleRefreshSingle}
      />
    </div>
  );
};
