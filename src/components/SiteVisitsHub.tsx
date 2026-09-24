import React, { useState, useEffect } from 'react';
import {
  Compass,
  CheckCircle2,
  Clock,
  UserCheck,
  AlertCircle,
  ImageIcon,
  ExternalLink,
  Plus,
  MapPin,
  Ruler,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { SiteVisit, User } from '../../shared/types';
import { formatToIST } from '../../shared/timezone';
import { SiteVisitModal } from './SiteVisitModal';

interface SiteVisitsHubProps {
  currentUser: User;
  users: User[];
  onOpenLead: (leadId: string) => void;
}

export const SiteVisitsHub: React.FC<SiteVisitsHubProps> = ({
  currentUser,
  users,
  onOpenLead,
}) => {
  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_ASSIGNMENT' | 'ASSIGNED' | 'COMPLETED'>('ALL');

  const [modalMode, setModalMode] = useState<'ASSIGN' | 'COMPLETE' | null>(null);
  const [activeVisit, setActiveVisit] = useState<SiteVisit | null>(null);

  const fetchSiteVisits = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/api/site-visits');
      setSiteVisits(res.site_visits || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch site visits.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSiteVisits();
  }, []);

  const filteredVisits = siteVisits.filter((sv) => {
    if (statusFilter === 'ALL') return true;
    return sv.status === statusFilter;
  });

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Site Visits Hub</h1>
            <p className="text-xs text-slate-400">
              Technical Rooftop Assessments • B2C Field Operations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Filter site visits by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Visits ({siteVisits.length})</option>
            <option value="PENDING_ASSIGNMENT">Pending Assignment</option>
            <option value="ASSIGNED">Assigned / In Progress</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <button
            onClick={fetchSiteVisits}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-400 text-xs">Loading site visit tasks...</div>
      ) : filteredVisits.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-500 text-xs">
          No site visits found matching current filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredVisits.map((visit) => (
            <div
              key={visit.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition-colors shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-400 text-xs">
                      #{visit.lead_number}
                    </span>
                    <h2 className="font-bold text-white text-sm">{visit.customer_name}</h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    📱 {visit.mobile_number} • {visit.location || 'Location not specified'}
                  </p>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    visit.status === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : visit.status === 'ASSIGNED'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {visit.status.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Notes */}
              {visit.notes && (
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs text-slate-300">
                  <span className="font-semibold text-slate-400 block mb-0.5">Visit Instructions:</span>
                  {visit.notes}
                </div>
              )}

              {/* Technical Measurements & Specs */}
              {(visit.structure_height || visit.earthing_cable_length || visit.dc_cable_length || visit.ac_cable_length) && (
                <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-800 text-xs space-y-1.5">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                    <Ruler className="w-3.5 h-3.5" />
                    Structure & Cables
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    {visit.structure_height && (
                      <div className="text-slate-300">
                        <span className="text-slate-500">Height:</span> {visit.structure_height}
                      </div>
                    )}
                    {visit.earthing_cable_length && (
                      <div className="text-slate-300">
                        <span className="text-slate-500">Earthing:</span> {visit.earthing_cable_length}
                      </div>
                    )}
                    {visit.dc_cable_length && (
                      <div className="text-slate-300">
                        <span className="text-slate-500">DC Cable:</span> {visit.dc_cable_length}
                      </div>
                    )}
                    {visit.ac_cable_length && (
                      <div className="text-slate-300">
                        <span className="text-slate-500">AC Cable:</span> {visit.ac_cable_length}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Geo-tagging and Extra Materials indicators */}
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {visit.geo_latitude && visit.geo_longitude && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                    <MapPin className="w-3 h-3" /> GPS Tagged
                  </span>
                )}
                {visit.photo_captured_with_owner && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-300 border border-blue-800/40">
                    ✓ Owner Present
                  </span>
                )}
                {(() => {
                  let count = 0;
                  if (visit.extra_materials) count = visit.extra_materials.length;
                  else if (visit.extra_materials_json) {
                    try {
                      count = JSON.parse(visit.extra_materials_json).length;
                    } catch (_) {}
                  }
                  if (count > 0) {
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-950/60 text-purple-300 border border-purple-800/40">
                        +{count} Extra Materials
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Completion details */}
              {visit.completion_details && (
                <div className="p-3 bg-emerald-950/20 rounded-xl border border-emerald-800/30 text-xs text-emerald-200">
                  <span className="font-semibold text-emerald-400 block mb-0.5">
                    Survey Report & Rooftop Assessment:
                  </span>
                  {visit.completion_details}
                </div>
              )}

              {/* Meta */}
              <div className="text-[11px] text-slate-500 space-y-0.5">
                <div>
                  Requested by <strong className="text-slate-400">{visit.requesting_user_name}</strong> on{' '}
                  {formatToIST(visit.created_at)}
                </div>
                {visit.assigned_member_name && (
                  <div>
                    Assigned to <strong className="text-blue-400">{visit.assigned_member_name}</strong>
                  </div>
                )}
                {visit.completed_at && (
                  <div>
                    Completed on <strong className="text-emerald-400">{formatToIST(visit.completed_at)}</strong>
                  </div>
                )}
              </div>

              {/* Photos indicator */}
              {visit.photos && visit.photos.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-blue-400">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{visit.photos.length} inspection photo(s) uploaded</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onOpenLead(visit.lead_id)}
                  className="text-xs font-semibold text-amber-400 hover:underline flex items-center gap-1"
                >
                  <span>Open Lead Workspace</span>
                  <ExternalLink className="w-3 h-3" />
                </button>

                <div className="flex items-center gap-2">
                  {visit.status === 'PENDING_ASSIGNMENT' &&
                    (currentUser.role === 'INSTALLATION_MANAGER' || currentUser.role === 'OWNER') && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveVisit(visit);
                          setModalMode('ASSIGN');
                        }}
                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Assign Member</span>
                      </button>
                    )}

                  {visit.status === 'ASSIGNED' &&
                    (currentUser.role === 'INSTALLATION_MEMBER' || currentUser.role === 'INSTALLATION_MANAGER' || currentUser.role === 'OWNER') &&
                    (currentUser.role !== 'INSTALLATION_MEMBER' || !visit.assigned_member_id || visit.assigned_member_id === currentUser.id) && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveVisit(visit);
                          setModalMode('COMPLETE');
                        }}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Complete Survey</span>
                      </button>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalMode && activeVisit && (
        <SiteVisitModal
          mode={modalMode}
          leadId={activeVisit.lead_id}
          siteVisit={activeVisit}
          users={users}
          currentUser={currentUser}
          onClose={() => {
            setModalMode(null);
            setActiveVisit(null);
          }}
          onSuccess={() => {
            fetchSiteVisits();
          }}
        />
      )}
    </div>
  );
};
