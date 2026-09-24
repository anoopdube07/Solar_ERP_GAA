import React from 'react';
import {
  X,
  Printer,
  CheckCircle2,
  Sun,
  ShieldCheck,
  Building2,
  Calendar,
  IndianRupee,
} from 'lucide-react';
import { CustomerReceipt } from '../../shared/types';
import { formatToIST } from '../../shared/timezone';

interface ReceiptVoucherModalProps {
  receipt: CustomerReceipt;
  onClose: () => void;
}

export const ReceiptVoucherModal: React.FC<ReceiptVoucherModalProps> = ({
  receipt,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const getPayerBadge = () => {
    if (receipt.payer_type === 'BANK') {
      return 'Bank (Solar Loan Disbursement)';
    }
    if (receipt.payer_type === 'CUSTOMER') {
      return 'Customer Direct';
    }
    return receipt.payer_type;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Actions */}
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 no-print">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Payment Voucher</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {receipt.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Body */}
        <div className="p-4 sm:p-5 space-y-3.5 text-slate-800 bg-white overflow-y-auto print:p-4 print:m-0" id="receipt-print-area">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-900 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                <Sun className="w-5 h-5 fill-amber-400" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-tight">Solar ERP Solutions Ltd.</h1>
                <p className="text-[11px] text-slate-500">Commercial & Residential Solar Systems</p>
                <p className="text-[9px] text-slate-400">GSTIN: 29AAACS1429B1Z8</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Receipt Voucher</div>
              <div className="text-xs sm:text-sm font-black text-slate-900 font-mono mt-0.5">{receipt.receipt_number}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-end gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>Date: {receipt.receipt_date}</span>
              </div>
            </div>
          </div>

          {/* Customer / Project Details */}
          <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
            <div>
              <div className="text-[9px] uppercase font-bold text-slate-400">Received With Thanks From</div>
              <div className="text-xs font-bold text-slate-900 mt-0.5 truncate">{receipt.customer_name}</div>
              <div className="text-slate-600 font-mono text-[11px]">Lead: {receipt.lead_number}</div>
              <div className="text-slate-500 text-[10px]">{receipt.mobile_number}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase font-bold text-slate-400">Project Classification</div>
              <div className="text-xs font-bold text-slate-900 mt-0.5">{receipt.customer_type} Rooftop Solar</div>
              <div className="mt-1">
                <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800">
                  {receipt.receipt_type.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* Amount Box */}
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Amount Cleared & Credited</div>
              <div className="text-xl font-black text-emerald-700 font-mono mt-0.5">
                ₹{receipt.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Payer: <strong className="text-slate-700">{receipt.payer_name || receipt.customer_name}</strong> ({getPayerBadge()})
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* Transaction Metadata Grid */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded-lg border border-slate-200 bg-white">
              <div className="text-[9px] text-slate-400 font-bold uppercase">Mode</div>
              <div className="font-semibold text-slate-800 text-[11px] mt-0.5 truncate">{receipt.payment_mode.replace(/_/g, ' ')}</div>
            </div>
            <div className="p-2 rounded-lg border border-slate-200 bg-white">
              <div className="text-[9px] text-slate-400 font-bold uppercase">UTR / Ref</div>
              <div className="font-mono text-slate-800 font-semibold text-[11px] mt-0.5 truncate" title={receipt.reference_number || 'N/A'}>{receipt.reference_number || 'N/A'}</div>
            </div>
            <div className="p-2 rounded-lg border border-slate-200 bg-white">
              <div className="text-[9px] text-slate-400 font-bold uppercase">Bank</div>
              <div className="font-semibold text-slate-800 text-[11px] mt-0.5 truncate">{receipt.bank_name || 'Direct Transfer'}</div>
            </div>
          </div>

          {/* Deposited in Account & Remarks */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Credited To:</span>
              <span className="font-medium text-slate-800 truncate max-w-[240px]">{receipt.deposited_in_account || 'Solar Company Escrow A/c'}</span>
            </div>
            {receipt.remarks && (
              <div className="flex justify-between pt-1 border-t border-slate-200/80">
                <span className="text-slate-500">Remarks:</span>
                <span className="font-medium text-slate-800 italic truncate max-w-[240px]">{receipt.remarks}</span>
              </div>
            )}
          </div>

          {/* Signatures & Verification */}
          <div className="pt-3 border-t border-slate-200 flex items-end justify-between text-[11px] text-slate-500">
            <div>
              <div className="text-[9px] text-slate-400">Accounts Team Recorded</div>
              <div className="font-bold text-slate-700">{receipt.recorder_name || 'Accounts Desk'}</div>
              <div className="text-[9px] text-slate-400">{formatToIST(receipt.created_at, true)}</div>
            </div>
            <div className="text-right">
              <div className="w-28 border-b border-slate-300 pb-0.5 mb-0.5 text-center font-serif text-[10px] text-slate-400 italic">
                Verified Stamp
              </div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wider">Authorized Signatory</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
