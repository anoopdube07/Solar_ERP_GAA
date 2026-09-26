import React, { useState } from 'react';
import {
  X,
  Plus,
  AlertTriangle,
  User as UserIcon,
  Phone,
  Mail,
  MapPin,
  Zap,
  Cpu,
  Clock,
  CheckCircle2,
  Calendar,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import type {
  ComplaintCategory,
  ComplaintPriority,
  Lead,
  ServiceComplaint,
  User,
} from '../../shared/types.ts';
import { apiRequest } from '../lib/api.ts';

interface RegisterComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (complaint: ServiceComplaint) => void;
  leads?: Lead[];
  users?: User[];
}

const COMPLAINT_CATEGORIES: { value: ComplaintCategory; label: string; desc: string }[] = [
  { value: 'INVERTER_FAULT', label: 'Inverter Fault / Tripping', desc: 'Error codes, DC/AC disconnection, frequent restart' },
  { value: 'GENERATION_DROP', label: 'Low Generation / Yield Drop', desc: 'Solar output significantly below rated capacity' },
  { value: 'GRID_TRIPPING', label: 'Grid Overvoltage / Discom Trip', desc: 'Grid voltage high or anti-islanding false trip' },
  { value: 'APP_OFFLINE', label: 'Wi-Fi / Monitoring Offline', desc: 'Dongle connectivity, cloud app not syncing' },
  { value: 'WIRING_LEAKAGE', label: 'ACDB / DCDB / Earth Fault', desc: 'Breaker tripping, earth resistance high, MCB burnt' },
  { value: 'PHYSICAL_DAMAGE', label: 'Module Physical Damage', desc: 'Micro-crack, shattered glass, water ingress' },
  { value: 'NET_METER_ISSUE', label: 'Net Metering / Discom Billing', desc: 'Import/Export calculation discrepancy' },
  { value: 'OTHER', label: 'General Service & Maintenance', desc: 'Cleaning, structure inspection, periodic health check' },
];

const PRIORITIES: { value: ComplaintPriority; label: string; slaText: string; color: string }[] = [
  { value: 'CRITICAL', label: 'Critical', slaText: '24 Hours SLA', color: 'border-rose-500 text-rose-700 bg-rose-50' },
  { value: 'HIGH', label: 'High', slaText: '48 Hours SLA', color: 'border-amber-500 text-amber-700 bg-amber-50' },
  { value: 'MEDIUM', label: 'Medium', slaText: '72 Hours SLA', color: 'border-blue-500 text-blue-700 bg-blue-50' },
  { value: 'LOW', label: 'Low', slaText: '5 Days SLA', color: 'border-slate-400 text-slate-700 bg-slate-50' },
];

