import React, { useState } from 'react';
import { X, Hammer, UserCheck, AlertCircle, CheckCircle, Shield } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { User } from '../../shared/types';

interface AssignInstallerModalProps {
  leadId: string;
  leadNumber: number;
  customerName: string;
  capacityKwp: number | null;
  currentInstallerId?: string | null;
  currentInstallerName?: string | null;
  users: User[];
  currentUser?: User;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignInstallerModal: React.FC<AssignInstallerModalProps> = ({
  leadId,
  leadNumber,
  customerName,
  capacityKwp,
  currentInstallerId,
  currentInstallerName,
  users,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [selectedInstallerId, setSelectedInstallerId] = useState(currentInstallerId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthorized = !currentUser || currentUser.role === 'INSTALLATION_MANAGER' || currentUser.role === 'OWNER';

  if (!isAuthorized) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-xs">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-900">Access Restricted</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Installation crew leads can only be assigned by the Installation Team Manager or System Owner on a strict need-to-know basis.
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

  // Filter only active installation team members & managers
  const installationStaff = users.filter(
    (u) => (u.role === 'INSTALLATION_MEMBER' || u.role === 'INSTALLATION_MANAGER') && u.active
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiRequest(`/api/leads/${leadId}/assign-installer`, {
        method: 'POST',
        body: JSON.stringify({
          assigned_installer_id: selectedInstallerId || null,
        }),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to assign installer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 shadow-xs">
              <Hammer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Assign Installation Specialist</h2>
              <p className="text-xs text-slate-500">ECP #{leadNumber} • {customerName}</p>
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
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Project Summary Banner */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 font-medium">Customer: </span>
              <span className="font-bold text-slate-900">{customerName}</span>
            </div>
            {capacityKwp && (
              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold border border-blue-200">
                {capacityKwp} kWp
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Current Assignment
            </label>
            <div className="p-2.5 rounded-xl border border-slate-200 bg-white text-xs flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-slate-400" />
              {currentInstallerName ? (
                <span className="font-semibold text-slate-800">{currentInstallerName}</span>
              ) : (
                <span className="text-amber-600 font-medium italic">Unassigned (Action Required)</span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Installation Crew Lead / Member
            </label>
            <select
              value={selectedInstallerId}
              onChange={(e) => setSelectedInstallerId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-amber-500 shadow-xs"
            >
              <option value="">-- Leave Unassigned --</option>
              {installationStaff.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name} (@{staff.username}) - {staff.role === 'INSTALLATION_MANAGER' ? 'Manager' : 'Crew Lead'}
                </option>
              ))}
            </select>
            {installationStaff.length === 0 && (
              <p className="text-[11px] text-amber-700 mt-1">
                No active Installation staff found.
              </p>
            )}
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
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? (
                <span>Assigning...</span>
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Confirm Assignment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
