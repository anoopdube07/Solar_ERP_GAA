import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Calendar,
  IndianRupee,
  Phone,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { AccountsLeadOverview, ReceiptFollowUpStatus } from '../../shared/types';
import { apiRequest } from '../lib/api';

interface LogReceiptFollowUpModalProps {
  lead?: AccountsLeadOverview | null;
  allLeads?: AccountsLeadOverview[];
  onClose: () => void;
  onSuccess: (followUp: any) => void;
}

export const LogReceiptFollowUpModal: React.FC<LogReceiptFollowUpModalProps> = ({
  lead: initialLead,
  allLeads = [],
  onClose,
  onSuccess,
}) => {
  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialLead?.id || '');
  const [currentLead, setCurrentLead] = useState<AccountsLeadOverview | null>(initialLead || null);

  const [followUpDate, setFollowUpDate] = useState<string>(new Date().toISOString().slice(0, 16));
  const [promisedPaymentDate, setPromisedPaymentDate] = useState<string>('');
  const [promisedAmount, setPromisedAmount] = useState<string>('');
  const [contactPerson, setContactPerson] = useState<string>(initialLead?.customer_name || '');
  const [contactPhone, setContactPhone] = useState<string>(initialLead?.mobile_number || '');
  const [status, setStatus] = useState<ReceiptFollowUpStatus>('SCHEDULED');
  const [remarks, setRemarks] = useState<string>('');
  const [outcomeNotes, setOutcomeNotes] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedLeadId && allLeads.length > 0) {
      const found = allLeads.find((l) => l.id === selectedLeadId) || null;
      setCurrentLead(found);
      if (found) {
        if (!contactPerson) setContactPerson(found.customer_name);
        if (!contactPhone) setContactPhone(found.mobile_number);
        if (!promisedAmount && found.balance_due > 0) {
          setPromisedAmount(String(found.balance_due));
        }
      }
    }
  }, [selectedLeadId, allLeads]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedLeadId) {
      setError('Please select a customer project.');
      return;
    }
    if (!remarks.trim()) {
      setError('Please provide follow-up notes/remarks.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiRequest('/api/accounts/follow-ups', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: selectedLeadId,
          follow_up_date: followUpDate,
          promised_payment_date: promisedPaymentDate || undefined,
          promised_amount: promisedAmount ? parseFloat(promisedAmount) : undefined,
          contact_person: contactPerson,
          contact_phone: contactPhone,
          status,
          remarks,
          outcome_notes: outcomeNotes || undefined,
        }),
      });

      onSuccess(res.followUp);
    } catch (err: any) {
      setError(err?.message || 'Failed to log follow-up.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center border border-blue-500/20 shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Log Receipt Follow-up</h2>
              <p className="text-[11px] sm:text-xs text-slate-500">Customer payment inquiry, reminder & promise tracking</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Lead Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Customer Project <span className="text-rose-500">*</span>
            </label>
            {initialLead ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900">{initialLead.customer_name}</div>
                  <div className="text-xs text-slate-500">
                    {initialLead.customer_type} • Mobile: {initialLead.mobile_number}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Balance Due</div>
                  <div className="text-sm font-bold text-rose-600">
                    ₹{initialLead.balance_due.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            ) : (
              <select
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 px-3.5 py-2.5 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              >
                <option value="">-- Select a Customer Project Lead --</option>
                {allLeads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.customer_name} ({l.customer_type}) - Balance: ₹{l.balance_due.toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Follow-up Timing & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Follow-up Date & Time <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Follow-up Status <span className="text-rose-500">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ReceiptFollowUpStatus)}
                className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="SCHEDULED">Scheduled / Pending</option>
                <option value="PROMISED_TO_PAY">Customer Promised to Pay</option>
                <option value="COMPLETED">Completed (Payment Received)</option>
                <option value="ESCALATED_DISPUTE">Escalated to Sales Manager</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Contact Person & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Contact Person Spoken With
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Mr. Sharma"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Contact Phone
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="10-digit mobile"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Promised Payment Details (if customer committed) */}
          <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl space-y-3">
            <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Customer Payment Commitment (Optional)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Promised Payment Date
                </label>
                <input
                  type="date"
                  value={promisedPaymentDate}
                  onChange={(e) => {
                    setPromisedPaymentDate(e.target.value);
                    if (e.target.value && status === 'SCHEDULED') {
                      setStatus('PROMISED_TO_PAY');
                    }
                  }}
                  className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Promised Amount (₹)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <IndianRupee className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="number"
                    value={promisedAmount}
                    onChange={(e) => setPromisedAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full pl-7 pr-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-900 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Follow-up Conversation & Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Contacted customer regarding token advance. Customer stated RTGS will be done by Friday once bank loan sanction letter is received."
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              required
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Logging...' : 'Save Follow-up'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
