import React, { useState } from 'react';
import {
  X,
  Compass,
  Upload,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  Trash2,
  MapPin,
  Ruler,
  Zap,
  Shield,
  Plus,
  Crosshair,
  Maximize2,
  Minimize2,
  ArrowLeft,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { SiteVisit, User, ExtraMaterial } from '../../shared/types';

interface SiteVisitModalProps {
  mode: 'REQUEST' | 'ASSIGN' | 'COMPLETE';
  leadId?: string;
  siteVisit?: SiteVisit | null;
  users?: User[]; // Installation members for assignment
  currentUser?: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

const COMMON_UOMS = ['Mtr', 'Nos', 'Set', 'Kg', 'Pkt', 'Box', 'Bundle', 'Roll', 'Feet'];

export const SiteVisitModal: React.FC<SiteVisitModalProps> = ({
  mode,
  leadId,
  siteVisit,
  users = [],
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [notes, setNotes] = useState('');
  const [assignedMemberId, setAssignedMemberId] = useState(siteVisit?.assigned_member_id || '');
  const [scheduledDate, setScheduledDate] = useState(
    siteVisit?.scheduled_date ? new Date(siteVisit.scheduled_date).toISOString().slice(0, 16) : ''
  );
  const [completionDetails, setCompletionDetails] = useState('');

  // Technical measurements
  const [structureHeight, setStructureHeight] = useState(siteVisit?.structure_height || '');
  const [earthingCableLength, setEarthingCableLength] = useState(siteVisit?.earthing_cable_length || '');
  const [dcCableLength, setDcCableLength] = useState(siteVisit?.dc_cable_length || '');
  const [acCableLength, setAcCableLength] = useState(siteVisit?.ac_cable_length || '');

  // Geo-tagging and owner verification
  const [geoLatitude, setGeoLatitude] = useState<number | null>(
    siteVisit?.geo_latitude ? Number(siteVisit.geo_latitude) : null
  );
  const [geoLongitude, setGeoLongitude] = useState<number | null>(
    siteVisit?.geo_longitude ? Number(siteVisit.geo_longitude) : null
  );
  const [geoAddress, setGeoAddress] = useState(siteVisit?.geo_address || '');
  const [photoCapturedWithOwner, setPhotoCapturedWithOwner] = useState<boolean>(
    siteVisit?.photo_captured_with_owner ?? true
  );
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Extra materials required
  const [extraMaterials, setExtraMaterials] = useState<ExtraMaterial[]>(() => {
    if (siteVisit?.extra_materials && siteVisit.extra_materials.length > 0) {
      return siteVisit.extra_materials;
    }
    if (siteVisit?.extra_materials_json) {
      try {
        return JSON.parse(siteVisit.extra_materials_json);
      } catch (_) {
        return [];
      }
    }
    return [];
  });

  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(mode === 'COMPLETE');

  // Filter only active installation members
  const installationMembers = users.filter(
    (u) => u.role === 'INSTALLATION_MEMBER' && u.active
  );

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      if (photos.length + selectedFiles.length > 3) {
        setError('Maximum 3 photos can be uploaded (Geo-tagged photo with owner).');
        const remainingSlots = 3 - photos.length;
        if (remainingSlots > 0) {
          setPhotos((prev) => [...prev, ...selectedFiles.slice(0, remainingSlots)]);
        }
        return;
      }
      setPhotos((prev) => [...prev, ...selectedFiles]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      setGpsError('GPS Geolocation is not supported by your browser.');
      return;
    }
    setIsCapturingGps(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLatitude(Number(pos.coords.latitude.toFixed(6)));
        setGeoLongitude(Number(pos.coords.longitude.toFixed(6)));
        setIsCapturingGps(false);
      },
      (err) => {
        setIsCapturingGps(false);
        setGpsError(err.message || 'Unable to retrieve GPS coordinates.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleAddExtraMaterial = () => {
    setExtraMaterials((prev) => [...prev, { name: '', quantity: 1, uom: 'Mtr' }]);
  };

  const handleRemoveExtraMaterial = (index: number) => {
    setExtraMaterials((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateExtraMaterial = (index: number, field: keyof ExtraMaterial, value: any) => {
    setExtraMaterials((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'REQUEST') {
        if (!leadId) throw new Error('Lead ID is missing.');
        await apiRequest('/api/site-visits', {
          method: 'POST',
          body: JSON.stringify({ lead_id: leadId, notes }),
        });
      } else if (mode === 'ASSIGN') {
        if (currentUser?.role !== 'INSTALLATION_MANAGER' && currentUser?.role !== 'OWNER') {
          throw new Error(
            'Site Visit cannot be assigned by this role. Only the Installation Team Manager or System Owner has permission to assign site surveys to field technicians.'
          );
        }
        if (!siteVisit) throw new Error('Site Visit not selected.');
        if (!assignedMemberId) throw new Error('Please select an Installation Member.');
        await apiRequest(`/api/site-visits/${siteVisit.id}/assign`, {
          method: 'POST',
          body: JSON.stringify({
            assigned_member_id: assignedMemberId,
            notes,
            scheduled_date: scheduledDate ? new Date(scheduledDate).toISOString() : null,
          }),
        });
      } else if (mode === 'COMPLETE') {
        if (!siteVisit) throw new Error('Site Visit not selected.');
        if (
          currentUser?.role === 'INSTALLATION_MEMBER' &&
          siteVisit.assigned_member_id &&
          siteVisit.assigned_member_id !== currentUser.id
        ) {
          throw new Error('You can only complete site surveys assigned to you.');
        }
        if (!completionDetails.trim()) {
          throw new Error('Completion details and site survey assessment are required.');
        }
        if (photos.length > 3) {
          throw new Error('Maximum 3 photos can be uploaded.');
        }

        const formData = new FormData();
        formData.append('completion_details', completionDetails.trim());
        if (notes.trim()) formData.append('notes', notes.trim());
        if (structureHeight.trim()) formData.append('structure_height', structureHeight.trim());
        if (earthingCableLength.trim()) formData.append('earthing_cable_length', earthingCableLength.trim());
        if (dcCableLength.trim()) formData.append('dc_cable_length', dcCableLength.trim());
        if (acCableLength.trim()) formData.append('ac_cable_length', acCableLength.trim());
        if (geoLatitude !== null) formData.append('geo_latitude', String(geoLatitude));
        if (geoLongitude !== null) formData.append('geo_longitude', String(geoLongitude));
        if (geoAddress.trim()) formData.append('geo_address', geoAddress.trim());
        formData.append('photo_captured_with_owner', String(photoCapturedWithOwner));

        const validExtraMaterials = extraMaterials
          .map((m) => ({
            name: m.name.trim(),
            quantity: Number(m.quantity) || 1,
            uom: m.uom.trim() || 'Nos',
          }))
          .filter((m) => m.name.length > 0);

        if (validExtraMaterials.length > 0) {
          formData.append('extra_materials', JSON.stringify(validExtraMaterials));
        }

        for (const file of photos) {
          formData.append('photos', file);
        }

        await apiRequest(`/api/site-visits/${siteVisit.id}/complete`, {
          method: 'POST',
          body: formData,
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

  if (mode === 'ASSIGN' && currentUser?.role !== 'INSTALLATION_MANAGER' && currentUser?.role !== 'OWNER') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-xs">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-900">Task Restricted</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              On a strict need-to-know basis, only the Installation Team Manager has the right to assign site visits to installation team members.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (
    mode === 'COMPLETE' &&
    currentUser?.role === 'INSTALLATION_MEMBER' &&
    siteVisit?.assigned_member_id &&
    siteVisit.assigned_member_id !== currentUser.id
  ) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-xs">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-900">Task Restricted</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              On a strict need-to-know basis, you can only complete and submit reports for site surveys that have been explicitly assigned to you.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const isCompleteMode = mode === 'COMPLETE';

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center ${
        isFullScreen ? 'p-0' : 'p-2 sm:p-4 overflow-y-auto'
      }`}
    >
      <div
        className={`bg-white border border-slate-200 overflow-hidden shadow-2xl text-slate-900 flex flex-col transition-all ${
          isFullScreen
            ? 'w-full h-full rounded-none'
            : isCompleteMode
            ? 'rounded-2xl w-full max-w-2xl max-h-[92vh] my-auto'
            : 'rounded-2xl w-full max-w-lg my-auto'
        }`}
      >
        <div className="p-3 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/90 shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            {isFullScreen && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 -ml-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors flex items-center gap-1 text-xs font-semibold"
                title="Return"
              >
                <ArrowLeft className="w-5 h-5 text-slate-700" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-xs shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {mode === 'REQUEST' && 'Request B2C Site Visit'}
                {mode === 'ASSIGN' && 'Assign Site Visit Member'}
                {mode === 'COMPLETE' && 'Complete Site Visit Survey & Technical Specs'}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                {mode === 'REQUEST' && 'Hand off to Installation Manager for site assessment'}
                {mode === 'ASSIGN' && 'Delegate to an active Installation Team Member'}
                {mode === 'COMPLETE' && 'Record structure height, cables, materials, and geo-tagged photos'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors hidden sm:flex items-center justify-center"
              title={isFullScreen ? 'Exit Full Window' : 'Expand to Full Window'}
            >
              {isFullScreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'REQUEST' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Site Visit Request Notes (Optional)
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Mention customer requirements, rooftop access availability, preferred visit timing..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs"
              />
            </div>
          )}

          {mode === 'ASSIGN' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Assign Installation Team Member <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={assignedMemberId}
                  onChange={(e) => setAssignedMemberId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-blue-500 shadow-xs"
                >
                  <option value="">Select an active technician...</option>
                  {installationMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.username})
                    </option>
                  ))}
                </select>
                {installationMembers.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    No active Installation Team Members found. Please create or activate members first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Scheduled Date & Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Assignment Instructions (Optional)
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Please measure shadow-free roof area and meter panel distance."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>
            </>
          )}

          {mode === 'COMPLETE' && (
            <div className="space-y-4">
              {/* Section 1: Structure & Cable Length Measurements */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                  <Ruler className="w-4 h-4 text-blue-600" />
                  Rooftop Structure & Cable Measurements
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Structure Height */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Structure Height <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={structureHeight}
                      onChange={(e) => setStructureHeight(e.target.value)}
                      placeholder="e.g. 8 ft, 10 ft, 2.5 m"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Clear height from rooftop surface</span>
                  </div>

                  {/* Earthing Cable */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Approx. Earthing Cable Length <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={earthingCableLength}
                      onChange={(e) => setEarthingCableLength(e.target.value)}
                      placeholder="e.g. 25 meters, 30 m"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Distance from roof to earth pit</span>
                  </div>

                  {/* DC Cable Length */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Approx. DC Cable Length <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={dcCableLength}
                      onChange={(e) => setDcCableLength(e.target.value)}
                      placeholder="e.g. 35 meters, 40 m"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Panel strings to inverter distance</span>
                  </div>

                  {/* AC Cable Length */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Approx. AC Cable Length <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={acCableLength}
                      onChange={(e) => setAcCableLength(e.target.value)}
                      placeholder="e.g. 20 meters, 25 m"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Inverter to main LT distribution panel</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Geo-Tagged Photos with Property Owner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    Geo-Tagged Photos with Owner
                  </div>
                  <span className="text-[11px] px-2 py-0.5 bg-blue-100 text-blue-700 font-bold rounded-full">
                    {photos.length}/3 Photos
                  </span>
                </div>

                {/* GPS Capture Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-2 text-xs">
                    <Crosshair className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      {geoLatitude !== null && geoLongitude !== null ? (
                        <div className="font-semibold text-emerald-700">
                          GPS Tagged: {geoLatitude}° N, {geoLongitude}° E
                        </div>
                      ) : (
                        <div className="text-slate-500">No GPS location tagged yet</div>
                      )}
                      {gpsError && <div className="text-[11px] text-rose-600">{gpsError}</div>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCaptureGps}
                    disabled={isCapturingGps}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs"
                  >
                    <Crosshair className={`w-3.5 h-3.5 ${isCapturingGps ? 'animate-spin' : ''}`} />
                    {isCapturingGps ? 'Fetching GPS...' : geoLatitude !== null ? 'Refresh GPS' : 'Capture Live GPS'}
                  </button>
                </div>

                {/* Owner presence verification checkbox */}
                <label className="flex items-start gap-2 text-xs text-slate-700 bg-white p-2.5 border border-slate-200 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={photoCapturedWithOwner}
                    onChange={(e) => setPhotoCapturedWithOwner(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    <strong className="text-slate-900 block">Geo-tagged photo with owner:</strong>
                    I confirm the photo is captured on-site and includes the property owner or representative present during the survey.
                  </span>
                </label>

                {/* Photo Upload Zone */}
                <div>
                  <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl cursor-pointer bg-white transition-colors">
                    <Upload className="w-5 h-5 text-blue-600 mb-1" />
                    <span className="text-xs font-medium text-slate-700">
                      Upload Photos ({photos.length}/3 selected — Maximum 3 allowed)
                    </span>
                    <span className="text-[10px] text-slate-500">JPG, PNG, WebP up to 10MB each</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      disabled={photos.length >= 3}
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>

                  {photos.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {photos.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <ImageIcon className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            <span className="truncate text-slate-800 font-medium">{file.name}</span>
                            <span className="text-[10px] text-slate-400">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                            {geoLatitude !== null && (
                              <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                                Geo-Tagged
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Extra Material Required */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <Shield className="w-4 h-4 text-purple-600" />
                    Extra Material Required (Beyond Standard BOM)
                  </div>
                  <button
                    type="button"
                    onClick={handleAddExtraMaterial}
                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Material
                  </button>
                </div>

                {extraMaterials.length === 0 ? (
                  <div className="text-center p-3 bg-white border border-dashed border-slate-200 rounded-lg text-xs text-slate-400">
                    No extra material listed. Click <strong>&quot;+ Add Material&quot;</strong> if special conduit, civil mounting pads, chemical earthing, or extra fittings are needed.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {extraMaterials.map((mat, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-center bg-white p-2 border border-slate-200 rounded-lg text-xs"
                      >
                        <div className="col-span-6">
                          <input
                            type="text"
                            required
                            value={mat.name}
                            onChange={(e) => handleUpdateExtraMaterial(idx, 'name', e.target.value)}
                            placeholder="Material Name (e.g. 25mm PVC Conduit)"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            required
                            value={mat.quantity}
                            onChange={(e) =>
                              handleUpdateExtraMaterial(idx, 'quantity', parseFloat(e.target.value) || 0)
                            }
                            placeholder="Qty"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <select
                            value={mat.uom}
                            onChange={(e) => handleUpdateExtraMaterial(idx, 'uom', e.target.value)}
                            className="w-full px-1.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-slate-900 text-xs focus:outline-none focus:border-purple-500"
                          >
                            {COMMON_UOMS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveExtraMaterial(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 4: Site Survey Details & Viability Assessment */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Site Survey Details & Roof Viability Assessment <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={completionDetails}
                  onChange={(e) => setCompletionDetails(e.target.value)}
                  placeholder="Document roof condition, shadow-free area (sq ft), structural stability, inverter placement recommendations..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 shrink-0">
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
            >
              {loading ? (
                'Processing...'
              ) : mode === 'REQUEST' ? (
                <>
                  <Compass className="w-4 h-4" /> Submit Site Visit Request
                </>
              ) : mode === 'ASSIGN' ? (
                <>
                  <CheckCircle className="w-4 h-4" /> Assign Member
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" /> Complete & Submit Findings
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
