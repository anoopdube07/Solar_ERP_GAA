import type {  TaxMode  } from '../../shared/types.ts';

export interface FinancialTotalsInput {
  lines: Array<{ quantity: number; rate: number }>;
  freight?: number;
  tax_mode?: TaxMode;
  cgst_rate?: number;
  sgst_rate?: number;
  igst_rate?: number;
  round_off?: number;
}

export interface CalculatedFinancialTotals {
  subtotal: number;
  freight: number;
  tax_mode: TaxMode;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  round_off: number;
  total_project_value: number;
  calculatedLines: Array<{ quantity: number; rate: number; value: number }>;
}

export function calculateFinancialTotals(input: FinancialTotalsInput): CalculatedFinancialTotals {
  let subtotal = 0;
  const calculatedLines = (input.lines || []).map((line) => {
    const qty = Math.max(0, Number(line.quantity) || 0);
    const rate = Math.max(0, Number(line.rate) || 0);
    const value = Math.round(qty * rate * 100) / 100;
    subtotal += value;
    return { quantity: qty, rate, value };
  });

  subtotal = Math.round(subtotal * 100) / 100;
  const freight = Math.max(0, Number(input.freight) || 0);
  const taxBase = subtotal + freight;

  const taxMode: TaxMode = input.tax_mode || 'NO_TAX';
  let cgstRate = 0;
  let cgstAmount = 0;
  let sgstRate = 0;
  let sgstAmount = 0;
  let igstRate = 0;
  let igstAmount = 0;

  if (taxMode === 'INTRA_STATE') {
    cgstRate = Math.max(0, Number(input.cgst_rate) || 0);
    sgstRate = Math.max(0, Number(input.sgst_rate) || 0);
    cgstAmount = Math.round(taxBase * (cgstRate / 100) * 100) / 100;
    sgstAmount = Math.round(taxBase * (sgstRate / 100) * 100) / 100;
    igstRate = 0;
    igstAmount = 0;
  } else if (taxMode === 'INTER_STATE') {
    igstRate = Math.max(0, Number(input.igst_rate) || 0);
    igstAmount = Math.round(taxBase * (igstRate / 100) * 100) / 100;
    cgstRate = 0;
    cgstAmount = 0;
    sgstRate = 0;
    sgstAmount = 0;
  } else {
    // NO_TAX
    cgstRate = 0;
    cgstAmount = 0;
    sgstRate = 0;
    sgstAmount = 0;
    igstRate = 0;
    igstAmount = 0;
  }

  const roundOff = Number(input.round_off) || 0;
  const rawTotal = subtotal + freight + cgstAmount + sgstAmount + igstAmount + roundOff;
  const totalProjectValue = Math.max(0, Math.round(rawTotal * 100) / 100);

  return {
    subtotal,
    freight,
    tax_mode: taxMode,
    cgst_rate: cgstRate,
    cgst_amount: cgstAmount,
    sgst_rate: sgstRate,
    sgst_amount: sgstAmount,
    igst_rate: igstRate,
    igst_amount: igstAmount,
    round_off: roundOff,
    total_project_value: totalProjectValue,
    calculatedLines,
  };
}

export function validateMobileNumber(mobile: string): { valid: boolean; error?: string } {
  if (!mobile || typeof mobile !== 'string') {
    return { valid: false, error: 'Mobile Number is required.' };
  }
  const cleaned = mobile.trim();
  if (!/^\d{10}$/.test(cleaned)) {
    return { valid: false, error: 'Mobile Number must contain exactly 10 digits.' };
  }
  return { valid: true };
}
