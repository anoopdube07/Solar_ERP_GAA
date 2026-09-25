import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Package,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  MapPin,
  Phone,
  User as UserIcon,
  Calendar,
  ArrowRight,
  Eye,
  FileText,
  Printer,
  Navigation,
  Search,
  Filter,
  RefreshCw,
  Landmark,
  Building2,
  ChevronRight,
  ExternalLink,
  Receipt,
  RotateCcw,
  Sparkles,
  Layers,
  Check,
} from 'lucide-react';
import {
  User,
  DispatchQueueItem,
  DispatchMetrics,
  CustomerType,
} from '../../shared/types';
import { RecordReceiptModal } from './RecordReceiptModal';

interface DispatchWorkspaceProps {
  currentUser: User;
  onOpenLeadDetails: (leadId: string) => void;
  initialTab?: 'all' | 'gate' | 'ready' | 'transit' | 'delivered';
}

export const DispatchWorkspace: React.FC<DispatchWorkspaceProps> = ({
  currentUser,
  onOpenLeadDetails,
  initialTab = 'all',
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'gate' | 'ready' | 'transit' | 'delivered'>(initialTab);
  const [queue, setQueue] = useState<DispatchQueueItem[]>([]);
  const [metrics, setMetrics] = useState<DispatchMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'ALL' | CustomerType>('ALL');

  // Modals state
  const [selectedLeadForShipment, setSelectedLeadForShipment] = useState<DispatchQueueItem | null>(null);
  const [selectedLeadForDelivery, setSelectedLeadForDelivery] = useState<DispatchQueueItem | null>(null);
  const [selectedLeadForChallan, setSelectedLeadForChallan] = useState<DispatchQueueItem | null>(null);
  const [selectedLeadForReceipt, setSelectedLeadForReceipt] = useState<DispatchQueueItem | null>(null);
  const [showRecordReceiptModal, setShowRecordReceiptModal] = useState(false);

  // Shipment Form state
  const [transporterName, setTransporterName] = useState('V-Trans India Ltd');
  const [customTransporter, setCustomTransporter] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState(
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [isSubmittingShipment, setIsSubmittingShipment] = useState(false);
  const [shipmentError, setShipmentError] = useState<string | null>(null);

  // Delivery Form state
  const [actualDeliveryDate, setActualDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryChallanNumber, setDeliveryChallanNumber] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  // Handoff / Clear Dispatch state
  const [clearingLeadId, setClearingLeadId] = useState<string | null>(null);
  const [handoffSuccessMessage, setHandoffSuccessMessage] = useState<string | null>(null);

  // Challan Data Modal
  const [challanLoading, setChallanLoading] = useState(false);
  const [challanData, setChallanData] = useState<any>(null);

  // Load Dispatch Data
  const loadDispatchData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [metricsRes, queueRes] = await Promise.all([
        fetch('/api/dispatch/metrics'),
        fetch('/api/dispatch/queue'),
      ]);

      if (!metricsRes.ok || !queueRes.ok) {
        throw new Error('Failed to load dispatch module records.');
      }

      const metricsData = await metricsRes.json();
      const queueData = await queueRes.json();

      setMetrics(metricsData);
      setQueue(queueData);
    } catch (err: any) {
      console.error('Error fetching dispatch data:', err);
      setError(err.message || 'Unable to connect to dispatch server.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadDispatchData();
  }, []);

  // Filtered Queue
  const filteredQueue = useMemo(() => {
    return queue.filter((item) => {
      if (customerTypeFilter !== 'ALL' && item.customer_type !== customerTypeFilter) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = item.customer_name?.toLowerCase().includes(q);
        const matchLeadNo = String(item.lead_number).includes(q);
        const matchMobile = item.mobile_number?.toLowerCase().includes(q);
        const matchCity = item.project_installation_location?.toLowerCase().includes(q);
        const matchTransporter = (item.dispatch_record?.transporter_name || (item as any).transporter_name)?.toLowerCase().includes(q);
        const matchLR = (item.dispatch_record?.lr_number || (item as any).lr_number)?.toLowerCase().includes(q);
        const matchVehicle = (item.dispatch_record?.vehicle_number || (item as any).vehicle_number)?.toLowerCase().includes(q);

        if (!matchName && !matchLeadNo && !matchMobile && !matchCity && !matchTransporter && !matchLR && !matchVehicle) {
          return false;
        }
      }

      // Tab Filtering
      if (activeTab === 'gate') {
        // Gate view shows projects pending clearance / advance
        return item.dispatch_status === 'PENDING_ADVANCE';
      }
      if (activeTab === 'ready') {
        // Cleared and ready for warehouse shipment
        return item.dispatch_status === 'DISPATCH_CLEARED';
      }
      if (activeTab === 'transit') {
        // Dispatched and in-transit
        return item.dispatch_status === 'DISPATCHED';
      }
      if (activeTab === 'delivered') {
        // Delivered to site
        return item.dispatch_status === 'DELIVERED';
      }

      return true;
    });
  }, [queue, customerTypeFilter, searchTerm, activeTab]);

  // Handle Handoff / Clearance action
  const handleClearOrHandoff = async (item: DispatchQueueItem) => {
    setClearingLeadId(item.id);
    setError(null);
    setHandoffSuccessMessage(null);
    try {
      const res = await fetch('/api/dispatch/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: item.id,
          notes: `Cleared and handed off to Dispatch Team by ${currentUser.name}.`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to handoff project to Dispatch.');
      }

      setHandoffSuccessMessage(data.message || 'Project successfully handed off to Dispatch!');
      await loadDispatchData(true);
      setTimeout(() => setHandoffSuccessMessage(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Error occurred during handoff.');
    } finally {
      setClearingLeadId(null);
    }
  };

  // Open Shipment Booking Modal
  const handleOpenShipmentModal = (item: DispatchQueueItem) => {
    setSelectedLeadForShipment(item);
    setTransporterName(item.dispatch_record?.transporter_name || 'V-Trans India Ltd');
    setCustomTransporter('');
    setLrNumber(item.dispatch_record?.lr_number || `LR-${Math.floor(100000 + Math.random() * 900000)}`);
    setVehicleNumber(item.dispatch_record?.vehicle_number || '');
    setDriverName(item.dispatch_record?.driver_name || '');
    setDriverPhone(item.dispatch_record?.driver_phone || '');
    setDispatchDate(new Date().toISOString().split('T')[0]);
    setEstimatedDeliveryDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setDispatchNotes(item.dispatch_record?.dispatch_notes || `Solar modules & BOS dispatched for ${item.customer_name}`);
    setShipmentError(null);
  };

  // Submit Shipment Booking
  const handleSubmitShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadForShipment) return;

    const finalTransporter = transporterName === 'OTHER' ? customTransporter.trim() : transporterName;
    if (!finalTransporter) {
      setShipmentError('Please specify the transporter name.');
      return;
    }
    if (!lrNumber.trim()) {
      setShipmentError('Please provide LR / Tracking Number.');
      return;
    }
    if (!vehicleNumber.trim()) {
      setShipmentError('Please enter the delivery vehicle number.');
      return;
    }

    setIsSubmittingShipment(true);
    setShipmentError(null);

    try {
      const res = await fetch('/api/dispatch/shipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: selectedLeadForShipment.id,
          transporter_name: finalTransporter,
          lr_number: lrNumber.trim().toUpperCase(),
          vehicle_number: vehicleNumber.trim().toUpperCase(),
          driver_name: driverName.trim(),
          driver_phone: driverPhone.trim(),
          dispatch_date: dispatchDate,
          estimated_delivery_date: estimatedDeliveryDate,
          dispatch_notes: dispatchNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record shipment.');
      }

      setSelectedLeadForShipment(null);
      await loadDispatchData(true);
      setActiveTab('transit');
    } catch (err: any) {
      setShipmentError(err.message || 'Failed to record shipment.');
    } finally {
      setIsSubmittingShipment(false);
    }
  };

  // Open Delivery Modal
  const handleOpenDeliveryModal = (item: DispatchQueueItem) => {
    setSelectedLeadForDelivery(item);
    setActualDeliveryDate(new Date().toISOString().split('T')[0]);
    setDeliveryChallanNumber(`DC-${String(item.lead_number).replace(/\D/g, '') || Date.now().toString().slice(-5)}`);
    setDeliveryNotes('Materials safely inspected and handed over at customer site.');
    setDeliveryError(null);
  };

  // Submit Delivery to Site & Handover to Installation Team
  const handleSubmitDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadForDelivery) return;

    setIsSubmittingDelivery(true);
    setDeliveryError(null);

    try {
      const res = await fetch('/api/dispatch/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: selectedLeadForDelivery.id,
          actual_delivery_date: actualDeliveryDate,
          delivery_challan_number: deliveryChallanNumber.trim(),
          delivery_notes: deliveryNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record delivery.');
      }

      setSelectedLeadForDelivery(null);
      await loadDispatchData(true);
      setActiveTab('delivered');
      alert(data.message || 'Delivery recorded! Project handed over to Installation Team.');
    } catch (err: any) {
      setDeliveryError(err.message || 'Failed to record delivery.');
    } finally {
      setIsSubmittingDelivery(false);
    }
  };

  // Open Delivery Challan Modal
  const handleOpenChallan = async (item: DispatchQueueItem) => {
    setSelectedLeadForChallan(item);
    setChallanLoading(true);
    setChallanData(null);
    try {
      const res = await fetch(`/api/dispatch/challan/${item.id}`);
      if (!res.ok) throw new Error('Failed to load delivery challan.');
      const data = await res.json();
      setChallanData(data);
    } catch (err) {
      console.error('Failed to load challan data:', err);
    } finally {
      setChallanLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-y-auto">
      {/* Top Banner & Title */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-xs sticky top-0 z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Dispatch & Logistics Command</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    Dispatch Team
                  </span>
                </h1>
                <p className="text-xs text-slate-500">
                  Material allocation, logistics booking, LR tracking, delivery challans & installation handoff
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadDispatchData(false)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Global Alert / Success Message */}
        {handoffSuccessMessage && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{handoffSuccessMessage}</span>
          </div>
        )}

        {/* B2C Strict Rule Highlight Bar */}
        <div className="mt-3 p-2.5 rounded-xl bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200/80 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="text-rose-950 font-bold">Hard Business Rule:</span>
            <span className="text-rose-900">
              For B2C projects, <strong>shall have no handoff to dispatch</strong> until at least one receipt is recorded by Accounts for an amount <strong>not less than ₹1</strong>.
            </span>
          </div>
          <span className="shrink-0 px-2 py-0.5 rounded bg-rose-200/70 text-rose-900 text-[10px] font-black uppercase tracking-wider">
            Strict Gate
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto w-full">
        {/* Interactive KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* Card 1: All Projects */}
          <div
            onClick={() => setActiveTab('all')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold">Total Pipeline</span>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-xl font-black text-slate-900">
              {metrics?.total_projects || 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              B2C: {metrics?.b2c_total || 0} • B2B: {metrics?.b2b_total || 0}
            </div>
          </div>

          {/* Card 2: Gate Blocked */}
          <div
            onClick={() => setActiveTab('gate')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'gate'
                ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-rose-600 mb-1">
              <span className="text-xs font-bold flex items-center gap-1">
                <span>Gate Blocked</span>
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              </span>
              <XCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-black text-rose-600">
              {metrics?.blocked_b2c_count || 0}
            </div>
            <div className="text-[10px] text-rose-700 mt-1 font-medium">
              B2C no receipt ≥ ₹1
            </div>
          </div>

          {/* Card 3: Ready for Dispatch */}
          <div
            onClick={() => setActiveTab('ready')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'ready'
                ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-amber-600 mb-1">
              <span className="text-xs font-bold">Ready to Ship</span>
              <Package className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-black text-amber-700">
              {metrics?.cleared_ready_count || 0}
            </div>
            <div className="text-[10px] text-amber-700 mt-1 font-medium">
              Accounts Cleared
            </div>
          </div>

          {/* Card 4: In Transit */}
          <div
            onClick={() => setActiveTab('transit')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'transit'
                ? 'bg-purple-50/80 border-purple-400 ring-2 ring-purple-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-purple-600 mb-1">
              <span className="text-xs font-bold">In Transit</span>
              <Navigation className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-xl font-black text-purple-700">
              {metrics?.in_transit_count || 0}
            </div>
            <div className="text-[10px] text-purple-700 mt-1 font-medium">
              On Road / LR Active
            </div>
          </div>

          {/* Card 5: Delivered to Site */}
          <div
            onClick={() => setActiveTab('delivered')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'delivered'
                ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-emerald-600 mb-1">
              <span className="text-xs font-bold">Delivered</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-black text-emerald-700">
              {metrics?.delivered_count || 0}
            </div>
            <div className="text-[10px] text-emerald-700 mt-1 font-medium">
              At Site (Inst Team)
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          {currentUser.role !== 'DISPATCH' ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Tab Selector Buttons */}
              <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600 w-full sm:w-auto overflow-x-auto">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                    activeTab === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  All Projects ({queue.length})
                </button>
                <button
                  onClick={() => setActiveTab('gate')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${
                    activeTab === 'gate'
                      ? 'bg-rose-50 text-rose-700 shadow-xs font-black'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
                  <span>Gate Blocked ({metrics?.blocked_b2c_count || 0})</span>
                </button>
                <button
                  onClick={() => setActiveTab('ready')}
                  className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                    activeTab === 'ready'
                      ? 'bg-amber-50 text-amber-800 shadow-xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Ready to Ship ({metrics?.cleared_ready_count || 0})
                </button>
                <button
                  onClick={() => setActiveTab('transit')}
                  className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                    activeTab === 'transit'
                      ? 'bg-purple-50 text-purple-800 shadow-xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  In Transit ({metrics?.in_transit_count || 0})
                </button>
                <button
                  onClick={() => setActiveTab('delivered')}
                  className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                    activeTab === 'delivered'
                      ? 'bg-emerald-50 text-emerald-800 shadow-xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Delivered ({metrics?.delivered_count || 0})
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="font-bold text-slate-800">
                {activeTab === 'all'
                  ? 'All Projects'
                  : activeTab === 'gate'
                  ? 'Gate Blocked'
                  : activeTab === 'ready'
                  ? 'Ready to Ship'
                  : activeTab === 'transit'
                  ? 'In Transit'
                  : 'Delivered'}
              </span>
              <span>•</span>
              <span>{filteredQueue.length} {filteredQueue.length === 1 ? 'project' : 'projects'} in view</span>
            </div>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Customer Type Filter */}
            <div className="inline-flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              {(['ALL', 'B2C', 'B2B'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setCustomerTypeFilter(type)}
                  className={`px-2.5 py-1 rounded-md transition-colors text-xs ${
                    customerTypeFilter === type
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {type === 'ALL' ? 'All Types' : type}
                </button>
              ))}
            </div>

            {/* Quick Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name, lead #, LR, vehicle..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-slate-400 hover:text-slate-600 text-xs absolute right-2.5 top-1/2 -translate-y-1/2"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Tab Explanation Banner when in Gate Tab */}
        {activeTab === 'gate' && (
          <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="text-xs text-rose-950">
              <h3 className="text-sm font-bold text-rose-900 flex items-center gap-1.5">
                <span>Dispatch Clearance Gate: B2C Hard Rule Enforcement</span>
                <span className="px-1.5 py-0.5 rounded bg-rose-200 text-rose-800 text-[10px] font-black uppercase">
                  Zero Advance = No Dispatch
                </span>
              </h3>
              <p className="mt-1 leading-relaxed text-rose-900/90">
                In Solar ERP, <strong>for B2C projects, no handoff to dispatch is allowed until at least one receipt is recorded by Accounts for an amount not less than ₹1</strong>.
                If no receipt is recorded, handoff to dispatch is strictly locked. Once accounts records an advance receipt, this project can be cleared for packaging and logistics.
              </p>
            </div>
          </div>
        )}

        {/* Master Dispatch Grid */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Project & Customer</th>
                  <th className="py-3 px-3">Type & City</th>
                  <th className="py-3 px-3 text-right">Project Value</th>
                  <th className="py-3 px-3">Receipts & Gate Compliance</th>
                  <th className="py-3 px-3">Logistics & Tracking</th>
                  <th className="py-3 px-3">Dispatch Status</th>
                  <th className="py-3 px-4 text-center">Dispatch Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                        <span>Loading dispatch queue...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredQueue.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Truck className="w-8 h-8 text-slate-300" />
                        <span className="font-semibold text-slate-600">No dispatch projects found</span>
                        <span className="text-slate-400 text-xs">Try clearing filters or search terms</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredQueue.map((item) => {
                    const isB2C = item.customer_type === 'B2C';
                    const isB2B = item.customer_type === 'B2B';
                    const b2cRuleSatisfied = item.b2c_receipt_satisfied;
                    const b2bRuleSatisfied = item.b2b_dispatch_satisfied;
                    const canHandoffOrClear = isB2C ? b2cRuleSatisfied : b2bRuleSatisfied;
                    const isCleared = item.dispatch_status === 'DISPATCH_CLEARED';
                    const isDispatched = item.dispatch_status === 'DISPATCHED';
                    const isDelivered = item.dispatch_status === 'DELIVERED';
                    const isPendingGate = item.dispatch_status === 'PENDING_ADVANCE';

                    const dispRec = item.dispatch_record;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* 1. Project & Customer */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                isB2C
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {item.customer_type}
                            </span>
                            <button
                              onClick={() => onOpenLeadDetails(item.id)}
                              className="font-bold text-slate-900 hover:text-blue-600 transition-colors text-left flex items-center gap-1 group"
                            >
                              <span>{item.customer_name}</span>
                              <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-blue-500 transition-transform group-hover:translate-x-0.5" />
                            </button>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                            <span>{item.lead_number}</span>
                            <span>•</span>
                            <span>{item.mobile_number}</span>
                            {item.lead_owner_name && (
                              <>
                                <span>•</span>
                                <span className="text-slate-600 font-medium">Lead: {item.lead_owner_name}</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* 2. Type & City */}
                        <td className="py-3.5 px-3">
                          <div className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[120px]">
                              {item.project_installation_location || 'Customer Site'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {item.capacity_kwp ? `${item.capacity_kwp} kWp Solar` : 'Rooftop Solar'}
                          </div>
                        </td>

                        {/* 3. Project Value */}
                        <td className="py-3.5 px-3 text-right">
                          <div className="font-bold text-slate-900">
                            ₹{item.total_project_value.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Rec: ₹{item.total_received.toLocaleString('en-IN')}
                          </div>
                        </td>

                        {/* 4. Receipts & Gate Compliance */}
                        <td className="py-3.5 px-3">
                          {isB2C ? (
                            <div className="space-y-1">
                              {b2cRuleSatisfied ? (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>Receipt Verified (≥ ₹1)</span>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                  <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                                  <span>Blocked: No Receipt ≥ ₹1</span>
                                </div>
                              )}
                              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                <Receipt className="w-3 h-3 text-slate-400" />
                                <span>
                                  {item.receipt_count > 0
                                    ? `${item.receipt_count} Receipt(s) (₹${item.total_received.toLocaleString('en-IN')})`
                                    : '0 Receipts recorded'}
                                </span>
                              </div>
                              {item.first_receipt_number && (
                                <div className="text-[9px] text-slate-400 font-mono">
                                  Ref: {item.first_receipt_number} ({item.first_receipt_date})
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {b2bRuleSatisfied ? (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                  <CheckCircle2 className="w-3 h-3 text-blue-600 shrink-0" />
                                  <span>Credit Terms Cleared</span>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>Awaiting Upfront/Approval</span>
                                </div>
                              )}
                              <div className="text-[10px] text-slate-500">
                                Rec: ₹{item.total_received.toLocaleString('en-IN')}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* 5. Logistics & Tracking */}
                        <td className="py-3.5 px-3">
                          {isDispatched || isDelivered ? (
                            <div className="space-y-0.5 text-xs">
                              <div className="font-semibold text-slate-900 flex items-center gap-1">
                                <Truck className="w-3 h-3 text-blue-600 shrink-0" />
                                <span>{dispRec?.transporter_name || (item as any).transporter_name || 'Standard Freight'}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                <span>LR: {dispRec?.lr_number || (item as any).lr_number || 'Pending'}</span>
                                <span>•</span>
                                <span>{dispRec?.vehicle_number || (item as any).vehicle_number || ''}</span>
                              </div>
                              {dispRec?.driver_phone && (
                                <div className="text-[10px] text-blue-600 flex items-center gap-1">
                                  <Phone className="w-2.5 h-2.5" />
                                  <span>{dispRec.driver_phone}</span>
                                </div>
                              )}
                            </div>
                          ) : isCleared ? (
                            <div className="text-xs text-amber-800 font-medium flex items-center gap-1">
                              <Package className="w-3.5 h-3.5 text-amber-600" />
                              <span>Ready for packaging & booking</span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400 italic">
                              Awaiting Accounts clearance
                            </div>
                          )}
                        </td>

                        {/* 6. Dispatch Status */}
                        <td className="py-3.5 px-3">
                          {isDelivered ? (
                            <div className="inline-flex flex-col items-start gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>DELIVERED AT SITE</span>
                              </span>
                              <span className="text-[9px] text-slate-400">
                                Handed to Installation Team
                              </span>
                            </div>
                          ) : isDispatched ? (
                            <div className="inline-flex flex-col items-start gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                                <Navigation className="w-3 h-3 text-purple-600" />
                                <span>IN TRANSIT</span>
                              </span>
                              <span className="text-[9px] text-slate-400">
                                Expected: {dispRec?.estimated_delivery_date || (item as any).estimated_delivery_date || 'In 2 days'}
                              </span>
                            </div>
                          ) : isCleared ? (
                            <div className="inline-flex flex-col items-start gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                <Package className="w-3 h-3 text-amber-600" />
                                <span>DISPATCH CLEARED</span>
                              </span>
                              <span className="text-[9px] text-slate-400">Ready for booking</span>
                            </div>
                          ) : (
                            <div className="inline-flex flex-col items-start gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                <XCircle className="w-3 h-3 text-rose-600" />
                                <span>DISPATCH BLOCKED</span>
                              </span>
                              <span className="text-[9px] text-rose-600 font-medium">
                                {isB2C ? 'Needs receipt ≥ ₹1' : 'Credit terms pending'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 7. Dispatch Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {/* If Gate Blocked (Pending Advance) */}
                            {isPendingGate && (
                              <>
                                {canHandoffOrClear ? (
                                  <button
                                    onClick={() => handleClearOrHandoff(item)}
                                    disabled={clearingLeadId === item.id}
                                    className="px-2 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shadow-xs"
                                    title="Receipt verified! Clear project and send to Dispatch Team."
                                  >
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>Handoff to Dispatch</span>
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <button
                                      disabled
                                      className="px-2 py-1 text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-lg cursor-not-allowed whitespace-nowrap"
                                      title={
                                        isB2C
                                          ? 'Hard Rule: No handoff to dispatch until at least one receipt is recorded by accounts for amount not less than Rs.1.'
                                          : 'B2B credit terms not satisfied.'
                                      }
                                    >
                                      Handoff Blocked
                                    </button>
                                    {(currentUser.role === 'OWNER' || currentUser.role === 'ACCOUNTS' || currentUser.role === 'MANAGER') && (
                                      <button
                                        onClick={() => {
                                          setSelectedLeadForReceipt(item);
                                          setShowRecordReceiptModal(true);
                                        }}
                                        className="px-2 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap"
                                        title="Record payment receipt in Accounts"
                                      >
                                        Record Receipt
                                      </button>
                                    )}
                                  </div>
                                )}
                              </>
                            )}

                            {/* If Cleared for Dispatch -> Action: Book Shipment */}
                            {isCleared && (
                              <button
                                onClick={() => handleOpenShipmentModal(item)}
                                className="px-2.5 py-1 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shadow-xs"
                                title="Book transporter & issue LR for material dispatch"
                              >
                                <Truck className="w-3 h-3" />
                                <span>Book & Dispatch</span>
                              </button>
                            )}

                            {/* If In Transit -> Action: Mark Delivered */}
                            {isDispatched && (
                              <button
                                onClick={() => handleOpenDeliveryModal(item)}
                                className="px-2.5 py-1 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shadow-xs"
                                title="Record site delivery & handover to Installation Team"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Mark Delivered</span>
                              </button>
                            )}

                            {/* Delivery Challan Button (Available for Cleared, Dispatched, or Delivered) */}
                            {(isCleared || isDispatched || isDelivered) && (
                              <button
                                onClick={() => handleOpenChallan(item)}
                                className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors"
                                title="View Delivery Challan / BOM details"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Details Button */}
                            <button
                              onClick={() => onOpenLeadDetails(item.id)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                              title="View Lead Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL 1: Book Shipment & Dispatch */}
      {selectedLeadForShipment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-amber-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Book Shipment & Mark Dispatched
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedLeadForShipment.customer_name} ({selectedLeadForShipment.lead_number})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLeadForShipment(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitShipment} className="p-5 space-y-4 overflow-y-auto flex-1">
              {shipmentError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{shipmentError}</span>
                </div>
              )}

              {/* Destination Address Preview */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="flex items-center gap-1 font-bold text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>Destination Site:</span>
                </div>
                <div className="text-slate-600 pl-4.5">
                  {selectedLeadForShipment.project_installation_location || 'Customer Site Address'}
                </div>
              </div>

              {/* Transporter Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Transporter / Logistics Partner *
                </label>
                <select
                  value={transporterName}
                  onChange={(e) => setTransporterName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  required
                >
                  <option value="V-Trans India Ltd">V-Trans India Ltd</option>
                  <option value="TCI Freight">TCI Freight (Transport Corp of India)</option>
                  <option value="Safexpress Logistics">Safexpress Logistics</option>
                  <option value="Blue Dart Freight">Blue Dart Surface Express</option>
                  <option value="Delhivery Surface">Delhivery Heavy Surface</option>
                  <option value="Company Direct Fleet">Company Direct Fleet (Eicher / Pickup)</option>
                  <option value="Local Mini Truck / Tempo">Local Mini Truck / Tempo</option>
                  <option value="OTHER">Other / Custom Transporter</option>
                </select>

                {transporterName === 'OTHER' && (
                  <input
                    type="text"
                    value={customTransporter}
                    onChange={(e) => setCustomTransporter(e.target.value)}
                    placeholder="Enter transporter company name"
                    className="mt-2 w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                )}
              </div>

              {/* LR Number & Vehicle Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    LR / Consignment Note # *
                  </label>
                  <input
                    type="text"
                    value={lrNumber}
                    onChange={(e) => setLrNumber(e.target.value)}
                    placeholder="e.g. VT-982341"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Vehicle Number *
                  </label>
                  <input
                    type="text"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder="e.g. MH 12 AB 1234"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                    required
                  />
                </div>
              </div>

              {/* Driver Name & Driver Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Driver Name
                  </label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Driver full name"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Driver Contact Phone
                  </label>
                  <input
                    type="text"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Dispatch Date & Expected Arrival */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dispatch Date *
                  </label>
                  <input
                    type="date"
                    value={dispatchDate}
                    onChange={(e) => setDispatchDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estimated Delivery Date
                  </label>
                  <input
                    type="date"
                    value={estimatedDeliveryDate}
                    onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Dispatch Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Dispatch & Packaging Remarks
                </label>
                <textarea
                  rows={2}
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  placeholder="e.g. Modules, Inverter & Earthing Kits securely bundled and loaded."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedLeadForShipment(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingShipment}
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>{isSubmittingShipment ? 'Booking...' : 'Confirm Dispatch (Ship Materials)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Mark Delivered & Handover to Installation Team */}
      {selectedLeadForDelivery && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-emerald-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Confirm Delivery & Handover to Installation
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedLeadForDelivery.customer_name} ({selectedLeadForDelivery.lead_number})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLeadForDelivery(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitDelivery} className="p-5 space-y-4">
              {deliveryError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{deliveryError}</span>
                </div>
              )}

              {/* Handover Notice */}
              <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Automatic Team Transfer:</span>
                </div>
                <p className="text-emerald-900/90 text-[11px] leading-relaxed">
                  Upon confirming delivery, this project will automatically transition to <strong>Installation Team</strong> for structure erection, module mounting, and commissioning!
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Actual Delivery Date *
                </label>
                <input
                  type="date"
                  value={actualDeliveryDate}
                  onChange={(e) => setActualDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Delivery Challan (DC) #
                </label>
                <input
                  type="text"
                  value={deliveryChallanNumber}
                  onChange={(e) => setDeliveryChallanNumber(e.target.value)}
                  placeholder="e.g. DC-10492"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Site Receiving & Inspection Notes
                </label>
                <textarea
                  rows={2}
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="e.g. Materials delivered safely. Customer received and signed delivery challan."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedLeadForDelivery(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDelivery}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSubmittingDelivery ? 'Confirming...' : 'Mark Delivered & Transfer to Installation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Printable Delivery Challan */}
      {selectedLeadForChallan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-700" />
                <span className="font-bold text-slate-900 text-sm">Delivery Challan & Dispatch Note</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                >
                  <Printer className="w-3 h-3" />
                  <span>Print Challan</span>
                </button>
                <button
                  onClick={() => setSelectedLeadForChallan(null)}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-700">
              {challanLoading ? (
                <div className="py-12 text-center text-slate-400">Loading Challan details...</div>
              ) : (
                <>
                  {/* Header */}
                  <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
                    <div>
                      <h2 className="text-base font-black text-slate-900 tracking-tight">SOLAR EPC ENTERPRISE</h2>
                      <p className="text-[11px] text-slate-500">Material Dispatch & Logistics Division</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">GSTIN: 27AAACS1429B1Z8</p>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-black text-xs uppercase tracking-wider">
                        Delivery Challan
                      </span>
                      <p className="text-[11px] font-bold text-slate-900 mt-1">
                        DC #: {challanData?.lead?.delivery_challan_number || `DC-${String(selectedLeadForChallan.lead_number).replace(/\D/g, '') || '001'}`}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Date: {challanData?.lead?.actual_delivery_date || challanData?.lead?.dispatch_date || new Date().toISOString().split('T')[0]}
                      </p>
                    </div>
                  </div>

                  {/* Parties Details */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Consignee (Customer)</span>
                      <p className="font-bold text-slate-900 text-xs mt-0.5">{selectedLeadForChallan.customer_name}</p>
                      <p className="text-slate-600 text-[11px] mt-0.5">{selectedLeadForChallan.project_installation_location || 'Customer Site'}</p>
                      <p className="text-slate-500 text-[10px] mt-0.5">Phone: {selectedLeadForChallan.mobile_number}</p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Transport & Dispatch Info</span>
                      <p className="font-bold text-slate-900 text-xs mt-0.5">
                        Transporter: {challanData?.lead?.transporter_name || 'V-Trans India'}
                      </p>
                      <p className="text-slate-600 text-[11px] mt-0.5">
                        LR #: {challanData?.lead?.lr_number || 'N/A'} • Vehicle: {challanData?.lead?.vehicle_number || 'N/A'}
                      </p>
                      <p className="text-slate-500 text-[10px] mt-0.5">
                        Driver: {challanData?.lead?.driver_name || 'Assigned'} ({challanData?.lead?.driver_phone || 'N/A'})
                      </p>
                    </div>
                  </div>

                  {/* Bill of Materials (BOM) Table */}
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs mb-2">Material / Bill of Materials (BOM) Checklist</h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-slate-100 text-slate-500 font-semibold text-[10px] uppercase">
                          <tr>
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-3">Item Description</th>
                            <th className="py-2 px-3 text-right">Qty</th>
                            <th className="py-2 px-3">UOM</th>
                            <th className="py-2 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {challanData?.items?.length > 0 ? (
                            challanData.items.map((it: any, idx: number) => (
                              <tr key={it.id || idx}>
                                <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                                <td className="py-2 px-3 font-semibold text-slate-900">{it.item_name}</td>
                                <td className="py-2 px-3 text-right font-bold text-slate-800">{it.quantity}</td>
                                <td className="py-2 px-3 text-slate-500">{it.default_uom || 'Nos'}</td>
                                <td className="py-2 px-3 text-center">
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                                    Dispatched
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                                Standard Solar Rooftop Kit (PV Modules, On-Grid Inverter, Structures & BOS)
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Signature Blocks */}
                  <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200 text-center">
                    <div>
                      <div className="h-10 border-b border-dashed border-slate-300"></div>
                      <p className="text-[10px] font-bold text-slate-600 mt-1">Prepared By (Dispatch Team)</p>
                    </div>
                    <div>
                      <div className="h-10 border-b border-dashed border-slate-300"></div>
                      <p className="text-[10px] font-bold text-slate-600 mt-1">Transporter / Driver Sign</p>
                    </div>
                    <div>
                      <div className="h-10 border-b border-dashed border-slate-300"></div>
                      <p className="text-[10px] font-bold text-slate-600 mt-1">Customer / Site Receiver Sign</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Record Receipt (Accounts Desk integration) */}
      {showRecordReceiptModal && selectedLeadForReceipt && (
        <RecordReceiptModal
          lead={selectedLeadForReceipt as any}
          allLeads={queue as any}
          onClose={() => {
            setShowRecordReceiptModal(false);
            setSelectedLeadForReceipt(null);
          }}
          onSuccess={async () => {
            setShowRecordReceiptModal(false);
            setSelectedLeadForReceipt(null);
            await loadDispatchData(true);
          }}
        />
      )}
    </div>
  );
};
