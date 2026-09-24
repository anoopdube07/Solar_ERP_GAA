import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calculator, AlertCircle, ShieldAlert } from 'lucide-react';
import { Item, QuotationLine, TaxMode, Uom } from '../../shared/types';
import { formatINR } from '../lib/api';

interface QuotationEditorProps {
  lines: QuotationLine[];
  freight: number;
  taxMode: TaxMode;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  roundOff: number;
  isReadOnly?: boolean;
  lockReason?: string | null;
  items: Item[];
  uoms: Uom[];
  onChange: (data: {
    lines: QuotationLine[];
    freight: number;
    taxMode: TaxMode;
    cgstRate: number;
    sgstRate: number;
    igstRate: number;
    roundOff: number;
    subtotal: number;
    totalProjectValue: number;
  }) => void;
}

export const QuotationEditor: React.FC<QuotationEditorProps> = ({
  lines: initialLines,
  freight: initialFreight,
  taxMode: initialTaxMode,
  cgstRate: initialCgstRate,
  sgstRate: initialSgstRate,
  igstRate: initialIgstRate,
  roundOff: initialRoundOff,
  isReadOnly = false,
  lockReason = null,
  items,
  uoms,
  onChange,
}) => {
  const [lines, setLines] = useState<QuotationLine[]>(() =>
    (initialLines || []).map((l) => ({
      ...l,
      quantity: Number(l.quantity) || 1,
      rate: Number(l.rate) || 0,
      value: Number(l.value) || Math.round((Number(l.quantity) || 1) * (Number(l.rate) || 0) * 100) / 100,
    }))
  );
  const [freight, setFreight] = useState<number>(Number(initialFreight) || 0);
  const [taxMode, setTaxMode] = useState<TaxMode>(initialTaxMode || 'NO_TAX');
  const [cgstRate, setCgstRate] = useState<number>(Number(initialCgstRate) || 0);
  const [sgstRate, setSgstRate] = useState<number>(Number(initialSgstRate) || 0);
  const [igstRate, setIgstRate] = useState<number>(Number(initialIgstRate) || 0);
  const [roundOff, setRoundOff] = useState<number>(Number(initialRoundOff) || 0);

  // Sync with prop updates
  useEffect(() => {
    const formatted = (initialLines || []).map((l) => ({
      ...l,
      quantity: Number(l.quantity) || 1,
      rate: Number(l.rate) || 0,
      value: Number(l.value) || Math.round((Number(l.quantity) || 1) * (Number(l.rate) || 0) * 100) / 100,
    }));
    setLines(formatted);
    setFreight(Number(initialFreight) || 0);
    setTaxMode(initialTaxMode || 'NO_TAX');
    setCgstRate(Number(initialCgstRate) || 0);
    setSgstRate(Number(initialSgstRate) || 0);
    setIgstRate(Number(initialIgstRate) || 0);
    setRoundOff(Number(initialRoundOff) || 0);
  }, [initialLines, initialFreight, initialTaxMode, initialCgstRate, initialSgstRate, initialIgstRate, initialRoundOff]);

  // If items list loaded after initial lines, auto-fill any 0-rate lines with matching item rate
  useEffect(() => {
    if (items.length > 0 && lines.length > 0) {
      let hasUpdates = false;
      const updatedLines = lines.map((ln) => {
        if (ln.item_id && (Number(ln.rate) === 0 || Number(ln.value) === 0)) {
          const matched = items.find((it) => it.id === ln.item_id);
          if (matched && Number(matched.rate) > 0) {
            hasUpdates = true;
            const q = Number(ln.quantity) || 1;
            const r = Number(matched.rate);
            return {
              ...ln,
              item_name: matched.name,
              uom: ln.uom || matched.default_uom || 'Nos',
              rate: r,
              value: Math.round(q * r * 100) / 100,
            };
          }
        }
        return ln;
      });
      if (hasUpdates) {
        setLines(updatedLines);
        notifyChange(updatedLines, freight, taxMode, cgstRate, sgstRate, igstRate, roundOff);
      }
    }
  }, [items]);

  // Recalculate totals safely
  const safeFreight = Math.max(0, Number(freight) || 0);
  const safeCgstRate = Math.max(0, Number(cgstRate) || 0);
  const safeSgstRate = Math.max(0, Number(sgstRate) || 0);
  const safeIgstRate = Math.max(0, Number(igstRate) || 0);
  const safeRoundOff = Number(roundOff) || 0;

  const subtotal = Math.round(
    lines.reduce((acc, curr) => {
      const q = Number(curr.quantity) || 0;
      const r = Number(curr.rate) || 0;
      const v =
        curr.value !== undefined && !isNaN(Number(curr.value)) && Number(curr.value) > 0
          ? Number(curr.value)
          : Math.round(q * r * 100) / 100;
      return acc + v;
    }, 0) * 100
  ) / 100;

  const taxBase = subtotal + safeFreight;

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (taxMode === 'INTRA_STATE') {
    cgstAmount = Math.round(taxBase * (safeCgstRate / 100) * 100) / 100;
    sgstAmount = Math.round(taxBase * (safeSgstRate / 100) * 100) / 100;
  } else if (taxMode === 'INTER_STATE') {
    igstAmount = Math.round(taxBase * (safeIgstRate / 100) * 100) / 100;
  }

  const rawTotal = subtotal + safeFreight + cgstAmount + sgstAmount + igstAmount + safeRoundOff;
  const totalProjectValue = Math.max(0, Math.round(rawTotal * 100) / 100);

  const notifyChange = (
    newLines: QuotationLine[],
    newFreight: number | string,
    newTaxMode: TaxMode,
    newCgst: number | string,
    newSgst: number | string,
    newIgst: number | string,
    newRound: number | string
  ) => {
    const fFreight = Math.max(0, Number(newFreight) || 0);
    const fCgst = Math.max(0, Number(newCgst) || 0);
    const fSgst = Math.max(0, Number(newSgst) || 0);
    const fIgst = Math.max(0, Number(newIgst) || 0);
    const fRound = Number(newRound) || 0;

    const sub = Math.round(
      newLines.reduce((acc, curr) => {
        const q = Number(curr.quantity) || 0;
        const r = Number(curr.rate) || 0;
        const v =
          curr.value !== undefined && !isNaN(Number(curr.value)) && Number(curr.value) > 0
            ? Number(curr.value)
            : Math.round(q * r * 100) / 100;
        return acc + v;
      }, 0) * 100
    ) / 100;

    const base = sub + fFreight;
    let cg = 0;
    let sg = 0;
    let ig = 0;
    if (newTaxMode === 'INTRA_STATE') {
      cg = Math.round(base * (fCgst / 100) * 100) / 100;
      sg = Math.round(base * (fSgst / 100) * 100) / 100;
    } else if (newTaxMode === 'INTER_STATE') {
      ig = Math.round(base * (fIgst / 100) * 100) / 100;
    }
    const tot = Math.max(0, Math.round((sub + fFreight + cg + sg + ig + fRound) * 100) / 100);

    onChange({
      lines: newLines,
      freight: fFreight,
      taxMode: newTaxMode,
      cgstRate: fCgst,
      sgstRate: fSgst,
      igstRate: fIgst,
      roundOff: fRound,
      subtotal: sub,
      totalProjectValue: tot,
    });
  };

  const handleAddLine = () => {
    if (isReadOnly) return;
    const defaultItem = items && items.length > 0 ? items[0] : null;
    const defaultRate = defaultItem ? Number(defaultItem.rate) || 0 : 0;
    const defaultUom = defaultItem?.default_uom || (uoms[0] ? uoms[0].name : 'Nos');
    const newLine: QuotationLine = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      lead_id: '',
      item_id: defaultItem ? defaultItem.id : '',
      item_name: defaultItem ? defaultItem.name : 'Solar Component',
      quantity: 1,
      uom: defaultUom,
      rate: defaultRate,
      value: defaultRate,
    };

    const nextLines = [...lines, newLine];
    setLines(nextLines);
    notifyChange(nextLines, freight, taxMode, cgstRate, sgstRate, igstRate, roundOff);
  };

  const handleRemoveLine = (index: number) => {
    if (isReadOnly) return;
    const nextLines = lines.filter((_, i) => i !== index);
    setLines(nextLines);
    notifyChange(nextLines, freight, taxMode, cgstRate, sgstRate, igstRate, roundOff);
  };

  const handleItemSelect = (index: number, itemId: string) => {
    if (isReadOnly) return;
    const selectedItem = items.find((it) => it.id === itemId);
    if (!selectedItem) return;

    const nextLines = [...lines];
    const qty = Number(nextLines[index].quantity) || 1;
    const rate = Number(selectedItem.rate) || 0;
    const value = Math.round(qty * rate * 100) / 100;
    nextLines[index] = {
      ...nextLines[index],
      item_id: selectedItem.id,
      item_name: selectedItem.name,
      uom: selectedItem.default_uom || nextLines[index].uom || 'Nos',
      rate,
      value,
    };
    setLines(nextLines);
    notifyChange(nextLines, freight, taxMode, cgstRate, sgstRate, igstRate, roundOff);
  };

  const handleQuantityChange = (index: number, rawQty: number | string) => {
    if (isReadOnly) return;
    const safeQty = Math.max(0, Number(rawQty) || 0);
    const nextLines = [...lines];
    const rate = Number(nextLines[index].rate) || 0;
    const value = Math.round(safeQty * rate * 100) / 100;
    nextLines[index] = {
      ...nextLines[index],
      quantity: safeQty,
      value,
    };
    setLines(nextLines);
    notifyChange(nextLines, freight, taxMode, cgstRate, sgstRate, igstRate, roundOff);
  };

  const handleRateChange = (index: number, rawRate: number | string) => {
    if (isReadOnly) return;
    const safeRate = Math.max(0, Number(rawRate) || 0);
    const nextLines = [...lines];
    const qty = Number(nextLines[index].quantity) || 0;
    const value = Math.round(qty * safeRate * 100) / 100;
    nextLines[index] = {
      ...nextLines[index],
      rate: safeRate,
      value,
    };
    setLines(nextLines);
    notifyChange(nextLines, freight, taxMode, cgstRate, sgstRate, igstRate, roundOff);
  };

  const handleUomChange = (index: number, uomName: string) => {
    if (isReadOnly) return;
    const nextLines = [...lines];
    nextLines[index] = { ...nextLines[index], uom: uomName };
    setLines(nextLines);
    notifyChange(nextLines, freight, taxMode, cgstRate, sgstRate, igstRate, roundOff);
  };

  return (
    <div className="space-y-4">
      {lockReason && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-amber-800 text-xs font-semibold">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-600" />
          <span>{lockReason}</span>
        </div>
      )}

      {/* Line Items Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">Item Name</th>
              <th className="py-2.5 px-3 w-28">Quantity</th>
              <th className="py-2.5 px-3 w-28">UOM</th>
              <th className="py-2.5 px-3 w-32">Rate (₹)</th>
              <th className="py-2.5 px-3 w-36 text-right">Value (₹)</th>
              {!isReadOnly && <th className="py-2.5 px-2 w-10"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  No quotation lines added yet. Click &quot;Add Item Line&quot; to build quotation.
                </td>
              </tr>
            ) : (
              lines.map((line, idx) => (
                <tr key={line.id || idx} className="hover:bg-slate-50/80 transition-colors">
                  {/* Item selector or display */}
                  <td className="py-2 px-3">
                    {isReadOnly ? (
                      <span className="font-medium text-slate-900">{line.item_name}</span>
                    ) : (
                      <select
                        aria-label={`Select item for line ${idx + 1}`}
                        value={line.item_id}
                        onChange={(e) => handleItemSelect(idx, e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      >
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} (₹{it.rate})
                          </option>
                        ))}
                      </select>
                    )}
                  </td>

                  {/* Quantity */}
                  <td className="py-2 px-3">
                    {isReadOnly ? (
                      <span className="text-slate-700 font-mono">{line.quantity}</span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) => handleQuantityChange(idx, parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                  </td>

                  {/* UOM */}
                  <td className="py-2 px-3">
                    {isReadOnly ? (
                      <span className="text-slate-700">{line.uom}</span>
                    ) : (
                      <select
                        aria-label={`Select UOM for line ${idx + 1}`}
                        value={line.uom}
                        onChange={(e) => handleUomChange(idx, e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      >
                        {uoms.map((u) => (
                          <option key={u.id} value={u.name}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>

                  {/* Rate */}
                  <td className="py-2 px-3">
                    {isReadOnly ? (
                      <span className="text-slate-700 font-mono">₹{line.rate}</span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.rate}
                        onChange={(e) => handleRateChange(idx, parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                  </td>

                  {/* Value (Calculated) */}
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                    {formatINR(line.value)}
                  </td>

                  {/* Delete */}
                  {!isReadOnly && (
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remove line"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isReadOnly && (
        <button
          type="button"
          onClick={handleAddLine}
          className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" /> Add Item Line
        </button>
      )}

      {/* Commercial Summary Panel */}
      <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
          <Calculator className="w-4 h-4 text-blue-600" />
          Commercial & Tax Calculation
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Subtotal */}
          <div>
            <span className="block text-slate-500 mb-1">Subtotal (Materials)</span>
            <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-900 text-sm shadow-xs">
              {formatINR(subtotal)}
            </div>
          </div>

          {/* Freight */}
          <div>
            <span className="block text-slate-500 mb-1">Freight & Transportation (₹)</span>
            {isReadOnly ? (
              <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono text-slate-900 text-sm shadow-xs">
                {formatINR(freight)}
              </div>
            ) : (
              <input
                type="number"
                min="0"
                step="0.01"
                value={freight}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setFreight(val);
                  notifyChange(lines, val, taxMode, cgstRate, sgstRate, igstRate, roundOff);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 text-sm focus:outline-none focus:border-blue-500 shadow-xs"
              />
            )}
          </div>

          {/* Tax Mode */}
          <div>
            <span className="block text-slate-500 mb-1">Tax Scheme / GST Mode</span>
            {isReadOnly ? (
              <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm shadow-xs">
                {taxMode}
              </div>
            ) : (
              <select
                aria-label="Tax Scheme / GST Mode"
                value={taxMode}
                onChange={(e) => {
                  const mode = e.target.value as TaxMode;
                  setTaxMode(mode);
                  let cg = cgstRate;
                  let sg = sgstRate;
                  let ig = igstRate;
                  if (mode === 'INTRA_STATE') {
                    cg = cg || 6;
                    sg = sg || 6;
                    ig = 0;
                  } else if (mode === 'INTER_STATE') {
                    ig = ig || 12;
                    cg = 0;
                    sg = 0;
                  } else {
                    cg = 0;
                    sg = 0;
                    ig = 0;
                  }
                  setCgstRate(cg);
                  setSgstRate(sg);
                  setIgstRate(ig);
                  notifyChange(lines, freight, mode, cg, sg, ig, roundOff);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-500 shadow-xs"
              >
                <option value="NO_TAX">NO TAX (Exempt)</option>
                <option value="INTRA_STATE">INTRA-STATE (CGST + SGST)</option>
                <option value="INTER_STATE">INTER-STATE (IGST)</option>
              </select>
            )}
          </div>

          {/* Round Off */}
          <div>
            <span className="block text-slate-500 mb-1">Round Off Adjustment (₹)</span>
            {isReadOnly ? (
              <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono text-slate-900 text-sm shadow-xs">
                ₹{roundOff}
              </div>
            ) : (
              <input
                type="number"
                step="0.01"
                value={roundOff}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setRoundOff(val);
                  notifyChange(lines, freight, taxMode, cgstRate, sgstRate, igstRate, val);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 text-sm focus:outline-none focus:border-blue-500 shadow-xs"
              />
            )}
          </div>
        </div>

        {/* GST Rate inputs if applicable */}
        {taxMode === 'INTRA_STATE' && (
          <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-slate-200">
            <div>
              <span className="block text-slate-500 mb-1">CGST Rate (%)</span>
              {isReadOnly ? (
                <span className="font-mono text-slate-800">{cgstRate}% ({formatINR(cgstAmount)})</span>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={cgstRate}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setCgstRate(val);
                      notifyChange(lines, freight, taxMode, val, sgstRate, igstRate, roundOff);
                    }}
                    className="w-24 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 text-xs shadow-xs"
                  />
                  <span className="text-slate-600 font-mono">= {formatINR(cgstAmount)}</span>
                </div>
              )}
            </div>

            <div>
              <span className="block text-slate-500 mb-1">SGST Rate (%)</span>
              {isReadOnly ? (
                <span className="font-mono text-slate-800">{sgstRate}% ({formatINR(sgstAmount)})</span>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={sgstRate}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setSgstRate(val);
                      notifyChange(lines, freight, taxMode, cgstRate, val, igstRate, roundOff);
                    }}
                    className="w-24 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 text-xs shadow-xs"
                  />
                  <span className="text-slate-600 font-mono">= {formatINR(sgstAmount)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {taxMode === 'INTER_STATE' && (
          <div className="text-xs pt-2 border-t border-slate-200">
            <span className="block text-slate-500 mb-1">IGST Rate (%)</span>
            {isReadOnly ? (
              <span className="font-mono text-slate-800">{igstRate}% ({formatINR(igstAmount)})</span>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={igstRate}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setIgstRate(val);
                    notifyChange(lines, freight, taxMode, cgstRate, sgstRate, val, roundOff);
                  }}
                  className="w-24 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 text-xs shadow-xs"
                />
                <span className="text-slate-600 font-mono">= {formatINR(igstAmount)}</span>
              </div>
            )}
          </div>
        )}

        {/* Total Project Value Banner */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex items-center justify-between mt-2 shadow-xs">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900 block">
              Total Project Value (Payable)
            </span>
            <span className="text-[11px] text-slate-500">
              System verified = Subtotal + Freight + Taxes + Round Off
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-700 font-mono">
            {formatINR(totalProjectValue)}
          </div>
        </div>
      </div>
    </div>
  );
};
