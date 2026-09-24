import React, { useState } from 'react';
import { Download, Printer, X, FileText, CheckCircle2, Building2, User, Phone, MapPin, Mail, ShieldCheck } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Lead, QuotationLine, TaxMode, User as UserType } from '../../shared/types';
import { formatINR } from '../lib/api';

interface QuotationPDFModalProps {
  lead: Lead;
  quotationLines: QuotationLine[];
  freight: number;
  taxMode: TaxMode;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  roundOff: number;
  subtotal: number;
  totalProjectValue: number;
  salesUser?: UserType;
  onClose: () => void;
}

// Convert numbers into Indian Rupee Words (Lakhs, Crores, Thousands)
function numberToWordsINR(amount: number): string {
  if (!amount || isNaN(amount) || amount === 0) return 'Zero Rupees Only';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertTwoDigits = (num: number): string => {
    if (num < 10) return units[num];
    if (num >= 10 && num < 20) return teens[num - 10];
    const unit = num % 10;
    const ten = Math.floor(num / 10);
    return tens[ten] + (unit ? ' ' + units[unit] : '');
  };

  const convertThreeDigits = (num: number): string => {
    const hundred = Math.floor(num / 100);
    const rest = num % 100;
    let res = '';
    if (hundred) res += units[hundred] + ' Hundred';
    if (rest) {
      if (res) res += ' and ';
      res += convertTwoDigits(rest);
    }
    return res;
  };

  const wholePart = Math.floor(Math.abs(amount));
  const decimalPart = Math.round((Math.abs(amount) - wholePart) * 100);

  let crores = Math.floor(wholePart / 10000000);
  let remainder = wholePart % 10000000;

  let lakhs = Math.floor(remainder / 100000);
  remainder = remainder % 100000;

  let thousands = Math.floor(remainder / 1000);
  remainder = remainder % 1000;

  let hundreds = remainder;

  const parts: string[] = [];

  if (crores > 0) {
    parts.push(convertThreeDigits(crores) + ' Crore');
  }
  if (lakhs > 0) {
    parts.push(convertTwoDigits(lakhs) + ' Lakh');
  }
  if (thousands > 0) {
    parts.push(convertTwoDigits(thousands) + ' Thousand');
  }
  if (hundreds > 0) {
    parts.push(convertThreeDigits(hundreds));
  }

  let words = parts.join(' ') + ' Rupees';
  if (decimalPart > 0) {
    words += ' and ' + convertTwoDigits(decimalPart) + ' Paise';
  }
  return words + ' Only';
}

