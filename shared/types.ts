export type UserRole =
  | 'OWNER'
  | 'MANAGER'
  | 'LEAD'
  | 'INSTALLATION_MANAGER'
  | 'INSTALLATION_MEMBER'
  | 'REGISTRATION'
  | 'ACCOUNTS'
  | 'DISPATCH'
  | 'SERVICE';

export type CustomerType = 'B2C' | 'B2B';

export type LeadStatus =
  | 'PENDING'
  | 'SITE_VISIT_PENDING'
  | 'ESCALATED_TO_OWNER'
  | 'OWNER_CREDIT_APPROVAL'
  | 'QUALIFIED'
  | 'DOCUMENTATION_COMPLETE'
  | 'LOST';

export type CurrentTeam =
  | 'LEAD'
  | 'LEAD_TEAM'
  | 'INSTALLATION_MANAGER'
  | 'INSTALLATION_TEAM'
  | 'OWNER'
  | 'REGISTRATION_1'
  | 'REGISTRATION_TEAM'
  | 'ECP_PLACEHOLDER'
  | 'ACCOUNTS'
  | 'ACCOUNTS_PLACEHOLDER'
  | 'DISPATCH'
  | 'DISPATCH_TEAM';

export type DocumentationStatus = 'NOT_APPLICABLE' | 'PENDING' | 'COMPLETED';

export type TaxMode = 'NO_TAX' | 'INTRA_STATE' | 'INTER_STATE';

export type YesNo = 'YES' | 'NO';

export type FieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'CURRENCY'
  | 'SELECT'
  | 'DATE'
  | 'BOOLEAN'
  | 'EMAIL'
  | 'PHONE'
  | 'URL';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  deleted_at?: string | null;
}

export interface Item {
  id: string;
  name: string;
  description: string | null;
  rate: number;
  default_uom: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Uom {
  id: string;
  name: string;
  code?: string;
  description: string | null;
  active: boolean;
  created_at: string;
  deleted_at?: string | null;
}

export interface CustomFieldDefinition {
  id: string;
  customer_type: CustomerType;
  field_key: string;
  label: string;
  type: FieldType;
  required_at_creation: boolean;
  required_before_yes: boolean;
  active: boolean;
  display_order: number;
  options: string[];
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface CustomFieldValue {
  id: string;
  lead_id: string;
  field_definition_id: string;
  field_key: string;
  label?: string;
  type?: FieldType;
  required_before_yes?: boolean;
  required_at_creation?: boolean;
  options?: string[] | string | null;
  display_order?: number;
  value: string;
}

export interface QuotationLine {
  id: string;
  lead_id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  uom: string;
  rate: number;
  value: number; // system calculated = quantity * rate
}

export interface FollowUp {
  id: string;
  lead_id: string;
  created_by: string;
  creator_name?: string;
  call_sequence: number;
  scheduled_at: string;
  remarks: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface ExtraMaterial {
  name: string;
  quantity: number;
  uom: string;
}

export interface SiteVisitPhoto {
  id: string;
  site_visit_id: string;
  uploader_id: string;
  uploader_name?: string;
  file_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  latitude?: number | null;
  longitude?: number | null;
  is_with_owner?: boolean;
  uploaded_at: string;
}

export interface SiteVisit {
  id: string;
  lead_id: string;
  lead_number?: number;
  customer_name?: string;
  mobile_number?: string;
  location?: string;
  lead_customer_name?: string;
  lead_mobile_number?: string;
  requesting_user_id: string;
  requesting_user_name?: string;
  assigned_member_id: string | null;
  assigned_member_name?: string | null;
  assigned_by_id: string | null;
  assigned_by_name?: string | null;
  status: 'PENDING_ASSIGNMENT' | 'ASSIGNED' | 'COMPLETED';
  notes: string | null;
  scheduled_date?: string | null;
  completion_details: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;

  // Rooftop technical survey findings
  structure_height?: string | null;
  earthing_cable_length?: string | null;
  dc_cable_length?: string | null;
  ac_cable_length?: string | null;
  geo_latitude?: number | null;
  geo_longitude?: number | null;
  geo_address?: string | null;
  photo_captured_with_owner?: boolean;
  extra_materials_json?: string | null;
  extra_materials?: ExtraMaterial[];

