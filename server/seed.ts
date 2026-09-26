import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getDB } from './db/index.ts';
import { RegistrationService } from './services/registrationService.ts';
import { seedDummyData } from './seedDummyData.ts';

export async function seedInitialData() {
  const db = await getDB();
  console.log('[Seed] Seeding initial master data...');

  // 1. Seed standard UOMs
  const standardUoms = [
    { name: 'Nos', description: 'Numbers / Units' },
    { name: 'Set', description: 'Complete Kit / Set' },
    { name: 'kW', description: 'Kilowatt Capacity' },
    { name: 'Mtr', description: 'Meters' },
    { name: 'Pkt', description: 'Packet' },
    { name: 'Kg', description: 'Kilograms' },
  ];

  for (const uom of standardUoms) {
    const exists = await db.query('SELECT id FROM uoms WHERE LOWER(name) = LOWER($1)', [uom.name]);
    if (exists.rows.length === 0) {
      await db.query(
        'INSERT INTO uoms (id, name, description, active, created_at) VALUES ($1, $2, $3, true, NOW())',
        [crypto.randomUUID(), uom.name, uom.description]
      );
    }
  }

  // 2. Seed standard Solar Items
  const standardItems = [
    { name: 'Mono PERC Solar Panel 540W', rate: 14500, uom: 'Nos', desc: 'Tier-1 Mono PERC High Efficiency PV Module' },
    { name: 'On-Grid Solar Inverter 5kW 3-Phase', rate: 48000, uom: 'Nos', desc: 'Dual MPPT Solar Grid-Tied Inverter with WiFi Monitoring' },
    { name: 'On-Grid Solar Inverter 10kW 3-Phase', rate: 82000, uom: 'Nos', desc: 'Industrial Grade 10kW Dual MPPT Solar Inverter' },
    { name: 'Solar DC Cable 4 sq.mm (Red/Black)', rate: 48, uom: 'Mtr', desc: 'TUV Certified Copper Solar DC Armored Wire' },
    { name: 'Aluminium Heavy Duty Mounting Structure 5kW', rate: 18500, uom: 'Set', desc: 'Corrosion-resistant Hot-dip HDG structure with 150 kmph wind rating' },
    { name: 'ACDB / DCDB Protection Array with SPD & MCB', rate: 7500, uom: 'Nos', desc: 'IP65 Enclosure with Class II Surge Protection' },
    { name: 'Chemical Earthing Kit & Copper Lightning Arrester', rate: 6200, uom: 'Set', desc: 'Maintenance-free earthing rod with BFC compound' },
    { name: 'Net Metering Bi-Directional Discom Liaisoning & Meter', rate: 12000, uom: 'Set', desc: 'State electricity board approval and testing charge' },
  ];

  for (const item of standardItems) {
    const exists = await db.query('SELECT id FROM items WHERE LOWER(name) = LOWER($1)', [item.name]);
    if (exists.rows.length === 0) {
      await db.query(
        `INSERT INTO items (id, name, description, rate, default_uom, active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
        [crypto.randomUUID(), item.name, item.desc, item.rate, item.uom]
      );
    }
  }

  // 3. Seed Custom Field Definitions for B2C & B2B
  const customFields = [
    // B2C
    {
      customer_type: 'B2C',
      field_key: 'monthly_electricity_bill',
      label: 'Average Monthly Electricity Bill (₹)',
      type: 'CURRENCY',
      required_at_creation: false,
      required_before_yes: true,
      display_order: 1,
      options: null,
    },
    {
      customer_type: 'B2C',
      field_key: 'sanctioned_load_kw',
      label: 'Sanctioned Load (kW)',
      type: 'NUMBER',
      required_at_creation: false,
      required_before_yes: true,
      display_order: 2,
      options: null,
    },
    {
      customer_type: 'B2C',
      field_key: 'roof_type',
      label: 'Roof Construction Type',
      type: 'SELECT',
      required_at_creation: false,
      required_before_yes: true,
      display_order: 3,
      options: JSON.stringify(['Flat RCC Concrete', 'Tiled / Slanted Slope', 'Metal Tin Shed', 'Open Terrace']),
    },
    {
      customer_type: 'B2C',
      field_key: 'discom_consumer_number',
      label: 'DISCOM Consumer / Account Number',
      type: 'TEXT',
      required_at_creation: false,
      required_before_yes: true,
      display_order: 4,
      options: null,
    },
    // B2B
    {
      customer_type: 'B2B',
      field_key: 'company_gstin',
      label: 'Company GSTIN Number',
      type: 'TEXT',
      required_at_creation: false,
      required_before_yes: true,
      display_order: 1,
      options: null,
    },
    {
      customer_type: 'B2B',
      field_key: 'industry_vertical',
      label: 'Industry Sector',
      type: 'SELECT',
      required_at_creation: false,
      required_before_yes: true,
      display_order: 2,
      options: JSON.stringify(['Textiles & Garments', 'Engineering & Auto', 'Hospitality & Hotels', 'Hospitals & Healthcare', 'Warehousing & Logistics', 'Institutions & Schools']),
    },
    {
      customer_type: 'B2B',
      field_key: 'connected_load_kva',
      label: 'Contract Demand / Connected Load (kVA)',
      type: 'NUMBER',
      required_at_creation: false,
      required_before_yes: true,
      display_order: 3,
      options: null,
    },
    {
      customer_type: 'B2B',
      field_key: 'proposed_capacity_kw',
      label: 'Proposed Solar PV Capacity (kWp)',
      type: 'NUMBER',
      required_at_creation: false,
      required_before_yes: true,
      display_order: 4,
      options: null,
    },
    {
      customer_type: 'B2B',
      field_key: 'contact_person_name',
      label: 'Contact Person Name',
      type: 'TEXT',
      required_at_creation: false,
      required_before_yes: false,
      display_order: 1,
      options: null,
    },
    {
      customer_type: 'B2B',
      field_key: 'decision_maker_designation',
      label: 'Decision Maker Designation',
      type: 'TEXT',
      required_at_creation: false,
      required_before_yes: false,
      display_order: 2,
      options: null,
    },
  ];

  for (const cf of customFields) {
    const exists = await db.query(
      'SELECT id FROM lead_custom_field_definitions WHERE customer_type = $1 AND field_key = $2',
      [cf.customer_type, cf.field_key]
    );
    if (exists.rows.length === 0) {
      await db.query(
        `INSERT INTO lead_custom_field_definitions (
          id, customer_type, field_key, label, type, required_at_creation, required_before_yes, active, display_order, options_json, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, NOW(), NOW())`,
        [
          crypto.randomUUID(),
          cf.customer_type,
          cf.field_key,
          cf.label,
          cf.type,
          cf.required_at_creation,
          cf.required_before_yes,
          cf.display_order,
          cf.options,
        ]
      );
    }
  }

  // 4. Seed initial default users if not already present for ready testing and switching
  // (Owner, Manager/Manager1, Lead1/Lead2, InstMgr/Inst_Mgr, InstMember with Solar@123)
  const passwordHash = await bcrypt.hash('Solar@123', 10);
  const standardTestUsers = [
    { username: 'owner', name: 'Rajesh Sharma (Owner)', role: 'OWNER' },
    { username: 'manager', name: 'Pooja Verma (Manager)', role: 'MANAGER' },
    { username: 'manager1', name: 'Pooja Verma (Sales Manager)', role: 'MANAGER' },
    { username: 'lead1', name: 'Amit Kumar (Lead Exec)', role: 'LEAD' },
    { username: 'lead2', name: 'Neha Gupta (Lead Exec)', role: 'LEAD' },
    { username: 'instmgr', name: 'Suresh Patel (Inst Mgr)', role: 'INSTALLATION_MANAGER' },
    { username: 'inst_mgr', name: 'Suresh Patel (Installation Manager)', role: 'INSTALLATION_MANAGER' },
    { username: 'instmember', name: 'Vikas Singh (Inst Member)', role: 'INSTALLATION_MEMBER' },
    { username: 'instmember2', name: 'Ramesh Yadav (Inst Crew Lead)', role: 'INSTALLATION_MEMBER' },
    { username: 'instmember3', name: 'Sunil Rao (Inst Field Tech)', role: 'INSTALLATION_MEMBER' },
    { username: 'reg1', name: 'Rohan Deshmukh (Registration Exec)', role: 'REGISTRATION' },
    { username: 'accounts', name: 'Kavita Shah (Accounts Exec)', role: 'ACCOUNTS' },
    { username: 'accountant', name: 'Kavita Shah (Accounts Exec)', role: 'ACCOUNTS' },
    { username: 'dispatch1', name: 'Dinesh Rathore (Dispatch Exec)', role: 'DISPATCH' },
    { username: 'dispatch', name: 'Dinesh Rathore (Dispatch Exec)', role: 'DISPATCH' },
    { username: 'service1', name: 'Vikram Joshi (Service Desk)', role: 'SERVICE' },
    { username: 'service', name: 'Vikram Joshi (Service Desk)', role: 'SERVICE' },
  ];

  let primaryOwnerId: string | null = null;
  let primaryLeadId: string | null = null;

  for (const u of standardTestUsers) {
    const existing = await db.query('SELECT id, role FROM users WHERE LOWER(username) = LOWER($1)', [u.username]);
    if (existing.rows.length === 0) {
      const newId = crypto.randomUUID();
      await db.query(
        `INSERT INTO users (id, username, password_hash, name, role, active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
        [newId, u.username, passwordHash, u.name, u.role]
      );
      if (u.role === 'OWNER' && !primaryOwnerId) primaryOwnerId = newId;
      if (u.role === 'LEAD' && !primaryLeadId) primaryLeadId = newId;
    } else {
      if (u.role === 'OWNER' && !primaryOwnerId) primaryOwnerId = existing.rows[0].id;
      if (u.role === 'LEAD' && !primaryLeadId) primaryLeadId = existing.rows[0].id;
    }
  }

  // Seed sample demonstration leads if no leads exist yet
  const leadsCountRes = await db.query('SELECT COUNT(*) as count FROM leads');
  if (parseInt(leadsCountRes.rows[0].count, 10) === 0 && primaryLeadId) {
    console.log('[Seed] Seeding sample demonstration leads...');
    const lead1Id = crypto.randomUUID();
    await db.query(
      `INSERT INTO leads (
        id, customer_name, mobile_number, customer_type, email, address, location,
        lead_source, owner_id, created_by, status, current_team, action_required,
        b2c_loan_required, subtotal, freight, tax_mode, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
        total_project_value, remarks, created_at, updated_at
      ) VALUES (
        $1, 'Sunil Joshi', '9876543210', 'B2C', 'sunil.joshi@example.com', 'Flat 402, Green Meadows, Whitefield',
        'Bengaluru', 'Website Form', $2, $2, 'PENDING', 'LEAD', true,
        'YES', 245000, 5000, 'INTRA_STATE', 6.0, 15000, 6.0, 15000,
        280000, 'Interested in 5kW Rooftop on-grid installation', NOW() - INTERVAL '2 days', NOW()
      )`,
      [lead1Id, primaryLeadId]
    );

    const lead2Id = crypto.randomUUID();
    await db.query(
      `INSERT INTO leads (
        id, customer_name, mobile_number, customer_type, email, address, location,
        lead_source, owner_id, created_by, status, current_team, action_required,
        b2b_credit_extended, requested_credit_amount, approved_credit_amount, subtotal, freight, tax_mode, igst_rate, igst_amount,
        total_project_value, remarks, created_at, updated_at
      ) VALUES (
        $1, 'Apex Engineering Works Ltd', '9811223344', 'B2B', 'procurement@apexworks.in', 'Plot 44, Peenya Industrial Area Phase 2',
        'Bengaluru', 'Direct Referral', $2, $2, 'PENDING', 'LEAD', true,
        'YES', 300000, 300000, 1200000, 25000, 'INTER_STATE', 12.0, 147000,
        1372000, 'Factory roof 35kW installation. 30 days credit required.', NOW() - INTERVAL '1 day', NOW()
      )`,
      [lead2Id, primaryLeadId]
    );

    console.log('[Seed] Demo accounts & sample leads created.');
  }

  // 4. Seed Standard ECP Document Definitions & Rules (Owner-controlled master data)
  const standardDefinitions = [
    { code: 'ELEC_BILL', name: 'Latest Electricity Bill (Last 3 Months)', customer_type: 'BOTH', description: 'Clear copy of recent utility discom electricity bill showing consumer number and sanctioned load.' },
    { code: 'AADHAAR_CARD', name: 'Aadhaar Card (Front & Back)', customer_type: 'B2C', description: 'Government issued Aadhaar card copy for beneficiary identity verification.' },
    { code: 'PAN_CARD', name: 'PAN Card', customer_type: 'BOTH', description: 'Permanent Account Number card copy.' },
    { code: 'PASSPORT_VOTER', name: 'Passport or Voter ID Card', customer_type: 'B2C', description: 'Alternate official photo ID.' },
    { code: 'PROPERTY_TAX', name: 'Property Tax Receipt / Roof Ownership Proof', customer_type: 'B2C', description: 'Latest municipal property tax receipt or registered sale deed confirming roof ownership.' },
    { code: 'BANK_STATEMENT', name: 'Bank Statement / Cancelled Cheque (3 Months)', customer_type: 'BOTH', description: 'Bank account proof for solar loan processing and direct benefit transfer / subsidy verification.' },
    { code: 'GST_CERTIFICATE', name: 'GST Registration Certificate', customer_type: 'B2B', description: 'Valid GSTIN certificate copy for commercial solar project.' },
    { code: 'COMPANY_INCORP', name: 'Certificate of Incorporation / Partnership Deed', customer_type: 'B2B', description: 'Official company registration legal document.' },
  ];

  const defIdMap: Record<string, string> = {};

  for (const def of standardDefinitions) {
    const exists = await db.query('SELECT id FROM document_definitions WHERE code = $1', [def.code]);
    if (exists.rows.length === 0) {
      const id = crypto.randomUUID();
      await db.query(
        `INSERT INTO document_definitions (id, code, name, description, customer_type, active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
        [id, def.code, def.name, def.description, def.customer_type]
      );
      defIdMap[def.code] = id;
    } else {
      defIdMap[def.code] = exists.rows[0].id;
    }
  }

  // Seed Requirement Rules if none exist
  const rulesCount = await db.query('SELECT COUNT(*) as count FROM document_requirement_rules');
  if (Number(rulesCount.rows[0]?.count || 0) === 0) {
    console.log('[Seed] Seeding initial ECP document requirement rules...');

    // Rule 1: Electricity Bill (ALWAYS, INDIVIDUAL)
    if (defIdMap['ELEC_BILL']) {
      const rule1Id = crypto.randomUUID();
      await db.query(
        `INSERT INTO document_requirement_rules 
         (id, rule_name, description, customer_type, requirement_type, condition_type, active, display_order)
         VALUES ($1, 'Electricity Discom Bill', 'Mandatory consumer electricity connection bill', 'BOTH', 'INDIVIDUAL', 'ALWAYS', true, 1)`,
        [rule1Id]
      );
      await db.query(
        `INSERT INTO document_rule_items (id, rule_id, document_definition_id) VALUES ($1, $2, $3)`,
        [crypto.randomUUID(), rule1Id, defIdMap['ELEC_BILL']]
      );
    }

    // Rule 2: Official Photo ID (ALWAYS, ANY_ONE_REQUIRED: Aadhaar, PAN, or Passport/Voter)
    const idItems = [defIdMap['AADHAAR_CARD'], defIdMap['PAN_CARD'], defIdMap['PASSPORT_VOTER']].filter(Boolean);
    if (idItems.length > 0) {
      const rule2Id = crypto.randomUUID();
      await db.query(
        `INSERT INTO document_requirement_rules 
         (id, rule_name, description, customer_type, requirement_type, condition_type, active, display_order)
         VALUES ($1, 'Government Photo Identity Proof', 'Customer photo ID (Aadhaar, PAN, or Passport)', 'B2C', 'ANY_ONE_REQUIRED', 'ALWAYS', true, 2)`,
        [rule2Id]
      );
      for (const defId of idItems) {
        await db.query(
          `INSERT INTO document_rule_items (id, rule_id, document_definition_id) VALUES ($1, $2, $3)`,
          [crypto.randomUUID(), rule2Id, defId]
        );
      }
    }

    // Rule 3: Roof Ownership (ALWAYS, INDIVIDUAL)
    if (defIdMap['PROPERTY_TAX']) {
      const rule3Id = crypto.randomUUID();
      await db.query(
        `INSERT INTO document_requirement_rules 
         (id, rule_name, description, customer_type, requirement_type, condition_type, active, display_order)
         VALUES ($1, 'Roof Ownership & Property Tax Proof', 'Municipal property tax receipt or registered title deed', 'B2C', 'INDIVIDUAL', 'ALWAYS', true, 3)`,
        [rule3Id]
      );
      await db.query(
        `INSERT INTO document_rule_items (id, rule_id, document_definition_id) VALUES ($1, $2, $3)`,
        [crypto.randomUUID(), rule3Id, defIdMap['PROPERTY_TAX']]
      );
    }

    // Rule 4: Solar Loan Bank Documents (Conditional: IF_LOAN_REQUIRED)
    if (defIdMap['BANK_STATEMENT']) {
      const rule4Id = crypto.randomUUID();
      await db.query(
        `INSERT INTO document_requirement_rules 
         (id, rule_name, description, customer_type, requirement_type, condition_type, active, display_order)
         VALUES ($1, 'Bank Statement / Cancelled Cheque', 'Mandatory when Solar Loan is requested', 'B2C', 'INDIVIDUAL', 'IF_LOAN_REQUIRED', true, 4)`,
        [rule4Id]
      );
      await db.query(
        `INSERT INTO document_rule_items (id, rule_id, document_definition_id) VALUES ($1, $2, $3)`,
        [crypto.randomUUID(), rule4Id, defIdMap['BANK_STATEMENT']]
      );
    }

    // Rule 5: Commercial GST & Incorporation (ALWAYS for B2B, ALL_REQUIRED)
    const b2bItems = [defIdMap['GST_CERTIFICATE'], defIdMap['COMPANY_INCORP']].filter(Boolean);
    if (b2bItems.length > 0) {
      const rule5Id = crypto.randomUUID();
      await db.query(
        `INSERT INTO document_requirement_rules 
         (id, rule_name, description, customer_type, requirement_type, condition_type, active, display_order)
         VALUES ($1, 'Commercial Statutory Registration', 'GSTIN and Certificate of Incorporation', 'B2B', 'ALL_REQUIRED', 'ALWAYS', true, 5)`,
        [rule5Id]
      );
      for (const defId of b2bItems) {
        await db.query(
          `INSERT INTO document_rule_items (id, rule_id, document_definition_id) VALUES ($1, $2, $3)`,
          [crypto.randomUUID(), rule5Id, defId]
        );
      }
    }
  }

  // Ensure sample historical leads exist for previous month dashboard testing
  const pastMonthCheck = await db.query(
    `SELECT COUNT(*) FROM leads WHERE created_at < DATE_TRUNC('month', NOW())`
  );
  if (parseInt(pastMonthCheck.rows[0].count, 10) === 0) {
    const ownerUser = await db.query(`SELECT id FROM users WHERE role = 'OWNER' LIMIT 1`);
    if (ownerUser.rows.length > 0) {
      const oId = ownerUser.rows[0].id;
      const pastLead1Id = crypto.randomUUID();
      await db.query(
        `INSERT INTO leads (
          id, customer_name, mobile_number, customer_type, email, address, location,
          lead_source, owner_id, created_by, status, current_team, action_required,
          b2b_credit_extended, requested_credit_amount, approved_credit_amount, subtotal, freight, tax_mode, igst_rate, igst_amount,
          total_project_value, remarks, created_at, updated_at
        ) VALUES (
          $1, 'Prestige Warehousing & Logistics', '9845012345', 'B2B', 'admin@prestigelogistics.in', 'Plot 12, Peenya Industrial Stage 3',
          'Bengaluru', 'Direct Referral', $2, $2, 'QUALIFIED', 'LEAD', false,
          'NO', 0, 0, 850000, 15000, 'INTRA_STATE', 0, 0,
          960000, 'Warehouse rooftop 25kW commercial solar installation', NOW() - INTERVAL '35 days', NOW() - INTERVAL '30 days'
        )`,
        [pastLead1Id, oId]
      );

      const pastLead2Id = crypto.randomUUID();
      await db.query(
        `INSERT INTO leads (
          id, customer_name, mobile_number, customer_type, email, address, location,
          lead_source, owner_id, created_by, status, current_team, action_required,
          b2c_loan_required, subtotal, freight, tax_mode, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
          total_project_value, remarks, created_at, updated_at
        ) VALUES (
          $1, 'Dr. Ramesh Sharma', '9822334455', 'B2C', 'sharma.ramesh@example.com', '12th Cross, Indiranagar',
          'Bengaluru', 'Website Form', $2, $2, 'DOCUMENTATION_COMPLETE', 'REGISTRATION_1', false,
          'YES', 320000, 5000, 'INTRA_STATE', 6.0, 19500, 6.0, 19500,
          364000, 'Villa rooftop 7kW on-grid solar system', NOW() - INTERVAL '40 days', NOW() - INTERVAL '32 days'
        )`,
        [pastLead2Id, oId]
      );
      console.log('[Seed] Added sample historical leads from previous month.');
    }
  }

  // 5. Ensure diverse Registration Team sample projects exist for all queues:
  // - Reg 1 (Financing = YES)
  // - Reg 1 (Financing = NO)
  // - Net Metering (Reg 1 completed, Net Metering in progress)
  // - Registration 2 (Net Metering closed, Subsidy claim in progress)
  // - Delayed Registration Work (Age > 5 days)
  try {
    const ownerUser = await db.query(`SELECT id FROM users WHERE role = 'OWNER' LIMIT 1`);
    if (ownerUser.rows.length > 0) {
      const oId = ownerUser.rows[0].id;

      // Project 1: Reg 1 (Financing = NO) - Sunita Verma
      const reg1Check = await db.query(`SELECT id FROM leads WHERE customer_name = 'Sunita Verma' LIMIT 1`);
      let reg1LeadId = reg1Check.rows[0]?.id;
      if (!reg1LeadId) {
        reg1LeadId = crypto.randomUUID();
        await db.query(
          `INSERT INTO leads (
            id, customer_name, mobile_number, customer_type, email, address, location,
            lead_source, owner_id, created_by, status, current_team, action_required,
            b2c_loan_required, subtotal, freight, tax_mode, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
            total_project_value, remarks, created_at, updated_at
          ) VALUES (
            $1, 'Sunita Verma', '9844112233', 'B2C', 'sunita.verma@example.com', '142, 6th Main, Malleshwaram',
            'Bengaluru', 'Direct Referral', $2, $2, 'DOCUMENTATION_COMPLETE', 'REGISTRATION_1', false,
            'NO', 250000, 4000, 'INTRA_STATE', 6.0, 15240, 6.0, 15240,
            284480, '5kW Rooftop Residential On-Grid. Self-financed, no loan needed.', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'
          )`,
          [reg1LeadId, oId]
        );
      }
      await RegistrationService.ensureTasksForLead(reg1LeadId);

      // Project 2: Net Metering - GreenTech Engineering Works (B2B)
      const netCheck = await db.query(`SELECT id FROM leads WHERE customer_name = 'GreenTech Engineering Works' LIMIT 1`);
      let netLeadId = netCheck.rows[0]?.id;
      if (!netLeadId) {
        netLeadId = crypto.randomUUID();
        await db.query(
          `INSERT INTO leads (
            id, customer_name, mobile_number, customer_type, email, address, location,
            lead_source, owner_id, created_by, status, current_team, action_required,
            b2b_credit_extended, requested_credit_amount, approved_credit_amount, subtotal, freight, tax_mode, igst_rate, igst_amount,
            total_project_value, remarks, created_at, updated_at
          ) VALUES (
            $1, 'GreenTech Engineering Works', '9988776655', 'B2B', 'operations@greentechworks.com', 'Plot 88, KIADB Industrial Area',
            'Hosur Road, Bengaluru', 'Trade Show', $2, $2, 'DOCUMENTATION_COMPLETE', 'REGISTRATION_TEAM', false,
            'YES', 200000, 200000, 950000, 15000, 'INTRA_STATE', 0, 0,
            1080800, '25kW Commercial Rooftop Solar Array. Registration 1 completed, ready for Net Metering coordination.', NOW() - INTERVAL '15 days', NOW() - INTERVAL '2 days'
          )`,
          [netLeadId, oId]
        );
      }
      await RegistrationService.ensureTasksForLead(netLeadId);
      // Mark Reg 1 tasks as completed so it sits in Net Metering queue
      await db.query(
        `UPDATE registration_tasks SET status = 'COMPLETED', completed_at = NOW() - INTERVAL '3 days'
         WHERE lead_id = $1 AND stage = 'REGISTRATION_1' AND status != 'NOT_APPLICABLE'`,
        [netLeadId]
      );
      // Mark first net metering task as completed
      await db.query(
        `UPDATE registration_tasks SET status = 'COMPLETED', completed_at = NOW() - INTERVAL '1 day'
         WHERE lead_id = $1 AND task_code = 'INSTALLATION_PHOTOS'`,
        [netLeadId]
      );

      // Project 3: Registration 2 - Vikram Hegde (Subsidies & Commissioning)
      const reg2Check = await db.query(`SELECT id FROM leads WHERE customer_name = 'Vikram Hegde' LIMIT 1`);
      let reg2LeadId = reg2Check.rows[0]?.id;
      if (!reg2LeadId) {
        reg2LeadId = crypto.randomUUID();
        await db.query(
          `INSERT INTO leads (
            id, customer_name, mobile_number, customer_type, email, address, location,
            lead_source, owner_id, created_by, status, current_team, action_required,
            b2c_loan_required, subtotal, freight, tax_mode, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
            total_project_value, remarks, created_at, updated_at
          ) VALUES (
            $1, 'Vikram Hegde', '9731223344', 'B2C', 'vikram.hegde@example.com', '78, 4th Cross, Koramangala 4th Block',
            'Bengaluru', 'Online Ad', $2, $2, 'DOCUMENTATION_COMPLETE', 'REGISTRATION_TEAM', false,
            'NO', 380000, 6000, 'INTRA_STATE', 6.0, 23160, 6.0, 23160,
            432320, '10kW Premium Solar System. Installation & Net Metering closed on-site. Subsidy claim pending.', NOW() - INTERVAL '25 days', NOW() - INTERVAL '1 day'
          )`,
          [reg2LeadId, oId]
        );
      }
      await RegistrationService.ensureTasksForLead(reg2LeadId);
      // Mark Reg 1 and Net Metering tasks as completed (including Close Net Metering)
      await db.query(
        `UPDATE registration_tasks SET status = 'COMPLETED', completed_at = NOW() - INTERVAL '2 days'
         WHERE lead_id = $1 AND stage IN ('REGISTRATION_1', 'NET_METERING') AND status != 'NOT_APPLICABLE'`,
        [reg2LeadId]
      );

      // Project 4: Delayed Registration 1 Work - Kavitha Nair (> 7 days in Reg 1)
      const delayedCheck = await db.query(`SELECT id FROM leads WHERE customer_name = 'Kavitha Nair' LIMIT 1`);
      let delayedLeadId = delayedCheck.rows[0]?.id;
      if (!delayedLeadId) {
        delayedLeadId = crypto.randomUUID();
        await db.query(
          `INSERT INTO leads (
            id, customer_name, mobile_number, customer_type, email, address, location,
            lead_source, owner_id, created_by, status, current_team, action_required,
            b2c_loan_required, subtotal, freight, tax_mode, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
            total_project_value, remarks, created_at, updated_at
          ) VALUES (
            $1, 'Kavitha Nair', '9900112233', 'B2C', 'kavitha.nair@example.com', 'Villa 21, Palm Meadows',
            'Whitefield, Bengaluru', 'Website Form', $2, $2, 'DOCUMENTATION_COMPLETE', 'REGISTRATION_1', true,
            'YES', 310000, 5000, 'INTRA_STATE', 6.0, 18900, 6.0, 18900,
            352800, '8kW Villa Solar Rooftop. Consumer Request submitted 8 days ago; consumer CVA signature delayed.', NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days'
          )`,
          [delayedLeadId, oId]
        );
      }
      await RegistrationService.ensureTasksForLead(delayedLeadId);
      // Mark only Consumer Request as completed, leaving CVA pending > 8 days
      await db.query(
        `UPDATE registration_tasks SET status = 'COMPLETED', completed_at = NOW() - INTERVAL '8 days'
         WHERE lead_id = $1 AND task_code = 'CONSUMER_REQUEST'`,
        [delayedLeadId]
      );

      // Ensure historical lead Ramesh Sharma also has tasks initialized
      const rameshLead = await db.query(`SELECT id FROM leads WHERE customer_name = 'Dr. Ramesh Sharma' LIMIT 1`);
      if (rameshLead.rows.length > 0) {
        await RegistrationService.ensureTasksForLead(rameshLead.rows[0].id);
      }

      // 5. Seed Site Visits for Installation Manager workflow testing
      const svCountRes = await db.query(`SELECT COUNT(*) as count FROM site_visits`);
      if (Number(svCountRes.rows[0]?.count || 0) === 0) {
        console.log('[Seed] Seeding sample site visits for Installation Manager...');
        
        const leadUserRes = await db.query(`SELECT id FROM users WHERE role = 'LEAD' LIMIT 1`);
        const instMgrRes = await db.query(`SELECT id FROM users WHERE role = 'INSTALLATION_MANAGER' LIMIT 1`);
        const instMemberRes = await db.query(`SELECT id FROM users WHERE role = 'INSTALLATION_MEMBER' ORDER BY username ASC`);

        const leadUserId = leadUserRes.rows[0]?.id || oId;
        const instMgrId = instMgrRes.rows[0]?.id;
        const member1Id = instMemberRes.rows[0]?.id;
        const member2Id = instMemberRes.rows[1]?.id || member1Id;

        // A. Unassigned Site Visit (Waiting for Installation Manager assignment)
        const svLead1 = await db.query(`SELECT id FROM leads WHERE customer_name = 'Sunil Joshi' LIMIT 1`);
        if (svLead1.rows.length > 0) {
          const sv1Id = crypto.randomUUID();
          await db.query(
            `INSERT INTO site_visits (
              id, lead_id, requesting_user_id, status, notes, created_at, updated_at
            ) VALUES ($1, $2, $3, 'PENDING_ASSIGNMENT', 'Customer requested pre-feasibility survey for 5kW rooftop. Flat terrace with partial shade on east.', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')`,
            [sv1Id, svLead1.rows[0].id, leadUserId]
          );
          await db.query(
            `UPDATE leads SET status = 'SITE_VISIT_PENDING', current_team = 'INSTALLATION_MANAGER', action_required = true WHERE id = $1`,
            [svLead1.rows[0].id]
          );
        }

        // B. Assigned Site Visit in Progress (Assigned to Vikas Singh with scheduled date)
        const svLead2Id = crypto.randomUUID();
        await db.query(
          `INSERT INTO leads (
            id, customer_name, mobile_number, customer_type, email, address, location,
            lead_source, owner_id, created_by, status, current_team, action_required,
            b2c_loan_required, subtotal, freight, tax_mode, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
            total_project_value, remarks, created_at, updated_at
          ) VALUES (
            $1, 'Ananya Sen', '9845012345', 'B2C', 'ananya.sen@example.com', 'No. 88, 4th Cross, Indiranagar',
            'Bengaluru East', 'Direct Referral', $2, $2, 'SITE_VISIT_PENDING', 'INSTALLATION_TEAM', true,
            'NO', 320000, 5000, 'INTRA_STATE', 6.0, 19500, 6.0, 19500,
            364000, 'Requires shadow analysis for 6kW hybrid setup with battery backup.', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'
          )`,
          [svLead2Id, leadUserId]
        );

        const sv2Id = crypto.randomUUID();
        await db.query(
          `INSERT INTO site_visits (
            id, lead_id, requesting_user_id, assigned_member_id, assigned_by_id, status, notes, scheduled_date, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, 'ASSIGNED', 'Check RCC roof slab load capacity and earthing distance to meter board.', NOW() + INTERVAL '1 day', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day')`,
          [sv2Id, svLead2Id, leadUserId, member1Id, instMgrId]
        );

        // C. Completed Site Visit with inspection report & photos
        const svLead3Id = crypto.randomUUID();
        await db.query(
          `INSERT INTO leads (
            id, customer_name, mobile_number, customer_type, email, address, location,
            lead_source, owner_id, created_by, status, current_team, action_required,
            b2c_loan_required, subtotal, freight, tax_mode, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
            total_project_value, remarks, created_at, updated_at
          ) VALUES (
            $1, 'Vikramaditya Roy', '9820055443', 'B2C', 'vikram.roy@example.com', 'Plot 12, Koramangala 3rd Block',
            'Bengaluru South', 'Walk-in', $2, $2, 'QUALIFIED', 'LEAD', false,
            'NO', 450000, 8000, 'INTRA_STATE', 6.0, 27480, 6.0, 27480,
            512960, 'Completed rooftop feasibility survey. Roof confirmed 100% shade-free RCC.', NOW() - INTERVAL '6 days', NOW() - INTERVAL '3 days'
          )`,
          [svLead3Id, leadUserId]
        );

        const sv3Id = crypto.randomUUID();
        await db.query(
          `INSERT INTO site_visits (
            id, lead_id, requesting_user_id, assigned_member_id, assigned_by_id, status, notes, completion_details, completed_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, 'COMPLETED', 'Site visit completed. Verified 750 sq.ft shade-free roof with 3-phase connection.', 'RCC slab is in excellent condition. Recommended 8kW system with south-facing 15-degree tilt. Earthing pit location confirmed in backyard.', NOW() - INTERVAL '3 days', NOW() - INTERVAL '6 days', NOW() - INTERVAL '3 days')`,
          [sv3Id, svLead3Id, leadUserId, member2Id, instMgrId]
        );

        // Add sample photo to completed site visit
        if (member2Id) {
          await db.query(
            `INSERT INTO site_visit_photos (id, site_visit_id, uploader_id, file_path, original_name, size_bytes, mime_type, uploaded_at)
             VALUES ($1, $2, $3, 'uploads/site_visits/sample_terrace.jpg', 'terrace_panoramic_view.jpg', 245000, 'image/jpeg', NOW() - INTERVAL '3 days')`,
            [crypto.randomUUID(), sv3Id, member2Id]
          );
        }

        // Assign installers on existing ECP projects for diverse workload demonstration
        if (member1Id) {
          await db.query(
            `UPDATE leads SET assigned_installer_id = $1 WHERE customer_name = 'Dr. Ramesh Sharma'`,
            [member1Id]
          );
        }
        if (member2Id) {
          await db.query(
            `UPDATE leads SET assigned_installer_id = $1 WHERE customer_name = 'Priya Venkat'`,
            [member2Id]
          );
        }
        // Kavitha Nair remains unassigned to demonstrate unassigned ECP alert!
      }

      // Seed sample Receipts & Follow-ups for Accounts Team
      const rcpCountRes = await db.query(`SELECT COUNT(*) FROM customer_receipts`);
      if (Number(rcpCountRes.rows[0]?.count || 0) === 0) {
        console.log('[Seed] Seeding sample customer receipts and follow-ups for Accounts Team...');
        const accountsUserRes = await db.query(`SELECT id FROM users WHERE role = 'ACCOUNTS' LIMIT 1`);
        const accountsUserId = accountsUserRes.rows[0]?.id || oId;

        // 1. Dr. Ramesh Sharma (B2C with Loan) -> Bank Loan Disbursement receipt
        const rameshLead = await db.query(`SELECT id, total_project_value FROM leads WHERE customer_name = 'Dr. Ramesh Sharma' LIMIT 1`);
        if (rameshLead.rows.length > 0) {
          const lId = rameshLead.rows[0].id;
          await db.query(
            `INSERT INTO customer_receipts (
              id, receipt_number, lead_id, amount, receipt_date, payment_mode, reference_number,
              receipt_type, payer_type, payer_name, bank_name, deposited_in_account, status, remarks, recorded_by, created_at
            ) VALUES (
              $1, 'RCP-2026-0001', $2, 150000, CURRENT_DATE - INTERVAL '4 days', 'BANK_LOAN_DISBURSEMENT', 'SBI-LN-99281923',
              'BANK_LOAN_DISBURSEMENT', 'BANK', 'State Bank of India (Solar Loan Cell)', 'SBI Solar Project Finance Branch', 'Solar ERP Escrow A/c 9011',
              'CLEARED', 'Initial loan sanction advance disbursement received from lender directly.', $3, NOW() - INTERVAL '4 days'
            )`,
            [crypto.randomUUID(), lId, accountsUserId]
          );
          // Advance received -> Cleared for dispatch!
          await db.query(
            `UPDATE leads SET dispatch_status = 'DISPATCH_CLEARED', dispatch_cleared_at = NOW() - INTERVAL '4 days', dispatch_cleared_by = $1, dispatch_remarks = 'Hard Rule Satisfied: Advance received via SBI Bank Loan Disbursement.' WHERE id = $2`,
            [accountsUserId, lId]
          );
        }

        // 2. Priya Venkat (B2C without Loan) -> Customer Direct Advance
        const priyaLead = await db.query(`SELECT id, total_project_value FROM leads WHERE customer_name = 'Priya Venkat' LIMIT 1`);
        if (priyaLead.rows.length > 0) {
          const lId = priyaLead.rows[0].id;
          await db.query(
            `INSERT INTO customer_receipts (
              id, receipt_number, lead_id, amount, receipt_date, payment_mode, reference_number,
              receipt_type, payer_type, payer_name, bank_name, deposited_in_account, status, remarks, recorded_by, created_at
            ) VALUES (
              $1, 'RCP-2026-0002', $2, 60000, CURRENT_DATE - INTERVAL '3 days', 'UPI', 'UPI/482910482910/HDFC',
              'ADVANCE', 'CUSTOMER', 'Priya Venkat', 'HDFC Bank', 'Solar ERP Current A/c 1022',
              'CLEARED', 'Booking advance received from customer via UPI.', $3, NOW() - INTERVAL '3 days'
            )`,
            [crypto.randomUUID(), lId, accountsUserId]
          );
          // Advance received -> Cleared for dispatch!
          await db.query(
            `UPDATE leads SET dispatch_status = 'DISPATCH_CLEARED', dispatch_cleared_at = NOW() - INTERVAL '3 days', dispatch_cleared_by = $1, dispatch_remarks = 'Hard Rule Satisfied: Customer booking advance cleared.' WHERE id = $2`,
            [accountsUserId, lId]
          );
        }

        // 3. Kavitha Nair (B2C without Loan) -> NO ADVANCE YET!
        const kavithaLead = await db.query(`SELECT id FROM leads WHERE customer_name = 'Kavitha Nair' LIMIT 1`);
        if (kavithaLead.rows.length > 0) {
          const lId = kavithaLead.rows[0].id;
          // Remains PENDING_ADVANCE (Hard Rule: Dispatch Blocked!)
          await db.query(
            `UPDATE leads SET dispatch_status = 'PENDING_ADVANCE', dispatch_remarks = 'BLOCKED: Awaiting customer advance payment before material dispatch.' WHERE id = $1`,
            [lId]
          );
          // Log an accounts follow-up for advance
          await db.query(
            `INSERT INTO receipt_followups (
              id, lead_id, follow_up_date, promised_payment_date, promised_amount,
              contact_person, contact_phone, status, remarks, recorded_by, created_at
            ) VALUES (
              $1, $2, NOW() + INTERVAL '4 hours', CURRENT_DATE + INTERVAL '2 days', 50000,
              'Kavitha Nair', '9845099881', 'SCHEDULED', 'Customer informed that RTGS transfer for token advance will be initiated after architect approval.', $3, NOW() - INTERVAL '1 day'
            )`,
            [crypto.randomUUID(), lId, accountsUserId]
          );
        }

        // 4. Apex Precision Industries (B2B, Credit Extended) -> Owner Approved & Advance Paid
        const apexLead = await db.query(`SELECT id FROM leads WHERE customer_name LIKE '%Apex Precision%' LIMIT 1`);
        if (apexLead.rows.length > 0) {
          const lId = apexLead.rows[0].id;
          await db.query(
            `INSERT INTO customer_receipts (
              id, receipt_number, lead_id, amount, receipt_date, payment_mode, reference_number,
              receipt_type, payer_type, payer_name, bank_name, deposited_in_account, status, remarks, recorded_by, created_at
            ) VALUES (
              $1, 'RCP-2026-0003', $2, 450000, CURRENT_DATE - INTERVAL '5 days', 'NEFT_RTGS', 'UTR: HDFCR520260901827',
              'ADVANCE', 'CUSTOMER', 'Apex Precision Industries Pvt Ltd', 'HDFC Bank Corporate', 'Solar ERP Current A/c 1022',
              'CLEARED', 'Upfront non-credit portion received as per approved 30-day commercial credit terms.', $3, NOW() - INTERVAL '5 days'
            )`,
            [crypto.randomUUID(), lId, accountsUserId]
          );
          await db.query(
            `UPDATE leads SET b2b_credit_days = 30, b2b_credit_due_date = CURRENT_DATE + INTERVAL '25 days', b2b_credit_compliance_status = 'COMPLIANT' WHERE id = $1`,
            [lId]
          );
        }

        // 5. Ensure Zenith Textiles Ltd (B2B) has credit terms set
        const zenithLead = await db.query(`SELECT id FROM leads WHERE customer_name LIKE '%Zenith%' LIMIT 1`);
        if (zenithLead.rows.length > 0) {
          await db.query(
            `UPDATE leads SET b2b_credit_days = 45, b2b_credit_compliance_status = 'PENDING_REVIEW' WHERE id = $1`,
            [zenithLead.rows[0].id]
          );
          await db.query(
            `INSERT INTO receipt_followups (
              id, lead_id, follow_up_date, contact_person, contact_phone, status, remarks, recorded_by, created_at
            ) VALUES (
              $1, $2, NOW() - INTERVAL '1 day', 'Ramesh Chawla (CFO)', '9820011223', 'PROMISED_TO_PAY', 'Commercial credit agreement pending owner sign-off. Customer promised PO release once approved.', $3, NOW() - INTERVAL '2 days'
            )`,
            [crypto.randomUUID(), zenithLead.rows[0].id, accountsUserId]
          );
        }
      }
    }
  } catch (e) {
    console.warn('[Seed] Notice initializing registration & installation sample data:', e);
  }

  try {
    await seedDummyData();
  } catch (err) {
    console.error('[Seed] Error running seedDummyData:', err);
  }

  // 6. Seed sample after-sales service complaints if table is empty
  try {
    const existingComplaints = await db.query('SELECT COUNT(*) as count FROM service_complaints');
    if (parseInt(existingComplaints.rows[0].count, 10) === 0) {
      console.log('[Seed] Seeding sample after-sales complaints...');
      const techUserRes = await db.query(`SELECT id, name FROM users WHERE role = 'INSTALLATION_MEMBER' LIMIT 1`);
      const serviceUserRes = await db.query(`SELECT id, name FROM users WHERE role = 'SERVICE' LIMIT 1`);
      const techId = techUserRes.rows[0]?.id || null;
      const techName = techUserRes.rows[0]?.name || 'Vikas Singh (Field Tech)';
      const serviceUserId = serviceUserRes.rows[0]?.id || null;

      const sampleComplaints = [
        {
          id: crypto.randomUUID(),
          ticket_number: 'SRV-2026-001',
          customer_name: 'Rajesh Gupta',
          customer_phone: '9845012345',
          customer_email: 'rajesh.gupta@example.com',
          customer_address: 'Plot 45, Golden Palms Layout, Sarjapur Road',
          city: 'Bengaluru',
          system_capacity_kw: 5.0,
          inverter_brand_model: 'Growatt 5000TL3-S 3-Phase',
          inverter_serial: 'GW5K-2024-88391',
          commissioning_date: '2025-06-15',
          category: 'INVERTER_FAULT',
          priority: 'HIGH',
          status: 'ASSIGNED',
          title: 'Inverter error code F08 / Grid Overvoltage tripping',
          description: 'Inverter displays Error F08 and disconnects from grid during peak solar generation (12:30 PM to 2:00 PM). Local DISCOM line voltage fluctuates around 258V.',
          reported_channel: 'PHONE',
          reported_at: 'NOW() - INTERVAL \'18 hours\'',
          sla_due_at: 'NOW() + INTERVAL \'30 hours\'',
          assigned_to_user_id: techId,
          assigned_to_name: techName,
          assigned_at: 'NOW() - INTERVAL \'12 hours\'',
          assignment_notes: 'Please visit sarjapur site with digital multimeter to verify AC voltage tapped at distribution board.',
          is_warranty_claim: false,
        },
        {
          id: crypto.randomUUID(),
          ticket_number: 'SRV-2026-002',
          customer_name: 'Anita Sharma',
          customer_phone: '9811223344',
          customer_email: 'anita.s@example.com',
          customer_address: 'B-12, Sector 14, Urban Estate',
          city: 'Gurugram',
          system_capacity_kw: 3.3,
          inverter_brand_model: 'Solis 3.3kW Single Phase Dual MPPT',
          inverter_serial: 'SOL-3K-9921',
          commissioning_date: '2025-09-10',
          category: 'APP_OFFLINE',
          priority: 'MEDIUM',
          status: 'OPEN',
          title: 'Inverter Wi-Fi Dongle offline after home broadband router change',
          description: 'Customer updated home Airtel Xstream fiber router. Mobile monitoring app shows offline status for past 4 days. Need remote Wi-Fi re-configuration support.',
          reported_channel: 'WHATSAPP',
          reported_at: 'NOW() - INTERVAL \'6 hours\'',
          sla_due_at: 'NOW() + INTERVAL \'66 hours\'',
          assigned_to_user_id: null,
          assigned_to_name: null,
          assigned_at: null,
          assignment_notes: null,
          is_warranty_claim: false,
        },
        {
          id: crypto.randomUUID(),
          ticket_number: 'SRV-2026-003',
          customer_name: 'Apex Industrial Textiles Ltd',
          customer_phone: '9820055443',
          customer_email: 'maintenance@apextextiles.in',
          customer_address: 'Survey 104, Industrial Corridor, Peenya',
          city: 'Bengaluru',
          system_capacity_kw: 40.0,
          inverter_brand_model: 'Sungrow 40kW Commercial Inverter',
          inverter_serial: 'SG-40K-00214',
          commissioning_date: '2025-03-20',
          category: 'GENERATION_DROP',
          priority: 'CRITICAL',
          status: 'IN_PROGRESS',
          title: 'String 2 showing 35% lower current on DC Combiner Box',
          description: 'Factory plant engineer reported String 2 generation dropped from 18A to 11A. Suspected loose MC4 connector or micro-crack on western roof array.',
          reported_channel: 'PORTAL',
          reported_at: 'NOW() - INTERVAL \'14 hours\'',
          sla_due_at: 'NOW() + INTERVAL \'10 hours\'',
          assigned_to_user_id: techId,
          assigned_to_name: techName,
          assigned_at: 'NOW() - INTERVAL \'13 hours\'',
          assignment_notes: 'Urgent commercial customer. Field team dispatched with thermal imaging camera and clamp meter.',
          is_warranty_claim: false,
        },
        {
          id: crypto.randomUUID(),
          ticket_number: 'SRV-2026-004',
          customer_name: 'Sunil Kulkarni',
          customer_phone: '9448112233',
          customer_email: 'sunil.kulkarni@example.com',
          customer_address: 'Shanti Nagar, 3rd Cross',
          city: 'Hubballi',
          system_capacity_kw: 5.5,
          inverter_brand_model: 'Growatt 5000TL3-S',
          inverter_serial: 'GW5K-8812',
          commissioning_date: '2025-01-18',
          category: 'WIRING_LEAKAGE',
          priority: 'HIGH',
          status: 'RESOLVED',
          title: 'ACDB Breaker tripping intermittently during morning startup',
          description: 'Morning solar energization caused 32A C-Curve MCB in ACDB to trip repeatedly.',
          reported_channel: 'PHONE',
          reported_at: 'NOW() - INTERVAL \'3 days\'',
          sla_due_at: 'NOW() - INTERVAL \'1 day\'',
          assigned_to_user_id: techId,
          assigned_to_name: techName,
          assigned_at: 'NOW() - INTERVAL \'2 days\'',
          assignment_notes: 'Investigate AC isolator and circuit breaker terminals.',
          technician_visit_date: '2026-09-24',
          root_cause: 'Loose screw connection on ACDB phase connector caused terminal overheating and thermal magnetic tripping.',
          action_taken: 'Replaced charred 32A MCB with industrial grade Schneider 32A 10kA breaker. Re-crimped copper ferrules and tightened torque.',
          parts_replaced: '1x 32A 4-Pole MCB Schneider Acti9, 4x copper insulated ferrules',
          resolution_notes: 'System re-tested under 4.8kW full load. No heat signature detected. Customer signed off on delivery slip.',
          resolved_at: 'NOW() - INTERVAL \'12 hours\'',
          resolved_by: techId,
          customer_rating: 5,
          customer_feedback: 'Prompt visit and professional repair work. Very satisfied with solar service team!',
          is_warranty_claim: true,
          warranty_claim_number: 'CLM-SCH-2026-09',
        }
      ];

      for (const comp of sampleComplaints) {
        await db.query(`
          INSERT INTO service_complaints (
            id, ticket_number, customer_name, customer_phone, customer_email,
            customer_address, city, system_capacity_kw, inverter_brand_model, inverter_serial,
            commissioning_date, category, priority, status, title, description,
            reported_channel, reported_at, sla_due_at, assigned_to_user_id, assigned_to_name,
            assigned_at, assignment_notes, technician_visit_date, root_cause, action_taken,
            parts_replaced, resolution_notes, resolved_at, resolved_by, customer_rating,
            customer_feedback, is_warranty_claim, warranty_claim_number, created_by, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16,
            $17, ${comp.reported_at}, ${comp.sla_due_at}, $18, $19,
            ${comp.assigned_at ? comp.assigned_at : 'NULL'}, $20, $21, $22, $23,
            $24, $25, ${comp.resolved_at ? comp.resolved_at : 'NULL'}, $26, $27,
            $28, $29, $30, $31, ${comp.reported_at}, NOW()
          )
        `, [
          comp.id, comp.ticket_number, comp.customer_name, comp.customer_phone, comp.customer_email,
          comp.customer_address, comp.city, comp.system_capacity_kw, comp.inverter_brand_model, comp.inverter_serial,
          comp.commissioning_date, comp.category, comp.priority, comp.status, comp.title, comp.description,
          comp.reported_channel, comp.assigned_to_user_id, comp.assigned_to_name,
          comp.assignment_notes, comp.technician_visit_date || null, comp.root_cause || null, comp.action_taken || null,
          comp.parts_replaced || null, comp.resolution_notes || null, comp.resolved_by || null, comp.customer_rating || null,
          comp.customer_feedback || null, comp.is_warranty_claim, comp.warranty_claim_number || null, serviceUserId
        ]);

        // Add initial activity
        await db.query(`
          INSERT INTO service_complaint_activities (
            id, complaint_id, actor_name, action_type, new_status, notes, created_at
          ) VALUES (
            $1, $2, 'Vikram Joshi (Service Desk)', 'CREATED', 'OPEN', 'Customer complaint logged in service system.', ${comp.reported_at}
          )
        `, [crypto.randomUUID(), comp.id]);

        if (comp.assigned_to_user_id) {
          await db.query(`
            INSERT INTO service_complaint_activities (
              id, complaint_id, actor_name, action_type, old_status, new_status, notes, created_at
            ) VALUES (
              $1, $2, 'Vikram Joshi (Service Desk)', 'ASSIGNED', 'OPEN', 'ASSIGNED', $3, ${comp.assigned_at || 'NOW()'}
            )
          `, [crypto.randomUUID(), comp.id, `Ticket assigned to technician ${comp.assigned_to_name}.`]);
        }

        if (comp.status === 'RESOLVED') {
          await db.query(`
            INSERT INTO service_complaint_activities (
              id, complaint_id, actor_name, action_type, old_status, new_status, notes, created_at
            ) VALUES (
              $1, $2, $3, 'RESOLVED', 'ASSIGNED', 'RESOLVED', $4, ${comp.resolved_at || 'NOW()'}
            )
          `, [crypto.randomUUID(), comp.id, comp.assigned_to_name, `Issue resolved: ${comp.resolution_notes}`]);
        }
      }
      console.log('[Seed] Sample after-sales complaints ready.');
    }
  } catch (err) {
    console.warn('[Seed] Notice initializing service complaints:', err);
  }

  console.log('[Seed] Master data ready.');
}
