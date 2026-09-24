import React, { useState } from 'react';
import { X, Zap, CheckCircle, AlertCircle, ShieldCheck, Gauge } from 'lucide-react';
import { apiRequest } from '../lib/api';

interface CloseNetMeteringModalProps {
  leadId: string;
  leadNumber: number;
  customerName: string;
  capacityKwp: number | null;
  location: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const CloseNetMeteringModal: React.FC<CloseNetMeteringModalProps> = ({
  leadId,
  leadNumber,
  customerName,
  capacityKwp,
  location,
  onClose,
  onSuccess,
}) => {
  const [remarks, setRemarks] = useState('');
  const [meterSerialNumber, setMeterSerialNumber] = useState('');
  const [discomSealNumber, setDiscomSealNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const combinedRemarks = [
        meterSerialNumber ? `Bi-directional Meter S/N: ${meterSerialNumber.trim()}` : null,
        discomSealNumber ? `DISCOM Official Seal #: ${discomSealNumber.trim()}` : null,
        remarks.trim() ? `Field Observations: ${remarks.trim()}` : null,
      ].filter(Boolean).join(' | ') || 'Bi-directional meter physically replaced, tested, and synchronized with DISCOM grid.';

      await apiRequest(`/api/registration/leads/${leadId}/tasks/CLOSE_NET_METERING/complete`, {
        method: 'POST',
        body: JSON.stringify({
          remarks: combinedRemarks,
        }),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to complete Net Metering task.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-emerald-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Close Net Metering Execution</h2>
              <p className="text-xs text-emerald-800">
                Installation Team Responsibility • Bi-directional Meter Swap & Grid Sync
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

        {/* Form Body */}
        <form onSubmit={handleComplete} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Project Summary Banner */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">ECP Project:</span>
              <span className="font-bold text-slate-900">#{leadNumber} • {customerName}</span>
            </div>
            {capacityKwp && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">System Capacity:</span>
                <span className="font-semibold text-blue-700">{capacityKwp} kWp Solar Rooftop</span>
              </div>
            )}
            {location && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Site Address:</span>
                <span className="text-slate-700 truncate max-w-xs">{location}</span>
              </div>
            )}
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Completing this task confirms the physical removal of the old unidirectional meter, 
              installation of the utility-certified bi-directional net meter, DISCOM security seal verification, 
              and initial solar power export synchronization to the local grid.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                New Meter Serial Number
              </label>
              <input
                type="text"
                value={meterSerialNumber}
                onChange={(e) => setMeterSerialNumber(e.target.value)}
                placeholder="e.g. MTR-2026-9844"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-emerald-500 shadow-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                DISCOM Seal Number
              </label>
              <input
                type="text"
                value={discomSealNumber}
                onChange={(e) => setDiscomSealNumber(e.target.value)}
                placeholder="e.g. SEAL-CS-7819"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-emerald-500 shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Technical Remarks & Commissioning Notes
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Discom AE & JE attended meter swap. Tested reverse energy register, synchronized at 238V/49.9Hz."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-xs"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium text-xs rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? (
                <span>Confirming Closure...</span>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Confirm & Close Net Metering</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
