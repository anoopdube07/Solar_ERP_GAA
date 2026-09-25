import React, { useState } from 'react';
import { apiRequest } from '../lib/api';
import { AccountsLeadOverview, User } from '../../shared/types';
import {
  X,
  AlertTriangle,
  RotateCcw,
  User as UserIcon,
  Building2,
  Receipt,
  ShieldAlert,
  CheckCircle2,
  FileText,
} from 'lucide-react';

interface SendBackB2BModalProps {
  lead: AccountsLeadOverview;
  currentUser: User;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const REASONS = [
  {
    id: 'UPFRONT_SHORTFALL',
    label: 'Payment Shortfall (Upfront Not Received as per Credit Terms)',
    defaultNote:
      'Payment received does not meet the required upfront payment under the extended credit terms. Please follow up with the client to collect the balance upfront amount.',
  },
  {
    id: 'MISSING_OWNER_APPROVAL',
    label: 'Owner Approval Missing (Credit Not Signed Off)',
    defaultNote:
      'Commercial credit terms have been requested but executive Owner approval has not been granted. Please coordinate with the Owner to obtain formal credit sign-off.',
  },
  {
    id: 'REJECTED_CREDIT',
    label: 'Owner Credit Request Rejected',
    defaultNote:
      'The requested commercial credit terms were rejected by the Owner. The lead must revert to standard commercial payment terms (advance/milestone).',
  },
  {
    id: 'CUSTOMER_DISPUTE',
    label: 'Customer Payment / Credit Terms Dispute',
    defaultNote:
      'Customer has contested the credit term milestones or payment due date. Please renegotiate and align with the customer.',
  },
  {
    id: 'REVISED_QUOTATION_NEEDED',
    label: 'Quotation / Commercial Terms Revision Required',
    defaultNote:
      'Commercial figures or payment schedule require quotation revision before Accounts can accept receipts.',
  },
  {
    id: 'OTHER',
    label: 'Other Commercial Reconciliation Issue',
    defaultNote: '',
  },
];

export function SendBackB2BModal({ lead, currentUser, onClose, onSuccess }: SendBackB2BModalProps) {
  const [reasonId, setReasonId] = useState<string>('UPFRONT_SHORTFALL');
  const [remarks, setRemarks] = useState<string>(
    REASONS[0].defaultNote +
      (lead.b2b_upfront_required > lead.total_received
        ? ` Upfront required: ₹${lead.b2b_upfront_required.toLocaleString('en-IN')}, Received: ₹${lead.total_received.toLocaleString('en-IN')} (Shortfall: ₹${(lead.b2b_upfront_required - lead.total_received).toLocaleString('en-IN')}).`
        : '')
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedReason = REASONS.find((r) => r.id === reasonId) || REASONS[0];

  const handleReasonChange = (newReasonId: string) => {
    setReasonId(newReasonId);
    const found = REASONS.find((r) => r.id === newReasonId);
    if (found) {
      if (newReasonId === 'UPFRONT_SHORTFALL' && lead.b2b_upfront_required > lead.total_received) {
        setRemarks(
          `${found.defaultNote} Upfront required: ₹${lead.b2b_upfront_required.toLocaleString('en-IN')}, Received: ₹${lead.total_received.toLocaleString('en-IN')} (Shortfall: ₹${(lead.b2b_upfront_required - lead.total_received).toLocaleString('en-IN')}).`
        );
      } else {
        setRemarks(found.defaultNote);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarks.trim()) {
      setError('Please provide specific remarks for the Lead team user.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await apiRequest(`/api/accounts/leads/${lead.id}/send-back-to-lead`, {
        method: 'POST',
        body: JSON.stringify({
          reason: selectedReason.label,
          remarks: remarks.trim(),
        }),
      });

      if (res.success) {
        onSuccess(res.message);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send back case to lead team.');
    } finally {
      setSubmitting(false);
    }
  };

  const shortfall = Math.max(0, lead.b2b_upfront_required - lead.total_received);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-amber-500/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center border border-amber-500/20 shrink-0">
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Return B2B Case to Lead Team</h2>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Lead #{lead.lead_number} • {lead.customer_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Context Overview Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2 text-slate-600 font-medium">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span>Commercial Client</span>
              </div>
              <span className="font-bold text-slate-900">{lead.customer_name}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Assigned Lead User</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                  <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                  {lead.lead_owner_name || 'Lead Team'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Total Project</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">
                  ₹{lead.total_project_value.toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Approved Credit</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">
                  {lead.approved_credit_amount > 0
                    ? `₹${lead.approved_credit_amount.toLocaleString('en-IN')}`
                    : '₹0 (No credit)'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Required Upfront</span>
                <span className="font-bold text-slate-900 mt-0.5 block">
                  ₹{lead.b2b_upfront_required.toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Total Received</span>
                <span className="font-bold text-emerald-600 mt-0.5 block">
                  ₹{lead.total_received.toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Credit Shortfall</span>
                <span
                  className={`font-bold mt-0.5 block ${
                    shortfall > 0 ? 'text-red-600' : 'text-slate-600'
                  }`}
                >
                  {shortfall > 0 ? `₹${shortfall.toLocaleString('en-IN')}` : 'Nil'}
                </span>
              </div>
            </div>

            {/* Owner Approval Status */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500">Owner Approval Status:</span>
              <span
                className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                  lead.owner_approval_status === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : lead.owner_approval_status === 'REJECTED'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {lead.owner_approval_status === 'APPROVED'
                  ? 'Approved by Owner'
                  : lead.owner_approval_status === 'REJECTED'
                  ? 'Rejected by Owner'
                  : lead.owner_approval_status === 'PENDING'
                  ? 'Pending Owner Approval'
                  : 'Not Required'}
              </span>
            </div>
          </div>

          {/* Reason Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Reason for Returning to Lead Team *</label>
            <select
              value={reasonId}
              onChange={(e) => handleReasonChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            >
              {REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action Note for Lead Team User */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                Action Required / Instructions for Lead Team User *
              </label>
              <span className="text-[11px] text-slate-400">Visible to Lead Desk</span>
            </div>
            <textarea
              rows={4}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Specify the exact resolution needed from the lead owner (e.g. collect upfront ₹..., update proposal, get Owner signature)..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
              required
            />
          </div>

          {/* Policy / Enforcement Notice */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-[11px] text-amber-800">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Workflow Impact:</span>
              The lead will immediately shift to the Lead Team user's active queue with an{' '}
              <span className="font-semibold text-amber-900">Action Required</span> flag. Dispatch
              clearance remains strictly blocked until compliance is achieved.
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !remarks.trim()}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Sending Back...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Send Back to Lead Team</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
