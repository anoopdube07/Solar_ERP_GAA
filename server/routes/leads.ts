import express from 'express';
import crypto from 'crypto';
import { getDB } from '../db/index.ts';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.ts';
import {
  calculateFinancialTotals,
  validateMobileNumber,
} from '../services/leadService.ts';
import { recordWorkflowHistory } from '../services/auditService.ts';
import { checkAndPerformHandoff } from '../services/documentService.ts';
import { RegistrationService } from '../services/registrationService.ts';
import { isStrictlyFutureIST } from '../../shared/timezone.ts';
import type {  CustomerType, TaxMode, YesNo  } from '../../shared/types.ts';

const router = express.Router();

// Helper: check missing mandatory fields for YES qualification
async function checkLeadCompleteness(
  dbOrTx: any,
  lead: any,
  quotationLines: any[]
): Promise<{ missing: string[]; isReadyForYes: boolean }> {
  const missing: string[] = [];

  // Permanent fields are always present on created lead
  // Check active custom field definitions with required_before_yes = true
  const customDefsRes = await dbOrTx.query(
    `SELECT id, field_key, label, type, required_before_yes
     FROM lead_custom_field_definitions
     WHERE customer_type = $1 AND active = true AND required_before_yes = true`,
    [lead.customer_type]
  );

  const customValsRes = await dbOrTx.query(
    `SELECT field_definition_id, field_key, value
     FROM lead_custom_field_values
     WHERE lead_id = $1`,
    [lead.id]
  );

  const valMap = new Map<string, string>();
  for (const v of customValsRes.rows) {
    valMap.set(v.field_definition_id, v.value);
  }

  for (const def of customDefsRes.rows) {
    const val = valMap.get(def.id);
    if (!val || val.trim() === '') {
      missing.push(def.label);
    }
  }

  // Standard field completeness checks if required
  if (lead.customer_type === 'B2C') {
    if (!lead.b2c_loan_required) {
      missing.push('Loan Required (YES/NO)');
    }
  } else if (lead.customer_type === 'B2B') {
    if (!lead.b2b_credit_extended) {
      missing.push('Credit Extended (YES/NO)');
    } else if (lead.b2b_credit_extended === 'YES') {
      if (Number(lead.requested_credit_amount) <= 0) {
        missing.push('Requested Credit Amount');
      }
      // Check if valid owner credit approval exists
      const approvalRes = await dbOrTx.query(
        `SELECT * FROM credit_approval_history
         WHERE lead_id = $1 AND requested_credit_amount = $2 AND decision IN ('APPROVED', 'APPROVED_REDUCED')
         ORDER BY decided_at DESC LIMIT 1`,
        [lead.id, lead.requested_credit_amount]
      );
      if (approvalRes.rows.length === 0) {
        missing.push('Owner Credit Approval');
      }
    }
  }

  // Check Quotation if project value > 0 is configured or quotation lines required
  // In our system, if quotation is added, it must have at least 1 line
  return {
    missing,
    isReadyForYes: missing.length === 0,
  };
}

// 1. GET /api/leads - Scoped Lead List
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const db = await getDB();
    const user = req.user!;
    const { search, status, customer_type, lead_source } = req.query;

    let query = `
      SELECT l.*,
             u_owner.name as owner_name,
             u_creator.name as creator_name,
             u_installer.name as assigned_installer_name,
             COALESCE(fu_agg.follow_up_count, 0)::int as follow_up_count,
             (COALESCE(fu_agg.follow_up_count, 0) > 0) as has_follow_up,
             COALESCE(rec_agg.total_received, 0)::numeric as total_received,
             fu_next.next_follow_up_date,
             fu_next.next_follow_up_remarks,
             CASE
               WHEN l.status = 'LOST' THEN 'LOST'
               WHEN l.status NOT IN ('QUALIFIED', 'DOCUMENTATION_COMPLETE') THEN 'LEAD'
               WHEN (l.status = 'QUALIFIED' OR l.documentation_status = 'PENDING') AND l.current_team IN ('LEAD', 'LEAD_TEAM') THEN 'IN_DOCS'
               WHEN l.current_team IN ('DISPATCH', 'DISPATCH_TEAM') THEN 'DISPATCH'
               WHEN l.current_team IN ('INSTALLATION_MANAGER', 'INSTALLATION_TEAM') THEN 'INSTALLATION'
               ELSE COALESCE(reg_agg.reg_stage, 'REGISTRATION_1')
             END as project_stage
      FROM leads l
      JOIN users u_owner ON l.owner_id = u_owner.id
      JOIN users u_creator ON l.created_by = u_creator.id
      LEFT JOIN users u_installer ON l.assigned_installer_id = u_installer.id
      LEFT JOIN (
        SELECT lead_id, COUNT(*) as follow_up_count
        FROM follow_ups
        GROUP BY lead_id
      ) fu_agg ON l.id = fu_agg.lead_id
      LEFT JOIN (
        SELECT lead_id, SUM(amount) as total_received
        FROM customer_receipts
        WHERE status = 'CLEARED'
        GROUP BY lead_id
      ) rec_agg ON l.id = rec_agg.lead_id
      LEFT JOIN LATERAL (
        SELECT scheduled_at as next_follow_up_date, remarks as next_follow_up_remarks
        FROM follow_ups
        WHERE lead_id = l.id AND completed = false
        ORDER BY scheduled_at ASC
        LIMIT 1
      ) fu_next ON true
      LEFT JOIN LATERAL (
        SELECT 
          CASE
            WHEN COUNT(*) = 0 THEN 'REGISTRATION_1'
            WHEN bool_and(status = 'COMPLETED' OR status = 'NOT_APPLICABLE') THEN 'COMPLETED'
            WHEN bool_and((stage = 'REGISTRATION_1' AND (status = 'COMPLETED' OR status = 'NOT_APPLICABLE')) OR stage != 'REGISTRATION_1')
                 AND bool_and((stage = 'NET_METERING' AND (status = 'COMPLETED' OR status = 'NOT_APPLICABLE')) OR stage != 'NET_METERING')
                 THEN 'REGISTRATION_2'
            WHEN bool_and((stage = 'REGISTRATION_1' AND (status = 'COMPLETED' OR status = 'NOT_APPLICABLE')) OR stage != 'REGISTRATION_1')
                 THEN 'NET_METERING'
            ELSE 'REGISTRATION_1'
          END as reg_stage
        FROM registration_tasks
        WHERE lead_id = l.id
      ) reg_agg ON true
      WHERE 1=1
    `;
    const params: any[] = [];

    // CRITICAL AUTHORIZATION SCOPING ON NEED-TO-KNOW BASIS:
    // 1. LEAD role only ever sees leads assigned to or created by the user
    if (user.role === 'LEAD') {
      params.push(user.id);
      query += ` AND (l.owner_id = $${params.length} OR l.created_by = $${params.length})`;
    }

    // 2. INSTALLATION_MEMBER role strictly only sees leads assigned to them for installation or site visits
    if (user.role === 'INSTALLATION_MEMBER') {
      params.push(user.id);
      query += ` AND (
        l.assigned_installer_id = $${params.length} OR
        EXISTS (SELECT 1 FROM site_visits sv WHERE sv.lead_id = l.id AND sv.assigned_member_id = $${params.length})
      )`;
    }

    // 3. REGISTRATION role strictly only sees leads that are in documentation/registration/installation pipeline
    if (user.role === 'REGISTRATION') {
      query += ` AND (
        l.status IN ('QUALIFIED', 'DOCUMENTATION_COMPLETE') OR
        l.current_team IN ('REGISTRATION_1', 'REGISTRATION_TEAM', 'INSTALLATION_TEAM', 'INSTALLATION_MANAGER')
      )`;
    }

    // 4. INSTALLATION_MANAGER role: for B2C leads, only visible if dispatch is complete or has site visit
    if (user.role === 'INSTALLATION_MANAGER') {
      query += ` AND (
        l.customer_type != 'B2C' OR
        l.dispatch_status = 'DELIVERED' OR
        EXISTS (SELECT 1 FROM site_visits sv WHERE sv.lead_id = l.id)
      )`;
    }

    if (status) {
      params.push(status);
      query += ` AND l.status = $${params.length}`;
    }

    if (customer_type) {
      params.push(customer_type);
      query += ` AND l.customer_type = $${params.length}`;
    }

    if (lead_source) {
      params.push(lead_source);
      query += ` AND l.lead_source = $${params.length}`;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      params.push(s);
      query += ` AND (
        LOWER(l.customer_name) LIKE $${params.length} OR
        l.mobile_number LIKE $${params.length} OR
        CAST(l.lead_number AS TEXT) LIKE $${params.length}
      )`;
    }

    query += ` ORDER BY l.created_at DESC`;

    const result = await db.query(query, params);

    // Redact commercial financials for field technicians on need-to-know basis
    const leads = result.rows.map(row => {
      if (user.role === 'INSTALLATION_MEMBER') {
        return {
          ...row,
          total_project_value: 0,
          b2b_credit_extended: null,
          requested_credit_amount: null,
        };
      }
      return row;
    });

    res.json({ leads });
  } catch (err: any) {
    console.error('Error fetching leads:', err);
    res.status(500).json({ error: 'Failed to retrieve leads.' });
  }
});

