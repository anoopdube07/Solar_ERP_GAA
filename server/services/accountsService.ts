import crypto from 'crypto';
import { getDB } from '../db/index.ts';
import type { 
  CustomerReceipt,
  ReceiptFollowUp,
  AccountsLeadOverview,
  AccountsMetrics,
  PaymentMode,
  ReceiptType,
  PayerType,
  ReceiptStatus,
  ReceiptFollowUpStatus,
  DispatchStatus,
  B2BCreditComplianceStatus,
 } from '../../shared/types.ts';
import { recordWorkflowHistory } from './auditService.ts';

export class AccountsService {
  /**
   * Record a new customer receipt
   */
  static async recordReceipt(params: {
    lead_id: string;
    amount: number;
    receipt_date: string;
    payment_mode: PaymentMode;
    reference_number?: string;
    receipt_type: ReceiptType;
    payer_type: PayerType;
    payer_name?: string;
    bank_name?: string;
    deposited_in_account?: string;
    status?: ReceiptStatus;
    remarks?: string;
    actor_id: string;
    actor_name: string;
  }): Promise<CustomerReceipt> {
    const db = await getDB();

    if (!params.lead_id) {
      throw new Error('Lead ID is required to record a receipt.');
    }
    if (!params.amount || Number(params.amount) <= 0) {
      throw new Error('Receipt amount must be greater than zero.');
    }
    if (!params.payment_mode) {
      throw new Error('Payment mode is required.');
    }

    // Verify lead exists
    const leadRes = await db.query(
      `SELECT id, lead_number, customer_name, customer_type, b2c_loan_required,
              b2b_credit_extended, requested_credit_amount, approved_credit_amount,
              total_project_value, dispatch_status
       FROM leads WHERE id = $1`,
      [params.lead_id]
    );

    if (leadRes.rows.length === 0) {
      throw new Error('Project / Lead not found.');
    }
    const lead = leadRes.rows[0];

    // For B2B projects, loan options and bank loan disbursements are not applicable
    if (lead.customer_type === 'B2B') {
      if (
        params.payer_type === 'BANK' ||
        params.receipt_type === 'BANK_LOAN_DISBURSEMENT' ||
        params.payment_mode === 'BANK_LOAN_DISBURSEMENT'
      ) {
        throw new Error('For B2B projects, loan options and bank loan disbursements are not applicable.');
      }
    }

    // Generate consecutive receipt number
    const countRes = await db.query(`SELECT COUNT(*) as cnt FROM customer_receipts`);
    const nextSeq = (Number(countRes.rows[0]?.cnt || 0) + 1).toString().padStart(4, '0');
    const currentYear = new Date().getFullYear();
    const receiptNumber = `RCP-${currentYear}-${nextSeq}`;

    const receiptId = crypto.randomUUID();
    const status = params.status || 'CLEARED';

    const insertRes = await db.query(
      `INSERT INTO customer_receipts (
        id, receipt_number, lead_id, amount, receipt_date, payment_mode, reference_number,
        receipt_type, payer_type, payer_name, bank_name, deposited_in_account, status,
        remarks, recorded_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, NOW(), NOW()
      ) RETURNING *`,
      [
        receiptId,
        receiptNumber,
        params.lead_id,
        params.amount,
        params.receipt_date || new Date().toISOString().split('T')[0],
        params.payment_mode,
        params.reference_number?.trim() || null,
        params.receipt_type,
        params.payer_type,
        params.payer_name?.trim() || null,
        params.bank_name?.trim() || null,
        params.deposited_in_account?.trim() || null,
        status,
        params.remarks?.trim() || null,
        params.actor_id,
      ]
    );

    const newReceipt = insertRes.rows[0];

    // Audit log
    await recordWorkflowHistory(db, {
      leadId: params.lead_id,
      actorId: params.actor_id,
      actorName: params.actor_name,
      eventType: 'RECEIPT_RECORDED',
      previousState: lead.dispatch_status,
      newState: lead.dispatch_status,
      remarks: `Receipt ${receiptNumber} of ₹${Number(params.amount).toLocaleString('en-IN')} recorded via ${params.payment_mode} (${params.receipt_type}, Payer: ${params.payer_type})`,
      metadata: {
        receipt_number: receiptNumber,
        amount: params.amount,
        payment_mode: params.payment_mode,
        receipt_type: params.receipt_type,
        payer_type: params.payer_type,
      },
    });

    // Auto-evaluate B2C dispatch readiness if cleared receipt
    if (status === 'CLEARED') {
      if (lead.customer_type === 'B2C' && lead.dispatch_status === 'PENDING_ADVANCE') {
        const isAdvance =
          params.receipt_type === 'ADVANCE' ||
          params.receipt_type === 'BANK_LOAN_DISBURSEMENT' ||
          params.payer_type === 'CUSTOMER' ||
          params.payer_type === 'BANK';

        if (isAdvance) {
          // Check if loan is required: advance from Customer or Bank satisfies the rule
          const satisfactionSource =
            params.payer_type === 'BANK' || params.receipt_type === 'BANK_LOAN_DISBURSEMENT'
              ? 'Bank (Loan Disbursement)'
              : 'Customer (Advance Receipt)';

          await db.query(
            `UPDATE leads 
             SET dispatch_status = 'DISPATCH_CLEARED',
                 dispatch_cleared_at = NOW(),
                 dispatch_cleared_by = $1,
                 dispatch_remarks = $2
             WHERE id = $3 AND dispatch_status = 'PENDING_ADVANCE'`,
            [
              params.actor_id,
              `Advance payment of ₹${Number(params.amount).toLocaleString('en-IN')} received from ${satisfactionSource}. Hard rule satisfied - cleared for material dispatch.`,
              params.lead_id,
            ]
          );

          await recordWorkflowHistory(db, {
            leadId: params.lead_id,
            actorId: params.actor_id,
            actorName: params.actor_name,
            eventType: 'DISPATCH_CLEARED',
            previousState: 'PENDING_ADVANCE',
            newState: 'DISPATCH_CLEARED',
            remarks: `B2C Advance Hard Rule Satisfied: Advance payment received from ${satisfactionSource}. Project cleared for material dispatch.`,
            metadata: {
              cleared_by: params.actor_name,
              satisfaction_source: satisfactionSource,
              amount: params.amount,
            },
          });
        }
      }
    }

    return newReceipt;
  }

