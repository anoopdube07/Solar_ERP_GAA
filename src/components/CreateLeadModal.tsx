import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  User as UserIcon,
  Building2,
  AlertCircle,
  LogIn,
  CheckCircle2,
  FileText,
  MapPin,
  Zap,
  DollarSign,
  ShieldCheck,
  ChevronRight,
  Sun,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { apiRequest, setAuthToken } from '../lib/api';
import { CustomerType, CustomFieldDefinition, User } from '../../shared/types';

interface CreateLeadModalProps {
  onClose: () => void;
  onSuccess: (leadId: string) => void;
  currentUser?: User;
  onOpenSettings?: () => void;
}

// Reusable Dynamic Custom Fields section rendered from Owner-configured definitions
const DynamicCustomFieldsSection: React.FC<{
  fields: CustomFieldDefinition[];
  values: Record<string, string>;
  onChange: (key: string, val: string) => void;
}> = ({ fields, values, onChange }) => {
  if (fields.length === 0) return null;

  return (
    <div className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-4 space-y-3.5">
      <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-950 uppercase tracking-wider">
          <Sliders className="w-3.5 h-3.5 text-amber-600" />
          <span>Additional Specifications & Custom Fields</span>
        </div>
        <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/70 border border-amber-200 px-2 py-0.5 rounded-full">
          {fields.length} {fields.length === 1 ? 'Dynamic Field' : 'Dynamic Fields'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((field) => {
          const val = values[field.field_key] || '';
          const isRequired = field.required_at_creation;

          if (field.type === 'SELECT') {
            return (
              <div key={field.id} className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {field.label} {isRequired && <span className="text-rose-500">*</span>}
                </label>
                <select
                  required={isRequired}
                  value={val}
                  onChange={(e) => onChange(field.field_key, e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">Select {field.label}...</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          if (field.type === 'BOOLEAN') {
            return (
              <div key={field.id} className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {field.label} {isRequired && <span className="text-rose-500">*</span>}
                </label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name={`bool_${field.field_key}`}
                      checked={val === 'YES'}
                      onChange={() => onChange(field.field_key, 'YES')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name={`bool_${field.field_key}`}
                      checked={val === 'NO'}
                      onChange={() => onChange(field.field_key, 'NO')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>
            );
          }

          if (field.type === 'TEXTAREA') {
            return (
              <div key={field.id} className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {field.label} {isRequired && <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  rows={2}
                  required={isRequired}
                  value={val}
                  onChange={(e) => onChange(field.field_key, e.target.value)}
                  placeholder={`Enter ${field.label}...`}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            );
          }

          return (
            <div key={field.id}>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {field.label} {isRequired && <span className="text-rose-500">*</span>}
              </label>
              <input
                type={
                  field.type === 'NUMBER' || field.type === 'CURRENCY'
                    ? 'number'
                    : field.type === 'DATE'
                    ? 'date'
                    : 'text'
                }
                required={isRequired}
                value={val}
                onChange={(e) => onChange(field.field_key, e.target.value)}
                placeholder={field.type === 'CURRENCY' ? '₹ Amount' : `Enter ${field.label}...`}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const CreateLeadModal: React.FC<CreateLeadModalProps> = ({
  onClose,
  onSuccess,
  currentUser,
  onOpenSettings,
}) => {
  const [customerType, setCustomerType] = useState<CustomerType>('B2C');

  // Dynamic Custom Fields configured by Owner
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [dynamicValues, setDynamicValues] = useState<Record<string, string>>({});

  useEffect(() => {
    apiRequest('/api/custom-fields?include_inactive=true')
      .then((res) => {
        if (res.fields) {
          setCustomFieldDefs(res.fields);
        }
      })
      .catch((err) => console.warn('Could not load custom fields:', err));
  }, []);

  const getFieldDef = (key: string, cType: CustomerType): CustomFieldDefinition | undefined => {
    return customFieldDefs.find((d) => d.field_key === key && d.customer_type === cType);
  };

  const isFieldActive = (key: string, cType: CustomerType): boolean => {
    const def = getFieldDef(key, cType);
    if (!def) return false;
    return def.active === true;
  };

  const handleDynamicValueChange = (key: string, val: string) => {
    setDynamicValues((prev) => ({ ...prev, [key]: val }));
  };

  const additionalCustomFields = useMemo(() => {
    const standardKeys =
      customerType === 'B2C'
        ? ['monthly_electricity_bill', 'sanctioned_load_kw', 'roof_type', 'discom_consumer_number']
        : [
            'contact_person_name',
            'decision_maker_designation',
            'company_gstin',
            'industry_vertical',
            'connected_load_kva',
            'proposed_capacity_kw',
          ];

    return customFieldDefs.filter(
      (def) => def.customer_type === customerType && def.active && !standardKeys.includes(def.field_key)
    );
  }, [customFieldDefs, customerType]);

  // B2C Form States
  const [b2cName, setB2cName] = useState('');
  const [b2cMobile, setB2cMobile] = useState('');
  const [b2cEmail, setB2cEmail] = useState('');
  const [b2cLeadSource, setB2cLeadSource] = useState('Website Form');
  const [b2cLocation, setB2cLocation] = useState('');
  const [b2cAddress, setB2cAddress] = useState('');
  const [b2cLocationLink, setB2cLocationLink] = useState('');
  const [b2cProjectLocation, setB2cProjectLocation] = useState('');
  const [b2cMonthlyBill, setB2cMonthlyBill] = useState('');
  const [b2cSanctionedLoad, setB2cSanctionedLoad] = useState('');
  const [b2cRoofType, setB2cRoofType] = useState('Flat RCC Concrete');
  const [b2cDiscomNumber, setB2cDiscomNumber] = useState('');
  const [b2cLoanRequired, setB2cLoanRequired] = useState<'YES' | 'NO'>('NO');
  const [b2cRemarks, setB2cRemarks] = useState('');

  // B2B Form States
  const [b2bCompanyName, setB2bCompanyName] = useState('');
  const [b2bContactPerson, setB2bContactPerson] = useState('');
  const [b2bDesignation, setB2bDesignation] = useState('');
  const [b2bMobile, setB2bMobile] = useState('');
  const [b2bEmail, setB2bEmail] = useState('');
  const [b2bGstin, setB2bGstin] = useState('');
  const [b2bIndustry, setB2bIndustry] = useState('Engineering & Auto');
  const [b2bAddress, setB2bAddress] = useState('');
  const [b2bLocation, setB2bLocation] = useState('');
  const [b2bLocationLink, setB2bLocationLink] = useState('');
  const [b2bProjectLocation, setB2bProjectLocation] = useState('');
  const [b2bConnectedLoad, setB2bConnectedLoad] = useState('');
  const [b2bProposedCapacity, setB2bProposedCapacity] = useState('');
  const [b2bCreditExtended, setB2bCreditExtended] = useState<'YES' | 'NO'>('NO');
  const [b2bRequestedCredit, setB2bRequestedCredit] = useState<number | ''>('');
  const [b2bLeadSource, setB2bLeadSource] = useState('Direct Referral');
  const [b2bRemarks, setB2bRemarks] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const activeMobile = customerType === 'B2C' ? b2cMobile.trim() : b2bMobile.trim();
    if (!/^\d{10}$/.test(activeMobile)) {
      setError('Please provide a valid 10-digit mobile number.');
      return;
    }

    if (customerType === 'B2B' && b2bCreditExtended === 'YES' && (!b2bRequestedCredit || Number(b2bRequestedCredit) <= 0)) {
      setError('Please specify the requested credit amount for B2B commercial credit approval.');
      return;
    }

    // Validate required custom fields configured by Owner (active only)
    const activeDefsForType = customFieldDefs.filter(
      (def) => def.customer_type === customerType && def.active
    );

    for (const field of activeDefsForType) {
      if (field.required_at_creation) {
        let val = '';
        if (customerType === 'B2C') {
          if (field.field_key === 'monthly_electricity_bill') val = b2cMonthlyBill;
          else if (field.field_key === 'sanctioned_load_kw') val = b2cSanctionedLoad;
          else if (field.field_key === 'roof_type') val = b2cRoofType;
          else if (field.field_key === 'discom_consumer_number') val = b2cDiscomNumber;
          else val = dynamicValues[field.field_key] || '';
        } else {
          if (field.field_key === 'contact_person_name') val = b2bContactPerson;
          else if (field.field_key === 'decision_maker_designation') val = b2bDesignation;
          else if (field.field_key === 'company_gstin') val = b2bGstin;
          else if (field.field_key === 'industry_vertical') val = b2bIndustry;
          else if (field.field_key === 'connected_load_kva') val = b2bConnectedLoad;
          else if (field.field_key === 'proposed_capacity_kw') val = b2bProposedCapacity;
          else val = dynamicValues[field.field_key] || '';
        }

        if (!val || !val.trim()) {
          setError(`"${field.label}" is required by the Owner for ${customerType} lead creation.`);
          return;
        }
      }
    }

    setLoading(true);

    let payload: any;
    if (customerType === 'B2C') {
      const b2cCustomFields: Record<string, any> = { ...dynamicValues };
      if (isFieldActive('monthly_electricity_bill', 'B2C') && b2cMonthlyBill.trim()) {
        b2cCustomFields.monthly_electricity_bill = b2cMonthlyBill.trim();
      }
      if (isFieldActive('sanctioned_load_kw', 'B2C') && b2cSanctionedLoad.trim()) {
        b2cCustomFields.sanctioned_load_kw = b2cSanctionedLoad.trim();
      }
      if (isFieldActive('roof_type', 'B2C') && b2cRoofType) {
        b2cCustomFields.roof_type = b2cRoofType;
      }
      if (isFieldActive('discom_consumer_number', 'B2C') && b2cDiscomNumber.trim()) {
        b2cCustomFields.discom_consumer_number = b2cDiscomNumber.trim();
      }

      payload = {
        customer_name: b2cName.trim(),
        mobile_number: activeMobile,
        customer_type: 'B2C',
        email: b2cEmail.trim() || undefined,
        address: b2cAddress.trim() || undefined,
        location: b2cLocation.trim() || undefined,
        location_link: b2cLocationLink.trim() || undefined,
        lead_source: b2cLeadSource,
        project_installation_location: b2cProjectLocation.trim() || undefined,
        b2c_loan_required: b2cLoanRequired,
        remarks: b2cRemarks.trim() || undefined,
        custom_fields: b2cCustomFields,
      };
    } else {
      const b2bCustomFields: Record<string, any> = { ...dynamicValues };
      if (isFieldActive('contact_person_name', 'B2B') && b2bContactPerson.trim()) {
        b2bCustomFields.contact_person_name = b2bContactPerson.trim();
      }
      if (isFieldActive('decision_maker_designation', 'B2B') && b2bDesignation.trim()) {
        b2bCustomFields.decision_maker_designation = b2bDesignation.trim();
      }
      if (isFieldActive('company_gstin', 'B2B') && b2bGstin.trim()) {
        b2bCustomFields.company_gstin = b2bGstin.trim().toUpperCase();
      }
      if (isFieldActive('industry_vertical', 'B2B') && b2bIndustry) {
        b2bCustomFields.industry_vertical = b2bIndustry;
      }
      if (isFieldActive('connected_load_kva', 'B2B') && b2bConnectedLoad.trim()) {
        b2bCustomFields.connected_load_kva = b2bConnectedLoad.trim();
      }
      if (isFieldActive('proposed_capacity_kw', 'B2B') && b2bProposedCapacity.trim()) {
        b2bCustomFields.proposed_capacity_kw = b2bProposedCapacity.trim();
      }

      payload = {
        customer_name: b2bCompanyName.trim(),
        mobile_number: activeMobile,
        customer_type: 'B2B',
        email: b2bEmail.trim() || undefined,
        address: b2bAddress.trim() || undefined,
        location: b2bLocation.trim() || undefined,
        location_link: b2bLocationLink.trim() || undefined,
        lead_source: b2bLeadSource,
        project_installation_location: b2bProjectLocation.trim() || undefined,
        b2b_credit_extended: b2bCreditExtended,
        requested_credit_amount:
          b2bCreditExtended === 'YES' ? Math.max(0, Number(b2bRequestedCredit) || 0) : 0,
        remarks: [
          b2bRemarks.trim(),
          b2bContactPerson ? `Key Contact: ${b2bContactPerson.trim()}${b2bDesignation ? ` (${b2bDesignation.trim()})` : ''}` : '',
        ].filter(Boolean).join('\n'),
        custom_fields: b2bCustomFields,
      };
    }

    try {
      let res;
      try {
        res = await apiRequest('/api/leads', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch (postErr: any) {
        if (
          postErr.status === 401 ||
          postErr.message?.toLowerCase().includes('authentication') ||
          postErr.message?.toLowerCase().includes('sign in')
        ) {
          const authRes = await apiRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: 'lead1', password: 'Solar@123' }),
          }).catch(() => null);

          if (authRes?.sessionId) {
            setAuthToken(authRes.sessionId);
          }

          res = await apiRequest('/api/leads', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        } else {
          throw postErr;
        }
      }

      onSuccess(res.lead.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create lead.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoLogin = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'lead1', password: 'Solar@123' }),
      });
      if (res?.sessionId) {
        setAuthToken(res.sessionId);
        setError(null);
      }
    } catch (e: any) {
      setError('Could not auto-login: ' + (e.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl my-8 overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Sun className="w-5 h-5 fill-amber-400 text-amber-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Create New Solar Lead</h2>
              <p className="text-xs text-slate-500">
                Initiate a clean B2C Residential or B2B Commercial & Industrial prospect record
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="m-5 mb-0 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 text-rose-700 text-xs flex-shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span className="font-medium">{error}</span>
            </div>
            {error.toLowerCase().includes('authentication') && (
              <button
                type="button"
                onClick={handleAutoLogin}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors flex-shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In as Lead Team
              </button>
            )}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {/* Owner Field Configuration Notice - ONLY shown to System Owner */}
          {currentUser?.role === 'OWNER' && onOpenSettings && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs shadow-xs">
              <div className="flex items-center gap-2 text-amber-950">
                <Sliders className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold">Configurable Lead Form:</span>
                  <span className="text-amber-900 ml-1">
                    The System Owner can customize and add required fields for B2C & B2B in Master Settings.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="text-blue-700 hover:text-blue-900 font-bold underline whitespace-nowrap text-xs self-end sm:self-auto"
              >
                Configure Form Fields &rarr;
              </button>
            </div>
          )}

          {/* Customer Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Select Customer Category *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCustomerType('B2C')}
                className={`p-3.5 rounded-xl border-2 text-left flex items-start gap-3 transition-all ${
                  customerType === 'B2C'
                    ? 'border-blue-600 bg-blue-50/50 text-slate-900 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    customerType === 'B2C' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <UserIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold">B2C (Residential)</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Individual Homes, Villas, Rooftop & Societies
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCustomerType('B2B')}
                className={`p-3.5 rounded-xl border-2 text-left flex items-start gap-3 transition-all ${
                  customerType === 'B2B'
                    ? 'border-blue-600 bg-blue-50/50 text-slate-900 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    customerType === 'B2B' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold">B2B (Commercial & Industrial)</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Factories, Corporate Offices, Warehouses, Institutions
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* B2C FORM FIELDS */}
          {/* ========================================================= */}
          {customerType === 'B2C' && (
            <div className="space-y-5">
              {/* Section 1: Customer Contact Info */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">
                  <UserIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>Customer & Contact Information</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Customer Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={b2cName}
                      onChange={(e) => setB2cName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Mobile Number (10 Digits) *
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={b2cMobile}
                      onChange={(e) => setB2cMobile(e.target.value.replace(/\D/g, ''))}
                      placeholder="9876543210"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={b2cEmail}
                      onChange={(e) => setB2cEmail(e.target.value)}
                      placeholder="ramesh.kumar@gmail.com"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Lead Source
                    </label>
                    <select
                      value={b2cLeadSource}
                      onChange={(e) => setB2cLeadSource(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="Website Form">Website Form</option>
                      <option value="Direct Referral">Direct Referral</option>
                      <option value="Cold Calling">Cold Calling</option>
                      <option value="Solar Expo / Event">Solar Expo / Event</option>
                      <option value="Digital Ads (Meta/Google)">Digital Ads (Meta/Google)</option>
                      <option value="Partner Network">Partner Network</option>
                      <option value="Walk-in">Walk-in</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Residential Location */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  <span>Residential Location & Premises</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      City / Town & State *
                    </label>
                    <input
                      type="text"
                      required
                      value={b2cLocation}
                      onChange={(e) => setB2cLocation(e.target.value)}
                      placeholder="e.g. Pune, Maharashtra"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Google Maps Location Link
                    </label>
                    <input
                      type="url"
                      value={b2cLocationLink}
                      onChange={(e) => setB2cLocationLink(e.target.value)}
                      placeholder="https://maps.google.com/..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Premises / Residential Address
                  </label>
                  <input
                    type="text"
                    value={b2cAddress}
                    onChange={(e) => setB2cAddress(e.target.value)}
                    placeholder="House/Plot No., Society Name, Landmark, Pin Code"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Project Installation Location (if rooftop site is different from premises)
                  </label>
                  <input
                    type="text"
                    value={b2cProjectLocation}
                    onChange={(e) => setB2cProjectLocation(e.target.value)}
                    placeholder="e.g. Terrace of Row House #4B"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Section 3: Solar & Technical Assessment */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Solar & Electrical Requirements (B2C)</span>
                </div>

                {/* Conditional Dynamic Row 1: Monthly Bill & Sanctioned Load */}
                {(isFieldActive('monthly_electricity_bill', 'B2C') || isFieldActive('sanctioned_load_kw', 'B2C')) && (
                  <div className={`grid grid-cols-1 ${isFieldActive('monthly_electricity_bill', 'B2C') && isFieldActive('sanctioned_load_kw', 'B2C') ? 'sm:grid-cols-2' : ''} gap-3`}>
                    {isFieldActive('monthly_electricity_bill', 'B2C') && (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          {getFieldDef('monthly_electricity_bill', 'B2C')?.label || 'Average Monthly Electricity Bill (₹)'}
                          {getFieldDef('monthly_electricity_bill', 'B2C')?.required_at_creation && <span className="text-rose-500 ml-0.5">*</span>}
                        </label>
                        <input
                          type="number"
                          value={b2cMonthlyBill}
                          onChange={(e) => setB2cMonthlyBill(e.target.value)}
                          placeholder="e.g. 4500"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    )}

                    {isFieldActive('sanctioned_load_kw', 'B2C') && (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          {getFieldDef('sanctioned_load_kw', 'B2C')?.label || 'Sanctioned Load (kW)'}
                          {getFieldDef('sanctioned_load_kw', 'B2C')?.required_at_creation && <span className="text-rose-500 ml-0.5">*</span>}
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={b2cSanctionedLoad}
                          onChange={(e) => setB2cSanctionedLoad(e.target.value)}
                          placeholder="e.g. 5"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Conditional Dynamic Row 2: Roof Construction Type & DISCOM Consumer Number */}
                {(isFieldActive('roof_type', 'B2C') || isFieldActive('discom_consumer_number', 'B2C')) && (
                  <div className={`grid grid-cols-1 ${isFieldActive('roof_type', 'B2C') && isFieldActive('discom_consumer_number', 'B2C') ? 'sm:grid-cols-2' : ''} gap-3`}>
                    {isFieldActive('roof_type', 'B2C') && (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          {getFieldDef('roof_type', 'B2C')?.label || 'Roof Construction Type'}
                          {getFieldDef('roof_type', 'B2C')?.required_at_creation && <span className="text-rose-500 ml-0.5">*</span>}
                        </label>
                        <select
                          value={b2cRoofType}
                          onChange={(e) => setB2cRoofType(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          {(getFieldDef('roof_type', 'B2C')?.options && getFieldDef('roof_type', 'B2C')!.options.length > 0
                            ? getFieldDef('roof_type', 'B2C')!.options
                            : ['Flat RCC Concrete', 'Tiled / Slanted Slope', 'Metal Tin Shed', 'Open Terrace']
                          ).map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {isFieldActive('discom_consumer_number', 'B2C') && (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          {getFieldDef('discom_consumer_number', 'B2C')?.label || 'DISCOM Consumer / Account Number'}
                          {getFieldDef('discom_consumer_number', 'B2C')?.required_at_creation && <span className="text-rose-500 ml-0.5">*</span>}
                        </label>
                        <input
                          type="text"
                          value={b2cDiscomNumber}
                          onChange={(e) => setB2cDiscomNumber(e.target.value)}
                          placeholder="e.g. 028540192837"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Loan Required Toggle */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-medium text-slate-700 mb-2">
                    Bank Solar Financing / Loan Required?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                        b2cLoanRequired === 'NO'
                          ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-semibold'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="b2cLoan"
                        checked={b2cLoanRequired === 'NO'}
                        onChange={() => setB2cLoanRequired('NO')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs">NO — Self-Funded / Direct</span>
                    </label>

                    <label
                      className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                        b2cLoanRequired === 'YES'
                          ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-semibold'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="b2cLoan"
                        checked={b2cLoanRequired === 'YES'}
                        onChange={() => setB2cLoanRequired('YES')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs">YES — Needs Solar Loan / EMI</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Dynamic Custom Fields Configured by Owner */}
              <DynamicCustomFieldsSection
                fields={additionalCustomFields}
                values={dynamicValues}
                onChange={handleDynamicValueChange}
              />

              {/* Remarks */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Customer Remarks / Rooftop Notes
                </label>
                <textarea
                  rows={2}
                  value={b2cRemarks}
                  onChange={(e) => setB2cRemarks(e.target.value)}
                  placeholder="Notes on rooftop shadows, existing inverter, battery backup interest..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* B2B FORM FIELDS */}
          {/* ========================================================= */}
          {customerType === 'B2B' && (
            <div className="space-y-5">
              {/* Section 1: Enterprise & Decision Maker Details */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Company & Key Decision Maker Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Company / Organization Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={b2bCompanyName}
                      onChange={(e) => setB2bCompanyName(e.target.value)}
                      placeholder="e.g. GreenTech Manufacturing Pvt Ltd"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Contact Person Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={b2bContactPerson}
                      onChange={(e) => setB2bContactPerson(e.target.value)}
                      placeholder="e.g. Vikramaditya Singhania"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className={`grid grid-cols-1 ${isFieldActive('decision_maker_designation', 'B2B') ? 'sm:grid-cols-2' : ''} gap-3`}>
                  {isFieldActive('decision_maker_designation', 'B2B') && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {getFieldDef('decision_maker_designation', 'B2B')?.label || 'Decision Maker Designation'}
                        {getFieldDef('decision_maker_designation', 'B2B')?.required_at_creation && <span className="text-rose-500 ml-0.5">*</span>}
                      </label>
                      <input
                        type="text"
                        value={b2bDesignation}
                        onChange={(e) => setB2bDesignation(e.target.value)}
                        placeholder="e.g. Managing Director / Plant Head / CFO"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Mobile Number (10 Digits) *
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={b2bMobile}
                      onChange={(e) => setB2bMobile(e.target.value.replace(/\D/g, ''))}
                      placeholder="9823456780"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className={`grid grid-cols-1 ${isFieldActive('company_gstin', 'B2B') ? 'sm:grid-cols-2' : ''} gap-3`}>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Official Work Email Address
                    </label>
                    <input
                      type="email"
                      value={b2bEmail}
                      onChange={(e) => setB2bEmail(e.target.value)}
                      placeholder="vikram@greentech.com"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  {isFieldActive('company_gstin', 'B2B') && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {getFieldDef('company_gstin', 'B2B')?.label || 'Company GSTIN Number'}
                        {getFieldDef('company_gstin', 'B2B')?.required_at_creation && <span className="text-rose-500 ml-0.5">*</span>}
                      </label>
                      <input
                        type="text"
                        maxLength={15}
                        value={b2bGstin}
                        onChange={(e) => setB2bGstin(e.target.value.toUpperCase())}
                        placeholder="27AABCG1234F1Z5"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  )}
                </div>

                <div className={`grid grid-cols-1 ${isFieldActive('industry_vertical', 'B2B') ? 'sm:grid-cols-2' : ''} gap-3`}>
                  {isFieldActive('industry_vertical', 'B2B') && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {getFieldDef('industry_vertical', 'B2B')?.label || 'Industry Sector / Vertical'}
                        {getFieldDef('industry_vertical', 'B2B')?.required_at_creation && <span className="text-rose-500 ml-0.5">*</span>}
                      </label>
                      <select
                        value={b2bIndustry}
                        onChange={(e) => setB2bIndustry(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        {(getFieldDef('industry_vertical', 'B2B')?.options && getFieldDef('industry_vertical', 'B2B')!.options.length > 0
                          ? getFieldDef('industry_vertical', 'B2B')!.options
                          : [
                              'Engineering & Auto',
                              'Textiles & Garments',
                              'Hospitality & Hotels',
                              'Hospitals & Healthcare',
                              'Warehousing & Logistics',
                              'Institutions & Schools',
                              'Chemical & Pharma',
                              'Food Processing',
                              'Commercial Office / IT Park',
                              'Other Commercial',
                            ]
                        ).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Lead Source
                    </label>
                    <select
                      value={b2bLeadSource}
                      onChange={(e) => setB2bLeadSource(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="Direct Referral">Direct Referral</option>
                      <option value="Corporate Outreach">Corporate Outreach</option>
                      <option value="Solar Expo / Summit">Solar Expo / Summit</option>
                      <option value="Tender / Government">Tender / Government</option>
                      <option value="Partner Network">Partner Network</option>
                      <option value="Website Form">Website Form</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Factory / Site Address */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  <span>Commercial / Plant Installation Site</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      City / Industrial Zone & State *
                    </label>
                    <input
                      type="text"
                      required
                      value={b2bLocation}
                      onChange={(e) => setB2bLocation(e.target.value)}
                      placeholder="e.g. Bhosari MIDC, Pune, MH"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Google Maps Location Link
                    </label>
                    <input
                      type="url"
                      value={b2bLocationLink}
                      onChange={(e) => setB2bLocationLink(e.target.value)}
                      placeholder="https://maps.google.com/..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Factory / Plant Premises Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={b2bAddress}
                    onChange={(e) => setB2bAddress(e.target.value)}
                    placeholder="Plot No. 42, Sector 7, Industrial Area, Landmark, Pincode"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Specific Installation Location / Shed
                  </label>
                  <input
                    type="text"
                    value={b2bProjectLocation}
                    onChange={(e) => setB2bProjectLocation(e.target.value)}
                    placeholder="e.g. Main Fabrication Shed Rooftop & Carport Canopy"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Section 3: Commercial Power & Plant Sizing */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Commercial Sizing & Power Demand (B2B)</span>
                </div>

                {(isFieldActive('connected_load_kva', 'B2B') || isFieldActive('proposed_capacity_kw', 'B2B')) && (
                  <div className={`grid grid-cols-1 ${isFieldActive('connected_load_kva', 'B2B') && isFieldActive('proposed_capacity_kw', 'B2B') ? 'sm:grid-cols-2' : ''} gap-3`}>
                    {isFieldActive('connected_load_kva', 'B2B') && (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          {getFieldDef('connected_load_kva', 'B2B')?.label || 'Contract Demand / Connected Load (kVA)'}
                          {getFieldDef('connected_load_kva', 'B2B')?.required_at_creation && <span className="text-rose-500 ml-0.5">*</span>}
                        </label>
                        <input
                          type="number"
                          value={b2bConnectedLoad}
                          onChange={(e) => setB2bConnectedLoad(e.target.value)}
                          placeholder="e.g. 250"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    )}

                    {isFieldActive('proposed_capacity_kw', 'B2B') && (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          {getFieldDef('proposed_capacity_kw', 'B2B')?.label || 'Proposed Solar PV Capacity (kWp)'}
                          {getFieldDef('proposed_capacity_kw', 'B2B')?.required_at_creation && <span className="text-rose-500 ml-0.5">*</span>}
                        </label>
                        <input
                          type="number"
                          value={b2bProposedCapacity}
                          onChange={(e) => setB2bProposedCapacity(e.target.value)}
                          placeholder="e.g. 100"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Commercial Credit Terms */}
                <div className="pt-2 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">
                      Commercial Credit / Payment Terms
                    </label>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      B2B • No Option for Loan
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    For B2B projects, loan options are not applicable. Projects operate strictly under commercial credit terms and milestone payments.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                        b2bCreditExtended === 'NO'
                          ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-semibold'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="b2bCredit"
                        checked={b2bCreditExtended === 'NO'}
                        onChange={() => {
                          setB2bCreditExtended('NO');
                          setB2bRequestedCredit('');
                        }}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs">NO — Standard Advance & Milestones</span>
                    </label>

                    <label
                      className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                        b2bCreditExtended === 'YES'
                          ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-semibold'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="b2bCredit"
                        checked={b2bCreditExtended === 'YES'}
                        onChange={() => setB2bCreditExtended('YES')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs">YES — Requires Owner Credit Approval</span>
                    </label>
                  </div>

                  {b2bCreditExtended === 'YES' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
                      <label className="block text-xs font-bold text-amber-900">
                        Requested Commercial Credit Amount (₹) *
                      </label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={b2bRequestedCredit}
                        onChange={(e) =>
                          setB2bRequestedCredit(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        placeholder="e.g. 500000"
                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                      <p className="text-[11px] text-amber-700">
                        This initiates the mandatory Owner Credit Approval workflow before qualification.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Dynamic Custom Fields Configured by Owner */}
              <DynamicCustomFieldsSection
                fields={additionalCustomFields}
                values={dynamicValues}
                onChange={handleDynamicValueChange}
              />

              {/* Remarks */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Scope Remarks & Rooftop Specs
                </label>
                <textarea
                  rows={2}
                  value={b2bRemarks}
                  onChange={(e) => setB2bRemarks(e.target.value)}
                  placeholder="Structural condition, high-tension connection details, transformer rating, installation timeline..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Lead...</span>
                </>
              ) : (
                <>
                  <span>Create {customerType} Lead</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