  photos?: SiteVisitPhoto[];
}

export interface CreditApprovalRecord {
  id: string;
  lead_id: string;
  owner_id: string;
  owner_name?: string;
  requested_credit_amount: number;
  approved_credit_amount: number | null;
  decision: 'APPROVED' | 'APPROVED_REDUCED' | 'REJECTED';
  remarks: string | null;
  decided_at: string;
}

export interface EscalationRecord {
  id: string;
  lead_id: string;
  escalated_by: string;
  escalator_name?: string;
  reason: string;
  remarks: string;
  owner_remarks: string | null;
  returned_at: string | null;
  created_at: string;
}

export interface WorkflowHistoryItem {
  id: string;
  lead_id: string;
  actor_id: string;
  actor_name: string;
  event_type: string;
  previous_state: string | null;
  new_state: string | null;
  remarks: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface Lead {
  id: string;
  lead_number: number;
  customer_name: string;
  mobile_number: string;
  contact_number?: string | null;
  capacity_kwp?: number | null;
  customer_type: CustomerType;
  email: string | null;
  address: string | null;
  location: string | null;
  location_link: string | null;
  lead_source: string | null;
  project_installation_location: string | null;
  owner_id: string;
  owner_name?: string;
  created_by: string;
  creator_name?: string;
  assigned_installer_id?: string | null;
  assigned_installer_name?: string | null;
  status: LeadStatus;
  current_team: CurrentTeam;
  documentation_status: DocumentationStatus;
  action_required: boolean;
  lost_reason: string | null;
  lost_remarks: string | null;
  b2c_loan_required: YesNo | null;
  b2b_credit_extended: YesNo | null;
  requested_credit_amount: number;
  approved_credit_amount: number;
  owner_credit_decision?: 'APPROVED' | 'APPROVED_REDUCED' | 'REJECTED' | 'PENDING' | null;
  subtotal: number;
  freight: number;
  tax_mode: TaxMode;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  round_off: number;
  total_project_value: number;
  remarks: string | null;
  owner_remarks: string | null;
  created_at: string;
  updated_at: string;

  // Dispatch & Accounts controls
  dispatch_status?: DispatchStatus;
  dispatch_cleared_at?: string | null;
  dispatch_cleared_by?: string | null;
  dispatch_cleared_by_name?: string | null;
  dispatch_remarks?: string | null;
  b2b_credit_days?: number;
  b2b_credit_due_date?: string | null;
  b2b_credit_compliance_status?: B2BCreditComplianceStatus;

  // Joined relations
  quotation_lines?: QuotationLine[];
  custom_values?: CustomFieldValue[];
  follow_ups?: FollowUp[];
  follow_up_count?: number;
  has_follow_up?: boolean;
  last_follow_up_at?: string | null;
  site_visits?: SiteVisit[];
  escalations?: EscalationRecord[];
  credit_history?: CreditApprovalRecord[];
  workflow_history?: WorkflowHistoryItem[];
  customer_receipts?: CustomerReceipt[];
  receipt_followups?: ReceiptFollowUp[];
  total_received?: number;
  balance_due?: number;
  project_stage?: 'IN_DOCS' | 'REGISTRATION_1' | 'NET_METERING' | 'REGISTRATION_2' | 'DISPATCH' | 'INSTALLATION' | 'COMPLETED' | 'LEAD' | 'LOST' | string;
  next_follow_up_date?: string | null;
  next_follow_up_remarks?: string | null;
  missing_mandatory_fields?: string[];
  is_ready_for_yes?: boolean;
}

export interface LeadStageBreakdown {
  in_docs: number;
  registration_1: number;
  net_metering: number;
  registration_2: number;
  dispatch: number;
  installation: number;
  completed: number;
}

export interface B2BStageBreakdown {
  credit_approval_pending: number;
  dispatch: number;
  account: number;
  completed: number;
}

export interface TypeSpecificMetrics {
  total_leads: number;
  site_visit_pending?: number;
  action_required: number;
  follow_up_scheduled: number;
  escalated: number;
  lost: number;
  qualified_total: number;
  stages: LeadStageBreakdown;
  b2b_stages?: B2BStageBreakdown;
  total_contract_value: number;
  total_received: number;
  total_receivable: number;
}

export interface TodayFollowUpItem {
  id: string;
  lead_id: string;
  lead_number: number;
  customer_name: string;
  mobile_number: string;
  customer_type: CustomerType;
  scheduled_at: string;
  remarks: string;
  call_sequence: number;
  owner_name?: string;
}

export interface DashboardMetrics {
  total_leads: number;
  pending_leads: number;
  action_required_leads: number;
  followups_due_today: number;
  in_follow_up?: number;
  site_visits_pending: number;
  site_visits_completed_awaiting_action?: number;
  escalations_returned?: number;
  credit_returned?: number;
  ready_for_qualification?: number;
  in_documentation?: number;
  lost_leads: number;
  qualified_leads: number;
  b2c?: TypeSpecificMetrics;
  b2b?: TypeSpecificMetrics;
}

// ============================================================================
// ECP DOCUMENT TYPES
// ============================================================================

export type DocumentRequirementType = 'INDIVIDUAL' | 'ALL_REQUIRED' | 'ANY_ONE_REQUIRED';
export type DocumentConditionType = 'ALWAYS' | 'IF_LOAN_REQUIRED' | 'IF_CREDIT_EXTENDED' | 'CUSTOM_FIELD_EQUALS';

export interface DocumentDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  customer_type: 'B2C' | 'B2B' | 'BOTH';
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface DocumentRequirementRule {
  id: string;
  rule_name: string;
  description: string | null;
  customer_type: 'B2C' | 'B2B' | 'BOTH';
  requirement_type: DocumentRequirementType;
  condition_type: DocumentConditionType;
  condition_field_key: string | null;
  condition_expected_value: string | null;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  items?: DocumentRuleItem[];
  document_definitions?: DocumentDefinition[];
  deleted_at?: string | null;
}

export interface DocumentRuleItem {
  id: string;
  rule_id: string;
  document_definition_id: string;
  document_name?: string;
  document_code?: string;
  created_at: string;
}

export interface LeadDocument {
  id: string;
  lead_id: string;
  document_definition_id: string;
  document_name?: string;
  document_code?: string;
  rule_id: string | null;
  original_name: string;
  stored_file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
  uploader_name?: string;
  uploaded_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface RuleEvaluationItem {
  definition_id: string;
  code: string;
  name: string;
  is_uploaded: boolean;
  uploaded_documents: LeadDocument[];
}

export interface RuleEvaluationResult {
  rule_id: string;
  rule_name: string;
  description: string | null;
  requirement_type: DocumentRequirementType;
  condition_type: DocumentConditionType;
  applies: boolean;
  condition_explanation?: string;
  is_satisfied: boolean;
  required_items: RuleEvaluationItem[];
  missing_item_names: string[];
}

export interface LeadDocumentChecklist {
  lead_id: string;
  is_gate_satisfied: boolean;
  total_applicable_rules: number;
  satisfied_rules_count: number;
  pending_rules_count: number;
  rules: RuleEvaluationResult[];
  uploaded_documents: LeadDocument[];
  can_upload: boolean;
  can_delete: boolean;
  stage_message: string;
}

// ============================================================================
// REGISTRATION TEAM TYPES
// ============================================================================

export type RegistrationStage = 'REGISTRATION_1' | 'NET_METERING' | 'REGISTRATION_2';

export type RegistrationTaskStatus = 'PENDING' | 'COMPLETED' | 'BLOCKED' | 'NOT_APPLICABLE';

export type RegistrationTaskOwner = 'REGISTRATION' | 'INSTALLATION';

export interface RegistrationTask {
  id: string;
  lead_id: string;
  stage: RegistrationStage;
  task_code: string;
  task_name: string;
  description: string | null;
  display_order: number;
  is_financing_dependent: boolean;
  owner_team: RegistrationTaskOwner;
  status: RegistrationTaskStatus;
  completed_by?: string | null;
  completed_by_name?: string | null;
  completed_at?: string | null;
  remarks?: string | null;
  metadata_json?: string | null;
  dependencies?: string[];
  is_actionable?: boolean;
  blocking_reason?: string | null;
}

export interface RegistrationLeadItem {
  id: string;
  lead_number: number;
  customer_name: string;
  customer_type: CustomerType;
  mobile_number: string;
  location: string | null;
  capacity_kwp: number | null;
  total_project_value: number;
  stage: RegistrationStage;
  current_team: CurrentTeam;
  dispatch_status?: DispatchStatus;
  assigned_installer_id?: string | null;
  assigned_installer_name?: string | null;
  financing_required: boolean;
  b2c_loan_required: YesNo | null;
  b2b_credit_extended: YesNo | null;
  days_in_stage: number;
  is_delayed: boolean;
  current_task_code: string | null;
  current_task_name: string | null;
  current_task_status: RegistrationTaskStatus | null;
  active_tasks_count: number;
  completed_tasks_count: number;
  total_tasks_count: number;
  overall_status: 'ACTIONABLE' | 'PENDING' | 'BLOCKED' | 'COMPLETED';
  created_at: string;
  updated_at: string;
}

export interface RegistrationMetrics {
  reg1_pending: number;
  net_metering_pending: number;
  reg2_pending: number;
  total_pending: number;
  delayed_count: number;
  completed_count: number;
}

// ============================================================================
// INSTALLATION MANAGER TYPES
// ============================================================================

export interface InstallationMetrics {
  site_visits_waiting_assignment: number;
  site_visits_assigned_in_progress: number;
  site_visits_completed: number;
  installation_ecps_total: number;
  installation_ecps_unassigned: number;
  installation_ecps_delayed: number;
  net_metering_pending_action: number;
  action_required_total: number;
}

export interface InstallationMemberWorkload {
  user_id: string;
  name: string;
  username: string;
  role: UserRole;
  active: boolean;
  active_site_visits: number;
  active_installations: number;
  delayed_items: number;
  total_active: number;
  availability: 'AVAILABLE' | 'MODERATE' | 'BUSY';
}

export type InstallationWorkType = 'SITE_VISIT' | 'INSTALLATION' | 'NET_METERING';

export type InstallationPhotoCategory =
  | 'INVERTER_SERIAL'
  | 'INVERTER_WITH_CUSTOMER'
  | 'PANEL_WITH_CUSTOMER'
  | 'LIGHTNING_ARRESTER'
  | 'EARTHING_PIT';

export interface InstallationPhoto {
  id: string;
  lead_id: string;
  photo_category: InstallationPhotoCategory;
  category_label?: string;
  uploader_id: string;
  uploader_name?: string;
  file_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
}

export interface InstallationRecord {
  id: string;
  lead_id: string;
  status: 'PENDING_ASSIGNMENT' | 'ASSIGNED' | 'COMPLETED';
  assigned_installer_id: string | null;
  assigned_installer_name?: string | null;
  assigned_by_id: string | null;
  assigned_by_name?: string | null;
  assigned_at?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  completed_by_name?: string | null;
  completion_remarks?: string | null;
  inverter_serial_number?: string | null;
  solar_panel_details?: string | null;
  created_at: string;
  updated_at: string;
  photos?: InstallationPhoto[];
  photos_count?: number;
  all_photos_uploaded?: boolean;
}

export interface InstallationWorkQueueItem {
  id: string;
  lead_id: string;
  work_type: InstallationWorkType;
  customer_name: string;
  lead_number: number;
  mobile_number: string;
  location: string | null;
  capacity_kwp: number | null;
  total_project_value: number;
  stage: string;
  current_status: string;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  pending_requirement: string;
  days_in_stage: number;
  is_delayed: boolean;
  sla_status: 'ON_TRACK' | 'AT_RISK' | 'DELAYED';
  has_mandatory_photos?: boolean;
  has_all_photos?: boolean;
  photos_count?: number;
  scheduled_date?: string | null;
  updated_at: string;
  // Attached payloads for direct action
  site_visit?: SiteVisit;
  registration_lead?: RegistrationLeadItem;
  installation_record?: InstallationRecord | null;
  installation_photos?: InstallationPhoto[];
  can_assign?: boolean;
  can_complete?: boolean;
  can_execute_installation?: boolean;
  can_close_net_metering?: boolean;
  is_ready_for_close_net_metering?: boolean;
}

// ============================================================================
// ACCOUNTS TEAM TYPES
// ============================================================================

export type PaymentMode =
  | 'NEFT_RTGS'
  | 'CHEQUE'
  | 'UPI'
  | 'BANK_TRANSFER'
  | 'CASH'
  | 'BANK_LOAN_DISBURSEMENT';

export type ReceiptType =
  | 'ADVANCE'
  | 'PROGRESS_MILESTONE'
  | 'BANK_LOAN_DISBURSEMENT'
  | 'FINAL_SETTLEMENT';

export type PayerType = 'CUSTOMER' | 'BANK' | 'THIRD_PARTY';

export type ReceiptStatus = 'CLEARED' | 'PENDING_CLEARANCE' | 'BOUNCED' | 'CANCELLED';

export interface CustomerReceipt {
  id: string;
  receipt_number: string;
  lead_id: string;
  lead_number?: number;
  customer_name?: string;
  customer_type?: CustomerType;
  mobile_number?: string;
  total_project_value?: number;
  amount: number;
  receipt_date: string; // YYYY-MM-DD
  payment_mode: PaymentMode;
  reference_number?: string | null;
  receipt_type: ReceiptType;
  payer_type: PayerType;
  payer_name?: string | null;
  bank_name?: string | null;
  deposited_in_account?: string | null;
  status: ReceiptStatus;
  remarks?: string | null;
  recorded_by: string;
  recorder_name?: string;
  created_at: string;
  updated_at: string;
}

export type ReceiptFollowUpStatus =
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'PROMISED_TO_PAY'
  | 'DISPUTED'
  | 'CANCELLED';

export interface ReceiptFollowUp {
  id: string;
  lead_id: string;
  lead_number?: number;
  customer_name?: string;
  customer_type?: CustomerType;
  mobile_number?: string;
  total_project_value?: number;
  total_received?: number;
  balance_due?: number;
  follow_up_date: string; // ISO
  promised_payment_date?: string | null; // YYYY-MM-DD
  promised_amount?: number | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  status: ReceiptFollowUpStatus;
  remarks: string;
  outcome_notes?: string | null;
  recorded_by: string;
  recorder_name?: string;
  completed_at?: string | null;
  created_at: string;
}

export type DispatchStatus =
  | 'PENDING_ADVANCE'
  | 'DISPATCH_CLEARED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'NOT_APPLICABLE';

export type B2BCreditComplianceStatus =
  | 'PENDING_REVIEW'
  | 'COMPLIANT'
  | 'NON_COMPLIANT'
  | 'OVERDUE'
  | 'NO_CREDIT';

export interface AccountsLeadOverview {
  id: string;
  lead_number: number;
  customer_name: string;
  customer_type: CustomerType;
  mobile_number: string;
  location: string | null;
  total_project_value: number;
  b2c_loan_required: YesNo | null;
  b2b_credit_extended: YesNo | null;
  requested_credit_amount: number;
  approved_credit_amount: number;
  owner_approval_status: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  owner_approval_date?: string | null;
  owner_approval_remarks?: string | null;
  total_received: number;
  balance_due: number;
  collection_percentage: number;
  advance_received: number;
  has_advance_from_customer: boolean;
  has_advance_from_bank: boolean;
  b2c_advance_satisfied: boolean;
  b2b_dispatch_satisfied: boolean;
  dispatch_status: DispatchStatus;
  dispatch_cleared_at?: string | null;
  dispatch_cleared_by_name?: string | null;
  dispatch_remarks?: string | null;
  b2b_credit_compliance: B2BCreditComplianceStatus;
  b2b_credit_days: number;
  b2b_credit_due_date?: string | null;
  b2b_upfront_required: number;
  b2b_compliance_message: string;
  receipt_count: number;
  last_receipt_date?: string | null;
  follow_up_count: number;
  next_follow_up_date?: string | null;
  current_team: CurrentTeam;
  status: LeadStatus;
  lead_owner_name?: string | null;
  lead_owner_id?: string | null;
  action_required?: boolean;
  action_required_note?: string | null;
}

export interface AccountsMetrics {
  total_collections: number;
  total_receivables: number;
  receipts_count: number;
  b2c_pending_advance_count: number;
  b2c_dispatch_cleared_count: number;
  b2b_pending_dispatch_count: number;
  b2b_dispatch_cleared_count: number;
  b2b_credit_pending_owner_approval: number;
  b2b_credit_compliant_count: number;
  b2b_credit_non_compliant_count: number;
  follow_ups_due_today: number;
  follow_ups_overdue: number;
}

// ============================================================================
// DISPATCH TEAM MODULE INTERFACES
// ============================================================================

export type DispatchRecordStatus =
  | 'PENDING_CLEARANCE'
  | 'READY_FOR_DISPATCH'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface DispatchRecord {
  id: string;
  lead_id: string;
  status: DispatchRecordStatus;
  transporter_name?: string | null;
  lr_number?: string | null;
  vehicle_number?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  dispatch_date?: string | null;
  estimated_delivery_date?: string | null;
  actual_delivery_date?: string | null;
  delivery_challan_number?: string | null;
  dispatch_notes?: string | null;
  delivery_proof_url?: string | null;
  dispatched_by?: string | null;
  dispatched_by_name?: string | null;
  delivered_by?: string | null;
  delivered_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DispatchQueueItem extends Lead {
  b2c_receipt_satisfied: boolean;
  b2c_advance_satisfied: boolean;
  b2b_dispatch_satisfied: boolean;
  receipt_count: number;
  total_received: number;
  advance_received: number;
  max_receipt_amount: number;
  first_receipt_number?: string | null;
  first_receipt_date?: string | null;
  first_receipt_amount?: number | null;
  dispatch_record?: DispatchRecord | null;
  quotation_line_count?: number;
  lead_owner_name?: string | null;
}

export interface DispatchMetrics {
  total_projects: number;
  blocked_b2c_count: number;
  blocked_b2b_count: number;
  cleared_ready_count: number;
  in_transit_count: number;
  delivered_count: number;
  b2c_total: number;
  b2b_total: number;
}

export type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ComplaintStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_PARTS'
  | 'RESOLVED'
  | 'CLOSED';

export type ComplaintCategory =
  | 'INVERTER_FAULT'
  | 'GENERATION_DROP'
  | 'PHYSICAL_DAMAGE'
  | 'GRID_TRIPPING'
  | 'NET_METER_ISSUE'
  | 'WIRING_LEAKAGE'
  | 'APP_OFFLINE'
  | 'OTHER';

export interface ServiceComplaint {
  id: string;
  ticket_number: string;
  lead_id?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  customer_address?: string | null;
  city?: string | null;
  system_capacity_kw?: number | null;
  inverter_brand_model?: string | null;
  inverter_serial?: string | null;
  commissioning_date?: string | null;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  title: string;
  description: string;
  reported_channel: string;
  reported_at: string;
  sla_due_at: string;
  assigned_to_user_id?: string | null;
  assigned_to_name?: string | null;
  assigned_at?: string | null;
  assignment_notes?: string | null;
  technician_visit_date?: string | null;
  root_cause?: string | null;
  action_taken?: string | null;
  parts_replaced?: string | null;
  is_warranty_claim: boolean;
  warranty_claim_number?: string | null;
  resolution_notes?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  customer_rating?: number | null;
  customer_feedback?: string | null;
  closed_at?: string | null;
  closed_by?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  activities?: ServiceComplaintActivity[];
}

export interface ServiceComplaintActivity {
  id: string;
  complaint_id: string;
  actor_id?: string | null;
  actor_name: string;
  action_type: string;
  old_status?: string | null;
  new_status?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface ServiceMetrics {
  total_complaints: number;
  open_unassigned: number;
  in_progress: number;
  waiting_parts: number;
  resolved_count: number;
  sla_breached: number;
}