  /**
   * Get all customer receipts with rich joined metadata
   */
  static async getReceipts(filters?: {
    lead_id?: string;
    receipt_type?: string;
    payer_type?: string;
    search?: string;
    status?: string;
  }): Promise<CustomerReceipt[]> {
    const db = await getDB();
    let query = `
      SELECT r.*,
             l.lead_number,
             l.customer_name,
             l.customer_type,
             l.mobile_number,
             l.total_project_value,
             u.name as recorder_name
      FROM customer_receipts r
      JOIN leads l ON r.lead_id = l.id
      JOIN users u ON r.recorded_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.lead_id) {
      params.push(filters.lead_id);
      query += ` AND r.lead_id = $${params.length}`;
    }
    if (filters?.receipt_type && filters.receipt_type !== 'ALL') {
      params.push(filters.receipt_type);
      query += ` AND r.receipt_type = $${params.length}`;
    }
    if (filters?.payer_type && filters.payer_type !== 'ALL') {
      params.push(filters.payer_type);
      query += ` AND r.payer_type = $${params.length}`;
    }
    if (filters?.status && filters.status !== 'ALL') {
      params.push(filters.status);
      query += ` AND r.status = $${params.length}`;
    }
    if (filters?.search && filters.search.trim()) {
      params.push(`%${filters.search.trim()}%`);
      const idx = params.length;
      query += ` AND (
        r.receipt_number ILIKE $${idx} OR
        l.customer_name ILIKE $${idx} OR
        l.mobile_number ILIKE $${idx} OR
        r.reference_number ILIKE $${idx} OR
        r.payer_name ILIKE $${idx}
      )`;
    }

    query += ` ORDER BY r.receipt_date DESC, r.created_at DESC`;

    const res = await db.query(query, params);
    return res.rows.map((row) => ({
      ...row,
      amount: Number(row.amount),
      total_project_value: Number(row.total_project_value || 0),
      receipt_date: row.receipt_date instanceof Date ? row.receipt_date.toISOString().split('T')[0] : String(row.receipt_date).split('T')[0],
    }));
  }

  /**
   * Record a receipt follow-up
   */
  static async recordFollowUp(params: {
    lead_id: string;
    follow_up_date: string;
    promised_payment_date?: string;
    promised_amount?: number;
    contact_person?: string;
    contact_phone?: string;
    status?: ReceiptFollowUpStatus;
    remarks: string;
    outcome_notes?: string;
    actor_id: string;
  }): Promise<ReceiptFollowUp> {
    const db = await getDB();

    if (!params.lead_id) {
      throw new Error('Lead ID is required for logging a follow-up.');
    }
    if (!params.remarks || !params.remarks.trim()) {
      throw new Error('Follow-up remarks are required.');
    }

    const id = crypto.randomUUID();
    const status = params.status || 'SCHEDULED';

    const insertRes = await db.query(
      `INSERT INTO receipt_followups (
        id, lead_id, follow_up_date, promised_payment_date, promised_amount,
        contact_person, contact_phone, status, remarks, outcome_notes,
        recorded_by, completed_at, created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, NOW()
      ) RETURNING *`,
      [
        id,
        params.lead_id,
        params.follow_up_date || new Date().toISOString(),
        params.promised_payment_date || null,
        params.promised_amount ? Number(params.promised_amount) : null,
        params.contact_person?.trim() || null,
        params.contact_phone?.trim() || null,
        status,
        params.remarks.trim(),
        params.outcome_notes?.trim() || null,
        params.actor_id,
        status === 'COMPLETED' ? new Date().toISOString() : null,
      ]
    );

    // Update lead updated_at
    await db.query(`UPDATE leads SET updated_at = NOW() WHERE id = $1`, [params.lead_id]);

    return insertRes.rows[0];
  }

  /**
   * Get all receipt follow-ups
   */
  static async getFollowUps(filters?: {
    lead_id?: string;
    status?: string;
    only_due_today?: boolean;
    only_overdue?: boolean;
    search?: string;
  }): Promise<ReceiptFollowUp[]> {
    const db = await getDB();

    let query = `
      SELECT f.*,
             l.lead_number,
             l.customer_name,
             l.customer_type,
             l.mobile_number,
             l.total_project_value,
             COALESCE(rcp_agg.total_received, 0) as total_received,
             u.name as recorder_name
      FROM receipt_followups f
      JOIN leads l ON f.lead_id = l.id
      JOIN users u ON f.recorded_by = u.id
      LEFT JOIN (
        SELECT lead_id, SUM(amount) as total_received
        FROM customer_receipts
        WHERE status = 'CLEARED'
        GROUP BY lead_id
      ) rcp_agg ON l.id = rcp_agg.lead_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.lead_id) {
      params.push(filters.lead_id);
      query += ` AND f.lead_id = $${params.length}`;
    }
    if (filters?.status && filters.status !== 'ALL') {
      params.push(filters.status);
      query += ` AND f.status = $${params.length}`;
    }
    if (filters?.only_due_today) {
      query += ` AND f.follow_up_date::date = CURRENT_DATE AND f.status IN ('SCHEDULED', 'PROMISED_TO_PAY')`;
    }
    if (filters?.only_overdue) {
      query += ` AND f.follow_up_date < NOW() AND f.status IN ('SCHEDULED', 'PROMISED_TO_PAY')`;
    }
    if (filters?.search && filters.search.trim()) {
      params.push(`%${filters.search.trim()}%`);
      const idx = params.length;
      query += ` AND (
        l.customer_name ILIKE $${idx} OR
        l.mobile_number ILIKE $${idx} OR
        f.contact_person ILIKE $${idx} OR
        f.remarks ILIKE $${idx}
      )`;
    }

