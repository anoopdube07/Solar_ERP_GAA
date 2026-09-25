import React, { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  RefreshCw,
  IndianRupee,
  Clock,
  ShieldCheck,
  Building2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Phone,
  Calendar,
  Layers,
  FileText,
  AlertCircle,
  HelpCircle,
  Landmark,
  UserCheck,
  ArrowRight,
  ExternalLink,
  RotateCcw,
  Truck,
  User as UserIcon,
} from 'lucide-react';
import {
  User,
  CustomerReceipt,
  ReceiptFollowUp,
  AccountsLeadOverview,
  AccountsMetrics,
  ReceiptType,
  PayerType,
  PaymentMode,
  DispatchStatus,
  B2BCreditComplianceStatus,
} from '../../shared/types';
import { apiRequest } from '../lib/api';
import { RecordReceiptModal } from './RecordReceiptModal';
import { LogReceiptFollowUpModal } from './LogReceiptFollowUpModal';
import { ReceiptVoucherModal } from './ReceiptVoucherModal';
import { SendBackB2BModal } from './SendBackB2BModal';
import { formatToIST } from '../../shared/timezone';

interface AccountsWorkspaceProps {
  currentUser: User;
  initialTab?: 'overview' | 'receipts' | 'followups' | 'b2c_dispatch' | 'b2b_credit';
  onOpenLeadDetails?: (leadId: string) => void;
}

