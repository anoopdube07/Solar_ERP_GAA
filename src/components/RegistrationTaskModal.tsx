import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Zap,
  Hammer,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  Building2,
  User as UserIcon,
  Phone,
  MapPin,
  Calendar,
  Lock,
  Camera,
  Eye,
  Check,
  Image as ImageIcon,
  RotateCcw,
  Send,
  CheckSquare,
  Square,
  Maximize2,
  Minimize2,
  ArrowLeft,
} from 'lucide-react';
import {
  RegistrationLeadItem,
  RegistrationTask,
  RegistrationStage,
  User,
} from '../../shared/types';
import { apiRequest, formatINR } from '../lib/api';

const MANDATORY_PHOTO_CATEGORIES = [
  { category: 'INVERTER_SERIAL', label: 'Inverter Serial No.', desc: 'Barcode / S/N plate' },
  { category: 'INVERTER_WITH_CUSTOMER', label: 'Inverter + Customer', desc: 'Customer alongside inverter' },
  { category: 'PANEL_WITH_CUSTOMER', label: 'Panel + Customer', desc: 'Customer alongside solar modules' },
  { category: 'LIGHTNING_ARRESTER', label: 'Lightning Arrester', desc: 'Surge arrestor on terrace' },
  { category: 'EARTHING_PIT', label: 'Earthing Pit', desc: 'Grounding pit chamber' },
];

interface RegistrationTaskModalProps {
  leadItem: RegistrationLeadItem;
  currentUser?: User;
  onClose: () => void;
  onTaskCompleted?: () => void;
  onOpenLeadDetails?: (leadId: string) => void;
}