// 2. GET /api/leads/:id - Scoped Lead Detail with Full Relation Graphs
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const db = await getDB();

    const leadRes = await db.query(
      `SELECT l.*,
              u_owner.name as owner_name,
              u_creator.name as creator_name,
              u_installer.name as assigned_installer_name
       FROM leads l
       JOIN users u_owner ON l.owner_id = u_owner.id
       JOIN users u_creator ON l.created_by = u_creator.id
       LEFT JOIN users u_installer ON l.assigned_installer_id = u_installer.id
       WHERE l.id = $1`,
      [id]
    );

    if (leadRes.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const lead = leadRes.rows[0];

    // CRITICAL AUTHORIZATION SCOPING ON NEED-TO-KNOW BASIS:
    // 1. LEAD role must be owner_id or created_by
    if (user.role === 'LEAD' && lead.owner_id !== user.id && lead.created_by !== user.id) {
      return res.status(403).json({ error: 'You are not authorized to access this Lead.' });
    }

    // 2. INSTALLATION_MEMBER must be assigned installer or assigned site visit member
    if (user.role === 'INSTALLATION_MEMBER') {
      const isInstaller = lead.assigned_installer_id === user.id;
      const svCheck = await db.query(
        `SELECT 1 FROM site_visits WHERE lead_id = $1 AND assigned_member_id = $2 LIMIT 1`,
        [id, user.id]
      );
      if (!isInstaller && svCheck.rows.length === 0) {
        return res.status(403).json({
          error: 'Access denied: You are not assigned to this lead or its site visits on a need-to-know basis.',
        });
      }
    }

    // 3. REGISTRATION role must only access leads in qualified/registration/installation stages
    if (user.role === 'REGISTRATION') {
      const isQualifiedOrHigher =
        lead.status === 'QUALIFIED' ||
        lead.status === 'DOCUMENTATION_COMPLETE' ||
        ['REGISTRATION_1', 'REGISTRATION_TEAM', 'INSTALLATION_TEAM', 'INSTALLATION_MANAGER'].includes(lead.current_team);
      if (!isQualifiedOrHigher) {
        return res.status(403).json({
          error: 'Access denied: Unqualified prospecting leads are restricted to sales representatives on a need-to-know basis.',
        });
      }
    }

    // 4. INSTALLATION_MANAGER role: for B2C leads, only visible if dispatch is complete or has site visit
    if (user.role === 'INSTALLATION_MANAGER') {
      const svCheck = await db.query(
        `SELECT 1 FROM site_visits WHERE lead_id = $1 LIMIT 1`,
        [id]
      );
      const isSiteVisit = svCheck.rows.length > 0;
      const isDispatchComplete = lead.dispatch_status === 'DELIVERED';
      const isEligibleB2C = lead.customer_type !== 'B2C' || isDispatchComplete;

      if (!isSiteVisit && !isEligibleB2C) {
        return res.status(403).json({
          error: 'Access denied: For B2C projects, lead is not visible to Installation Manager until marked as dispatch complete by Dispatch Team.',
        });
      }
    }

    // Quotation lines
    const quotesRes = await db.query(
      `SELECT * FROM quotation_lines WHERE lead_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    // Custom field values with definitions (LEFT JOIN all active definitions for this customer type so all fields are editable)
    const customRes = await db.query(
      `SELECT 
         COALESCE(v.id, d.id) as id,
         $1 as lead_id,
         d.id as field_definition_id,
         d.field_key,
         COALESCE(v.value, '') as value,
         d.label,
         d.type,
         d.options_json as options,
         d.required_before_yes,
         d.required_at_creation,
         d.display_order
       FROM lead_custom_field_definitions d
       LEFT JOIN lead_custom_field_values v ON v.field_definition_id = d.id AND v.lead_id = $1
       WHERE d.customer_type = $2 AND d.active = true
       ORDER BY d.display_order ASC, d.created_at ASC`,
      [id, lead.customer_type]
    );

    // Follow-ups
    const followUpsRes = await db.query(
      `SELECT f.*, u.name as creator_name
       FROM follow_ups f
       JOIN users u ON f.created_by = u.id
       WHERE f.lead_id = $1
       ORDER BY f.call_sequence ASC, f.created_at ASC`,
      [id]
    );

    // Site visits (with photos)
    const siteVisitsRes = await db.query(
      `SELECT sv.*,
              u_req.name as requesting_user_name,
              u_assigned.name as assigned_member_name,
              u_assigned_by.name as assigned_by_name
       FROM site_visits sv
       JOIN users u_req ON sv.requesting_user_id = u_req.id
       LEFT JOIN users u_assigned ON sv.assigned_member_id = u_assigned.id
       LEFT JOIN users u_assigned_by ON sv.assigned_by_id = u_assigned_by.id
       WHERE sv.lead_id = $1
       ORDER BY sv.created_at DESC`,
      [id]
    );

    const siteVisitsWithPhotos = [];
    for (const sv of siteVisitsRes.rows) {
      const photosRes = await db.query(
        `SELECT sp.*, u.name as uploader_name
          FROM site_visit_photos sp
          JOIN users u ON sp.uploader_id = u.id
          WHERE sp.site_visit_id = $1
          ORDER BY sp.uploaded_at ASC`,
        [sv.id]
      );
      let extraMaterials = [];
      if (sv.extra_materials_json) {
        try {
          extraMaterials = JSON.parse(sv.extra_materials_json);
        } catch (_) {
          extraMaterials = [];
        }
      }
      siteVisitsWithPhotos.push({
        ...sv,
        extra_materials: extraMaterials,
        photos: photosRes.rows,
      });
    }

    // Escalations
    const escalationsRes = await db.query(
      `SELECT e.*, u.name as escalator_name
       FROM escalations e
       JOIN users u ON e.escalated_by = u.id
       WHERE e.lead_id = $1
       ORDER BY e.created_at DESC`,
      [id]
    );

    // Credit approval history
    const creditRes = await db.query(
      `SELECT c.*, u.name as owner_name
       FROM credit_approval_history c
       JOIN users u ON c.owner_id = u.id
       WHERE c.lead_id = $1
       ORDER BY c.decided_at DESC`,
      [id]
    );

    // Workflow history (audit trail)
    const historyRes = await db.query(
      `SELECT * FROM lead_workflow_history WHERE lead_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    // Customer Receipts & Follow-ups (Accounts)
    const receiptsRes = await db.query(
      `SELECT r.*, u.name as recorder_name
       FROM customer_receipts r
       JOIN users u ON r.recorded_by = u.id
       WHERE r.lead_id = $1
       ORDER BY r.receipt_date DESC, r.created_at DESC`,
      [id]
    );

    const receiptFollowupsRes = await db.query(
      `SELECT f.*, u.name as recorder_name
       FROM receipt_followups f
       JOIN users u ON f.recorded_by = u.id
       WHERE f.lead_id = $1
       ORDER BY f.follow_up_date DESC, f.created_at DESC`,
      [id]
    );

    const totalReceived = receiptsRes.rows
      .filter((r) => r.status === 'CLEARED')
      .reduce((sum, r) => sum + Number(r.amount), 0);
    const balanceDue = Math.max(0, Number(lead.total_project_value || 0) - totalReceived);

    // Completeness check
    const completeness = await checkLeadCompleteness(db, lead, quotesRes.rows);

    // NEED-TO-KNOW REDACTIONS:
    // Field technicians (INSTALLATION_MEMBER) do not have a need to know commercial quotations,
    // pricing rates, profit margins, sales credit approvals, or internal sales escalations.
    const isTech = user.role === 'INSTALLATION_MEMBER';
    const sanitizedLead = isTech
      ? {
          ...lead,
          total_project_value: 0,
          b2b_credit_extended: null,
          requested_credit_amount: null,
        }
      : lead;

    const visibleQuotes = isTech ? [] : quotesRes.rows;
    const visibleEscalations = isTech ? [] : escalationsRes.rows;
    const visibleCreditHistory = isTech ? [] : creditRes.rows;
    const visibleReceipts = isTech ? [] : receiptsRes.rows;
    const visibleReceiptFollowups = isTech ? [] : receiptFollowupsRes.rows;

    res.json({
      lead: {
        ...sanitizedLead,
        follow_up_count: followUpsRes.rows.length,
        has_follow_up: followUpsRes.rows.length > 0,
        quotation_lines: visibleQuotes,
        custom_values: customRes.rows,
        follow_ups: followUpsRes.rows,
        site_visits: siteVisitsWithPhotos,
        escalations: visibleEscalations,
        credit_history: visibleCreditHistory,
        customer_receipts: visibleReceipts,
        receipt_followups: visibleReceiptFollowups,
        total_received: isTech ? 0 : totalReceived,
        balance_due: isTech ? 0 : balanceDue,
        workflow_history: historyRes.rows.map((h) => ({
          ...h,
          metadata: h.metadata_json ? JSON.parse(h.metadata_json) : undefined,
        })),
        missing_mandatory_fields: completeness.missing,
        is_ready_for_yes: completeness.isReadyForYes,
      },
    });
  } catch (err: any) {
    console.error('Error fetching lead detail:', err);
    res.status(500).json({ error: 'Failed to retrieve lead details.' });
  }
});

