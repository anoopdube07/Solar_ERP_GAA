import crypto from 'crypto';
import { getDB, type DBClient } from '../db/index.ts';
import type { 
  DispatchMetrics,
  DispatchQueueItem,
  DispatchRecord,
 } from '../../shared/types.ts';

async function recordWorkflowHistory(
  db: DBClient,
  params: {
    leadId: string;
    actorId: string;
    actorName: string;
    eventType: string;
    previousState?: string | null;
    newState: string;
    remarks: string;
    metadata?: Record<string, any>;
  }
) {
  try {
    await db.query(
      `INSERT INTO lead_workflow_history (
        id, lead_id, actor_id, actor_name, event_type, previous_state, new_state, remarks, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        crypto.randomUUID(),
        params.leadId,
        params.actorId,
        params.actorName,
        params.eventType,
        params.previousState || null,
        params.newState,
        params.remarks,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ]
    );
  } catch (err) {
    console.warn('[WorkflowHistory] Failed to write event:', err);
  }
}

export class DispatchService {
  /**
   * Summary metrics for Dispatch Command
   */
  static async getDispatchMetrics(): Promise<DispatchMetrics> {
    const db = await getDB();

    // Query all leads eligible for or currently in dispatch lifecycle
    const query = `
      SELECT 
        l.id,
        l.customer_type,
        l.dispatch_status,
        l.current_team,
        COALESCE(rcp.receipt_count, 0) as receipt_count,
        COALESCE(rcp.total_received, 0) as total_received,
        COALESCE(rcp.max_receipt_amount, 0) as max_receipt_amount,
        dr.status as dispatch_record_status
      FROM leads l
      LEFT JOIN (
        SELECT lead_id,
               COUNT(*) FILTER (WHERE amount >= 1) as receipt_count,
               SUM(amount) as total_received,
               MAX(amount) as max_receipt_amount
        FROM customer_receipts
        WHERE status = 'CLEARED'
        GROUP BY lead_id
      ) rcp ON l.id = rcp.lead_id
      LEFT JOIN dispatch_records dr ON l.id = dr.lead_id
      WHERE l.status NOT IN ('LOST')
    `;

    const res = await db.query(query);
    const rows = res.rows;

    let blockedB2C = 0;
    let blockedB2B = 0;
    let clearedReady = 0;
    let inTransit = 0;
    let delivered = 0;
    let b2cTotal = 0;
    let b2bTotal = 0;

    for (const r of rows) {
      const isB2C = r.customer_type === 'B2C';
      const isB2B = r.customer_type === 'B2B';
      const dStatus = r.dispatch_status;
      const recCount = Number(r.receipt_count || 0);
      const totalRec = Number(r.total_received || 0);
      const maxRec = Number(r.max_receipt_amount || 0);

      // Hard rule: For B2C, at least one receipt >= 1 INR must be recorded
      const b2cSatisfied = isB2C && recCount >= 1 && (maxRec >= 1 || totalRec >= 1);

      if (isB2C) b2cTotal++;
      if (isB2B) b2bTotal++;

      if (dStatus === 'DELIVERED' || r.dispatch_record_status === 'DELIVERED') {
        delivered++;
      } else if (dStatus === 'DISPATCHED' || r.dispatch_record_status === 'DISPATCHED') {
        inTransit++;
      } else if (dStatus === 'DISPATCH_CLEARED' || r.dispatch_record_status === 'READY_FOR_DISPATCH') {
        clearedReady++;
      } else {
        // Pending advance / clearance
        if (isB2C) {
          if (!b2cSatisfied) {
            blockedB2C++;
          } else {
            clearedReady++;
          }
        } else if (isB2B) {
          blockedB2B++;
        }
      }
    }

    return {
      total_projects: rows.length,
      blocked_b2c_count: blockedB2C,
      blocked_b2b_count: blockedB2B,
      cleared_ready_count: clearedReady,
      in_transit_count: inTransit,
      delivered_count: delivered,
      b2c_total: b2cTotal,
      b2b_total: b2bTotal,
    };
  }

  /**
   * Get queue of projects in dispatch pipeline
   */
  static async getDispatchQueue(filters?: {
    status?: string;
    customer_type?: string;
    search?: string;
  }): Promise<DispatchQueueItem[]> {
    const db = await getDB();

    const query = `
      SELECT 
        l.*,
        u_owner.name as lead_owner_name,
        u_clear.name as dispatch_cleared_by_name,
        COALESCE(rcp.receipt_count, 0) as receipt_count,
        COALESCE(rcp.total_received, 0) as total_received,
        COALESCE(rcp.advance_received, 0) as advance_received,
        COALESCE(rcp.max_receipt_amount, 0) as max_receipt_amount,
        rcp.first_receipt_number,
        rcp.first_receipt_date,
        rcp.first_receipt_amount,
        dr.id as dr_id,
        dr.status as dr_status,
        dr.transporter_name as dr_transporter_name,
        dr.lr_number as dr_lr_number,
        dr.vehicle_number as dr_vehicle_number,
        dr.driver_name as dr_driver_name,
        dr.driver_phone as dr_driver_phone,
        dr.dispatch_date as dr_dispatch_date,
        dr.estimated_delivery_date as dr_estimated_delivery_date,
        dr.actual_delivery_date as dr_actual_delivery_date,
        dr.delivery_challan_number as dr_delivery_challan_number,
        dr.dispatch_notes as dr_dispatch_notes,
        dr.delivery_proof_url as dr_delivery_proof_url,
        dr.created_at as dr_created_at,
        dr.updated_at as dr_updated_at,
        u_disp.name as dr_dispatched_by_name,
        u_delv.name as dr_delivered_by_name,
        COALESCE(ql.quotation_line_count, 0) as quotation_line_count
      FROM leads l
      LEFT JOIN users u_owner ON l.owner_id = u_owner.id
      LEFT JOIN users u_clear ON l.dispatch_cleared_by = u_clear.id
      LEFT JOIN (
        SELECT 
          lead_id,
          COUNT(*) FILTER (WHERE amount >= 1) as receipt_count,
          SUM(amount) as total_received,
          SUM(CASE WHEN receipt_type = 'ADVANCE' OR receipt_type = 'BANK_LOAN_DISBURSEMENT' THEN amount ELSE 0 END) as advance_received,
          MAX(amount) as max_receipt_amount,
          (ARRAY_AGG(receipt_number ORDER BY receipt_date ASC, created_at ASC))[1] as first_receipt_number,
          (ARRAY_AGG(receipt_date ORDER BY receipt_date ASC, created_at ASC))[1] as first_receipt_date,
          (ARRAY_AGG(amount ORDER BY receipt_date ASC, created_at ASC))[1] as first_receipt_amount
        FROM customer_receipts
        WHERE status = 'CLEARED'
        GROUP BY lead_id
      ) rcp ON l.id = rcp.lead_id
      LEFT JOIN dispatch_records dr ON l.id = dr.lead_id
      LEFT JOIN users u_disp ON dr.dispatched_by = u_disp.id
      LEFT JOIN users u_delv ON dr.delivered_by = u_delv.id
      LEFT JOIN (
        SELECT lead_id, COUNT(*) as quotation_line_count
        FROM quotation_lines
        GROUP BY lead_id
      ) ql ON l.id = ql.lead_id
      WHERE l.status NOT IN ('LOST')
      ORDER BY 
        CASE 
          WHEN l.dispatch_status = 'PENDING_ADVANCE' THEN 1
          WHEN l.dispatch_status = 'DISPATCH_CLEARED' THEN 2
          WHEN l.dispatch_status = 'DISPATCHED' THEN 3
          WHEN l.dispatch_status = 'DELIVERED' THEN 4
          ELSE 5
        END,
        l.updated_at DESC
    `;

    const res = await db.query(query);

    return res.rows.map((row) => {
      const isB2C = row.customer_type === 'B2C';
      const receiptCount = Number(row.receipt_count || 0);
      const totalRec = Number(row.total_received || 0);
      const maxRec = Number(row.max_receipt_amount || 0);

      // Hard rule: For B2C projects, shall not handoff to dispatch until at least one receipt is recorded by accounts for amount not less than Rs. 1.
      const b2cReceiptSatisfied = isB2C && receiptCount >= 1 && (maxRec >= 1 || totalRec >= 1);
      const b2bDispatchSatisfied = row.customer_type === 'B2B' && (
        row.b2b_credit_compliance_status === 'COMPLIANT' ||
        row.dispatch_status === 'DISPATCH_CLEARED' ||
        row.dispatch_status === 'DISPATCHED' ||
        row.dispatch_status === 'DELIVERED'
      );

      let dispatchRecord: DispatchRecord | null = null;
      if (row.dr_id) {
        dispatchRecord = {
          id: row.dr_id,
          lead_id: row.id,
          status: row.dr_status,
          transporter_name: row.dr_transporter_name || row.transporter_name,
          lr_number: row.dr_lr_number || row.lr_number,
          vehicle_number: row.dr_vehicle_number || row.vehicle_number,
          driver_name: row.dr_driver_name || row.driver_name,
          driver_phone: row.dr_driver_phone || row.driver_phone,
          dispatch_date: row.dr_dispatch_date || row.dispatch_date,
          estimated_delivery_date: row.dr_estimated_delivery_date || row.estimated_delivery_date,
          actual_delivery_date: row.dr_actual_delivery_date || row.actual_delivery_date,
          delivery_challan_number: row.dr_delivery_challan_number || row.delivery_challan_number,
          dispatch_notes: row.dr_dispatch_notes,
          delivery_proof_url: row.dr_delivery_proof_url,
          dispatched_by_name: row.dr_dispatched_by_name,
          delivered_by_name: row.dr_delivered_by_name,
          created_at: row.dr_created_at,
          updated_at: row.dr_updated_at,
        };
      }

      return {
        ...row,
        total_project_value: Number(row.total_project_value || 0),
        system_capacity_kwp: Number(row.system_capacity_kwp || 0),
        b2c_receipt_satisfied: b2cReceiptSatisfied,
        b2c_advance_satisfied: b2cReceiptSatisfied,
        b2b_dispatch_satisfied: b2bDispatchSatisfied,
        receipt_count: receiptCount,
        total_received: totalRec,
        advance_received: Number(row.advance_received || 0),
        max_receipt_amount: maxRec,
        first_receipt_number: row.first_receipt_number,
        first_receipt_date: row.first_receipt_date,
        first_receipt_amount: row.first_receipt_amount ? Number(row.first_receipt_amount) : null,
        dispatch_record: dispatchRecord,
        quotation_line_count: Number(row.quotation_line_count || 0),
      };
    });
  }

  /**
   * Handoff lead to Dispatch Team with hard rule enforcement
   */
  static async handoffToDispatch(params: {
    leadId: string;
    actorId: string;
    actorName: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string }> {
    const db = await getDB();

    const leadRes = await db.query(
      `SELECT l.*, 
              COALESCE(rcp.receipt_count, 0) as receipt_count,
              COALESCE(rcp.total_received, 0) as total_received,
              COALESCE(rcp.max_receipt_amount, 0) as max_receipt_amount
       FROM leads l
       LEFT JOIN (
         SELECT lead_id, 
                COUNT(*) FILTER (WHERE amount >= 1) as receipt_count, 
                SUM(amount) as total_received, 
                MAX(amount) as max_receipt_amount
         FROM customer_receipts
         WHERE status = 'CLEARED'
         GROUP BY lead_id
       ) rcp ON l.id = rcp.lead_id
       WHERE l.id = $1`,
      [params.leadId]
    );

    if (leadRes.rows.length === 0) {
      throw new Error('Project lead not found.');
    }

    const lead = leadRes.rows[0];
    const recCount = Number(lead.receipt_count || 0);
    const totalRec = Number(lead.total_received || 0);
    const maxRec = Number(lead.max_receipt_amount || 0);

    // Hard rule check: For B2C project shall no handoff to dispatch until at least one receipt is recorded by accounts for amount not less than ₹1.
    if (lead.customer_type === 'B2C') {
      const isSatisfied = recCount >= 1 && (maxRec >= 1 || totalRec >= 1);
      if (!isSatisfied) {
        throw new Error(
          'HARD RULE VIOLATION: For B2C projects, no handoff to dispatch is permitted until at least one receipt is recorded by Accounts for an amount not less than ₹1. Please record a receipt in Accounts Desk before handoff.'
        );
      }
    }

    // Hard rule check for B2B
    if (lead.customer_type === 'B2B') {
      if (lead.b2b_credit_extended === 'YES' && lead.owner_credit_decision === 'REJECTED') {
        throw new Error('Cannot handoff to dispatch: Owner has rejected the requested B2B credit terms.');
      }
    }

    // Perform handoff
    const previousTeam = lead.current_team;
    await db.query(
      `UPDATE leads
       SET current_team = 'DISPATCH',
           dispatch_status = CASE WHEN dispatch_status = 'PENDING_ADVANCE' THEN 'DISPATCH_CLEARED' ELSE dispatch_status END,
           dispatch_cleared_at = COALESCE(dispatch_cleared_at, NOW()),
           dispatch_cleared_by = COALESCE(dispatch_cleared_by, $1),
           updated_at = NOW()
       WHERE id = $2`,
      [params.actorId, params.leadId]
    );

    await db.query(
      `INSERT INTO dispatch_records (id, lead_id, status, created_at, updated_at)
       VALUES ($1, $2, 'READY_FOR_DISPATCH', NOW(), NOW())
       ON CONFLICT (lead_id) DO UPDATE SET 
         status = CASE WHEN dispatch_records.status = 'PENDING_CLEARANCE' THEN 'READY_FOR_DISPATCH' ELSE dispatch_records.status END,
         updated_at = NOW()`,
      [crypto.randomUUID(), params.leadId]
    );

    await recordWorkflowHistory(db, {
      leadId: params.leadId,
      actorId: params.actorId,
      actorName: params.actorName,
      eventType: 'TEAM_HANDOFF',
      previousState: previousTeam,
      newState: 'DISPATCH',
      remarks: params.notes || `Project handed off to Dispatch Team by ${params.actorName}. Accounts receipt clearance verified.`,
    });

    return {
      success: true,
      message: `Project for ${lead.customer_name} handed off to Dispatch Team successfully.`,
    };
  }

  /**
   * Book shipment and mark as DISPATCHED (In-Transit)
   */
  static async updateShipmentDetails(params: {
    leadId: string;
    transporter_name: string;
    lr_number: string;
    vehicle_number: string;
    driver_name?: string;
    driver_phone?: string;
    dispatch_date: string;
    estimated_delivery_date?: string;
    dispatch_notes?: string;
    actorId: string;
    actorName: string;
  }): Promise<{ success: boolean; message: string }> {
    const db = await getDB();

    if (!params.transporter_name || !params.lr_number || !params.vehicle_number || !params.dispatch_date) {
      throw new Error('Transporter name, LR/Tracking number, vehicle number, and dispatch date are required.');
    }

    // Verify lead exists
    const leadRes = await db.query('SELECT * FROM leads WHERE id = $1', [params.leadId]);
    if (leadRes.rows.length === 0) {
      throw new Error('Lead not found.');
    }
    const lead = leadRes.rows[0];

    // Update leads table
    await db.query(
      `UPDATE leads
       SET dispatch_status = 'DISPATCHED',
           current_team = 'DISPATCH',
           transporter_name = $1,
           lr_number = $2,
           vehicle_number = $3,
           driver_name = $4,
           driver_phone = $5,
           dispatch_date = $6,
           estimated_delivery_date = $7,
           dispatch_remarks = $8,
           updated_at = NOW()
       WHERE id = $9`,
      [
        params.transporter_name,
        params.lr_number,
        params.vehicle_number,
        params.driver_name || null,
        params.driver_phone || null,
        params.dispatch_date,
        params.estimated_delivery_date || null,
        params.dispatch_notes || null,
        params.leadId,
      ]
    );

    // Upsert dispatch_records
    await db.query(
      `INSERT INTO dispatch_records (
        id, lead_id, status, transporter_name, lr_number, vehicle_number, driver_name, driver_phone,
        dispatch_date, estimated_delivery_date, dispatch_notes, dispatched_by, created_at, updated_at
      ) VALUES ($1, $2, 'DISPATCHED', $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      ON CONFLICT (lead_id) DO UPDATE SET
        status = 'DISPATCHED',
        transporter_name = EXCLUDED.transporter_name,
        lr_number = EXCLUDED.lr_number,
        vehicle_number = EXCLUDED.vehicle_number,
        driver_name = EXCLUDED.driver_name,
        driver_phone = EXCLUDED.driver_phone,
        dispatch_date = EXCLUDED.dispatch_date,
        estimated_delivery_date = EXCLUDED.estimated_delivery_date,
        dispatch_notes = EXCLUDED.dispatch_notes,
        dispatched_by = EXCLUDED.dispatched_by,
        updated_at = NOW()`,
      [
        crypto.randomUUID(),
        params.leadId,
        params.transporter_name,
        params.lr_number,
        params.vehicle_number,
        params.driver_name || null,
        params.driver_phone || null,
        params.dispatch_date,
        params.estimated_delivery_date || null,
        params.dispatch_notes || null,
        params.actorId,
      ]
    );

    await recordWorkflowHistory(db, {
      leadId: params.leadId,
      actorId: params.actorId,
      actorName: params.actorName,
      eventType: 'MATERIAL_DISPATCHED',
      previousState: lead.dispatch_status,
      newState: 'DISPATCHED',
      remarks: `Material dispatched via ${params.transporter_name} (LR: ${params.lr_number}, Vehicle: ${params.vehicle_number}). Dispatched by ${params.actorName}.`,
      metadata: {
        transporter: params.transporter_name,
        lr_number: params.lr_number,
        vehicle_number: params.vehicle_number,
        driver_phone: params.driver_phone,
      },
    });

    return {
      success: true,
      message: `Materials for ${lead.customer_name} marked as Dispatched (In-Transit). LR: ${params.lr_number}.`,
    };
  }

  /**
   * Mark shipment as DELIVERED to site and handover to INSTALLATION TEAM
   */
  static async markDeliveredToSite(params: {
    leadId: string;
    actual_delivery_date: string;
    delivery_challan_number?: string;
    delivery_notes?: string;
    delivery_proof_url?: string;
    actorId: string;
    actorName: string;
  }): Promise<{ success: boolean; message: string }> {
    const db = await getDB();

    const leadRes = await db.query('SELECT * FROM leads WHERE id = $1', [params.leadId]);
    if (leadRes.rows.length === 0) {
      throw new Error('Lead not found.');
    }
    const lead = leadRes.rows[0];

    const challanNo = params.delivery_challan_number || `DC-${Date.now().toString().slice(-6)}`;

    // Update leads: status = DELIVERED, and hand over to INSTALLATION_TEAM
    await db.query(
      `UPDATE leads
       SET dispatch_status = 'DELIVERED',
           current_team = 'INSTALLATION_TEAM',
           actual_delivery_date = $1,
           delivery_challan_number = $2,
           dispatch_remarks = COALESCE($3, dispatch_remarks),
           updated_at = NOW()
       WHERE id = $4`,
      [params.actual_delivery_date, challanNo, params.delivery_notes || null, params.leadId]
    );

    // Update dispatch_records
    await db.query(
      `UPDATE dispatch_records
       SET status = 'DELIVERED',
           actual_delivery_date = $1,
           delivery_challan_number = $2,
           dispatch_notes = COALESCE($3, dispatch_notes),
           delivery_proof_url = $4,
           delivered_by = $5,
           updated_at = NOW()
       WHERE lead_id = $6`,
      [
        params.actual_delivery_date,
        challanNo,
        params.delivery_notes || null,
        params.delivery_proof_url || null,
        params.actorId,
        params.leadId,
      ]
    );

    // Ensure installation_records entry exists for the Installation Team
    await db.query(
      `INSERT INTO installation_records (id, lead_id, status, assigned_installer_id, created_at, updated_at)
       SELECT $1, l.id, CASE WHEN l.assigned_installer_id IS NOT NULL THEN 'ASSIGNED' ELSE 'PENDING_ASSIGNMENT' END, l.assigned_installer_id, NOW(), NOW()
       FROM leads l
       WHERE l.id = $2
       ON CONFLICT (lead_id) DO UPDATE SET updated_at = NOW()`,
      [crypto.randomUUID(), params.leadId]
    );

    await recordWorkflowHistory(db, {
      leadId: params.leadId,
      actorId: params.actorId,
      actorName: params.actorName,
      eventType: 'MATERIAL_DELIVERED',
      previousState: 'DISPATCHED',
      newState: 'DELIVERED',
      remarks: `Material safely delivered to site on ${params.actual_delivery_date}. Challan #${challanNo}. Transferred to Installation Team for installation execution.`,
      metadata: {
        challan_number: challanNo,
        delivery_date: params.actual_delivery_date,
        next_team: 'INSTALLATION_TEAM',
      },
    });

    return {
      success: true,
      message: `Shipment delivered to customer site. Project automatically handed over to Installation Team!`,
    };
  }

  /**
   * Get detailed delivery challan / BOM data for printing or preview
   */
  static async getDeliveryChallanData(leadId: string) {
    const db = await getDB();

    const leadRes = await db.query(
      `SELECT l.*, 
              u_owner.name as owner_name, 
              dr.*,
              COALESCE(rcp.total_received, 0) as total_received,
              COALESCE(rcp.receipt_count, 0) as receipt_count
       FROM leads l
       LEFT JOIN users u_owner ON l.owner_id = u_owner.id
       LEFT JOIN dispatch_records dr ON l.id = dr.lead_id
       LEFT JOIN (
         SELECT lead_id, COUNT(*) as receipt_count, SUM(amount) as total_received
         FROM customer_receipts
         WHERE status = 'CLEARED'
         GROUP BY lead_id
       ) rcp ON l.id = rcp.lead_id
       WHERE l.id = $1`,
      [leadId]
    );

    if (leadRes.rows.length === 0) {
      throw new Error('Lead not found.');
    }

    const lead = leadRes.rows[0];

    // Fetch quotation lines for BOM
    const itemsRes = await db.query(
      `SELECT ql.*, ql.item_name, ql.uom as default_uom
       FROM quotation_lines ql
       WHERE ql.lead_id = $1
       ORDER BY ql.created_at ASC`,
      [leadId]
    );

    return {
      lead,
      items: itemsRes.rows,
      generated_at: new Date().toISOString(),
    };
  }
}
