import React, { useState, useEffect } from 'react';
import {
  X,
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ShieldCheck,
  Zap,
  Info,
  Loader2,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { apiRequest } from '../lib/api';

interface PhysicalInstallationModalProps {
  leadId: string;
  leadNumber: number;
  customerName: string;
  capacityKwp?: number | null;
  location?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface PhotoSlot {
  key: string;
  category: string;
  label: string;
  description: string;
  file: File | null;
  previewUrl: string | null;
  existingUrl: string | null;
}

export const PhysicalInstallationModal: React.FC<PhysicalInstallationModalProps> = ({
  leadId,
  leadNumber,
  customerName,
  capacityKwp,
  location,
  onClose,
  onSuccess,
}) => {
  const [inverterSerial, setInverterSerial] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingExisting, setFetchingExisting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>([
    {
      key: 'photo_inverter_serial',
      category: 'INVERTER_SERIAL',
      label: '1. Inverter Serial Number',
      description: 'Clear close-up photograph of the manufacturer barcode / serial number label',
      file: null,
      previewUrl: null,
      existingUrl: null,
    },
    {
      key: 'photo_inverter_with_customer',
      category: 'INVERTER_WITH_CUSTOMER',
      label: '2. Inverter alongside Customer',
      description: 'Customer standing next to the mounted solar inverter unit',
      file: null,
      previewUrl: null,
      existingUrl: null,
    },
    {
      key: 'photo_panel_with_customer',
      category: 'PANEL_WITH_CUSTOMER',
      label: '3. Solar Panel alongside Customer',
      description: 'Rooftop array overview with customer alongside the mounted modules',
      file: null,
      previewUrl: null,
      existingUrl: null,
    },
    {
      key: 'photo_lightning_arrester',
      category: 'LIGHTNING_ARRESTER',
      label: '4. Lightning Arrester',
      description: 'Elevated lightning surge protector rod mounted on structure/terrace',
      file: null,
      previewUrl: null,
      existingUrl: null,
    },
    {
      key: 'photo_earthing_pit',
      category: 'EARTHING_PIT',
      label: '5. Earthing Pit',
      description: 'Chemical / dedicated earthing chamber showing grounding electrodes',
      file: null,
      previewUrl: null,
      existingUrl: null,
    },
  ]);

  // Fetch existing installation record & photos if any
  useEffect(() => {
    let isMounted = true;
    const loadExisting = async () => {
      try {
        const res = await apiRequest<{
          details: {
            record: any;
            photos: any[];
            has_all_photos: boolean;
            is_completed: boolean;
          };
        }>(`/api/installation/leads/${leadId}/details`);

        if (isMounted && res.details) {
          if (res.details.record?.inverter_serial_number) {
            setInverterSerial(res.details.record.inverter_serial_number);
          }
          if (res.details.record?.completion_remarks) {
            setRemarks(res.details.record.completion_remarks);
          }

          if (res.details.photos && res.details.photos.length > 0) {
            setPhotoSlots((prev) =>
              prev.map((slot) => {
                const found = res.details.photos.find((p) => p.photo_category === slot.category);
                if (found) {
                  return {
                    ...slot,
                    existingUrl: `/api/installation/photos/${found.id}`,
                  };
                }
                return slot;
              })
            );
          }
        }
      } catch (err: any) {
        console.warn('Could not load existing installation details:', err);
      } finally {
        if (isMounted) setFetchingExisting(false);
      }
    };

    loadExisting();
    return () => {
      isMounted = false;
    };
  }, [leadId]);

  const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate image format
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPhotoSlots((prev) => {
      const copy = [...prev];
      if (copy[index].previewUrl) {
        URL.revokeObjectURL(copy[index].previewUrl!);
      }
      copy[index] = {
        ...copy[index],
        file,
        previewUrl: objectUrl,
      };
      return copy;
    });
    setError(null);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoSlots((prev) => {
      const copy = [...prev];
      if (copy[index].previewUrl) {
        URL.revokeObjectURL(copy[index].previewUrl!);
      }
      copy[index] = {
        ...copy[index],
        file: null,
        previewUrl: null,
      };
      return copy;
    });
  };

  const uploadedOrExistingCount = photoSlots.filter(
    (s) => s.file !== null || s.existingUrl !== null
  ).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate that all 5 photos are provided
    const missing = photoSlots.filter((s) => !s.file && !s.existingUrl);
    if (missing.length > 0) {
      setError(
        `All 5 mandatory photos are required. Missing: ${missing.map((m) => m.label).join(', ')}`
      );
      return;
    }

    if (!inverterSerial.trim()) {
      setError('Inverter Serial Number is required for verification.');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('inverter_serial_number', inverterSerial.trim());
      formData.append('completion_remarks', remarks.trim());

      // Append files
      photoSlots.forEach((slot) => {
        if (slot.file) {
          formData.append(slot.key, slot.file);
        }
      });

      await apiRequest(`/api/installation/leads/${leadId}/complete-installation`, {
        method: 'POST',
        body: formData,
      });

      onSuccess();
    } catch (err: any) {
      console.error('Failed to complete installation:', err);
      setError(err.message || 'Failed to save installation execution records.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-amber-500/10 via-white to-indigo-50/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Complete Physical Installation & Upload 5 Photos
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  #{leadNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {customerName} &bull; {capacityKwp ? `${capacityKwp} kWp` : 'ECP Project'}
                {location ? ` &bull; ${location}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Instructions Notice */}
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Mandatory Operational Protocol:</span> Installation team
              members must capture and upload all 5 physical installation photographs on-site. Once
              uploaded, these photos will be instantly visible to the Registration Team for Task Net
              Metering Sub-Task &quot;Upload Installation Photos&quot;.
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Installation Details Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Inverter Serial Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={inverterSerial}
                onChange={(e) => setInverterSerial(e.target.value)}
                placeholder="e.g., INV-GROWATT-2024-99812"
                className="w-full px-3 py-2 text-xs font-mono uppercase bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Installation Crew Remarks
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Structure completed, earthing tested, ready for net metering"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
              />
            </div>
          </div>

          {/* 5 Mandatory Photo Upload Slots */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                5 Mandatory Installation Photographs ({uploadedOrExistingCount}/5 Ready)
              </h3>
              {uploadedOrExistingCount === 5 ? (
                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> All 5 Photos Provided
                </span>
              ) : (
                <span className="text-[11px] font-medium text-amber-600">
                  {5 - uploadedOrExistingCount} photo(s) remaining
                </span>
              )}
            </div>

            <div className="space-y-3">
              {photoSlots.map((slot, index) => {
                const isReady = !!slot.file || !!slot.existingUrl;
                const displayImage = slot.previewUrl || slot.existingUrl;

                return (
                  <div
                    key={slot.key}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isReady
                        ? 'bg-emerald-50/40 border-emerald-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {/* Thumbnail / Placeholder */}
                        <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 relative group">
                          {displayImage ? (
                            <img
                              src={displayImage}
                              alt={slot.label}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Camera className="w-5 h-5 text-slate-400" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900">{slot.label}</h4>
                            {isReady && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Uploaded
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{slot.description}</p>
                          {slot.file && (
                            <span className="text-[10px] font-mono text-slate-600 mt-1 block">
                              {slot.file.name} ({(slot.file.size / 1024).toFixed(0)} KB)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* File Action */}
                      <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                        {slot.file && (
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(index)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Remove chosen photo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <label className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5 text-slate-500" />
                          <span>{isReady ? 'Replace Photo' : 'Select Photo'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => handleFileChange(index, e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <div className="text-slate-500">
            {uploadedOrExistingCount < 5 ? (
              <span className="text-amber-700 font-medium">
                Upload all 5 photos to complete installation handoff
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Ready to submit to Registration
                team
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || uploadedOrExistingCount < 5 || !inverterSerial.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-xs flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Complete Installation
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
