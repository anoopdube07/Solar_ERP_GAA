CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'MANAGER', 'LEAD', 'INSTALLATION_MANAGER', 'INSTALLATION_MEMBER', 'REGISTRATION', 'ACCOUNTS', 'DISPATCH')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  rate NUMERIC(14,2) NOT NULL DEFAULT 0,
  default_uom TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS uoms (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_custom_field_definitions (
  id TEXT PRIMARY KEY,
  customer_type TEXT NOT NULL CHECK (customer_type IN ('B2C', 'B2B')),
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('TEXT', 'TEXTAREA', 'NUMBER', 'CURRENCY', 'SELECT', 'DATE', 'BOOLEAN', 'EMAIL', 'PHONE', 'URL')),
  required_at_creation BOOLEAN NOT NULL DEFAULT false,
  required_before_yes BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  options_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  lead_number SERIAL,
  customer_name TEXT NOT NULL,
  mobile_number VARCHAR(10) NOT NULL,
  customer_type VARCHAR(3) NOT NULL CHECK (customer_type IN ('B2C', 'B2B')),
  email TEXT,
  address TEXT,
  location TEXT,
  location_link TEXT,
  lead_source TEXT,
  project_installation_location TEXT,
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  assigned_installer_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SITE_VISIT_PENDING', 'ESCALATED_TO_OWNER', 'OWNER_CREDIT_APPROVAL', 'QUALIFIED', 'DOCUMENTATION_COMPLETE', 'LOST')),
  current_team TEXT NOT NULL DEFAULT 'LEAD' CHECK (current_team IN ('LEAD', 'INSTALLATION_MANAGER', 'INSTALLATION_TEAM', 'OWNER', 'REGISTRATION_1', 'REGISTRATION_TEAM', 'ECP_PLACEHOLDER', 'ACCOUNTS', 'ACCOUNTS_PLACEHOLDER', 'DISPATCH', 'DISPATCH_TEAM')),
  documentation_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE' CHECK (documentation_status IN ('NOT_APPLICABLE', 'PENDING', 'COMPLETED')),
  dispatch_status TEXT NOT NULL DEFAULT 'PENDING_ADVANCE' CHECK (dispatch_status IN ('PENDING_ADVANCE', 'DISPATCH_CLEARED', 'DISPATCHED', 'DELIVERED', 'NOT_APPLICABLE')),
  dispatch_cleared_at TIMESTAMPTZ,
  dispatch_cleared_by TEXT REFERENCES users(id),
  dispatch_remarks TEXT,
  b2b_credit_days INTEGER DEFAULT 30,
  b2b_credit_due_date DATE,
  b2b_credit_compliance_status TEXT DEFAULT 'PENDING_REVIEW' CHECK (b2b_credit_compliance_status IN ('PENDING_REVIEW', 'COMPLIANT', 'NON_COMPLIANT', 'OVERDUE', 'NO_CREDIT')),
  action_required BOOLEAN NOT NULL DEFAULT true,
  lost_reason TEXT,
  lost_remarks TEXT,
  b2c_loan_required VARCHAR(3) CHECK (b2c_loan_required IN ('YES', 'NO') OR b2c_loan_required IS NULL),
  b2b_credit_extended VARCHAR(3) CHECK (b2b_credit_extended IN ('YES', 'NO') OR b2b_credit_extended IS NULL),
  requested_credit_amount NUMERIC(14,2) DEFAULT 0,
  approved_credit_amount NUMERIC(14,2) DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  freight NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_mode TEXT NOT NULL DEFAULT 'NO_TAX' CHECK (tax_mode IN ('NO_TAX', 'INTRA_STATE', 'INTER_STATE')),
  cgst_rate NUMERIC(6,2) DEFAULT 0,
  cgst_amount NUMERIC(14,2) DEFAULT 0,
  sgst_rate NUMERIC(6,2) DEFAULT 0,
  sgst_amount NUMERIC(14,2) DEFAULT 0,
  igst_rate NUMERIC(6,2) DEFAULT 0,
  igst_amount NUMERIC(14,2) DEFAULT 0,
  round_off NUMERIC(8,2) DEFAULT 0,
  total_project_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  remarks TEXT,
  owner_remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_owner_id ON leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_mobile_type ON leads(mobile_number, customer_type);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

CREATE TABLE IF NOT EXISTS lead_custom_field_values (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  field_definition_id TEXT NOT NULL REFERENCES lead_custom_field_definitions(id),
  field_key TEXT NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotation_lines (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  item_id TEXT,
  item_name TEXT NOT NULL,
  quantity NUMERIC(14,2) NOT NULL DEFAULT 1,
  uom TEXT NOT NULL DEFAULT 'Nos',
  rate NUMERIC(14,2) NOT NULL DEFAULT 0,
  value NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_visits (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  requesting_user_id TEXT NOT NULL REFERENCES users(id),
  assigned_member_id TEXT REFERENCES users(id),
  assigned_by_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'PENDING_ASSIGNMENT',
  notes TEXT,
  scheduled_date TIMESTAMPTZ,
  completion_details TEXT,
  completed_at TIMESTAMPTZ,
  structure_height TEXT,
  earthing_cable_length TEXT,
  dc_cable_length TEXT,
  ac_cable_length TEXT,
  geo_latitude NUMERIC(10, 7),
  geo_longitude NUMERIC(10, 7),
  geo_address TEXT,
  photo_captured_with_owner BOOLEAN DEFAULT true,
  extra_materials_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_visit_photos (
  id TEXT PRIMARY KEY,
  site_visit_id TEXT NOT NULL REFERENCES site_visits(id) ON DELETE CASCADE,
  uploader_id TEXT NOT NULL REFERENCES users(id),
  file_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  is_with_owner BOOLEAN DEFAULT true,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id),
  call_sequence INTEGER NOT NULL DEFAULT 1,
  scheduled_at TIMESTAMPTZ NOT NULL,
  remarks TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escalations (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  escalated_by TEXT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  remarks TEXT NOT NULL,
  owner_remarks TEXT,
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_approval_history (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id),
  requested_credit_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  approved_credit_amount NUMERIC(14,2),
  decision TEXT NOT NULL,
  remarks TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_workflow_history (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  actor_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  previous_state TEXT,
  new_state TEXT,
  remarks TEXT,
  metadata_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_definitions (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  customer_type TEXT NOT NULL DEFAULT 'BOTH' CHECK (customer_type IN ('B2C', 'B2B', 'BOTH')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_requirement_rules (
  id TEXT PRIMARY KEY,
  rule_name TEXT NOT NULL,
  description TEXT,
  customer_type TEXT NOT NULL DEFAULT 'BOTH' CHECK (customer_type IN ('B2C', 'B2B', 'BOTH')),
  requirement_type TEXT NOT NULL CHECK (requirement_type IN ('INDIVIDUAL', 'ANY_ONE_REQUIRED', 'ALL_REQUIRED')),
  condition_type TEXT NOT NULL DEFAULT 'ALWAYS' CHECK (condition_type IN ('ALWAYS', 'IF_LOAN_REQUIRED', 'IF_CREDIT_EXTENDED', 'CUSTOM_FIELD_EQUALS')),
  condition_field_key TEXT,
  condition_expected_value TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_rule_items (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES document_requirement_rules(id) ON DELETE CASCADE,
  document_definition_id TEXT NOT NULL REFERENCES document_definitions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_documents (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  document_definition_id TEXT NOT NULL REFERENCES document_definitions(id),
  rule_id TEXT REFERENCES document_requirement_rules(id),
  original_name TEXT NOT NULL,
  stored_file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_custom_values_unique ON lead_custom_field_values(lead_id, field_definition_id);
CREATE INDEX IF NOT EXISTS idx_lead_docs_lead ON lead_documents(lead_id);
CREATE INDEX IF NOT EXISTS idx_workflow_lead ON lead_workflow_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_lead ON site_visits(lead_id);
CREATE INDEX IF NOT EXISTS idx_quotations_lead ON quotation_lines(lead_id);

CREATE TABLE IF NOT EXISTS registration_tasks (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('REGISTRATION_1', 'NET_METERING', 'REGISTRATION_2')),
  task_code TEXT NOT NULL,
  task_name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_financing_dependent BOOLEAN NOT NULL DEFAULT false,
  owner_team TEXT NOT NULL DEFAULT 'REGISTRATION' CHECK (owner_team IN ('REGISTRATION', 'INSTALLATION')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'BLOCKED', 'NOT_APPLICABLE')),
  completed_by TEXT REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  remarks TEXT,
  metadata_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reg_tasks_lead_code ON registration_tasks(lead_id, task_code);
CREATE INDEX IF NOT EXISTS idx_reg_tasks_lead ON registration_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_reg_tasks_stage_status ON registration_tasks(stage, status);

CREATE TABLE IF NOT EXISTS installation_records (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING_ASSIGNMENT' CHECK (status IN ('PENDING_ASSIGNMENT', 'ASSIGNED', 'COMPLETED', 'NEEDS_REVISION')),
  assigned_installer_id TEXT REFERENCES users(id),
  assigned_by_id TEXT REFERENCES users(id),
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by TEXT REFERENCES users(id),
  completion_remarks TEXT,
  inverter_serial_number TEXT,
  solar_panel_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_installation_records_lead ON installation_records(lead_id);
CREATE INDEX IF NOT EXISTS idx_installation_records_status ON installation_records(status);

CREATE TABLE IF NOT EXISTS installation_photos (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  photo_category TEXT NOT NULL CHECK (photo_category IN ('INVERTER_SERIAL', 'INVERTER_WITH_CUSTOMER', 'PANEL_WITH_CUSTOMER', 'LIGHTNING_ARRESTER', 'EARTHING_PIT')),
  uploader_id TEXT NOT NULL REFERENCES users(id),
  file_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_installation_photos_lead ON installation_photos(lead_id);
CREATE INDEX IF NOT EXISTS idx_installation_photos_category ON installation_photos(lead_id, photo_category);

-- ============================================================================
-- ACCOUNTS TEAM TABLES: RECEIPTS & RECEIPT FOLLOW-UPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_receipts (
  id TEXT PRIMARY KEY,
  receipt_number TEXT UNIQUE NOT NULL,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('NEFT_RTGS', 'CHEQUE', 'UPI', 'BANK_TRANSFER', 'CASH', 'BANK_LOAN_DISBURSEMENT')),
  reference_number TEXT,
  receipt_type TEXT NOT NULL CHECK (receipt_type IN ('ADVANCE', 'PROGRESS_MILESTONE', 'BANK_LOAN_DISBURSEMENT', 'FINAL_SETTLEMENT')),
  payer_type TEXT NOT NULL CHECK (payer_type IN ('CUSTOMER', 'BANK', 'THIRD_PARTY')),
  payer_name TEXT,
  bank_name TEXT,
  deposited_in_account TEXT,
  status TEXT NOT NULL DEFAULT 'CLEARED' CHECK (status IN ('PENDING_CLEARANCE', 'CLEARED', 'BOUNCED', 'CANCELLED')),
  remarks TEXT,
  recorded_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_receipts_lead ON customer_receipts(lead_id);
CREATE INDEX IF NOT EXISTS idx_customer_receipts_date ON customer_receipts(receipt_date);
CREATE INDEX IF NOT EXISTS idx_customer_receipts_type ON customer_receipts(receipt_type);
CREATE INDEX IF NOT EXISTS idx_customer_receipts_status ON customer_receipts(status);

CREATE TABLE IF NOT EXISTS receipt_followups (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  follow_up_date TIMESTAMPTZ NOT NULL,
  promised_payment_date DATE,
  promised_amount NUMERIC(14,2),
  contact_person TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'PROMISED_TO_PAY', 'DISPUTED', 'CANCELLED')),
  remarks TEXT NOT NULL,
  outcome_notes TEXT,
  recorded_by TEXT NOT NULL REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipt_followups_lead ON receipt_followups(lead_id);
CREATE INDEX IF NOT EXISTS idx_receipt_followups_date ON receipt_followups(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_receipt_followups_status ON receipt_followups(status);

-- ============================================================================
-- DISPATCH TEAM TABLES: SHIPMENTS & LOGISTICS TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS dispatch_records (
  id TEXT PRIMARY KEY,
  lead_id TEXT UNIQUE NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING_CLEARANCE' CHECK (status IN ('PENDING_CLEARANCE', 'READY_FOR_DISPATCH', 'DISPATCHED', 'DELIVERED', 'CANCELLED')),
  transporter_name TEXT,
  lr_number TEXT,
  vehicle_number TEXT,
  driver_name TEXT,
  driver_phone TEXT,
  dispatch_date DATE,
  estimated_delivery_date DATE,
  actual_delivery_date DATE,
  delivery_challan_number TEXT,
  dispatch_notes TEXT,
  delivery_proof_url TEXT,
  dispatched_by TEXT REFERENCES users(id),
  delivered_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_records_lead ON dispatch_records(lead_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_records_status ON dispatch_records(status);