export const AccountsWorkspace: React.FC<AccountsWorkspaceProps> = ({
  currentUser,
  initialTab = 'overview',
  onOpenLeadDetails,
}) => {
  const isAccountsUser = currentUser?.role === 'ACCOUNTS';
  const [activeTab, setActiveTab] = useState<'overview' | 'receipts' | 'followups' | 'b2c_dispatch' | 'b2b_credit'>(
    initialTab
  );
  const [activeTileFilter, setActiveTileFilter] = useState<
    'receivables' | 'collections' | 'b2c_advance' | 'b2b_dispatch' | 'b2b_awaiting_owner' | 'followups'
  >(
    initialTab === 'receipts'
      ? 'collections'
      : initialTab === 'b2c_dispatch'
      ? 'b2c_advance'
      : initialTab === 'b2b_credit'
      ? 'b2b_awaiting_owner'
      : initialTab === 'followups'
      ? 'followups'
      : 'receivables'
  );

  // Sync activeTab when initialTab prop changes (e.g. from sidebar navigation or links)
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      setActiveTileFilter(
        initialTab === 'receipts'
          ? 'collections'
          : initialTab === 'b2c_dispatch'
          ? 'b2c_advance'
          : initialTab === 'b2b_credit'
          ? 'b2b_awaiting_owner'
          : initialTab === 'followups'
          ? 'followups'
          : 'receivables'
      );
    }
  }, [initialTab]);

  // Data states
  const [metrics, setMetrics] = useState<AccountsMetrics | null>(null);
  const [leads, setLeads] = useState<AccountsLeadOverview[]>([]);
  const [receipts, setReceipts] = useState<CustomerReceipt[]>([]);
  const [followUps, setFollowUps] = useState<ReceiptFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'ALL' | 'B2C' | 'B2B'>('ALL');
  const [receiptTypeFilter, setReceiptTypeFilter] = useState<string>('ALL');
  const [payerTypeFilter, setPayerTypeFilter] = useState<string>('ALL');
  const [followUpStatusFilter, setFollowUpStatusFilter] = useState<string>('ALL');
  const [b2cDispatchFilter, setB2cDispatchFilter] = useState<'ALL' | 'PENDING' | 'CLEARED'>('ALL');
  const [dispatchCustomerTypeFilter, setDispatchCustomerTypeFilter] = useState<'ALL' | 'B2C' | 'B2B'>('ALL');
  const [dispatchStatusFilter, setDispatchStatusFilter] = useState<'ALL' | 'PENDING' | 'CLEARED'>('ALL');
  const [b2bComplianceFilter, setB2bComplianceFilter] = useState<'ALL' | 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING_OWNER'>('ALL');

  // Modal states
  const [showRecordReceiptModal, setShowRecordReceiptModal] = useState(false);
  const [selectedLeadForReceipt, setSelectedLeadForReceipt] = useState<AccountsLeadOverview | null>(null);

  const [showLogFollowUpModal, setShowLogFollowUpModal] = useState(false);
  const [selectedLeadForFollowUp, setSelectedLeadForFollowUp] = useState<AccountsLeadOverview | null>(null);

  const [selectedReceiptForVoucher, setSelectedReceiptForVoucher] = useState<CustomerReceipt | null>(null);

  // Send Back to Lead Team Modal
  const [selectedLeadForSendBack, setSelectedLeadForSendBack] = useState<AccountsLeadOverview | null>(null);

  // Dispatch Clearance Confirmation Modal
  const [dispatchClearingLead, setDispatchClearingLead] = useState<AccountsLeadOverview | null>(null);
  const [dispatchRemarks, setDispatchRemarks] = useState('');
  const [clearingDispatch, setClearingDispatch] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  // Load all accounts data
  const loadAccountsData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const [metricsRes, leadsRes, receiptsRes, followUpsRes] = await Promise.all([
        apiRequest('/api/accounts/metrics'),
        apiRequest('/api/accounts/leads'),
        apiRequest('/api/accounts/receipts'),
        apiRequest('/api/accounts/follow-ups'),
      ]);

      setMetrics(metricsRes.metrics || null);
      setLeads(leadsRes.leads || []);
      setReceipts(receiptsRes.receipts || []);
      setFollowUps(followUpsRes.followUps || []);
    } catch (err) {
      console.error('Failed to load accounts data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAccountsData();
  }, [loadAccountsData]);

  // Handle clearing B2C dispatch
  const handleConfirmClearDispatch = async () => {
    if (!dispatchClearingLead) return;
    setDispatchError(null);
    try {
      setClearingDispatch(true);
      await apiRequest(`/api/accounts/leads/${dispatchClearingLead.id}/clear-dispatch`, {
        method: 'POST',
        body: JSON.stringify({
          remarks: dispatchRemarks || 'Advance payment verified by Accounts. Cleared for material dispatch.',
        }),
      });

      setDispatchClearingLead(null);
      setDispatchRemarks('');
      await loadAccountsData(true);
    } catch (err: any) {
      setDispatchError(err?.message || 'Failed to clear dispatch. Advance payment rule not satisfied.');
    } finally {
      setClearingDispatch(false);
    }
  };

  // Filtered Leads
  const filteredLeads = leads.filter((lead) => {
    if (customerTypeFilter !== 'ALL' && lead.customer_type !== customerTypeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = String(lead.customer_name || '').toLowerCase().includes(q);
      const matchNum = String(lead.lead_number || '').toLowerCase().includes(q);
      const matchPhone = String(lead.mobile_number || '').includes(q);
      if (!matchName && !matchNum && !matchPhone) return false;
    }
    return true;
  });

  // Filtered Receipts
  const filteredReceipts = receipts.filter((rcp) => {
    if (receiptTypeFilter !== 'ALL' && rcp.receipt_type !== receiptTypeFilter) return false;
    if (payerTypeFilter !== 'ALL' && rcp.payer_type !== payerTypeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = String(rcp.receipt_number || '').toLowerCase().includes(q);
      const matchCust = String(rcp.customer_name || '').toLowerCase().includes(q);
      const matchRef = (rcp.reference_number || '').toLowerCase().includes(q);
      const matchPayer = (rcp.payer_name || '').toLowerCase().includes(q);
      if (!matchNum && !matchCust && !matchRef && !matchPayer) return false;
    }
    return true;
  });

  // Filtered Follow-ups
  const filteredFollowUps = followUps.filter((fu) => {
    if (followUpStatusFilter !== 'ALL' && fu.status !== followUpStatusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCust = String(fu.customer_name || '').toLowerCase().includes(q);
      const matchRemarks = String(fu.remarks || '').toLowerCase().includes(q);
      const matchContact = (fu.contact_person || '').toLowerCase().includes(q);
      if (!matchCust && !matchRemarks && !matchContact) return false;
    }
    return true;
  });

  // Dispatch Gated Leads (enforces B2C advance gate and B2B credit terms gate)
  const dispatchLeads = leads.filter((l) => {
    if (dispatchCustomerTypeFilter !== 'ALL' && l.customer_type !== dispatchCustomerTypeFilter) return false;
    if (dispatchStatusFilter === 'PENDING') return l.dispatch_status === 'PENDING_ADVANCE';
    if (dispatchStatusFilter === 'CLEARED') return l.dispatch_status === 'DISPATCH_CLEARED' || l.dispatch_status === 'DISPATCHED' || l.dispatch_status === 'DELIVERED';
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        String(l.customer_name || '').toLowerCase().includes(q) ||
        String(l.lead_number || '').toLowerCase().includes(q) ||
        String(l.mobile_number || '').includes(q)
      );
    }
    return true;
  });

  // B2C Leads specifically
  const b2cLeads = leads.filter((l) => l.customer_type === 'B2C').filter((l) => {
    if (b2cDispatchFilter === 'PENDING') return l.dispatch_status === 'PENDING_ADVANCE';
    if (b2cDispatchFilter === 'CLEARED') return l.dispatch_status === 'DISPATCH_CLEARED' || l.dispatch_status === 'DISPATCHED';
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return String(l.customer_name || '').toLowerCase().includes(q) || String(l.lead_number || '').toLowerCase().includes(q);
    }
    return true;
  });

  // B2B Leads specifically
  const b2bLeads = leads.filter((l) => l.customer_type === 'B2B').filter((l) => {
    if (b2bComplianceFilter === 'COMPLIANT') return l.b2b_credit_compliance === 'COMPLIANT';
    if (b2bComplianceFilter === 'NON_COMPLIANT') return l.b2b_credit_compliance === 'NON_COMPLIANT';
    if (b2bComplianceFilter === 'PENDING_OWNER') return l.b2b_credit_extended === 'YES' && l.owner_approval_status === 'PENDING';
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return String(l.customer_name || '').toLowerCase().includes(q) || String(l.lead_number || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-3.5 sm:space-y-6">
      {/* Top Banner / Workspace Identity */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20 shrink-0">
              <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Accounts Team Desk</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Finance & Collections
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 sm:line-clamp-none">
                Record receipts from customers, track payment follow-ups, verify B2B credit compliance & owner approvals, and enforce B2C dispatch advance rules.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => loadAccountsData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors shadow-2xs shrink-0"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          <button
            onClick={() => {
              setSelectedLeadForFollowUp(null);
              setShowLogFollowUpModal(true);
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors shadow-2xs whitespace-nowrap min-h-[40px]"
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>Log Follow-up</span>
          </button>

          <button
            onClick={() => {
              setSelectedLeadForReceipt(null);
              setShowRecordReceiptModal(true);
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs whitespace-nowrap min-h-[40px]"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Record Receipt</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Strip - Interactive Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-4">
        {/* Tile 1: Total Collections -> Receipts Book */}
        <button
          type="button"
          onClick={() => {
            setActiveTileFilter('collections');
            setActiveTab('receipts');
          }}
          className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border text-left cursor-pointer transition-all relative overflow-hidden min-w-0 ${
            activeTileFilter === 'collections'
              ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500 shadow-md'
              : 'bg-white border-slate-200/80 hover:border-emerald-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate ${
                activeTileFilter === 'collections' ? 'text-emerald-800' : 'text-slate-500'
              }`}
            >
              Collections
            </span>
            {activeTileFilter === 'collections' && (
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse shrink-0" />
            )}
          </div>
          <div
            className={`text-sm sm:text-base md:text-xl font-extrabold mt-1 truncate ${
              activeTileFilter === 'collections' ? 'text-emerald-950' : 'text-slate-900'
            }`}
          >
            ₹{(metrics?.total_collections || 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] sm:text-[11px] text-emerald-600 font-medium mt-0.5 truncate">
            {metrics?.receipts_count || 0} Cleared
          </p>
        </button>

        {/* Tile 2: Total Receivables -> Financial Ledger */}
        <button
          type="button"
          onClick={() => {
            setActiveTileFilter('receivables');
            setActiveTab('overview');
            setCustomerTypeFilter('ALL');
          }}
          className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border text-left cursor-pointer transition-all relative overflow-hidden min-w-0 ${
            activeTileFilter === 'receivables'
              ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-500 shadow-md'
              : 'bg-white border-slate-200/80 hover:border-amber-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate ${
                activeTileFilter === 'receivables' ? 'text-amber-800' : 'text-slate-500'
              }`}
            >
              Receivables
            </span>
            {activeTileFilter === 'receivables' && (
              <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse shrink-0" />
            )}
          </div>
          <div
            className={`text-sm sm:text-base md:text-xl font-extrabold mt-1 truncate ${
              activeTileFilter === 'receivables' ? 'text-amber-900' : 'text-amber-700'
            }`}
          >
            ₹{(metrics?.total_receivables || 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 truncate">Outstanding Balance</p>
        </button>

        {/* Tile 3: B2C Advance Blocked -> B2C Dispatch Gate */}
        <button
          type="button"
          onClick={() => {
            setActiveTileFilter('b2c_advance');
            setActiveTab('b2c_dispatch');
            setDispatchCustomerTypeFilter('B2C');
            setDispatchStatusFilter('PENDING');
          }}
          className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border text-left cursor-pointer transition-all relative overflow-hidden min-w-0 ${
            activeTileFilter === 'b2c_advance'
              ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500 shadow-md'
              : 'bg-white border-rose-200/80 bg-rose-50/20 hover:border-rose-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-[10px] sm:text-[11px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1 truncate">
              <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="truncate">B2C Advance</span>
            </div>
            {activeTileFilter === 'b2c_advance' && (
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse shrink-0" />
            )}
          </div>
          <div className="text-sm sm:text-base md:text-xl font-extrabold text-rose-600 mt-1 truncate">
            {metrics?.b2c_pending_advance_count || 0}
          </div>
          <p className="text-[10px] sm:text-[11px] text-rose-700 font-semibold mt-0.5 truncate">
            ⛔ Dispatch Blocked
          </p>
        </button>

        {/* Tile 4: B2B Dispatch Blocked -> B2B Dispatch Gate */}
        <button
          type="button"
          onClick={() => {
            setActiveTileFilter('b2b_dispatch');
            setActiveTab('b2c_dispatch');
            setDispatchCustomerTypeFilter('B2B');
            setDispatchStatusFilter('PENDING');
          }}
          className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border text-left cursor-pointer transition-all relative overflow-hidden min-w-0 ${
            activeTileFilter === 'b2b_dispatch'
              ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500 shadow-md'
              : 'bg-white border-amber-200/80 bg-amber-50/20 hover:border-amber-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-[10px] sm:text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1 truncate">
              <Truck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="truncate">B2B Blocked</span>
            </div>
            {activeTileFilter === 'b2b_dispatch' && (
              <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse shrink-0" />
            )}
          </div>
          <div className="text-sm sm:text-base md:text-xl font-extrabold text-amber-700 mt-1 truncate">
            {metrics?.b2b_pending_dispatch_count || 0}
          </div>
          <p className="text-[10px] sm:text-[11px] text-amber-700 font-semibold mt-0.5 truncate">
            ⛔ Terms Pending
          </p>
        </button>

        {/* Tile 5: B2B Credit Owner Approval Check -> B2B Credit Approvals */}
        <button
          type="button"
          onClick={() => {
            setActiveTileFilter('b2b_awaiting_owner');
            setActiveTab('b2b_credit');
            setB2bComplianceFilter('PENDING_OWNER');
          }}
          className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border text-left cursor-pointer transition-all relative overflow-hidden min-w-0 ${
            activeTileFilter === 'b2b_awaiting_owner'
              ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500 shadow-md'
              : 'bg-white border-purple-200/80 bg-purple-50/20 hover:border-purple-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-[10px] sm:text-[11px] font-bold text-purple-800 uppercase tracking-wider flex items-center gap-1 truncate">
              <AlertTriangle className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              <span className="truncate">Awaiting Owner</span>
            </div>
            {activeTileFilter === 'b2b_awaiting_owner' && (
              <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse shrink-0" />
            )}
          </div>
          <div className="text-sm sm:text-base md:text-xl font-extrabold text-purple-700 mt-1 truncate">
            {metrics?.b2b_credit_pending_owner_approval || 0}
          </div>
          <p className="text-[10px] sm:text-[11px] text-purple-700 font-medium mt-0.5 truncate">
            Approval Missing
          </p>
        </button>

        {/* Tile 6: Receipt Follow-ups Due -> Follow-ups View */}
        <button
          type="button"
          onClick={() => {
            setActiveTileFilter('followups');
            setActiveTab('followups');
            setFollowUpStatusFilter('ALL');
          }}
          className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border text-left cursor-pointer transition-all relative overflow-hidden min-w-0 ${
            activeTileFilter === 'followups'
              ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500 shadow-md'
              : 'bg-white border-blue-200/80 bg-blue-50/20 hover:border-blue-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-[10px] sm:text-[11px] font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1 truncate">
              <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="truncate">Follow-ups</span>
            </div>
            {activeTileFilter === 'followups' && (
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
            )}
          </div>
          <div className="text-sm sm:text-base md:text-xl font-extrabold text-blue-700 mt-1 truncate">
            {(metrics?.follow_ups_due_today || 0) + (metrics?.follow_ups_overdue || 0)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-blue-600 font-medium mt-0.5 truncate">
            {metrics?.follow_ups_due_today || 0} Today • {metrics?.follow_ups_overdue || 0} Late
          </p>
        </button>
      </div>

      {/* Main Content Workspace */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Navigation Tabs (Hidden for Accounts team users as the tiles directly filter) */}
        {!isAccountsUser && (
          <div className="border-b border-slate-200 bg-slate-50/60 px-4 sm:px-6 pt-2 flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-4 text-xs font-bold rounded-t-xl border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === 'overview'
                  ? 'border-emerald-600 text-emerald-800 bg-white shadow-2xs font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Financial Ledger ({leads.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('receipts')}
              className={`py-3 px-4 text-xs font-bold rounded-t-xl border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === 'receipts'
                  ? 'border-emerald-600 text-emerald-800 bg-white shadow-2xs font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Receipts Book ({receipts.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('followups')}
              className={`py-3 px-4 text-xs font-bold rounded-t-xl border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === 'followups'
                  ? 'border-emerald-600 text-emerald-800 bg-white shadow-2xs font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Receipt Follow-ups ({followUps.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('b2c_dispatch')}
              className={`py-3 px-4 text-xs font-bold rounded-t-xl border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === 'b2c_dispatch'
                  ? 'border-rose-600 text-rose-800 bg-white shadow-2xs font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-rose-600" />
              <span>Dispatch Gate (B2C & B2B Rules)</span>
              {metrics && (metrics.b2c_pending_advance_count + (metrics.b2b_pending_dispatch_count || 0)) > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                  {metrics.b2c_pending_advance_count + (metrics.b2b_pending_dispatch_count || 0)} Blocked
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('b2b_credit')}
              className={`py-3 px-4 text-xs font-bold rounded-t-xl border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === 'b2b_credit'
                  ? 'border-blue-600 text-blue-800 bg-white shadow-2xs font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
              }`}
            >
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>B2B Credit Terms & Owner Approvals</span>
              {metrics && metrics.b2b_credit_pending_owner_approval > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                  {metrics.b2b_credit_pending_owner_approval}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="p-3 sm:p-4 bg-slate-50/40 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 max-w-lg">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by customer name, lead #, receipt #, UTR, mobile..."
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {isAccountsUser && (
              <span className="text-[11px] sm:text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl shadow-2xs shrink-0 inline-flex items-center">
                {activeTab === 'overview'
                  ? `${filteredLeads.length} accounts`
                  : activeTab === 'receipts'
                  ? `${filteredReceipts.length} receipts`
                  : activeTab === 'b2c_dispatch'
                  ? `${dispatchLeads.length} projects`
                  : activeTab === 'b2b_credit'
                  ? `${b2bLeads.length} clients`
                  : `${filteredFollowUps.length} follow-ups`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap text-xs">
            {activeTab === 'overview' && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 font-medium">Customer:</span>
                <select
                  value={customerTypeFilter}
                  onChange={(e) => setCustomerTypeFilter(e.target.value as any)}
                  className="bg-transparent font-semibold text-slate-700 focus:outline-hidden"
                >
                  <option value="ALL">All Types</option>
                  <option value="B2C">B2C Only</option>
                  <option value="B2B">B2B Only</option>
                </select>
              </div>
            )}

            {activeTab === 'receipts' && (
              <>
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                  <span className="text-slate-500 font-medium">Type:</span>
                  <select
                    value={receiptTypeFilter}
                    onChange={(e) => setReceiptTypeFilter(e.target.value)}
                    className="bg-transparent font-semibold text-slate-700 focus:outline-hidden"
                  >
                    <option value="ALL">All Classifications</option>
                    <option value="ADVANCE">Advance Payments</option>
                    <option value="BANK_LOAN_DISBURSEMENT">Bank Loan Disbursements</option>
                    <option value="MILESTONE_PAYMENT">Milestones</option>
                    <option value="FINAL_SETTLEMENT">Final Settlements</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                  <span className="text-slate-500 font-medium">Payer:</span>
                  <select
                    value={payerTypeFilter}
                    onChange={(e) => setPayerTypeFilter(e.target.value)}
                    className="bg-transparent font-semibold text-slate-700 focus:outline-hidden"
                  >
                    <option value="ALL">All Payers</option>
                    <option value="CUSTOMER">Customer Direct</option>
                    <option value="BANK">Bank (Loan)</option>
                  </select>
                </div>
              </>
            )}

            {activeTab === 'followups' && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                <span className="text-slate-500 font-medium">Status:</span>
                <select
                  value={followUpStatusFilter}
                  onChange={(e) => setFollowUpStatusFilter(e.target.value)}
                  className="bg-transparent font-semibold text-slate-700 focus:outline-hidden"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="PROMISED_TO_PAY">Promised to Pay</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            )}

            {activeTab === 'b2c_dispatch' && (
              <>
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                  <span className="text-slate-500 font-medium">Category:</span>
                  <select
                    value={dispatchCustomerTypeFilter}
                    onChange={(e) => setDispatchCustomerTypeFilter(e.target.value as any)}
                    className="bg-transparent font-semibold text-slate-700 focus:outline-hidden"
                  >
                    <option value="ALL">All Categories (B2C & B2B)</option>
                    <option value="B2C">B2C (Advance Gate)</option>
                    <option value="B2B">B2B (Credit Terms Gate)</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                  <span className="text-slate-500 font-medium">Dispatch Status:</span>
                  <select
                    value={dispatchStatusFilter}
                    onChange={(e) => setDispatchStatusFilter(e.target.value as any)}
                    className="bg-transparent font-semibold text-slate-700 focus:outline-hidden"
                  >
                    <option value="ALL">All Dispatch Statuses</option>
                    <option value="PENDING">⛔ Dispatch Blocked</option>
                    <option value="CLEARED">✅ Dispatch Cleared</option>
                  </select>
                </div>
              </>
            )}

            {activeTab === 'b2b_credit' && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                <span className="text-slate-500 font-medium">Compliance:</span>
                <select
                  value={b2bComplianceFilter}
                  onChange={(e) => setB2bComplianceFilter(e.target.value as any)}
                  className="bg-transparent font-semibold text-slate-700 focus:outline-hidden"
                >
                  <option value="ALL">All B2B Projects</option>
                  <option value="PENDING_OWNER">⚠️ Awaiting Owner Approval</option>
                  <option value="COMPLIANT">✅ Paid as per Credit Terms</option>
                  <option value="NON_COMPLIANT">❌ Shortfall / Non-compliant</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Tab 1: Overview & Financial Ledger */}
        {activeTab === 'overview' && (
          <div>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Customer & Project</th>
                    <th className="py-3 px-3">Type & Loan/Credit</th>
                    <th className="py-3 px-3 text-right">Project Value</th>
                    <th className="py-3 px-3 text-right">Received</th>
                    <th className="py-3 px-3 text-right">Balance Due</th>
                    <th className="py-3 px-3">Collection Progress</th>
                    <th className="py-3 px-3">Financial Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No customer projects found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Customer & Project */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{l.customer_name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-slate-600">
                              {l.lead_number}
                            </span>
                            <span>{l.mobile_number}</span>
                          </div>
                        </td>

                        {/* Type & Loan/Credit */}
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              l.customer_type === 'B2C'
                                ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                : 'bg-purple-50 text-purple-700 border border-purple-100'
                            }`}>
                              {l.customer_type}
                            </span>
                            {l.customer_type === 'B2C' && l.b2c_loan_required === 'YES' && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                Loan Opted
                              </span>
                            )}
                            {l.customer_type === 'B2B' && l.b2b_credit_extended === 'YES' && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Credit Extended
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Project Value */}
                        <td className="py-3 px-3 text-right font-semibold text-slate-800">
                          ₹{l.total_project_value.toLocaleString('en-IN')}
                        </td>

                        {/* Received */}
                        <td className="py-3 px-3 text-right font-bold text-emerald-700">
                          ₹{l.total_received.toLocaleString('en-IN')}
                          {l.receipt_count > 0 && (
                            <div className="text-[10px] font-normal text-slate-400">
                              {l.receipt_count} receipts
                            </div>
                          )}
                        </td>

                        {/* Balance Due */}
                        <td className="py-3 px-3 text-right font-bold text-rose-600">
                          ₹{l.balance_due.toLocaleString('en-IN')}
                        </td>

                        {/* Collection Progress */}
                        <td className="py-3 px-3">
                          <div className="w-28">
                            <div className="flex justify-between text-[10px] mb-1 font-semibold">
                              <span className="text-slate-600">{l.collection_percentage}%</span>
                              <span className="text-slate-400">100%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  l.collection_percentage >= 100
                                    ? 'bg-emerald-500'
                                    : l.collection_percentage > 0
                                    ? 'bg-blue-500'
                                    : 'bg-slate-200'
                                }`}
                                style={{ width: `${Math.min(100, l.collection_percentage)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Financial Status & Rules */}
                        <td className="py-3 px-3">
                          {l.customer_type === 'B2C' ? (
                            l.dispatch_status === 'PENDING_ADVANCE' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title="Hard rule: Project cannot move to dispatch until advance is received from customer or Bank.">
                                <XCircle className="w-3 h-3" />
                                <span>Advance Pending (Blocked)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Dispatch Cleared</span>
                              </span>
                            )
                          ) : (
                            l.b2b_credit_extended === 'YES' ? (
                              l.owner_approval_status === 'APPROVED' ? (
                                l.b2b_credit_compliance === 'COMPLIANT' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Compliant Terms</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>Upfront Shortfall</span>
                                  </span>
                                )
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Owner Sign-off Missing</span>
                                </span>
                              )
                            ) : (
                              <span className="text-[10px] text-slate-500 font-medium">Standard Advance</span>
                            )
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setSelectedLeadForReceipt(l);
                                setShowRecordReceiptModal(true);
                              }}
                              className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Record Customer Receipt"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedLeadForFollowUp(l);
                                setShowLogFollowUpModal(true);
                              }}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Log Follow-up"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                            {onOpenLeadDetails && (
                              <button
                                onClick={() => onOpenLeadDetails(l.id)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                title="View Project Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredLeads.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No customer projects found matching filters.
                </div>
              ) : (
                filteredLeads.map((l) => (
                  <div key={l.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{l.customer_name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-slate-600 font-semibold">
                            {l.lead_number}
                          </span>
                          <span>•</span>
                          <a href={`tel:${l.mobile_number}`} className="text-blue-600 hover:underline">
                            {l.mobile_number}
                          </a>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          l.customer_type === 'B2C'
                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                            : 'bg-purple-50 text-purple-700 border border-purple-100'
                        }`}>
                          {l.customer_type}
                        </span>
                        {l.customer_type === 'B2C' && l.b2c_loan_required === 'YES' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            Loan Opted
                          </span>
                        )}
                        {l.customer_type === 'B2B' && l.b2b_credit_extended === 'YES' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Credit Extended
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 3-Column Financial Breakdown */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60 text-center">
                      <div>
                        <div className="text-[10px] text-slate-500 font-medium">Project Value</div>
                        <div className="text-xs font-bold text-slate-800 mt-0.5">
                          ₹{l.total_project_value.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-medium">Received</div>
                        <div className="text-xs font-bold text-emerald-700 mt-0.5">
                          ₹{l.total_received.toLocaleString('en-IN')}
                          {l.receipt_count > 0 && (
                            <span className="block text-[9px] font-normal text-slate-400">
                              ({l.receipt_count} rcvd)
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-medium">Balance Due</div>
                        <div className="text-xs font-bold text-rose-600 mt-0.5">
                          ₹{l.balance_due.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-semibold text-slate-600">
                        <span>Collection Progress</span>
                        <span className="text-emerald-700 font-bold">{l.collection_percentage}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            l.collection_percentage >= 100
                              ? 'bg-emerald-500'
                              : l.collection_percentage > 0
                              ? 'bg-blue-500'
                              : 'bg-slate-200'
                          }`}
                          style={{ width: `${Math.min(100, l.collection_percentage)}%` }}
                        />
                      </div>
                    </div>

                    {/* Status Pill and Actions */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <div>
                        {l.customer_type === 'B2C' ? (
                          l.dispatch_status === 'PENDING_ADVANCE' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-500" />
                              <span>Advance Pending</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Cleared</span>
                            </span>
                          )
                        ) : (
                          l.b2b_credit_extended === 'YES' ? (
                            l.owner_approval_status === 'APPROVED' ? (
                              l.b2b_credit_compliance === 'COMPLIANT' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Compliant</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <AlertCircle className="w-3 h-3 text-rose-500" />
                                  <span>Shortfall</span>
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>Sign-off Missing</span>
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] text-slate-500 font-medium">Standard</span>
                          )
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedLeadForReceipt(l);
                            setShowRecordReceiptModal(true);
                          }}
                          className="px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Receipt</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedLeadForFollowUp(l);
                            setShowLogFollowUpModal(true);
                          }}
                          className="px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Follow-up</span>
                        </button>
                        {onOpenLeadDetails && (
                          <button
                            onClick={() => onOpenLeadDetails(l.id)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-lg"
                            title="View Project Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Customer Receipts Ledger */}
        {activeTab === 'receipts' && (
          <div>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Receipt #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Customer & Project</th>
                    <th className="py-3 px-3">Payer & Source</th>
                    <th className="py-3 px-3">Classification</th>
                    <th className="py-3 px-3">Instrument & Ref</th>
                    <th className="py-3 px-3 text-right">Amount (₹)</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-center">Voucher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No customer receipts recorded yet. Click "Record Customer Receipt" to enter one.
                      </td>
                    </tr>
                  ) : (
                    filteredReceipts.map((rcp) => (
                      <tr key={rcp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {rcp.receipt_number}
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {rcp.receipt_date}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{rcp.customer_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{rcp.lead_number}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-800">{rcp.payer_name || rcp.customer_name}</div>
                          <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            rcp.payer_type === 'BANK'
                              ? 'bg-blue-50 text-blue-700 border border-blue-100'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                            {rcp.payer_type === 'BANK' ? 'Bank (Loan)' : 'Customer Direct'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {rcp.receipt_type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-700">{rcp.payment_mode.replace(/_/g, ' ')}</div>
                          <div className="font-mono text-[10px] text-slate-400 truncate max-w-xs">
                            {rcp.reference_number || 'N/A'}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-black text-emerald-700 font-mono text-sm">
                          ₹{rcp.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{rcp.status}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setSelectedReceiptForVoucher(rcp)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
                          >
                            View Voucher
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredReceipts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No customer receipts recorded yet. Click "Record Customer Receipt" to enter one.
                </div>
              ) : (
                filteredReceipts.map((rcp) => (
                  <div key={rcp.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono font-bold text-slate-900 text-sm">{rcp.receipt_number}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{rcp.receipt_date}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-emerald-700 font-mono">
                          ₹{rcp.amount.toLocaleString('en-IN')}
                        </div>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 mt-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          <span>{rcp.status}</span>
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-[11px]">Customer:</span>
                        <span className="font-bold text-slate-900">{rcp.customer_name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-[11px]">Lead Number:</span>
                        <span className="font-mono text-slate-600 text-[11px]">{rcp.lead_number}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-[11px]">Payer / Source:</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          rcp.payer_type === 'BANK' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {rcp.payer_name || (rcp.payer_type === 'BANK' ? 'Bank (Loan)' : 'Customer Direct')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-[11px]">Classification:</span>
                        <span className="font-semibold text-slate-700 text-[11px]">{rcp.receipt_type.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-[11px]">Mode & Ref:</span>
                        <span className="font-medium text-slate-700 text-[11px]">
                          {rcp.payment_mode.replace(/_/g, ' ')} • {rcp.reference_number || 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => setSelectedReceiptForVoucher(rcp)}
                        className="w-full px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span>View Receipt Voucher</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Receipt Follow-ups */}
        {activeTab === 'followups' && (
          <div>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Customer Project</th>
                    <th className="py-3 px-3">Balance Due</th>
                    <th className="py-3 px-3">Follow-up Date</th>
                    <th className="py-3 px-3">Contact Person</th>
                    <th className="py-3 px-3">Customer Commitment</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4">Remarks</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFollowUps.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No follow-ups recorded yet. Click "Log Follow-up" to schedule one.
                      </td>
                    </tr>
                  ) : (
                    filteredFollowUps.map((fu) => (
                      <tr key={fu.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{fu.customer_name}</div>
                          <div className="text-[10px] font-mono text-slate-400">{fu.lead_number}</div>
                        </td>
                        <td className="py-3 px-3 font-bold text-rose-600">
                          ₹{(fu.balance_due || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-medium text-slate-800">
                            {formatToIST(fu.follow_up_date, true)}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-800">{fu.contact_person || 'Customer'}</div>
                          <div className="text-[10px] text-slate-400">{fu.contact_phone || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-3">
                          {fu.promised_payment_date ? (
                            <div className="p-1.5 rounded-lg bg-blue-50/80 border border-blue-100 text-[11px]">
                              <div className="font-bold text-blue-900">
                                ₹{(fu.promised_amount || 0).toLocaleString('en-IN')}
                              </div>
                              <div className="text-blue-700 text-[10px]">
                                Promised by: {fu.promised_payment_date}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">None stated</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            fu.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : fu.status === 'PROMISED_TO_PAY'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {fu.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <p className="text-xs text-slate-700 line-clamp-2">{fu.remarks}</p>
                          {fu.outcome_notes && (
                            <p className="text-[10px] text-slate-500 italic mt-0.5">Outcome: {fu.outcome_notes}</p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {fu.status !== 'COMPLETED' ? (
                            <button
                              onClick={async () => {
                                try {
                                 await apiRequest(`/api/accounts/follow-ups/${fu.id}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({
                                      status: 'COMPLETED',
                                      outcome_notes: 'Marked completed by accounts desk.',
                                    }),
                                  });
                                  await loadAccountsData(true);
                                } catch (e) {
                                  console.error(e);
                                }
                              }}
                              className="px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                            >
                              Mark Done
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400">Resolved</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredFollowUps.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No follow-ups recorded yet. Click "Log Follow-up" to schedule one.
                </div>
              ) : (
                filteredFollowUps.map((fu) => (
                  <div key={fu.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{fu.customer_name}</div>
                        <div className="text-[11px] font-mono text-slate-500">{fu.lead_number}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        fu.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : fu.status === 'PROMISED_TO_PAY'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {fu.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60 text-xs">
                      <div>
                        <span className="text-slate-500 text-[10px] block">Follow-up Date</span>
                        <span className="font-bold text-slate-800">{formatToIST(fu.follow_up_date, true)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Balance Due</span>
                        <span className="font-bold text-rose-600">₹{(fu.balance_due || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-slate-200/40">
                        <span className="text-slate-500 text-[10px] block">Contact Person</span>
                        <span className="font-semibold text-slate-800">{fu.contact_person || 'Customer'} • {fu.contact_phone || 'N/A'}</span>
                      </div>
                      {fu.promised_payment_date && (
                        <div className="col-span-2 p-2 bg-blue-50/90 rounded-lg border border-blue-100 text-xs text-blue-900">
                          <span className="font-bold">Promised: ₹{(fu.promised_amount || 0).toLocaleString('en-IN')}</span>
                          <span className="block text-[10px] text-blue-700">Due by: {fu.promised_payment_date}</span>
                        </div>
                      )}
                    </div>

                    {fu.remarks && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg italic">
                        "{fu.remarks}"
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      {fu.status !== 'COMPLETED' ? (
                        <button
                          onClick={async () => {
                            try {
                              await apiRequest(`/api/accounts/follow-ups/${fu.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({
                                  status: 'COMPLETED',
                                  outcome_notes: 'Marked completed by accounts desk.',
                                }),
                              });
                              await loadAccountsData(true);
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          className="flex-1 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mark Done</span>
                        </button>
                      ) : (
                        <div className="flex-1 py-1.5 text-xs font-bold text-slate-400 bg-slate-50 rounded-xl text-center">
                          Resolved
                        </div>
                      )}

                      <button
                        onClick={() => {
                          const matched = leads.find((l) => l.id === fu.lead_id) || null;
                          setSelectedLeadForFollowUp(matched);
                          setShowLogFollowUpModal(true);
                        }}
                        className="flex-1 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Update / Reschedule</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Dispatch Clearance Hard-Rule Gatekeeper (B2C Advance & B2B Credit Terms) */}
        {activeTab === 'b2c_dispatch' && (
          <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
            {/* Hard Rules Dual Explainer Banner */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* B2C Hard Rule Card */}
              <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-rose-50 border-2 border-rose-200 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-xs text-rose-950">
                  <h3 className="text-sm font-bold text-rose-900 flex items-center gap-1.5">
                    <span>B2C Dispatch Handoff Hard Rule</span>
                    <span className="px-1.5 py-0.2 rounded-md bg-rose-200 text-rose-800 text-[10px] font-bold">Strict</span>
                  </h3>
                  <p className="mt-1 leading-relaxed text-rose-900/90">
                    For B2C projects, <strong>shall have no handoff to dispatch</strong> until at least one receipt is recorded by accounts for an amount <strong>not less than Rs. 1</strong>.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                    <span className="flex items-center gap-1 text-emerald-800 bg-white/70 px-2 py-0.5 rounded-md border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Receipt ≥ ₹1 Recorded = Cleared
                    </span>
                    <span className="flex items-center gap-1 text-rose-800 bg-white/70 px-2 py-0.5 rounded-md border border-rose-200">
                      <XCircle className="w-3 h-3 text-rose-600" />
                      Zero Receipts = Handoff Blocked
                    </span>
                  </div>
                </div>
              </div>

              {/* B2B Hard Rule Card */}
              <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="text-xs text-amber-950">
                  <h3 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                    <span>B2B Credit Terms Dispatch Gate</span>
                    <span className="px-1.5 py-0.2 rounded-md bg-amber-200 text-amber-800 text-[10px] font-bold">Strict</span>
                  </h3>
                  <p className="mt-1 leading-relaxed text-amber-900/90">
                    A B2B enterprise project <strong>will not shift to dispatch</strong> until payment is received as per credit terms extended AND Owner approval is verified. Non-compliant cases can be sent back to lead team.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                    <span className="flex items-center gap-1 text-emerald-800 bg-white/70 px-2 py-0.5 rounded-md border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Upfront Received + Owner Approved
                    </span>
                    <span className="flex items-center gap-1 text-rose-800 bg-white/70 px-2 py-0.5 rounded-md border border-rose-200">
                      <XCircle className="w-3 h-3 text-rose-600" />
                      Shortfall / Missing Owner Approval
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Gated Projects Table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Project & Customer</th>
                    <th className="py-3 px-3">Type & Terms</th>
                    <th className="py-3 px-3 text-right">Project Value</th>
                    <th className="py-3 px-3 text-right">Required Before Dispatch</th>
                    <th className="py-3 px-3 text-right">Total Received</th>
                    <th className="py-3 px-3">Gate Compliance Check</th>
                    <th className="py-3 px-3">Dispatch Status</th>
                    <th className="py-3 px-4 text-center">Enforcement Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dispatchLeads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No projects matching dispatch criteria found.
                      </td>
                    </tr>
                  ) : (
                    dispatchLeads.map((l) => {
                      const isB2C = l.customer_type === 'B2C';
                      const isB2B = l.customer_type === 'B2B';
                      const isCleared = l.dispatch_status === 'DISPATCH_CLEARED' || l.dispatch_status === 'DISPATCHED' || l.dispatch_status === 'DELIVERED';
                      const canClearDispatch = isB2C ? l.b2c_advance_satisfied : l.b2b_dispatch_satisfied;

                      return (
                        <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Project & Customer */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                  isB2C
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}
                              >
                                {l.customer_type}
                              </span>
                              <div className="font-bold text-slate-900">{l.customer_name}</div>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                              <span>{l.lead_number}</span>
                              <span>•</span>
                              <span>{l.mobile_number}</span>
                              {isB2B && l.lead_owner_name && (
                                <>
                                  <span>•</span>
                                  <span className="text-blue-700 font-semibold flex items-center gap-0.5">
                                    <UserIcon className="w-2.5 h-2.5" />
                                    Lead: {l.lead_owner_name}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Type & Terms */}
                          <td className="py-3.5 px-3">
                            {isB2C ? (
                              l.b2c_loan_required === 'YES' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                  <Landmark className="w-3 h-3 text-blue-600" />
                                  <span>Solar Loan (Bank)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                                  Self-Financed
                                </span>
                              )
                            ) : (
                              <div>
                                {l.b2b_credit_extended === 'YES' ? (
                                  <div>
                                    <span className="font-bold text-purple-700 text-[11px]">
                                      {l.b2b_credit_days || 30}d Credit
                                    </span>
                                    <div className="text-[10px] text-slate-500">
                                      Limit: ₹{(l.requested_credit_amount || 0).toLocaleString('en-IN')}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-500 font-medium">100% Upfront</span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Project Value */}
                          <td className="py-3.5 px-3 text-right font-semibold text-slate-800">
                            ₹{l.total_project_value.toLocaleString('en-IN')}
                          </td>

                          {/* Required Before Dispatch */}
                          <td className="py-3.5 px-3 text-right font-bold text-slate-800">
                            {isB2C ? (
                              <span className="text-rose-700 font-semibold">Advance Receipt</span>
                            ) : (
                              <span>₹{(l.b2b_upfront_required || 0).toLocaleString('en-IN')}</span>
                            )}
                          </td>

                          {/* Total Received */}
                          <td className="py-3.5 px-3 text-right font-bold text-emerald-700">
                            ₹{l.total_received.toLocaleString('en-IN')}
                          </td>

                          {/* Gate Compliance Check */}
                          <td className="py-3.5 px-3">
                            {isB2C ? (
                              <div className="space-y-0.5">
                                {l.has_advance_from_customer && (
                                  <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>Customer Advance Verified</span>
                                  </div>
                                )}
                                {l.has_advance_from_bank && (
                                  <div className="flex items-center gap-1 text-[11px] font-medium text-blue-700">
                                    <Landmark className="w-3 h-3 text-blue-600 shrink-0" />
                                    <span>Bank Disbursement Verified</span>
                                  </div>
                                )}
                                {!l.has_advance_from_customer && !l.has_advance_from_bank && (
                                  <div className="flex items-center gap-1 text-[11px] font-bold text-rose-600">
                                    <XCircle className="w-3 h-3 text-rose-500 shrink-0" />
                                    <span>No Advance Recorded</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {/* Owner approval check */}
                                <div className="text-[10px] flex items-center gap-1">
                                  {l.b2b_credit_extended === 'YES' ? (
                                    l.owner_approval_status === 'APPROVED' ? (
                                      <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        Owner Approved
                                      </span>
                                    ) : (
                                      <span className="text-amber-700 font-bold flex items-center gap-0.5">
                                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                                        Owner Approval Missing
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-slate-400">Standard Terms</span>
                                  )}
                                </div>

                                {/* Upfront check */}
                                <div className="text-[10px]">
                                  {l.total_received >= (l.b2b_upfront_required || 0) ? (
                                    <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      Upfront Satisfied
                                    </span>
                                  ) : (
                                    <span className="text-rose-600 font-bold flex items-center gap-0.5">
                                      <XCircle className="w-3 h-3 text-rose-500" />
                                      Deficit: ₹{Math.max(0, (l.b2b_upfront_required || 0) - l.total_received).toLocaleString('en-IN')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Dispatch Status */}
                          <td className="py-3.5 px-3">
                            {!isCleared ? (
                              <div className="inline-flex flex-col items-start gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                  <span>DISPATCH BLOCKED</span>
                                </span>
                                <span className="text-[9px] text-rose-600 font-medium">
                                  {isB2C ? 'Awaiting advance payment' : 'Credit terms not satisfied'}
                                </span>
                              </div>
                            ) : (
                              <div className="inline-flex flex-col items-start gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>DISPATCH CLEARED</span>
                                </span>
                                <span className="text-[9px] text-slate-400">
                                  {l.dispatch_cleared_by_name ? `By ${l.dispatch_cleared_by_name}` : 'Verified'}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Enforcement Actions */}
                          <td className="py-3.5 px-4 text-center">
                            {!isCleared ? (
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <button
                                  onClick={() => {
                                    setSelectedLeadForReceipt(l);
                                    setShowRecordReceiptModal(true);
                                  }}
                                  className="px-2 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap"
                                  title="Record incoming receipt"
                                >
                                  {isB2C ? 'Record Advance' : 'Record Receipt'}
                                </button>

                                {isB2B && (
                                  <button
                                    onClick={() => setSelectedLeadForSendBack(l)}
                                    className="px-2 py-1 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap"
                                    title="Send back B2B case to Lead team for credit terms renegotiation or collection"
                                  >
                                    <RotateCcw className="w-3 h-3 text-amber-700" />
                                    <span>Send Back</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setDispatchClearingLead(l);
                                    setDispatchRemarks('');
                                    setDispatchError(null);
                                  }}
                                  className={`px-2 py-1 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1 whitespace-nowrap ${
                                    canClearDispatch
                                      ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-300'
                                      : 'text-slate-400 bg-slate-100 border-slate-200 hover:bg-slate-200'
                                  }`}
                                  title={
                                    canClearDispatch
                                      ? 'Verify compliance and clear project for dispatch'
                                      : 'Check conditions before clearing dispatch'
                                  }
                                >
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>Clear Dispatch</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs font-semibold text-emerald-600 flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Cleared</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden">
              {dispatchLeads.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No projects matching dispatch criteria found.
                </div>
              ) : (
                dispatchLeads.map((l) => {
                  const isB2C = l.customer_type === 'B2C';
                  const isB2B = l.customer_type === 'B2B';
                  const isCleared = l.dispatch_status === 'DISPATCH_CLEARED' || l.dispatch_status === 'DISPATCHED' || l.dispatch_status === 'DELIVERED';
                  const canClearDispatch = isB2C ? l.b2c_advance_satisfied : l.b2b_dispatch_satisfied;

                  return (
                    <div key={l.id} className="p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase ${
                              isB2C ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {l.customer_type}
                            </span>
                            <span className="font-bold text-slate-900 text-sm">{l.customer_name}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span>{l.lead_number}</span>
                            <span>•</span>
                            <a href={`tel:${l.mobile_number}`} className="text-blue-600 hover:underline">{l.mobile_number}</a>
                          </div>
                        </div>
                        <div>
                          {!isCleared ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>BLOCKED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>CLEARED</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60 text-center text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Project Value</span>
                          <span className="font-bold text-slate-800">₹{l.total_project_value.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Required Upfront</span>
                          <span className="font-bold text-slate-800">
                            {isB2C ? 'Advance' : `₹${(l.b2b_upfront_required || 0).toLocaleString('en-IN')}`}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Total Received</span>
                          <span className={`font-bold ${l.total_received > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            ₹{l.total_received.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {/* Compliance details */}
                      <div className="text-xs">
                        {isB2C ? (
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                            {l.has_advance_from_customer && (
                              <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>Customer Advance Verified</span>
                              </div>
                            )}
                            {l.has_advance_from_bank && (
                              <div className="flex items-center gap-1 text-[11px] font-medium text-blue-700">
                                <Landmark className="w-3 h-3 text-blue-600 shrink-0" />
                                <span>Bank Disbursement Verified</span>
                              </div>
                            )}
                            {!l.has_advance_from_customer && !l.has_advance_from_bank && (
                              <div className="flex items-center gap-1 text-[11px] font-bold text-rose-600">
                                <XCircle className="w-3 h-3 text-rose-500 shrink-0" />
                                <span>No Advance Recorded</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-500">Owner Approval:</span>
                              <span className={l.owner_approval_status === 'APPROVED' ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                                {l.owner_approval_status === 'APPROVED' ? 'Approved' : 'Missing'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-500">Upfront Compliance:</span>
                              <span className={l.total_received >= (l.b2b_upfront_required || 0) ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                                {l.total_received >= (l.b2b_upfront_required || 0) ? 'Satisfied' : `Deficit: ₹${Math.max(0, (l.b2b_upfront_required || 0) - l.total_received).toLocaleString('en-IN')}`}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100 flex-wrap">
                        <button
                          onClick={() => {
                            setSelectedLeadForReceipt(l);
                            setShowRecordReceiptModal(true);
                          }}
                          className="flex-1 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Record Receipt</span>
                        </button>

                        {!isCleared && (
                          <button
                            onClick={() => {
                              setDispatchClearingLead(l);
                              setDispatchRemarks('');
                              setDispatchError(null);
                            }}
                            className={`flex-1 py-2 text-xs font-bold rounded-xl border flex items-center justify-center gap-1 ${
                              canClearDispatch
                                ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-300'
                                : 'text-slate-400 bg-slate-100 border-slate-200'
                            }`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Clear Dispatch</span>
                          </button>
                        )}

                        {isB2B && !isCleared && (
                          <button
                            onClick={() => setSelectedLeadForSendBack(l)}
                            className="p-2 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl"
                            title="Send Back to Lead Team"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 5: B2B Credit Terms & Owner Approval Monitor */}
        {activeTab === 'b2b_credit' && (
          <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
            {/* B2B Explainer Banner */}
            <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-blue-50 border-2 border-blue-200 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="text-xs text-blue-950">
                  <h3 className="text-sm font-bold text-blue-900">
                    B2B Commercial Credit Terms & Dispatch Control Mandate
                  </h3>
                  <p className="mt-1 leading-relaxed">
                    For commercial B2B clients, the Accounts team has two mandatory enforcement duties:
                  </p>
                  <ol className="list-decimal ml-4 mt-1 space-y-0.5 font-medium">
                    <li><strong>Ensure Owner Approval is given</strong> for extended commercial credit terms. If owner approval is pending or missing, credit cannot be honored.</li>
                    <li><strong>Ensure project will NOT shift to dispatch until amount is received as per credit terms</strong> (upfront required portion must be cleared).</li>
                    <li><strong>Option to send back B2B cases to lead team user</strong>: if payment is not forthcoming, credit terms are breached, or approval is rejected, return the case with remarks.</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* B2B Desktop Table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="py-3 px-4">B2B Enterprise Client</th>
                    <th className="py-3 px-3">Credit Terms</th>
                    <th className="py-3 px-3">Owner Approval Given?</th>
                    <th className="py-3 px-3 text-right">Project Value</th>
                    <th className="py-3 px-3 text-right">Required Upfront</th>
                    <th className="py-3 px-3 text-right">Received So Far</th>
                    <th className="py-3 px-3">Terms Compliance Status</th>
                    <th className="py-3 px-3">Dispatch Status</th>
                    <th className="py-3 px-4 text-center">Enforcement Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {b2bLeads.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No B2B enterprise projects found.
                      </td>
                    </tr>
                  ) : (
                    b2bLeads.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{l.customer_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 flex-wrap">
                            <span>{l.lead_number}</span>
                            <span>•</span>
                            <span>{l.mobile_number}</span>
                            {l.lead_owner_name && (
                              <>
                                <span>•</span>
                                <span className="text-blue-700 font-semibold flex items-center gap-0.5">
                                  <UserIcon className="w-2.5 h-2.5" />
                                  Lead: {l.lead_owner_name}
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Credit Terms Extended */}
                        <td className="py-3.5 px-3">
                          {l.b2b_credit_extended === 'YES' ? (
                            <div>
                              <span className="font-bold text-purple-700">
                                {l.b2b_credit_days || 30} Days Credit
                              </span>
                              <div className="text-[10px] text-slate-500">
                                Limit: ₹{(l.requested_credit_amount || 0).toLocaleString('en-IN')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-medium">Standard 100% Advance</span>
                          )}
                        </td>

                        {/* Owner Approval Status */}
                        <td className="py-3.5 px-3">
                          {l.b2b_credit_extended === 'YES' ? (
                            l.owner_approval_status === 'APPROVED' ? (
                              <div className="inline-flex flex-col items-start gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Approval GIVEN</span>
                                </span>
                                <span className="text-[9px] text-slate-500 font-medium">
                                  Approved: ₹{(l.approved_credit_amount || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            ) : l.owner_approval_status === 'REJECTED' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Approval REJECTED</span>
                              </span>
                            ) : (
                              <div className="inline-flex flex-col items-start gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                  <span>APPROVAL MISSING</span>
                                </span>
                                <span className="text-[9px] text-amber-800 font-semibold">
                                  Pending Owner Sign-off
                                </span>
                              </div>
                            )
                          ) : (
                            <span className="text-slate-400">Not Applicable</span>
                          )}
                        </td>

                        {/* Total Project Value */}
                        <td className="py-3.5 px-3 text-right font-semibold text-slate-800">
                          ₹{l.total_project_value.toLocaleString('en-IN')}
                        </td>

                        {/* Required Upfront */}
                        <td className="py-3.5 px-3 text-right font-bold text-slate-800">
                          ₹{(l.b2b_upfront_required || 0).toLocaleString('en-IN')}
                        </td>

                        {/* Received So Far */}
                        <td className="py-3.5 px-3 text-right font-black text-emerald-700">
                          ₹{l.total_received.toLocaleString('en-IN')}
                        </td>

                        {/* Compliance Status */}
                        <td className="py-3.5 px-3">
                          {l.b2b_credit_extended === 'YES' ? (
                            l.owner_approval_status === 'APPROVED' ? (
                              l.b2b_credit_compliance === 'COMPLIANT' ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>COMPLIANT AS PER TERMS</span>
                                  </span>
                                  <p className="text-[9px] text-slate-500">Upfront portion satisfied</p>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                    <span>SHORTFALL / NON-COMPLIANT</span>
                                  </span>
                                  <p className="text-[9px] text-rose-600 font-bold">
                                    Deficit: ₹{Math.max(0, (l.b2b_upfront_required || 0) - l.total_received).toLocaleString('en-IN')}
                                  </p>
                                </div>
                              )
                            ) : (
                              <span className="text-[10px] text-amber-700 font-semibold italic">
                                Blocked: Awaiting Owner Decision
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] text-slate-500">Standard 100% Upfront</span>
                          )}
                        </td>

                        {/* Dispatch Status */}
                        <td className="py-3.5 px-3">
                          {l.dispatch_status === 'PENDING_ADVANCE' ? (
                            <div className="inline-flex flex-col items-start gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>DISPATCH BLOCKED</span>
                              </span>
                              <span className="text-[9px] text-rose-600 font-medium">
                                Credit terms not satisfied
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex flex-col items-start gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>DISPATCH CLEARED</span>
                              </span>
                              <span className="text-[9px] text-slate-400">
                                {l.dispatch_cleared_by_name ? `By ${l.dispatch_cleared_by_name}` : 'Verified'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => {
                                setSelectedLeadForReceipt(l);
                                setShowRecordReceiptModal(true);
                              }}
                              className="px-2 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap"
                              title="Record payment receipt against this B2B account"
                            >
                              Record Receipt
                            </button>

                            <button
                              onClick={() => setSelectedLeadForSendBack(l)}
                              className="px-2 py-1 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap"
                              title="Send back B2B case to Lead team for renegotiation or collection"
                            >
                              <RotateCcw className="w-3 h-3 text-amber-700" />
                              <span>Send Back</span>
                            </button>

                            {l.dispatch_status === 'PENDING_ADVANCE' ? (
                              <button
                                onClick={() => {
                                  setDispatchClearingLead(l);
                                  setDispatchRemarks('');
                                  setDispatchError(null);
                                }}
                                className={`px-2 py-1 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1 whitespace-nowrap ${
                                  l.b2b_dispatch_satisfied
                                    ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-300'
                                    : 'text-slate-400 bg-slate-100 border-slate-200 hover:bg-slate-200'
                                }`}
                                title={
                                  l.b2b_dispatch_satisfied
                                    ? 'Payment satisfies credit terms & owner approval in place. Click to clear dispatch.'
                                    : 'Hard rule check: Cannot clear dispatch until upfront amount is received and owner approves.'
                                }
                              >
                                <ShieldCheck className="w-3 h-3" />
                                <span>Clear Dispatch</span>
                              </button>
                            ) : (
                              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Cleared</span>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* B2B Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden">
              {b2bLeads.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No B2B enterprise projects found.
                </div>
              ) : (
                b2bLeads.map((l) => {
                  const shortfall = Math.max(0, (l.b2b_upfront_required || 0) - l.total_received);
                  const isCleared = l.dispatch_status === 'DISPATCH_CLEARED' || l.dispatch_status === 'DISPATCHED' || l.dispatch_status === 'DELIVERED';

                  return (
                    <div key={l.id} className="p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-200">
                              B2B Client
                            </span>
                            <span className="font-bold text-slate-900 text-sm">{l.customer_name}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span>{l.lead_number}</span>
                            <span>•</span>
                            <a href={`tel:${l.mobile_number}`} className="text-blue-600 hover:underline">
                              {l.mobile_number}
                            </a>
                            {l.lead_owner_name && (
                              <>
                                <span>•</span>
                                <span className="text-blue-700 font-semibold flex items-center gap-0.5">
                                  <UserIcon className="w-2.5 h-2.5" />
                                  Lead: {l.lead_owner_name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div>
                          {isCleared ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>CLEARED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>BLOCKED</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 3-Column Financial Breakdown */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60 text-center text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Project Value</span>
                          <span className="font-bold text-slate-800">
                            ₹{l.total_project_value.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Required Upfront</span>
                          <span className="font-bold text-slate-800">
                            ₹{(l.b2b_upfront_required || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Total Received</span>
                          <span className={`font-bold ${l.total_received > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            ₹{l.total_received.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {/* Credit Terms & Owner Approval Box */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500">Commercial Credit:</span>
                          <span className="font-bold text-purple-700">
                            {l.b2b_credit_extended === 'YES'
                              ? `${l.b2b_credit_days || 30}d Credit (Limit: ₹${(l.requested_credit_amount || 0).toLocaleString('en-IN')})`
                              : 'Standard 100% Upfront'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500">Owner Approval:</span>
                          {l.b2b_credit_extended === 'YES' ? (
                            l.owner_approval_status === 'APPROVED' ? (
                              <span className="text-emerald-700 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>GIVEN (₹{(l.approved_credit_amount || 0).toLocaleString('en-IN')})</span>
                              </span>
                            ) : l.owner_approval_status === 'REJECTED' ? (
                              <span className="text-rose-700 font-bold flex items-center gap-1">
                                <XCircle className="w-3 h-3 text-rose-600" />
                                <span>REJECTED</span>
                              </span>
                            ) : (
                              <span className="text-amber-800 font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>MISSING SIGN-OFF</span>
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400">Not Applicable</span>
                          )}
                        </div>

                        <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-200/60">
                          <span className="text-slate-500">Terms Compliance:</span>
                          {l.b2b_credit_extended === 'YES' ? (
                            l.owner_approval_status === 'APPROVED' ? (
                              l.b2b_credit_compliance === 'COMPLIANT' ? (
                                <span className="text-emerald-700 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Compliant as per Terms</span>
                                </span>
                              ) : (
                                <span className="text-rose-600 font-bold flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3 text-rose-500" />
                                  <span>Deficit: ₹{shortfall.toLocaleString('en-IN')}</span>
                                </span>
                              )
                            ) : (
                              <span className="text-amber-700 font-semibold italic">
                                Blocked: Awaiting Owner Decision
                              </span>
                            )
                          ) : (
                            <span className="text-slate-500">Standard 100% Upfront</span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100 flex-wrap">
                        <button
                          onClick={() => {
                            setSelectedLeadForReceipt(l);
                            setShowRecordReceiptModal(true);
                          }}
                          className="flex-1 py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Record Receipt</span>
                        </button>

                        <button
                          onClick={() => setSelectedLeadForSendBack(l)}
                          className="py-2.5 px-3 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl flex items-center justify-center gap-1.5"
                          title="Send back B2B case to Lead team"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                          <span>Send Back</span>
                        </button>

                        {!isCleared && (
                          <button
                            onClick={() => {
                              setDispatchClearingLead(l);
                              setDispatchRemarks('');
                              setDispatchError(null);
                            }}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 ${
                              l.b2b_dispatch_satisfied
                                ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-300'
                                : 'text-slate-400 bg-slate-100 border-slate-200'
                            }`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Clear Dispatch</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Record Receipt Modal */}
      {showRecordReceiptModal && (
        <RecordReceiptModal
          lead={selectedLeadForReceipt}
          allLeads={leads}
          onClose={() => {
            setShowRecordReceiptModal(false);
            setSelectedLeadForReceipt(null);
          }}
          onSuccess={async (newReceipt) => {
            setShowRecordReceiptModal(false);
            setSelectedLeadForReceipt(null);
            await loadAccountsData(true);
            setSelectedReceiptForVoucher(newReceipt);
          }}
        />
      )}

      {/* Log Follow-up Modal */}
      {showLogFollowUpModal && (
        <LogReceiptFollowUpModal
          lead={selectedLeadForFollowUp}
          allLeads={leads}
          onClose={() => {
            setShowLogFollowUpModal(false);
            setSelectedLeadForFollowUp(null);
          }}
          onSuccess={async () => {
            setShowLogFollowUpModal(false);
            setSelectedLeadForFollowUp(null);
            await loadAccountsData(true);
          }}
        />
      )}

      {/* Receipt Voucher Print/Preview Modal */}
      {selectedReceiptForVoucher && (
        <ReceiptVoucherModal
          receipt={selectedReceiptForVoucher}
          onClose={() => setSelectedReceiptForVoucher(null)}
        />
      )}

      {/* Dispatch Clearance Hard-Rule Confirmation Modal (B2C & B2B) */}
      {dispatchClearingLead && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className={`px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 flex items-center justify-between shrink-0 ${
              dispatchClearingLead.customer_type === 'B2B' ? 'bg-amber-50' : 'bg-rose-50'
            }`}>
              <div className="flex items-center gap-2.5 font-bold">
                <ShieldCheck className={`w-5 h-5 ${
                  dispatchClearingLead.customer_type === 'B2B' ? 'text-amber-600' : 'text-rose-600'
                }`} />
                <span className={`text-sm sm:text-base ${dispatchClearingLead.customer_type === 'B2B' ? 'text-amber-900' : 'text-rose-900'}`}>
                  {dispatchClearingLead.customer_type === 'B2B'
                    ? 'Enforce B2B Credit Terms Dispatch Gate'
                    : 'Enforce B2C Advance Dispatch Gate'}
                </span>
              </div>
              <button
                onClick={() => setDispatchClearingLead(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 text-xs text-slate-700 overflow-y-auto">
              {dispatchError && (
                <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 font-bold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{dispatchError}</span>
                </div>
              )}

              <div className="p-3 sm:p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer Project:</span>
                  <span className="font-bold text-slate-900">{dispatchClearingLead.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lead Number:</span>
                  <span className="font-mono text-slate-700">{dispatchClearingLead.lead_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Account Type:</span>
                  <span className="font-bold text-slate-800">
                    {dispatchClearingLead.customer_type === 'B2B' ? 'B2B Enterprise Client' : 'B2C Residential Customer'}
                  </span>
                </div>

                {dispatchClearingLead.customer_type === 'B2C' ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Loan Status:</span>
                    <span className="font-semibold text-slate-800">
                      {dispatchClearingLead.b2c_loan_required === 'YES' ? 'Bank Loan Opted' : 'Self-Financed'}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Credit Terms:</span>
                      <span className="font-bold text-purple-700">
                        {dispatchClearingLead.b2b_credit_extended === 'YES'
                          ? `${dispatchClearingLead.b2b_credit_days || 30} Days Credit (Limit: ₹${(dispatchClearingLead.requested_credit_amount || 0).toLocaleString('en-IN')})`
                          : 'Standard 100% Upfront'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Owner Approval:</span>
                      <span className={`font-bold ${
                        dispatchClearingLead.owner_approval_status === 'APPROVED'
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }`}>
                        {dispatchClearingLead.owner_approval_status === 'APPROVED'
                          ? `GIVEN (Approved Limit: ₹${(dispatchClearingLead.approved_credit_amount || 0).toLocaleString('en-IN')})`
                          : (dispatchClearingLead.owner_approval_status || 'PENDING')}
                      </span>
                    </div>
                  </>
                )}

                <div className="flex justify-between">
                  <span className="text-slate-500">Total Project Value:</span>
                  <span className="font-bold text-slate-900">
                    ₹{dispatchClearingLead.total_project_value.toLocaleString('en-IN')}
                  </span>
                </div>

                {dispatchClearingLead.customer_type === 'B2B' && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Required Upfront as per Terms:</span>
                    <span className="font-bold text-slate-900">
                      ₹{(dispatchClearingLead.b2b_upfront_required || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-slate-500">Receipts / Amount Received:</span>
                  <span className={`font-bold ${dispatchClearingLead.total_received > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    ₹{dispatchClearingLead.total_received.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Hard Rule Validation Banner */}
              {dispatchClearingLead.customer_type === 'B2C' ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                  <span className="font-bold">Hard Rule Check: </span>
                  {dispatchClearingLead.b2c_advance_satisfied ? (
                    <span className="text-emerald-800 font-semibold">
                      ✅ Receipt requirement verified: At least one receipt for an amount not less than ₹1 has been recorded by Accounts (Total Received: ₹{dispatchClearingLead.total_received.toLocaleString('en-IN')}). Ready for dispatch clearance.
                    </span>
                  ) : (
                    <span className="text-rose-700 font-bold">
                      ⛔ Hard Rule: For B2C projects, no handoff to dispatch is allowed until at least one receipt is recorded by Accounts for an amount not less than ₹1. Clearance is strictly blocked until a receipt is recorded!
                    </span>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                  <span className="font-bold">Hard Rule Check: </span>
                  {dispatchClearingLead.b2b_dispatch_satisfied ? (
                    <span className="text-emerald-800 font-semibold">
                      ✅ Credit terms satisfied: Total received (₹{dispatchClearingLead.total_received.toLocaleString('en-IN')}) satisfies the required upfront payment (₹{(dispatchClearingLead.b2b_upfront_required || 0).toLocaleString('en-IN')}) and Owner Approval is verified. Project can be cleared for dispatch.
                    </span>
                  ) : (
                    <span className="text-rose-700 font-bold">
                      ⛔ STRICT HARD RULE: Project will not shift to dispatch until amount is received as per credit terms (Deficit: ₹{Math.max(0, (dispatchClearingLead.b2b_upfront_required || 0) - dispatchClearingLead.total_received).toLocaleString('en-IN')}) and Owner Approval is given. You may send this case back to the lead team user.
                    </span>
                  )}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Accounts Clearance Audit Remarks
                </label>
                <textarea
                  rows={2}
                  value={dispatchRemarks}
                  onChange={(e) => setDispatchRemarks(e.target.value)}
                  placeholder={
                    dispatchClearingLead.customer_type === 'B2B'
                      ? 'e.g. Payment as per credit terms verified. Owner approval on file. Cleared for dispatch.'
                      : 'e.g. Advance verified against bank statement. Project cleared for dispatch.'
                  }
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex flex-wrap justify-between items-center gap-2">
                {dispatchClearingLead.customer_type === 'B2B' && !dispatchClearingLead.b2b_dispatch_satisfied ? (
                  <button
                    type="button"
                    onClick={() => {
                      const l = dispatchClearingLead;
                      setDispatchClearingLead(null);
                      setSelectedLeadForSendBack(l);
                    }}
                    className="px-3 py-2 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Send Back to Lead Team</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setDispatchClearingLead(null)}
                    className="px-3.5 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmClearDispatch}
                    disabled={clearingDispatch}
                    className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl flex items-center gap-1.5 text-xs shadow-xs"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{clearingDispatch ? 'Verifying...' : 'Enforce & Clear Dispatch'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Back B2B Case to Lead Team Modal */}
      {selectedLeadForSendBack && (
        <SendBackB2BModal
          lead={selectedLeadForSendBack}
          currentUser={currentUser}
          onClose={() => setSelectedLeadForSendBack(null)}
          onSuccess={async () => {
            setSelectedLeadForSendBack(null);
            await loadAccountsData(true);
          }}
        />
      )}
    </div>
  );
};
