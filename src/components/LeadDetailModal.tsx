import React, { useState, useEffect } from 'react';
import {
  X,
  UserCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Compass,
  ArrowUpRight,
  CornerUpLeft,
  DollarSign,
  FileSpreadsheet,
  History,
  PhoneCall,
  Save,
  AlertCircle,
  ShieldCheck,
  ExternalLink,
  Tag,
  Building2,
  User as UserIcon,
  RotateCcw,
  Check,
  Image as ImageIcon,
  FileCheck,
  FileDown,
  Printer,
  Hammer,
  MapPin,
  Ruler,
  Crosshair,
  Eye,
} from 'lucide-react';
import { apiRequest, formatINR } from '../lib/api';
import { formatToIST } from '../../shared/timezone';
import { Lead, User, Item, Uom, CustomFieldValue, QuotationLine, TaxMode } from '../../shared/types';
import { QuotationEditor } from './QuotationEditor';
import { SiteVisitModal } from './SiteVisitModal';
import { CreditApprovalModal } from './CreditApprovalModal';
import { SubmitCreditModal } from './SubmitCreditModal';
import { EscalationModal } from './EscalationModal';
import { ECPDocumentWorkspace } from './ECPDocumentWorkspace';
import { QuotationPDFModal } from './QuotationPDFModal';

