import React, { useState } from 'react';
import { X, DollarSign, Check, XCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import { apiRequest, formatINR } from '../lib/api';
import { Lead } from '../../shared/types';

interface CreditApprovalModalProps {
  lead: Lead;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreditApprovalModal: React.FC<CreditApprovalModalProps> = ({
  lead,
  onClose,
  onSuccess,
}) => {
  const [decision, setDecision] = useState<'APPROVED' | 'APPROVED_REDUCED' | 'REJECTED'>('APPROVED');
  const [approvedAmount, setApprovedAmount] = useState<number>(Number(lead.requested_credit_amount) || 0);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (decision === 'APPROVED_REDUCED') {
        if (approvedAmount <= 0) {
          throw new Error('Approved Credit Amount must be greater than zero.');
        }
        if (approvedAmount > Number(lead.requested_credit_amount)) {
          throw new Error('Approved Amount cannot exceed Requested Amount.');
        }
        if (approvedAmount > Number(lead.total_project_value)) {
          throw new Error('Approved Amount cannot exceed Total Project Value.');
        }
      }

      if (decision === 'REJECTED' && !remarks.trim()) {
        throw new Error('Remarks are required when rejecting credit request.');
      }

      await apiRequest(`/api/leads/${lead.id}/workflow`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'OWNER_CREDIT_DECISION',
          payload: {
            decision,
            approved_amount: approvedAmount,
            remarks,
          },
        }),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Credit decision failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-slate-900">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-xs">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Owner Credit Decision</h2>
              <p className="text-xs text-slate-500">Lead #{lead.lead_number} • {lead.customer_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="m-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5">Total Project Value</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {formatINR(lead.total_project_value)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Requested Credit</span>
              <span className="font-mono font-bold text-indigo-700 text-sm">
                {formatINR(lead.requested_credit_amount)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Decision
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDecision('APPROVED');
                  setApprovedAmount(Number(lead.requested_credit_amount));
                }}
                className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                  decision === 'APPROVED'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                Approve Full
              </button>

              <button
                type="button"
                onClick={() => setDecision('APPROVED_REDUCED')}
                className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                  decision === 'APPROVED_REDUCED'
                    ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                Approve Reduced
              </button>

              <button
                type="button"
                onClick={() => setDecision('REJECTED')}
                className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                  decision === 'REJECTED'
                    ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                Reject Credit
              </button>
            </div>
          </div>

          {decision === 'APPROVED_REDUCED' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Reduced Approved Amount (₹)
              </label>
              <input
                type="number"
                min="1"
                max={lead.requested_credit_amount}
                required
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono text-sm focus:outline-none focus:border-indigo-500 shadow-xs"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Must be between ₹1 and {formatINR(lead.requested_credit_amount)}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Owner Remarks {decision === 'REJECTED' && <span className="text-rose-600">*</span>}
            </label>
            <textarea
              rows={3}
              required={decision === 'REJECTED'}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add terms, collateral stipulations, or justification..."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              {loading ? 'Submitting...' : 'Record Credit Decision'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