export const RegistrationTaskModal: React.FC<RegistrationTaskModalProps> = ({
  leadItem,
  currentUser,
  onClose,
  onTaskCompleted,
  onOpenLeadDetails,
}) => {
  const [tasks, setTasks] = useState<RegistrationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStageTab, setActiveStageTab] = useState<RegistrationStage>(leadItem.stage);
  const [completingTaskCode, setCompletingTaskCode] = useState<string | null>(null);
  const [taskRemarks, setTaskRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [installationDetails, setInstallationDetails] = useState<{
    record: any;
    photos: any[];
    photos_count: number;
    has_all_photos: boolean;
    is_completed: boolean;
  } | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; label: string } | null>(null);

  // Send Back to Installation State
  const [showSendBackForm, setShowSendBackForm] = useState(false);
  const [sendBackTarget, setSendBackTarget] = useState<'INSTALLATION_MANAGER' | 'INSTALLATION_MEMBER'>('INSTALLATION_MANAGER');
  const [sendBackRemarks, setSendBackRemarks] = useState('');
  const [selectedIssuePhotos, setSelectedIssuePhotos] = useState<string[]>([]);
  const [sendingBack, setSendingBack] = useState(false);
  const [sendBackSuccessMsg, setSendBackSuccessMsg] = useState<string | null>(null);

  // Loan required interactive toggle state
  const [loanRequiredState, setLoanRequiredState] = useState<'YES' | 'NO'>(
    leadItem.customer_type === 'B2C' && (leadItem.b2c_loan_required === 'YES' || leadItem.financing_required)
      ? 'YES'
      : 'NO'
  );
  const [updatingLoan, setUpdatingLoan] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(true);

  // Fetch tasks and installation details for lead
  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tasksRes, instRes] = await Promise.all([
        apiRequest<{ tasks: RegistrationTask[] }>(`/api/registration/leads/${leadItem.id}/tasks`),
        apiRequest<{ details: any }>(`/api/installation/leads/${leadItem.id}/details`).catch(() => ({
          details: null,
        })),
      ]);
      setTasks(tasksRes.tasks || []);
      if (instRes.details) {
        setInstallationDetails(instRes.details);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load tasks for this project.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [leadItem.id]);

  const handleCompleteTask = async (task: RegistrationTask) => {
    if (!task.is_actionable) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/api/registration/leads/${leadItem.id}/tasks/${task.task_code}/complete`, {
        method: 'POST',
        body: JSON.stringify({ remarks: taskRemarks }),
      });
      setCompletingTaskCode(null);
      setTaskRemarks('');
      await fetchTasks();
      if (onTaskCompleted) {
        onTaskCompleted();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete task.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle toggling loan required
  const handleToggleLoan = async () => {
    if (leadItem.customer_type !== 'B2C' || updatingLoan) return;
    const nextVal: 'YES' | 'NO' = loanRequiredState === 'YES' ? 'NO' : 'YES';
    setUpdatingLoan(true);
    setError(null);
    try {
      await apiRequest(`/api/leads/${leadItem.id}/loan-required`, {
        method: 'PATCH',
        body: JSON.stringify({ b2c_loan_required: nextVal }),
      });
      setLoanRequiredState(nextVal);
      leadItem.b2c_loan_required = nextVal;
      leadItem.financing_required = nextVal === 'YES';
      await fetchTasks();
      onTaskCompleted?.();
    } catch (err: any) {
      setError(err.message || 'Failed to update loan requirement.');
    } finally {
      setUpdatingLoan(false);
    }
  };

  // Handle Send Back Installation Photos
  const handleSendBackPhotos = async () => {
    if (!sendBackRemarks.trim()) {
      setError('Please provide specific remarks explaining what is wrong with the photos and what correction is needed.');
      return;
    }
    setSendingBack(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        `/api/registration/leads/${leadItem.id}/send-back-installation-photos`,
        {
          method: 'POST',
          body: JSON.stringify({
            target_role: sendBackTarget,
            remarks: sendBackRemarks.trim(),
            rejected_categories: selectedIssuePhotos,
          }),
        }
      );
      setSendBackSuccessMsg(res.message);
      setShowSendBackForm(false);
      setSendBackRemarks('');
      setSelectedIssuePhotos([]);
      await fetchTasks();
      onTaskCompleted?.();
    } catch (err: any) {
      setError(err.message || 'Failed to send back project.');
    } finally {
      setSendingBack(false);
    }
  };

  // Group tasks by stage
  const reg1Tasks = tasks.filter((t) => t.stage === 'REGISTRATION_1');
  const netMeteringTasks = tasks.filter((t) => t.stage === 'NET_METERING');
  const reg2Tasks = tasks.filter((t) => t.stage === 'REGISTRATION_2');

  const getStageStats = (stageTasks: RegistrationTask[]) => {
    const applicable = stageTasks.filter((t) => t.status !== 'NOT_APPLICABLE');
    const completed = applicable.filter((t) => t.status === 'COMPLETED');
    const isComplete = applicable.length > 0 && completed.length === applicable.length;
    return {
      total: applicable.length,
      completed: completed.length,
      isComplete,
    };
  };

  const reg1Stats = getStageStats(reg1Tasks);
  const netStats = getStageStats(netMeteringTasks);
  const reg2Stats = getStageStats(reg2Tasks);

  // B2B projects have NO option for Loan; financing/loan tasks are strictly B2C only
  const isLoanYes =
    leadItem.customer_type === 'B2C' &&
    (leadItem.b2c_loan_required === 'YES' || leadItem.financing_required === true);

  const displayedTasks =
    activeStageTab === 'REGISTRATION_1'
      ? reg1Tasks
      : activeStageTab === 'NET_METERING'
      ? netMeteringTasks
      : reg2Tasks.filter((t) => {
          if (t.task_code === 'BANK_FINAL_PAYMENT' || t.is_financing_dependent) {
            return isLoanYes && t.status !== 'NOT_APPLICABLE';
          }
          return true;
        });

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs ${
        isFullScreen ? 'p-0' : 'p-3 sm:p-4 overflow-y-auto'
      }`}
    >
      <div
        className={`bg-white shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-all ${
          isFullScreen
            ? 'w-full h-full rounded-none'
            : 'rounded-2xl w-full max-w-5xl max-h-[92vh]'
        }`}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Quick Back button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 -ml-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors flex items-center gap-1 text-xs font-semibold"
              title="Return to Registration Workspace"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
              <span className="hidden md:inline">Back</span>
            </button>

            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="text-sm sm:text-lg font-bold text-slate-900 truncate max-w-[180px] sm:max-w-md">
                  {leadItem.customer_name}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                  LD-{leadItem.lead_number}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                  {leadItem.customer_type}
                </span>
                {leadItem.is_delayed && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 shrink-0">
                    <AlertTriangle className="w-3 h-3" /> Overdue ({leadItem.days_in_stage}d)
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] sm:text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> {leadItem.mobile_number}
                </span>
                {leadItem.location && (
                  <span className="hidden xs:flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> {leadItem.location}
                  </span>
                )}
                <span className="font-semibold text-slate-700">
                  Value: {formatINR(leadItem.total_project_value)}
                </span>
                {leadItem.customer_type === 'B2C' ? (
                  <span className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                    <span className="text-slate-600 font-medium">Loan:</span>
                    <button
                      type="button"
                      disabled={updatingLoan}
                      onClick={handleToggleLoan}
                      className={`font-bold px-1.5 sm:px-2 py-0.5 rounded text-[10px] border transition-colors flex items-center gap-1 cursor-pointer ${
                        loanRequiredState === 'YES'
                          ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200'
                          : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                      }`}
                      title="Click to toggle Bank Solar Loan requirement (YES/NO)"
                    >
                      <span>{loanRequiredState}</span>
                      <span className="text-[9px] font-normal text-slate-500 underline ml-0.5">
                        {updatingLoan ? 'Saving...' : 'Change'}
                      </span>
                    </button>
                  </span>
                ) : (
                  <span className="text-slate-400 text-[11px] hidden sm:inline">B2B Direct</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {onOpenLeadDetails && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLeadDetails(leadItem.id);
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors shadow-2xs"
                title="View full project details & quotation"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Full ECP Details
              </button>
            )}

            {/* Toggle Full Screen / Contained view */}
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
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stage Stepper / Progress Bar */}
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-slate-50/80 border-b border-slate-200 overflow-x-auto no-scrollbar">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3 min-w-[340px]">
            {/* Step 1: Registration 1 */}
            <button
              type="button"
              onClick={() => setActiveStageTab('REGISTRATION_1')}
              className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all relative ${
                activeStageTab === 'REGISTRATION_1'
                  ? 'bg-white border-indigo-500 shadow-sm ring-1 ring-indigo-500'
                  : 'bg-white/70 border-slate-200 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {reg1Stats.isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                      1
                    </div>
                  )}
                  <span className="text-xs font-bold text-slate-800 truncate">Reg 1</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500">
                  {reg1Stats.completed}/{reg1Stats.total}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate hidden xs:block">
                Consumer Request, CVA
              </p>
            </button>

            {/* Step 2: Net Metering */}
            <button
              type="button"
              onClick={() => setActiveStageTab('NET_METERING')}
              className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all relative ${
                activeStageTab === 'NET_METERING'
                  ? 'bg-white border-indigo-500 shadow-sm ring-1 ring-indigo-500'
                  : 'bg-white/70 border-slate-200 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {netStats.isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                      2
                    </div>
                  )}
                  <span className="text-xs font-bold text-slate-800 truncate">Net Meter</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500">
                  {netStats.completed}/{netStats.total}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate hidden xs:block">
                DCR, Approvals & Sync
              </p>
            </button>

            {/* Step 3: Registration 2 */}
            <button
              type="button"
              onClick={() => setActiveStageTab('REGISTRATION_2')}
              className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all relative ${
                activeStageTab === 'REGISTRATION_2'
                  ? 'bg-white border-indigo-500 shadow-sm ring-1 ring-indigo-500'
                  : 'bg-white/70 border-slate-200 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {reg2Stats.isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                      3
                    </div>
                  )}
                  <span className="text-xs font-bold text-slate-800 truncate">Reg 2</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500">
                  {reg2Stats.completed}/{reg2Stats.total}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate hidden xs:block">
                Asset & Completion
              </p>
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {sendBackSuccessMsg && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-semibold">{sendBackSuccessMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSendBackSuccessMsg(null)}
              className="text-amber-600 hover:text-amber-800 text-[11px] font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Task List Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Registration 2 Context Info */}
          {activeStageTab === 'REGISTRATION_2' && (
            <div className="p-3 rounded-xl border bg-slate-50 border-slate-200/90 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="text-slate-700">
                  Stage 3: Registration 2 &bull;{' '}
                  <strong className="text-slate-900">
                    Loan: {isLoanYes ? 'YES' : 'NO'}
                  </strong>
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                {isLoanYes
                  ? 'Showing 3 tasks (includes Bank Submission for Final Payment)'
                  : 'Direct Capex • Showing 2 tasks (Asset Creation & Completion Certificate)'}
              </span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs font-medium">Loading project task sequence...</p>
            </div>
          ) : displayedTasks.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">No tasks defined for this stage.</p>
            </div>
          ) : (
            displayedTasks.map((task, idx) => {
              const isNetMeteringClose = task.task_code === 'CLOSE_NET_METERING';
              const isInstallationOwned = task.owner_team === 'INSTALLATION';
              const isFinancingTask = task.is_financing_dependent;
              const isSelectedForComplete = completingTaskCode === task.task_code;
              const isPhotoTask = task.task_code === 'INSTALLATION_PHOTOS';

              return (
                <div
                  key={task.id}
                  className={`p-4 rounded-xl border transition-all ${
                    task.status === 'COMPLETED'
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : task.status === 'NOT_APPLICABLE'
                      ? 'bg-slate-50 border-slate-200 opacity-60'
                      : task.status === 'BLOCKED'
                      ? 'bg-slate-50/70 border-slate-200'
                      : 'bg-white border-indigo-200 shadow-xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {task.status === 'COMPLETED' ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : task.status === 'NOT_APPLICABLE' ? (
                          <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold">
                            N/A
                          </div>
                        ) : task.status === 'BLOCKED' ? (
                          <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                            <Lock className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                            {idx + 1}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">{task.task_name}</h4>

                          {/* Status Pill */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              task.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : task.status === 'NOT_APPLICABLE'
                                ? 'bg-slate-200 text-slate-600'
                                : task.status === 'BLOCKED'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {task.status === 'NOT_APPLICABLE'
                              ? 'NOT APPLICABLE'
                              : task.status}
                          </span>

                          {/* Financing dependent pill */}
                          {isFinancingTask && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              Financing Task (Loan)
                            </span>
                          )}

                          {/* Ownership pill */}
                          {isInstallationOwned ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                              <Hammer className="w-3 h-3 text-amber-600" /> Owned by Installation Team
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                              Registration Team
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 mt-1">{task.description}</p>

                        {/* Blocked explanation */}
                        {task.status === 'BLOCKED' && task.blocking_reason && (
                          <p className="text-[11px] text-amber-700 font-medium mt-1.5 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {task.blocking_reason}
                          </p>
                        )}

                        {/* Not Applicable explanation */}
                        {task.status === 'NOT_APPLICABLE' && (
                          <p className="text-[11px] text-slate-500 mt-1">
                            Project is marked Financing: NO. Loan submission is bypassed.
                          </p>
                        )}

                        {/* Completed Details */}
                        {task.status === 'COMPLETED' && (
                          <p className="text-[11px] text-emerald-700 font-medium mt-1">
                            Completed by {task.completed_by_name || 'Team Member'} on{' '}
                            {task.completed_at
                              ? new Date(task.completed_at).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Earlier'}
                            {task.remarks && ` • Remarks: "${task.remarks}"`}
                          </p>
                        )}

                        {/* Clear Notice for Net Metering Close */}
                        {isNetMeteringClose && task.status !== 'COMPLETED' && (
                          <div className="mt-2 p-2 rounded-lg bg-amber-50/80 border border-amber-200/90 text-amber-900 text-[11px] flex items-start gap-2">
                            <Hammer className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold">Installation Field Responsibility:</span>{' '}
                              Physical meter swap and DISCOM synchronization is completed on-site by the
                              Installation Crew. Once the meter is activated, the Installation team
                              closes this task to advance project to Registration 2 (Subsidies).
                            </div>
                          </div>
                        )}

                        {/* 5 Mandatory Installation Photos Display for INSTALLATION_PHOTOS task */}
                        {task.task_code === 'INSTALLATION_PHOTOS' && (
                          <div className="mt-3 p-3 rounded-xl bg-slate-50/90 border border-slate-200 space-y-2.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <div className="flex items-center gap-1.5">
                                <Camera className="w-3.5 h-3.5 text-indigo-600" />
                                <span className="text-xs font-bold text-slate-800">
                                  Physical Installation Photographs (5 Mandatory)
                                </span>
                              </div>
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  installationDetails?.has_all_photos
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {installationDetails?.photos_count || 0} of 5 Photos Uploaded by Field Crew
                              </span>
                            </div>

                            {installationDetails?.record?.inverter_serial_number && (
                              <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                                <span>
                                  Inverter Serial No:{' '}
                                  <strong className="font-mono text-slate-900">
                                    {installationDetails.record.inverter_serial_number}
                                  </strong>
                                </span>
                                {installationDetails.record.installed_by_name && (
                                  <span>
                                    Installed by: <strong>{installationDetails.record.installed_by_name}</strong>
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Grid of the 5 photo categories */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                              {MANDATORY_PHOTO_CATEGORIES.map((cat, catIdx) => {
                                const photo = installationDetails?.photos?.find(
                                  (p) => p.photo_category === cat.category
                                );
                                const photoUrl = photo ? `/api/installation/photos/${photo.id}` : null;

                                return (
                                  <div
                                    key={cat.category}
                                    className={`p-2 rounded-lg border text-center flex flex-col justify-between ${
                                      photo
                                        ? 'bg-white border-emerald-300 shadow-2xs'
                                        : 'bg-slate-100/70 border-dashed border-slate-300'
                                    }`}
                                  >
                                    <div className="aspect-square w-full rounded-md bg-slate-100 overflow-hidden relative group mb-1.5 border border-slate-200/60">
                                      {photoUrl ? (
                                        <>
                                          <img
                                            src={photoUrl}
                                            alt={cat.label}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                          />
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setPreviewPhoto({ url: photoUrl, label: cat.label })
                                            }
                                            className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                                            title="Click to view full photo"
                                          >
                                            <Eye className="w-5 h-5" />
                                          </button>
                                        </>
                                      ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center p-1 text-slate-400">
                                          <Camera className="w-5 h-5 mb-0.5" />
                                          <span className="text-[9px] font-medium text-slate-400">
                                            Awaiting Photo
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-800 truncate" title={cat.label}>
                                        {cat.label}
                                      </p>
                                      <span
                                        className={`text-[9px] block font-semibold ${
                                          photo ? 'text-emerald-700' : 'text-amber-700'
                                        }`}
                                      >
                                        {photo ? 'Verified' : 'Pending'}
                                      </span>
                                    </div>

                                    {/* Issue checkbox when in Send Back mode */}
                                    {showSendBackForm && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (selectedIssuePhotos.includes(cat.category)) {
                                            setSelectedIssuePhotos(selectedIssuePhotos.filter((c) => c !== cat.category));
                                          } else {
                                            setSelectedIssuePhotos([...selectedIssuePhotos, cat.category]);
                                          }
                                        }}
                                        className="mt-1.5 w-full flex items-center justify-center gap-1 text-[10px] font-bold py-0.5 rounded border border-slate-300 hover:bg-slate-100 cursor-pointer"
                                      >
                                        {selectedIssuePhotos.includes(cat.category) ? (
                                          <span className="text-rose-600 flex items-center gap-0.5">
                                            <CheckSquare className="w-3 h-3" /> Issue
                                          </span>
                                        ) : (
                                          <span className="text-slate-500 flex items-center gap-0.5">
                                            <Square className="w-3 h-3" /> Flag
                                          </span>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Status banner */}
                            {installationDetails?.record?.status === 'NEEDS_REVISION' ? (
                              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                  <span>Revision Requested from Installation Team</span>
                                </div>
                                <p className="text-[11px] text-amber-700 mt-1">
                                  {installationDetails.record.completion_remarks ||
                                    'Project was sent back for corrected photo uploads.'}
                                </p>
                              </div>
                            ) : installationDetails?.has_all_photos ? (
                              <p className="text-[11px] text-emerald-800 font-medium bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                                ✓ All 5 photos received from Installation Team. Registration team can now
                                verify details and proceed with Net Metering, or send back to Installation if any photo has errors.
                              </p>
                            ) : (
                              <p className="text-[11px] text-amber-800 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200">
                                ⏳ Waiting for Installation Team to upload all 5 photos before this task can be completed.
                              </p>
                            )}

                            {/* INLINE SEND-BACK TO INSTALLATION FORM */}
                            {showSendBackForm && (
                              <div className="mt-3 p-3.5 rounded-xl bg-amber-500/10 border-2 border-amber-400 text-slate-800 space-y-3 animate-in fade-in duration-150">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <RotateCcw className="w-4 h-4 text-amber-600" />
                                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                      Send Project Back for Photo Corrections
                                    </h5>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setShowSendBackForm(false)}
                                    className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* Target Selection: Manager vs Crew */}
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                                    Send Project Back To:
                                  </label>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <label
                                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors flex items-start gap-2 ${
                                        sendBackTarget === 'INSTALLATION_MANAGER'
                                          ? 'bg-amber-100/70 border-amber-500 ring-1 ring-amber-500'
                                          : 'bg-white border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name="sendBackTarget"
                                        value="INSTALLATION_MANAGER"
                                        checked={sendBackTarget === 'INSTALLATION_MANAGER'}
                                        onChange={() => setSendBackTarget('INSTALLATION_MANAGER')}
                                        className="mt-0.5 accent-amber-600"
                                      />
                                      <div>
                                        <div className="font-bold text-slate-900">Installation Team Manager</div>
                                        <div className="text-[10px] text-slate-500">
                                          Manager reviews photo error and reassigns or instructs technician.
                                        </div>
                                      </div>
                                    </label>

                                    <label
                                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors flex items-start gap-2 ${
                                        sendBackTarget === 'INSTALLATION_MEMBER'
                                          ? 'bg-amber-100/70 border-amber-500 ring-1 ring-amber-500'
                                          : 'bg-white border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name="sendBackTarget"
                                        value="INSTALLATION_MEMBER"
                                        checked={sendBackTarget === 'INSTALLATION_MEMBER'}
                                        onChange={() => setSendBackTarget('INSTALLATION_MEMBER')}
                                        className="mt-0.5 accent-amber-600"
                                      />
                                      <div>
                                        <div className="font-bold text-slate-900">Installation Field Crew</div>
                                        <div className="text-[10px] text-slate-500">
                                          Send directly back to field crew technician to retake photos.
                                        </div>
                                      </div>
                                    </label>
                                  </div>
                                </div>

                                {/* Common reason shortcuts */}
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Quick Reasons (Click to add to remarks):
                                  </label>
                                  <div className="flex flex-wrap gap-1.5">
                                    {[
                                      'Inverter Serial plate blurred/unreadable',
                                      'Customer face not visible in photo',
                                      'Customer not present with inverter',
                                      'Lightning arrester photo missing/unclear',
                                      'Earthing pit chamber not clearly open',
                                      'Incorrect rooftop angle / wrong project',
                                    ].map((preset) => (
                                      <button
                                        key={preset}
                                        type="button"
                                        onClick={() => {
                                          setSendBackRemarks((prev) =>
                                            prev ? `${prev}. ${preset}` : preset
                                          );
                                        }}
                                        className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white border border-slate-300 text-slate-700 hover:bg-amber-50 hover:border-amber-300 cursor-pointer"
                                      >
                                        + {preset}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* Detailed remarks input */}
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Defect Remarks &amp; Correction Instructions <span className="text-rose-500">*</span>
                                  </label>
                                  <textarea
                                    rows={2}
                                    value={sendBackRemarks}
                                    onChange={(e) => setSendBackRemarks(e.target.value)}
                                    placeholder="Specify exactly what needs to be retaken or corrected..."
                                    className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                  />
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setShowSendBackForm(false)}
                                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    disabled={sendingBack || !sendBackRemarks.trim()}
                                    onClick={handleSendBackPhotos}
                                    className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>
                                      {sendingBack
                                        ? 'Returning Project...'
                                        : `Confirm & Return to ${
                                            sendBackTarget === 'INSTALLATION_MANAGER'
                                              ? 'Installation Manager'
                                              : 'Field Crew'
                                          }`}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="shrink-0 flex items-center gap-2">
                      {/* Send Back Button for INSTALLATION_PHOTOS Task */}
                      {isPhotoTask &&
                        task.status !== 'COMPLETED' &&
                        (currentUser?.role === 'REGISTRATION' ||
                          currentUser?.role === 'OWNER' ||
                          currentUser?.role === 'MANAGER') && (
                          <button
                            type="button"
                            onClick={() => setShowSendBackForm(!showSendBackForm)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer ${
                              showSendBackForm
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                            title="Send back project to Installation Manager or Field Crew to correct photos"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                            <span>Send Back Project</span>
                          </button>
                        )}
                      {task.status === 'COMPLETED' ? (
                        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Done
                        </span>
                      ) : task.status === 'NOT_APPLICABLE' ? (
                        <span className="text-xs text-slate-400 font-medium">Bypassed</span>
                      ) : isInstallationOwned &&
                        currentUser?.role !== 'INSTALLATION_MANAGER' &&
                        currentUser?.role !== 'INSTALLATION_MEMBER' &&
                        currentUser?.role !== 'OWNER' ? (
                        <button
                          type="button"
                          disabled
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                          title="Only Installation Team or Owner can close physical meter installation"
                        >
                          Installation Owned
                        </button>
                      ) : task.is_actionable ? (
                        isSelectedForComplete ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={taskRemarks}
                              onChange={(e) => setTaskRemarks(e.target.value)}
                              placeholder="Remarks / Discom ref no..."
                              className="px-2.5 py-1 text-xs border border-indigo-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48"
                            />
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleCompleteTask(task)}
                              className="px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {submitting ? 'Saving...' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCompletingTaskCode(null);
                                setTaskRemarks('');
                              }}
                              className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 rounded-lg"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCompletingTaskCode(task.task_code)}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Complete Task
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed flex items-center gap-1"
                        >
                          <Lock className="w-3 h-3" /> Blocked
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Overall Progress:</span>
            <span className="font-bold text-slate-800">
              {leadItem.completed_tasks_count} of {leadItem.total_tasks_count} tasks completed
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox for inspecting installation photos */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs font-bold">{previewPhoto.label}</span>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="p-1 hover:bg-slate-800 rounded-lg"
              >
                <X className="w-4 h-4 text-slate-300" />
              </button>
            </div>
            <div className="p-2 bg-slate-950 flex items-center justify-center overflow-auto max-h-[75vh]">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.label}
                className="max-h-[70vh] w-auto rounded object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