interface LeadDetailModalProps {
  leadId: string;
  currentUser: User;
  items: Item[];
  uoms: Uom[];
  users: User[];
  onClose: () => void;
  onRefresh: () => void;
  initialTab?: 'fields' | 'commercial' | 'documents' | 'followups' | 'site_visits' | 'credit_escalations' | 'history';
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  leadId,
  currentUser,
  items,
  uoms,
  users,
  onClose,
  onRefresh,
  initialTab,
}) => {
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'fields' | 'commercial' | 'documents' | 'followups' | 'site_visits' | 'credit_escalations' | 'history'
  >(
    initialTab &&
      !(
        currentUser.role === 'INSTALLATION_MEMBER' &&
        ['commercial', 'credit_escalations', 'followups'].includes(initialTab)
      )
      ? initialTab
      : 'fields'
  );

  useEffect(() => {
    if (
      currentUser.role === 'INSTALLATION_MEMBER' &&
      (activeTab === 'commercial' || activeTab === 'credit_escalations' || activeTab === 'followups')
    ) {
      setActiveTab('fields');
    }
  }, [currentUser.role, activeTab]);

  // Lead editing state
  const [editedLead, setEditedLead] = useState<Partial<Lead>>({});
  const [quotationState, setQuotationState] = useState<{
    lines: QuotationLine[];
    freight: number;
    taxMode: any;
    cgstRate: number;
    sgstRate: number;
    igstRate: number;
    roundOff: number;
    subtotal: number;
    totalProjectValue: number;
  }>({
    lines: [],
    freight: 0,
    taxMode: 'NO_TAX',
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 0,
    roundOff: 0,
    subtotal: 0,
    totalProjectValue: 0,
  });
  const [customFieldEdits, setCustomFieldEdits] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Workflow modals
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReason, setLostReason] = useState('Price High');
  const [lostRemarks, setLostRemarks] = useState('');

  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpRemarks, setFollowUpRemarks] = useState('');

  const [siteVisitModalMode, setSiteVisitModalMode] = useState<'REQUEST' | 'ASSIGN' | 'COMPLETE' | null>(null);
  const [selectedSiteVisit, setSelectedSiteVisit] = useState<any | null>(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showSubmitCreditModal, setShowSubmitCreditModal] = useState(false);
  const [updatingCredit, setUpdatingCredit] = useState(false);
  const [escalationModalMode, setEscalationModalMode] = useState<'ESCALATE' | 'RETURN' | null>(null);

  // Reassignment state
  const [showReassignDropdown, setShowReassignDropdown] = useState(false);
  const [targetLeadOwnerId, setTargetLeadOwnerId] = useState('');

  // Missing fields dialog
  const [missingRequirements, setMissingRequirements] = useState<string[] | null>(null);

  // Quotation PDF preview & export state
  const [showQuotationPDF, setShowQuotationPDF] = useState(false);

  const fetchLeadDetails = async () => {
    try {
      setLoading(true);
      const res = await apiRequest(`/api/leads/${leadId}`);
      const l: Lead = res.lead;
      setLead(l);
      setEditedLead({
        customer_name: l.customer_name,
        mobile_number: l.mobile_number,
        email: l.email,
        address: l.address,
        location: l.location,
        location_link: l.location_link,
        lead_source: l.lead_source,
        project_installation_location: l.project_installation_location,
        b2c_loan_required: l.b2c_loan_required,
        b2b_credit_extended: l.b2b_credit_extended,
        requested_credit_amount: l.requested_credit_amount,
        remarks: l.remarks,
      });
      setQuotationState({
        lines: (l.quotation_lines || []).map((ql: any) => {
          const q = Number(ql.quantity) || 1;
          const r = Number(ql.rate) || 0;
          const v =
            ql.value !== undefined && !isNaN(Number(ql.value)) && Number(ql.value) > 0
              ? Number(ql.value)
              : Math.round(q * r * 100) / 100;
          return {
            ...ql,
            quantity: q,
            rate: r,
            value: v,
          };
        }),
        freight: Number(l.freight) || 0,
        taxMode: (l.tax_mode as TaxMode) || 'NO_TAX',
        cgstRate: Number(l.cgst_rate) || 0,
        sgstRate: Number(l.sgst_rate) || 0,
        igstRate: Number(l.igst_rate) || 0,
        roundOff: Number(l.round_off) || 0,
        subtotal: Number(l.subtotal) || 0,
        totalProjectValue: Number(l.total_project_value) || 0,
      });

      const fieldMap: Record<string, string> = {};
      (l.custom_values || []).forEach((v) => {
        fieldMap[v.field_key] = v.value;
      });
      setCustomFieldEdits(fieldMap);

      if (initialTab) {
        setActiveTab(initialTab);
      } else if (l.status === 'QUALIFIED' && l.current_team === 'LEAD') {
        setActiveTab('documents');
      } else {
        setActiveTab('fields');
      }

      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load lead details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadDetails();
  }, [leadId]);

  // Handle Save Lead & Quotation
  const handleSaveLead = async () => {
    if (!lead) return;
    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await apiRequest(`/api/leads/${lead.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...editedLead,
          quotation_lines: quotationState.lines,
          freight: quotationState.freight,
          tax_mode: quotationState.taxMode,
          cgst_rate: quotationState.cgstRate,
          sgst_rate: quotationState.sgstRate,
          igst_rate: quotationState.igstRate,
          round_off: quotationState.roundOff,
          custom_fields: customFieldEdits,
        }),
      });

      setSuccessMsg('Lead details and commercial quotation saved successfully.');
      await fetchLeadDetails();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  // Workflow Actions
  const handleQualifyYes = async () => {
    if (!lead) return;
    setError(null);
    setMissingRequirements(null);
    setIsSaving(true);

    try {
      // Auto-save form and quotation state first so backend evaluates current numbers
      await apiRequest(`/api/leads/${lead.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...editedLead,
          quotation_lines: quotationState.lines,
          freight: Number(quotationState.freight) || 0,
          tax_mode: quotationState.taxMode,
          cgst_rate: Number(quotationState.cgstRate) || 0,
          sgst_rate: Number(quotationState.sgstRate) || 0,
          igst_rate: Number(quotationState.igstRate) || 0,
          round_off: Number(quotationState.roundOff) || 0,
          custom_fields: customFieldEdits,
        }),
      });

      const res = await apiRequest(`/api/leads/${lead.id}/workflow`, {
        method: 'POST',
        body: JSON.stringify({ action: 'YES' }),
      });
      setSuccessMsg(res.message || 'Lead successfully qualified and handed off!');
      await fetchLeadDetails();
      onRefresh();
    } catch (err: any) {
      if (err.data?.missing_fields && Array.isArray(err.data.missing_fields)) {
        setMissingRequirements(err.data.missing_fields);
        setError(err.data?.error || 'Cannot qualify Lead: Please complete required fields before qualification.');
      } else {
        setError(err.message || 'Qualification failed.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkLostNo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    if (lostReason === 'OTHER' && !lostRemarks.trim()) {
      setError('Remarks are mandatory when reason is Other.');
      return;
    }

    try {
      await apiRequest(`/api/leads/${lead.id}/workflow`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'NO',
          payload: { lost_reason: lostReason, lost_remarks: lostRemarks },
        }),
      });
      setShowLostModal(false);
      setSuccessMsg('Lead marked as LOST.');
      await fetchLeadDetails();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to mark as lost.');
    }
  };

  const handleReopenLost = async () => {
    if (!lead) return;
    try {
      await apiRequest(`/api/leads/${lead.id}/workflow`, {
        method: 'POST',
        body: JSON.stringify({ action: 'REOPEN_LOST' }),
      });
      setSuccessMsg('Lead reopened successfully.');
      await fetchLeadDetails();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to reopen lead.');
    }
  };

  const handleScheduleFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    if (!followUpDate) {
      setError('Follow-up date/time is required.');
      return;
    }
    if (!followUpRemarks.trim()) {
      setError('Remarks are required.');
      return;
    }

    try {
      await apiRequest(`/api/leads/${lead.id}/workflow`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'FOLLOW_UP',
          payload: { scheduled_at: followUpDate, remarks: followUpRemarks },
        }),
      });
      setShowFollowUpModal(false);
      setFollowUpRemarks('');
      setSuccessMsg('Follow-up scheduled successfully.');
      await fetchLeadDetails();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule follow-up.');
    }
  };

  const handleSubmitCredit = () => {
    setShowSubmitCreditModal(true);
  };

  const handleUpdateCreditExtended = async (newVal: 'YES' | 'NO', customAmount?: number) => {
    if (!lead || lead.customer_type !== 'B2B' || updatingCredit) return;
    setUpdatingCredit(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; message: string; lead: any }>(
        `/api/leads/${lead.id}/credit-extended`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            b2b_credit_extended: newVal,
            requested_credit_amount: newVal === 'YES' ? (customAmount ?? editedLead.requested_credit_amount) : 0,
          }),
        }
      );
      setEditedLead((prev) => ({
        ...prev,
        b2b_credit_extended: newVal,
        requested_credit_amount: newVal === 'YES' ? (customAmount ?? prev.requested_credit_amount) : 0,
      }));
      setSuccessMsg(res.message || `B2B credit setting updated to ${newVal}.`);
      if (newVal === 'NO' && missingRequirements) {
        const remaining = missingRequirements.filter((r) => r !== 'Owner Credit Approval');
        setMissingRequirements(remaining.length > 0 ? remaining : null);
      }
      await fetchLeadDetails();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update credit extension.');
    } finally {
      setUpdatingCredit(false);
    }
  };

  const handleReassignLead = async (targetId: string) => {
    if (!lead || !targetId) return;
    try {
      await apiRequest(`/api/leads/${lead.id}/reassign`, {
        method: 'POST',
        body: JSON.stringify({ target_user_id: targetId }),
      });
      setShowReassignDropdown(false);
      setSuccessMsg('Lead reassigned successfully.');
      await fetchLeadDetails();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to reassign lead.');
    }
  };

  const [updatingLoan, setUpdatingLoan] = useState(false);

  const handleUpdateLoanRequired = async (newVal: 'YES' | 'NO') => {
    if (!lead || lead.customer_type !== 'B2C' || updatingLoan) return;
    setUpdatingLoan(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; message: string; lead: any }>(
        `/api/leads/${lead.id}/loan-required`,
        {
          method: 'PATCH',
          body: JSON.stringify({ b2c_loan_required: newVal }),
        }
      );
      setEditedLead((prev) => ({ ...prev, b2c_loan_required: newVal }));
      setSuccessMsg(res.message || `Solar loan requirement updated to ${newVal}.`);
      await fetchLeadDetails();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update loan requirement.');
    } finally {
      setUpdatingLoan(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-400">
          Loading Lead Details...
        </div>
      </div>
    );
  }

  if (!lead) {
    return null;
  }

  // User authorization check:
  // For B2B & B2C, only respective assigned/reassigned lead team user or Owner/Manager should have option to update/edit/change details of lead. Other team users can only view rights.
  const isAssignedLeadUser =
    currentUser.id === lead.owner_id || currentUser.role === 'OWNER' || currentUser.role === 'MANAGER';
  const isViewOnly = !isAssignedLeadUser;

  // Determine lock conditions
  const isCreditLocked = lead.status === 'OWNER_CREDIT_APPROVAL';
  const isEscalationLocked = lead.status === 'ESCALATED_TO_OWNER';
  const isQualifiedLocked = lead.status === 'QUALIFIED';
  const isLostLocked = lead.status === 'LOST';
  const isEditingLocked = isCreditLocked || isEscalationLocked || isQualifiedLocked || isLostLocked || isViewOnly;

  let lockBannerText: string | null = null;
  if (isCreditLocked) {
    lockBannerText = 'This Lead is currently awaiting Owner Credit Approval. All edits are locked until Owner decides on credit terms.';
  } else if (isEscalationLocked) {
    lockBannerText = 'This Lead is escalated to Owner. Actions and modifications are locked during review.';
  } else if (isQualifiedLocked) {
    lockBannerText = `This Lead is QUALIFIED and transferred to ${lead.current_team}. Unrestricted editing is locked.`;
  } else if (isLostLocked) {
    lockBannerText = 'This Lead is marked as LOST. Only an Owner can reopen this Lead.';
  } else if (isViewOnly) {
    const assignedUser = users.find((u) => u.id === lead.owner_id);
    lockBannerText = `View-Only Access: Only the assigned lead owner (${assignedUser?.name || 'Assigned User'}), Manager, or Owner can update this lead's details.`;
  }

  // Active Lead team members for reassignment
  const leadTeamMembers = users.filter((u) => u.role === 'LEAD' && u.active);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl h-[94vh] flex flex-col overflow-hidden shadow-2xl text-slate-900">
        {/* Top Header */}
        <div className="p-4 sm:px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/90 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm shadow-xs">
              #{lead.lead_number}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {lead.customer_name}
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                  {lead.customer_type}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    lead.status === 'QUALIFIED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : lead.status === 'LOST'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : lead.status === 'SITE_VISIT_PENDING'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : lead.status === 'ESCALATED_TO_OWNER'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : lead.status === 'OWNER_CREDIT_APPROVAL'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {lead.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                <span>📱 {lead.mobile_number}</span>
                <span>•</span>
                <span>Team: <strong className="text-slate-700">{lead.current_team}</strong></span>
                {currentUser?.role !== 'LEAD' && (
                  <>
                    <span>•</span>
                    <span>Owner: <strong className="text-slate-700">{lead.owner_name}</strong></span>
                  </>
                )}
                {lead.customer_type === 'B2C' && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <span>Loan:</span>
                      <button
                        type="button"
                        disabled={updatingLoan}
                        onClick={() => handleUpdateLoanRequired(editedLead.b2c_loan_required === 'YES' ? 'NO' : 'YES')}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                          editedLead.b2c_loan_required === 'YES'
                            ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200'
                            : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                        }`}
                        title="Click to toggle Bank Solar Loan requirement (YES/NO)"
                      >
                        <span>{editedLead.b2c_loan_required === 'YES' ? 'YES' : 'NO'}</span>
                        <span className="text-[9px] font-normal text-slate-500 underline ml-0.5">
                          {updatingLoan ? '...' : 'Change'}
                        </span>
                      </button>
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Reassign Lead (Owner & Manager Only) */}
            {(currentUser.role === 'OWNER' || currentUser.role === 'MANAGER') && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowReassignDropdown(!showReassignDropdown)}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">Reassign</span>
                </button>

                {showReassignDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-50 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block px-2 py-1">
                      Assign to Active Lead:
                    </span>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {leadTeamMembers.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleReassignLead(m.id)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between ${
                            m.id === lead.owner_id
                              ? 'bg-blue-50 text-blue-700 font-bold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span>{m.name}</span>
                          {m.id === lead.owner_id && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Workflow Command Center / Action Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          {currentUser.role === 'INSTALLATION_MEMBER' ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 font-semibold flex items-center gap-1.5">
                <Hammer className="w-3.5 h-3.5 text-teal-600" />
                <span>Field Crew View • Site &amp; Technical Feasibility Mode</span>
              </span>
            </div>
          ) : isViewOnly && currentUser.role !== 'OWNER' ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 font-semibold flex items-center gap-1.5 shadow-xs">
                <Eye className="w-3.5 h-3.5 text-amber-700" />
                <span>View Rights Only • Assigned to {lead.owner_name}</span>
              </span>
            </div>
          ) : (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Action YES (Qualify) */}
            {lead.status === 'PENDING' && (
              <button
                type="button"
                id="workflow-btn-yes"
                onClick={handleQualifyYes}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
                title="Qualify Lead & Handoff"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>YES (Qualify)</span>
              </button>
            )}

            {/* Action NO (Lost) */}
            {lead.status === 'PENDING' && (
              <button
                type="button"
                id="workflow-btn-no"
                onClick={() => setShowLostModal(true)}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold flex items-center gap-1.5 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                <span>NO (Lost)</span>
              </button>
            )}

            {/* ECP Documents Gateway Action */}
            {lead.status === 'QUALIFIED' && lead.current_team === 'LEAD' && (
              <button
                type="button"
                id="workflow-btn-ecp-docs"
                onClick={() => setActiveTab('documents')}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <FileCheck className="w-4 h-4" />
                <span>Upload ECP Documents</span>
              </button>
            )}

            {/* Reopen Lost (Owner Only) */}
            {lead.status === 'LOST' && currentUser.role === 'OWNER' && (
              <button
                type="button"
                id="workflow-btn-reopen"
                onClick={handleReopenLost}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reopen Lead</span>
              </button>
            )}

            {/* Schedule Follow-up */}
            {lead.status === 'PENDING' && (
              <button
                type="button"
                id="workflow-btn-followup"
                onClick={() => setShowFollowUpModal(true)}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
                <span>Follow-up Call</span>
              </button>
            )}

            {/* Request Site Visit (B2C Only) */}
            {lead.customer_type === 'B2C' && lead.status === 'PENDING' && (
              <button
                type="button"
                id="workflow-btn-site-visit"
                onClick={() => {
                  setSelectedSiteVisit(null);
                  setSiteVisitModalMode('REQUEST');
                }}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-blue-700 border border-blue-200 rounded-xl font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Site Visit</span>
              </button>
            )}

            {/* Escalate to Owner */}
            {lead.status === 'PENDING' && (
              <button
                type="button"
                id="workflow-btn-escalate"
                onClick={() => setEscalationModalMode('ESCALATE')}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-purple-700 border border-purple-200 rounded-xl font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Escalate</span>
              </button>
            )}

            {/* Owner Return Escalation */}
            {lead.status === 'ESCALATED_TO_OWNER' && currentUser.role === 'OWNER' && (
              <button
                type="button"
                onClick={() => setEscalationModalMode('RETURN')}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <CornerUpLeft className="w-4 h-4" />
                <span>Review & Return Escalation</span>
              </button>
            )}

            {/* Submit B2B Credit Request */}
            {lead.customer_type === 'B2B' &&
              lead.status === 'PENDING' &&
              editedLead.b2b_credit_extended === 'YES' && (
                <button
                  type="button"
                  onClick={handleSubmitCredit}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-xl font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Submit Credit for Approval</span>
                </button>
              )}

            {/* Owner Decide Credit */}
            {lead.status === 'OWNER_CREDIT_APPROVAL' && currentUser.role === 'OWNER' && (
              <button
                type="button"
                onClick={() => setShowCreditModal(true)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Decide Credit Approval</span>
              </button>
            )}

            {/* Awaiting Owner Status Badge for Non-Owners */}
            {lead.status === 'OWNER_CREDIT_APPROVAL' && currentUser.role !== 'OWNER' && (
              <div className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl font-medium text-xs flex items-center gap-1.5 shadow-xs">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Awaiting Owner Credit Approval</span>
              </div>
            )}
          </div>
          )}

          <div className="flex items-center gap-2">
            {/* Quotation PDF Export Button */}
            {currentUser.role !== 'INSTALLATION_MEMBER' && (
              <button
                type="button"
                id="btn-header-quotation-pdf"
                onClick={() => setShowQuotationPDF(true)}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                title="Preview & Download Standard Quotation PDF"
              >
                <Printer className="w-3.5 h-3.5 text-blue-600" />
                <span>PDF Quotation</span>
              </button>
            )}

            {/* Save Button */}
            {!isEditingLocked && (
              <button
                type="button"
                id="lead-save-btn"
                onClick={handleSaveLead}
                disabled={isSaving}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            )}
          </div>
        </div>

        {/* View-Only Banner */}
        {isViewOnly && (
          <div className="px-6 py-2 bg-amber-50/90 border-b border-amber-200 text-amber-900 text-xs font-semibold flex items-center justify-between gap-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 flex-shrink-0 text-amber-700" />
              <span>
                For B2B &amp; B2C, only the respective assigned/reassigned lead team user (<strong>{lead.owner_name}</strong>) can update, edit, or change details of this lead. Other team users have view rights only.
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-bold uppercase tracking-wider shrink-0">
              View Only
            </span>
          </div>
        )}

        {/* Notices */}
        {lockBannerText && (
          <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2 flex-shrink-0">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
            <span>{lockBannerText}</span>
          </div>
        )}

        {error && (
          <div className="m-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2 flex-shrink-0">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="m-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2 flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Missing Requirements Checklist Modal/Warning */}
        {missingRequirements && (
          <div className="m-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-3 flex-shrink-0">
            <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <span>Cannot Qualify Lead: Missing Mandatory Fields Before YES</span>
            </div>
            <p className="text-slate-700">
              In accordance with Solar ERP rules, the following requirements must be satisfied before this {lead.customer_type} Lead can be qualified:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-800 font-medium pl-2">
              {missingRequirements.map((req, i) => (
                <li key={i} className="text-amber-800 font-semibold">{req}</li>
              ))}
            </ul>

            {/* Special Contextual Quick Action for Owner Credit Approval */}
            {missingRequirements.includes('Owner Credit Approval') && lead.customer_type === 'B2B' && (
              <div className="p-3 bg-white/90 border border-indigo-200 rounded-xl space-y-2 mt-1">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-indigo-900 flex items-center gap-1.5 text-xs">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span>How to resolve &ldquo;Owner Credit Approval&rdquo;:</span>
                  </div>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  • <strong>Option A (Credit Extended):</strong> Submit credit request to Owner for review. Once approved, the lead can be qualified.
                  <br />
                  • <strong>Option B (No Credit Needed):</strong> If client is paying 100% advance or milestone payments, toggle Credit to &ldquo;NO&rdquo; to qualify immediately without Owner approval.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowSubmitCreditModal(true)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Submit Credit for Owner Approval</span>
                  </button>
                  <button
                    type="button"
                    disabled={updatingCredit}
                    onClick={() => handleUpdateCreditExtended('NO')}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Set Credit to NO (100% Advance - No Credit Needed)</span>
                  </button>
                  {currentUser.role === 'OWNER' && (
                    <button
                      type="button"
                      onClick={() => setShowCreditModal(true)}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Approve as Owner Now</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('fields');
                  setTimeout(() => {
                    const el = document.getElementById('custom-fields-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }, 50);
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                Go to Fields &amp; Specs
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('commercial');
                }}
                className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                Go to Commercial &amp; Quotation
              </button>
              <button
                type="button"
                onClick={() => setMissingRequirements(null)}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Workspace Navigation Tabs */}
        <div className="px-6 border-b border-slate-200 flex items-center gap-4 bg-white flex-shrink-0 overflow-x-auto text-xs font-semibold">
          {/* 1. Lead Details & Customer Fields */}
          <button
            id="tab-btn-lead-fields"
            onClick={() => setActiveTab('fields')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'fields'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Tag className="w-4 h-4" />
            Lead Details & Customer Fields
          </button>

          {/* 2. Commercial & Quotation (Hidden for Field Technicians) */}
          {currentUser.role !== 'INSTALLATION_MEMBER' && (
            <button
              id="tab-btn-commercial-quotation"
              onClick={() => setActiveTab('commercial')}
              className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'commercial'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Commercial & Quotation
            </button>
          )}

          {/* 3. ECP Documents */}
          <button
            id="tab-btn-ecp-documents"
            onClick={() => setActiveTab('documents')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'documents'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>ECP Documents</span>
            {lead.status === 'QUALIFIED' && lead.current_team === 'LEAD' && (
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            )}
            {(lead.current_team === 'REGISTRATION_1' || lead.current_team === 'REGISTRATION_TEAM') && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                Reg 1
              </span>
            )}
          </button>

          {/* Follow-up Log (Hidden for Field Technicians) */}
          {currentUser.role !== 'INSTALLATION_MEMBER' && (
            <button
              onClick={() => setActiveTab('followups')}
              className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'followups'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <PhoneCall className="w-4 h-4" />
              Follow-up Log ({lead.follow_ups?.length || 0})
            </button>
          )}

          {lead.customer_type === 'B2C' && (
            <button
              onClick={() => setActiveTab('site_visits')}
              className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'site_visits'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Compass className="w-4 h-4" />
              Site Visits ({lead.site_visits?.length || 0})
            </button>
          )}

          {/* Credit & Escalations (Hidden for Field Technicians) */}
          {currentUser.role !== 'INSTALLATION_MEMBER' && (
            <button
              onClick={() => setActiveTab('credit_escalations')}
              className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'credit_escalations'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Credit & Escalations
            </button>
          )}

          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            Audit History ({lead.workflow_history?.length || 0})
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/40">
          {/* TAB 1: Lead Details & Custom Fields */}
          {activeTab === 'fields' && (
            <div className="space-y-6">
              {/* Standard Information */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Standard Contact & Site Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 mb-1">Customer / Organization Name</label>
                    <input
                      type="text"
                      disabled={isEditingLocked}
                      value={editedLead.customer_name || ''}
                      onChange={(e) => setEditedLead((prev) => ({ ...prev, customer_name: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">Mobile Number (10 digits)</label>
                    <input
                      type="tel"
                      maxLength={10}
                      disabled={isEditingLocked}
                      value={editedLead.mobile_number || ''}
                      onChange={(e) =>
                        setEditedLead((prev) => ({
                          ...prev,
                          mobile_number: e.target.value.replace(/\D/g, ''),
                        }))
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-blue-500 shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">Email Address</label>
                    <input
                      type="email"
                      disabled={isEditingLocked}
                      value={editedLead.email || ''}
                      onChange={(e) => setEditedLead((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">City / Location</label>
                    <input
                      type="text"
                      disabled={isEditingLocked}
                      value={editedLead.location || ''}
                      onChange={(e) => setEditedLead((prev) => ({ ...prev, location: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 mb-1">Premises Address</label>
                    <input
                      type="text"
                      disabled={isEditingLocked}
                      value={editedLead.address || ''}
                      onChange={(e) => setEditedLead((prev) => ({ ...prev, address: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">Project Installation Location</label>
                    <input
                      type="text"
                      disabled={isEditingLocked}
                      value={editedLead.project_installation_location || ''}
                      onChange={(e) =>
                        setEditedLead((prev) => ({
                          ...prev,
                          project_installation_location: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">Google Maps Location Link</label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        disabled={isEditingLocked}
                        value={editedLead.location_link || ''}
                        onChange={(e) =>
                          setEditedLead((prev) => ({ ...prev, location_link: e.target.value }))
                        }
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                      />
                      {editedLead.location_link && (
                        <a
                          href={editedLead.location_link}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-blue-700 shadow-xs"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* B2B Commercial Credit Terms & Option (Tab 1) */}
              {lead.customer_type === 'B2B' && (
                <div className="bg-white border border-indigo-200/80 rounded-xl p-4 space-y-3 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200/80 pb-3">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-indigo-600" />
                        <span>B2B Commercial Terms &amp; Credit Extension</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Deferred payment credit terms require explicit financial clearance by Company Owner before qualification.
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="b2b_credit_tab1"
                          value="NO"
                          disabled={isEditingLocked || updatingCredit}
                          checked={editedLead.b2b_credit_extended === 'NO'}
                          onChange={() => handleUpdateCreditExtended('NO')}
                          className="accent-indigo-600 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span>NO (100% Upfront Advance)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="b2b_credit_tab1"
                          value="YES"
                          disabled={isEditingLocked || updatingCredit}
                          checked={editedLead.b2b_credit_extended === 'YES'}
                          onChange={() => handleUpdateCreditExtended('YES')}
                          className="accent-indigo-600 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span>YES (Deferred Credit)</span>
                      </label>
                    </div>
                  </div>

                  {editedLead.b2b_credit_extended === 'NO' ? (
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>
                          <strong>100% Upfront / Milestone Advance Basis:</strong> No credit extended to client. Lead does <strong>not</strong> require Owner Credit Approval to qualify.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-slate-500 block mb-0.5 text-[11px]">Requested Credit Amount</span>
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            {formatINR(editedLead.requested_credit_amount || 0)}
                          </span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-slate-500 block mb-0.5 text-[11px]">Credit Term</span>
                          <span className="font-semibold text-slate-900 text-sm">
                            {lead.b2b_credit_days || 30} Days
                          </span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-slate-500 block mb-0.5 text-[11px]">Owner Approval Status</span>
                          {lead.status === 'OWNER_CREDIT_APPROVAL' ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[11px] inline-block">
                              Awaiting Owner Review
                            </span>
                          ) : Number(lead.approved_credit_amount) > 0 ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[11px] inline-block">
                              Approved: {formatINR(lead.approved_credit_amount)}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[11px] inline-block">
                              Approval Required Before YES
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                        <p className="text-[11px] text-slate-500">
                          Credit terms require financial clearance by Company Owner before qualification.
                        </p>
                        <div className="flex items-center gap-2">
                          {lead.status === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => setShowSubmitCreditModal(true)}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Submit Credit to Owner</span>
                            </button>
                          )}
                          {currentUser.role === 'OWNER' && (
                            <button
                              type="button"
                              onClick={() => setShowCreditModal(true)}
                              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Owner Credit Decision</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Dynamic Custom Fields */}
              <div id="custom-fields-section" className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {lead.customer_type} Configurable Custom Fields
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Defined by Owner in Master Settings
                  </span>
                </div>

                {(!lead.custom_values || lead.custom_values.length === 0) ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    No custom fields configured for {lead.customer_type}.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {lead.custom_values.map((field) => {
                      const isMissing = missingRequirements?.some(
                        (req) => req.toLowerCase() === (field.label || '').toLowerCase()
                      );
                      const currentVal = customFieldEdits[field.field_key] ?? field.value ?? '';

                      let parsedOptions: string[] = [];
                      if (field.options) {
                        try {
                          parsedOptions = Array.isArray(field.options)
                            ? field.options
                            : JSON.parse(field.options as string);
                        } catch {
                          parsedOptions = String(field.options)
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean);
                        }
                      }

                      return (
                        <div
                          key={field.id}
                          className={`p-3 rounded-xl border transition-all ${
                            isMissing
                              ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-200'
                              : 'border-slate-200 bg-slate-50/30'
                          }`}
                        >
                          <label className="block text-slate-700 font-semibold mb-1">
                            {field.label}
                            {field.required_before_yes && (
                              <span className="text-amber-700 ml-1.5 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-100">
                                Required for YES
                              </span>
                            )}
                          </label>

                          {field.type === 'SELECT' && parsedOptions.length > 0 ? (
                            <select
                              disabled={isEditingLocked}
                              value={currentVal}
                              onChange={(e) =>
                                setCustomFieldEdits((prev) => ({
                                  ...prev,
                                  [field.field_key]: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                            >
                              <option value="">-- Select {field.label} --</option>
                              {parsedOptions.map((opt, idx) => (
                                <option key={idx} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : field.type === 'NUMBER' ? (
                            <input
                              type="number"
                              step="any"
                              disabled={isEditingLocked}
                              value={currentVal}
                              placeholder={`Enter numeric ${field.label}`}
                              onChange={(e) =>
                                setCustomFieldEdits((prev) => ({
                                  ...prev,
                                  [field.field_key]: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-blue-500 shadow-xs"
                            />
                          ) : field.type === 'TEXTAREA' ? (
                            <textarea
                              rows={2}
                              disabled={isEditingLocked}
                              value={currentVal}
                              placeholder={`Enter ${field.label}`}
                              onChange={(e) =>
                                setCustomFieldEdits((prev) => ({
                                  ...prev,
                                  [field.field_key]: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs resize-none"
                            />
                          ) : (
                            <input
                              type="text"
                              disabled={isEditingLocked}
                              value={currentVal}
                              placeholder={`Enter ${field.label}`}
                              onChange={(e) =>
                                setCustomFieldEdits((prev) => ({
                                  ...prev,
                                  [field.field_key]: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Commercial & Quotation */}
          {activeTab === 'commercial' && (
            <div className="space-y-6">
              {/* Quotation Header & PDF Action Bar */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Commercial Proposal &amp; Quotation
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-mono font-bold">
                      QTN-{lead.customer_type}-{lead.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Standard solar EPC techno-commercial schedule with BOQ lines, freight, GST calculation, and execution terms.
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-right sm:mr-1">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Total Value</span>
                    <span className="text-sm font-black text-slate-900 font-mono">
                      {formatINR(quotationState.totalProjectValue)}
                    </span>
                  </div>

                  <button
                    type="button"
                    id="btn-generate-quotation-pdf"
                    onClick={() => setShowQuotationPDF(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>Generate PDF Quotation</span>
                  </button>
                </div>
              </div>

              {/* Customer Type Specific Commercial Controls */}
              {lead.customer_type === 'B2C' ? (
                <div className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
                      Bank Solar Loan Required?
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Can be changed anytime (YES/NO) after lead creation to toggle financing requirements
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="b2cLoanEdit"
                        value="NO"
                        disabled={updatingLoan}
                        checked={editedLead.b2c_loan_required === 'NO'}
                        onChange={() => handleUpdateLoanRequired('NO')}
                        className="accent-blue-600 cursor-pointer"
                      />
                      NO (Direct Capex)
                    </label>
                    <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="b2cLoanEdit"
                        value="YES"
                        disabled={updatingLoan}
                        checked={editedLead.b2c_loan_required === 'YES'}
                        onChange={() => handleUpdateLoanRequired('YES')}
                        className="accent-blue-600 cursor-pointer"
                      />
                      YES (Bank Solar Loan)
                    </label>
                    {updatingLoan && (
                      <span className="text-[11px] text-blue-600 animate-pulse font-normal">
                        Saving...
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
                          Commercial Credit Extended?
                        </span>
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          B2B • No Option for Loan
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        If credit is extended, Solar ERP rules require explicit Owner approval before qualification. If paying 100% advance, keep as NO.
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="b2bCreditEdit"
                          value="NO"
                          disabled={isEditingLocked || updatingCredit}
                          checked={editedLead.b2b_credit_extended === 'NO'}
                          onChange={() => handleUpdateCreditExtended('NO')}
                          className="accent-indigo-600 cursor-pointer"
                        />
                        NO (100% Upfront Advance)
                      </label>
                      <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="b2bCreditEdit"
                          value="YES"
                          disabled={isEditingLocked || updatingCredit}
                          checked={editedLead.b2b_credit_extended === 'YES'}
                          onChange={() => handleUpdateCreditExtended('YES')}
                          className="accent-indigo-600 cursor-pointer"
                        />
                        YES (Deferred Credit)
                      </label>
                      {updatingCredit && (
                        <span className="text-[11px] text-indigo-600 animate-pulse font-normal">
                          Saving...
                        </span>
                      )}
                    </div>
                  </div>

                  {editedLead.b2b_credit_extended === 'YES' && (
                    <div className="pt-3 border-t border-slate-200 space-y-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">
                            Requested Credit Amount (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            disabled={isEditingLocked}
                            value={editedLead.requested_credit_amount || 0}
                            onChange={(e) =>
                              setEditedLead((prev) => ({
                                ...prev,
                                requested_credit_amount: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-sm focus:outline-none focus:border-indigo-500 shadow-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">
                            Approved Credit Amount (Owner Authorized)
                          </label>
                          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-emerald-700 font-mono font-bold text-sm shadow-xs">
                            {formatINR(lead.approved_credit_amount)}
                          </div>
                        </div>
                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">
                            Owner Approval Status
                          </label>
                          <div className="pt-1">
                            {lead.status === 'OWNER_CREDIT_APPROVAL' ? (
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-md font-bold text-xs inline-block">
                                Awaiting Owner Review
                              </span>
                            ) : Number(lead.approved_credit_amount) > 0 ? (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md font-bold text-xs inline-block">
                                Approved: {formatINR(lead.approved_credit_amount)}
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-md font-bold text-xs inline-block">
                                Approval Required Before YES
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-500">
                          {lead.status === 'OWNER_CREDIT_APPROVAL'
                            ? 'Lead is submitted to Owner. All inputs locked until Owner decides.'
                            : 'Click submit below to send for Owner approval.'}
                        </span>
                        <div className="flex items-center gap-2">
                          {lead.status === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => setShowSubmitCreditModal(true)}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Submit Credit to Owner</span>
                            </button>
                          )}
                          {currentUser.role === 'OWNER' && (
                            <button
                              type="button"
                              onClick={() => setShowCreditModal(true)}
                              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Owner Credit Decision</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quotation Editor with automatic calculations */}
              <QuotationEditor
                lines={quotationState.lines}
                freight={quotationState.freight}
                taxMode={quotationState.taxMode}
                cgstRate={quotationState.cgstRate}
                sgstRate={quotationState.sgstRate}
                igstRate={quotationState.igstRate}
                roundOff={quotationState.roundOff}
                isReadOnly={isEditingLocked}
                lockReason={lockBannerText}
                items={items}
                uoms={uoms}
                onChange={(updated) => setQuotationState(updated)}
              />
            </div>
          )}

          {/* TAB: ECP Document Checklist Workspace */}
          {activeTab === 'documents' && (
            <ECPDocumentWorkspace
              leadId={lead.id}
              lead={lead}
              currentUser={currentUser}
              onRefreshLead={() => {
                fetchLeadDetails();
                onRefresh();
              }}
            />
          )}

          {/* TAB 3: Follow-up Call Log */}
          {activeTab === 'followups' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Lead Team Call Sequence & History
                </h3>
                {lead.status === 'PENDING' && isAssignedLeadUser && (
                  <button
                    type="button"
                    onClick={() => setShowFollowUpModal(true)}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Log / Schedule Next Call</span>
                  </button>
                )}
              </div>

              {(!lead.follow_ups || lead.follow_ups.length === 0) ? (
                <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs shadow-xs">
                  No follow-up calls scheduled yet. Click &quot;Follow-up Call&quot; to log initial outreach.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {lead.follow_ups.map((call) => (
                    <div
                      key={call.id}
                      className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start justify-between gap-4 text-xs shadow-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                            Call {call.call_sequence}
                          </span>
                          <span className="text-slate-500">
                            Scheduled for: <strong className="text-slate-900">{formatToIST(call.scheduled_at)} IST</strong>
                          </span>
                          <span className="text-slate-400">• by {call.creator_name}</span>
                        </div>
                        <p className="text-slate-700 pt-1">{call.remarks}</p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="text-[10px] text-slate-400 block">
                          Logged {formatToIST(call.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Site Visits (B2C Only) */}
          {activeTab === 'site_visits' && lead.customer_type === 'B2C' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  B2C Field Site Assessment
                </h3>
                {lead.status === 'PENDING' && isAssignedLeadUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSiteVisit(null);
                      setSiteVisitModalMode('REQUEST');
                    }}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Request Site Visit</span>
                  </button>
                )}
              </div>

              {(!lead.site_visits || lead.site_visits.length === 0) ? (
                <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs shadow-xs">
                  No site visits recorded. Request a visit to send to the Installation Team.
                </div>
              ) : (
                <div className="space-y-4">
                  {lead.site_visits.map((sv) => (
                    <div
                      key={sv.id}
                      className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 text-xs shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              sv.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : sv.status === 'ASSIGNED'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {sv.status.replace(/_/g, ' ')}
                          </span>
                          <span className="text-slate-500">
                            Requested by: <strong className="text-slate-800">{sv.requesting_user_name}</strong>
                          </span>
                          {sv.assigned_member_name && (
                            <span className="text-slate-500">
                              • Assigned to: <strong className="text-blue-700">{sv.assigned_member_name}</strong>
                            </span>
                          )}
                        </div>

                        {/* Actions for Installation Manager or Assigned Member */}
                        <div className="flex items-center gap-2">
                          {sv.status === 'PENDING_ASSIGNMENT' && currentUser.role === 'LEAD' && (
                            <span
                              className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold"
                              title="Site Visit cannot be assigned by lead team, only installation team manager has the right to assign the leads marked as site visit to installation team members."
                            >
                              Awaiting Installation Team Manager Assignment
                            </span>
                          )}

                          {sv.status === 'PENDING_ASSIGNMENT' &&
                            (currentUser.role === 'INSTALLATION_MANAGER' || currentUser.role === 'OWNER') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSiteVisit(sv);
                                  setSiteVisitModalMode('ASSIGN');
                                }}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-xs"
                              >
                                Assign Member
                              </button>
                            )}

                          {sv.status === 'ASSIGNED' &&
                            (currentUser.role === 'INSTALLATION_MEMBER' || currentUser.role === 'INSTALLATION_MANAGER' || currentUser.role === 'OWNER') &&
                            (currentUser.role !== 'INSTALLATION_MEMBER' || !sv.assigned_member_id || sv.assigned_member_id === currentUser.id) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSiteVisit(sv);
                                  setSiteVisitModalMode('COMPLETE');
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs"
                              >
                                Complete Visit
                              </button>
                            )}
                        </div>
                      </div>

                      {sv.notes && (
                        <p className="text-slate-700">
                          <strong className="text-slate-500">Notes: </strong>
                          {sv.notes}
                        </p>
                      )}

                      {/* Technical Specs & Measurements */}
                      {(sv.structure_height || sv.earthing_cable_length || sv.dc_cable_length || sv.ac_cable_length) && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                          <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px] uppercase tracking-wider">
                            <Ruler className="w-3.5 h-3.5 text-blue-600" />
                            Technical Structure & Cable Measurements
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-[10px] text-slate-400 font-semibold block uppercase">Structure Height</span>
                              <span className="font-bold text-slate-800">{sv.structure_height || '—'}</span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-[10px] text-slate-400 font-semibold block uppercase">Earthing Cable</span>
                              <span className="font-bold text-slate-800">{sv.earthing_cable_length || '—'}</span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-[10px] text-slate-400 font-semibold block uppercase">DC Cable</span>
                              <span className="font-bold text-slate-800">{sv.dc_cable_length || '—'}</span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-[10px] text-slate-400 font-semibold block uppercase">AC Cable</span>
                              <span className="font-bold text-slate-800">{sv.ac_cable_length || '—'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Geo-tagging & Owner Presence */}
                      {(sv.geo_latitude || sv.photo_captured_with_owner) && (
                        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <div>
                              {sv.geo_latitude && sv.geo_longitude ? (
                                <span className="font-semibold text-slate-800">
                                  GPS Tagged: {sv.geo_latitude}° N, {sv.geo_longitude}° E
                                </span>
                              ) : (
                                <span className="text-slate-500 italic">No GPS coordinates recorded</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {sv.photo_captured_with_owner && (
                              <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full border border-emerald-200">
                                ✓ Photo Captured with Owner
                              </span>
                            )}
                            {sv.geo_latitude && sv.geo_longitude && (
                              <a
                                href={`https://www.google.com/maps?q=${sv.geo_latitude},${sv.geo_longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                              >
                                View on Map <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Extra Materials Required */}
                      {(() => {
                        let mats: any[] = [];
                        if (sv.extra_materials && sv.extra_materials.length > 0) {
                          mats = sv.extra_materials;
                        } else if (sv.extra_materials_json) {
                          try {
                            mats = JSON.parse(sv.extra_materials_json);
                          } catch (_) {}
                        }
                        if (mats.length === 0) return null;

                        return (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                            <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider block">
                              Extra Material Required (Beyond Standard BOM)
                            </span>
                            <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                                  <tr>
                                    <th className="px-3 py-1.5">Material Name</th>
                                    <th className="px-3 py-1.5 text-right">Quantity</th>
                                    <th className="px-3 py-1.5">Unit (UoM)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {mats.map((m, idx) => (
                                    <tr key={idx}>
                                      <td className="px-3 py-1.5 font-medium text-slate-800">{m.name}</td>
                                      <td className="px-3 py-1.5 text-right font-bold text-blue-600">{m.quantity}</td>
                                      <td className="px-3 py-1.5 text-slate-500">{m.uom}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}

                      {sv.completion_details && (
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-[11px] font-bold text-emerald-700 block mb-1">
                            Survey Report & Completion Details
                          </span>
                          <p className="text-slate-800">{sv.completion_details}</p>
                          <span className="text-[10px] text-slate-500 block mt-1">
                            Completed at: {formatToIST(sv.completed_at)}
                          </span>
                        </div>
                      )}

                      {/* Photo Gallery */}
                      {sv.photos && sv.photos.length > 0 && (
                        <div>
                          <span className="text-[11px] font-bold text-slate-700 block mb-2">
                            Uploaded Site Inspection Photos ({sv.photos.length})
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {sv.photos.map((p: any) => (
                              <a
                                key={p.id}
                                href={`/api/site-visits/photos/${p.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="block p-2 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-500 transition-colors group shadow-xs"
                              >
                                <div className="flex items-center gap-1.5 text-xs text-slate-700 truncate">
                                  <ImageIcon className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                  <span className="truncate group-hover:text-blue-600">{p.original_name}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 block mt-1">
                                  {(p.size_bytes / 1024).toFixed(1)} KB • Click to open
                                </span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Credit & Escalations History */}
          {activeTab === 'credit_escalations' && (
            <div className="space-y-6 text-xs">
              {/* Escalation History */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-800 uppercase tracking-wider">
                  Escalation Logs to Owner
                </h3>
                {(!lead.escalations || lead.escalations.length === 0) ? (
                  <p className="text-slate-500 p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
                    No escalations recorded for this Lead.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {lead.escalations.map((esc) => (
                      <div
                        key={esc.id}
                        className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-xs"
                      >
                        <div className="flex items-center justify-between text-slate-500">
                          <span>
                            Escalated by <strong className="text-slate-800">{esc.escalator_name}</strong> on{' '}
                            {formatToIST(esc.created_at)}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200">
                            {esc.reason}
                          </span>
                        </div>
                        <p className="text-slate-800">{esc.remarks}</p>

                        {esc.owner_remarks && (
                          <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg text-purple-900">
                            <strong className="block text-[11px] text-purple-700 mb-0.5">
                              Owner Directions ({formatToIST(esc.returned_at)}):
                            </strong>
                            {esc.owner_remarks}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* B2B Credit Decisions */}
              {lead.customer_type === 'B2B' && (
                <div className="space-y-3 pt-4 border-t border-slate-200">
                  <h3 className="font-bold text-slate-800 uppercase tracking-wider">
                    B2B Owner Credit Approval Decisions
                  </h3>
                  {(!lead.credit_history || lead.credit_history.length === 0) ? (
                    <p className="text-slate-500 p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
                      No credit approval records yet.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {lead.credit_history.map((cr) => (
                        <div
                          key={cr.id}
                          className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                cr.decision === 'APPROVED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : cr.decision === 'APPROVED_REDUCED'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {cr.decision.replace(/_/g, ' ')}
                            </span>
                            <span className="text-slate-400">
                              Decided on {formatToIST(cr.decided_at)} by {cr.owner_name}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-slate-800 font-mono">
                            <span>Requested: {formatINR(cr.requested_credit_amount)}</span>
                            {cr.approved_credit_amount !== null && (
                              <span className="text-emerald-700 font-bold">
                                Approved: {formatINR(cr.approved_credit_amount)}
                              </span>
                            )}
                          </div>

                          {cr.remarks && <p className="text-slate-600 text-xs">{cr.remarks}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: Immutable Audit Trail (Workflow History) */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Immutable Workflow Audit Trail
                </h3>
                <span className="text-[11px] text-slate-500">Append-only compliance log</span>
              </div>

              {(!lead.workflow_history || lead.workflow_history.length === 0) ? (
                <p className="text-slate-500 text-xs py-4 text-center">No history events recorded.</p>
              ) : (
                <div className="border-l-2 border-slate-200 ml-3 pl-4 space-y-4 text-xs">
                  {lead.workflow_history.map((event) => (
                    <div key={event.id} className="relative group">
                      <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-slate-300 border-2 border-white group-hover:bg-blue-600 transition-colors" />
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 tracking-wide">{event.event_type}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatToIST(event.created_at)}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-0.5">{event.remarks}</p>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>Actor: <strong className="text-slate-700">{event.actor_name}</strong></span>
                        {event.previous_state && event.new_state && (
                          <span>
                            • State: {event.previous_state} &rarr; {event.new_state}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Modals */}
        {showLostModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Mark Lead as Lost (NO)</h3>
              <form onSubmit={handleMarkLostNo} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Lost Reason *</label>
                  <select
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Price High">Price High / Budget Constraint</option>
                    <option value="Competitor Chosen">Competitor Chosen</option>
                    <option value="Customer Dropped Plan">Customer Dropped Solar Plan</option>
                    <option value="Site Unviable">Site Unviable / Heavy Shadow</option>
                    <option value="Discom Connection Rejected">DISCOM Connection Issues</option>
                    <option value="OTHER">OTHER (Requires Remarks)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">
                    Lost Remarks {lostReason === 'OTHER' && <span className="text-rose-600">*</span>}
                  </label>
                  <textarea
                    rows={3}
                    required={lostReason === 'OTHER'}
                    value={lostRemarks}
                    onChange={(e) => setLostRemarks(e.target.value)}
                    placeholder="Provide details on why prospect was lost..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowLostModal(false)}
                    className="px-3 py-1.5 text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs"
                  >
                    Confirm Lost
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showFollowUpModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Schedule Follow-up Call</h3>
              <form onSubmit={handleScheduleFollowUp} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">
                    Scheduled Date & Time (Asia/Kolkata) *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Must be strictly in the future (IST).
                  </span>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Call Remarks *</label>
                  <textarea
                    rows={3}
                    required
                    value={followUpRemarks}
                    onChange={(e) => setFollowUpRemarks(e.target.value)}
                    placeholder="Agenda, customer feedback, topics to discuss on next call..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFollowUpModal(false)}
                    className="px-3 py-1.5 text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs"
                  >
                    Schedule Call
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Site Visit Modal */}
        {siteVisitModalMode && (
          <SiteVisitModal
            mode={siteVisitModalMode}
            leadId={lead.id}
            siteVisit={selectedSiteVisit}
            users={users}
            currentUser={currentUser}
            onClose={() => {
              setSiteVisitModalMode(null);
              setSelectedSiteVisit(null);
            }}
            onSuccess={() => {
              fetchLeadDetails();
              onRefresh();
            }}
          />
        )}

        {/* Owner Credit Decision Modal */}
        {showCreditModal && (
          <CreditApprovalModal
            lead={lead}
            onClose={() => setShowCreditModal(false)}
            onSuccess={() => {
              fetchLeadDetails();
              onRefresh();
            }}
          />
        )}

        {/* Submit Credit for Owner Approval Modal */}
        {showSubmitCreditModal && (
          <SubmitCreditModal
            lead={lead}
            quotationTotal={quotationState.totalProjectValue || Number(lead.total_project_value) || 0}
            onClose={() => setShowSubmitCreditModal(false)}
            onSuccess={() => {
              fetchLeadDetails();
              onRefresh();
            }}
          />
        )}

        {/* Escalation Modal */}
        {escalationModalMode && (
          <EscalationModal
            mode={escalationModalMode}
            lead={lead}
            onClose={() => setEscalationModalMode(null)}
            onSuccess={() => {
              fetchLeadDetails();
              onRefresh();
            }}
          />
        )}

        {/* Quotation PDF Modal */}
        {showQuotationPDF && lead && (
          <QuotationPDFModal
            lead={lead}
            quotationLines={quotationState.lines}
            freight={quotationState.freight}
            taxMode={quotationState.taxMode}
            cgstRate={quotationState.cgstRate}
            sgstRate={quotationState.sgstRate}
            igstRate={quotationState.igstRate}
            roundOff={quotationState.roundOff}
            subtotal={quotationState.subtotal}
            totalProjectValue={quotationState.totalProjectValue}
            salesUser={users.find((u) => u.id === lead.owner_id)}
            onClose={() => setShowQuotationPDF(false)}
          />
        )}
      </div>
    </div>
  );
};
