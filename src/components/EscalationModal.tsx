import React, { useState } from 'react';
import { X, CornerUpLeft, ArrowUpRight, AlertCircle, ShieldAlert } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { Lead } from '../../shared/types';

interface EscalationModalProps {
  mode: 'ESCALATE' | 'RETURN';
  lead: Lead;
  onClose: () => void;
  onSuccess: () => void;
}

export const EscalationModal: React.FC<EscalationModalProps> = ({
  mode,
  lead,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [ownerRemarks, setOwnerRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'ESCALATE') {
        if (!reason.trim()) throw new Error('Escalation Reason is required.');
        if (!remarks.trim()) throw new Error('Escalation Remarks are required.');

        await apiRequest(`/api/leads/${lead.id}/workflow`, {
          method: 'POST',
          body: JSON.stringify({
            action: 'ESCALATE',
            payload: { reason, remarks },
          }),
        });
      } else {
        if (!ownerRemarks.trim()) throw new Error('Owner Remarks are required.');

        await apiRequest(`/api/leads/${lead.id}/workflow`, {
          method: 'POST',
          body: JSON.stringify({
            action: 'OWNER_RETURN_ESCALATION',
            payload: { owner_remarks: ownerRemarks },
          }),
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Operation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-slate-900">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 shadow-xs">
              {mode === 'ESCALATE' ? <ArrowUpRight className="w-5 h-5" /> : <CornerUpLeft className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {mode === 'ESCALATE' ? 'Escalate Lead to Owner' : 'Return Escalation to Lead Team'}
              </h2>
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
          {mode === 'ESCALATE' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Escalation Reason / Category
                </label>
                <select
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-purple-500 shadow-xs"
                >
                  <option value="">-- Choose Reason --</option>
                  <option value="Commercial Discount Exception">Commercial Discount Exception</option>
                  <option value="Technical Feasibility Exception">Technical Feasibility Exception</option>
                  <option value="Customer Negotiation Bottleneck">Customer Negotiation Bottleneck</option>
                  <option value="High Value Opportunity Review">High Value Opportunity Review</option>
                  <option value="DISCOM Regulatory Issue">DISCOM Regulatory Issue</option>
                  <option value="Other Executive Guidance">Other Executive Guidance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Detailed Escalation Remarks & Request
                </label>
                <textarea
                  rows={4}
                  required
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Explain why Owner intervention is required and what approval or guidance is sought..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-purple-500 shadow-xs"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Owner Decision & Directions
              </label>
              <textarea
                rows={4}
                required
                value={ownerRemarks}
                onChange={(e) => setOwnerRemarks(e.target.value)}
                placeholder="Specify agreed terms, guidance, discount limits, or next steps for the Lead Team..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-purple-500 shadow-xs"
              />
            </div>
          )}

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
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
            >
              {loading
                ? 'Processing...'
                : mode === 'ESCALATE'
                ? 'Escalate to Owner'
                : 'Return to Lead Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