export const RegisterComplaintModal: React.FC<RegisterComplaintModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  leads = [],
  users = [],
}) => {
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [city, setCity] = useState('');
  const [systemCapacityKw, setSystemCapacityKw] = useState<string>('');
  const [inverterBrandModel, setInverterBrandModel] = useState('');
  const [inverterSerial, setInverterSerial] = useState('');
  const [commissioningDate, setCommissioningDate] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('INVERTER_FAULT');
  const [priority, setPriority] = useState<ComplaintPriority>('HIGH');
  const [reportedChannel, setReportedChannel] = useState('PHONE');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter technicians
  const technicians = users.filter(
    (u) =>
      u.active &&
      (u.role === 'INSTALLATION_MEMBER' ||
        u.role === 'INSTALLATION_MANAGER' ||
        u.role === 'SERVICE')
  );

  const handleSelectLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    if (!leadId) return;

    const lead = leads.find((l) => l.id === leadId);
    if (lead) {
      setCustomerName(lead.customer_name || '');
      setCustomerPhone(lead.mobile_number || '');
      setCustomerEmail(lead.email || '');
      setCustomerAddress(lead.address || '');
      setCity(lead.location || '');
      if (lead.assigned_installer_id) {
        setAssignedToUserId(lead.assigned_installer_id);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError('Please provide customer name.');
      return;
    }
    if (!customerPhone.trim()) {
      setError('Please provide customer phone number.');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a brief complaint subject/title.');
      return;
    }
    if (!description.trim()) {
      setError('Please describe the reported complaint in detail.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiRequest('/api/complaints', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: selectedLeadId || null,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          customer_email: customerEmail.trim() || null,
          customer_address: customerAddress.trim() || null,
          city: city.trim() || null,
          system_capacity_kw: systemCapacityKw ? parseFloat(systemCapacityKw) : null,
          inverter_brand_model: inverterBrandModel.trim() || null,
          inverter_serial: inverterSerial.trim() || null,
          commissioning_date: commissioningDate || null,
          category,
          priority,
          reported_channel: reportedChannel,
          title: title.trim(),
          description: description.trim(),
          assigned_to_user_id: assignedToUserId || null,
          assignment_notes: assignmentNotes.trim() || null,
        }),
      });

      if (res.success && res.complaint) {
        onSuccess(res.complaint);
        onClose();
      } else {
        throw new Error(res.error || 'Failed to register complaint.');
      }
    } catch (err: any) {
      console.error('Error creating complaint:', err);
      setError(err.message || 'Failed to submit complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-3xl w-full overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 font-bold">
              <Zap className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Register Customer Service Complaint
              </h2>
              <p className="text-xs text-slate-500">
                After-Sales Solar System Support & Maintenance Dispatch
              </p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs font-semibold animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick link existing lead / customer */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                Link to Existing Project (Optional)
              </label>
              <span className="text-[11px] text-slate-400">Auto-fills customer & system details</span>
            </div>
            <select
              value={selectedLeadId}
              onChange={(e) => handleSelectLead(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            >
              <option value="">-- Standalone Customer / Non-Lead --</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.customer_name} ({l.customer_type} • {l.mobile_number} • {l.location || 'N/A'})
                </option>
              ))}
            </select>
          </div>

          {/* Customer Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Mobile Number *
              </label>
              <input
                type="text"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="e.g. customer@example.com"
                className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Installation Address
              </label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Plot/Flat number, Street, Landmark"
                className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                City / Location
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Pune, MH"
                className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Equipment Specifications */}
          <div className="p-3.5 bg-amber-50/40 rounded-2xl border border-amber-200/60">
            <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-amber-600" />
              Installed Solar Equipment Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  System Capacity (kW)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={systemCapacityKw}
                  onChange={(e) => setSystemCapacityKw(e.target.value)}
                  placeholder="e.g. 5.0"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Inverter Brand & Model
                </label>
                <input
                  type="text"
                  value={inverterBrandModel}
                  onChange={(e) => setInverterBrandModel(e.target.value)}
                  placeholder="e.g. Growatt 5kW 3-Phase"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Inverter Serial Number
                </label>
                <input
                  type="text"
                  value={inverterSerial}
                  onChange={(e) => setInverterSerial(e.target.value)}
                  placeholder="e.g. GW5K-2024-88391"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-amber-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Priority & Category Selection */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Severity / Priority Level *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRIORITIES.map((p) => {
                  const active = priority === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        active
                          ? `${p.color} ring-2 ring-amber-500/50 font-bold shadow-xs`
                          : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-bold">{p.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{p.slaText}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Complaint Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-amber-500"
                >
                  {COMPLAINT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reported Via Channel
                </label>
                <select
                  value={reportedChannel}
                  onChange={(e) => setReportedChannel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-amber-500"
                >
                  <option value="PHONE">Inbound Phone Call</option>
                  <option value="WHATSAPP">WhatsApp Official Support</option>
                  <option value="PORTAL">Customer App / Web Portal</option>
                  <option value="EMAIL">Support Email</option>
                  <option value="SITE_VISIT">Field Routine Check / Inspection</option>
                </select>
              </div>
            </div>
          </div>

          {/* Complaint Title & Description */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Complaint Subject / Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Inverter Error F08 with red warning LED tripping at 1 PM"
                className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Detailed Problem Description *
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe symptoms, error codes on display, whether grid electricity is available, and specific customer remarks..."
                className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Technician Assignment Section */}
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                Assign Field Technician (Optional)
              </label>
              <span className="text-[11px] text-slate-400">Can also be assigned later from desk</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <select
                  value={assignedToUserId}
                  onChange={(e) => setAssignedToUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-blue-500"
                >
                  <option value="">-- Leave in Unassigned Triage Queue --</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <input
                  type="text"
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  placeholder="Instructions for technician (e.g. bring clamp meter)..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 rounded-xl shadow-md shadow-amber-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Register & Dispatch Ticket</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