// 3. POST /api/leads - Create Lead (OWNER, MANAGER, LEAD)
router.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const {
      customer_name,
      mobile_number,
      customer_type = 'B2C',
      email,
      address,
      location,
      location_link,
      lead_source,
      project_installation_location,
      b2c_loan_required,
      b2b_credit_extended,
      requested_credit_amount,
      remarks,
      custom_fields,
      quotation_lines,
      freight,
      tax_mode,
      cgst_rate,
      sgst_rate,
      igst_rate,
      round_off,
    } = req.body;

    // 1. Mandatory permanent fields validation
    if (!customer_name || typeof customer_name !== 'string' || !customer_name.trim()) {
      return res.status(400).json({ error: 'Customer Name is required.' });
    }

    const mobileValidation = validateMobileNumber(mobile_number);
    if (!mobileValidation.valid) {
      return res.status(400).json({ error: mobileValidation.error });
    }

    if (customer_type !== 'B2C' && customer_type !== 'B2B') {
      return res.status(400).json({ error: 'Customer Type must be B2C or B2B.' });
    }

    const cleanMobile = mobile_number.trim();
    const cleanName = customer_name.trim();

    const db = await getDB();

    // 2. Mobile duplicate protection (Section 17)
    // An existing Lead is active when status != 'LOST'
    // Separate by Customer Type:
    // active B2C + new B2C -> BLOCK
    // active B2B + new B2B -> BLOCK
    // active B2C + new B2B -> ALLOW
    // active B2B + new B2C -> ALLOW
    // LOST + new -> ALLOW
    const activeCheck = await db.query(
      `SELECT id, customer_name, customer_type, status
       FROM leads
       WHERE mobile_number = $1 AND customer_type = $2 AND status != 'LOST'`,
      [cleanMobile, customer_type]
    );

    if (activeCheck.rows.length > 0) {
      return res.status(400).json({
        error: `An active ${customer_type} Lead already exists for this mobile number (${cleanMobile}).`,
      });
    }

    // 3. Check custom fields required at creation
    const requiredCreationDefs = await db.query(
      `SELECT id, field_key, label, type
       FROM lead_custom_field_definitions
       WHERE customer_type = $1 AND active = true AND required_at_creation = true`,
      [customer_type]
    );

    const customFieldsMap = new Map<string, string>();
    if (custom_fields && typeof custom_fields === 'object') {
      for (const [key, val] of Object.entries(custom_fields)) {
        customFieldsMap.set(key, String(val ?? ''));
      }
    }

    for (const def of requiredCreationDefs.rows) {
      const val = customFieldsMap.get(def.field_key) || customFieldsMap.get(def.id);
      if (!val || val.trim() === '') {
        return res.status(400).json({
          error: `Field "${def.label}" is required at creation.`,
        });
      }
    }

    // B2B Project validation: No option for Loan
    if (customer_type === 'B2B' && b2c_loan_required && b2c_loan_required === 'YES') {
      return res.status(400).json({ error: 'For B2B projects, loan options are not applicable.' });
    }

    // 4. Calculate Financial Totals using server authority
    const financialTotals = calculateFinancialTotals({
      lines: Array.isArray(quotation_lines) ? quotation_lines : [],
      freight: Number(freight) || 0,
      tax_mode: (tax_mode as TaxMode) || 'NO_TAX',
      cgst_rate: Number(cgst_rate) || 0,
      sgst_rate: Number(sgst_rate) || 0,
      igst_rate: Number(igst_rate) || 0,
      round_off: Number(round_off) || 0,
    });

    const leadId = crypto.randomUUID();

    // Transaction execution
    await db.transaction(async (tx) => {
      // Re-check duplicate inside transaction for concurrency safety
      const txActiveCheck = await tx.query(
        `SELECT id FROM leads WHERE mobile_number = $1 AND customer_type = $2 AND status != 'LOST'`,
        [cleanMobile, customer_type]
      );
      if (txActiveCheck.rows.length > 0) {
        throw new Error(`An active ${customer_type} Lead already exists for this mobile number.`);
      }

      // Stamping owner_id = authenticated user, created_by = authenticated user
      await tx.query(
        `INSERT INTO leads (
          id, customer_name, mobile_number, customer_type, email, address, location, location_link,
          lead_source, project_installation_location, owner_id, created_by, status, current_team,
          action_required, b2c_loan_required, b2b_credit_extended, requested_credit_amount,
          approved_credit_amount, subtotal, freight, tax_mode, cgst_rate, cgst_amount,
          sgst_rate, sgst_amount, igst_rate, igst_amount, round_off, total_project_value,
          remarks, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, 'PENDING', 'LEAD',
          true, $13, $14, $15,
          0, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26,
          $27, NOW(), NOW()
        )`,
        [
          leadId,
          cleanName,
          cleanMobile,
          customer_type,
          email ? email.trim() : null,
          address ? address.trim() : null,
          location ? location.trim() : null,
          location_link ? location_link.trim() : null,
          lead_source ? lead_source.trim() : null,
          project_installation_location ? project_installation_location.trim() : null,
          user.id, // owner_id
          user.id, // created_by
          customer_type === 'B2C' ? (b2c_loan_required as YesNo) || null : null,
          customer_type === 'B2B' ? (b2b_credit_extended as YesNo) || null : null,
          customer_type === 'B2B' && b2b_credit_extended === 'YES'
            ? Math.max(0, Number(requested_credit_amount) || 0)
            : 0,
          financialTotals.subtotal,
          financialTotals.freight,
          financialTotals.tax_mode,
          financialTotals.cgst_rate,
          financialTotals.cgst_amount,
          financialTotals.sgst_rate,
          financialTotals.sgst_amount,
          financialTotals.igst_rate,
          financialTotals.igst_amount,
          financialTotals.round_off,
          financialTotals.total_project_value,
          remarks ? remarks.trim() : null,
        ]
      );

      // Insert quotation lines if present
      if (Array.isArray(quotation_lines) && quotation_lines.length > 0) {
        for (let i = 0; i < quotation_lines.length; i++) {
          const line = quotation_lines[i];
          const calc = financialTotals.calculatedLines[i];
          const lineId = crypto.randomUUID();
          await tx.query(
            `INSERT INTO quotation_lines (
              id, lead_id, item_id, item_name, quantity, uom, rate, value, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
              lineId,
              leadId,
              line.item_id,
              line.item_name || 'Solar Item',
              calc.quantity,
              line.uom || 'Nos',
              calc.rate,
              calc.value,
            ]
          );
        }
      }

      // Insert custom field values if present
      const allDefs = await tx.query(
        `SELECT id, field_key FROM lead_custom_field_definitions WHERE customer_type = $1 AND active = true`,
        [customer_type]
      );
      for (const def of allDefs.rows) {
        const val = customFieldsMap.get(def.field_key) || customFieldsMap.get(def.id);
        if (val !== undefined) {
          const valId = crypto.randomUUID();
          await tx.query(
            `INSERT INTO lead_custom_field_values (id, lead_id, field_definition_id, field_key, value, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [valId, leadId, def.id, def.field_key, String(val)]
          );
        }
      }

      // Record immutable workflow history
      await recordWorkflowHistory(tx, {
        leadId,
        actorId: user.id,
        actorName: user.name,
        eventType: 'Lead Created',
        newState: 'PENDING',
        remarks: `Lead created for ${cleanName} (${customer_type})`,
        metadata: {
          customer_name: cleanName,
          mobile_number: cleanMobile,
          customer_type,
          owner_id: user.id,
          total_project_value: financialTotals.total_project_value,
        },
      });
    });

    const newLeadRes = await db.query('SELECT * FROM leads WHERE id = $1', [leadId]);
    res.status(201).json({
      message: 'Lead created successfully.',
      lead: {
        ...newLeadRes.rows[0],
        follow_up_count: 0,
        has_follow_up: false,
      },
    });
  } catch (err: any) {
    console.error('Error creating lead:', err);
    res.status(400).json({ error: err.message || 'Failed to create lead.' });
  }
});

