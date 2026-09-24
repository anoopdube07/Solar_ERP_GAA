import React, { useState } from 'react';
import { X, DollarSign, AlertCircle, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';
import { apiRequest, formatINR } from '../lib/api';
import { Lead } from '../../shared/types';

interface SubmitCreditModalProps {
  lead: Lead;
  quotationTotal: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const SubmitCreditModal: React.FC<SubmitCreditModalProps> = ({
  lead,
  quotationTotal,
  onClose,
  onSuccess,
}) => {
  const initialAmount =
    Number(lead.requested_credit_amount) > 0
      ? Number(lead.requested_credit_amount)
      : quotationTotal > 0
      ? quotationTotal
      : 100000;

  const [requestedAmount, setRequestedAmount] = useState<number>(initialAmount);
  const [creditDays, setCreditDays] = useState<number>(lead.b2b_credit_days || 30);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (requestedAmount <= 0) {
      setError('Requested credit amount must be greater than ₹0.');
      return;
    }

    if (quotationTotal > 0 && requestedAmount > quotationTotal) {
      setError(
        `Requested credit amount (${formatINR(requestedAmount)}) cannot exceed total quotation project value (${formatINR(quotationTotal)}).`
      );
      return;
    }

    setLoading(true);
    try {
      await apiRequest(`/api/leads/${lead.id}/workflow`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'SUBMIT_B2B_CREDIT',
          payload: {
            requested_credit_amount: requestedAmount,
            b2b_credit_days: creditDays,
            remarks: remarks.trim() || undefined,
          },
        }),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit credit request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-900">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-indigo-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Submit Credit for Owner Approval</h2>
              <p className="text-xs text-slate-500">
                Lead #{lead.lead_number} • {lead.customer_name} (B2B Commercial)
              </p>
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
          <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-blue-900">
              <ShieldAlert className="w-4 h-4 text-blue-700" />
              <span>Solar ERP Commercial Credit Rule</span>
            </div>
            <p className="text-blue-800 leading-relaxed text-[11px]">
              When credit terms are extended to a B2B client, ERP rules require explicit financial approval from the <strong>Company Owner</strong> before this lead can be qualified and handed off to Dispatch.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5">Total Project Value</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {quotationTotal > 0 ? formatINR(quotationTotal) : 'Quotation Pending'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Commercial Mode</span>
              <span className="font-semibold text-indigo-700 text-xs">
                Deferred Credit Term
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Requested Credit Amount (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">₹</span>
              <input
                type="number"
                min="1"
                max={quotationTotal > 0 ? quotationTotal : undefined}
                required
                value={requestedAmount || ''}
                onChange={(e) => setRequestedAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono text-base font-semibold focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 shadow-xs"
                placeholder="Enter credit amount requested"
              />
            </div>
            {quotationTotal > 0 && (
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                <span>Maximum eligible: {formatINR(quotationTotal)}</span>
                <button
                  type="button"
                  onClick={() => setRequestedAmount(quotationTotal)}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Set to 100% Value
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Requested Credit Term (Payment Due In)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 45, 60].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setCreditDays(days)}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                    creditDays === days
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {days} Days
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Business Justification / Notes for Owner
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g., Client corporate payment cycle is 30 days post-dispatch. Advance of 20% collected via NEFT..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 shadow-xs resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || requestedAmount <= 0}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <ArrowRight className="w-4 h-4" />
              <span>{loading ? 'Submitting...' : 'Send to Owner for Credit Approval'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