export const QuotationPDFModal: React.FC<QuotationPDFModalProps> = ({
  lead,
  quotationLines,
  freight,
  taxMode,
  cgstRate,
  sgstRate,
  igstRate,
  roundOff,
  subtotal,
  totalProjectValue,
  salesUser,
  onClose,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  // Calculate tax amounts
  const taxBase = subtotal + (Number(freight) || 0);
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (taxMode === 'INTRA_STATE') {
    cgstAmount = Math.round(taxBase * (cgstRate / 100) * 100) / 100;
    sgstAmount = Math.round(taxBase * (sgstRate / 100) * 100) / 100;
  } else if (taxMode === 'INTER_STATE') {
    igstAmount = Math.round(taxBase * (igstRate / 100) * 100) / 100;
  }

  const quotationRef = `QTN-${lead.customer_type}-${lead.id.slice(0, 8).toUpperCase()}`;
  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const validUntilDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const handleDownloadPDF = async () => {
    const printableElement = document.getElementById('printable-quotation-sheet');
    if (!printableElement) return;

    try {
      setIsGenerating(true);
      const canvas = await html2canvas(printableElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const safeName = (lead.customer_name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`Quotation_${safeName}_${lead.id.slice(0, 6)}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper to extract custom field value by field_key
  const getCustomVal = (key: string): string => {
    const item = lead.custom_values?.find((cv) => cv.field_key === key);
    return item?.value ? String(item.value).trim() : '';
  };

  const contactPerson = getCustomVal('contact_person_name');
  const decisionMakerDesignation = getCustomVal('decision_maker_designation');
  const companyGstin = getCustomVal('company_gstin');
  const sanctionedLoad = getCustomVal('sanctioned_load_kw');
  const roofType = getCustomVal('roof_type');
  const monthlyBill = getCustomVal('monthly_electricity_bill');
  const discomConsumerNo = getCustomVal('discom_consumer_number');
  const connectedLoad = getCustomVal('connected_load_kva');
  const proposedCapacity = getCustomVal('proposed_capacity_kw');
  const industryVertical = getCustomVal('industry_vertical');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      {/* Print Specific CSS to isolate sheet during browser print */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-quotation-sheet, #printable-quotation-sheet * {
            visibility: visible;
          }
          #printable-quotation-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <div className="bg-slate-100 w-full max-w-5xl max-h-[96vh] rounded-2xl flex flex-col shadow-2xl border border-slate-300 overflow-hidden my-auto">
        {/* Top Control Bar */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between flex-shrink-0 no-print">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Quotation Preview &amp; PDF Export
              </h2>
              <span className="text-[11px] text-slate-300">
                Ref: {quotationRef} • Client: {lead.customer_name} ({lead.customer_type})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              id="btn-print-quotation"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span>Print</span>
            </button>

            <button
              type="button"
              id="btn-download-quotation-pdf"
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isGenerating ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              id="btn-close-pdf-modal"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-2"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Container */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 flex justify-center bg-slate-200/70">
          {/* Printable A4 Paper Sheet */}
          <div
            id="printable-quotation-sheet"
            className="w-full max-w-[850px] bg-white text-slate-800 p-8 sm:p-10 shadow-lg border border-slate-300 rounded-lg text-xs leading-relaxed space-y-6"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            {/* Header: Company Profile & Logo Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b-2 border-slate-800 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-700 text-white font-black text-xl flex items-center justify-center shadow-xs">
                    ☀️
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">
                      SOLAR ERP EPC SOLUTIONS
                    </h1>
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block mt-0.5">
                      Rooftop &amp; Ground Mount Solar PV EPC Turnkey Contractor
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 mt-2 space-y-0.5">
                  <p>Plot No. 12B, Solar Energy Park, VIP Airport Road, Raipur, CG - 492018</p>
                  <p>
                    <span className="font-semibold text-slate-700">GSTIN:</span> 22AABCS1234F1ZP |{' '}
                    <span className="font-semibold text-slate-700">CIN:</span> U40106CT2020PTC010456 |{' '}
                    <span className="font-semibold text-slate-700">MNRE Reg:</span> MNRE-CG-4812
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Tel:</span> +91 771 4987654 / +91 98260 12345 |{' '}
                    <span className="font-semibold text-slate-700">Email:</span> projects@solarerp-solutions.com
                  </p>
                </div>
              </div>

              {/* Quotation Metadata Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 w-full sm:w-60 text-right space-y-1 self-stretch sm:self-auto shadow-2xs">
                <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Commercial Quotation</div>
                <div className="text-xs font-mono font-black text-blue-800">{quotationRef}</div>
                <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                  <span className="font-semibold">Date:</span> {currentDate}
                </div>
                <div className="text-[11px] text-slate-600">
                  <span className="font-semibold">Valid Till:</span> {validUntilDate}
                </div>
                <div className="text-[11px] text-slate-600">
                  <span className="font-semibold">Category:</span> {lead.customer_type === 'B2C' ? 'Residential Rooftop' : 'Commercial & Industrial'}
                </div>
              </div>
            </div>

            {/* Document Title Ribbon */}
            <div className="text-center py-2 px-4 bg-slate-900 text-white rounded-lg font-bold text-xs uppercase tracking-widest">
              SOLAR PHOTOVOLTAIC (SPV) SYSTEM COMMERCIAL QUOTATION &amp; TECHNO-COMMERCIAL ESTIMATE
            </div>

            {/* Client & Project Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Client / To Details */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>Customer &amp; Billing Details</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-slate-900 text-sm">{lead.customer_name}</div>
                  {contactPerson && (
                    <div className="text-slate-600">
                      <span className="font-semibold text-slate-700">Contact Person:</span> {contactPerson}{' '}
                      {decisionMakerDesignation ? `(${decisionMakerDesignation})` : ''}
                    </div>
                  )}
                  <div className="text-slate-600 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{lead.mobile_number}</span>
                    {lead.email && <span className="text-slate-400">| {lead.email}</span>}
                  </div>
                  {lead.address && (
                    <div className="text-slate-600 flex items-start gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
                      <span>{lead.address}{lead.location ? `, ${lead.location}` : ''}</span>
                    </div>
                  )}
                  {companyGstin && (
                    <div className="text-slate-700 font-mono text-[11px]">
                      <span className="font-semibold">GSTIN:</span> {companyGstin}
                    </div>
                  )}
                </div>
              </div>

              {/* Site & System Specifications */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Site &amp; Solar Technical Parameters</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="text-slate-500">Installation Location:</span>{' '}
                    <span className="font-semibold text-slate-800">
                      {lead.project_installation_location || lead.address || lead.location || 'As specified at premises'}
                    </span>
                  </div>

                  {lead.customer_type === 'B2C' ? (
                    <>
                      {sanctionedLoad && (
                        <div>
                          <span className="text-slate-500">Sanctioned Load:</span>{' '}
                          <span className="font-semibold text-slate-800">{sanctionedLoad} kW</span>
                        </div>
                      )}
                      {roofType && (
                        <div>
                          <span className="text-slate-500">Roof Construction:</span>{' '}
                          <span className="font-semibold text-slate-800">{roofType}</span>
                        </div>
                      )}
                      {monthlyBill && (
                        <div>
                          <span className="text-slate-500">Avg. Monthly Bill:</span>{' '}
                          <span className="font-semibold text-slate-800">₹{monthlyBill}</span>
                        </div>
                      )}
                      {discomConsumerNo && (
                        <div>
                          <span className="text-slate-500">DISCOM Consumer No:</span>{' '}
                          <span className="font-mono font-semibold text-slate-800">{discomConsumerNo}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-500">Solar Financing / Loan:</span>{' '}
                        <span className="font-semibold text-slate-800">
                          {lead.b2c_loan_required === 'YES' ? 'Bank Solar Loan Required' : 'Self-Financed / Direct Capex'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      {connectedLoad && (
                        <div>
                          <span className="text-slate-500">Connected Load:</span>{' '}
                          <span className="font-semibold text-slate-800">{connectedLoad} kVA</span>
                        </div>
                      )}
                      {proposedCapacity && (
                        <div>
                          <span className="text-slate-500">Proposed Solar PV Capacity:</span>{' '}
                          <span className="font-semibold text-slate-800">{proposedCapacity} kWp</span>
                        </div>
                      )}
                      {industryVertical && (
                        <div>
                          <span className="text-slate-500">Industry Vertical:</span>{' '}
                          <span className="font-semibold text-slate-800">{industryVertical}</span>
                        </div>
                      )}
                      {lead.b2b_credit_extended === 'YES' && (
                        <div>
                          <span className="text-slate-500">Commercial Credit:</span>{' '}
                          <span className="font-semibold text-slate-800">
                            Requested {formatINR(lead.requested_credit_amount || 0)} (Approved: {formatINR(lead.approved_credit_amount || 0)})
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  <div className="pt-1 text-[11px] text-slate-500">
                    <span className="font-semibold">Assigned Executive:</span> {salesUser?.name || lead.owner_name || 'Lead Team Specialist'}
                  </div>
                </div>
              </div>
            </div>

            {/* Bill of Quantities (BOQ) Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Bill of Materials &amp; Commercial Scope of Work
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  {quotationLines.length} Item Line(s) Included
                </span>
              </div>

              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] border-b border-slate-300">
                    <tr>
                      <th className="py-2 px-3 w-10 text-center">#</th>
                      <th className="py-2 px-3">Item Description &amp; Technical Scope</th>
                      <th className="py-2 px-3 w-20 text-center">Qty</th>
                      <th className="py-2 px-3 w-20 text-center">UOM</th>
                      <th className="py-2 px-3 w-28 text-right">Rate (₹)</th>
                      <th className="py-2 px-3 w-32 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {quotationLines.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                          No quotation items configured for this lead.
                        </td>
                      </tr>
                    ) : (
                      quotationLines.map((line, idx) => (
                        <tr key={line.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="py-2 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <span className="font-bold text-slate-900">{line.item_name}</span>
                          </td>
                          <td className="py-2 px-3 text-center font-mono">{line.quantity}</td>
                          <td className="py-2 px-3 text-center text-slate-600">{line.uom}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">{formatINR(line.rate)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatINR(line.value)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Commercial Calculation Summary & Amount in Words */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
              {/* Amount in Words & Notes */}
              <div className="sm:col-span-6 space-y-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Total Amount in Words (INR):
                  </span>
                  <div className="text-xs font-semibold text-slate-900 italic leading-snug">
                    {numberToWordsINR(totalProjectValue)}
                  </div>
                </div>

                {/* Bank Remittance Details */}
                <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-[11px] space-y-1 text-slate-700">
                  <div className="font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-blue-700" />
                    <span>Official Bank Account Details for RTGS / NEFT</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-1 font-mono text-[10px]">
                    <div><span className="text-slate-500">Bank:</span> State Bank of India</div>
                    <div><span className="text-slate-500">Account:</span> 398201567890</div>
                    <div><span className="text-slate-500">IFSC Code:</span> SBIN0004567</div>
                    <div><span className="text-slate-500">Branch:</span> Commercial VIP Road, Raipur</div>
                    <div className="col-span-2"><span className="text-slate-500">A/C Name:</span> SOLAR ERP EPC SOLUTIONS PVT LTD</div>
                  </div>
                </div>
              </div>

              {/* Financial Calculation Table */}
              <div className="sm:col-span-6 border border-slate-300 rounded-xl overflow-hidden bg-slate-50/50">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-1.5 px-3 text-slate-600">Subtotal (Material &amp; Equipment Supply)</td>
                      <td className="py-1.5 px-3 text-right font-mono font-semibold text-slate-900">
                        {formatINR(subtotal)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 text-slate-600">Freight, Transportation &amp; Packaging</td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-900">
                        {formatINR(freight)}
                      </td>
                    </tr>
                    <tr className="bg-slate-100/70 font-semibold">
                      <td className="py-1.5 px-3 text-slate-700">Taxable Net Base Value</td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-900">
                        {formatINR(taxBase)}
                      </td>
                    </tr>

                    {taxMode === 'INTRA_STATE' && (
                      <>
                        <tr>
                          <td className="py-1.5 px-3 text-slate-600">CGST @ {cgstRate}%</td>
                          <td className="py-1.5 px-3 text-right font-mono text-slate-900">
                            {formatINR(cgstAmount)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 text-slate-600">SGST @ {sgstRate}%</td>
                          <td className="py-1.5 px-3 text-right font-mono text-slate-900">
                            {formatINR(sgstAmount)}
                          </td>
                        </tr>
                      </>
                    )}

                    {taxMode === 'INTER_STATE' && (
                      <tr>
                        <td className="py-1.5 px-3 text-slate-600">IGST @ {igstRate}%</td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-900">
                          {formatINR(igstAmount)}
                        </td>
                      </tr>
                    )}

                    {taxMode === 'NO_TAX' && (
                      <tr>
                        <td className="py-1.5 px-3 text-slate-500 italic">GST Scheme</td>
                        <td className="py-1.5 px-3 text-right text-slate-500 italic">Exempt / No Tax</td>
                      </tr>
                    )}

                    {roundOff !== 0 && (
                      <tr>
                        <td className="py-1.5 px-3 text-slate-600">Round Off Adjustment</td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-900">
                          ₹{roundOff}
                        </td>
                      </tr>
                    )}

                    <tr className="bg-blue-600 text-white font-black text-sm">
                      <td className="py-2.5 px-3 uppercase tracking-wider">Total Project Value (INR)</td>
                      <td className="py-2.5 px-3 text-right font-mono text-base">
                        {formatINR(totalProjectValue)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Standard Techno-Commercial Terms & Conditions */}
            <div className="pt-4 border-t border-slate-300 space-y-2 text-[11px] text-slate-600">
              <h4 className="font-bold uppercase tracking-wider text-slate-800 text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-700" />
                <span>Standard Terms, Warranty &amp; Conditions of Execution</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 pl-1 leading-relaxed">
                <div>
                  <span className="font-semibold text-slate-800">1. Scope of Work:</span> Complete turnkey engineering, procurement, supply of Tier-1 solar modules, inverter, structure, testing, commissioning &amp; net metering coordination.
                </div>
                <div>
                  <span className="font-semibold text-slate-800">2. Payment Milestones:</span> 20% advance booking with PO; 70% against delivery of materials at project site; 10% post installation and net meter synchronization.
                </div>
                <div>
                  <span className="font-semibold text-slate-800">3. Equipment Warranties:</span> Solar PV Modules carry 10 Years Product Warranty &amp; 25 Years Linear Performance Warranty; Inverter carries 5 Years standard manufacturer warranty.
                </div>
                <div>
                  <span className="font-semibold text-slate-800">4. Delivery Schedule:</span> Materials dispatched within 14-21 days from receipt of advance and shadow-free site clearance; installation completed within 7-10 working days.
                </div>
                <div>
                  <span className="font-semibold text-slate-800">5. Client Site Readiness:</span> Client shall provide shadow-free roof space, temporary electrical connection, water for module cleaning, and secure lockable storage for equipment.
                </div>
                <div>
                  <span className="font-semibold text-slate-800">6. Net Metering &amp; Subsidies:</span> DISCOM synchronization coordination will be provided by vendor. Official DISCOM statutory fees, CEIG fees, or meter testing charges are as per actual government bills.
                </div>
                <div>
                  <span className="font-semibold text-slate-800">7. Quotation Validity:</span> This commercial offer is valid for 30 days from date of issuance.
                </div>
                <div>
                  <span className="font-semibold text-slate-800">8. Jurisdiction:</span> Any legal matters or disputes arising from this quotation shall be subject to the exclusive jurisdiction of the courts at Raipur, CG.
                </div>
              </div>
            </div>

            {/* Signature & Acceptance Block */}
            <div className="pt-8 flex justify-between items-end gap-6 border-t border-slate-200">
              {/* Customer Acceptance */}
              <div className="w-64 space-y-8">
                <div className="space-y-1">
                  <div className="font-bold text-slate-800 text-xs">Customer Acceptance:</div>
                  <div className="text-[10px] text-slate-500 italic">
                    I / We hereby accept the technical scope, quotation value, and terms &amp; conditions stated above.
                  </div>
                </div>
                <div className="border-t border-slate-400 pt-1.5 flex justify-between text-[11px] text-slate-600">
                  <span>Client Signature &amp; Stamp</span>
                  <span>Date: ____________</span>
                </div>
              </div>

              {/* Company Authorized Signatory */}
              <div className="w-64 space-y-8 text-right">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-800 text-xs">For SOLAR ERP EPC SOLUTIONS PVT LTD</div>
                  <div className="text-[10px] text-blue-700 font-semibold">Authorized Signatory &amp; Project Head</div>
                </div>
                <div className="border-t border-slate-400 pt-1.5 text-[11px] text-slate-600">
                  <span>Sign &amp; Corporate Seal</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
