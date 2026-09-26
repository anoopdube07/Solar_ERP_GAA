import crypto from 'crypto';
import { getDB, type DBClient } from '../db/index.ts';
import type {
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  ServiceComplaint,
  ServiceComplaintActivity,
  ServiceMetrics,
  User,
} from '../../shared/types.ts';

export class ServiceComplaintService {
  /**
   * Calculate SLA due timestamp based on priority
   */
  private static calculateSlaDue(priority: ComplaintPriority): Date {
    const now = new Date();
    switch (priority) {
      case 'CRITICAL':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
      case 'HIGH':
        return new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours
      case 'MEDIUM':
        return new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 hours
      case 'LOW':
      default:
        return new Date(now.getTime() + 120 * 60 * 60 * 1000); // 5 days
    }
  }

  /**
   * Generate next sequential ticket number (e.g. SRV-2026-005)
   */
  private static async generateTicketNumber(db: DBClient): Promise<string> {
    const currentYear = new Date().getFullYear();
    const countRes = await db.query(
      `SELECT COUNT(*) as count FROM service_complaints WHERE ticket_number LIKE $1`,
      [`SRV-${currentYear}-%`]
    );
    const nextSeq = parseInt(countRes.rows[0]?.count || '0', 10) + 1;
    return `SRV-${currentYear}-${String(nextSeq).padStart(3, '0')}`;
  }

  /**
   * Retrieve complaints list with optional filtering and search
   */
  static async getComplaints(filters: {
    status?: string;
    priority?: string;
    category?: string;
    assignedToId?: string;
    search?: string;
  }): Promise<ServiceComplaint[]> {
    const db = await getDB();
    const params: unknown[] = [];
    const conditions: string[] = ['1=1'];

    if (filters.status && filters.status !== 'ALL') {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }

    if (filters.priority && filters.priority !== 'ALL') {
      params.push(filters.priority);
      conditions.push(`priority = $${params.length}`);
    }

    if (filters.category && filters.category !== 'ALL') {
      params.push(filters.category);
      conditions.push(`category = $${params.length}`);
    }

    if (filters.assignedToId) {
      params.push(filters.assignedToId);
      conditions.push(`assigned_to_user_id = $${params.length}`);
    }

    if (filters.search && filters.search.trim()) {
      const q = `%${filters.search.trim()}%`;
      params.push(q);
      const idx = params.length;
      conditions.push(
        `(ticket_number ILIKE $${idx} OR customer_name ILIKE $${idx} OR customer_phone ILIKE $${idx} OR city ILIKE $${idx} OR inverter_serial ILIKE $${idx} OR title ILIKE $${idx})`
      );
    }

    const query = `
      SELECT * FROM service_complaints
      WHERE ${conditions.join(' AND ')}
      ORDER BY 
        CASE 
          WHEN status IN ('RESOLVED', 'CLOSED') THEN 2
          ELSE 1
        END,
        sla_due_at ASC,
        created_at DESC
    `;

    const res = await db.query(query, params);
    return res.rows;
  }

