import crypto from 'crypto';
import { getDB } from './db/index.ts';
import { RegistrationService } from './services/registrationService.ts';

export async function seedDummyData() {
  const db = await getDB();
  console.log('[SeedDummy] Checking and adding comprehensive dummy data...');

  // Get users for foreign key references
  const usersRes = await db.query('SELECT id, username, role FROM users');
  const userMap = new Map<string, string>();
  for (const u of usersRes.rows) {
    userMap.set(u.username, u.id);
  }

  const lead1Id = userMap.get('lead1') || usersRes.rows.find(u => u.role === 'LEAD')?.id;
  const ownerId = userMap.get('owner') || usersRes.rows.find(u => u.role === 'OWNER')?.id;
  const instMgrId = userMap.get('instmgr') || userMap.get('inst_mgr') || usersRes.rows.find(u => u.role === 'INSTALLATION_MANAGER')?.id;
  const instMember1Id = userMap.get('instmember') || usersRes.rows.find(u => u.role === 'INSTALLATION_MEMBER')?.id;
  const dispatchId = userMap.get('dispatch') || userMap.get('dispatch1') || usersRes.rows.find(u => u.role === 'DISPATCH')?.id;

  if (!lead1Id) {
    console.error('[SeedDummy] No LEAD user found! Aborting.');
    return;
  }

  // 1. Arvind Swaminathan - B2C Pending with active follow-up
  const arvindCheck = await db.query("SELECT id FROM leads WHERE customer_name = 'Arvind Swaminathan'");
  if (arvindCheck.rows.length === 0) {
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO leads (
        id, customer_name, mobile_number, customer_type, email, address, location,
        lead_source, owner_id, created_by, status, current_team, action_required,
        b2c_loan_required, subtotal, freight, tax_mode, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
        total_project_value, remarks, created_at, updated_at
      ) VALUES (
        $1, 'Arvind Swaminathan', '9845112233', 'B2C', 'arvind.swami@gmail.com', 'No. 45, 9th Main, J.P. Nagar 2nd Phase',
        'Bengaluru South', 'Website Form', $2, $2, 'PENDING', 'LEAD', true,
        'YES', 250000, 5000, 'INTRA_STATE', 6.0, 15000, 6.0, 15000,
        285000, 'Inquiring for 5kW DCR Mono PERC system under PM Surya Ghar Yojana.', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 hour'
      )`,
      [id, lead1Id]
    );
    await db.query(
      `INSERT INTO follow_ups (id, lead_id, created_by, call_sequence, scheduled_at, remarks, completed, created_at)
       VALUES ($1, $2, $3, 1, NOW() + INTERVAL '4 hours', 'Customer requested evening call after 6 PM to discuss rooftop subsidy & net metering.', false, NOW() - INTERVAL '1 day')`,
      [crypto.randomUUID(), id, lead1Id]
    );
  }

  // 2. Meenakshi Sundaram - B2C in follow-up
  const meenakshiCheck = await db.query("SELECT id FROM leads WHERE customer_name = 'Meenakshi Sundaram'");
  if (meenakshiCheck.rows.length === 0) {
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO leads (
        id, customer_name, mobile_number, customer_type, email, address, location,
        lead_source, owner_id, created_by, status, current_team, action_required,
        b2c_loan_required, subtotal, freight, tax_mode, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
        total_project_value, remarks, created_at, updated_at
      ) VALUES (
        $1, 'Meenakshi Sundaram', '9900112244', 'B2C', 'meenakshi.s@outlook.com', '120, Saraswathipuram, Near Swimming Pool',
        'Mysuru', 'Referral', $2, $2, 'PENDING', 'LEAD', false,
        'NO', 170000, 4000, 'INTRA_STATE', 6.0, 10500, 6.0, 10500,
        195000, '3kW residential rooftop on independent villa. Sent initial quotation.', NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 hours'
      )`,
      [id, lead1Id]
    );
    await db.query(
      `INSERT INTO follow_ups (id, lead_id, created_by, call_sequence, scheduled_at, remarks, completed, created_at)
       VALUES 
       ($1, $2, $3, 1, NOW() - INTERVAL '2 days', 'Discussed inverter options (Deye vs Havells). Customer reviewing proposal.', true, NOW() - INTERVAL '3 days'),
       ($4, $2, $3, 2, NOW() + INTERVAL '1 day', 'Follow-up on quotation approval and site feasibility booking.', false, NOW() - INTERVAL '1 day')`,
      [crypto.randomUUID(), id, lead1Id, crypto.randomUUID()]
    );
  }

  // 3. Deccan Precision Castings Pvt Ltd - B2B Pending Credit Evaluation
  const deccanCheck = await db.query("SELECT id FROM leads WHERE customer_name = 'Deccan Precision Castings Pvt Ltd'");
  if (deccanCheck.rows.length === 0) {
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO leads (
        id, customer_name, mobile_number, customer_type, email, address, location,
        lead_source, owner_id, created_by, status, current_team, action_required,
        b2b_credit_extended, requested_credit_amount, approved_credit_amount, subtotal, freight, tax_mode, igst_rate, igst_amount,
        total_project_value, remarks, created_at, updated_at
      ) VALUES (
        $1, 'Deccan Precision Castings Pvt Ltd', '9845778899', 'B2B', 'operations@deccancastings.com', 'Plot 18B, Peenya Industrial Area 3rd Stage',
        'Bengaluru', 'Direct Referral', $2, $2, 'PENDING', 'LEAD', true,
        'YES', 500000, 0, 1620000, 30000, 'INTRA_STATE', 0.0, 0.0,
        1850000, '50kW Industrial Rooftop shed solar installation. Requires 30 days credit on inverters.', NOW() - INTERVAL '2 days', NOW()
      )`,
      [id, lead1Id]
    );
  }

  // 4. Heritage Resort & Spa - B2B Escalated to Owner
  const heritageCheck = await db.query("SELECT id FROM leads WHERE customer_name = 'Heritage Resort & Spa'");
  if (heritageCheck.rows.length === 0) {
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO leads (
        id, customer_name, mobile_number, customer_type, email, address, location,
        lead_source, owner_id, created_by, status, current_team, action_required,
        b2b_credit_extended, requested_credit_amount, approved_credit_amount, subtotal, freight, tax_mode, igst_rate, igst_amount,
        total_project_value, remarks, created_at, updated_at
      ) VALUES (
        $1, 'Heritage Resort & Spa', '9731224466', 'B2B', 'gm@heritageresortcoorg.com', 'Survey No. 74, Madikeri-Virajpet Road',
        'Coorg', 'Walk-in', $2, $2, 'ESCALATED_TO_OWNER', 'OWNER', true,
        'YES', 400000, 0, 1250000, 20000, 'INTRA_STATE', 0.0, 0.0,
        1420000, 'Escalated to Owner: Client requested 8% special institutional discount and 45 days credit term.', NOW() - INTERVAL '3 days', NOW()
      )`,
      [id, lead1Id]
    );
  }

  // 5. Rajeshwar Rao - B2C Site Visit Pending
  const rajeshwarCheck = await db.query("SELECT id FROM leads WHERE customer_name = 'Rajeshwar Rao'");
  if (rajeshwarCheck.rows.length === 0) {
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO leads (
        id, customer_name, mobile_number, customer_type, email, address, location,
        lead_source, owner_id, created_by, status, current_team, action_required,
        b2c_loan_required, subtotal, freight, tax_mode, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
        total_project_value, remarks, created_at, updated_at
      ) VALUES (
        $1, 'Rajeshwar Rao', '9885123456', 'B2C', 'rajeshwar.rao@yahoo.co.in', 'House No. 3-4-512, Barkatpura',
        'Hyderabad', 'Social Media Campaign', $2, $2, 'SITE_VISIT_PENDING', 'INSTALLATION_MANAGER', true,
        'YES', 300000, 5000, 'INTRA_STATE', 6.0, 17500, 6.0, 17500,
        340000, '6kW hybrid solar installation. Requested site visit for shadow analysis from adjacent apartment.', NOW() - INTERVAL '1 day', NOW()
      )`,
      [id, lead1Id]
    );
    if (instMgrId) {
      await db.query(
        `INSERT INTO site_visits (
          id, lead_id, requesting_user_id, status, notes, scheduled_date, created_at, updated_at
        ) VALUES ($1, $2, $3, 'PENDING_ASSIGNMENT', 'Check RCC roof slab, measure shadow from high-rise on east, earthing pit path.', NOW() + INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW())`,
        [crypto.randomUUID(), id, lead1Id]
      );
    }
  }

  // 6. Shalini Mukherjee - B2C Lost Lead
  const shaliniCheck = await db.query("SELECT id FROM leads WHERE customer_name = 'Shalini Mukherjee'");
  if (shaliniCheck.rows.length === 0) {
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO leads (
        id, customer_name, mobile_number, customer_type, email, address, location,
        lead_source, owner_id, created_by, status, current_team, action_required,
        b2c_loan_required, subtotal, freight, tax_mode, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
        total_project_value, lost_reason, lost_remarks, remarks, created_at, updated_at
      ) VALUES (
        $1, 'Shalini Mukherjee', '9830114477', 'B2C', 'shalini.m@gmail.com', 'Villa 88, Palm Meadows, Ramagondanahalli',
        'Whitefield Bengaluru', 'Website Form', $2, $2, 'LOST', 'LEAD', false,
        'NO', 205000, 4000, 'INTRA_STATE', 6.0, 13000, 6.0, 13000,
        235000, 'PRICE_TOO_HIGH', 'Customer received lower quotation from unorganized local vendor without DCR certification.', 'Customer declined PM Surya Ghar certified proposal citing budget constraints.', NOW() - INTERVAL '8 days', NOW() - INTERVAL '4 days'
      )`,
      [id, lead1Id]
    );
  }

  // 7. Karthik Narayanan - B2C Qualified (Documents In Progress)
  const karthikCheck = await db.query("SELECT id FROM leads WHERE customer_name = 'Karthik Narayanan'");
  if (karthikCheck.rows.length === 0) {
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO leads (
        id, customer_name, mobile_number, customer_type, email, address, location,
        lead_source, owner_id, created_by, status, current_team, documentation_status, action_required,
        b2c_loan_required, subtotal, freight, tax_mode, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
        total_project_value, remarks, created_at, updated_at
      ) VALUES (
        $1, 'Karthik Narayanan', '9845332211', 'B2C', 'karthik.narayanan@techcorp.com', '324, 12th Cross, Indiranagar Stage 2',
        'Bengaluru East', 'Direct Referral', $2, $2, 'QUALIFIED', 'LEAD', 'PENDING', false,
        'NO', 410000, 7000, 'INTRA_STATE', 6.0, 24000, 6.0, 24000,
        465000, '8kW On-grid rooftop. Site feasibility survey passed with 100% shade-free roof. Collecting PM Surya Ghar subsidy docs.', NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 hours'
      )`,
      [id, lead1Id]
    );
  }

  // 8. Farhan Akhtar - B2C Qualified (Documents In Progress)
  const farhanCheck = await db.query("SELECT id FROM leads WHERE customer_name = 'Farhan Akhtar'");
  if (farhanCheck.rows.length === 0) {
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO leads (
        id, customer_name, mobile_number, customer_type, email, address, location,
        lead_source, owner_id, created_by, status, current_team, documentation_status, action_required,
        b2c_loan_required, subtotal, freight, tax_mode, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
        total_project_value, remarks, created_at, updated_at
      ) VALUES (
        $1, 'Farhan Akhtar', '9820556677', 'B2C', 'farhan.akhtar@studio.in', '78, 4th Cross, Koramangala 4th Block',
        'Bengaluru South', 'Walk-in', $2, $2, 'QUALIFIED', 'LEAD', 'PENDING', false,
        'YES', 255000, 5000, 'INTRA_STATE', 6.0, 15000, 6.0, 15000,
        290000, '5kW rooftop on independent duplex. Electricity bill verified. Awaiting bank statement for solar loan clearance.', NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 hour'
      )`,
      [id, lead1Id]
    );
  }

  // 9. Sneha Kulkarni - B2C Registration 1 Stage
  let leadSnehaId: string;
  const snehaExists = await db.query("SELECT id FROM leads WHERE customer_name = 'Sneha Kulkarni'");
  if (snehaExists.rows.length === 0) {
    leadSnehaId = crypto.randomUUID();
    await db.query(
      `INSERT INTO leads (
        id, customer_name, mobile_number, customer_type, email, address, location,
        lead_source, owner_id, created_by, status, current_team, documentation_status, action_required,
        b2c_loan_required, subtotal, freight, tax_mode, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
        total_project_value, remarks, created_at, updated_at
      ) VALUES (
        $1, 'Sneha Kulkarni', '9448123789', 'B2C', 'sneha.kulkarni@hubli.org', 'Plot 55, Shirur Park, Vidyanagar',
        'Hubballi', 'Website Form', $2, $2, 'DOCUMENTATION_COMPLETE', 'REGISTRATION_1', 'COMPLETED', false,
        'NO', 305000, 6000, 'INTRA_STATE', 6.0, 18500, 6.0, 18500,
        348000, '6kW PM Surya Ghar setup. All ECP KYC docs verified. Transferred to Registration 1 team.', NOW() - INTERVAL '9 days', NOW() - INTERVAL '2 days'
      )`,
      [leadSnehaId, lead1Id]
    );
  } else {
    leadSnehaId = snehaExists.rows[0].id;
  }
  await RegistrationService.ensureTasksForLead(leadSnehaId);

  // 10. Trident Pharma Labs - B2B Registration 1 Stage
  let leadTridentId: string;
  const tridentExists = await db.query("SELECT id FROM leads WHERE customer_name = 'Trident Pharma Labs'");
  if (tridentExists.rows.length === 0) {
    leadTridentId = crypto.randomUUID();
    await db.query(
      `INSERT INTO leads (
        id, customer_name, mobile_number, customer_type, email, address, location,
        lead_source, owner_id, created_by, status, current_team, documentation_status, action_required,
        b2b_credit_extended, requested_credit_amount, approved_credit_amount, subtotal, freight, tax_mode, igst_rate, igst_amount,
        total_project_value, remarks, created_at, updated_at
      ) VALUES (
        $1, 'Trident Pharma Labs', '9845889900', 'B2B', 'compliance@tridentpharma.in', 'Building 12, Bommasandra Industrial Area Phase 1',
        'Bengaluru', 'Direct Referral', $2, $2, 'DOCUMENTATION_COMPLETE', 'REGISTRATION_1', 'COMPLETED', false,
        'YES', 400000, 400000, 2000000, 40000, 'INTRA_STATE', 0.0, 0.0,
        2280000, '60kW Industrial solar system. Discom grid interconnection file under process with BESCOM.', NOW() - INTERVAL '12 days', NOW() - INTERVAL '3 days'
      )`,
      [leadTridentId, lead1Id]
    );
  } else {
    leadTridentId = tridentExists.rows[0].id;
  }
  await RegistrationService.ensureTasksForLead(leadTridentId);

  // 11. Gopinath Pillai - B2C Net Metering Stage
  let leadGopinathId: string;
  const gopinathExists = await db.query("SELECT id FROM leads WHERE customer_name = 'Gopinath Pillai'");
  if (gopinathExists.rows.length === 0) {
    leadGopinathId = crypto.randomUUID();
    await db.query(
      `INSERT INTO leads (
        id, customer_name, mobile_number, customer_type, email, address, location,
        lead_source, owner_id, created_by, status, current_team, documentation_status, action_required,
        b2c_loan_required, subtotal, freight, tax_mode, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
        total_project_value, remarks, created_at, updated_at
      ) VALUES (
        $1, 'Gopinath Pillai', '9844223388', 'B2C', 'gopinath.pillai@karnataka.gov.in', '88, 7th Main, 4th Block Jayanagar',
        'Bengaluru South', 'Walk-in', $2, $2, 'DOCUMENTATION_COMPLETE', 'REGISTRATION_1', 'COMPLETED', false,
        'NO', 360000, 6000, 'INTRA_STATE', 6.0, 22000, 6.0, 22000,
        410000, '7kW residential rooftop. Reg 1 stage cleared. Inverter inspection done, awaiting bi-directional net meter installation.', NOW() - INTERVAL '18 days', NOW() - INTERVAL '4 days'
      )`,
      [leadGopinathId, lead1Id]
    );
  } else {
    leadGopinathId = gopinathExists.rows[0].id;
  }
  await RegistrationService.ensureTasksForLead(leadGopinathId);
  await db.query(
    `UPDATE registration_tasks SET status = 'COMPLETED', completed_at = NOW() - INTERVAL '5 days' WHERE lead_id = $1 AND stage = 'REGISTRATION_1'`,
    [leadGopinathId]
  );

  // 12. Ananya Deshpande - B2C Registration 2 (Subsidy Claim) Stage
  let leadAnanyaDId: string;
  const ananyaDExists = await db.query("SELECT id FROM leads WHERE customer_name = 'Ananya Deshpande'");
  if (ananyaDExists.rows.length === 0) {
    leadAnanyaDId = crypto.randomUUID();
    await db.query(
      `INSERT INTO leads (
        id, customer_name, mobile_number, customer_type, email, address, location,
        lead_source, owner_id, created_by, status, current_team, documentation_status, action_required,
        b2c_loan_required, subtotal, freight, tax_mode, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
        total_project_value, remarks, created_at, updated_at
      ) VALUES (
        $1, 'Ananya Deshpande', '9845991122', 'B2C', 'ananya.deshpande@edu.org', '15, 15th Cross, Margosa Road, Malleshwaram',
        'Bengaluru North', 'Referral', $2, $2, 'DOCUMENTATION_COMPLETE', 'REGISTRATION_TEAM', 'COMPLETED', false,
        'NO', 260000, 5000, 'INTRA_STATE', 6.0, 15000, 6.0, 15000,
        295000, '5kW PM Surya Ghar solar plant. Net meter synchronized. Registration 2 subsidy claim documentation submitted.', NOW() - INTERVAL '25 days', NOW() - INTERVAL '6 days'
      )`,
      [leadAnanyaDId, lead1Id]
    );
  } else {
    leadAnanyaDId = ananyaDExists.rows[0].id;
  }
  await RegistrationService.ensureTasksForLead(leadAnanyaDId);
  await db.query(
    `UPDATE registration_tasks SET status = 'COMPLETED', completed_at = NOW() - INTERVAL '10 days' WHERE lead_id = $1 AND stage IN ('REGISTRATION_1', 'NET_METERING')`,
    [leadAnanyaDId]
  );

  // 13. Southern Spices Processing Ltd - B2B Dispatch Stage
  let leadSouthernId: string;
  const southernExists = await db.query("SELECT id FROM leads WHERE customer_name = 'Southern Spices Processing Ltd'");
  if (southernExists.rows.length === 0) {
    leadSouthernId = crypto.randomUUID();
    await db.query(
      `INSERT INTO leads (
        id, customer_name, mobile_number, customer_type, email, address, location,
        lead_source, owner_id, created_by, status, current_team, documentation_status, dispatch_status, action_required,
        b2b_credit_extended, requested_credit_amount, approved_credit_amount, subtotal, freight, tax_mode, igst_rate, igst_amount,
        transporter_name, lr_number, vehicle_number, driver_name, driver_phone, dispatch_date, estimated_delivery_date,
        total_project_value, remarks, created_at, updated_at
      ) VALUES (
        $1, 'Southern Spices Processing Ltd', '9844331100', 'B2B', 'supplychain@southernspices.com', 'Plot 45, KIADB Industrial Area',
        'Doddaballapur', 'Direct Referral', $2, $2, 'DOCUMENTATION_COMPLETE', 'DISPATCH', 'COMPLETED', 'DISPATCHED', false,
        'YES', 600000, 600000, 2600000, 45000, 'INTRA_STATE', 0.0, 0.0,
        'VRL Logistics', 'VRL-BLR-984421', 'KA-01-AK-4482', 'Mahesh Kumar', '9844112233', NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day',
        2950000, '80kW commercial solar kit dispatched: 148 Tier-1 540W Mono PERC modules, 2x 40kW Inverters, HDG structures.', NOW() - INTERVAL '22 days', NOW() - INTERVAL '1 day'
      )`,
      [leadSouthernId, lead1Id]
    );
    await db.query(
      `INSERT INTO dispatch_records (
        id, lead_id, status, transporter_name, lr_number, vehicle_number, driver_name, driver_phone,
        dispatch_date, estimated_delivery_date, dispatch_notes, dispatched_by, created_at, updated_at
      ) VALUES ($1, $2, 'DISPATCHED', 'VRL Logistics', 'VRL-BLR-984421', 'KA-01-AK-4482', 'Mahesh Kumar', '9844112233', NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day', 'All modules checked and verified against packing list.', $3, NOW() - INTERVAL '1 day', NOW())`,
      [crypto.randomUUID(), leadSouthernId, dispatchId || lead1Id]
    );
  } else {
    leadSouthernId = southernExists.rows[0].id;
  }

  // 14. Prof. M. S. Nambiar - B2C Installation Stage
  let leadNambiarId: string;
  const nambiarExists = await db.query("SELECT id FROM leads WHERE customer_name = 'Prof. M. S. Nambiar'");
  if (nambiarExists.rows.length === 0) {
    leadNambiarId = crypto.randomUUID();
    await db.query(
      `INSERT INTO leads (
        id, customer_name, mobile_number, customer_type, email, address, location,
        lead_source, owner_id, created_by, status, current_team, documentation_status, action_required,
        assigned_installer_id, b2c_loan_required, subtotal, freight, tax_mode, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
        total_project_value, remarks, created_at, updated_at
      ) VALUES (
        $1, 'Prof. M. S. Nambiar', '9845118899', 'B2C', 'ms.nambiar@iisc.ac.in', '42, 8th Main, Sadashivanagar',
        'Bengaluru North', 'Walk-in', $2, $2, 'DOCUMENTATION_COMPLETE', 'INSTALLATION_TEAM', 'COMPLETED', false,
        $3, 'NO', 510000, 8000, 'INTRA_STATE', 6.0, 31000, 6.0, 31000,
        580000, '10kW Hybrid Rooftop system. Materials delivered to site. Rooftop installation & wiring in progress.', NOW() - INTERVAL '28 days', NOW() - INTERVAL '2 days'
      )`,
      [leadNambiarId, lead1Id, instMember1Id]
    );
    await db.query(
      `INSERT INTO installation_records (
        id, lead_id, status, assigned_installer_id, assigned_by_id, assigned_at, inverter_serial_number, solar_panel_details, created_at, updated_at
      ) VALUES ($1, $2, 'IN_PROGRESS', $3, $4, NOW() - INTERVAL '4 days', 'INV-HYB-10KW-88412', '18x 550W Bifacial Mono PERC Modules (Tata Power Solar)', NOW() - INTERVAL '4 days', NOW())`,
      [crypto.randomUUID(), leadNambiarId, instMember1Id, instMgrId || lead1Id]
    );
  } else {
    leadNambiarId = nambiarExists.rows[0].id;
  }

  // 15. Deepa Sridhar - B2C Completed Project
  let leadDeepaId: string;
  const deepaExists = await db.query("SELECT id FROM leads WHERE customer_name = 'Deepa Sridhar'");
  if (deepaExists.rows.length === 0) {
    leadDeepaId = crypto.randomUUID();
    await db.query(
      `INSERT INTO leads (
        id, customer_name, mobile_number, customer_type, email, address, location,
        lead_source, owner_id, created_by, status, current_team, documentation_status, action_required,
        assigned_installer_id, b2c_loan_required, subtotal, freight, tax_mode, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
        total_project_value, remarks, created_at, updated_at
      ) VALUES (
        $1, 'Deepa Sridhar', '9880112233', 'B2C', 'deepa.sridhar@techhub.in', '214, 14th Main, Sector 4, HSR Layout',
        'Bengaluru South', 'Referral', $2, $2, 'DOCUMENTATION_COMPLETE', 'INSTALLATION_TEAM', 'COMPLETED', false,
        $3, 'NO', 255000, 5000, 'INTRA_STATE', 6.0, 14000, 6.0, 14000,
        288000, '5kW PM Surya Ghar on-grid plant fully commissioned and generating power. Bi-directional meter operational.', NOW() - INTERVAL '45 days', NOW() - INTERVAL '15 days'
      )`,
      [leadDeepaId, lead1Id, instMember1Id]
    );
    await RegistrationService.ensureTasksForLead(leadDeepaId);
    await db.query(
      `UPDATE registration_tasks SET status = 'COMPLETED', completed_at = NOW() - INTERVAL '20 days' WHERE lead_id = $1`,
      [leadDeepaId]
    );
    await db.query(
      `INSERT INTO installation_records (
        id, lead_id, status, assigned_installer_id, assigned_by_id, assigned_at, completed_at, completed_by, completion_remarks, inverter_serial_number, solar_panel_details, created_at, updated_at
      ) VALUES ($1, $2, 'COMPLETED', $3, $4, NOW() - INTERVAL '25 days', NOW() - INTERVAL '18 days', $3, 'Plant successfully energized and synchronized with BESCOM grid. Customer sign-off obtained.', 'INV-ONGRID-5KW-99120', '10x 540W Tier-1 Mono PERC Modules', NOW() - INTERVAL '25 days', NOW() - INTERVAL '18 days')`,
      [crypto.randomUUID(), leadDeepaId, instMember1Id, instMgrId || lead1Id]
    );
  } else {
    leadDeepaId = deepaExists.rows[0].id;
  }

  console.log('[SeedDummy] Successfully inserted all 15 dummy leads across all stages and teams.');
}