// 4. PUT /api/leads/:id - Update Lead & Quotation Details
router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const db = await getDB();

    const existingRes = await db.query('SELECT * FROM leads WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const currentLead = existingRes.rows[0];

    // Strict Authorization: For B2B & B2C, only respective assigned/reassigned lead team user should have option to update/edit/change details of lead. Other team users can only view rights
    const isAssignedLeadUser = user.id === currentLead.owner_id;
    const isOwner = user.role === 'OWNER';
    if (!isAssignedLeadUser && !isOwner) {
      return res.status(403).json({
        error: 'Only the respective assigned/reassigned lead team user can update or edit details of this lead. Other team users have view rights only.',
      });
    }

    // Workflow state locks:
    // Section 35: Credit Approval Lock
    if (currentLead.status === 'OWNER_CREDIT_APPROVAL') {
      return res.status(400).json({
        error: 'This Lead is awaiting Owner Credit Approval. Material commercial modifications are locked.',
      });
    }

    // Section 36: Escalation Lock
    if (currentLead.status === 'ESCALATED_TO_OWNER') {
      return res.status(400).json({
        error: 'This Lead is currently Escalated to Owner. Actions and modifications are locked while under review.',
      });
    }

    // Section 37: Post-handoff Editing Lock
    if (currentLead.status === 'QUALIFIED') {
      return res.status(400).json({
        error: 'This Lead has been Qualified and handed off. Unrestricted Lead Team editing is disabled.',
      });
    }

    if (currentLead.status === 'LOST') {
      return res.status(400).json({
        error: 'This Lead is marked as LOST. Only an Owner can reopen this Lead before editing.',
      });
    }

    const {
      customer_name,
      mobile_number,
      customer_type,
      email,
      address,
      location,
      location_link,
      lead_source,
      project_installation_location,
      b2c_loan_required,
      b2b_credit_extended,
      requested_credit_amount,
      remarks,
      custom_fields,
      quotation_lines,
      freight,
      tax_mode,
      cgst_rate,
      sgst_rate,
      igst_rate,
      round_off,
    } = req.body;

    // Mobile duplicate validation if mobile is changing
    const newMobile = mobile_number ? mobile_number.trim() : currentLead.mobile_number;
    const newType = customer_type || currentLead.customer_type;

    if (newMobile !== currentLead.mobile_number || newType !== currentLead.customer_type) {
      const mobileVal = validateMobileNumber(newMobile);
      if (!mobileVal.valid) {
        return res.status(400).json({ error: mobileVal.error });
      }

      const dupCheck = await db.query(
        `SELECT id FROM leads
         WHERE mobile_number = $1 AND customer_type = $2 AND status != 'LOST' AND id != $3`,
        [newMobile, newType, id]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(400).json({
          error: `An active ${newType} Lead already exists for this mobile number (${newMobile}).`,
        });
      }
    }

    // B2B Project validation: No option for Loan
    if (newType === 'B2B' && b2c_loan_required && b2c_loan_required === 'YES') {
      return res.status(400).json({ error: 'For B2B projects, loan options are not applicable.' });
    }

    // Calculate Financial Totals
    let linesToCalc = quotation_lines;
    if (linesToCalc === undefined) {
      const existingQuotesRes = await db.query(
        'SELECT * FROM quotation_lines WHERE lead_id = $1 ORDER BY created_at ASC',
        [id]
      );
      linesToCalc = existingQuotesRes.rows;
    }
    const financialTotals = calculateFinancialTotals({
      lines: linesToCalc,
      freight: freight !== undefined ? Number(freight) || 0 : currentLead.freight,
      tax_mode: (tax_mode as TaxMode) || currentLead.tax_mode,
      cgst_rate: cgst_rate !== undefined ? Number(cgst_rate) || 0 : currentLead.cgst_rate,
      sgst_rate: sgst_rate !== undefined ? Number(sgst_rate) || 0 : currentLead.sgst_rate,
      igst_rate: igst_rate !== undefined ? Number(igst_rate) || 0 : currentLead.igst_rate,
      round_off: round_off !== undefined ? Number(round_off) || 0 : currentLead.round_off,
    });

    // Credit Amount validation
    const targetCreditExtended =
      newType === 'B2B'
        ? (b2b_credit_extended !== undefined ? b2b_credit_extended : currentLead.b2b_credit_extended)
        : null;

    let targetRequestedCredit = 0;
    if (newType === 'B2B' && targetCreditExtended === 'YES') {
      targetRequestedCredit =
        requested_credit_amount !== undefined
          ? Math.max(0, Number(requested_credit_amount) || 0)
          : Math.max(0, Number(currentLead.requested_credit_amount) || 0);
    }

    await db.transaction(async (tx) => {
      await tx.query(
        `UPDATE leads SET
          customer_name = $1,
          mobile_number = $2,
          customer_type = $3,
          email = $4,
          address = $5,
          location = $6,
          location_link = $7,
          lead_source = $8,
          project_installation_location = $9,
          b2c_loan_required = $10,
          b2b_credit_extended = $11,
          requested_credit_amount = $12,
          subtotal = $13,
          freight = $14,
          tax_mode = $15,
          cgst_rate = $16,
          cgst_amount = $17,
          sgst_rate = $18,
          sgst_amount = $19,
          igst_rate = $20,
          igst_amount = $21,
          round_off = $22,
          total_project_value = $23,
          remarks = $24,
          updated_at = NOW()
        WHERE id = $25`,
        [
          customer_name !== undefined ? customer_name.trim() : currentLead.customer_name,
          newMobile,
          newType,
          email !== undefined ? (email ? email.trim() : null) : currentLead.email,
          address !== undefined ? (address ? address.trim() : null) : currentLead.address,
          location !== undefined ? (location ? location.trim() : null) : currentLead.location,
          location_link !== undefined ? (location_link ? location_link.trim() : null) : currentLead.location_link,
          lead_source !== undefined ? (lead_source ? lead_source.trim() : null) : currentLead.lead_source,
          project_installation_location !== undefined
            ? (project_installation_location ? project_installation_location.trim() : null)
            : currentLead.project_installation_location,
          newType === 'B2C'
            ? (b2c_loan_required !== undefined ? b2c_loan_required : currentLead.b2c_loan_required)
            : null,
          newType === 'B2B' ? targetCreditExtended : null,
          targetRequestedCredit,
          financialTotals.subtotal,
          financialTotals.freight,
          financialTotals.tax_mode,
          financialTotals.cgst_rate,
          financialTotals.cgst_amount,
          financialTotals.sgst_rate,
          financialTotals.sgst_amount,
          financialTotals.igst_rate,
          financialTotals.igst_amount,
          financialTotals.round_off,
          financialTotals.total_project_value,
          remarks !== undefined ? (remarks ? remarks.trim() : null) : currentLead.remarks,
          id,
        ]
      );

      // If quotation lines were supplied in payload, update quotation lines atomically
      if (quotation_lines !== undefined) {
        await tx.query('DELETE FROM quotation_lines WHERE lead_id = $1', [id]);
        if (Array.isArray(quotation_lines)) {
          for (let i = 0; i < quotation_lines.length; i++) {
            const line = quotation_lines[i];
            const calc = financialTotals.calculatedLines[i];
            const lineId = crypto.randomUUID();
            await tx.query(
              `INSERT INTO quotation_lines (
                id, lead_id, item_id, item_name, quantity, uom, rate, value, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
              [
                lineId,
                id,
                line.item_id,
                line.item_name || 'Solar Item',
                calc.quantity,
                line.uom || 'Nos',
                calc.rate,
                calc.value,
              ]
            );
          }
        }
      }

      // Update custom field values if supplied
      if (custom_fields && typeof custom_fields === 'object') {
        for (const [key, val] of Object.entries(custom_fields)) {
          // Look up definition
          const defRes = await tx.query(
            `SELECT id, field_key FROM lead_custom_field_definitions WHERE (field_key = $1 OR id = $1) AND customer_type = $2`,
            [key, newType]
          );
          if (defRes.rows.length > 0) {
            const def = defRes.rows[0];
            await tx.query(
              `INSERT INTO lead_custom_field_values (id, lead_id, field_definition_id, field_key, value, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
               ON CONFLICT (lead_id, field_definition_id)
               DO UPDATE SET value = $5, updated_at = NOW()`,
              [crypto.randomUUID(), id, def.id, def.field_key, String(val ?? '')]
            );
          }
        }
      }

      // Record audit history
      await recordWorkflowHistory(tx, {
        leadId: id,
        actorId: user.id,
        actorName: user.name,
        eventType: 'Lead Edited',
        previousState: currentLead.status,
        newState: currentLead.status,
        remarks: 'Lead details / quotation updated',
        metadata: {
          total_project_value: financialTotals.total_project_value,
        },
      });
    });

    const updatedRes = await db.query('SELECT * FROM leads WHERE id = $1', [id]);
    res.json({
      message: 'Lead updated successfully.',
      lead: updatedRes.rows[0],
    });
  } catch (err: any) {
    console.error('Error updating lead:', err);
    res.status(400).json({ error: err.message || 'Failed to update lead.' });
  }
});

// 4b. PATCH /api/leads/:id/loan-required - Quick toggle/update Loan Required (YES/NO)
router.patch('/:id/loan-required', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const { b2c_loan_required, remarks } = req.body;
    const db = await getDB();

    const existingRes = await db.query('SELECT * FROM leads WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }
    const currentLead = existingRes.rows[0];

    if (currentLead.customer_type !== 'B2C') {
      return res.status(400).json({ error: 'For B2B projects, bank loan options are not applicable.' });
    }

    const cleanVal = (b2c_loan_required || '').toString().toUpperCase();
    if (cleanVal !== 'YES' && cleanVal !== 'NO') {
      return res.status(400).json({ error: 'Loan required value must be either YES or NO.' });
    }

    const allowedRoles = ['OWNER', 'MANAGER', 'LEAD', 'REGISTRATION', 'ACCOUNTS'];
    if (!allowedRoles.includes(user.role) && user.id !== currentLead.owner_id) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to modify loan requirement.' });
    }

    await db.query(
      `UPDATE leads SET b2c_loan_required = $1, updated_at = NOW() WHERE id = $2`,
      [cleanVal, id]
    );

    // Sync registration tasks
    if (cleanVal === 'NO') {
      await db.query(
        `UPDATE registration_tasks
         SET status = 'NOT_APPLICABLE', updated_at = NOW()
         WHERE lead_id = $1 AND is_financing_dependent = true`,
        [id]
      );
    } else if (cleanVal === 'YES') {
      await db.query(
        `UPDATE registration_tasks
         SET status = 'PENDING', updated_at = NOW()
         WHERE lead_id = $1 AND is_financing_dependent = true AND status = 'NOT_APPLICABLE'`,
        [id]
      );
    }

    // Record audit event
    await recordWorkflowHistory(db, {
      leadId: id,
      actorId: user.id,
      actorName: user.name,
      eventType: 'LOAN_REQUIREMENT_CHANGED',
      previousState: currentLead.b2c_loan_required || 'UNSET',
      newState: cleanVal,
      remarks: remarks || `Solar bank loan requirement set to ${cleanVal} by ${user.name} (${user.role}).`,
      metadata: {
        b2c_loan_required: cleanVal,
      },
    });

    const refreshedRes = await db.query('SELECT * FROM leads WHERE id = $1', [id]);
    res.json({
      success: true,
      message: `Bank loan requirement successfully set to ${cleanVal}.`,
      b2c_loan_required: cleanVal,
      lead: refreshedRes.rows[0],
    });
  } catch (err: any) {
    console.error('Error updating loan requirement:', err);
    res.status(400).json({ error: err.message || 'Failed to update loan requirement.' });
  }
});

// 4b. PATCH /api/leads/:id/credit-extended - Toggle B2B Credit Extended (YES / NO)
router.patch('/:id/credit-extended', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const { b2b_credit_extended, requested_credit_amount, remarks } = req.body;
    const db = await getDB();

    const existingRes = await db.query('SELECT * FROM leads WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }
    const currentLead = existingRes.rows[0];

    if (currentLead.customer_type !== 'B2B') {
      return res.status(400).json({ error: 'Credit extension is only applicable for B2B commercial leads.' });
    }

    const cleanVal = (b2b_credit_extended || '').toString().toUpperCase();
    if (cleanVal !== 'YES' && cleanVal !== 'NO') {
      return res.status(400).json({ error: 'Credit extended value must be either YES or NO.' });
    }

    const allowedRoles = ['OWNER', 'MANAGER', 'LEAD', 'ACCOUNTS'];
    if (!allowedRoles.includes(user.role) && user.id !== currentLead.owner_id) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to modify credit extension.' });
    }

    const reqAmt = cleanVal === 'YES' ? (Number(requested_credit_amount) || Number(currentLead.requested_credit_amount) || 0) : 0;

    await db.query(
      `UPDATE leads SET 
         b2b_credit_extended = $1, 
         requested_credit_amount = $2,
         updated_at = NOW() 
       WHERE id = $3`,
      [cleanVal, reqAmt, id]
    );

    // Record audit event
    await recordWorkflowHistory(db, {
      leadId: id,
      actorId: user.id,
      actorName: user.name,
      eventType: 'CREDIT_EXTENSION_CHANGED',
      previousState: currentLead.b2b_credit_extended || 'UNSET',
      newState: cleanVal,
      remarks: remarks || `B2B Credit extension set to ${cleanVal} by ${user.name} (${user.role}).`,
      metadata: {
        b2b_credit_extended: cleanVal,
        requested_credit_amount: reqAmt,
      },
    });

    const refreshedRes = await db.query('SELECT * FROM leads WHERE id = $1', [id]);
    res.json({
      success: true,
      message: `B2B credit extension successfully set to ${cleanVal}.`,
      b2b_credit_extended: cleanVal,
      lead: refreshedRes.rows[0],
    });
  } catch (err: any) {
    console.error('Error updating credit extension:', err);
    res.status(400).json({ error: err.message || 'Failed to update credit extension.' });
  }
});

// 5. POST /api/leads/:id/reassign - Lead Reassignment (OWNER, MANAGER ONLY)
router.post('/:id/reassign', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const { target_user_id, remarks } = req.body;

    if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Only Owner or Manager can reassign Leads.' });
    }

    if (!target_user_id) {
      return res.status(400).json({ error: 'Target Lead User is required.' });
    }

    const db = await getDB();

    const targetUserRes = await db.query('SELECT id, name, role, active FROM users WHERE id = $1', [
      target_user_id,
    ]);

    if (targetUserRes.rows.length === 0) {
      return res.status(404).json({ error: 'Target user not found.' });
    }

    const targetUser = targetUserRes.rows[0];

    // Target must be ACTIVE and role = LEAD
    if (!targetUser.active) {
      return res.status(400).json({ error: 'Cannot reassign Lead to an inactive user.' });
    }

    if (targetUser.role !== 'LEAD') {
      return res.status(400).json({ error: 'Lead can only be reassigned to users with LEAD role.' });
    }

    const leadRes = await db.query(
      `SELECT l.*, u.name as previous_owner_name FROM leads l JOIN users u ON l.owner_id = u.id WHERE l.id = $1`,
      [id]
    );

    if (leadRes.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const lead = leadRes.rows[0];
    const previousOwnerId = lead.owner_id;
    const previousOwnerName = lead.previous_owner_name;

    await db.transaction(async (tx) => {
      await tx.query('UPDATE leads SET owner_id = $1, updated_at = NOW() WHERE id = $2', [
        target_user_id,
        id,
      ]);

      await recordWorkflowHistory(tx, {
        leadId: id,
        actorId: user.id,
        actorName: user.name,
        eventType: 'Lead Reassigned',
        previousState: previousOwnerName,
        newState: targetUser.name,
        remarks: remarks || `Reassigned from ${previousOwnerName} to ${targetUser.name}`,
        metadata: {
          previous_owner_id: previousOwnerId,
          new_owner_id: target_user_id,
        },
      });
    });

    res.json({
      message: `Lead successfully reassigned to ${targetUser.name}.`,
      new_owner_id: target_user_id,
      new_owner_name: targetUser.name,
    });
  } catch (err: any) {
    console.error('Error reassigning lead:', err);
    res.status(500).json({ error: 'Failed to reassign lead.' });
  }
});

// 5b. POST /api/leads/:id/assign-installer - Assign or reassign Installation crew (INSTALLATION_MANAGER, OWNER)
router.post('/:id/assign-installer', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    if (user.role !== 'INSTALLATION_MANAGER' && user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only Installation Manager or Owner can assign installation crew.' });
    }

    const { assigned_installer_id } = req.body;
    const db = await getDB();
    const leadRes = await db.query('SELECT * FROM leads WHERE id = $1', [id]);
    if (leadRes.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const currentLead = leadRes.rows[0];
    if (currentLead.customer_type === 'B2C' && currentLead.dispatch_status !== 'DELIVERED') {
      return res.status(400).json({
        error: 'Cannot assign installation crew: For B2C projects, installation assignment is locked until Dispatch Team marks the project as dispatch complete (Delivered to site).',
      });
    }

    let installerName: string | null = null;
    if (assigned_installer_id) {
      const userRes = await db.query('SELECT * FROM users WHERE id = $1', [assigned_installer_id]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ error: 'Target installer user not found.' });
      }
      const targetUser = userRes.rows[0];
      if (!targetUser.active) {
        return res.status(400).json({ error: 'Cannot assign inactive user.' });
      }
      if (targetUser.role !== 'INSTALLATION_MEMBER' && targetUser.role !== 'INSTALLATION_MANAGER') {
        return res.status(400).json({ error: 'Target user must be an Installation Team Member or Manager.' });
      }
      installerName = targetUser.name;
    }

    const targetInstallerId = assigned_installer_id ? String(assigned_installer_id) : null;
    const currentLeadTeam = leadRes.rows[0]?.current_team;
    let nextTeam = currentLeadTeam;
    if (currentLeadTeam === 'INSTALLATION_MANAGER' || currentLeadTeam === 'INSTALLATION_TEAM') {
      nextTeam = targetInstallerId ? 'INSTALLATION_TEAM' : 'INSTALLATION_MANAGER';
    }

    await db.query(
      `UPDATE leads 
       SET assigned_installer_id = $1::TEXT,
           current_team = $2::TEXT,
           updated_at = NOW() 
       WHERE id = $3`,
      [targetInstallerId, nextTeam, id]
    );

    // Sync installation_records table via ON CONFLICT (lead_id)
    const recId = crypto.randomUUID();
    const initialStatus = targetInstallerId ? 'ASSIGNED' : 'PENDING_ASSIGNMENT';
    await db.query(
      `INSERT INTO installation_records (id, lead_id, assigned_installer_id, assigned_by_id, assigned_at, status, updated_at)
       VALUES ($1, $2, $3::TEXT, $4, NOW(), $5, NOW())
       ON CONFLICT (lead_id) DO UPDATE
       SET assigned_installer_id = EXCLUDED.assigned_installer_id,
           assigned_by_id = CASE WHEN EXCLUDED.assigned_installer_id IS NOT NULL THEN EXCLUDED.assigned_by_id ELSE installation_records.assigned_by_id END,
           assigned_at = CASE WHEN EXCLUDED.assigned_installer_id IS NOT NULL THEN NOW() ELSE installation_records.assigned_at END,
           status = CASE 
             WHEN EXCLUDED.assigned_installer_id IS NULL AND installation_records.status = 'ASSIGNED' THEN 'PENDING_ASSIGNMENT'
             WHEN EXCLUDED.assigned_installer_id IS NOT NULL AND installation_records.status = 'PENDING_ASSIGNMENT' THEN 'ASSIGNED'
             ELSE installation_records.status 
           END,
           updated_at = NOW()`,
      [recId, id, targetInstallerId, user.id, initialStatus]
    );

    await recordWorkflowHistory(db, {
      leadId: id,
      actorId: user.id,
      actorName: user.name,
      eventType: 'Installation Crew Assigned',
      previousState: leadRes.rows[0].assigned_installer_id ? 'ASSIGNED' : 'UNASSIGNED',
      newState: assigned_installer_id ? 'ASSIGNED' : 'UNASSIGNED',
      remarks: installerName ? `Assigned to installation specialist: ${installerName}` : 'Installation specialist unassigned',
    });

    res.json({
      message: installerName ? `Assigned to ${installerName} successfully.` : 'Installer unassigned successfully.',
      assigned_installer_id: assigned_installer_id || null,
      assigned_installer_name: installerName,
    });
  } catch (err: any) {
    console.error('Error assigning installer:', err);
    res.status(500).json({ error: err.message || 'Failed to assign installer.' });
  }
});

// 6. POST /api/leads/:id/workflow - Deterministic Workflow Transitions
router.post('/:id/workflow', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const { action, payload } = req.body;

    const db = await getDB();
    const leadRes = await db.query('SELECT * FROM leads WHERE id = $1', [id]);
    if (leadRes.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const lead = leadRes.rows[0];

    // Authorization check: For B2B & B2C, only respective assigned/reassigned lead team user should have option to update/edit/change details of lead. Other team users can only view rights.
    const isAssignedLeadUser = user.id === lead.owner_id;
    const isOwner = user.role === 'OWNER';

    // Lead team workflow actions require the user to be the currently assigned/reassigned lead user (or OWNER)
    if (['YES', 'NO', 'FOLLOW_UP', 'ESCALATE', 'SUBMIT_B2B_CREDIT'].includes(action)) {
      if (!isAssignedLeadUser && !isOwner) {
        return res.status(403).json({
          error: 'Only the respective assigned/reassigned lead team user can perform workflow actions on this lead. Other team users have view rights only.',
        });
      }
    }

    // Handle Actions:
    // -------------------------------------------------------------
    // ACTION: YES (Qualification)
    // -------------------------------------------------------------
    if (action === 'YES') {
      if (lead.status !== 'PENDING') {
        return res.status(400).json({
          error: `Cannot qualify Lead from status "${lead.status}". Lead must be in PENDING state.`,
        });
      }

      // Check completeness
      const quotesRes = await db.query('SELECT * FROM quotation_lines WHERE lead_id = $1', [id]);
      const completeness = await checkLeadCompleteness(db, lead, quotesRes.rows);

      if (!completeness.isReadyForYes) {
        return res.status(400).json({
          error: 'Cannot qualify Lead. Complete the required fields before continuing.',
          missing_fields: completeness.missing,
        });
      }

      // Check for B2B credit approval gate
      if (lead.customer_type === 'B2B' && lead.b2b_credit_extended === 'YES') {
        if (Number(lead.approved_credit_amount) <= 0) {
          return res.status(400).json({
            error: 'Cannot qualify B2B Lead with credit extended: Owner credit approval is required before qualification.',
          });
        }
      }

      if (lead.customer_type === 'B2C') {
        const b2cRulesRes = await db.query(
          `SELECT COUNT(*) as count 
           FROM document_requirement_rules drr
           JOIN document_rule_items dri ON drr.id = dri.rule_id
           JOIN document_definitions dd ON dri.document_definition_id = dd.id
           WHERE drr.active = true 
             AND drr.deleted_at IS NULL
             AND dd.active = true 
             AND dd.deleted_at IS NULL
             AND (drr.customer_type = 'B2C' OR drr.customer_type = 'BOTH')`
        );
        const hasB2CRules = Number(b2cRulesRes.rows[0]?.count || 0) > 0;

        if (hasB2CRules) {
          let handedOffImmediately = false;

          await db.transaction(async (tx) => {
            await tx.query(
              `UPDATE leads SET
                status = 'QUALIFIED',
                current_team = 'LEAD',
                documentation_status = 'PENDING',
                action_required = true,
                updated_at = NOW()
              WHERE id = $1`,
              [id]
            );

            await recordWorkflowHistory(tx, {
              leadId: id,
              actorId: user.id,
              actorName: user.name,
              eventType: 'LEAD_QUALIFIED',
              previousState: lead.status,
              newState: 'QUALIFIED',
              remarks: `Qualified by ${user.name}. Moving to ECP Documentation stage.`,
              metadata: {
                customer_type: 'B2C',
                total_project_value: lead.total_project_value,
                documentation_stage: 'PENDING',
              },
            });

            // Check if any requirements exist or are already met
            const handoffCheck = await checkAndPerformHandoff(id, user.id, user.name, tx);
            handedOffImmediately = handoffCheck.handed_off;
          });

          const updatedRes = await db.query('SELECT * FROM leads WHERE id = $1', [id]);
          const updatedLead = updatedRes.rows[0];

          return res.json({
            message: handedOffImmediately
              ? 'Lead successfully qualified and all document requirements met! Transferred to REGISTRATION_1.'
              : 'Lead successfully qualified! Now in ECP Documentation stage for required document uploads.',
            status: updatedLead.status,
            current_team: updatedLead.current_team,
            documentation_status: updatedLead.documentation_status,
          });
        } else {
          // Standard B2C qualification without documents (all document definitions inactive in Master Settings) -> Directly to REGISTRATION_1
          await db.transaction(async (tx) => {
            await tx.query(
              `UPDATE leads SET
                status = 'DOCUMENTATION_COMPLETE',
                current_team = 'REGISTRATION_1',
                documentation_status = 'NOT_APPLICABLE',
                action_required = true,
                updated_at = NOW()
              WHERE id = $1`,
              [id]
            );

            await recordWorkflowHistory(tx, {
              leadId: id,
              actorId: user.id,
              actorName: user.name,
              eventType: 'LEAD_QUALIFIED',
              previousState: lead.status,
              newState: 'DOCUMENTATION_COMPLETE',
              remarks: `Qualified by ${user.name}. All document definitions are marked inactive in Master Settings. Transferred directly to Registration 1.`,
              metadata: {
                customer_type: 'B2C',
                total_project_value: lead.total_project_value,
                documentation_stage: 'NOT_APPLICABLE',
                handed_off_to: 'REGISTRATION_1',
              },
            });
          });

          // Ensure registration tasks are created for Registration 1 team
          try {
            await RegistrationService.ensureTasksForLead(id);
          } catch (e) {
            console.warn('Failed to initialize registration tasks:', e);
          }

          const updatedRes = await db.query('SELECT * FROM leads WHERE id = $1', [id]);
          const updatedLead = updatedRes.rows[0];

          return res.json({
            message: 'Lead successfully qualified! No active document requirements configured — transferred directly to REGISTRATION_1.',
            status: updatedLead.status,
            current_team: updatedLead.current_team,
            documentation_status: updatedLead.documentation_status,
          });
        }
      } else {
        // B2B Customer Flow
        const b2bRulesRes = await db.query(
          `SELECT COUNT(*) as count 
           FROM document_requirement_rules drr
           JOIN document_rule_items dri ON drr.id = dri.rule_id
           JOIN document_definitions dd ON dri.document_definition_id = dd.id
           WHERE drr.active = true 
             AND drr.deleted_at IS NULL
             AND dd.active = true 
             AND dd.deleted_at IS NULL
             AND (drr.customer_type = 'B2B' OR drr.customer_type = 'BOTH')`
        );
        const hasB2BRules = Number(b2bRulesRes.rows[0]?.count || 0) > 0;

        if (hasB2BRules) {
          let handedOffImmediately = false;

          await db.transaction(async (tx) => {
            await tx.query(
              `UPDATE leads SET
                status = 'QUALIFIED',
                current_team = 'LEAD',
                documentation_status = 'PENDING',
                action_required = true,
                updated_at = NOW()
              WHERE id = $1`,
              [id]
            );

            await recordWorkflowHistory(tx, {
              leadId: id,
              actorId: user.id,
              actorName: user.name,
              eventType: 'LEAD_QUALIFIED',
              previousState: lead.status,
              newState: 'QUALIFIED',
              remarks: `B2B Lead qualified by ${user.name}. Awaiting required B2B documentation.`,
              metadata: {
                customer_type: 'B2B',
                total_project_value: lead.total_project_value,
              },
            });

            const handoffCheck = await checkAndPerformHandoff(id, user.id, user.name, tx);
            handedOffImmediately = handoffCheck.handed_off;
          });

          const updatedRes = await db.query('SELECT * FROM leads WHERE id = $1', [id]);
          const updatedLead = updatedRes.rows[0];

          return res.json({
            message: handedOffImmediately
              ? 'B2B Lead qualified and documentation complete! Handed off to Accounts.'
              : 'B2B Lead qualified! Now in Documentation stage for required uploads.',
            status: updatedLead.status,
            current_team: updatedLead.current_team,
            documentation_status: updatedLead.documentation_status,
          });
        } else {
          // Standard B2B qualification without documents -> ACCOUNTS_PLACEHOLDER
          await db.transaction(async (tx) => {
            await tx.query(
              `UPDATE leads SET
                status = 'QUALIFIED',
                current_team = 'ACCOUNTS_PLACEHOLDER',
                documentation_status = 'NOT_APPLICABLE',
                action_required = false,
                updated_at = NOW()
              WHERE id = $1`,
              [id]
            );

            await recordWorkflowHistory(tx, {
              leadId: id,
              actorId: user.id,
              actorName: user.name,
              eventType: 'B2B Accounts Handoff',
              previousState: lead.status,
              newState: 'QUALIFIED',
              remarks: `B2B Lead qualified by ${user.name} -> Handoff to ACCOUNTS_PLACEHOLDER`,
              metadata: {
                customer_type: 'B2B',
                total_project_value: lead.total_project_value,
              },
            });
          });

          return res.json({
            message: 'B2B Lead successfully qualified! Transferred to ACCOUNTS_PLACEHOLDER.',
            status: 'QUALIFIED',
            current_team: 'ACCOUNTS_PLACEHOLDER',
          });
        }
      }
    }

    // -------------------------------------------------------------
    // ACTION: NO (Lost)
    // -------------------------------------------------------------
    if (action === 'NO') {
      const { lost_reason, lost_remarks } = payload || {};

      if (!lost_reason) {
        return res.status(400).json({ error: 'Lost Reason is required when marking a Lead as NO/LOST.' });
      }

      if (lost_reason === 'OTHER' && (!lost_remarks || !lost_remarks.trim())) {
        return res.status(400).json({ error: 'Remarks are mandatory when Lost Reason is OTHER.' });
      }

      await db.transaction(async (tx) => {
        await tx.query(
          `UPDATE leads SET
            status = 'LOST',
            lost_reason = $1,
            lost_remarks = $2,
            action_required = false,
            updated_at = NOW()
          WHERE id = $3`,
          [lost_reason, lost_remarks ? lost_remarks.trim() : null, id]
        );

        await recordWorkflowHistory(tx, {
          leadId: id,
          actorId: user.id,
          actorName: user.name,
          eventType: 'Lead Lost',
          previousState: lead.status,
          newState: 'LOST',
          remarks: `Lost: ${lost_reason} ${lost_remarks ? `- ${lost_remarks}` : ''}`,
        });
      });

      return res.json({
        message: 'Lead has been marked as LOST.',
        status: 'LOST',
      });
    }

    // -------------------------------------------------------------
    // ACTION: REOPEN_LOST (OWNER ONLY, Section 43)
    // -------------------------------------------------------------
    if (action === 'REOPEN_LOST') {
      if (user.role !== 'OWNER') {
        return res.status(403).json({ error: 'Only an Owner can reopen LOST Leads.' });
      }

      if (lead.status !== 'LOST') {
        return res.status(400).json({ error: 'Only Leads in LOST status can be reopened.' });
      }

      await db.transaction(async (tx) => {
        await tx.query(
          `UPDATE leads SET
            status = 'PENDING',
            current_team = 'LEAD',
            action_required = true,
            lost_reason = null,
            lost_remarks = null,
            updated_at = NOW()
          WHERE id = $1`,
          [id]
        );

        await recordWorkflowHistory(tx, {
          leadId: id,
          actorId: user.id,
          actorName: user.name,
          eventType: 'Lead Reopened',
          previousState: 'LOST',
          newState: 'PENDING',
          remarks: `Reopened by Owner ${user.name}`,
        });
      });

      return res.json({
        message: 'Lead reopened successfully. Returned to PENDING state.',
        status: 'PENDING',
        current_team: 'LEAD',
      });
    }

    // -------------------------------------------------------------
    // ACTION: FOLLOW_UP (Section 44, 45)
    // -------------------------------------------------------------
    if (action === 'FOLLOW_UP') {
      const { scheduled_at, remarks } = payload || {};

      if (!scheduled_at) {
        return res.status(400).json({ error: 'Follow-up Date & Time is required.' });
      }

      if (!remarks || !remarks.trim()) {
        return res.status(400).json({ error: 'Follow-up Remarks are required.' });
      }

      // Timezone validation: Must be strictly future in Asia/Kolkata
      if (!isStrictlyFutureIST(scheduled_at)) {
        return res.status(400).json({
          error: 'Follow-up date/time must be strictly in the future (Asia/Kolkata IST).',
        });
      }

      await db.transaction(async (tx) => {
        // Count previous calls to determine Call Sequence (Call 1, Call 2, Call 3)
        const countRes = await tx.query(
          'SELECT COUNT(*) as count FROM follow_ups WHERE lead_id = $1',
          [id]
        );
        const sequence = parseInt(countRes.rows[0].count, 10) + 1;

        const followUpId = crypto.randomUUID();
        await tx.query(
          `INSERT INTO follow_ups (
            id, lead_id, created_by, call_sequence, scheduled_at, remarks, completed, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, false, NOW())`,
          [followUpId, id, user.id, sequence, new Date(scheduled_at).toISOString(), remarks.trim()]
        );

        // Lead remains PENDING, CURRENT TEAM = LEAD, ACTION REQUIRED = TRUE
        await tx.query(
          `UPDATE leads SET
            status = 'PENDING',
            current_team = 'LEAD',
            action_required = true,
            updated_at = NOW()
          WHERE id = $1`,
          [id]
        );

        await recordWorkflowHistory(tx, {
          leadId: id,
          actorId: user.id,
          actorName: user.name,
          eventType: 'Follow-up Created',
          previousState: lead.status,
          newState: 'PENDING',
          remarks: `Follow-up Call ${sequence} scheduled for ${new Date(scheduled_at).toLocaleString()}: ${remarks}`,
          metadata: {
            call_sequence: sequence,
            scheduled_at,
          },
        });
      });

      return res.json({
        message: 'Follow-up scheduled successfully.',
        status: 'PENDING',
      });
    }

    // -------------------------------------------------------------
    // ACTION: ESCALATE (Section 57)
    // -------------------------------------------------------------
    if (action === 'ESCALATE') {
      const { reason, remarks } = payload || {};

      if (!reason || !reason.trim()) {
        return res.status(400).json({ error: 'Escalation Reason is required.' });
      }

      if (!remarks || !remarks.trim()) {
        return res.status(400).json({ error: 'Escalation Remarks are required.' });
      }

      await db.transaction(async (tx) => {
        const escalationId = crypto.randomUUID();
        await tx.query(
          `INSERT INTO escalations (id, lead_id, escalated_by, reason, remarks, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [escalationId, id, user.id, reason.trim(), remarks.trim()]
        );

        await tx.query(
          `UPDATE leads SET
            status = 'ESCALATED_TO_OWNER',
            current_team = 'OWNER',
            action_required = true,
            updated_at = NOW()
          WHERE id = $1`,
          [id]
        );

        await recordWorkflowHistory(tx, {
          leadId: id,
          actorId: user.id,
          actorName: user.name,
          eventType: 'Escalated',
          previousState: lead.status,
          newState: 'ESCALATED_TO_OWNER',
          remarks: `Escalated to Owner: ${reason} - ${remarks}`,
        });
      });

      return res.json({
        message: 'Lead escalated directly to Owner.',
        status: 'ESCALATED_TO_OWNER',
        current_team: 'OWNER',
      });
    }

    // -------------------------------------------------------------
    // ACTION: OWNER_RETURN_ESCALATION (OWNER ONLY, Section 57)
    // -------------------------------------------------------------
    if (action === 'OWNER_RETURN_ESCALATION') {
      if (user.role !== 'OWNER') {
        return res.status(403).json({ error: 'Only Owner can review and return escalations.' });
      }

      const { owner_remarks } = payload || {};
      if (!owner_remarks || !owner_remarks.trim()) {
        return res.status(400).json({ error: 'Owner Remarks are required when returning an escalation.' });
      }

      await db.transaction(async (tx) => {
        // Update latest escalation record
        await tx.query(
          `UPDATE escalations SET owner_remarks = $1, returned_at = NOW()
           WHERE lead_id = $2 AND returned_at IS NULL`,
          [owner_remarks.trim(), id]
        );

        await tx.query(
          `UPDATE leads SET
            status = 'PENDING',
            current_team = 'LEAD',
            action_required = true,
            owner_remarks = $1,
            updated_at = NOW()
          WHERE id = $2`,
          [owner_remarks.trim(), id]
        );

        await recordWorkflowHistory(tx, {
          leadId: id,
          actorId: user.id,
          actorName: user.name,
          eventType: 'Owner Returned Escalation',
          previousState: 'ESCALATED_TO_OWNER',
          newState: 'PENDING',
          remarks: `Returned by Owner: ${owner_remarks}`,
        });
      });

      return res.json({
        message: 'Escalation returned to Lead Team with Owner Remarks.',
        status: 'PENDING',
        current_team: 'LEAD',
      });
    }

    // -------------------------------------------------------------
    // ACTION: SUBMIT_B2B_CREDIT (Section 59, 60)
    // -------------------------------------------------------------
    if (action === 'SUBMIT_B2B_CREDIT') {
      if (lead.customer_type !== 'B2B') {
        return res.status(400).json({ error: 'Credit Approval is only available for B2B Leads.' });
      }

      const requestedAmount = Number(payload?.requested_credit_amount) || Number(lead.requested_credit_amount) || 0;
      const creditDays = Number(payload?.b2b_credit_days) || Number(lead.b2b_credit_days) || 30;
      const creditRemarks = (payload?.remarks || '').trim();

      if (requestedAmount <= 0) {
        return res.status(400).json({ error: 'Requested Credit Amount must be greater than zero.' });
      }

      if (Number(lead.total_project_value) > 0 && requestedAmount > Number(lead.total_project_value)) {
        return res.status(400).json({
          error: `Requested Credit Amount (₹${requestedAmount.toLocaleString('en-IN')}) cannot exceed Total Project Value (₹${Number(lead.total_project_value).toLocaleString('en-IN')}).`,
        });
      }

      await db.transaction(async (tx) => {
        await tx.query(
          `UPDATE leads SET
            b2b_credit_extended = 'YES',
            requested_credit_amount = $1,
            b2b_credit_days = $2,
            status = 'OWNER_CREDIT_APPROVAL',
            current_team = 'OWNER',
            action_required = true,
            updated_at = NOW()
          WHERE id = $3`,
          [requestedAmount, creditDays, id]
        );

        await recordWorkflowHistory(tx, {
          leadId: id,
          actorId: user.id,
          actorName: user.name,
          eventType: 'Credit Sent for Approval',
          previousState: lead.status,
          newState: 'OWNER_CREDIT_APPROVAL',
          remarks: `Submitted for Owner Credit Approval: Requested ₹${requestedAmount.toLocaleString('en-IN')} (${creditDays} days term)${creditRemarks ? ` - ${creditRemarks}` : ''}`,
          metadata: {
            requested_credit_amount: requestedAmount,
            b2b_credit_days: creditDays,
            total_project_value: lead.total_project_value,
            credit_remarks: creditRemarks,
          },
        });
      });

      return res.json({
        message: 'Credit request submitted for Owner Approval.',
        status: 'OWNER_CREDIT_APPROVAL',
        current_team: 'OWNER',
      });
    }

    // -------------------------------------------------------------
    // ACTION: OWNER_CREDIT_DECISION (OWNER ONLY, Section 61, 62, 63)
    // -------------------------------------------------------------
    if (action === 'OWNER_CREDIT_DECISION') {
      if (user.role !== 'OWNER') {
        return res.status(403).json({ error: 'Only Owner can decide on Credit Approval requests.' });
      }

      const { decision, approved_amount, remarks } = payload || {};

      if (!['APPROVED', 'APPROVED_REDUCED', 'REJECTED'].includes(decision)) {
        return res.status(400).json({
          error: 'Decision must be APPROVED, APPROVED_REDUCED, or REJECTED.',
        });
      }

      const requestedAmount = Number(lead.requested_credit_amount);
      const totalProjectVal = Number(lead.total_project_value);
      let finalApprovedAmount = 0;

      if (decision === 'APPROVED') {
        finalApprovedAmount = requestedAmount;
      } else if (decision === 'APPROVED_REDUCED') {
        finalApprovedAmount = Number(approved_amount) || 0;
        if (finalApprovedAmount <= 0) {
          return res.status(400).json({ error: 'Approved Credit Amount must be greater than zero.' });
        }
        if (finalApprovedAmount > requestedAmount) {
          return res.status(400).json({
            error: `Approved Credit Amount (₹${finalApprovedAmount}) cannot exceed Requested Credit Amount (₹${requestedAmount}).`,
          });
        }
        if (finalApprovedAmount > totalProjectVal) {
          return res.status(400).json({
            error: `Approved Credit Amount (₹${finalApprovedAmount}) cannot exceed Total Project Value (₹${totalProjectVal}).`,
          });
        }
      } else if (decision === 'REJECTED') {
        finalApprovedAmount = 0;
        if (!remarks || !remarks.trim()) {
          return res.status(400).json({ error: 'Remarks are required when rejecting credit.' });
        }
      }

      await db.transaction(async (tx) => {
        const historyId = crypto.randomUUID();
        await tx.query(
          `INSERT INTO credit_approval_history (
            id, lead_id, owner_id, requested_credit_amount, approved_credit_amount, decision, remarks, decided_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [
            historyId,
            id,
            user.id,
            requestedAmount,
            decision === 'REJECTED' ? null : finalApprovedAmount,
            decision,
            remarks ? remarks.trim() : null,
          ]
        );

        // All decisions return Lead to PENDING, CURRENT TEAM = LEAD, ACTION REQUIRED = TRUE
        await tx.query(
          `UPDATE leads SET
            status = 'PENDING',
            current_team = 'LEAD',
            action_required = true,
            approved_credit_amount = $1,
            owner_remarks = $2,
            updated_at = NOW()
          WHERE id = $3`,
          [
            finalApprovedAmount,
            remarks ? remarks.trim() : (decision === 'APPROVED' ? 'Credit Approved' : 'Credit Approved Reduced'),
            id,
          ]
        );

        const eventName =
          decision === 'APPROVED'
            ? 'Credit Approved'
            : decision === 'APPROVED_REDUCED'
            ? 'Credit Approved Reduced'
            : 'Credit Rejected';

        await recordWorkflowHistory(tx, {
          leadId: id,
          actorId: user.id,
          actorName: user.name,
          eventType: eventName,
          previousState: 'OWNER_CREDIT_APPROVAL',
          newState: 'PENDING',
          remarks: `Decision: ${decision} (${finalApprovedAmount > 0 ? `₹${finalApprovedAmount}` : 'Rejected'}) ${remarks ? `- ${remarks}` : ''}`,
          metadata: {
            decision,
            requested_amount: requestedAmount,
            approved_amount: finalApprovedAmount,
          },
        });
      });

      return res.json({
        message: `Credit decision "${decision}" recorded successfully. Returned to Lead Team.`,
        status: 'PENDING',
        current_team: 'LEAD',
        approved_credit_amount: finalApprovedAmount,
      });
    }

    return res.status(400).json({ error: `Unsupported workflow action: "${action}".` });
  } catch (err: any) {
    console.error('Workflow error:', err);
    res.status(400).json({ error: err.message || 'Workflow transition failed.' });
  }
});

export default router;