  /**
   * Retrieve single complaint with its timeline activities
   */
  static async getComplaintById(id: string): Promise<ServiceComplaint | null> {
    const db = await getDB();
    const res = await db.query(`SELECT * FROM service_complaints WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;

    const complaint = res.rows[0];
    const actRes = await db.query(
      `SELECT * FROM service_complaint_activities WHERE complaint_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    complaint.activities = actRes.rows;
    return complaint;
  }

  /**
   * Calculate dashboard metrics for After-Sales desk
   */
  static async getServiceMetrics(): Promise<ServiceMetrics> {
    const db = await getDB();
    const res = await db.query(`
      SELECT
        COUNT(*) as total_complaints,
        COUNT(CASE WHEN status = 'OPEN' AND (assigned_to_user_id IS NULL OR assigned_to_user_id = '') THEN 1 END) as open_unassigned,
        COUNT(CASE WHEN status IN ('ASSIGNED', 'IN_PROGRESS') THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'WAITING_PARTS' THEN 1 END) as waiting_parts,
        COUNT(CASE WHEN status IN ('RESOLVED', 'CLOSED') THEN 1 END) as resolved_count,
        COUNT(CASE WHEN status NOT IN ('RESOLVED', 'CLOSED') AND sla_due_at < NOW() THEN 1 END) as sla_breached
      FROM service_complaints
    `);

    const row = res.rows[0];
    return {
      total_complaints: parseInt(row.total_complaints || '0', 10),
      open_unassigned: parseInt(row.open_unassigned || '0', 10),
      in_progress: parseInt(row.in_progress || '0', 10),
      waiting_parts: parseInt(row.waiting_parts || '0', 10),
      resolved_count: parseInt(row.resolved_count || '0', 10),
      sla_breached: parseInt(row.sla_breached || '0', 10),
    };
  }

  /**
   * Register a new complaint ticket
   */
  static async createComplaint(
    data: {
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
      title: string;
      description: string;
      reported_channel?: string;
      assigned_to_user_id?: string | null;
      assignment_notes?: string | null;
    },
    creator: User
  ): Promise<ServiceComplaint> {
    const db = await getDB();
    const id = crypto.randomUUID();
    const ticketNumber = await this.generateTicketNumber(db);
    const slaDueAt = this.calculateSlaDue(data.priority);

    let assignedToName: string | null = null;
    let assignedAt: Date | null = null;
    let initialStatus: ComplaintStatus = 'OPEN';

    if (data.assigned_to_user_id) {
      const userRes = await db.query(`SELECT name FROM users WHERE id = $1`, [data.assigned_to_user_id]);
      if (userRes.rows.length > 0) {
        assignedToName = userRes.rows[0].name;
        assignedAt = new Date();
        initialStatus = 'ASSIGNED';
      }
    }

    const insertSql = `
      INSERT INTO service_complaints (
        id, ticket_number, lead_id, customer_name, customer_phone, customer_email,
        customer_address, city, system_capacity_kw, inverter_brand_model, inverter_serial,
        commissioning_date, category, priority, status, title, description,
        reported_channel, reported_at, sla_due_at, assigned_to_user_id, assigned_to_name,
        assigned_at, assignment_notes, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17,
        $18, NOW(), $19, $20, $21,
        $22, $23, $24, NOW(), NOW()
      )
      RETURNING *
    `;

    const res = await db.query(insertSql, [
      id,
      ticketNumber,
      data.lead_id || null,
      data.customer_name.trim(),
      data.customer_phone.trim(),
      data.customer_email || null,
      data.customer_address || null,
      data.city || null,
      data.system_capacity_kw ? Number(data.system_capacity_kw) : null,
      data.inverter_brand_model || null,
      data.inverter_serial || null,
      data.commissioning_date || null,
      data.category,
      data.priority,
      initialStatus,
      data.title.trim(),
      data.description.trim(),
      data.reported_channel || 'PHONE',
      slaDueAt,
      data.assigned_to_user_id || null,
      assignedToName,
      assignedAt,
      data.assignment_notes || null,
      creator.id,
    ]);

    // Record initial registration activity
    await db.query(
      `
      INSERT INTO service_complaint_activities (
        id, complaint_id, actor_id, actor_name, action_type, new_status, notes, created_at
      ) VALUES ($1, $2, $3, $4, 'CREATED', $5, $6, NOW())
    `,
      [
        crypto.randomUUID(),
        id,
        creator.id,
        creator.name,
        initialStatus,
        `Complaint registered via ${data.reported_channel || 'Phone'}. Priority: ${data.priority} (SLA: ${slaDueAt.toLocaleDateString()}).`,
      ]
    );

    if (data.assigned_to_user_id && assignedToName) {
      await db.query(
        `
        INSERT INTO service_complaint_activities (
          id, complaint_id, actor_id, actor_name, action_type, old_status, new_status, notes, created_at
        ) VALUES ($1, $2, $3, $4, 'ASSIGNED', 'OPEN', 'ASSIGNED', $5, NOW())
      `,
        [
          crypto.randomUUID(),
          id,
          creator.id,
          creator.name,
          `Assigned to technician ${assignedToName}.${data.assignment_notes ? ` Notes: ${data.assignment_notes}` : ''}`,
        ]
      );
    }

    return res.rows[0];
  }

  /**
   * Assign or Reassign complaint to a technician
   */
  static async assignComplaint(
    id: string,
    assignedToUserId: string,
    assignmentNotes: string | null | undefined,
    actor: User
  ): Promise<ServiceComplaint> {
    const db = await getDB();
    const complaintRes = await db.query(`SELECT * FROM service_complaints WHERE id = $1`, [id]);
    if (complaintRes.rows.length === 0) {
      throw new Error('Complaint not found.');
    }
    const current = complaintRes.rows[0];

    const techRes = await db.query(`SELECT name FROM users WHERE id = $1`, [assignedToUserId]);
    if (techRes.rows.length === 0) {
      throw new Error('Technician/User not found.');
    }
    const techName = techRes.rows[0].name;

    const newStatus: ComplaintStatus = current.status === 'OPEN' ? 'ASSIGNED' : current.status;

    const updateSql = `
      UPDATE service_complaints
      SET 
        assigned_to_user_id = $1,
        assigned_to_name = $2,
        assigned_at = NOW(),
        assignment_notes = $3,
        status = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;

    const res = await db.query(updateSql, [
      assignedToUserId,
      techName,
      assignmentNotes || null,
      newStatus,
      id,
    ]);

    await db.query(
      `
      INSERT INTO service_complaint_activities (
        id, complaint_id, actor_id, actor_name, action_type, old_status, new_status, notes, created_at
      ) VALUES ($1, $2, $3, $4, 'ASSIGNED', $5, $6, $7, NOW())
    `,
      [
        crypto.randomUUID(),
        id,
        actor.id,
        actor.name,
        current.status,
        newStatus,
        `Assigned to ${techName}.${assignmentNotes ? ` Instructions: ${assignmentNotes}` : ''}`,
      ]
    );

    return res.rows[0];
  }

  /**
   * Update status and resolution details
   */
  static async updateStatus(
    id: string,
    updateData: {
      status: ComplaintStatus;
      technician_visit_date?: string | null;
      root_cause?: string | null;
      action_taken?: string | null;
      parts_replaced?: string | null;
      is_warranty_claim?: boolean;
      warranty_claim_number?: string | null;
      resolution_notes?: string | null;
      customer_rating?: number | null;
      customer_feedback?: string | null;
      notes?: string | null;
    },
    actor: User
  ): Promise<ServiceComplaint> {
    const db = await getDB();
    const complaintRes = await db.query(`SELECT * FROM service_complaints WHERE id = $1`, [id]);
    if (complaintRes.rows.length === 0) {
      throw new Error('Complaint not found.');
    }
    const current = complaintRes.rows[0];
    const oldStatus = current.status;
    const newStatus = updateData.status;

    let resolvedAt = current.resolved_at;
    let resolvedBy = current.resolved_by;
    let closedAt = current.closed_at;
    let closedBy = current.closed_by;

    if (newStatus === 'RESOLVED' && !resolvedAt) {
      resolvedAt = new Date();
      resolvedBy = actor.id;
    }

    if (newStatus === 'CLOSED' && !closedAt) {
      closedAt = new Date();
      closedBy = actor.id;
    }

    const updateSql = `
      UPDATE service_complaints
      SET 
        status = $1,
        technician_visit_date = COALESCE($2, technician_visit_date),
        root_cause = COALESCE($3, root_cause),
        action_taken = COALESCE($4, action_taken),
        parts_replaced = COALESCE($5, parts_replaced),
        is_warranty_claim = COALESCE($6, is_warranty_claim),
        warranty_claim_number = COALESCE($7, warranty_claim_number),
        resolution_notes = COALESCE($8, resolution_notes),
        customer_rating = COALESCE($9, customer_rating),
        customer_feedback = COALESCE($10, customer_feedback),
        resolved_at = $11,
        resolved_by = $12,
        closed_at = $13,
        closed_by = $14,
        updated_at = NOW()
      WHERE id = $15
      RETURNING *
    `;

    const res = await db.query(updateSql, [
      newStatus,
      updateData.technician_visit_date !== undefined ? updateData.technician_visit_date : null,
      updateData.root_cause !== undefined ? updateData.root_cause : null,
      updateData.action_taken !== undefined ? updateData.action_taken : null,
      updateData.parts_replaced !== undefined ? updateData.parts_replaced : null,
      updateData.is_warranty_claim !== undefined ? updateData.is_warranty_claim : null,
      updateData.warranty_claim_number !== undefined ? updateData.warranty_claim_number : null,
      updateData.resolution_notes !== undefined ? updateData.resolution_notes : null,
      updateData.customer_rating !== undefined ? updateData.customer_rating : null,
      updateData.customer_feedback !== undefined ? updateData.customer_feedback : null,
      resolvedAt,
      resolvedBy,
      closedAt,
      closedBy,
      id,
    ]);

    const activityNote =
      updateData.notes ||
      (newStatus === 'RESOLVED'
        ? `Issue marked resolved by ${actor.name}. Action: ${updateData.action_taken || 'Resolution verified.'}`
        : newStatus === 'CLOSED'
        ? `Ticket closed with customer satisfaction score ${updateData.customer_rating || 5}/5 stars.`
        : `Status transitioned from ${oldStatus} to ${newStatus}.`);

    await db.query(
      `
      INSERT INTO service_complaint_activities (
        id, complaint_id, actor_id, actor_name, action_type, old_status, new_status, notes, created_at
      ) VALUES ($1, $2, $3, $4, 'STATUS_CHANGE', $5, $6, $7, NOW())
    `,
      [crypto.randomUUID(), id, actor.id, actor.name, oldStatus, newStatus, activityNote]
    );

    return res.rows[0];
  }

  /**
   * Add a technical progress note to a complaint
   */
  static async addActivityNote(
    id: string,
    notes: string,
    actor: User
  ): Promise<ServiceComplaintActivity> {
    const db = await getDB();
    const actId = crypto.randomUUID();
    const res = await db.query(
      `
      INSERT INTO service_complaint_activities (
        id, complaint_id, actor_id, actor_name, action_type, notes, created_at
      ) VALUES ($1, $2, $3, $4, 'TECH_NOTE', $5, NOW())
      RETURNING *
    `,
      [actId, id, actor.id, actor.name, notes.trim()]
    );

    await db.query(`UPDATE service_complaints SET updated_at = NOW() WHERE id = $1`, [id]);
    return res.rows[0];
  }
}
