import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Compass,
  Hammer,
  Gauge,
  Users,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Phone,
  MapPin,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  UserCheck,
  RefreshCw,
  Eye,
  FileCheck,
  Zap,
  Info,
  Layers,
  ArrowUpRight,
  Camera,
  Ruler,
  Image as ImageIcon,
  Crosshair,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  User,
  InstallationMetrics,
  InstallationMemberWorkload,
  InstallationWorkQueueItem,
  SiteVisit,
  RegistrationLeadItem,
} from '../../shared/types';
import { SiteVisitModal } from './SiteVisitModal';
import { AssignInstallerModal } from './AssignInstallerModal';
import { CloseNetMeteringModal } from './CloseNetMeteringModal';
import { PhysicalInstallationModal } from './PhysicalInstallationModal';

interface InstallationManagerWorkspaceProps {
  currentUser: User;
  onOpenLeadDetails?: (leadId: string) => void;
  initialTab?: 'action_required' | 'site_visits' | 'installations' | 'net_metering' | 'team_workload' | 'all_queue';
}

export const InstallationManagerWorkspace: React.FC<InstallationManagerWorkspaceProps> = ({
  currentUser,
  onOpenLeadDetails,
  initialTab = 'action_required',
}) => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<
    'action_required' | 'site_visits' | 'installations' | 'net_metering' | 'team_workload' | 'all_queue'
  >(initialTab);

  // Data States
  const [metrics, setMetrics] = useState<InstallationMetrics | null>(null);
  const [workload, setWorkload] = useState<InstallationMemberWorkload[]>([]);
  const [queueItems, setQueueItems] = useState<InstallationWorkQueueItem[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');
  const [siteVisitSubFilter, setSiteVisitSubFilter] = useState<'ALL' | 'PENDING' | 'ASSIGNED' | 'COMPLETED'>('ALL');
  const [installationSubFilter, setInstallationSubFilter] = useState<'ALL' | 'UNASSIGNED' | 'ASSIGNED' | 'DELAYED'>('ALL');

  // Mobile UX States
  const [mobileActionSubFilter, setMobileActionSubFilter] = useState<'ALL' | 'SURVEYS' | 'INSTALLATIONS' | 'NET_METERING' | 'DELAYED'>('ALL');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Modals State
  const [selectedSiteVisitForAssign, setSelectedSiteVisitForAssign] = useState<SiteVisit | null>(null);
  const [selectedSiteVisitForComplete, setSelectedSiteVisitForComplete] = useState<SiteVisit | null>(null);
  const [selectedSiteVisitForDetails, setSelectedSiteVisitForDetails] = useState<SiteVisit | null>(null);
  const [selectedLeadForAssignInstaller, setSelectedLeadForAssignInstaller] = useState<{
    id: string;
    leadNumber: number;
    customerName: string;
    capacityKwp: number | null;
    currentInstallerId?: string | null;
    currentInstallerName?: string | null;
  } | null>(null);
  const [selectedLeadForCloseNetMetering, setSelectedLeadForCloseNetMetering] = useState<{
    id: string;
    leadNumber: number;
    customerName: string;
    capacityKwp: number | null;
    location: string | null;
  } | null>(null);
  const [selectedLeadForPhysicalInstallation, setSelectedLeadForPhysicalInstallation] = useState<{
    id: string;
    leadNumber: number;
    customerName: string;
    capacityKwp: number | null;
    location: string | null;
  } | null>(null);

  // Load All Installation Manager Data
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [metricsRes, workloadRes, queueRes, usersRes] = await Promise.all([
        apiRequest('/api/installation/metrics').catch(() => ({ metrics: null })),
        apiRequest('/api/installation/workload').catch(() => ({ workload: [] })),
        apiRequest('/api/installation/queue').catch(() => ({ items: [] })),
        apiRequest('/api/users').catch(() => ({ users: [] })),
      ]);

      if (metricsRes.metrics) setMetrics(metricsRes.metrics);
      if (workloadRes.workload) setWorkload(workloadRes.workload);
      if (queueRes.items) setQueueItems(queueRes.items);
      if (usersRes.users) setAllUsers(usersRes.users);
    } catch (err: any) {
      console.error('Failed to load installation manager workspace:', err);
      setError(err.message || 'Failed to load installation data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered Queue computation
  const filteredItems = useMemo(() => {
    let result = queueItems;

    // Filter by Active Tab
    if (activeTab === 'action_required') {
      result = result.filter((item) => {
        if (item.work_type === 'SITE_VISIT') {
          return item.current_status === 'PENDING_ASSIGNMENT' || item.is_delayed;
        }
        if (item.work_type === 'NET_METERING') {
          return item.can_complete;
        }
        if (item.work_type === 'INSTALLATION') {
          return !item.assigned_user_id || item.is_delayed;
        }
        return false;
      });
    } else if (activeTab === 'site_visits') {
      result = result.filter((item) => item.work_type === 'SITE_VISIT');
      if (siteVisitSubFilter === 'PENDING') {
        result = result.filter((item) => item.current_status === 'PENDING_ASSIGNMENT');
      } else if (siteVisitSubFilter === 'ASSIGNED') {
        result = result.filter((item) => item.current_status === 'ASSIGNED');
      } else if (siteVisitSubFilter === 'COMPLETED') {
        result = result.filter((item) => item.current_status === 'COMPLETED');
      }
    } else if (activeTab === 'installations') {
      result = result.filter((item) => item.work_type === 'INSTALLATION');
      if (installationSubFilter === 'UNASSIGNED') {
        result = result.filter((item) => !item.assigned_user_id);
      } else if (installationSubFilter === 'ASSIGNED') {
        result = result.filter((item) => !!item.assigned_user_id);
      } else if (installationSubFilter === 'DELAYED') {
        result = result.filter((item) => item.is_delayed);
      }
    } else if (activeTab === 'net_metering') {
      result = result.filter((item) => item.work_type === 'NET_METERING');
    }

    // Filter by Assignee
    if (assigneeFilter !== 'ALL') {
      if (assigneeFilter === 'UNASSIGNED') {
        result = result.filter((item) => !item.assigned_user_id);
      } else {
        result = result.filter((item) => item.assigned_user_id === assigneeFilter);
      }
    }

    // Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.customer_name.toLowerCase().includes(q) ||
          item.mobile_number.includes(q) ||
          item.lead_number.toString().includes(q) ||
          (item.location && item.location.toLowerCase().includes(q)) ||
          (item.assigned_user_name && item.assigned_user_name.toLowerCase().includes(q))
      );
    }

    return result;
  }, [queueItems, activeTab, assigneeFilter, searchQuery, siteVisitSubFilter, installationSubFilter]);

  // Dynamic counts for tabs & sub-filters
  const counts = useMemo(() => {
    const svItems = queueItems.filter((i) => i.work_type === 'SITE_VISIT');
    const instItems = queueItems.filter((i) => i.work_type === 'INSTALLATION');
    const nmItems = queueItems.filter((i) => i.work_type === 'NET_METERING');

    return {
      svAll: svItems.length,
      svUnassigned: svItems.filter((i) => i.current_status === 'PENDING_ASSIGNMENT' || !i.assigned_user_id).length,
      svAssigned: svItems.filter((i) => i.current_status === 'ASSIGNED').length,
      svCompleted: svItems.filter((i) => i.current_status === 'COMPLETED').length,

      instAll: instItems.length,
      instUnassigned: instItems.filter((i) => !i.assigned_user_id).length,
      instAssigned: instItems.filter((i) => !!i.assigned_user_id).length,
      instDelayed: instItems.filter((i) => i.is_delayed).length,

      nmAll: nmItems.length,
      nmReady: nmItems.filter((i) => i.can_complete).length,
    };
  }, [queueItems]);

  const isManager = currentUser?.role === 'INSTALLATION_MANAGER' || currentUser?.role === 'OWNER';

  // Grouped Action Required counts
  const actionRequiredGroups = useMemo(() => {
    const unassignedSurveys = queueItems.filter(
      (item) => item.work_type === 'SITE_VISIT' && item.current_status === 'PENDING_ASSIGNMENT'
    );
    const unassignedInstallations = queueItems.filter(
      (item) => item.work_type === 'INSTALLATION' && !item.assigned_user_id
    );
    const readyNetMetering = queueItems.filter(
      (item) => item.work_type === 'NET_METERING' && item.can_complete
    );
    const delayedItems = queueItems.filter(
      (item) => item.is_delayed && item.current_status !== 'COMPLETED'
    );

    const technicianAssignedSurveys = queueItems.filter(
      (item) => item.work_type === 'SITE_VISIT' && item.current_status === 'ASSIGNED'
    );
    const technicianAssignedInstallations = queueItems.filter(
      (item) => item.work_type === 'INSTALLATION' && !item.has_all_photos
    );

    return {
      unassignedSurveys,
      unassignedInstallations,
      readyNetMetering,
      delayedItems,
      technicianAssignedSurveys,
      technicianAssignedInstallations,
    };
  }, [queueItems]);

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-0">
      {/* 1. Header & Control Centre Bar - Mobile Compact */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="p-2 sm:p-2.5 bg-amber-500/10 text-amber-600 rounded-lg sm:rounded-xl border border-amber-200 shrink-0">
            <Hammer className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-base sm:text-xl md:text-2xl font-bold text-slate-900 tracking-tight truncate">
                {isManager ? 'Installation Control Centre' : 'Field Operations Hub'}
              </h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold shrink-0 ${
                isManager
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-teal-100 text-teal-800 border border-teal-200'
              }`}>
                {isManager ? 'Manager' : 'Field Tech'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate hidden sm:block">
              {isManager
                ? 'Assign Site Visits, supervise Installation Crews, and close Net Metering grid synchronization.'
                : 'Execute assigned Site Surveys, upload installation verification photos, and complete field closures.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg sm:rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* 2. Operational Control Cards */}

      {/* 2. Operational Control Cards - Stacked Grid (No scrolling) */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 ${isManager ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-2 sm:gap-3`}>
        {/* Card 1: Action Required */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('action_required');
            setMobileActionSubFilter('ALL');
          }}
          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-left transition-all ${
            activeTab === 'action_required'
              ? 'bg-amber-500/10 border-amber-400 ring-2 ring-amber-400/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-600 truncate">
              {isManager ? 'Action Required' : 'My Tasks'}
            </span>
            <div className="p-1 sm:p-1.5 rounded-lg bg-amber-50 text-amber-600 shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
            {isManager
              ? (metrics?.action_required_total ?? (counts.svUnassigned + counts.instUnassigned + counts.nmReady + actionRequiredGroups.delayedItems.length))
              : (actionRequiredGroups.technicianAssignedSurveys.length + actionRequiredGroups.technicianAssignedInstallations.length + actionRequiredGroups.readyNetMetering.length)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-amber-700 font-medium mt-1 truncate">
            {isManager
              ? `${counts.svUnassigned} surveys • ${counts.instUnassigned} ECPs`
              : `${actionRequiredGroups.technicianAssignedSurveys.length} survey(s) • ${actionRequiredGroups.technicianAssignedInstallations.length} ECP(s)`}
          </p>
        </button>

        {/* Card 2: Site Visits */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('site_visits');
            setSiteVisitSubFilter('ALL');
          }}
          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-left transition-all ${
            activeTab === 'site_visits'
              ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-400/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-600 truncate">
              {isManager ? 'Site Visits' : 'My Surveys'}
            </span>
            <div className="p-1 sm:p-1.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
            {isManager ? counts.svAll : counts.svAssigned}
          </div>
          <p className="text-[10px] sm:text-[11px] text-blue-700 font-medium mt-1 truncate">
            {isManager
              ? `${counts.svUnassigned} pending • ${counts.svAssigned} active`
              : `${counts.svAssigned} assigned • ${counts.svCompleted} done`}
          </p>
        </button>

        {/* Card 3: Installations */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('installations');
            setInstallationSubFilter('ALL');
          }}
          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-left transition-all ${
            activeTab === 'installations'
              ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-400/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-600 truncate">
              {isManager ? 'Installations' : 'My Installs'}
            </span>
            <div className="p-1 sm:p-1.5 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
              <Hammer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
            {isManager ? counts.instAll : counts.instAssigned}
          </div>
          <p className="text-[10px] sm:text-[11px] text-indigo-700 font-medium mt-1 truncate">
            {isManager
              ? `${counts.instUnassigned} unassigned • ${counts.instAssigned} active`
              : `${counts.instAssigned} active ECPs`}
          </p>
        </button>

        {/* Card 4: Net Metering */}
        <button
          type="button"
          onClick={() => setActiveTab('net_metering')}
          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-left transition-all ${
            activeTab === 'net_metering'
              ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-400/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-600 truncate">Net Metering</span>
            <div className="p-1 sm:p-1.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
              <Gauge className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
            {counts.nmAll}
          </div>
          <p className="text-[10px] sm:text-[11px] text-emerald-700 font-medium mt-1 truncate">
            {counts.nmReady} meter swaps ready
          </p>
        </button>

        {/* Card 5: Team Workload (Manager Only) */}
        {isManager && (
          <button
            type="button"
            onClick={() => setActiveTab('team_workload')}
            className={`col-span-2 sm:col-span-1 lg:col-span-1 p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-left transition-all ${
              activeTab === 'team_workload'
                ? 'bg-purple-50/70 border-purple-400 ring-2 ring-purple-400/20 shadow-xs'
                : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-600 truncate">Team Workload</span>
              <div className="p-1 sm:p-1.5 rounded-lg bg-purple-50 text-purple-600 shrink-0">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
              {workload.length}
            </div>
            <p className="text-[10px] sm:text-[11px] text-purple-700 font-medium mt-1 truncate">
              {workload.filter(w => w.availability === 'AVAILABLE').length} crew available
            </p>
          </button>
        )}
      </div>

      {/* 3. Operational Tab Navigation (hidden on mobile since top swipeable chips handle tabs) */}
      <div className="hidden sm:flex items-center justify-between border-b border-slate-200/80 pb-px overflow-x-auto">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-max">
          {(isManager
            ? [
                { id: 'action_required', label: 'Action Required', icon: AlertTriangle, count: counts.svUnassigned + counts.instUnassigned + counts.nmReady + actionRequiredGroups.delayedItems.length },
                { id: 'site_visits', label: 'Site Visits (Surveys)', icon: Compass, count: counts.svAll },
                { id: 'installations', label: 'Installations (ECPs)', icon: Hammer, count: counts.instAll },
                { id: 'net_metering', label: 'Net Metering', icon: Gauge, count: counts.nmAll },
                { id: 'team_workload', label: 'Team Workload', icon: Users, count: workload.length },
                { id: 'all_queue', label: 'All Operations Queue', icon: Layers, count: queueItems.length },
              ]
            : [
                { id: 'action_required', label: 'My Action Tasks', icon: AlertTriangle, count: actionRequiredGroups.technicianAssignedSurveys.length + actionRequiredGroups.technicianAssignedInstallations.length + actionRequiredGroups.readyNetMetering.length },
                { id: 'site_visits', label: 'My Site Surveys', icon: Compass, count: counts.svAssigned },
                { id: 'installations', label: 'My Installations (ECPs)', icon: Hammer, count: counts.instAssigned },
                { id: 'net_metering', label: 'Net Metering', icon: Gauge, count: counts.nmAll },
              ]
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-all border-b-2 ${
                  isActive
                    ? 'border-amber-600 text-amber-700 bg-amber-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      tab.id === 'action_required'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Filter & Search Controls (Shown on queue views) */}
      {activeTab !== 'team_workload' && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer name, phone, ECP/Lead #, city, or assigned specialist..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
            />
          </div>

          {/* Sub-Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'site_visits' && (
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {[
                  { id: 'ALL', label: 'All', count: counts.svAll },
                  { id: 'PENDING', label: 'Unassigned', count: counts.svUnassigned },
                  { id: 'ASSIGNED', label: 'In Progress', count: counts.svAssigned },
                  { id: 'COMPLETED', label: 'Completed', count: counts.svCompleted },
                ].map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setSiteVisitSubFilter(sub.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                      siteVisitSubFilter === sub.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{sub.label}</span>
                    <span className="text-[10px] text-slate-400">({sub.count})</span>
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'installations' && (
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {[
                  { id: 'ALL', label: 'All', count: counts.instAll },
                  { id: 'UNASSIGNED', label: 'Unassigned', count: counts.instUnassigned },
                  { id: 'ASSIGNED', label: 'In Execution', count: counts.instAssigned },
                  { id: 'DELAYED', label: 'Delayed', count: counts.instDelayed },
                ].map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setInstallationSubFilter(sub.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                      installationSubFilter === sub.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{sub.label}</span>
                    <span className="text-[10px] text-slate-400">({sub.count})</span>
                  </button>
                ))}
              </div>
            )}

            {/* Filter by Assignee (Manager only) */}
            {isManager && (
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Assignees</option>
                  <option value="UNASSIGNED">Unassigned Only</option>
                  {workload.map((w) => (
                    <option key={w.user_id} value={w.user_id}>
                      {w.name} ({w.total_active} active)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Tab Views Content */}

      {/* VIEW 1: ACTION REQUIRED */}
      {activeTab === 'action_required' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Mobile Category Quick-Filter Chips (sm:hidden) - Wrapped without scrolling */}
          <div className="sm:hidden flex flex-wrap items-center gap-1.5 pb-1">
            <button
              type="button"
              onClick={() => setMobileActionSubFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                mobileActionSubFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700'
              }`}
            >
              All Actions ({(counts.svUnassigned + counts.instUnassigned + counts.nmReady + actionRequiredGroups.delayedItems.length)})
            </button>
            <button
              type="button"
              onClick={() => setMobileActionSubFilter('SURVEYS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                mobileActionSubFilter === 'SURVEYS'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Surveys ({actionRequiredGroups.unassignedSurveys.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileActionSubFilter('INSTALLATIONS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                mobileActionSubFilter === 'INSTALLATIONS'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
              }`}
            >
              <Hammer className="w-3.5 h-3.5" />
              <span>ECPs ({actionRequiredGroups.unassignedInstallations.length})</span>
            </button>
            {actionRequiredGroups.delayedItems.length > 0 && (
              <button
                type="button"
                onClick={() => setMobileActionSubFilter('DELAYED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                  mobileActionSubFilter === 'DELAYED'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Delayed ({actionRequiredGroups.delayedItems.length})</span>
              </button>
            )}
            {actionRequiredGroups.readyNetMetering.length > 0 && (
              <button
                type="button"
                onClick={() => setMobileActionSubFilter('NET_METERING')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                  mobileActionSubFilter === 'NET_METERING'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>Net Meter ({actionRequiredGroups.readyNetMetering.length})</span>
              </button>
            )}
          </div>

          {/* A. Site Visits Section */}
          {(mobileActionSubFilter === 'ALL' || mobileActionSubFilter === 'SURVEYS') && (
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
              <div
                onClick={() => toggleSection('surveys')}
                className="px-4 sm:px-5 py-3 sm:py-3.5 bg-amber-50/60 border-b border-slate-200 flex items-center justify-between cursor-pointer select-none hover:bg-amber-100/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-amber-600" />
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                    {isManager
                      ? `Site Visits Awaiting Assignment (${actionRequiredGroups.unassignedSurveys.length})`
                      : `My Assigned Site Surveys (${actionRequiredGroups.technicianAssignedSurveys.length})`}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                    Pre-feasibility
                  </span>
                  {collapsedSections['surveys'] ? (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  )}
                </div>
              </div>

              {!collapsedSections['surveys'] && (
                (isManager ? actionRequiredGroups.unassignedSurveys : actionRequiredGroups.technicianAssignedSurveys).length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                    {isManager
                      ? 'All requested site surveys have been assigned to field technicians.'
                      : 'No pending site surveys assigned to you. All caught up!'}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {(isManager ? actionRequiredGroups.unassignedSurveys : actionRequiredGroups.technicianAssignedSurveys).map((item) => (
                      <div key={item.id} className="p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              #{item.lead_number}
                            </span>
                            <h3 className="text-sm font-bold text-slate-900">{item.customer_name}</h3>
                            {item.capacity_kwp && (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold border border-blue-200">
                                {item.capacity_kwp} kWp
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <a href={`tel:${item.mobile_number}`} className="text-blue-600 font-semibold sm:font-normal font-mono">
                                +91 {item.mobile_number}
                              </a>
                            </span>
                            {item.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span>{item.location}</span>
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-amber-700 font-medium">
                              <Clock className="w-3.5 h-3.5" />
                              <span>
                                {isManager
                                  ? `Waiting ${item.days_in_stage}d for assignment`
                                  : `Assigned for survey`}
                              </span>
                            </span>
                          </div>
                          {item.site_visit?.notes && (
                            <p className="text-xs text-slate-600 bg-amber-50/50 p-2 rounded-lg border border-amber-100 mt-1 max-w-2xl">
                              <span className="font-semibold text-slate-700">Scope Note: </span>
                              {item.site_visit.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0 pt-1 sm:pt-0">
                          {isManager ? (
                            <button
                              type="button"
                              onClick={() => setSelectedSiteVisitForAssign(item.site_visit || null)}
                              className="flex-1 sm:flex-none justify-center px-4 py-2.5 sm:py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                            >
                              <Compass className="w-3.5 h-3.5" />
                              <span>Assign Field Member</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedSiteVisitForComplete(item.site_visit || null)}
                              className="flex-1 sm:flex-none justify-center px-4 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Complete Survey</span>
                            </button>
                          )}
                          {onOpenLeadDetails && (
                            <button
                              type="button"
                              onClick={() => onOpenLeadDetails(item.lead_id)}
                              className="p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 border border-slate-200 shrink-0"
                              title="Open Lead Workspace"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          {/* B. ECP Installations Section */}
          {(mobileActionSubFilter === 'ALL' || mobileActionSubFilter === 'INSTALLATIONS') && (
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
              <div
                onClick={() => toggleSection('installations')}
                className="px-4 sm:px-5 py-3 sm:py-3.5 bg-indigo-50/60 border-b border-slate-200 flex items-center justify-between cursor-pointer select-none hover:bg-indigo-100/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Hammer className="w-4 h-4 text-indigo-600" />
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                    {isManager
                      ? `ECP Installations Awaiting Crew Lead (${actionRequiredGroups.unassignedInstallations.length})`
                      : `My Assigned Installations In Progress (${actionRequiredGroups.technicianAssignedInstallations.length})`}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-full">
                    Execution
                  </span>
                  {collapsedSections['installations'] ? (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  )}
                </div>
              </div>

              {!collapsedSections['installations'] && (
                (isManager ? actionRequiredGroups.unassignedInstallations : actionRequiredGroups.technicianAssignedInstallations).length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                    {isManager
                      ? 'All active installation projects have an assigned crew lead.'
                      : 'No pending photo verifications on your assigned installations.'}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {(isManager ? actionRequiredGroups.unassignedInstallations : actionRequiredGroups.technicianAssignedInstallations).map((item) => (
                      <div key={item.id} className="p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              #{item.lead_number}
                            </span>
                            <h3 className="text-sm font-bold text-slate-900">{item.customer_name}</h3>
                            {item.capacity_kwp && (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold border border-blue-200">
                                {item.capacity_kwp} kWp
                              </span>
                            )}
                            {isManager && (
                              <span className="text-xs font-bold text-slate-900">
                                ₹{item.total_project_value.toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            {item.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span>{item.location}</span>
                              </span>
                            )}
                            <span className="text-amber-700 font-medium">
                              Stage: {item.stage} • {item.days_in_stage}d in stage
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0 pt-1 sm:pt-0">
                          {isManager && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedLeadForAssignInstaller({
                                  id: item.lead_id,
                                  leadNumber: item.lead_number,
                                  customerName: item.customer_name,
                                  capacityKwp: item.capacity_kwp,
                                  currentInstallerId: item.assigned_user_id,
                                  currentInstallerName: item.assigned_user_name,
                                })
                              }
                              className="flex-1 sm:flex-none justify-center px-3.5 py-2.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>{item.assigned_user_id ? 'Reassign' : 'Assign Crew'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedLeadForPhysicalInstallation({
                                id: item.lead_id,
                                leadNumber: item.lead_number,
                                customerName: item.customer_name,
                                capacityKwp: item.capacity_kwp,
                                location: item.location,
                              })
                            }
                            className="flex-1 sm:flex-none justify-center px-3.5 py-2.5 sm:py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                            title="Upload 5 installation photos and complete physical installation"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Upload 5 Photos</span>
                          </button>

                          {onOpenLeadDetails && (
                            <button
                              type="button"
                              onClick={() => onOpenLeadDetails(item.lead_id)}
                              className="p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 border border-slate-200 shrink-0"
                              title="Open ECP Project"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          {/* C. Net Metering Action Section */}
          {(mobileActionSubFilter === 'ALL' || mobileActionSubFilter === 'NET_METERING') && (
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
              <div
                onClick={() => toggleSection('net_metering')}
                className="px-4 sm:px-5 py-3 sm:py-3.5 bg-emerald-50/60 border-b border-slate-200 flex items-center justify-between cursor-pointer select-none hover:bg-emerald-100/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                    Net Metering Meter Closures Ready ({actionRequiredGroups.readyNetMetering.length})
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Grid Sync
                  </span>
                  {collapsedSections['net_metering'] ? (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  )}
                </div>
              </div>

              {!collapsedSections['net_metering'] && (
                actionRequiredGroups.readyNetMetering.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                    No physical Net Metering closures currently pending field execution.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {actionRequiredGroups.readyNetMetering.map((item) => (
                      <div key={item.id} className="p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              #{item.lead_number}
                            </span>
                            <h3 className="text-sm font-bold text-slate-900">{item.customer_name}</h3>
                            {item.capacity_kwp && (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold border border-blue-200">
                                {item.capacity_kwp} kWp
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-emerald-800 font-medium">
                            DISCOM approval obtained. Ready for bi-directional meter replacement & grid synchronization.
                          </p>
                          <div className="text-xs text-slate-500 flex items-center gap-3">
                            <span>Assigned Crew: {item.assigned_user_name || 'Unassigned'}</span>
                            {item.location && <span>• {item.location}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0 pt-1 sm:pt-0">
                          {isManager && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedLeadForAssignInstaller({
                                  id: item.lead_id,
                                  leadNumber: item.lead_number,
                                  customerName: item.customer_name,
                                  capacityKwp: item.capacity_kwp,
                                  currentInstallerId: item.assigned_user_id,
                                  currentInstallerName: item.assigned_user_name,
                                })
                              }
                              className="flex-1 sm:flex-none justify-center px-3.5 py-2.5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>{item.assigned_user_id ? 'Reassign' : 'Assign Crew'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedLeadForCloseNetMetering({
                                id: item.lead_id,
                                leadNumber: item.lead_number,
                                customerName: item.customer_name,
                                capacityKwp: item.capacity_kwp,
                                location: item.location,
                              })
                            }
                            className="flex-1 sm:flex-none justify-center px-4 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Close Net Metering</span>
                          </button>
                          {onOpenLeadDetails && (
                            <button
                              type="button"
                              onClick={() => onOpenLeadDetails(item.lead_id)}
                              className="p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 border border-slate-200 shrink-0"
                              title="Open Project"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          {/* D. Delayed & SLA At-Risk Operations */}
          {actionRequiredGroups.delayedItems.length > 0 && (mobileActionSubFilter === 'ALL' || mobileActionSubFilter === 'DELAYED') && (
            <div className="bg-white rounded-2xl border border-red-200 overflow-hidden shadow-xs">
              <div
                onClick={() => toggleSection('delayed')}
                className="px-4 sm:px-5 py-3 sm:py-3.5 bg-red-50/70 border-b border-red-200 flex items-center justify-between cursor-pointer select-none hover:bg-red-100/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                    Delayed / SLA At-Risk Operations ({actionRequiredGroups.delayedItems.length})
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-red-800 bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
                    {isManager ? 'Intervention Needed' : 'Overdue'}
                  </span>
                  {collapsedSections['delayed'] ? (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  )}
                </div>
              </div>

              {!collapsedSections['delayed'] && (
                <div className="divide-y divide-slate-100">
                  {actionRequiredGroups.delayedItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-red-50/30 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              item.work_type === 'SITE_VISIT'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {item.work_type.replace('_', ' ')}
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            #{item.lead_number}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900">{item.customer_name}</h3>
                          {item.capacity_kwp && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold">
                              {item.capacity_kwp} kWp
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold border border-red-200">
                            {item.days_in_stage}d in Stage
                          </span>
                        </div>
                        <div className="text-xs text-slate-600">
                          <span>{item.pending_requirement}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-3">
                          <span>
                            Assigned:{' '}
                            {item.assigned_user_name ? (
                              <strong className="text-slate-800">{item.assigned_user_name}</strong>
                            ) : (
                              <span className="text-amber-700 font-semibold">Unassigned</span>
                            )}
                          </span>
                          {item.location && <span>• {item.location}</span>}
                          {item.mobile_number && (
                            <span>
                              •{' '}
                              <a href={`tel:${item.mobile_number}`} className="text-blue-600 font-semibold sm:font-normal font-mono">
                                +91 {item.mobile_number}
                              </a>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0 pt-1 sm:pt-0">
                        {isManager && item.work_type === 'SITE_VISIT' && item.site_visit && (
                          <button
                            type="button"
                            onClick={() => setSelectedSiteVisitForAssign(item.site_visit || null)}
                            className="flex-1 sm:flex-none justify-center px-3.5 py-2.5 sm:py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                          >
                            {item.assigned_user_id ? 'Reassign Tech' : 'Assign Tech'}
                          </button>
                        )}
                        {!isManager && item.work_type === 'SITE_VISIT' && item.site_visit && item.assigned_user_id === currentUser.id && (
                          <button
                            type="button"
                            onClick={() => setSelectedSiteVisitForComplete(item.site_visit || null)}
                            className="flex-1 sm:flex-none justify-center px-3.5 py-2.5 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                          >
                            Complete Survey
                          </button>
                        )}
                        {isManager && item.work_type === 'INSTALLATION' && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedLeadForAssignInstaller({
                                id: item.lead_id,
                                leadNumber: item.lead_number,
                                customerName: item.customer_name,
                                capacityKwp: item.capacity_kwp,
                                currentInstallerId: item.assigned_user_id,
                                currentInstallerName: item.assigned_user_name,
                              })
                            }
                            className="flex-1 sm:flex-none justify-center px-3.5 py-2.5 sm:py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                          >
                            {item.assigned_user_id ? 'Reassign Crew' : 'Assign Crew'}
                          </button>
                        )}
                        {!isManager && item.work_type === 'INSTALLATION' && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedLeadForPhysicalInstallation({
                                id: item.lead_id,
                                leadNumber: item.lead_number,
                                customerName: item.customer_name,
                                capacityKwp: item.capacity_kwp,
                                location: item.location,
                              })
                            }
                            className="flex-1 sm:flex-none justify-center px-3.5 py-2.5 sm:py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Upload Photos</span>
                          </button>
                        )}
                        {onOpenLeadDetails && (
                          <button
                            type="button"
                            onClick={() => onOpenLeadDetails(item.lead_id)}
                            className="p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 border border-slate-200 shrink-0"
                            title="Open Lead"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: SITE VISITS (SURVEYS) */}
      {activeTab === 'site_visits' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h2 className="text-base font-bold text-slate-900">Lead-Stage Feasibility Surveys</h2>
              <p className="text-xs text-slate-500">
                Pre-feasibility technical assessments requested by the Lead sales team.
              </p>
            </div>
            <div className="text-xs font-semibold text-slate-600">
              Showing {filteredItems.length} site visits
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No site visits matching your search criteria.
            </div>
          ) : (
            <>
              {/* Mobile Cards for Site Visits (sm:hidden) */}
              <div className="sm:hidden divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const sv = item.site_visit;
                  return (
                    <div key={item.id} className="p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                            #{item.lead_number}
                          </span>
                          <span className="font-bold text-slate-900 text-xs">{item.customer_name}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            item.current_status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : item.current_status === 'ASSIGNED'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {item.current_status === 'COMPLETED' ? 'COMPLETED' : item.current_status === 'ASSIGNED' ? 'IN PROGRESS' : 'PENDING'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <a href={`tel:${item.mobile_number}`} className="text-blue-600 font-medium font-mono">
                            +91 {item.mobile_number}
                          </a>
                        </span>
                        {item.location && (
                          <span className="flex items-center gap-1 truncate max-w-[160px]">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{item.location}</span>
                          </span>
                        )}
                        {item.scheduled_date && (
                          <span className="flex items-center gap-1 text-slate-600">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{new Date(item.scheduled_date).toLocaleDateString()}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                        <div className="text-[11px] text-slate-600">
                          {item.assigned_user_name ? (
                            <span className="font-medium text-blue-700">Tech: {item.assigned_user_name}</span>
                          ) : (
                            <span className="text-amber-700 font-medium">Unassigned</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {item.can_assign && isManager && (
                            <button
                              type="button"
                              onClick={() => setSelectedSiteVisitForAssign(sv || null)}
                              className="px-2.5 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold"
                            >
                              {item.assigned_user_id ? 'Reassign' : 'Assign'}
                            </button>
                          )}
                          {sv?.status === 'ASSIGNED' && (isManager || sv.assigned_member_id === currentUser.id) && (
                            <button
                              type="button"
                              onClick={() => setSelectedSiteVisitForComplete(sv || null)}
                              className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold"
                            >
                              Complete
                            </button>
                          )}
                          {sv?.status === 'COMPLETED' && (
                            <button
                              type="button"
                              onClick={() => setSelectedSiteVisitForDetails(sv)}
                              className="px-2 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold"
                            >
                              Report
                            </button>
                          )}
                          {onOpenLeadDetails && (
                            <button
                              type="button"
                              onClick={() => onOpenLeadDetails(item.lead_id)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 border border-slate-200 rounded-lg"
                              title="Open Details"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table (hidden sm:block) */}
              <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200/80 text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Lead # & Customer</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Requesting User</th>
                    <th className="py-3 px-4">Assigned Specialist</th>
                    <th className="py-3 px-4">Scheduled Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Inspection Photos</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const sv = item.site_visit;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              #{item.lead_number}
                            </span>
                            <span>{item.customer_name}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <a href={`tel:${item.mobile_number}`} className="hover:text-blue-600 font-mono">
                              +91 {item.mobile_number}
                            </a>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                          {item.location || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {sv?.requesting_user_name || 'Sales Team'}
                        </td>
                        <td className="py-3.5 px-4">
                          {item.assigned_user_name ? (
                            <span className="font-semibold text-slate-900 flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{item.assigned_user_name}</span>
                            </span>
                          ) : (
                            <span className="text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[10px]">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {item.scheduled_date ? (
                            <span className="flex items-center gap-1 font-medium">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>
                                {new Date(item.scheduled_date).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Not scheduled</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              item.current_status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : item.current_status === 'ASSIGNED'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {item.current_status === 'COMPLETED'
                              ? 'COMPLETED'
                              : item.current_status === 'ASSIGNED'
                              ? 'IN PROGRESS'
                              : 'PENDING ASSIGNMENT'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {item.photos_count && item.photos_count > 0 ? (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <FileCheck className="w-3.5 h-3.5" />
                              <span>{item.photos_count} Verified</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">0 Photos</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.can_assign && isManager && (
                              <button
                                type="button"
                                onClick={() => setSelectedSiteVisitForAssign(sv || null)}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold transition-colors"
                              >
                                {item.assigned_user_id ? 'Reassign' : 'Assign Member'}
                              </button>
                            )}
                            {sv?.status === 'ASSIGNED' &&
                              (isManager || sv.assigned_member_id === currentUser.id) && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedSiteVisitForComplete(sv || null)}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold shadow-xs"
                                >
                                  Complete
                                </button>
                              )}
                            {sv?.status === 'COMPLETED' && (
                              <button
                                type="button"
                                onClick={() => setSelectedSiteVisitForDetails(sv)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Report</span>
                              </button>
                            )}
                            {onOpenLeadDetails && (
                              <button
                                type="button"
                                onClick={() => onOpenLeadDetails(item.lead_id)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                                title="Open Lead"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}

      {/* VIEW 3: INSTALLATIONS (ECPs) */}
      {activeTab === 'installations' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h2 className="text-base font-bold text-slate-900">ECP Installation Projects</h2>
              <p className="text-xs text-slate-500">
                Projects in installation execution, procurement delivery, and structure assembly.
              </p>
            </div>
            <div className="text-xs font-semibold text-slate-600">
              Showing {filteredItems.length} installation projects
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No installation projects matching filter criteria.
            </div>
          ) : (
            <>
              {/* Mobile Cards for Installations (sm:hidden) */}
              <div className="sm:hidden divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <div key={item.id} className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                          #{item.lead_number}
                        </span>
                        <span className="font-bold text-slate-900 text-xs">{item.customer_name}</span>
                        {item.capacity_kwp && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold border border-blue-200">
                            {item.capacity_kwp} kWp
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          item.sla_status === 'DELAYED'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : item.sla_status === 'AT_RISK'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {item.sla_status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      {item.location && (
                        <span className="flex items-center gap-1 truncate max-w-[170px]">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{item.location}</span>
                        </span>
                      )}
                      <span className="text-slate-600">
                        {item.days_in_stage}d in stage
                      </span>
                      {isManager && (
                        <span className="font-bold text-slate-800">
                          ₹{item.total_project_value.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      {item.has_all_photos ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>5/5 Photos Ready</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <Camera className="w-3 h-3 text-amber-600" />
                          <span>{item.photos_count || 0}/5 Photos</span>
                        </span>
                      )}
                      <div className="text-[11px] text-slate-600 truncate">
                        {item.assigned_user_name ? (
                          <span className="font-semibold text-indigo-700">Crew: {item.assigned_user_name}</span>
                        ) : (
                          <span className="text-amber-700 font-medium">Crew: Unassigned</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-1.5 w-full justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedLeadForPhysicalInstallation({
                              id: item.lead_id,
                              leadNumber: item.lead_number,
                              customerName: item.customer_name,
                              capacityKwp: item.capacity_kwp,
                              location: item.location,
                            })
                          }
                          className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                          title="Upload photos"
                        >
                          <Camera className="w-3 h-3" />
                          <span>{item.has_all_photos ? 'Photos' : 'Upload 5 Photos'}</span>
                        </button>

                        {isManager && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedLeadForAssignInstaller({
                                id: item.lead_id,
                                leadNumber: item.lead_number,
                                customerName: item.customer_name,
                                capacityKwp: item.capacity_kwp,
                                currentInstallerId: item.assigned_user_id,
                                currentInstallerName: item.assigned_user_name,
                              })
                            }
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold"
                          >
                            {item.assigned_user_id ? 'Crew' : 'Assign'}
                          </button>
                        )}

                        {onOpenLeadDetails && (
                          <button
                            type="button"
                            onClick={() => onOpenLeadDetails(item.lead_id)}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                          >
                            <span>ECP</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (hidden sm:block) */}
              <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200/80 text-[10px]">
                  <tr>
                    <th className="py-3 px-4">ECP # & Customer</th>
                    <th className="py-3 px-4">{isManager ? 'Capacity & Value' : 'System Capacity'}</th>
                    <th className="py-3 px-4">Assigned Crew Lead</th>
                    <th className="py-3 px-4">Current Task / Requirement</th>
                    <th className="py-3 px-4">5 Photos Status</th>
                    <th className="py-3 px-4">Days in Stage</th>
                    <th className="py-3 px-4">SLA Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            #{item.lead_number}
                          </span>
                          <span>{item.customer_name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {item.location || 'Location not recorded'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {item.capacity_kwp ? `${item.capacity_kwp} kWp` : '—'}
                        </div>
                        {isManager && (
                          <div className="text-[11px] text-slate-500">
                            ₹{item.total_project_value.toLocaleString('en-IN')}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {item.assigned_user_name ? (
                          <span className="font-semibold text-slate-900 flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{item.assigned_user_name}</span>
                          </span>
                        ) : isManager ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedLeadForAssignInstaller({
                                id: item.lead_id,
                                leadNumber: item.lead_number,
                                customerName: item.customer_name,
                                capacityKwp: item.capacity_kwp,
                                currentInstallerId: item.assigned_user_id,
                                currentInstallerName: item.assigned_user_name,
                              })
                            }
                            className="text-indigo-700 hover:text-indigo-900 font-semibold bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg text-[10px] transition-colors"
                          >
                            + Assign Crew
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 max-w-xs">
                        <p className="line-clamp-2">{item.pending_requirement}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        {item.has_all_photos ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>5/5 Photos Ready</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 w-fit">
                            <Camera className="w-3 h-3 text-amber-600" />
                            <span>{item.photos_count || 0}/5 Photos</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-mono">
                        {item.days_in_stage} days
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            item.sla_status === 'DELAYED'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : item.sla_status === 'AT_RISK'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {item.sla_status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedLeadForPhysicalInstallation({
                                id: item.lead_id,
                                leadNumber: item.lead_number,
                                customerName: item.customer_name,
                                capacityKwp: item.capacity_kwp,
                                location: item.location,
                              })
                            }
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1"
                            title="Upload 5 installation photos and complete physical installation"
                          >
                            <Camera className="w-3 h-3 text-amber-600" />
                            <span>{item.has_all_photos ? 'Photos' : 'Upload 5 Photos'}</span>
                          </button>
                          {isManager && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedLeadForAssignInstaller({
                                  id: item.lead_id,
                                  leadNumber: item.lead_number,
                                  customerName: item.customer_name,
                                  capacityKwp: item.capacity_kwp,
                                  currentInstallerId: item.assigned_user_id,
                                  currentInstallerName: item.assigned_user_name,
                                })
                              }
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors"
                            >
                              {item.assigned_user_id ? 'Change Crew' : 'Assign'}
                            </button>
                          )}
                          {onOpenLeadDetails && (
                            <button
                              type="button"
                              onClick={() => onOpenLeadDetails(item.lead_id)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold shadow-xs transition-colors flex items-center gap-1"
                            >
                              <span>View ECP</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}

      {/* VIEW 4: NET METERING */}
      {activeTab === 'net_metering' && (
        <div className="space-y-6">
          {/* Operational Clarity Info Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-emerald-600" />
              <span>Net Metering Responsibility Matrix</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Registration Team Tasks (Liaisoning & Documentation)
                </span>
                <ul className="list-disc list-inside text-slate-600 space-y-1 pl-1">
                  <li>Upload Installation Photos to CSPDCL Portal</li>
                  <li>DCR Issuance (Domestic Content Requirement)</li>
                  <li>Consumer Approval & Submission</li>
                  <li>Request Net Metering from CSPDCL</li>
                </ul>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Installation Team Task (Physical Field Execution)
                </span>
                <p className="text-emerald-800 leading-relaxed">
                  <strong>Close Net Metering:</strong> Physical removal of the legacy meter, 
                  installation of the utility bi-directional meter, DISCOM seal verification, 
                  and grid export synchronization.
                </p>
              </div>
            </div>
          </div>

          {/* Net Metering Queue */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">
                Net Metering Projects Queue ({filteredItems.length})
              </h3>
              <span className="text-xs text-slate-500">
                {actionRequiredGroups.readyNetMetering.length} ready for physical closure
              </span>
            </div>

            {filteredItems.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                No projects currently in the Net Metering stage.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <div key={item.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          #{item.lead_number}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">{item.customer_name}</h4>
                        {item.capacity_kwp && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold border border-blue-200">
                            {item.capacity_kwp} kWp
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 font-medium">
                        {item.pending_requirement}
                      </p>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3">
                        <span>Assigned Crew: {item.assigned_user_name || 'Unassigned'}</span>
                        {item.location && <span>• {item.location}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                      {isManager && (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedLeadForAssignInstaller({
                              id: item.lead_id,
                              leadNumber: item.lead_number,
                              customerName: item.customer_name,
                              capacityKwp: item.capacity_kwp,
                              currentInstallerId: item.assigned_user_id,
                              currentInstallerName: item.assigned_user_name,
                            })
                          }
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>{item.assigned_user_name ? 'Reassign Crew' : 'Assign Crew'}</span>
                        </button>
                      )}

                      {item.can_complete ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedLeadForCloseNetMetering({
                              id: item.lead_id,
                              leadNumber: item.lead_number,
                              customerName: item.customer_name,
                              capacityKwp: item.capacity_kwp,
                              location: item.location,
                            })
                          }
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Close Net Metering</span>
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-xl text-xs font-medium border border-slate-200 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Pending Registration Steps</span>
                        </span>
                      )}
                      {onOpenLeadDetails && (
                        <button
                          type="button"
                          onClick={() => onOpenLeadDetails(item.lead_id)}
                          className="p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 border border-slate-200"
                          title="Open Project"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 5: TEAM WORKLOAD */}
      {activeTab === 'team_workload' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-base font-bold text-slate-900">Installation Team Workload & Availability</h2>
              <p className="text-xs text-slate-500">
                Live monitoring of active survey assignments, installation projects, and individual capacity.
              </p>
            </div>
            <div className="text-xs font-semibold text-slate-600">
              {workload.length} Field Personnel
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200/80 text-[10px]">
                <tr>
                  <th className="py-3 px-4">Installation Specialist</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Active Site Visits</th>
                  <th className="py-3 px-4">Active Installations</th>
                  <th className="py-3 px-4">Delayed Tasks</th>
                  <th className="py-3 px-4">Total Active Load</th>
                  <th className="py-3 px-4">Availability</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workload.map((staff) => (
                  <tr key={staff.user_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{staff.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">@{staff.username}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {staff.role === 'INSTALLATION_MANAGER' ? 'Installation Manager' : 'Field Technician'}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-blue-700">
                      {staff.active_site_visits}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-indigo-700">
                      {staff.active_installations}
                    </td>
                    <td className="py-3.5 px-4">
                      {staff.delayed_items > 0 ? (
                        <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200">
                          {staff.delayed_items}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                      {staff.total_active}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          staff.availability === 'AVAILABLE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : staff.availability === 'MODERATE'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {staff.availability}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setAssigneeFilter(staff.user_id);
                          setActiveTab('all_queue');
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-[11px] transition-colors"
                      >
                        Filter Queue
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 6: ALL OPERATIONS QUEUE */}
      {activeTab === 'all_queue' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-base font-bold text-slate-900">Unified Operations Work Queue</h2>
              <p className="text-xs text-slate-500">
                All Site Visits, ECP Installations, and Net Metering tasks across the field pipeline.
              </p>
            </div>
            <div className="text-xs font-semibold text-slate-600">
              Showing {filteredItems.length} items
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No items matching your search and filter criteria.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredItems.map((item) => (
                <div key={item.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.work_type === 'SITE_VISIT'
                            ? 'bg-blue-100 text-blue-800'
                            : item.work_type === 'NET_METERING'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {item.work_type.replace('_', ' ')}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        #{item.lead_number}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">{item.customer_name}</h4>
                      {item.capacity_kwp && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold">
                          {item.capacity_kwp} kWp
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 font-medium">
                      {item.pending_requirement}
                    </p>
                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>Assigned: <strong>{item.assigned_user_name || 'Unassigned'}</strong></span>
                      {item.location && <span>• {item.location}</span>}
                      <span>• Stage: {item.stage}</span>
                      <span className={item.is_delayed ? 'text-red-600 font-bold' : ''}>
                        • {item.days_in_stage} days in stage
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                    {item.work_type === 'SITE_VISIT' && item.can_assign && (
                      <button
                        type="button"
                        onClick={() => setSelectedSiteVisitForAssign(item.site_visit || null)}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                      >
                        {item.assigned_user_id ? 'Reassign' : 'Assign'}
                      </button>
                    )}
                    {item.work_type === 'INSTALLATION' && (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedLeadForAssignInstaller({
                            id: item.lead_id,
                            leadNumber: item.lead_number,
                            customerName: item.customer_name,
                            capacityKwp: item.capacity_kwp,
                            currentInstallerId: item.assigned_user_id,
                            currentInstallerName: item.assigned_user_name,
                          })
                        }
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                      >
                        {item.assigned_user_id ? 'Change Crew' : 'Assign Crew'}
                      </button>
                    )}
                    {item.work_type === 'NET_METERING' && item.can_complete && (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedLeadForCloseNetMetering({
                            id: item.lead_id,
                            leadNumber: item.lead_number,
                            customerName: item.customer_name,
                            capacityKwp: item.capacity_kwp,
                            location: item.location,
                          })
                        }
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                      >
                        Close Net Metering
                      </button>
                    )}
                    {onOpenLeadDetails && (
                      <button
                        type="button"
                        onClick={() => onOpenLeadDetails(item.lead_id)}
                        className="p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 border border-slate-200"
                        title="Open Details"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sticky Mobile Bottom Navigation Bar (sm:hidden) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 shadow-lg flex items-center justify-around pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => {
            setActiveTab('action_required');
            setMobileActionSubFilter('ALL');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${
            activeTab === 'action_required' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <AlertTriangle className="w-4 h-4" />
            {(counts.svUnassigned + counts.instUnassigned + counts.nmReady + actionRequiredGroups.delayedItems.length) > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full text-[9px] font-black bg-amber-500 text-white">
                {counts.svUnassigned + counts.instUnassigned + counts.nmReady + actionRequiredGroups.delayedItems.length}
              </span>
            )}
          </div>
          <span className="text-[10px]">Actions</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('site_visits');
            setSiteVisitSubFilter('ALL');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${
            activeTab === 'site_visits' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Compass className="w-4 h-4" />
            {counts.svAll > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full text-[9px] font-bold bg-blue-600 text-white">
                {counts.svAll}
              </span>
            )}
          </div>
          <span className="text-[10px]">Surveys</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('installations');
            setInstallationSubFilter('ALL');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${
            activeTab === 'installations' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Hammer className="w-4 h-4" />
            {counts.instAll > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full text-[9px] font-bold bg-indigo-600 text-white">
                {counts.instAll}
              </span>
            )}
          </div>
          <span className="text-[10px]">Installs</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('net_metering');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${
            activeTab === 'net_metering' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Gauge className="w-4 h-4" />
            {counts.nmAll > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full text-[9px] font-bold bg-emerald-600 text-white">
                {counts.nmAll}
              </span>
            )}
          </div>
          <span className="text-[10px]">Net Meter</span>
        </button>

        {isManager && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('team_workload');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${
              activeTab === 'team_workload' ? 'text-purple-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <Users className="w-4 h-4" />
              {workload.length > 0 && (
                <span className="absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full text-[9px] font-bold bg-purple-600 text-white">
                  {workload.length}
                </span>
              )}
            </div>
            <span className="text-[10px]">Workload</span>
          </button>
        )}
      </div>

      {/* 6. MODALS */}

      {/* Modal A: Site Visit Assignment (uses existing SiteVisitModal in ASSIGN mode) */}
      {selectedSiteVisitForAssign && (
        <SiteVisitModal
          mode="ASSIGN"
          siteVisit={selectedSiteVisitForAssign}
          users={allUsers}
          currentUser={currentUser}
          onClose={() => setSelectedSiteVisitForAssign(null)}
          onSuccess={() => {
            setSelectedSiteVisitForAssign(null);
            loadData(true);
          }}
        />
      )}

      {/* Modal A2: Site Visit Completion (Field Technician or Manager) */}
      {selectedSiteVisitForComplete && (
        <SiteVisitModal
          mode="COMPLETE"
          siteVisit={selectedSiteVisitForComplete}
          users={allUsers}
          currentUser={currentUser}
          onClose={() => setSelectedSiteVisitForComplete(null)}
          onSuccess={() => {
            setSelectedSiteVisitForComplete(null);
            loadData(true);
          }}
        />
      )}

      {/* Modal B: Completed Site Visit Details Inspection */}
      {selectedSiteVisitForDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden shadow-2xl animate-in fade-in flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Site Survey Report & Technical Specs</h3>
                  <p className="text-xs text-slate-500">
                    Completed by {selectedSiteVisitForDetails.assigned_member_name || 'Field Technician'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSiteVisitForDetails(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>
            
            <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              {/* Technical Measurements */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider border-b border-slate-200 pb-1.5">
                  <Ruler className="w-4 h-4 text-blue-600" />
                  Rooftop Structure & Cable Measurements
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Structure Height</span>
                    <span className="font-semibold text-slate-800 text-sm">
                      {selectedSiteVisitForDetails.structure_height || 'Not specified'}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Earthing Cable Length</span>
                    <span className="font-semibold text-slate-800 text-sm">
                      {selectedSiteVisitForDetails.earthing_cable_length || 'Not specified'}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">DC Cable Length</span>
                    <span className="font-semibold text-slate-800 text-sm">
                      {selectedSiteVisitForDetails.dc_cable_length || 'Not specified'}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">AC Cable Length</span>
                    <span className="font-semibold text-slate-800 text-sm">
                      {selectedSiteVisitForDetails.ac_cable_length || 'Not specified'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Geo-Tag & Owner Verification */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    Geo-Location & Verification
                  </div>
                  {selectedSiteVisitForDetails.photo_captured_with_owner ? (
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full border border-emerald-200">
                      ✓ Owner Present On-Site
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full border border-amber-200">
                      Owner Verification Pending
                    </span>
                  )}
                </div>
                {selectedSiteVisitForDetails.geo_latitude && selectedSiteVisitForDetails.geo_longitude ? (
                  <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Crosshair className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-800">
                          {selectedSiteVisitForDetails.geo_latitude}° N, {selectedSiteVisitForDetails.geo_longitude}° E
                        </div>
                        {selectedSiteVisitForDetails.geo_address && (
                          <div className="text-[10px] text-slate-500">{selectedSiteVisitForDetails.geo_address}</div>
                        )}
                      </div>
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${selectedSiteVisitForDetails.geo_latitude},${selectedSiteVisitForDetails.geo_longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-md text-[11px] flex items-center gap-1 transition-colors border border-emerald-200"
                    >
                      <ExternalLink className="w-3 h-3" /> View on Map
                    </a>
                  </div>
                ) : (
                  <div className="text-slate-500 text-[11px] italic bg-white p-2.5 border border-slate-200 rounded-lg">
                    No GPS coordinates attached to this visit.
                  </div>
                )}
              </div>

              {/* Extra Materials Required */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                  Extra Material Required (Beyond Standard BOM)
                </span>
                {(() => {
                  let materials: any[] = [];
                  if (selectedSiteVisitForDetails.extra_materials && selectedSiteVisitForDetails.extra_materials.length > 0) {
                    materials = selectedSiteVisitForDetails.extra_materials;
                  } else if (selectedSiteVisitForDetails.extra_materials_json) {
                    try {
                      materials = JSON.parse(selectedSiteVisitForDetails.extra_materials_json);
                    } catch (_) {}
                  }

                  if (materials.length === 0) {
                    return (
                      <p className="text-slate-500 text-[11px] italic bg-white p-2.5 border border-slate-200 rounded-lg">
                        No extra material specified. Standard BOM will be utilized.
                      </p>
                    );
                  }

                  return (
                    <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100/75 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-1.5">Material Description</th>
                            <th className="px-3 py-1.5 text-right">Quantity</th>
                            <th className="px-3 py-1.5">Unit (UoM)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {materials.map((m, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-3 py-1.5 font-medium text-slate-800">{m.name}</td>
                              <td className="px-3 py-1.5 text-right font-bold text-blue-600">{m.quantity}</td>
                              <td className="px-3 py-1.5 text-slate-500">{m.uom}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Uploaded Site Photos (Max 3) */}
              {selectedSiteVisitForDetails.photos && selectedSiteVisitForDetails.photos.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Site Survey Photos ({selectedSiteVisitForDetails.photos.length}/3)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedSiteVisitForDetails.photos.map((p) => (
                      <a
                        key={p.id}
                        href={`/api/site-visits/photos/${p.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="group block bg-white border border-slate-200 rounded-xl p-2 hover:border-blue-500 transition-colors shadow-xs"
                      >
                        <div className="h-20 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden mb-1.5">
                          <img
                            src={`/api/site-visits/photos/${p.id}`}
                            alt={p.original_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            onError={(e) => {
                              // fallback if image preview fails
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                        <div className="truncate font-semibold text-[11px] text-slate-800 group-hover:text-blue-600">
                          {p.original_name}
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {(p.size_bytes / 1024).toFixed(1)} KB
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Assessment Notes */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Field Assessment Report & Rooftop Feasibility
                </span>
                <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 leading-relaxed">
                  {selectedSiteVisitForDetails.completion_details || 'No additional technical comments recorded.'}
                </p>
              </div>

              {selectedSiteVisitForDetails.notes && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Initial Instructions / Scope
                  </span>
                  <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600">
                    {selectedSiteVisitForDetails.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedSiteVisitForDetails(null)}
                className="px-4 py-2 bg-slate-800 text-white font-semibold rounded-xl text-xs hover:bg-slate-700 transition-colors"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal C: Assign Installation Specialist to ECP */}
      {selectedLeadForAssignInstaller && (
        <AssignInstallerModal
          currentUser={currentUser}
          leadId={selectedLeadForAssignInstaller.id}
          leadNumber={selectedLeadForAssignInstaller.leadNumber}
          customerName={selectedLeadForAssignInstaller.customerName}
          capacityKwp={selectedLeadForAssignInstaller.capacityKwp}
          currentInstallerId={selectedLeadForAssignInstaller.currentInstallerId}
          currentInstallerName={selectedLeadForAssignInstaller.currentInstallerName}
          users={allUsers}
          onClose={() => setSelectedLeadForAssignInstaller(null)}
          onSuccess={() => {
            setSelectedLeadForAssignInstaller(null);
            loadData(true);
          }}
        />
      )}

      {/* Modal D: Close Net Metering Execution */}
      {selectedLeadForCloseNetMetering && (
        <CloseNetMeteringModal
          leadId={selectedLeadForCloseNetMetering.id}
          leadNumber={selectedLeadForCloseNetMetering.leadNumber}
          customerName={selectedLeadForCloseNetMetering.customerName}
          capacityKwp={selectedLeadForCloseNetMetering.capacityKwp}
          location={selectedLeadForCloseNetMetering.location}
          onClose={() => setSelectedLeadForCloseNetMetering(null)}
          onSuccess={() => {
            setSelectedLeadForCloseNetMetering(null);
            loadData(true);
          }}
        />
      )}

      {/* Modal E: Complete Physical Installation & 5 Photo Upload */}
      {selectedLeadForPhysicalInstallation && (
        <PhysicalInstallationModal
          leadId={selectedLeadForPhysicalInstallation.id}
          leadNumber={selectedLeadForPhysicalInstallation.leadNumber}
          customerName={selectedLeadForPhysicalInstallation.customerName}
          capacityKwp={selectedLeadForPhysicalInstallation.capacityKwp}
          location={selectedLeadForPhysicalInstallation.location}
          onClose={() => setSelectedLeadForPhysicalInstallation(null)}
          onSuccess={() => {
            setSelectedLeadForPhysicalInstallation(null);
            loadData(true);
          }}
        />
      )}
    </div>
  );
};
