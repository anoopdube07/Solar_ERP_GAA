import React, { useState, useEffect } from 'react';
import {
  X,
  Receipt,
  CreditCard,
  Building2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  IndianRupee,
  ShieldCheck,
  Landmark,
} from 'lucide-react';
import {
  PaymentMode,
  ReceiptType,
  PayerType,
  AccountsLeadOverview,
} from '../../shared/types';
import { apiRequest } from '../lib/api';

interface RecordReceiptModalProps {
  lead?: AccountsLeadOverview | null;
  allLeads?: AccountsLeadOverview[];
  onClose: () => void;
  onSuccess: (receipt: any) => void;
}

export const RecordReceiptModal: React.FC<RecordReceiptModalProps> = ({
  lead: initialLead,
  allLeads = [],
  onClose,
  onSuccess,
}) => {
  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialLead?.id || '');
  const [currentLead, setCurrentLead] = useState<AccountsLeadOverview | null>(initialLead || null);

  const [amount, setAmount] = useState<string>('');
  const [receiptDate, setReceiptDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [receiptType, setReceiptType] = useState<ReceiptType>('ADVANCE');
  const [payerType, setPayerType] = useState<PayerType>('CUSTOMER');
  const [payerName, setPayerName] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [depositedInAccount, setDepositedInAccount] = useState<string>('Solar ERP Operations A/c - HDFC 9021');
  const [remarks, setRemarks] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync lead selection
  useEffect(() => {
    if (selectedLeadId && allLeads.length > 0) {
      const found = allLeads.find((l) => l.id === selectedLeadId) || null;
      setCurrentLead(found);
      if (found) {
        if (!payerName) {
          setPayerName(found.customer_name);
        }
        // Auto-select receipt type & payer type if loan
        if (found.customer_type === 'B2C' && found.b2c_loan_required === 'YES' && !found.has_advance_from_bank) {
          // Keep customer advance or bank loan disbursement
        }
      }
    }
  }, [selectedLeadId, allLeads]);

  useEffect(() => {
    if (currentLead) {
      if (currentLead.customer_type === 'B2B') {
        // B2B Project: There is NO option for Loan
        if (payerType !== 'CUSTOMER') {
          setPayerType('CUSTOMER');
        }
        if (receiptType === 'BANK_LOAN_DISBURSEMENT') {
          setReceiptType('ADVANCE');
        }
        if (paymentMode === 'BANK_LOAN_DISBURSEMENT') {
          setPaymentMode('NEFT_RTGS');
        }
        if (!payerName || payerName.includes('Bank')) {
          setPayerName(currentLead.customer_name);
        }
      } else {
        if (payerType === 'CUSTOMER' && (!payerName || payerName.includes('Bank'))) {
          setPayerName(currentLead.customer_name);
        } else if (payerType === 'BANK' && (!payerName || payerName === currentLead.customer_name)) {
          setPayerName('State Bank of India (Solar Loan Cell)');
          setPaymentMode('BANK_LOAN_DISBURSEMENT');
          setReceiptType('BANK_LOAN_DISBURSEMENT');
        }
      }
    }
  }, [payerType, currentLead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (!selectedLeadId) {
      setError('Please select a customer project lead.');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid receipt amount greater than ₹0.');
      return;
    }
    if (!referenceNumber.trim()) {
      setError('Please enter a Transaction UTR / Reference number / Cheque number.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiRequest('/api/accounts/receipts', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: selectedLeadId,
          amount: parsedAmount,
          receipt_date: receiptDate,
          payment_mode: paymentMode,
          reference_number: referenceNumber,
          receipt_type: receiptType,
          payer_type: payerType,
          payer_name: payerName,
          bank_name: bankName,
          deposited_in_account: depositedInAccount,
          status: 'CLEARED',
          remarks,
        }),
      });

      onSuccess(res.receipt);
    } catch (err: any) {
      setError(err?.message || 'Failed to record receipt.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">Record Customer Receipt</h2>
              <p className="text-[11px] text-slate-500">Official receipt entry & financial reconciliation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Project / Lead Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer Project <span className="text-rose-500">*</span>
            </label>
            {initialLead ? (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900">{initialLead.customer_name}</div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-[10px] bg-slate-200 px-1 py-0.2 rounded text-slate-700">
                      {initialLead.lead_number}
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-blue-600">{initialLead.customer_type}</span>
                    {initialLead.b2c_loan_required === 'YES' && (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                        Loan
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500">Project Value</div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900">
                    ₹{initialLead.total_project_value.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-medium">
                    Recd: ₹{initialLead.total_received.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            ) : (
              <select
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                required
              >
                <option value="">-- Select a Customer Project Lead --</option>
                {allLeads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.customer_name} ({l.customer_type}) - ₹{l.total_project_value.toLocaleString('en-IN')} [Bal: ₹{l.balance_due.toLocaleString('en-IN')}]
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Lead Context Alert: B2C Hard Rule or B2B Credit Notice */}
          {currentLead && (
            <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              currentLead.customer_type === 'B2C'
                ? currentLead.dispatch_status === 'PENDING_ADVANCE'
                  ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                  : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : currentLead.b2b_credit_extended === 'YES'
                ? currentLead.owner_approval_status === 'APPROVED'
                  ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                  : 'bg-rose-50/80 border-rose-200 text-rose-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                {currentLead.customer_type === 'B2C' ? (
                  <>
                    <span className="font-bold">B2C Dispatch Gate Rule: </span>
                    {currentLead.dispatch_status === 'PENDING_ADVANCE' ? (
                      <span>
                        Project is currently <strong>BLOCKED from material dispatch</strong>. Recording an advance receipt from either the Customer or Bank will satisfy the hard rule and clear dispatch.
                      </span>
                    ) : (
                      <span>
                        Advance has already been satisfied and project is <strong>cleared for dispatch</strong>.
                      </span>
                    )}
                    {currentLead.b2c_loan_required === 'YES' && (
                      <p className="mt-1 font-semibold text-amber-800">
                        ⚡ Customer has opted for Solar Loan. Advance can be received either from Customer direct or as Bank Loan Disbursement.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <span className="font-bold">B2B Commercial Credit Status: </span>
                    {currentLead.b2b_credit_extended === 'YES' ? (
                      currentLead.owner_approval_status === 'APPROVED' ? (
                        <span>
                          Owner approved credit of <strong>₹{currentLead.approved_credit_amount?.toLocaleString('en-IN')}</strong>. Required upfront payment is <strong>₹{currentLead.b2b_upfront_required?.toLocaleString('en-IN')}</strong>.
                        </span>
                      ) : (
                        <span>
                          ⚠️ Owner credit approval is <strong>NOT YET GIVEN</strong> (Pending / Required). Credit terms cannot be released without Owner approval.
                        </span>
                      )
                    ) : (
                      <span>Standard 100% advance / milestone terms. No commercial credit extended.</span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Amount & Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Receipt Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  step="any"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full pl-9 pr-3.5 py-2 text-sm font-semibold rounded-xl border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                />
              </div>
              {currentLead && currentLead.balance_due > 0 && (
                <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
                  <span>Balance Due: ₹{currentLead.balance_due.toLocaleString('en-IN')}</span>
                  <button
                    type="button"
                    onClick={() => setAmount(String(currentLead.balance_due))}
                    className="text-emerald-600 hover:underline font-semibold"
                  >
                    Full Balance
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Receipt Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Payer Type & Receipt Type Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Payer Source <span className="text-rose-500">*</span>
              </label>
              {currentLead?.customer_type === 'B2B' ? (
                <div className="py-2 px-3 rounded-xl border border-purple-200 bg-purple-50/60 flex items-center justify-between text-xs font-semibold text-purple-900">
                  <span>Enterprise / Client Direct</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                    B2B • No Loan Option
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayerType('CUSTOMER')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                      payerType === 'CUSTOMER'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Customer Direct
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayerType('BANK')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                      payerType === 'BANK'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Bank (Solar Loan)
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Receipt Classification <span className="text-rose-500">*</span>
              </label>
              <select
                value={receiptType}
                onChange={(e) => setReceiptType(e.target.value as ReceiptType)}
                className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="ADVANCE">Booking Advance</option>
                {currentLead?.customer_type !== 'B2B' && (
                  <option value="BANK_LOAN_DISBURSEMENT">Bank Loan Disbursement</option>
                )}
                <option value="MILESTONE_PAYMENT">Milestone / Interim Payment</option>
                <option value="CREDIT_TERM_INSTALLMENT">Credit Term Payment (B2B)</option>
                <option value="FINAL_SETTLEMENT">Final Settlement</option>
              </select>
            </div>
          </div>

          {/* Payment Mode & Reference Number Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Payment Mode <span className="text-rose-500">*</span>
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                <option value="NEFT_RTGS">NEFT / RTGS Transfer</option>
                <option value="IMPS">IMPS Instant Transfer</option>
                {currentLead?.customer_type !== 'B2B' && (
                  <option value="BANK_LOAN_DISBURSEMENT">Bank Loan Direct Escrow Credit</option>
                )}
                <option value="CHEQUE">Cheque / CTS Clearing</option>
                <option value="DEMAND_DRAFT">Demand Draft (DD)</option>
                <option value="CASH">Cash Deposit</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                UTR / Ref / Cheque No. <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. UTR / UPI / CHQ-109281"
                className="w-full text-xs font-mono rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                required
              />
            </div>
          </div>

          {/* Payer Name & Bank Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Payer / Entity Name
              </label>
              <input
                type="text"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="Customer or Remitting Organization"
                className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Bank / Branch Name
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. HDFC Bank / SBI Solar Branch"
                className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Deposited In Account & Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Deposited In Solar Company Account
            </label>
            <input
              type="text"
              value={depositedInAccount}
              onChange={(e) => setDepositedInAccount(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Accounts Notes & Remarks
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Advance verified against bank statement. Cleared for dispatch."
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Footer Actions */}
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
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Recording Receipt...' : 'Record & Post Receipt'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
