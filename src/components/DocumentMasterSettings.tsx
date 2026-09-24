import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Layers,
  Check,
  X,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  RefreshCw,
  FolderPlus,
  Trash2,
  Tag,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  DocumentDefinition,
  DocumentRequirementRule,
  DocumentRequirementType,
  DocumentConditionType,
  User,
} from '../../shared/types';

export const DocumentMasterSettings: React.FC<{ currentUser?: User }> = ({ currentUser }) => {
  const isOwner = !currentUser || currentUser.role === 'OWNER';
  const [subTab, setSubTab] = useState<'rules' | 'definitions'>('rules');
  const [definitions, setDefinitions] = useState<DocumentDefinition[]>([]);
  const [rules, setRules] = useState<DocumentRequirementRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Definition Modal
  const [showAddDef, setShowAddDef] = useState(false);
  const [newDefCode, setNewDefCode] = useState('');
  const [newDefName, setNewDefName] = useState('');
  const [newDefDesc, setNewDefDesc] = useState('');
  const [newDefCustomerType, setNewDefCustomerType] = useState<'B2C' | 'B2B' | 'BOTH'>('B2C');

  // New Rule Modal
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleDesc, setNewRuleDesc] = useState('');
  const [newRuleCustomerType, setNewRuleCustomerType] = useState<'B2C' | 'B2B' | 'BOTH'>('B2C');
  const [newRuleReqType, setNewRuleReqType] = useState<DocumentRequirementType>('INDIVIDUAL');
  const [newRuleCondType, setNewRuleCondType] = useState<DocumentConditionType>('ALWAYS');
  const [newRuleFieldKey, setNewRuleFieldKey] = useState('');
  const [newRuleExpectedVal, setNewRuleExpectedVal] = useState('');
  const [selectedDefIds, setSelectedDefIds] = useState<string[]>([]);
  const [newRuleOrder, setNewRuleOrder] = useState<number>(0);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [defsRes, rulesRes] = await Promise.all([
        apiRequest<{ definitions: DocumentDefinition[] }>('/api/documents/definitions'),
        apiRequest<{ rules: DocumentRequirementRule[] }>('/api/documents/rules'),
      ]);
      setDefinitions(defsRes.definitions || []);
      setRules(rulesRes.rules || []);
    } catch (err: any) {
      console.error('Failed to load document master:', err);
      setError(err.message || 'Failed to load document settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateDefinition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDefCode || !newDefName) {
      setError('Document Code and Name are required.');
      return;
    }

    try {
      setError(null);
      await apiRequest('/api/documents/definitions', {
        method: 'POST',
        body: JSON.stringify({
          code: newDefCode,
          name: newDefName,
          description: newDefDesc,
          customer_type: newDefCustomerType,
        }),
      });

      setSuccessMsg(`Document definition "${newDefName}" created.`);
      setShowAddDef(false);
      setNewDefCode('');
      setNewDefName('');
      setNewDefDesc('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create document definition.');
    }
  };

  const handleToggleDefActive = async (def: DocumentDefinition) => {
    try {
      setError(null);
      await apiRequest(`/api/documents/definitions/${def.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !def.active }),
      });
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update document definition.');
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName) {
      setError('Rule Name is required.');
      return;
    }
    if (selectedDefIds.length === 0) {
      setError('Please select at least one document definition for this rule.');
      return;
    }
    if (newRuleReqType === 'INDIVIDUAL' && selectedDefIds.length > 1) {
      setError('An INDIVIDUAL requirement rule must link to exactly 1 document definition.');
      return;
    }

    try {
      setError(null);
      await apiRequest('/api/documents/rules', {
        method: 'POST',
        body: JSON.stringify({
          rule_name: newRuleName,
          description: newRuleDesc,
          customer_type: newRuleCustomerType,
          requirement_type: newRuleReqType,
          condition_type: newRuleCondType,
          condition_field_key: newRuleCondType === 'CUSTOM_FIELD_EQUALS' ? newRuleFieldKey : null,
          condition_expected_value:
            newRuleCondType === 'CUSTOM_FIELD_EQUALS' ? newRuleExpectedVal : null,
          document_definition_ids: selectedDefIds,
          display_order: newRuleOrder,
        }),
      });

      setSuccessMsg(`Requirement rule "${newRuleName}" created successfully.`);
      setShowAddRule(false);
      setNewRuleName('');
      setNewRuleDesc('');
      setSelectedDefIds([]);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create requirement rule.');
    }
  };

  const handleToggleRuleActive = async (rule: DocumentRequirementRule) => {
    try {
      setError(null);
      await apiRequest(`/api/documents/rules/${rule.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !rule.active }),
      });
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update requirement rule.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Sub tabs and Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('rules')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
              subTab === 'rules'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Requirement Rules ({rules.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('definitions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
              subTab === 'definitions'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Document Definitions ({definitions.length})</span>
          </button>
        </div>

        <div>
          {isOwner && (
            subTab === 'rules' ? (
              <button
                type="button"
                onClick={() => setShowAddRule(true)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Create Rule</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddDef(true)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Definition</span>
              </button>
            )
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2 shadow-xs">
          <Check className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* SUBTAB 1: REQUIREMENT RULES */}
      {subTab === 'rules' && (
        <div className="space-y-3.5">
          <p className="text-xs text-slate-500">
            Define mandatory and conditional document gates for customer types. Rules support{' '}
            <strong className="text-slate-800">Individual</strong>,{' '}
            <strong className="text-slate-800">All Required</strong>, and{' '}
            <strong className="text-slate-800">Any One Required</strong> satisfaction semantics.
          </p>

          <div className="space-y-3">
            {rules.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl">
                No requirement rules configured yet. Click "Create Rule" to define document requirements.
              </div>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs hover:border-slate-300 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{rule.rule_name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                        {rule.customer_type}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          rule.requirement_type === 'INDIVIDUAL'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : rule.requirement_type === 'ALL_REQUIRED'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {rule.requirement_type}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        Condition: {rule.condition_type}
                      </span>
                    </div>

                    {rule.description && (
                      <p className="text-xs text-slate-600">{rule.description}</p>
                    )}

                    {/* Linked Document Definitions */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-500 font-medium">Linked Docs:</span>
                      {rule.items && rule.items.length > 0 ? (
                        rule.items.map((item) => (
                          <span
                            key={item.id}
                            className="text-[11px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200 font-medium"
                          >
                            {item.document_name} ({item.document_code})
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-rose-500 italic">No documents attached</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {isOwner ? (
                      <button
                        type="button"
                        onClick={() => handleToggleRuleActive(rule)}
                        className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900"
                      >
                        {rule.active ? (
                          <>
                            <ToggleRight className="w-6 h-6 text-emerald-600" />
                            <span className="text-emerald-700 font-bold">Active</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-6 h-6 text-slate-400" />
                            <span className="text-slate-500">Inactive</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Read-only</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: DOCUMENT DEFINITIONS */}
      {subTab === 'definitions' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Configure standardized document types that can be attached to requirement rules.
          </p>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Document Name</th>
                  <th className="px-4 py-3">Customer Type</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {definitions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No document definitions found. Click "Add Definition" to register new documents.
                    </td>
                  </tr>
                ) : (
                  definitions.map((def) => (
                    <tr key={def.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-700">
                        <span className="bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px]">
                          {def.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-medium">
                        <div className="font-semibold text-slate-900">{def.name}</div>
                        {def.description && (
                          <div className="text-[11px] text-slate-500">{def.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200 text-[11px]">
                          {def.customer_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            def.active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {def.active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isOwner ? (
                          <button
                            type="button"
                            onClick={() => handleToggleDefActive(def)}
                            className="text-slate-400 hover:text-slate-700 p-1"
                          >
                            {def.active ? (
                              <ToggleRight className="w-5 h-5 text-emerald-600 inline" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-slate-400 inline" />
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Read-only</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE RULE MODAL */}
      {showAddRule && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <span>Create Requirement Rule</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddRule(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mandatory Consumer Electricity Bill"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Guidance for the lead team..."
                  value={newRuleDesc}
                  onChange={(e) => setNewRuleDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Customer Type *</label>
                  <select
                    value={newRuleCustomerType}
                    onChange={(e) => setNewRuleCustomerType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="B2C">B2C</option>
                    <option value="B2B">B2B</option>
                    <option value="BOTH">BOTH</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Requirement Type *
                  </label>
                  <select
                    value={newRuleReqType}
                    onChange={(e) => setNewRuleReqType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="INDIVIDUAL">INDIVIDUAL (Single Document)</option>
                    <option value="ALL_REQUIRED">ALL REQUIRED (All Selected Docs)</option>
                    <option value="ANY_ONE_REQUIRED">ANY ONE REQUIRED (Any 1 of Selected)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Condition *</label>
                  <select
                    value={newRuleCondType}
                    onChange={(e) => setNewRuleCondType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="ALWAYS">ALWAYS (Unconditional)</option>
                    <option value="IF_LOAN_REQUIRED">IF_LOAN_REQUIRED (When Solar Loan = YES)</option>
                    <option value="IF_CREDIT_EXTENDED">
                      IF_CREDIT_EXTENDED (When Credit = YES)
                    </option>
                    <option value="CUSTOM_FIELD_EQUALS">CUSTOM_FIELD_EQUALS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Display Order</label>
                  <input
                    type="number"
                    value={newRuleOrder}
                    onChange={(e) => setNewRuleOrder(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              {newRuleCondType === 'CUSTOM_FIELD_EQUALS' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Field Key</label>
                    <input
                      type="text"
                      placeholder="e.g. roof_type"
                      value={newRuleFieldKey}
                      onChange={(e) => setNewRuleFieldKey(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Expected Value</label>
                    <input
                      type="text"
                      placeholder="e.g. Commercial RCC"
                      value={newRuleExpectedVal}
                      onChange={(e) => setNewRuleExpectedVal(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                    />
                  </div>
                </div>
              )}

              {/* Document Definition Selection */}
              <div>
                <label className="block text-slate-700 font-semibold mb-2">
                  Attach Document Definitions *
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {definitions
                    .filter(
                      (d) =>
                        d.active &&
                        (newRuleCustomerType === 'BOTH' ||
                          d.customer_type === 'BOTH' ||
                          d.customer_type === newRuleCustomerType)
                    )
                    .map((def) => {
                      const isChecked = selectedDefIds.includes(def.id);
                      return (
                        <label
                          key={def.id}
                          className="flex items-center gap-2 text-slate-800 cursor-pointer hover:text-blue-700"
                        >
                          <input
                            type={newRuleReqType === 'INDIVIDUAL' ? 'radio' : 'checkbox'}
                            name="rule_definitions"
                            checked={isChecked}
                            onChange={(e) => {
                              if (newRuleReqType === 'INDIVIDUAL') {
                                setSelectedDefIds([def.id]);
                              } else {
                                if (e.target.checked) {
                                  setSelectedDefIds((prev) => [...prev, def.id]);
                                } else {
                                  setSelectedDefIds((prev) => prev.filter((id) => id !== def.id));
                                }
                              }
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-mono text-blue-700 text-[11px] font-bold">{def.code}</span>
                          <span className="text-slate-700">— {def.name}</span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddRule(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors"
                >
                  Create Requirement Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD DEFINITION MODAL */}
      {showAddDef && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span>Add Document Definition</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddDef(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDefinition} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Unique Document Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ELEC_BILL, AADHAAR_CARD"
                  value={newDefCode}
                  onChange={(e) => setNewDefCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Document Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Latest Electricity Bill"
                  value={newDefName}
                  onChange={(e) => setNewDefName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Customer Type *</label>
                <select
                  value={newDefCustomerType}
                  onChange={(e) => setNewDefCustomerType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="B2C">B2C</option>
                  <option value="B2B">B2B</option>
                  <option value="BOTH">BOTH</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Instructions for uploader..."
                  value={newDefDesc}
                  onChange={(e) => setNewDefDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddDef(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors"
                >
                  Save Definition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
