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
  Pencil,
  AlertTriangle,
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

  // Status Filters (Default Active)
  const [defStatusFilter, setDefStatusFilter] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ACTIVE');
  const [ruleStatusFilter, setRuleStatusFilter] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ACTIVE');

  // New Definition Modal
  const [showAddDef, setShowAddDef] = useState(false);
  const [newDefCode, setNewDefCode] = useState('');
  const [newDefName, setNewDefName] = useState('');
  const [newDefDesc, setNewDefDesc] = useState('');
  const [newDefCustomerType, setNewDefCustomerType] = useState<'B2C' | 'B2B' | 'BOTH'>('B2C');

  // Edit Definition State
  const [editingDef, setEditingDef] = useState<DocumentDefinition | null>(null);
  const [editDefCode, setEditDefCode] = useState('');
  const [editDefName, setEditDefName] = useState('');
  const [editDefDesc, setEditDefDesc] = useState('');
  const [editDefCustomerType, setEditDefCustomerType] = useState<'B2C' | 'B2B' | 'BOTH'>('B2C');
  const [editDefActive, setEditDefActive] = useState(true);

  // Delete Definition State
  const [deletingDef, setDeletingDef] = useState<DocumentDefinition | null>(null);

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

  // Edit Rule State
  const [editingRule, setEditingRule] = useState<DocumentRequirementRule | null>(null);
  const [editRuleName, setEditRuleName] = useState('');
  const [editRuleDesc, setEditRuleDesc] = useState('');
  const [editRuleCustomerType, setEditRuleCustomerType] = useState<'B2C' | 'B2B' | 'BOTH'>('B2C');
  const [editRuleReqType, setEditRuleReqType] = useState<DocumentRequirementType>('INDIVIDUAL');
  const [editRuleCondType, setEditRuleCondType] = useState<DocumentConditionType>('ALWAYS');
  const [editRuleFieldKey, setEditRuleFieldKey] = useState('');
  const [editRuleExpectedVal, setEditRuleExpectedVal] = useState('');
  const [editSelectedDefIds, setEditSelectedDefIds] = useState<string[]>([]);
  const [editRuleOrder, setEditRuleOrder] = useState<number>(0);
  const [editRuleActive, setEditRuleActive] = useState(true);

  // Delete Rule State
  const [deletingRule, setDeletingRule] = useState<DocumentRequirementRule | null>(null);

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

  // Handlers for Document Definition
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

  const startEditDef = (def: DocumentDefinition) => {
    setEditingDef(def);
    setEditDefCode(def.code);
    setEditDefName(def.name);
    setEditDefDesc(def.description || '');
    setEditDefCustomerType(def.customer_type);
    setEditDefActive(def.active);
  };

  const handleUpdateDefinition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDef) return;
    if (!editDefCode || !editDefName) {
      setError('Document Code and Name are required.');
      return;
    }

    try {
      setError(null);
      await apiRequest(`/api/documents/definitions/${editingDef.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          code: editDefCode,
          name: editDefName,
          description: editDefDesc,
          customer_type: editDefCustomerType,
          active: editDefActive,
        }),
      });

      setSuccessMsg(`Document definition "${editDefName}" updated. Changes apply to future entries.`);
      setEditingDef(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update document definition.');
    }
  };

  const handleDeleteDefinition = async () => {
    if (!deletingDef) return;

    try {
      setError(null);
      await apiRequest(`/api/documents/definitions/${deletingDef.id}`, {
        method: 'DELETE',
      });

      setSuccessMsg(`Document definition "${deletingDef.name}" deleted. Historical documents remain preserved.`);
      setDeletingDef(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete document definition.');
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

  // Handlers for Requirement Rules
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

  const startEditRule = (rule: DocumentRequirementRule) => {
    setEditingRule(rule);
    setEditRuleName(rule.rule_name);
    setEditRuleDesc(rule.description || '');
    setEditRuleCustomerType(rule.customer_type);
    setEditRuleReqType(rule.requirement_type);
    setEditRuleCondType(rule.condition_type);
    setEditRuleFieldKey(rule.condition_field_key || '');
    setEditRuleExpectedVal(rule.condition_expected_value || '');
    setEditRuleOrder(rule.display_order ?? 0);
    setEditRuleActive(rule.active);
    const itemDefIds = rule.items ? rule.items.map((i) => i.document_definition_id) : [];
    setEditSelectedDefIds(itemDefIds);
  };

  const handleUpdateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    if (!editRuleName) {
      setError('Rule Name is required.');
      return;
    }
    if (editSelectedDefIds.length === 0) {
      setError('Please select at least one document definition for this rule.');
      return;
    }
    if (editRuleReqType === 'INDIVIDUAL' && editSelectedDefIds.length > 1) {
      setError('An INDIVIDUAL requirement rule must link to exactly 1 document definition.');
      return;
    }

    try {
      setError(null);
      await apiRequest(`/api/documents/rules/${editingRule.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          rule_name: editRuleName,
          description: editRuleDesc,
          customer_type: editRuleCustomerType,
          requirement_type: editRuleReqType,
          condition_type: editRuleCondType,
          condition_field_key: editRuleCondType === 'CUSTOM_FIELD_EQUALS' ? editRuleFieldKey : null,
          condition_expected_value:
            editRuleCondType === 'CUSTOM_FIELD_EQUALS' ? editRuleExpectedVal : null,
          document_definition_ids: editSelectedDefIds,
          display_order: editRuleOrder,
          active: editRuleActive,
        }),
      });

      setSuccessMsg(`Requirement rule "${editRuleName}" updated. Changes apply to future entries.`);
      setEditingRule(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update requirement rule.');
    }
  };

  const handleDeleteRule = async () => {
    if (!deletingRule) return;

    try {
      setError(null);
      await apiRequest(`/api/documents/rules/${deletingRule.id}`, {
        method: 'DELETE',
      });

      setSuccessMsg(`Requirement rule "${deletingRule.rule_name}" deleted. Historical records preserved.`);
      setDeletingRule(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete requirement rule.');
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

  // Filtered lists
  const filteredDefinitions = definitions.filter((d) => {
    if (defStatusFilter === 'ACTIVE') return d.active;
    if (defStatusFilter === 'INACTIVE') return !d.active;
    return true;
  });

  const filteredRules = rules.filter((r) => {
    if (ruleStatusFilter === 'ACTIVE') return r.active;
    if (ruleStatusFilter === 'INACTIVE') return !r.active;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Subtab Navigation and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('rules')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
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
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500">
              Rules apply to <strong className="text-slate-800">future lead entries</strong> and do not alter past qualified projects.
            </p>

            {/* Rule Status Filter: Active, Inactive, All (Default Active) */}
            <div className="flex items-center gap-1 self-start sm:self-auto bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 px-2">Status:</span>
              <button
                type="button"
                onClick={() => setRuleStatusFilter('ACTIVE')}
                className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors ${
                  ruleStatusFilter === 'ACTIVE'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Active ({rules.filter((r) => r.active).length})
              </button>
              <button
                type="button"
                onClick={() => setRuleStatusFilter('INACTIVE')}
                className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors ${
                  ruleStatusFilter === 'INACTIVE'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Inactive ({rules.filter((r) => !r.active).length})
              </button>
              <button
                type="button"
                onClick={() => setRuleStatusFilter('ALL')}
                className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors ${
                  ruleStatusFilter === 'ALL'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All ({rules.length})
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredRules.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl">
                No requirement rules found matching the selected filter ({ruleStatusFilter.toLowerCase()}).
              </div>
            ) : (
              filteredRules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs hover:border-slate-300 transition-colors"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
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
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          rule.active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {rule.active ? 'ACTIVE' : 'INACTIVE'}
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
                        <span className="text-[11px] text-rose-500 italic">No active documents attached</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                    {isOwner ? (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditRule(rule)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs"
                          title="Edit requirement rule"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleRuleActive(rule)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                          title={rule.active ? 'Deactivate rule' : 'Activate rule'}
                        >
                          {rule.active ? (
                            <ToggleRight className="w-5 h-5 text-emerald-600 inline" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-slate-400 inline" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingRule(rule)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs"
                          title="Delete requirement rule"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500">
              Configure standardized document types that can be attached to requirement rules. Changes apply to future entries.
            </p>

            {/* Document Definition Status Filter: Active, Inactive, All (Default Active) */}
            <div className="flex items-center gap-1 self-start sm:self-auto bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 px-2">Status:</span>
              <button
                type="button"
                onClick={() => setDefStatusFilter('ACTIVE')}
                className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors ${
                  defStatusFilter === 'ACTIVE'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Active ({definitions.filter((d) => d.active).length})
              </button>
              <button
                type="button"
                onClick={() => setDefStatusFilter('INACTIVE')}
                className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors ${
                  defStatusFilter === 'INACTIVE'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Inactive ({definitions.filter((d) => !d.active).length})
              </button>
              <button
                type="button"
                onClick={() => setDefStatusFilter('ALL')}
                className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors ${
                  defStatusFilter === 'ALL'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All ({definitions.length})
              </button>
            </div>
          </div>

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
                {filteredDefinitions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No document definitions found for filter ({defStatusFilter.toLowerCase()}).
                    </td>
                  </tr>
                ) : (
                  filteredDefinitions.map((def) => (
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
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                        {isOwner ? (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditDef(def)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs"
                              title="Edit definition"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleDefActive(def)}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                              title={def.active ? 'Deactivate definition' : 'Activate definition'}
                            >
                              {def.active ? (
                                <ToggleRight className="w-5 h-5 text-emerald-600 inline" />
                              ) : (
                                <ToggleLeft className="w-5 h-5 text-slate-400 inline" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeletingDef(def)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs"
                              title="Delete definition"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Customer Type *</label>
                  <select
                    value={newRuleCustomerType}
                    onChange={(e) => setNewRuleCustomerType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="B2C">B2C (Residential)</option>
                    <option value="B2B">B2B (Commercial)</option>
                    <option value="BOTH">BOTH (All Projects)</option>
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
                    <option value="INDIVIDUAL">INDIVIDUAL (Single specific document)</option>
                    <option value="ALL_REQUIRED">ALL_REQUIRED (Every linked document must be uploaded)</option>
                    <option value="ANY_ONE_REQUIRED">ANY_ONE_REQUIRED (Any one linked document satisfies rule)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Condition Gate *</label>
                  <select
                    value={newRuleCondType}
                    onChange={(e) => setNewRuleCondType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="ALWAYS">ALWAYS (Mandatory for all)</option>
                    <option value="IF_LOAN_REQUIRED">IF_LOAN_REQUIRED (Only when Solar Loan is YES)</option>
                    <option value="IF_CREDIT_EXTENDED">IF_CREDIT_EXTENDED (Only when Credit is YES)</option>
                    <option value="CUSTOM_FIELD_EQUALS">CUSTOM_FIELD_EQUALS (Dynamic match)</option>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Custom Field Key *</label>
                    <input
                      type="text"
                      placeholder="e.g. meter_phase"
                      value={newRuleFieldKey}
                      onChange={(e) => setNewRuleFieldKey(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Expected Value *</label>
                    <input
                      type="text"
                      placeholder="e.g. Three Phase"
                      value={newRuleExpectedVal}
                      onChange={(e) => setNewRuleExpectedVal(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Explain why this document is required..."
                  value={newRuleDesc}
                  onChange={(e) => setNewRuleDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Linked Document Definitions Selection */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Attached Document Definitions *
                  {newRuleReqType === 'INDIVIDUAL' && (
                    <span className="text-amber-800 text-[10px] ml-1.5 font-normal">
                      (Select exactly 1 for Individual rules)
                    </span>
                  )}
                </label>
                <div className="border border-slate-200 rounded-xl p-3 max-h-44 overflow-y-auto space-y-1.5 bg-slate-50/50">
                  {definitions.length === 0 ? (
                    <p className="text-slate-400 italic">No document definitions exist. Create definitions first.</p>
                  ) : (
                    definitions.map((def) => {
                      const isChecked = selectedDefIds.includes(def.id);
                      return (
                        <label
                          key={def.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-blue-50 border-blue-200 text-blue-900 font-semibold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type={newRuleReqType === 'INDIVIDUAL' ? 'radio' : 'checkbox'}
                            name="document_defs"
                            checked={isChecked}
                            onChange={(e) => {
                              if (newRuleReqType === 'INDIVIDUAL') {
                                setSelectedDefIds([def.id]);
                              } else {
                                if (e.target.checked) {
                                  setSelectedDefIds([...selectedDefIds, def.id]);
                                } else {
                                  setSelectedDefIds(selectedDefIds.filter((id) => id !== def.id));
                                }
                              }
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex items-center justify-between w-full">
                            <span>{def.name}</span>
                            <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {def.code}
                            </span>
                          </div>
                        </label>
                      );
                    })
                  )}
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

      {/* EDIT RULE MODAL */}
      {editingRule && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-600" />
                <span>Edit Requirement Rule</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
              <span>Note: Changes made will apply to future entries and not past data.</span>
            </div>

            <form onSubmit={handleUpdateRule} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  value={editRuleName}
                  onChange={(e) => setEditRuleName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Customer Type *</label>
                  <select
                    value={editRuleCustomerType}
                    onChange={(e) => setEditRuleCustomerType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="B2C">B2C (Residential)</option>
                    <option value="B2B">B2B (Commercial)</option>
                    <option value="BOTH">BOTH (All Projects)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Requirement Type *</label>
                  <select
                    value={editRuleReqType}
                    onChange={(e) => setEditRuleReqType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="INDIVIDUAL">INDIVIDUAL (Single specific document)</option>
                    <option value="ALL_REQUIRED">ALL_REQUIRED (Every linked document must be uploaded)</option>
                    <option value="ANY_ONE_REQUIRED">ANY_ONE_REQUIRED (Any one linked document satisfies rule)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Condition Gate *</label>
                  <select
                    value={editRuleCondType}
                    onChange={(e) => setEditRuleCondType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="ALWAYS">ALWAYS (Mandatory for all)</option>
                    <option value="IF_LOAN_REQUIRED">IF_LOAN_REQUIRED (Only when Solar Loan is YES)</option>
                    <option value="IF_CREDIT_EXTENDED">IF_CREDIT_EXTENDED (Only when Credit is YES)</option>
                    <option value="CUSTOM_FIELD_EQUALS">CUSTOM_FIELD_EQUALS (Dynamic match)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Display Order</label>
                  <input
                    type="number"
                    value={editRuleOrder}
                    onChange={(e) => setEditRuleOrder(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Status</label>
                  <select
                    value={editRuleActive ? 'true' : 'false'}
                    onChange={(e) => setEditRuleActive(e.target.value === 'true')}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="true">ACTIVE</option>
                    <option value="false">INACTIVE</option>
                  </select>
                </div>
              </div>

              {editRuleCondType === 'CUSTOM_FIELD_EQUALS' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Custom Field Key *</label>
                    <input
                      type="text"
                      placeholder="e.g. meter_phase"
                      value={editRuleFieldKey}
                      onChange={(e) => setEditRuleFieldKey(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Expected Value *</label>
                    <input
                      type="text"
                      placeholder="e.g. Three Phase"
                      value={editRuleExpectedVal}
                      onChange={(e) => setNewRuleExpectedVal(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editRuleDesc}
                  onChange={(e) => setEditRuleDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Attached Document Definitions *
                  {editRuleReqType === 'INDIVIDUAL' && (
                    <span className="text-amber-800 text-[10px] ml-1.5 font-normal">
                      (Select exactly 1 for Individual rules)
                    </span>
                  )}
                </label>
                <div className="border border-slate-200 rounded-xl p-3 max-h-44 overflow-y-auto space-y-1.5 bg-slate-50/50">
                  {definitions.map((def) => {
                    const isChecked = editSelectedDefIds.includes(def.id);
                    return (
                      <label
                        key={def.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-blue-50 border-blue-200 text-blue-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type={editRuleReqType === 'INDIVIDUAL' ? 'radio' : 'checkbox'}
                          name="edit_document_defs"
                          checked={isChecked}
                          onChange={(e) => {
                            if (editRuleReqType === 'INDIVIDUAL') {
                              setEditSelectedDefIds([def.id]);
                            } else {
                              if (e.target.checked) {
                                setEditSelectedDefIds([...editSelectedDefIds, def.id]);
                              } else {
                                setEditSelectedDefIds(editSelectedDefIds.filter((id) => id !== def.id));
                              }
                            }
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex items-center justify-between w-full">
                          <span>{def.name}</span>
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {def.code}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE RULE CONFIRMATION MODAL */}
      {deletingRule && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Requirement Rule</h3>
                <p className="text-xs text-slate-500">This action applies to future entries and will not alter past data.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <div className="font-semibold text-slate-800">{deletingRule.rule_name}</div>
              <div className="text-[11px] text-slate-500">
                Customer Type: <span className="font-semibold text-slate-700">{deletingRule.customer_type}</span> | Type:{' '}
                <span className="font-semibold text-slate-700">{deletingRule.requirement_type}</span>
              </div>
              <p className="text-[11px] text-amber-700 pt-1">
                ✓ Future leads will not be evaluated against this rule. Past qualified leads maintain their historical checklist.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingRule(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRule}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors"
              >
                Delete Rule
              </button>
            </div>
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

      {/* EDIT DEFINITION MODAL */}
      {editingDef && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-600" />
                <span>Edit Document Definition</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingDef(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
              <span>Note: Changes made will apply to future entries and not past data.</span>
            </div>

            <form onSubmit={handleUpdateDefinition} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Unique Document Code *
                </label>
                <input
                  type="text"
                  required
                  value={editDefCode}
                  onChange={(e) => setEditDefCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Document Name *</label>
                <input
                  type="text"
                  required
                  value={editDefName}
                  onChange={(e) => setEditDefName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Customer Type *</label>
                  <select
                    value={editDefCustomerType}
                    onChange={(e) => setEditDefCustomerType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="B2C">B2C</option>
                    <option value="B2B">B2B</option>
                    <option value="BOTH">BOTH</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Status</label>
                  <select
                    value={editDefActive ? 'true' : 'false'}
                    onChange={(e) => setEditDefActive(e.target.value === 'true')}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="true">ACTIVE</option>
                    <option value="false">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editDefDesc}
                  onChange={(e) => setEditDefDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingDef(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE DEFINITION CONFIRMATION MODAL */}
      {deletingDef && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Document Definition</h3>
                <p className="text-xs text-slate-500">This action applies to future entries and will not alter past data.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <div className="font-semibold text-slate-800">{deletingDef.name}</div>
              <div className="text-[11px] text-slate-500">
                Code: <code className="font-mono text-blue-700 font-bold">{deletingDef.code}</code> | Customer Type:{' '}
                <span className="font-semibold text-slate-700">{deletingDef.customer_type}</span>
              </div>
              <p className="text-[11px] text-amber-700 pt-1">
                ✓ Future rules and lead upload checklists will no longer use this definition. Historical uploaded documents in past projects remain completely preserved.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingDef(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDefinition}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors"
              >
                Delete Definition
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
