import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Package,
  Ruler,
  Sliders,
  Plus,
  Check,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  FileCheck,
  Pencil,
  Save,
  RotateCcw,
  Sparkles,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { User, Item, Uom, CustomFieldDefinition, UserRole, CustomerType, FieldType } from '../../shared/types';
import { formatINR } from '../lib/api';
import { DocumentMasterSettings } from './DocumentMasterSettings';

interface SettingsModalProps {
  onClose: () => void;
  onRefresh: () => void;
  currentUser?: User;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onRefresh, currentUser }) => {
  const isOwner = !currentUser || currentUser.role === 'OWNER';
  const [activeTab, setActiveTab] = useState<'users' | 'items' | 'uoms' | 'fields' | 'documents'>('fields');
  const [users, setUsers] = useState<User[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // User Management State (Status filter default ACTIVE)
  const [userStatusFilter, setUserStatusFilter] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ACTIVE');
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('LEAD');
  const [newUserPassword, setNewUserPassword] = useState('');

  // Edit User State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserUsername, setEditUserUsername] = useState('');
  const [editUserRole, setEditUserRole] = useState<UserRole>('LEAD');
  const [editUserActive, setEditUserActive] = useState(true);

  // Delete User State
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  // Password Reset State
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');

  // Item Master State (Status filter default ACTIVE)
  const [itemStatusFilter, setItemStatusFilter] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ACTIVE');
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemRate, setNewItemRate] = useState<number>(0);
  const [newItemUom, setNewItemUom] = useState('Nos');

  // Edit Item State
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemRate, setEditItemRate] = useState<number>(0);
  const [editItemUom, setEditItemUom] = useState('Nos');
  const [editItemActive, setEditItemActive] = useState(true);

  // Delete Item State
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);

  // UOM Master State (Status filter default ACTIVE)
  const [uomStatusFilter, setUomStatusFilter] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ACTIVE');
  const [showAddUom, setShowAddUom] = useState(false);
  const [newUomCode, setNewUomCode] = useState('');
  const [newUomName, setNewUomName] = useState('');

  // Edit UOM State
  const [editingUom, setEditingUom] = useState<Uom | null>(null);
  const [editUomCode, setEditUomCode] = useState('');
  const [editUomName, setEditUomName] = useState('');
  const [editUomActive, setEditUomActive] = useState(true);

  // Delete UOM State
  const [deletingUom, setDeletingUom] = useState<Uom | null>(null);

  // Custom Fields Filter & Creation State (Default filter B2C)
  const [fieldFilter, setFieldFilter] = useState<'ALL' | 'B2C' | 'B2B'>('B2C');
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldCustomerType, setNewFieldCustomerType] = useState<CustomerType>('B2C');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('TEXT');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldReqCreate, setNewFieldReqCreate] = useState(false);
  const [newFieldReqYes, setNewFieldReqYes] = useState(false);
  const [newFieldDisplayOrder, setNewFieldDisplayOrder] = useState<number>(0);

  // Edit Existing Custom Field State
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);
  const [editFieldLabel, setEditFieldLabel] = useState('');
  const [editFieldCustomerType, setEditFieldCustomerType] = useState<CustomerType>('B2C');
  const [editFieldType, setEditFieldType] = useState<FieldType>('TEXT');
  const [editFieldOptions, setEditFieldOptions] = useState('');
  const [editFieldReqCreate, setEditFieldReqCreate] = useState(false);
  const [editFieldReqYes, setEditFieldReqYes] = useState(false);
  const [editFieldActive, setEditFieldActive] = useState(true);
  const [editFieldDisplayOrder, setEditFieldDisplayOrder] = useState<number>(0);

  // Delete Custom Field State
  const [deletingField, setDeletingField] = useState<CustomFieldDefinition | null>(null);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [uRes, iRes, mRes, fRes] = await Promise.all([
        apiRequest('/api/users'),
        apiRequest('/api/items?include_inactive=true'),
        apiRequest('/api/uoms?include_inactive=true'),
        apiRequest('/api/custom-fields?include_inactive=true'),
      ]);
      setUsers(uRes.users || []);
      setItems(iRes.items || []);
      setUoms(mRes.uoms || []);
      setCustomFields(fRes.fields || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load master settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // User Actions
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name: newUserName.trim(),
          username: newUserUsername.trim(),
          role: newUserRole,
          password: newUserPassword,
        }),
      });
      setSuccessMsg('User created successfully.');
      setShowAddUser(false);
      setNewUserName('');
      setNewUserUsername('');
      setNewUserPassword('');
      await loadAllData();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to create user.');
    }
  };

  const handleToggleUser = async (u: User) => {
    try {
      await apiRequest(`/api/users/${u.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !u.active }),
      });
      await loadAllData();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update user.');
    }
  };

  const startEditUser = (u: User) => {
    setEditingUser(u);
    setEditUserName(u.name);
    setEditUserUsername(u.username);
    setEditUserRole(u.role);
    setEditUserActive(u.active);
    setShowAddUser(false);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      setError(null);
      await apiRequest(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editUserName.trim(),
          username: editUserUsername.trim().toLowerCase(),
          role: editUserRole,
          active: editUserActive,
        }),
      });
      setSuccessMsg(`User account @${editUserUsername.trim().toLowerCase()} updated. Changes apply to future entries.`);
      setEditingUser(null);
      await loadAllData();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update user.');
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      setError(null);
      await apiRequest(`/api/users/${deletingUser.id}`, { method: 'DELETE' });
      setSuccessMsg(`User "${deletingUser.name}" deleted. Historical assignments and records preserved.`);
      setDeletingUser(null);
      await loadAllData();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;
    try {
      await apiRequest(`/api/users/${resettingUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: resetPasswordVal }),
      });
      setSuccessMsg(`Password for @${resettingUser.username} updated.`);
      setResettingUser(null);
      setResetPasswordVal('');
    } catch (err: any) {
      setError(err.message || 'Password reset failed.');
    }
  };

  // Item Actions
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/items', {
        method: 'POST',
        body: JSON.stringify({
          name: newItemName.trim(),
          rate: newItemRate,
          default_uom: newItemUom,
        }),
      });
      setSuccessMsg('Item added to master.');
      setShowAddItem(false);
      setNewItemName('');
      setNewItemRate(0);
      await loadAllData();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to add item.');
    }
  };

  const startEditItem = (it: Item) => {
    setEditingItem(it);
    setEditItemName(it.name);
    setEditItemRate(it.rate);
    setEditItemUom(it.default_uom || 'Nos');
    setEditItemActive(it.active);
    setShowAddItem(false);
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      setError(null);
      await apiRequest(`/api/items/${editingItem.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editItemName.trim(),
          rate: editItemRate,
          default_uom: editItemUom,
          active: editItemActive,
        }),
      });
      setSuccessMsg(`Item "${editItemName}" updated. Standard rate applies to future quotations.`);
      setEditingItem(null);
      await loadAllData();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update item.');
    }
  };

  const handleDeleteItem = async () => {
    if (!deletingItem) return;
    try {
      setError(null);
      await apiRequest(`/api/items/${deletingItem.id}`, { method: 'DELETE' });
      setSuccessMsg(`Item "${deletingItem.name}" deleted. Historical quotations preserved.`);
      setDeletingItem(null);
      await loadAllData();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to delete item.');
    }
  };

  const handleToggleItem = async (it: Item) => {
    try {
      await apiRequest(`/api/items/${it.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !it.active }),
      });
      await loadAllData();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update item.');
    }
  };

  // UOM Actions
  const handleCreateUom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/uoms', {
        method: 'POST',
        body: JSON.stringify({
          code: newUomCode.trim().toUpperCase(),
          name: newUomName.trim(),
        }),
      });
      setSuccessMsg('UOM added.');
      setShowAddUom(false);
      setNewUomCode('');
      setNewUomName('');
      await loadAllData();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to add UOM.');
    }
  };

  const startEditUom = (u: Uom) => {
    setEditingUom(u);
    setEditUomCode(u.code || u.name);
    setEditUomName(u.name);
    setEditUomActive(u.active);
    setShowAddUom(false);
  };

  const handleUpdateUom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUom) return;
    try {
      setError(null);
      await apiRequest(`/api/uoms/${editingUom.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          code: editUomCode.trim().toUpperCase(),
          name: editUomName.trim(),
          active: editUomActive,
        }),
      });
      setSuccessMsg(`UOM "${editUomName}" updated. Changes apply to future entries.`);
      setEditingUom(null);
      await loadAllData();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update UOM.');
    }
  };

  const handleDeleteUom = async () => {
    if (!deletingUom) return;
    try {
      setError(null);
      await apiRequest(`/api/uoms/${deletingUom.id}`, { method: 'DELETE' });
      setSuccessMsg(`UOM "${deletingUom.name}" deleted. Historical records preserved.`);
      setDeletingUom(null);
      await loadAllData();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to delete UOM.');
    }
  };

  const handleToggleUom = async (u: Uom) => {
    try {
      await apiRequest(`/api/uoms/${u.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !u.active }),
      });
      await loadAllData();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update UOM.');
    }
  };

  // Custom Field Actions
  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const optionsArr = newFieldOptions
        ? newFieldOptions.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      await apiRequest('/api/custom-fields', {
        method: 'POST',
        body: JSON.stringify({
          customer_type: newFieldCustomerType,
          label: newFieldLabel.trim(),
          type: newFieldType,
          options: optionsArr,
          required_at_creation: newFieldReqCreate,
          required_before_yes: newFieldReqYes,
          display_order: newFieldDisplayOrder,
        }),
      });
      setSuccessMsg('Custom field added successfully.');
      setShowAddField(false);
      setNewFieldLabel('');
      setNewFieldOptions('');
      setNewFieldReqCreate(false);
      setNewFieldReqYes(false);
      setNewFieldDisplayOrder(0);
      await loadAllData();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to add custom field.');
    }
  };

  const startEditField = (field: CustomFieldDefinition) => {
    setEditingField(field);
    setEditFieldLabel(field.label);
    setEditFieldCustomerType(field.customer_type);
    setEditFieldType(field.type);
    setEditFieldOptions(Array.isArray(field.options) ? field.options.join(', ') : '');
    setEditFieldReqCreate(Boolean(field.required_at_creation));
    setEditFieldReqYes(Boolean(field.required_before_yes));
    setEditFieldActive(Boolean(field.active));
    setEditFieldDisplayOrder(Number(field.display_order) || 0);
    setShowAddField(false);
  };

  const handleUpdateField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingField) return;
    try {
      const optionsArr =
        editFieldType === 'SELECT'
          ? editFieldOptions
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

      await apiRequest(`/api/custom-fields/${editingField.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          customer_type: editFieldCustomerType,
          label: editFieldLabel.trim(),
          type: editFieldType,
          options: optionsArr,
          required_at_creation: editFieldReqCreate,
          required_before_yes: editFieldReqYes,
          active: editFieldActive,
          display_order: editFieldDisplayOrder,
        }),
      });

      setSuccessMsg(`Field "${editFieldLabel.trim()}" updated successfully.`);
      setEditingField(null);
      await loadAllData();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update custom field.');
    }
  };

  const handleDeleteField = async () => {
    if (!deletingField) return;
    try {
      setError(null);
      await apiRequest(`/api/custom-fields/${deletingField.id}`, { method: 'DELETE' });
      setSuccessMsg(`Custom field "${deletingField.label}" deleted. Historical lead data preserved.`);
      setDeletingField(null);
      await loadAllData();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to delete custom field.');
    }
  };

  const handleToggleField = async (field: CustomFieldDefinition) => {
    setError(null);
    try {
      const nextActive = !field.active;
      await apiRequest(`/api/custom-fields/${field.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: nextActive }),
      });
      setSuccessMsg(`Field "${field.label}" marked as ${nextActive ? 'ACTIVE' : 'INACTIVE'}.`);
      await loadAllData();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update custom field.');
    }
  };

  const filteredFields = customFields.filter((f) => {
    if (fieldFilter === 'ALL') return true;
    return f.customer_type === fieldFilter;
  });

  const filteredUsers = users.filter((u) => {
    if (userStatusFilter === 'ACTIVE') return u.active;
    if (userStatusFilter === 'INACTIVE') return !u.active;
    return true;
  });

  const filteredItems = items.filter((it) => {
    if (itemStatusFilter === 'ACTIVE') return it.active;
    if (itemStatusFilter === 'INACTIVE') return !it.active;
    return true;
  });

  const filteredUoms = uoms.filter((u) => {
    if (uomStatusFilter === 'ACTIVE') return u.active;
    if (uomStatusFilter === 'INACTIVE') return !u.active;
    return true;
  });

  const b2cCount = customFields.filter((f) => f.customer_type === 'B2C').length;
  const b2bCount = customFields.filter((f) => f.customer_type === 'B2B').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 shadow-xs">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">System Settings & Masters</h2>
              <p className="text-xs text-slate-500">
                Owner administration, role permissions, custom fields, rates, and document rules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
            title="Close Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-slate-200 flex items-center gap-2 bg-white flex-shrink-0 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('fields')}
            className={`py-3.5 px-3 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'fields'
                ? 'border-blue-600 text-blue-700 font-bold bg-blue-50/40'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Custom Fields</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200">
              {customFields.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`py-3.5 px-3 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-700 font-bold bg-blue-50/40'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Management</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('items')}
            className={`py-3.5 px-3 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'items'
                ? 'border-blue-600 text-blue-700 font-bold bg-blue-50/40'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Item Master</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200">
              {items.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('uoms')}
            className={`py-3.5 px-3 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'uoms'
                ? 'border-blue-600 text-blue-700 font-bold bg-blue-50/40'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Ruler className="w-4 h-4" />
            <span>UOM Master</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200">
              {uoms.length}
            </span>
          </button>

          <button
            id="tab-settings-document-master"
            onClick={() => setActiveTab('documents')}
            className={`py-3.5 px-3 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'documents'
                ? 'border-blue-600 text-blue-700 font-bold bg-blue-50/40'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Document Master</span>
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="m-4 mb-0 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between gap-2 flex-shrink-0 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span className="font-medium">{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-rose-500 hover:text-rose-800 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="m-4 mb-0 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center justify-between gap-2 flex-shrink-0 shadow-xs">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span className="font-medium">{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-500 hover:text-emerald-800 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50/40">
          {/* ======================================================== */}
          {/* TAB: CUSTOM FIELDS                                       */}
          {/* ======================================================== */}
          {activeTab === 'fields' && (
            <div className="space-y-4">
              {/* Header with Title, Scope Filters, and Define Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Dynamic Form Field Definitions (B2C & B2B)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Customize fields displayed during lead intake and required before YES qualification
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  {/* Segmented Filter: ALL, B2C, B2B */}
                  <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setFieldFilter('ALL')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        fieldFilter === 'ALL'
                          ? 'bg-white text-slate-900 font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({customFields.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFieldFilter('B2C')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        fieldFilter === 'B2C'
                          ? 'bg-white text-sky-800 font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      B2C ({b2cCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFieldFilter('B2B')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        fieldFilter === 'B2B'
                          ? 'bg-white text-amber-900 font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      B2B ({b2bCount})
                    </button>
                  </div>

                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddField(!showAddField);
                        if (editingField) setEditingField(null);
                      }}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Define Field</span>
                    </button>
                  )}
                </div>
              </div>

              {/* EDIT EXISTING CUSTOM FIELD CARD */}
              {editingField && (
                <form
                  onSubmit={handleUpdateField}
                  className="p-4 sm:p-5 bg-white rounded-xl border-2 border-blue-500/80 shadow-md space-y-4 text-xs animate-in fade-in duration-200"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                        <Pencil className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          Edit Custom Field: <span className="text-blue-700 font-semibold">{editingField.label}</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Field Key: <code className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">{editingField.field_key}</code>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingField(null)}
                      className="text-slate-400 hover:text-slate-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Customer Type *</label>
                      <select
                        value={editFieldCustomerType}
                        onChange={(e) => setEditFieldCustomerType(e.target.value as CustomerType)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="B2C">B2C (Residential)</option>
                        <option value="B2B">B2B (Commercial / Industrial)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Field Label *</label>
                      <input
                        type="text"
                        required
                        value={editFieldLabel}
                        onChange={(e) => setEditFieldLabel(e.target.value)}
                        placeholder="e.g. Connected Load (kW)"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Data Type *</label>
                      <select
                        value={editFieldType}
                        onChange={(e) => setEditFieldType(e.target.value as FieldType)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="TEXT">Text</option>
                        <option value="NUMBER">Number</option>
                        <option value="CURRENCY">Currency (₹)</option>
                        <option value="SELECT">Select Dropdown</option>
                        <option value="DATE">Date</option>
                        <option value="BOOLEAN">Boolean (Yes/No)</option>
                        <option value="TEXTAREA">Textarea</option>
                        <option value="EMAIL">Email</option>
                        <option value="PHONE">Phone Number</option>
                        <option value="URL">URL / Link</option>
                      </select>
                    </div>

                    {editFieldType === 'SELECT' && (
                      <div className="sm:col-span-3">
                        <label className="block text-slate-700 font-semibold mb-1">
                          Options (Comma-separated) *
                        </label>
                        <input
                          type="text"
                          required
                          value={editFieldOptions}
                          onChange={(e) => setEditFieldOptions(e.target.value)}
                          placeholder="e.g. Single Phase, Three Phase, HT Connection"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Display Order</label>
                      <input
                        type="number"
                        min="0"
                        value={editFieldDisplayOrder}
                        onChange={(e) => setEditFieldDisplayOrder(parseInt(e.target.value, 10) || 0)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="editReqCreate"
                        checked={editFieldReqCreate}
                        onChange={(e) => setEditFieldReqCreate(e.target.checked)}
                        className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                      />
                      <label htmlFor="editReqCreate" className="text-slate-800 font-medium cursor-pointer">
                        Required at Lead Creation
                      </label>
                    </div>

                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="editReqYes"
                        checked={editFieldReqYes}
                        onChange={(e) => setEditFieldReqYes(e.target.checked)}
                        className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                      />
                      <label htmlFor="editReqYes" className="text-slate-800 font-medium cursor-pointer">
                        Required before Qualification (YES)
                      </label>
                    </div>

                    <div className="flex items-center gap-2 pt-2 sm:pt-6">
                      <input
                        type="checkbox"
                        id="editActive"
                        checked={editFieldActive}
                        onChange={(e) => setEditFieldActive(e.target.checked)}
                        className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                      />
                      <label htmlFor="editActive" className="text-slate-800 font-medium cursor-pointer">
                        Active Field (Visible in Forms)
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingField(null)}
                      className="px-3.5 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </button>
                  </div>
                </form>
              )}

              {/* DEFINE NEW FIELD FORM */}
              {showAddField && (
                <form
                  onSubmit={handleCreateField}
                  className="p-4 sm:p-5 bg-white rounded-xl border border-slate-300 shadow-sm space-y-3.5 text-xs animate-in fade-in duration-200"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Plus className="w-4 h-4 text-blue-600" />
                      <span>Define New Dynamic Field</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddField(false)}
                      className="text-slate-400 hover:text-slate-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Customer Type *</label>
                      <select
                        value={newFieldCustomerType}
                        onChange={(e) => setNewFieldCustomerType(e.target.value as CustomerType)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="B2C">B2C (Residential)</option>
                        <option value="B2B">B2B (Commercial / Industrial)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Field Label *</label>
                      <input
                        type="text"
                        required
                        value={newFieldLabel}
                        onChange={(e) => setNewFieldLabel(e.target.value)}
                        placeholder="e.g. Connected Load (kW)"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Data Type *</label>
                      <select
                        value={newFieldType}
                        onChange={(e) => setNewFieldType(e.target.value as FieldType)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="TEXT">Text</option>
                        <option value="NUMBER">Number</option>
                        <option value="CURRENCY">Currency (₹)</option>
                        <option value="SELECT">Select Dropdown</option>
                        <option value="DATE">Date</option>
                        <option value="BOOLEAN">Boolean (Yes/No)</option>
                        <option value="TEXTAREA">Textarea</option>
                        <option value="EMAIL">Email</option>
                        <option value="PHONE">Phone Number</option>
                        <option value="URL">URL / Link</option>
                      </select>
                    </div>

                    {newFieldType === 'SELECT' && (
                      <div className="sm:col-span-3">
                        <label className="block text-slate-700 font-semibold mb-1">
                          Options (Comma-separated) *
                        </label>
                        <input
                          type="text"
                          required
                          value={newFieldOptions}
                          onChange={(e) => setNewFieldOptions(e.target.value)}
                          placeholder="Single Phase, Three Phase, HT Connection"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Display Order</label>
                      <input
                        type="number"
                        min="0"
                        value={newFieldDisplayOrder}
                        onChange={(e) => setNewFieldDisplayOrder(parseInt(e.target.value, 10) || 0)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="newReqCreate"
                        checked={newFieldReqCreate}
                        onChange={(e) => setNewFieldReqCreate(e.target.checked)}
                        className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                      />
                      <label htmlFor="newReqCreate" className="text-slate-800 font-medium cursor-pointer">
                        Required at Lead Creation
                      </label>
                    </div>

                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="newReqYes"
                        checked={newFieldReqYes}
                        onChange={(e) => setNewFieldReqYes(e.target.checked)}
                        className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                      />
                      <label htmlFor="newReqYes" className="text-slate-800 font-medium cursor-pointer">
                        Required before Qualification (YES)
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowAddField(false)}
                      className="px-3.5 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs transition-colors"
                    >
                      Save Field Definition
                    </button>
                  </div>
                </form>
              )}

              {/* CUSTOM FIELDS TABLE */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3.5">Type</th>
                      <th className="py-3 px-3.5">Label & Key</th>
                      <th className="py-3 px-3.5">Data Type</th>
                      <th className="py-3 px-3.5 text-center">Req at Creation</th>
                      <th className="py-3 px-3.5 text-center">Req for YES</th>
                      <th className="py-3 px-3.5 text-center">Order</th>
                      <th className="py-3 px-3.5 text-center">Status</th>
                      <th className="py-3 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredFields.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No custom fields defined for {fieldFilter === 'ALL' ? 'any customer type' : fieldFilter}.
                        </td>
                      </tr>
                    ) : (
                      filteredFields.map((f) => {
                        const isEditingThis = editingField?.id === f.id;
                        return (
                          <tr
                            key={f.id}
                            className={`transition-colors ${
                              isEditingThis
                                ? 'bg-blue-50/70 border-l-4 border-l-blue-600'
                                : 'hover:bg-slate-50/70'
                            }`}
                          >
                            <td className="py-3 px-3.5 font-bold">
                              {f.customer_type === 'B2B' ? (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded text-[11px]">
                                  B2B
                                </span>
                              ) : (
                                <span className="bg-sky-100 text-sky-900 border border-sky-300 font-bold px-2 py-0.5 rounded text-[11px]">
                                  B2C
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 font-medium text-slate-900">
                              <div className="font-semibold text-slate-900">{f.label}</div>
                              <div className="text-[10px] font-mono text-slate-400">
                                {f.field_key}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 font-mono">
                              <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold">
                                {f.type}
                              </span>
                              {f.type === 'SELECT' && f.options && f.options.length > 0 && (
                                <div className="text-[10px] text-slate-500 mt-0.5 max-w-xs truncate">
                                  {f.options.join(', ')}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-center">
                              {f.required_at_creation ? (
                                <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold text-[10px]">
                                  YES
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium">NO</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-center">
                              {f.required_before_yes ? (
                                <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-bold text-[10px]">
                                  YES
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium">NO</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-center font-mono text-slate-500 text-[11px]">
                              {f.display_order ?? 0}
                            </td>
                            <td className="py-3 px-3.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  f.active
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                              >
                                {f.active ? 'ACTIVE' : 'INACTIVE'}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              {isOwner ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => startEditField(f)}
                                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors shadow-xs"
                                    title="Edit custom field"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleField(f)}
                                    className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                                    title={f.active ? 'Deactivate field' : 'Activate field'}
                                  >
                                    {f.active ? (
                                      <ToggleRight className="w-5 h-5 text-emerald-600 inline" />
                                    ) : (
                                      <ToggleLeft className="w-5 h-5 text-slate-400 inline" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingField(f)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                                    title="Delete custom field"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Read-only</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: USERS MANAGEMENT                                    */}
          {/* ======================================================== */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                <div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Configured Solar ERP Accounts
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Manage team access, assign roles, and configure system credentials (changes apply to future entries)
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  {/* Status Filter: Active, Inactive, All (Default Active) */}
                  <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setUserStatusFilter('ACTIVE')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        userStatusFilter === 'ACTIVE'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Active ({users.filter((u) => u.active).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserStatusFilter('INACTIVE')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        userStatusFilter === 'INACTIVE'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Inactive ({users.filter((u) => !u.active).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserStatusFilter('ALL')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        userStatusFilter === 'ALL'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({users.length})
                    </button>
                  </div>

                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddUser(!showAddUser);
                        if (editingUser) setEditingUser(null);
                      }}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create User</span>
                    </button>
                  )}
                </div>
              </div>

              {/* EDIT USER FORM */}
              {editingUser && (
                <form
                  onSubmit={handleUpdateUser}
                  className="p-4 sm:p-5 bg-white rounded-xl border-2 border-blue-500/80 shadow-md space-y-4 text-xs animate-in fade-in duration-200"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                        <Pencil className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          Edit User Account: <span className="text-blue-700 font-semibold">{editingUser.name}</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Username: <code className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">@{editingUser.username}</code>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="text-slate-400 hover:text-slate-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={editUserName}
                        onChange={(e) => setEditUserName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Username *</label>
                      <input
                        type="text"
                        required
                        value={editUserUsername}
                        onChange={(e) => setEditUserUsername(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">System Role *</label>
                      <select
                        value={editUserRole}
                        onChange={(e) => setEditUserRole(e.target.value as UserRole)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="LEAD">LEAD (Lead Team Member)</option>
                        <option value="MANAGER">MANAGER (Lead Team Manager)</option>
                        <option value="INSTALLATION_MANAGER">INSTALLATION_MANAGER</option>
                        <option value="INSTALLATION_MEMBER">INSTALLATION_MEMBER (Field Crew)</option>
                        <option value="REGISTRATION">REGISTRATION (Registration Team)</option>
                        <option value="ACCOUNTS">ACCOUNTS (Accounts & Receipts Team)</option>
                        <option value="DISPATCH">DISPATCH (Logistics & Dispatch Team)</option>
                        <option value="SERVICE">SERVICE (After-Sales & Complaints Desk)</option>
                        <option value="OWNER">OWNER (Full Authority)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="editUserActiveBox"
                      checked={editUserActive}
                      onChange={(e) => setEditUserActive(e.target.checked)}
                      className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                    />
                    <label htmlFor="editUserActiveBox" className="text-slate-800 font-medium cursor-pointer">
                      Active Account (Permit login and future task assignments)
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="px-3.5 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </button>
                  </div>
                </form>
              )}

              {showAddUser && (
                <form
                  onSubmit={handleCreateUser}
                  className="p-4 sm:p-5 bg-white rounded-xl border border-slate-300 shadow-sm space-y-3.5 text-xs animate-in fade-in duration-200"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-slate-900 text-sm">Create New User Account</h4>
                    <button
                      type="button"
                      onClick={() => setShowAddUser(false)}
                      className="text-slate-400 hover:text-slate-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="e.g. Vikram Verma"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Username *</label>
                      <input
                        type="text"
                        required
                        value={newUserUsername}
                        onChange={(e) => setNewUserUsername(e.target.value)}
                        placeholder="e.g. vikram"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">System Role *</label>
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="LEAD">LEAD (Lead Team Member)</option>
                        <option value="MANAGER">MANAGER (Lead Team Manager)</option>
                        <option value="INSTALLATION_MANAGER">INSTALLATION_MANAGER</option>
                        <option value="INSTALLATION_MEMBER">INSTALLATION_MEMBER (Field Crew)</option>
                        <option value="REGISTRATION">REGISTRATION (Registration Team)</option>
                        <option value="ACCOUNTS">ACCOUNTS (Accounts & Receipts Team)</option>
                        <option value="DISPATCH">DISPATCH (Logistics & Dispatch Team)</option>
                        <option value="SERVICE">SERVICE (After-Sales & Complaints Desk)</option>
                        <option value="OWNER">OWNER (Full Authority)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Password *</label>
                      <input
                        type="password"
                        required
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="Initial password"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowAddUser(false)}
                      className="px-3.5 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs transition-colors"
                    >
                      Save Account
                    </button>
                  </div>
                </form>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3.5">Name</th>
                      <th className="py-3 px-3.5">Username</th>
                      <th className="py-3 px-3.5">Role</th>
                      <th className="py-3 px-3.5 text-center">Status</th>
                      <th className="py-3 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No users found matching filter ({userStatusFilter.toLowerCase()}).
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3.5 font-semibold text-slate-900">{u.name}</td>
                          <td className="py-3 px-3.5 font-mono text-slate-500">@{u.username}</td>
                          <td className="py-3 px-3.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                u.active
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              {u.active ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            {isOwner ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => startEditUser(u)}
                                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors shadow-xs"
                                  title="Edit user"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setResettingUser(u)}
                                  className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                                  title="Reset password"
                                >
                                  <KeyRound className="w-3.5 h-3.5 text-amber-600 inline" />
                                  <span>Reset Pwd</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleUser(u)}
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                                  title={u.active ? 'Deactivate user' : 'Activate user'}
                                >
                                  {u.active ? (
                                    <ToggleRight className="w-5 h-5 text-emerald-600 inline" />
                                  ) : (
                                    <ToggleLeft className="w-5 h-5 text-slate-400 inline" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingUser(u)}
                                  disabled={currentUser?.id === u.id}
                                  className={`p-1.5 rounded-lg border transition-colors ${
                                    currentUser?.id === u.id
                                      ? 'text-slate-300 border-transparent cursor-not-allowed'
                                      : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-transparent hover:border-rose-200'
                                  }`}
                                  title={
                                    currentUser?.id === u.id
                                      ? 'Cannot delete your own current account'
                                      : 'Delete user'
                                  }
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Read-only</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Password Reset Modal */}
              {resettingUser && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <form
                    onSubmit={handleResetPassword}
                    className="bg-white border border-slate-200 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="text-sm font-bold text-slate-900">
                        Reset Password for @{resettingUser.username}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setResettingUser(null)}
                        className="text-slate-400 hover:text-slate-700 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-700 font-semibold mb-1">New Password *</label>
                      <input
                        type="password"
                        required
                        value={resetPasswordVal}
                        onChange={(e) => setResetPasswordVal(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setResettingUser(null)}
                        className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-xs"
                      >
                        Update Password
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: ITEM MASTER                                         */}
          {/* ======================================================== */}
          {activeTab === 'items' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                <div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Item Master & Standard Rates
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Catalog of solar modules, inverters, structures, cables, and turnkey services (changes apply to future entries)
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  {/* Status Filter: Active, Inactive, All (Default Active) */}
                  <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setItemStatusFilter('ACTIVE')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        itemStatusFilter === 'ACTIVE'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Active ({items.filter((i) => i.active).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemStatusFilter('INACTIVE')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        itemStatusFilter === 'INACTIVE'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Inactive ({items.filter((i) => !i.active).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemStatusFilter('ALL')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        itemStatusFilter === 'ALL'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({items.length})
                    </button>
                  </div>

                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddItem(!showAddItem);
                        if (editingItem) setEditingItem(null);
                      }}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Item</span>
                    </button>
                  )}
                </div>
              </div>

              {/* EDIT ITEM FORM */}
              {editingItem && (
                <form
                  onSubmit={handleUpdateItem}
                  className="p-4 sm:p-5 bg-white rounded-xl border-2 border-blue-500/80 shadow-md space-y-4 text-xs animate-in fade-in duration-200"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                        <Pencil className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          Edit Catalog Item: <span className="text-blue-700 font-semibold">{editingItem.name}</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Changes will apply to future quotations and bills of materials
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingItem(null)}
                      className="text-slate-400 hover:text-slate-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Item Name *</label>
                      <input
                        type="text"
                        required
                        value={editItemName}
                        onChange={(e) => setEditItemName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Standard Rate (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={editItemRate}
                        onChange={(e) => setEditItemRate(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Default UOM *</label>
                      <select
                        value={editItemUom}
                        onChange={(e) => setEditItemUom(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        {uoms.map((u) => (
                          <option key={u.id} value={u.name}>
                            {u.name} ({u.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="editItemActiveBox"
                      checked={editItemActive}
                      onChange={(e) => setEditItemActive(e.target.checked)}
                      className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                    />
                    <label htmlFor="editItemActiveBox" className="text-slate-800 font-medium cursor-pointer">
                      Active Item (Available in future Quotation Editor and Project BOMs)
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingItem(null)}
                      className="px-3.5 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </button>
                  </div>
                </form>
              )}

              {showAddItem && (
                <form
                  onSubmit={handleCreateItem}
                  className="p-4 sm:p-5 bg-white rounded-xl border border-slate-300 shadow-sm space-y-3.5 text-xs animate-in fade-in duration-200"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-slate-900 text-sm">Add New Solar Component / Service</h4>
                    <button
                      type="button"
                      onClick={() => setShowAddItem(false)}
                      className="text-slate-400 hover:text-slate-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Item Name *</label>
                      <input
                        type="text"
                        required
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="e.g. 545W Mono PERC Half-cut Panel"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Standard Rate (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={newItemRate}
                        onChange={(e) => setNewItemRate(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Default UOM *</label>
                      <select
                        value={newItemUom}
                        onChange={(e) => setNewItemUom(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        {uoms.map((u) => (
                          <option key={u.id} value={u.name}>
                            {u.name} ({u.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowAddItem(false)}
                      className="px-3.5 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs transition-colors"
                    >
                      Save Item
                    </button>
                  </div>
                </form>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3.5">Item Name</th>
                      <th className="py-3 px-3.5">Standard Rate</th>
                      <th className="py-3 px-3.5">Default UOM</th>
                      <th className="py-3 px-3.5 text-center">Status</th>
                      <th className="py-3 px-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No items found matching filter ({itemStatusFilter.toLowerCase()}).
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((it) => (
                        <tr key={it.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3.5 font-semibold text-slate-900">{it.name}</td>
                          <td className="py-3 px-3.5 font-mono font-bold text-slate-900">
                            {formatINR(it.rate)}
                          </td>
                          <td className="py-3 px-3.5 text-slate-600">{it.default_uom}</td>
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                it.active
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              {it.active ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            {isOwner ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => startEditItem(it)}
                                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors shadow-xs"
                                  title="Edit item"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleItem(it)}
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                                  title={it.active ? 'Deactivate item' : 'Activate item'}
                                >
                                  {it.active ? (
                                    <ToggleRight className="w-5 h-5 text-emerald-600 inline" />
                                  ) : (
                                    <ToggleLeft className="w-5 h-5 text-slate-400 inline" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingItem(it)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                                  title="Delete item"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Read-only</span>
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

          {/* ======================================================== */}
          {/* TAB: UOMS                                                */}
          {/* ======================================================== */}
          {activeTab === 'uoms' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                <div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Units of Measurement (UOM)
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Standard units for quotations, billing, capacity (kWp), and site measurements (changes apply to future entries)
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  {/* Status Filter: Active, Inactive, All (Default Active) */}
                  <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setUomStatusFilter('ACTIVE')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        uomStatusFilter === 'ACTIVE'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Active ({uoms.filter((u) => u.active).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setUomStatusFilter('INACTIVE')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        uomStatusFilter === 'INACTIVE'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Inactive ({uoms.filter((u) => !u.active).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setUomStatusFilter('ALL')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        uomStatusFilter === 'ALL'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({uoms.length})
                    </button>
                  </div>

                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddUom(!showAddUom);
                        if (editingUom) setEditingUom(null);
                      }}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add UOM</span>
                    </button>
                  )}
                </div>
              </div>

              {/* EDIT UOM FORM */}
              {editingUom && (
                <form
                  onSubmit={handleUpdateUom}
                  className="p-4 sm:p-5 bg-white rounded-xl border-2 border-blue-500/80 shadow-md space-y-4 text-xs animate-in fade-in duration-200"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                        <Pencil className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          Edit Unit of Measurement: <span className="text-blue-700 font-semibold">{editingUom.name}</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Changes apply to future item definitions and quotations
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingUom(null)}
                      className="text-slate-400 hover:text-slate-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Code * (e.g. MTR)</label>
                      <input
                        type="text"
                        required
                        value={editUomCode}
                        onChange={(e) => setEditUomCode(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Display Name * (e.g. Meters)</label>
                      <input
                        type="text"
                        required
                        value={editUomName}
                        onChange={(e) => setEditUomName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="editUomActiveBox"
                      checked={editUomActive}
                      onChange={(e) => setEditUomActive(e.target.checked)}
                      className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                    />
                    <label htmlFor="editUomActiveBox" className="text-slate-800 font-medium cursor-pointer">
                      Active UOM (Selectable in future items and quotations)
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingUom(null)}
                      className="px-3.5 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </button>
                  </div>
                </form>
              )}

              {showAddUom && (
                <form
                  onSubmit={handleCreateUom}
                  className="p-4 sm:p-5 bg-white rounded-xl border border-slate-300 shadow-sm space-y-3.5 text-xs animate-in fade-in duration-200"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-slate-900 text-sm">Create New UOM</h4>
                    <button
                      type="button"
                      onClick={() => setShowAddUom(false)}
                      className="text-slate-400 hover:text-slate-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Code * (e.g. MTR)</label>
                      <input
                        type="text"
                        required
                        value={newUomCode}
                        onChange={(e) => setNewUomCode(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Display Name * (e.g. Meters)</label>
                      <input
                        type="text"
                        required
                        value={newUomName}
                        onChange={(e) => setNewUomName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowAddUom(false)}
                      className="px-3.5 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs transition-colors"
                    >
                      Save UOM
                    </button>
                  </div>
                </form>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3.5">Code</th>
                      <th className="py-3 px-3.5">Name</th>
                      <th className="py-3 px-3.5 text-center">Status</th>
                      <th className="py-3 px-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUoms.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          No units found matching filter ({uomStatusFilter.toLowerCase()}).
                        </td>
                      </tr>
                    ) : (
                      filteredUoms.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3.5 font-mono font-bold text-blue-700 bg-blue-50/50 w-36">
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[11px]">
                              {u.code}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-slate-800 font-medium">{u.name}</td>
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                u.active
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              {u.active ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            {isOwner ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => startEditUom(u)}
                                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors shadow-xs"
                                  title="Edit UOM"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleUom(u)}
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                                  title={u.active ? 'Deactivate UOM' : 'Activate UOM'}
                                >
                                  {u.active ? (
                                    <ToggleRight className="w-5 h-5 text-emerald-600 inline" />
                                  ) : (
                                    <ToggleLeft className="w-5 h-5 text-slate-400 inline" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingUom(u)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                                  title="Delete UOM"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Read-only</span>
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

          {/* ======================================================== */}
          {/* TAB: DOCUMENT MASTER                                     */}
          {/* ======================================================== */}
          {activeTab === 'documents' && <DocumentMasterSettings currentUser={currentUser} />}
        </div>
      </div>

      {/* CONFIRMATION MODAL: DELETE CUSTOM FIELD */}
      {deletingField && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Custom Field</h3>
                <p className="text-xs text-slate-500">Applies to future entries only</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900 font-semibold">{deletingField.label}</strong> (<code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">{deletingField.field_key}</code>)?
              <br /><br />
              This field will be removed from future lead forms. <strong>Past leads, saved entries, and historical values will remain completely preserved.</strong>
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingField(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteField}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Field</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: DELETE USER */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete User Account</h3>
                <p className="text-xs text-slate-500">Applies to future entries only</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900 font-semibold">{deletingUser.name}</strong> (<code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">@{deletingUser.username}</code>)?
              <br /><br />
              This user will no longer be able to log in or be assigned future leads. <strong>All past leads, quotations, stage handoffs, and audit logs created by or assigned to this user will remain preserved.</strong>
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete User</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: DELETE ITEM */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Item from Master</h3>
                <p className="text-xs text-slate-500">Applies to future entries only</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900 font-semibold">{deletingItem.name}</strong>?
              <br /><br />
              This item will not be selectable in future quotations or bills of materials. <strong>All historical quotations, generated PDFs, and past project data remain completely unchanged.</strong>
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Item</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: DELETE UOM */}
      {deletingUom && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Unit of Measurement</h3>
                <p className="text-xs text-slate-500">Applies to future entries only</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900 font-semibold">{deletingUom.name}</strong> (<code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">{deletingUom.code}</code>)?
              <br /><br />
              This unit will not appear in future item creation or quotation unit selectors. <strong>All past quotations, items, and site records using this unit are preserved.</strong>
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingUom(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUom}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete UOM</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