    query += ` ORDER BY f.follow_up_date ASC, f.created_at DESC`;

    const res = await db.query(query, params);
    return res.rows.map((row) => {
      const totProj = Number(row.total_project_value || 0);
      const totRec = Number(row.total_received || 0);
      return {
        ...row,
        total_project_value: totProj,
        total_received: totRec,
        balance_due: Math.max(0, totProj - totRec),
        promised_amount: row.promised_amount ? Number(row.promised_amount) : null,
      };
    });
  }

  /**
   * Update follow-up status (e.g. mark completed, customer promised payment, etc.)
   */
  static async updateFollowUpStatus(params: {
    id: string;
    status: ReceiptFollowUpStatus;
    outcome_notes?: string;
    promised_payment_date?: string;
    promised_amount?: number;
    actor_id: string;
  }): Promise<ReceiptFollowUp> {
    const db = await getDB();
    const completedAt = params.status === 'COMPLETED' ? new Date().toISOString() : null;

    const res = await db.query(
      `UPDATE receipt_followups
       SET status = $1,
           outcome_notes = COALESCE($2, outcome_notes),
           promised_payment_date = COALESCE($3, promised_payment_date),
           promised_amount = COALESCE($4, promised_amount),
           completed_at = COALESCE($5, completed_at)
       WHERE id = $6
       RETURNING *`,
      [
        params.status,
        params.outcome_notes?.trim() || null,
        params.promised_payment_date || null,
        params.promised_amount ? Number(params.promised_amount) : null,
        completedAt,
        params.id,
      ]
    );

    if (res.rows.length === 0) {
      throw new Error('Follow-up record not found.');
    }
    return res.rows[0];
  }

  /**
   * Get Accounts Team Leads Overview (Financial status, B2C Dispatch Clearance, B2B Credit Compliance)
   */
  static async getAccountsLeadsOverview(filters?: {
    customer_type?: 'B2C' | 'B2B' | 'ALL';
    search?: string;
    dispatch_status?: string;
    credit_compliance?: string;
    owner_approval?: string;
  }): Promise<AccountsLeadOverview[]> {
    const db = await getDB();

    let query = `
      SELECT l.*,
             u_disp.name as dispatch_cleared_by_name,
             u_lead.name as lead_owner_name,
             u_lead.id as lead_owner_id,
             COALESCE(rcp_agg.total_received, 0) as total_received,
             COALESCE(rcp_agg.advance_received, 0) as advance_received,
             COALESCE(rcp_agg.customer_advance_received, 0) as customer_advance_received,
             COALESCE(rcp_agg.bank_advance_received, 0) as bank_advance_received,
             COALESCE(rcp_agg.receipt_count, 0) as receipt_count,
             rcp_agg.last_receipt_date,
             COALESCE(fu_agg.follow_up_count, 0) as follow_up_count,
             fu_agg.next_follow_up_date,
             cred_hist.decision as owner_credit_decision,
             cred_hist.decided_at as owner_credit_decided_at,
             cred_hist.remarks as owner_credit_remarks
      FROM leads l
      LEFT JOIN users u_disp ON l.dispatch_cleared_by = u_disp.id
      LEFT JOIN users u_lead ON (l.owner_id = u_lead.id OR l.created_by = u_lead.id)
      LEFT JOIN (
        SELECT lead_id,
               SUM(amount) as total_received,
               SUM(CASE WHEN receipt_type = 'ADVANCE' OR receipt_type = 'BANK_LOAN_DISBURSEMENT' THEN amount ELSE 0 END) as advance_received,
               SUM(CASE WHEN payer_type = 'CUSTOMER' AND (receipt_type = 'ADVANCE' OR amount > 0) THEN amount ELSE 0 END) as customer_advance_received,
               SUM(CASE WHEN payer_type = 'BANK' OR receipt_type = 'BANK_LOAN_DISBURSEMENT' THEN amount ELSE 0 END) as bank_advance_received,
               COUNT(*) as receipt_count,
               MAX(receipt_date) as last_receipt_date
        FROM customer_receipts
        WHERE status = 'CLEARED'
        GROUP BY lead_id
      ) rcp_agg ON l.id = rcp_agg.lead_id
      LEFT JOIN (
        SELECT lead_id,
               COUNT(*) as follow_up_count,
               MIN(CASE WHEN status IN ('SCHEDULED', 'PROMISED_TO_PAY') AND follow_up_date >= NOW() - INTERVAL '1 day' THEN follow_up_date ELSE NULL END) as next_follow_up_date
        FROM receipt_followups
        GROUP BY lead_id
      ) fu_agg ON l.id = fu_agg.lead_id
      LEFT JOIN (
        SELECT DISTINCT ON (lead_id) lead_id, decision, decided_at, remarks
        FROM credit_approval_history
        ORDER BY lead_id, decided_at DESC
      ) cred_hist ON l.id = cred_hist.lead_id
      WHERE l.status != 'LOST'
    `;
    const params: any[] = [];

    if (filters?.customer_type && filters.customer_type !== 'ALL') {
      params.push(filters.customer_type);
      query += ` AND l.customer_type = $${params.length}`;
    }
    if (filters?.dispatch_status && filters.dispatch_status !== 'ALL') {
      params.push(filters.dispatch_status);
      query += ` AND l.dispatch_status = $${params.length}`;
    }
    if (filters?.search && filters.search.trim()) {
      params.push(`%${filters.search.trim()}%`);
      const idx = params.length;
      query += ` AND (
        l.customer_name ILIKE $${idx} OR
        l.mobile_number ILIKE $${idx} OR
        l.location ILIKE $${idx} OR
        l.address ILIKE $${idx}
      )`;
    }

    query += ` ORDER BY l.created_at DESC`;

    const res = await db.query(query, params);

    const items: AccountsLeadOverview[] = res.rows.map((row) => {
      const totalProjectVal = Number(row.total_project_value || 0);
      const totalRec = Number(row.total_received || 0);
      const advanceRec = Number(row.advance_received || 0);
      const customerAdv = Number(row.customer_advance_received || 0);
      const bankAdv = Number(row.bank_advance_received || 0);
      const hasCustomerAdv = customerAdv > 0;
      const hasBankAdv = bankAdv > 0;
      const balanceDue = Math.max(0, totalProjectVal - totalRec);
      const collectionPct = totalProjectVal > 0 ? Math.min(100, Math.round((totalRec / totalProjectVal) * 100)) : 0;

      // B2C Advance Evaluation:
      // Hard rule: For B2C project shall no handoff to dispatch until at least one receipt is recorded by accounts for amount not less than Rs.1.
      const receiptCount = Number(row.receipt_count || 0);
      const hasReceiptAtLeastOneRupee = receiptCount >= 1 && totalRec >= 1;
      let b2cAdvanceSatisfied = false;

      if (row.customer_type === 'B2C') {
        b2cAdvanceSatisfied = hasReceiptAtLeastOneRupee;
      }

      // B2B Credit Terms & Owner Approval Evaluation:
      const creditExtended = row.b2b_credit_extended === 'YES';
      const reqCredit = Number(row.requested_credit_amount || 0);
      const appCredit = Number(row.approved_credit_amount || 0);

      let ownerApprovalStatus: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED' = 'NOT_REQUIRED';
      if (row.customer_type === 'B2B' && creditExtended) {
        if (row.owner_credit_decision === 'APPROVED' || row.owner_credit_decision === 'APPROVED_REDUCED' || appCredit > 0) {
          ownerApprovalStatus = 'APPROVED';
        } else if (row.owner_credit_decision === 'REJECTED') {
          ownerApprovalStatus = 'REJECTED';
        } else {
          ownerApprovalStatus = 'PENDING';
        }
      }

      // Upfront amount required for B2B = Total project value - approved credit limit
      const b2bUpfrontReq = creditExtended && ownerApprovalStatus === 'APPROVED'
        ? Math.max(0, totalProjectVal - appCredit)
        : totalProjectVal;

      let b2bCompliance: B2BCreditComplianceStatus = 'NO_CREDIT';
      let b2bMessage = 'No commercial credit requested';

      if (row.customer_type === 'B2B') {
        if (!creditExtended) {
          b2bCompliance = 'NO_CREDIT';
          b2bMessage = 'Standard commercial terms (100% advance / milestone payments, no credit)';
        } else if (ownerApprovalStatus === 'PENDING') {
          b2bCompliance = 'PENDING_REVIEW';
          b2bMessage = '⚠️ Owner Credit Approval Missing / Pending. Credit cannot be honored until Owner approves.';
        } else if (ownerApprovalStatus === 'REJECTED') {
          b2bCompliance = 'NON_COMPLIANT';
          b2bMessage = '⛔ Owner Credit Request REJECTED. Commercial terms must revert to zero credit.';
        } else {
          // Owner has approved credit
          if (totalRec >= b2bUpfrontReq) {
            b2bCompliance = 'COMPLIANT';
            b2bMessage = `✅ Payment compliant with credit terms: ₹${totalRec.toLocaleString('en-IN')} received. Approved credit limit of ₹${appCredit.toLocaleString('en-IN')} honored.`;
          } else {
            const deficit = b2bUpfrontReq - totalRec;
            b2bCompliance = 'NON_COMPLIANT';
            b2bMessage = `⚠️ Upfront payment shortfall: Customer has paid ₹${totalRec.toLocaleString('en-IN')}, required upfront minimum is ₹${b2bUpfrontReq.toLocaleString('en-IN')} (Deficit: ₹${deficit.toLocaleString('en-IN')}).`;
          }
        }
      }

      // B2B Dispatch Evaluation:
      // Hard rule: project should not move to dispatch until amount is received as per credit terms.
      let b2bDispatchSatisfied = false;
      if (row.customer_type === 'B2B') {
        if (creditExtended) {
          b2bDispatchSatisfied = ownerApprovalStatus === 'APPROVED' && totalRec >= b2bUpfrontReq;
        } else {
          b2bDispatchSatisfied = totalRec > 0;
        }
      }

      return {
        id: row.id,
        lead_number: row.lead_number,
        customer_name: row.customer_name,
        customer_type: row.customer_type,
        mobile_number: row.mobile_number,
        location: row.location || row.address,
        total_project_value: totalProjectVal,
        b2c_loan_required: row.b2c_loan_required,
        b2b_credit_extended: row.b2b_credit_extended,
        requested_credit_amount: reqCredit,
        approved_credit_amount: appCredit,
        owner_approval_status: ownerApprovalStatus,
        owner_approval_date: row.owner_credit_decided_at || null,
        owner_approval_remarks: row.owner_credit_remarks || null,
        total_received: totalRec,
        balance_due: balanceDue,
        collection_percentage: collectionPct,
        advance_received: advanceRec,
        has_advance_from_customer: hasCustomerAdv,
        has_advance_from_bank: hasBankAdv,
        b2c_advance_satisfied: b2cAdvanceSatisfied,
        b2b_dispatch_satisfied: b2bDispatchSatisfied,
        dispatch_status: (row.dispatch_status as DispatchStatus) || 'PENDING_ADVANCE',
        dispatch_cleared_at: row.dispatch_cleared_at || null,
        dispatch_cleared_by_name: row.dispatch_cleared_by_name || null,
        dispatch_remarks: row.dispatch_remarks || null,
        b2b_credit_compliance: b2bCompliance,
        b2b_credit_days: row.b2b_credit_days || 30,
        b2b_credit_due_date: row.b2b_credit_due_date || null,
        b2b_upfront_required: b2bUpfrontReq,
        b2b_compliance_message: b2bMessage,
        receipt_count: Number(row.receipt_count || 0),
        last_receipt_date: row.last_receipt_date ? String(row.last_receipt_date).split('T')[0] : null,
        follow_up_count: Number(row.follow_up_count || 0),
        next_follow_up_date: row.next_follow_up_date || null,
        current_team: row.current_team,
        status: row.status,
        lead_owner_name: row.lead_owner_name || null,
        lead_owner_id: row.lead_owner_id || null,
        action_required: Boolean(row.action_required),
        action_required_note: row.action_required_note || null,
      };
    });

    return items;
  }

  /**
   * Clear Project for Material Dispatch
   * ENFORCES THE HARD RULES:
   * 1. B2C: CANNOT move to dispatch until advance is received from customer or Bank (In case of Loan).
   * 2. B2B: CANNOT shift to dispatch until amount is received as per credit terms AND Owner approval is verified.
   */
  static async clearB2CDispatch(params: {
    lead_id: string;
    actor_id: string;
    actor_name: string;
    remarks?: string;
  }): Promise<{ success: boolean; message: string; dispatch_status: DispatchStatus }> {
    return this.clearProjectDispatch(params);
  }

  static async clearProjectDispatch(params: {
    lead_id: string;
    actor_id: string;
    actor_name: string;
    remarks?: string;
  }): Promise<{ success: boolean; message: string; dispatch_status: DispatchStatus }> {
    const db = await getDB();

    const leadRes = await db.query(
      `SELECT id, customer_name, customer_type, b2c_loan_required, b2b_credit_extended,
              requested_credit_amount, approved_credit_amount, dispatch_status, total_project_value
       FROM leads WHERE id = $1`,
      [params.lead_id]
    );

    if (leadRes.rows.length === 0) {
      throw new Error('Project lead not found.');
    }
    const lead = leadRes.rows[0];

    // Check receipts for this lead
    const receiptsRes = await db.query(
      `SELECT amount, receipt_type, payer_type, status
       FROM customer_receipts
       WHERE lead_id = $1 AND status = 'CLEARED'`,
      [params.lead_id]
    );

    const receipts = receiptsRes.rows;
    const hasCustomerPayment = receipts.some(
      (r) => r.payer_type === 'CUSTOMER' && (r.receipt_type === 'ADVANCE' || Number(r.amount) > 0)
    );
    const hasBankPayment = receipts.some(
      (r) => r.payer_type === 'BANK' || r.receipt_type === 'BANK_LOAN_DISBURSEMENT'
    );
    const totalRec = receipts.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const totalProjectVal = Number(lead.total_project_value || 0);

    // 1. HARD RULE VALIDATION FOR B2C:
    // "For B2C project shall no handoff to dispatch until at least one receipt is recorded by accounts for amount not less than Rs.1."
    if (lead.customer_type === 'B2C') {
      const validReceipts = receipts.filter((r) => Number(r.amount || 0) >= 1);
      if (validReceipts.length === 0) {
        throw new Error(
          'HARD RULE VIOLATION: For B2C projects, no handoff to dispatch is allowed until at least one receipt is recorded by Accounts for an amount not less than Rs. 1.'
        );
      }
    }

    // 2. HARD RULE VALIDATION FOR B2B:
    // "For B2B also project would not shift to dispatch until the amount is not received as per credit terms."
    if (lead.customer_type === 'B2B') {
      const creditExtended = lead.b2b_credit_extended === 'YES';

      if (creditExtended) {
        // Query latest credit decision from credit_approval_history
        const credHistRes = await db.query(
          `SELECT decision, approved_credit_amount, remarks
           FROM credit_approval_history
           WHERE lead_id = $1
           ORDER BY decided_at DESC LIMIT 1`,
          [params.lead_id]
        );
        const credHist = credHistRes.rows[0];
        const appCredit = credHist ? Number(credHist.approved_credit_amount || 0) : Number(lead.approved_credit_amount || 0);
        const isOwnerApproved = credHist?.decision === 'APPROVED' || credHist?.decision === 'APPROVED_REDUCED' || appCredit > 0;

        if (!isOwnerApproved) {
          throw new Error(
            'HARD RULE VIOLATION: B2B project credit terms have NOT been approved by Owner. Project cannot shift to dispatch until Owner gives approval and payment is received as per credit terms.'
          );
        }

        // Upfront required = Total project value - approved credit limit
        const upfrontRequired = Math.max(0, totalProjectVal - appCredit);
        if (totalRec < upfrontRequired) {
          const shortfall = upfrontRequired - totalRec;
          throw new Error(
            `HARD RULE VIOLATION: B2B payment received (₹${totalRec.toLocaleString('en-IN')}) does not meet the required upfront payment of ₹${upfrontRequired.toLocaleString('en-IN')} as per extended credit terms. Project cannot shift to dispatch until payment is received as per credit terms (Shortfall: ₹${shortfall.toLocaleString('en-IN')}).`
          );
        }
      } else {
        // Commercial credit NOT extended: Standard advance/payment required
        if (totalRec <= 0) {
          throw new Error(
            'HARD RULE VIOLATION: B2B project has zero payment received. Project cannot shift to dispatch until advance/agreed payment is recorded.'
          );
        }
      }
    }

    const defaultRemarks =
      lead.customer_type === 'B2C'
        ? `Dispatch cleared by Accounts team (${params.actor_name}). Receipt requirement verified (at least Rs. 1 recorded).`
        : `Dispatch cleared by Accounts team (${params.actor_name}). Payment verified as per extended credit terms (Owner approval confirmed).`;

    const clearRemarks = params.remarks?.trim() || defaultRemarks;

    await db.query(
      `UPDATE leads
       SET dispatch_status = 'DISPATCH_CLEARED',
           current_team = 'DISPATCH',
           dispatch_cleared_at = NOW(),
           dispatch_cleared_by = $1,
           dispatch_remarks = $2
       WHERE id = $3`,
      [params.actor_id, clearRemarks, params.lead_id]
    );

    // Upsert dispatch record
    try {
      await db.query(
        `INSERT INTO dispatch_records (id, lead_id, status, created_at, updated_at)
         VALUES ($1, $2, 'READY_FOR_DISPATCH', NOW(), NOW())
         ON CONFLICT (lead_id) DO UPDATE SET status = 'READY_FOR_DISPATCH', updated_at = NOW()`,
        [crypto.randomUUID(), params.lead_id]
      );
    } catch (dispatchErr) {
      console.warn('[AccountsService] Failed to upsert dispatch_records:', dispatchErr);
    }

    await recordWorkflowHistory(db, {
      leadId: params.lead_id,
      actorId: params.actor_id,
      actorName: params.actor_name,
      eventType: 'DISPATCH_CLEARED',
      previousState: lead.dispatch_status,
      newState: 'DISPATCH_CLEARED',
      remarks: clearRemarks,
      metadata: {
        cleared_by: params.actor_name,
        customer_type: lead.customer_type,
        loan_required: lead.b2c_loan_required,
        credit_extended: lead.b2b_credit_extended,
      },
    });

    return {
      success: true,
      message: `Project for ${lead.customer_name} verified and successfully cleared for material dispatch.`,
      dispatch_status: 'DISPATCH_CLEARED',
    };
  }

  /**
   * Send back B2B case to Lead Team user
   */
  static async sendBackB2BToLeadTeam(params: {
    lead_id: string;
    actor_id: string;
    actor_name: string;
    reason: string;
    remarks: string;
  }): Promise<{ success: boolean; message: string; lead_id: string }> {
    const db = await getDB();

    const leadRes = await db.query(
      `SELECT l.id, l.customer_name, l.customer_type, l.owner_id, l.created_by,
              u.name as lead_owner_name, u.username as lead_owner_username
       FROM leads l
       LEFT JOIN users u ON (l.owner_id = u.id OR l.created_by = u.id)
       WHERE l.id = $1`,
      [params.lead_id]
    );

    if (leadRes.rows.length === 0) {
      throw new Error('Project lead not found.');
    }
    const lead = leadRes.rows[0];

    const actionNote = `[Accounts Return - ${params.reason}]: ${params.remarks}`;

    // Update lead team to LEAD, action_required = true, and dispatch_status = 'PENDING_ADVANCE'
    await db.query(
      `UPDATE leads
       SET current_team = 'LEAD',
           action_required = true,
           action_required_note = $1,
           dispatch_status = 'PENDING_ADVANCE'
       WHERE id = $2`,
      [actionNote, params.lead_id]
    );

    // Record in workflow history
    await recordWorkflowHistory(db, {
      leadId: params.lead_id,
      actorId: params.actor_id,
      actorName: params.actor_name,
      eventType: 'B2B_SENT_BACK_TO_LEAD',
      previousState: 'ACCOUNTS',
      newState: 'LEAD',
      remarks: `Sent back to Lead Team: ${params.reason}. ${params.remarks}`,
      metadata: {
        reason: params.reason,
        remarks: params.remarks,
        assigned_lead_owner: lead.lead_owner_name || 'Lead Team',
      },
    });

    // Also record a follow-up item in receipt_followups so it appears in the queue
    const followUpDate = new Date().toISOString();
    await db.query(
      `INSERT INTO receipt_followups (
        lead_id, follow_up_date, contact_person, contact_phone,
        status, remarks, outcome_notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        params.lead_id,
        followUpDate,
        lead.lead_owner_name || 'Lead Team User',
        'Lead Desk',
        'ESCALATED_DISPUTE',
        `[Returned from Accounts to Lead Team] Reason: ${params.reason}. Note: ${params.remarks}`,
        `Action required by Lead Team: Resolve payment / credit terms with customer.`,
        params.actor_id,
      ]
    );

    return {
      success: true,
      message: `B2B case for "${lead.customer_name}" successfully sent back to Lead Team user (${lead.lead_owner_name || 'Lead Desk'}).`,
      lead_id: params.lead_id,
    };
  }

  /**
   * Get KPI Metrics for the Accounts Team Dashboard
   */
  static async getAccountsMetrics(): Promise<AccountsMetrics> {
    const db = await getDB();

    // 1. Total collections & count
    const rcpRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total_collections,
              COUNT(*) as receipts_count
       FROM customer_receipts
       WHERE status = 'CLEARED'`
    );
    const totalCollections = Number(rcpRes.rows[0]?.total_collections || 0);
    const receiptsCount = Number(rcpRes.rows[0]?.receipts_count || 0);

    // 2. Total project values across all non-lost leads
    const leadsValRes = await db.query(
      `SELECT COALESCE(SUM(total_project_value), 0) as total_val FROM leads WHERE status != 'LOST'`
    );
    const totalProjectVal = Number(leadsValRes.rows[0]?.total_val || 0);
    const totalReceivables = Math.max(0, totalProjectVal - totalCollections);

    // 3. B2C dispatch metrics
    const b2cRes = await db.query(
      `SELECT 
         COUNT(*) FILTER (WHERE dispatch_status = 'PENDING_ADVANCE') as pending_advance,
         COUNT(*) FILTER (WHERE dispatch_status = 'DISPATCH_CLEARED' OR dispatch_status = 'DISPATCHED' OR dispatch_status = 'DELIVERED') as cleared
       FROM leads
       WHERE customer_type = 'B2C' AND status != 'LOST'`
    );
    const b2cPendingAdvance = Number(b2cRes.rows[0]?.pending_advance || 0);
    const b2cDispatchCleared = Number(b2cRes.rows[0]?.cleared || 0);

    // 4. B2B dispatch metrics
    const b2bDispRes = await db.query(
      `SELECT 
         COUNT(*) FILTER (WHERE dispatch_status = 'PENDING_ADVANCE') as pending_dispatch,
         COUNT(*) FILTER (WHERE dispatch_status = 'DISPATCH_CLEARED' OR dispatch_status = 'DISPATCHED' OR dispatch_status = 'DELIVERED') as cleared
       FROM leads
       WHERE customer_type = 'B2B' AND status != 'LOST'`
    );
    const b2bPendingDispatch = Number(b2bDispRes.rows[0]?.pending_dispatch || 0);
    const b2bDispatchCleared = Number(b2bDispRes.rows[0]?.cleared || 0);

    // 5. B2B credit compliance counts
    const b2bLeads = await this.getAccountsLeadsOverview({ customer_type: 'B2B' });
    let b2bPendingOwner = 0;
    let b2bCompliant = 0;
    let b2bNonCompliant = 0;

    for (const l of b2bLeads) {
      if (l.b2b_credit_extended === 'YES') {
        if (l.owner_approval_status === 'PENDING') {
          b2bPendingOwner++;
        } else if (l.b2b_credit_compliance === 'COMPLIANT') {
          b2bCompliant++;
        } else if (l.b2b_credit_compliance === 'NON_COMPLIANT') {
          b2bNonCompliant++;
        }
      }
    }

    // 6. Follow-ups due today & overdue
    const fuRes = await db.query(
      `SELECT 
         COUNT(*) FILTER (WHERE follow_up_date::date = CURRENT_DATE AND status IN ('SCHEDULED', 'PROMISED_TO_PAY')) as due_today,
         COUNT(*) FILTER (WHERE follow_up_date < NOW() AND status IN ('SCHEDULED', 'PROMISED_TO_PAY')) as overdue
       FROM receipt_followups`
    );
    const dueToday = Number(fuRes.rows[0]?.due_today || 0);
    const overdue = Number(fuRes.rows[0]?.overdue || 0);

    return {
      total_collections: totalCollections,
      total_receivables: totalReceivables,
      receipts_count: receiptsCount,
      b2c_pending_advance_count: b2cPendingAdvance,
      b2c_dispatch_cleared_count: b2cDispatchCleared,
      b2b_pending_dispatch_count: b2bPendingDispatch,
      b2b_dispatch_cleared_count: b2bDispatchCleared,
      b2b_credit_pending_owner_approval: b2bPendingOwner,
      b2b_credit_compliant_count: b2bCompliant,
      b2b_credit_non_compliant_count: b2bNonCompliant,
      follow_ups_due_today: dueToday,
      follow_ups_overdue: overdue,
    };
  }
}
