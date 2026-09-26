import React, { useState } from 'react';
import {
  X,
  Clock,
  AlertTriangle,
  User as UserIcon,
  Phone,
  Mail,
  MapPin,
  Zap,
  CheckCircle2,
  Calendar,
  Send,
  Wrench,
  ShieldCheck,
  Star,
  FileText,
  Tag,
  ArrowRight,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import type {
  ComplaintStatus,
  ServiceComplaint,
  User,
} from '../../shared/types.ts';
import { apiRequest } from '../lib/api.ts';

interface ComplaintDetailModalProps {
  isOpen: boolean;
  complaint: ServiceComplaint | null;
  currentUser?: User;
  users?: User[];
  onClose: () => void;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<
  ComplaintStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  OPEN: { label: 'Open (Triage)', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  ASSIGNED: { label: 'Technician Assigned', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  IN_PROGRESS: { label: 'Field Visit / In Progress', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  WAITING_PARTS: { label: 'Awaiting OEM Parts', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  RESOLVED: { label: 'Resolved', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  CLOSED: { label: 'Closed & Verified', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
};

export const ComplaintDetailModal: React.FC<ComplaintDetailModalProps> = ({
  isOpen,
  complaint,
  currentUser,
  users = [],
  onClose,
  onRefresh,
}) => {
  if (!isOpen || !complaint) return null;

  // Tabs inside modal: 'details', 'action', 'timeline'
  const [activeTab, setActiveTab] = useState<'details' | 'action' | 'timeline'>('details');

  // Assignment states
  const [selectedTechId, setSelectedTechId] = useState(complaint.assigned_to_user_id || '');
  const [assignNotes, setAssignNotes] = useState(complaint.assignment_notes || '');
  const [assigning, setAssigning] = useState(false);

  // Status update states
  const [targetStatus, setTargetStatus] = useState<ComplaintStatus>(complaint.status);
  const [techVisitDate, setTechVisitDate] = useState(complaint.technician_visit_date || '');
  const [rootCause, setRootCause] = useState(complaint.root_cause || '');
  const [actionTaken, setActionTaken] = useState(complaint.action_taken || '');
  const [partsReplaced, setPartsReplaced] = useState(complaint.parts_replaced || '');
  const [isWarrantyClaim, setIsWarrantyClaim] = useState(complaint.is_warranty_claim || false);
  const [warrantyClaimNumber, setWarrantyClaimNumber] = useState(complaint.warranty_claim_number || '');
  const [resolutionNotes, setResolutionNotes] = useState(complaint.resolution_notes || '');
  const [customerRating, setCustomerRating] = useState<number>(complaint.customer_rating || 5);
  const [customerFeedback, setCustomerFeedback] = useState(complaint.customer_feedback || '');
  const [statusUpdateNote, setStatusUpdateNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Quick technical activity note
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Technician users list
  const technicians = users.filter(
    (u) =>
      u.active &&
      (u.role === 'INSTALLATION_MEMBER' ||
        u.role === 'INSTALLATION_MANAGER' ||
        u.role === 'SERVICE')
  );

  // Check SLA status
  const isResolvedOrClosed = complaint.status === 'RESOLVED' || complaint.status === 'CLOSED';
  const slaDate = new Date(complaint.sla_due_at);
  const isSlaBreached = !isResolvedOrClosed && slaDate.getTime() < Date.now();

  const handleAssignTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTechId) {
      setError('Please select a technician to assign.');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    try {
      setAssigning(true);
      const res = await apiRequest(`/api/complaints/${complaint.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          assigned_to_user_id: selectedTechId,
          assignment_notes: assignNotes.trim(),
        }),
      });
      if (res.success) {
        setSuccessMsg('Technician successfully assigned.');
        onRefresh();
      } else {
        throw new Error(res.error || 'Failed to assign.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to assign technician.');
    } finally {
      setAssigning(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    try {
      setUpdatingStatus(true);
      const res = await apiRequest(`/api/complaints/${complaint.id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status: targetStatus,
          technician_visit_date: techVisitDate || null,
          root_cause: rootCause.trim() || null,
          action_taken: actionTaken.trim() || null,
          parts_replaced: partsReplaced.trim() || null,
          is_warranty_claim: isWarrantyClaim,
          warranty_claim_number: warrantyClaimNumber.trim() || null,
          resolution_notes: resolutionNotes.trim() || null,
          customer_rating: targetStatus === 'CLOSED' ? customerRating : null,
          customer_feedback: customerFeedback.trim() || null,
          notes: statusUpdateNote.trim() || null,
        }),
      });

      if (res.success) {
        setSuccessMsg(`Status updated to ${STATUS_CONFIG[targetStatus]?.label || targetStatus}.`);
        onRefresh();
      } else {
        throw new Error(res.error || 'Failed to update status.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setError(null);
    try {
      setAddingNote(true);
      const res = await apiRequest(`/api/complaints/${complaint.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note: newNote.trim() }),
      });
      if (res.success) {
        setNewNote('');
        setSuccessMsg('Activity note recorded.');
        onRefresh();
      } else {
        throw new Error(res.error || 'Failed to add note.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add note.');
    } finally {
      setAddingNote(false);
    }
  };

  const currentStatusBadge = STATUS_CONFIG[complaint.status] || STATUS_CONFIG.OPEN;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-4xl w-full overflow-hidden my-auto flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 font-bold">
              <Zap className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-black text-slate-900">
                  {complaint.ticket_number}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${currentStatusBadge.bg} ${currentStatusBadge.text} ${currentStatusBadge.border}`}
                >
                  {currentStatusBadge.label}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                    complaint.priority === 'CRITICAL'
                      ? 'bg-rose-100 text-rose-800'
                      : complaint.priority === 'HIGH'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {complaint.priority} Priority
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight mt-0.5">
                {complaint.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200/80 bg-white shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'details'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Ticket & Equipment Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('action')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'action'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Assign & Update Status
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'timeline'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Activity Timeline ({complaint.activities?.length || 0})
          </button>
        </div>

        {/* Notices */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs font-semibold animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-800 text-xs font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-5">
              {/* SLA Banner */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                  isSlaBreached
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : isResolvedOrClosed
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50/70 border-amber-200/80 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Clock
                    className={`w-4 h-4 ${
                      isSlaBreached ? 'text-rose-600 animate-pulse' : 'text-amber-600'
                    }`}
                  />
                  <div>
                    <span className="text-xs font-bold">
                      {isResolvedOrClosed
                        ? 'Ticket Resolved & Closed within Service Lifecycle'
                        : isSlaBreached
                        ? 'SLA Breached! Immediate escalation required'
                        : 'SLA Target Resolution Time:'}
                    </span>
                    <span className="text-xs ml-2 font-mono font-semibold">
                      {new Date(complaint.sla_due_at).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/80 border border-slate-200">
                  Reported: {new Date(complaint.reported_at).toLocaleDateString('en-IN')}
                </div>
              </div>

              {/* Customer & Solar Specs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Details */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2.5">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-blue-600" />
                    Customer & Site Information
                  </h3>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Name:</span>
                      <span className="font-bold text-slate-900">{complaint.customer_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Mobile Phone:</span>
                      <a
                        href={`tel:${complaint.customer_phone}`}
                        className="font-mono font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" />
                        {complaint.customer_phone}
                      </a>
                    </div>
                    {complaint.customer_email && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Email:</span>
                        <span className="text-slate-700">{complaint.customer_email}</span>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-500 shrink-0">Address:</span>
                      <span className="text-right text-slate-700">
                        {complaint.customer_address || 'N/A'}, {complaint.city || ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Equipment Specs */}
                <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-200/60 space-y-2.5">
                  <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-600" />
                    Equipment & Solar Specs
                  </h3>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">System Capacity:</span>
                      <span className="font-bold text-slate-900 font-mono">
                        {complaint.system_capacity_kw ? `${complaint.system_capacity_kw} kW` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Inverter Model:</span>
                      <span className="font-semibold text-slate-800">
                        {complaint.inverter_brand_model || 'Not Recorded'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Inverter Serial:</span>
                      <span className="font-mono text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                        {complaint.inverter_serial || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Commissioning Date:</span>
                      <span className="text-slate-700">
                        {complaint.commissioning_date || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Problem Description */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200/90 space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Reported Issue Description
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-200/60">
                  {complaint.description}
                </p>
              </div>

              {/* Technician & Resolution Info if available */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-blue-600" />
                    Field Assignee
                  </h3>
                  {complaint.assigned_to_name ? (
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-slate-900">{complaint.assigned_to_name}</div>
                      {complaint.assignment_notes && (
                        <p className="text-slate-600 italic">"{complaint.assignment_notes}"</p>
                      )}
                      <p className="text-[11px] text-slate-400">
                        Assigned on: {complaint.assigned_at ? new Date(complaint.assigned_at).toLocaleDateString('en-IN') : 'N/A'}
                      </p>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-700 font-semibold bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                      Unassigned • Awaiting technician assignment
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Resolution Summary
                  </h3>
                  {complaint.resolution_notes ? (
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-emerald-900">
                        Root Cause: {complaint.root_cause || 'Identified & Fixed'}
                      </div>
                      <p className="text-slate-700">{complaint.resolution_notes}</p>
                      {complaint.parts_replaced && (
                        <p className="text-[11px] text-slate-600 font-medium">
                          Parts Replaced: {complaint.parts_replaced}
                        </p>
                      )}
                      {complaint.customer_rating && (
                        <div className="flex items-center gap-1 text-amber-500 font-bold pt-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < complaint.customer_rating!
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-300'
                              }`}
                            />
                          ))}
                          <span className="text-xs text-slate-700 ml-1">
                            ({complaint.customer_rating}/5 rating)
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">
                      Resolution details will be recorded once field work is completed.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ASSIGN & UPDATE STATUS */}
          {activeTab === 'action' && (
            <div className="space-y-6">
              {/* Technician Assignment Form */}
              <form
                onSubmit={handleAssignTechnician}
                className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-blue-600" />
                    Assign / Reassign Field Technician
                  </h3>
                  {complaint.assigned_to_name && (
                    <span className="text-[11px] text-slate-500">
                      Currently assigned to: <strong className="text-slate-800">{complaint.assigned_to_name}</strong>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Select Technician *
                    </label>
                    <select
                      value={selectedTechId}
                      onChange={(e) => setSelectedTechId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-blue-500"
                    >
                      <option value="">-- Choose Field Engineer --</option>
                      {technicians.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Instructions / Notes
                    </label>
                    <input
                      type="text"
                      value={assignNotes}
                      onChange={(e) => setAssignNotes(e.target.value)}
                      placeholder="e.g. Carry 32A MCB, check earthing pit"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={assigning}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {assigning ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Assigning...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirm Assignment</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Status & Resolution Progression Form */}
              <form
                onSubmit={handleUpdateStatus}
                className="p-4 bg-white rounded-2xl border border-slate-200/90 space-y-4 shadow-xs"
              >
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Service Lifecycle & Resolution Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Target Lifecycle Status *
                    </label>
                    <select
                      value={targetStatus}
                      onChange={(e) => setTargetStatus(e.target.value as ComplaintStatus)}
                      className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-bold focus:outline-hidden focus:border-amber-500"
                    >
                      <option value="OPEN">OPEN (Awaiting Review)</option>
                      <option value="ASSIGNED">ASSIGNED (Technician Dispatched)</option>
                      <option value="IN_PROGRESS">IN_PROGRESS (Diagnosis / Field Work)</option>
                      <option value="WAITING_PARTS">WAITING_PARTS (Awaiting Inverter/OEM Part)</option>
                      <option value="RESOLVED">RESOLVED (Problem Fixed & Tested)</option>
                      <option value="CLOSED">CLOSED (Customer Verified & Satisfied)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Technician Field Visit Date
                    </label>
                    <input
                      type="date"
                      value={techVisitDate}
                      onChange={(e) => setTechVisitDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Additional Resolution Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Root Cause Analysis
                    </label>
                    <input
                      type="text"
                      value={rootCause}
                      onChange={(e) => setRootCause(e.target.value)}
                      placeholder="e.g. High grid voltage (>255V) / Loose terminal"
                      className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Corrective Action Taken
                    </label>
                    <input
                      type="text"
                      value={actionTaken}
                      onChange={(e) => setActionTaken(e.target.value)}
                      placeholder="e.g. Calibrated inverter voltage range, re-crimped lugs"
                      className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Spare Parts Replaced
                    </label>
                    <input
                      type="text"
                      value={partsReplaced}
                      onChange={(e) => setPartsReplaced(e.target.value)}
                      placeholder="e.g. 1x 32A MCB Schneider, 2x MC4 Connectors"
                      className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={isWarrantyClaim}
                        onChange={(e) => setIsWarrantyClaim(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                      />
                      <span>Covered Under OEM Warranty</span>
                    </label>
                    {isWarrantyClaim && (
                      <input
                        type="text"
                        value={warrantyClaimNumber}
                        onChange={(e) => setWarrantyClaimNumber(e.target.value)}
                        placeholder="Warranty Claim #"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Technician Resolution Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Details of test results, power generation verification, and customer signoff..."
                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                {/* Closing & Rating if CLOSED */}
                {(targetStatus === 'CLOSED' || complaint.status === 'RESOLVED') && (
                  <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-2">
                    <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                      Customer Satisfaction Rating (1 to 5 Stars)
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setCustomerRating(star)}
                          className="p-1 cursor-pointer transition-transform hover:scale-110"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              star <= customerRating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-300'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-bold text-slate-700 ml-2">
                        {customerRating} / 5 Stars
                      </span>
                    </div>
                    <input
                      type="text"
                      value={customerFeedback}
                      onChange={(e) => setCustomerFeedback(e.target.value)}
                      placeholder="Customer feedback or closing remarks..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={updatingStatus}
                    className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-md shadow-amber-500/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {updatingStatus ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Update Service Ticket Status</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: TIMELINE & ACTIVITY LOG */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {/* Add Progress Note Form */}
              <form
                onSubmit={handleAddNote}
                className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80"
              >
                <input
                  type="text"
                  required
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a progress update, technician call note, or customer communication..."
                  className="flex-1 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={addingNote}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Log Note</span>
                </button>
              </form>

              {/* Activity Timeline Items */}
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                {complaint.activities && complaint.activities.length > 0 ? (
                  complaint.activities.map((act) => (
                    <div key={act.id} className="relative flex items-start gap-3 pl-1">
                      <div className="w-6 h-6 rounded-full bg-white border-2 border-amber-500 flex items-center justify-center shrink-0 z-10 shadow-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      </div>
                      <div className="flex-1 p-3 bg-white rounded-xl border border-slate-200/80 text-xs shadow-2xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-800">{act.actor_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(act.created_at).toLocaleString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed">{act.notes}</p>
                        {act.old_status && act.new_status && (
                          <div className="mt-1 text-[10px] text-slate-400 font-medium">
                            Status: <span className="font-semibold text-slate-600">{act.old_status}</span> &rarr;{' '}
                            <span className="font-semibold text-slate-800">{act.new_status}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-slate-400">
                    No timeline activities recorded yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
