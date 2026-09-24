import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  FileCheck,
  Layers,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { formatToIST } from '../../shared/timezone';
import { Lead, User, LeadDocumentChecklist, RuleEvaluationResult } from '../../shared/types';

interface ECPDocumentWorkspaceProps {
  leadId: string;
  lead: Lead;
  currentUser: User;
  onRefreshLead: () => void;
}

export const ECPDocumentWorkspace: React.FC<ECPDocumentWorkspaceProps> = ({
  leadId,
  lead,
  currentUser,
  onRefreshLead,
}) => {
  const [checklist, setChecklist] = useState<LeadDocumentChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingDefId, setUploadingDefId] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Hidden file inputs mapped by definition id
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchChecklist = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<{ checklist: LeadDocumentChecklist }>(
        `/api/documents/leads/${leadId}`
      );
      setChecklist(res.checklist);
    } catch (err: any) {
      console.error('Failed to load document checklist:', err);
      setError(err.message || 'Failed to load document checklist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklist();
  }, [leadId]);

  const handleFileUpload = async (definitionId: string, ruleId: string, file: File) => {
    try {
      setUploadingDefId(definitionId);
      setError(null);
      setSuccessBanner(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_definition_id', definitionId);
      if (ruleId) {
        formData.append('rule_id', ruleId);
      }

      const res = await apiRequest<{
        success: boolean;
        handed_off: boolean;
        checklist: LeadDocumentChecklist;
      }>(`/api/documents/leads/${leadId}/upload`, {
        method: 'POST',
        body: formData,
      });

      setChecklist(res.checklist);

      if (res.handed_off) {
        setSuccessBanner(
          'All document requirements satisfied! Lead has been automatically handed off to Registration 1.'
        );
        onRefreshLead();
      } else {
        setSuccessBanner('Document uploaded and verified successfully.');
      }
    } catch (err: any) {
      console.error('File upload failed:', err);
      setError(err.message || 'Failed to upload document.');
    } finally {
      setUploadingDefId(null);
      // Reset input value
      if (fileInputRefs.current[definitionId]) {
        fileInputRefs.current[definitionId]!.value = '';
      }
    }
  };

  const handleDeleteDocument = async (docId: string, docName: string) => {
    if (!window.confirm(`Are you sure you want to remove "${docName}"?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccessBanner(null);

      const res = await apiRequest<{ success: boolean; checklist: LeadDocumentChecklist }>(
        `/api/documents/leads/${leadId}/${docId}`,
        {
          method: 'DELETE',
        }
      );

      setChecklist(res.checklist);
      setSuccessBanner(`Document "${docName}" removed.`);
      onRefreshLead();
    } catch (err: any) {
      console.error('Failed to remove document:', err);
      setError(err.message || 'Failed to remove document.');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading && !checklist) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
        <span className="text-sm font-medium">Evaluating ECP document requirements...</span>
      </div>
    );
  }

  const isHandedOff =
    lead.current_team === 'REGISTRATION_1' ||
    lead.current_team === 'REGISTRATION_TEAM' ||
    lead.documentation_status === 'COMPLETED';

  const inDocumentationStage =
    lead.status === 'QUALIFIED' && lead.current_team === 'LEAD';

  return (
    <div className="space-y-6 text-slate-900">
      {/* Stage Status Header Banner */}
      <div
        className={`p-5 rounded-2xl border ${
          isHandedOff
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : inDocumentationStage
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {isHandedOff ? (
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
            ) : inDocumentationStage ? (
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <FileCheck className="w-6 h-6" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                <Layers className="w-6 h-6" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">
                  {isHandedOff
                    ? 'Registration 1 Handoff Completed'
                    : inDocumentationStage
                    ? 'ECP Documentation Gateway (Lead Team Responsibility)'
                    : 'Pre-Qualification Document Checklist'}
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isHandedOff
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : inDocumentationStage
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {checklist?.stage_message || 'In Progress'}
                </span>
              </div>

              <p className="text-xs text-slate-600 mt-1">
                {isHandedOff
                  ? 'All required ECP documentation has been verified and completed. The Lead is currently active under Registration 1.'
                  : inDocumentationStage
                  ? 'The Lead Team is responsible for completing required documents. Once satisfied, the lead will automatically transition to Registration 1.'
                  : 'Document requirements for this customer will activate upon qualification (YES). You may pre-upload documents below.'}
              </p>
            </div>
          </div>

          {/* Quick Metrics Pill */}
          {checklist && (
            <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-xs flex-shrink-0">
              <div className="text-center pr-3 border-r border-slate-200">
                <div className="text-xs text-slate-500 uppercase font-semibold">Rules</div>
                <div className="text-lg font-black text-slate-900">
                  {checklist.satisfied_rules_count} / {checklist.total_applicable_rules}
                </div>
              </div>

              <div className="text-center pl-1">
                <div className="text-xs text-slate-500 uppercase font-semibold">Gate Status</div>
                <div
                  className={`text-xs font-bold flex items-center gap-1 ${
                    checklist.is_gate_satisfied ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {checklist.is_gate_satisfied ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ready / Handoff</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      <span>{checklist.pending_rules_count} Pending</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {checklist && checklist.total_applicable_rules > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-200">
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  checklist.is_gate_satisfied ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{
                  width: `${Math.round(
                    (checklist.satisfied_rules_count / checklist.total_applicable_rules) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {successBanner && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Requirement Rules Evaluation Checklist */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-500" />
            <span>Document Requirement Rules</span>
          </h4>

          <button
            onClick={fetchChecklist}
            disabled={loading}
            className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Checklist</span>
          </button>
        </div>

        {checklist?.rules.length === 0 ? (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center text-slate-500 text-sm">
            No document requirement rules are configured for {lead.customer_type} projects in the Document Master.
          </div>
        ) : (
          checklist?.rules.map((rule: RuleEvaluationResult) => {
            const isSatisfied = rule.is_satisfied;
            const doesApply = rule.applies;

            return (
              <div
                key={rule.rule_id}
                className={`p-4 rounded-2xl border transition-all ${
                  !doesApply
                    ? 'bg-slate-50/50 border-slate-200 opacity-60'
                    : isSatisfied
                    ? 'bg-emerald-50/30 border-emerald-200'
                    : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                {/* Rule Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-start sm:items-center gap-2.5">
                    {isSatisfied ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                    ) : (
                      <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                    )}

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{rule.rule_name}</span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            rule.requirement_type === 'INDIVIDUAL'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : rule.requirement_type === 'ALL_REQUIRED'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {rule.requirement_type.replace('_', ' ')}
                        </span>

                        {rule.condition_type !== 'ALWAYS' && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-amber-800 border border-amber-200">
                            Condition: {rule.condition_type}
                          </span>
                        )}
                      </div>

                      {rule.condition_explanation && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {rule.condition_explanation}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                        isSatisfied
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {isSatisfied ? 'Requirement Met' : 'Pending Upload'}
                    </span>
                  </div>
                </div>

                {/* Document Items attached to this rule */}
                <div className="mt-3 space-y-2.5">
                  {rule.required_items.map((item) => {
                    const isUploadingThis = uploadingDefId === item.definition_id;
                    const hasDocs = item.uploaded_documents && item.uploaded_documents.length > 0;

                    return (
                      <div
                        key={item.definition_id}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <FileText
                            className={`w-5 h-5 mt-0.5 sm:mt-0 ${
                              hasDocs ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{item.name}</span>
                              <span className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                {item.code}
                              </span>
                            </div>

                            {hasDocs ? (
                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 mt-1">
                                {item.uploaded_documents.map((doc) => (
                                  <span key={doc.id} className="text-emerald-700">
                                    ✓ {doc.original_name} ({formatFileSize(doc.file_size)}) • uploaded by{' '}
                                    {doc.uploader_name} on {formatToIST(doc.uploaded_at)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                No document uploaded yet.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions for this item */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {/* If already uploaded, view button */}
                          {hasDocs && (
                            <div className="flex items-center gap-2">
                              {item.uploaded_documents.map((doc) => (
                                <div key={doc.id} className="flex items-center gap-1.5">
                                  <a
                                    href={`/api/documents/leads/${leadId}/${doc.id}/file`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-200 transition-colors shadow-xs"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>View File</span>
                                  </a>

                                  {checklist?.can_delete && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteDocument(doc.id, doc.original_name)}
                                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs border border-rose-200 transition-colors"
                                      title="Remove Document"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Upload control (if allowed) */}
                          {checklist?.can_upload && (
                            <div>
                              <input
                                type="file"
                                ref={(el) => {
                                  fileInputRefs.current[item.definition_id] = el;
                                }}
                                className="hidden"
                                accept=".pdf,image/*,.doc,.docx"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleFileUpload(item.definition_id, rule.rule_id, file);
                                  }
                                }}
                              />

                              <button
                                type="button"
                                disabled={isUploadingThis}
                                onClick={() => fileInputRefs.current[item.definition_id]?.click()}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs ${
                                  hasDocs
                                    ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                                    : 'bg-amber-500 hover:bg-amber-600 text-white'
                                }`}
                              >
                                {isUploadingThis ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Uploading...</span>
                                  </>
                                ) : (
                                  <>
                                    <UploadCloud className="w-3.5 h-3.5" />
                                    <span>{hasDocs ? 'Replace / Re-upload' : 'Upload Document'}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Uploaded Documents Repository Audit Trail */}
      <div className="mt-6 pt-4 border-t border-slate-200">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Document Audit Repository ({checklist?.uploaded_documents.length || 0} Total Uploads)
        </h4>

        {checklist?.uploaded_documents.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No files recorded in repository.</p>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
            {checklist?.uploaded_documents.map((doc) => (
              <div key={doc.id} className="p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <FileCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-900">{doc.original_name}</span>
                    <span className="text-slate-500 ml-2">
                      ({doc.document_name} • {formatFileSize(doc.file_size)})
                    </span>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Uploaded by {doc.uploader_name} on {formatToIST(doc.uploaded_at)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`/api/documents/leads/${leadId}/${doc.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded text-xs flex items-center gap-1 font-medium border border-slate-200 transition-colors shadow-xs"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Download</span>
                  </a>

                  {checklist.can_delete && (
                    <button
                      type="button"
                      onClick={() => handleDeleteDocument(doc.id, doc.original_name)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
