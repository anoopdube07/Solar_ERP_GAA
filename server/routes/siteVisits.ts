import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { getDB } from '../db/index.js';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { recordWorkflowHistory } from '../services/auditService.js';

const router = express.Router();

// Configure photo upload storage
const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'site_visits');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per image
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP) are allowed.'));
    }
  },
});

// 1. GET /api/site-visits - Scoped List
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const db = await getDB();
    const { status, lead_id } = req.query;

    let query = `
      SELECT sv.*,
             l.customer_name as lead_customer_name,
             l.mobile_number as lead_mobile_number,
             l.address as lead_address,
             l.location as lead_location,
             l.location_link as lead_location_link,
             l.project_installation_location,
             l.owner_id as lead_owner_id,
             u_req.name as requesting_user_name,
             u_assigned.name as assigned_member_name,
             u_assigned_by.name as assigned_by_name
      FROM site_visits sv
      JOIN leads l ON sv.lead_id = l.id
      JOIN users u_req ON sv.requesting_user_id = u_req.id
      LEFT JOIN users u_assigned ON sv.assigned_member_id = u_assigned.id
      LEFT JOIN users u_assigned_by ON sv.assigned_by_id = u_assigned_by.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Role-based scoping:
    // INSTALLATION_MEMBER can only see site visits assigned directly to them
    if (user.role === 'INSTALLATION_MEMBER') {
      params.push(user.id);
      query += ` AND sv.assigned_member_id = $${params.length}`;
    } else if (user.role === 'LEAD') {
      // Lead can only see site visits for their own leads (assigned to or created by them)
      params.push(user.id);
      query += ` AND (l.owner_id = $${params.length} OR l.created_by = $${params.length})`;
    }

    if (status) {
      params.push(status);
      query += ` AND sv.status = $${params.length}`;
    }

    if (lead_id) {
      params.push(lead_id);
      query += ` AND sv.lead_id = $${params.length}`;
    }

    query += ` ORDER BY sv.created_at DESC`;

    const result = await db.query(query, params);
    const siteVisitsWithPhotos = [];
    for (const sv of result.rows) {
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
    res.json({ site_visits: siteVisitsWithPhotos });
  } catch (err: any) {
    console.error('Error fetching site visits:', err);
    res.status(500).json({ error: 'Failed to retrieve site visits.' });
  }
});

// 2. POST /api/site-visits - Request Site Visit (B2C ONLY)
router.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { lead_id, notes } = req.body;

    if (!lead_id) {
      return res.status(400).json({ error: 'Lead ID is required.' });
    }

    const db = await getDB();
    const leadRes = await db.query('SELECT * FROM leads WHERE id = $1', [lead_id]);
    if (leadRes.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const lead = leadRes.rows[0];

    // Check customer type: B2C ONLY
    if (lead.customer_type !== 'B2C') {
      return res.status(400).json({ error: 'Site visits are only supported for B2C Leads.' });
    }

    // Authorization check: Only assigned/reassigned lead team user (or OWNER) can request a Site Visit
    const isAssignedLeadUser = user.id === lead.owner_id;
    const isOwner = user.role === 'OWNER';
    if (!isAssignedLeadUser && !isOwner) {
      return res.status(403).json({
        error: 'Only the respective assigned/reassigned lead team user can request a Site Visit for this lead. Other team users have view rights only.',
      });
    }

    // Check for existing open site visit
    const openCheck = await db.query(
      `SELECT id, status FROM site_visits WHERE lead_id = $1 AND status != 'COMPLETED'`,
      [lead_id]
    );
    if (openCheck.rows.length > 0) {
      return res.status(400).json({
        error: 'A Site Visit is already pending or in progress for this Lead.',
      });
    }

    const siteVisitId = crypto.randomUUID();

    await db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO site_visits (
          id, lead_id, requesting_user_id, status, notes, created_at, updated_at
        ) VALUES ($1, $2, $3, 'PENDING_ASSIGNMENT', $4, NOW(), NOW())`,
        [siteVisitId, lead_id, user.id, notes ? notes.trim() : null]
      );

      // Transition Lead: SITE_VISIT_PENDING, INSTALLATION_MANAGER, ACTION REQUIRED = TRUE
      await tx.query(
        `UPDATE leads SET
          status = 'SITE_VISIT_PENDING',
          current_team = 'INSTALLATION_MANAGER',
          action_required = true,
          updated_at = NOW()
        WHERE id = $1`,
        [lead_id]
      );

      await recordWorkflowHistory(tx, {
        leadId: lead_id,
        actorId: user.id,
        actorName: user.name,
        eventType: 'Site Visit Requested',
        previousState: lead.status,
        newState: 'SITE_VISIT_PENDING',
        remarks: notes ? `Site Visit requested: ${notes}` : 'Site Visit requested for B2C Lead',
      });
    });

    const createdRes = await db.query('SELECT * FROM site_visits WHERE id = $1', [siteVisitId]);
    res.status(201).json({
      message: 'Site Visit requested successfully.',
      site_visit: createdRes.rows[0],
    });
  } catch (err: any) {
    console.error('Error requesting site visit:', err);
    res.status(500).json({ error: 'Failed to request site visit.' });
  }
});

// 3. POST /api/site-visits/:id/assign - Assign or Reassign Site Visit (INSTALLATION_MANAGER, OWNER)
router.post(
  '/:id/assign',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      // Site Visit cannot be assigned by lead team, only installation team manager has the right to assign the leads marked as site visit to installation team members.
      if (user.role === 'LEAD') {
        return res.status(403).json({
          error: 'Site Visit cannot be assigned by lead team. Only Installation Team Manager has the right to assign the leads marked as site visit to installation team members.',
        });
      }

      if (user.role !== 'INSTALLATION_MANAGER' && user.role !== 'OWNER') {
        return res.status(403).json({
          error: 'Only Installation Team Manager has the right to assign leads marked as site visit to installation team members.',
        });
      }

      const { assigned_member_id, notes, scheduled_date } = req.body;

      if (!assigned_member_id) {
        return res.status(400).json({ error: 'Assigned Installation Member is required.' });
      }

      const db = await getDB();
      const svRes = await db.query('SELECT * FROM site_visits WHERE id = $1', [id]);
      if (svRes.rows.length === 0) {
        return res.status(404).json({ error: 'Site Visit not found.' });
      }

      const siteVisit = svRes.rows[0];

      if (siteVisit.status === 'COMPLETED') {
        return res.status(400).json({ error: 'Completed Site Visits cannot be reassigned.' });
      }

      // Verify target user is active and has INSTALLATION_MEMBER role
      const memberRes = await db.query('SELECT * FROM users WHERE id = $1', [assigned_member_id]);
      if (memberRes.rows.length === 0) {
        return res.status(404).json({ error: 'Assigned user not found.' });
      }

      const member = memberRes.rows[0];
      if (!member.active) {
        return res.status(400).json({ error: 'Cannot assign Site Visit to an inactive user.' });
      }

      if (member.role !== 'INSTALLATION_MEMBER') {
        return res.status(400).json({ error: 'Target user must have the INSTALLATION_MEMBER role.' });
      }

      const isReassignment = Boolean(siteVisit.assigned_member_id);

      await db.transaction(async (tx) => {
        await tx.query(
          `UPDATE site_visits SET
            assigned_member_id = $1,
            assigned_by_id = $2,
            status = 'ASSIGNED',
            notes = COALESCE($3, notes),
            scheduled_date = COALESCE($4, scheduled_date),
            updated_at = NOW()
          WHERE id = $5`,
          [assigned_member_id, user.id, notes ? notes.trim() : null, scheduled_date || null, id]
        );

        // Lead current_team becomes INSTALLATION_TEAM
        await tx.query(
          `UPDATE leads SET
            current_team = 'INSTALLATION_TEAM',
            action_required = true,
            updated_at = NOW()
          WHERE id = $1`,
          [siteVisit.lead_id]
        );

        await recordWorkflowHistory(tx, {
          leadId: siteVisit.lead_id,
          actorId: user.id,
          actorName: user.name,
          eventType: isReassignment ? 'Site Visit Reassigned' : 'Site Visit Assigned',
          previousState: siteVisit.status,
          newState: 'ASSIGNED',
          remarks: `${isReassignment ? 'Reassigned' : 'Assigned'} to ${member.name} by ${user.name}`,
          metadata: {
            site_visit_id: id,
            assigned_member_id,
            assigned_member_name: member.name,
          },
        });
      });

      res.json({
        message: `Site Visit successfully assigned to ${member.name}.`,
        assigned_member_id,
        assigned_member_name: member.name,
      });
    } catch (err: any) {
      console.error('Error assigning site visit:', err);
      res.status(500).json({ error: 'Failed to assign site visit.' });
    }
  }
);

// 4. POST /api/site-visits/:id/complete - Complete Site Visit with Photos & Specs
router.post(
  '/:id/complete',
  requireAuth,
  upload.array('photos', 10) as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const {
        completion_details,
        notes,
        structure_height,
        earthing_cable_length,
        dc_cable_length,
        ac_cable_length,
        extra_materials,
        geo_latitude,
        geo_longitude,
        geo_address,
        photo_captured_with_owner,
      } = req.body;

      const db = await getDB();
      const svRes = await db.query('SELECT * FROM site_visits WHERE id = $1', [id]);
      if (svRes.rows.length === 0) {
        return res.status(404).json({ error: 'Site Visit not found.' });
      }

      const siteVisit = svRes.rows[0];

      if (siteVisit.status === 'COMPLETED') {
        return res.status(400).json({ error: 'This Site Visit has already been completed.' });
      }

      // Authorization: Only the assigned installation member (or Installation Manager / Owner) can complete
      const allowedCompleteRoles = ['INSTALLATION_MEMBER', 'INSTALLATION_MANAGER', 'OWNER'];
      if (!allowedCompleteRoles.includes(user.role)) {
        return res.status(403).json({
          error: 'Access denied: Only installation team members or managers can complete site feasibility surveys.',
        });
      }

      if (user.role === 'INSTALLATION_MEMBER' && siteVisit.assigned_member_id !== user.id) {
        return res.status(403).json({
          error: 'Access denied: You are not the assigned team member for this Site Visit on a need-to-know basis.',
        });
      }

      if (!completion_details || !completion_details.trim()) {
        return res.status(400).json({ error: 'Completion details and technical notes are required.' });
      }

      const files = (req.files as Express.Multer.File[]) || [];
      if (files.length > 3) {
        return res.status(400).json({
          error: 'Maximum 3 photos can be uploaded for site survey (Geo-tagged photo with owner).',
        });
      }

      let extraMaterialsJson: string | null = null;
      if (extra_materials) {
        try {
          const parsed = typeof extra_materials === 'string' ? JSON.parse(extra_materials) : extra_materials;
          if (Array.isArray(parsed)) {
            const sanitized = parsed
              .map((item: any) => ({
                name: String(item.name || '').trim(),
                quantity: Number(item.quantity) || 1,
                uom: String(item.uom || 'Nos').trim(),
              }))
              .filter((item: any) => item.name.length > 0);
            extraMaterialsJson = JSON.stringify(sanitized);
          }
        } catch (e) {
          extraMaterialsJson = null;
        }
      }

      const parsedLat = geo_latitude ? parseFloat(geo_latitude) : null;
      const parsedLng = geo_longitude ? parseFloat(geo_longitude) : null;
      const isWithOwner = photo_captured_with_owner === true || photo_captured_with_owner === 'true';

      await db.transaction(async (tx) => {
        // Save uploaded photos (max 3)
        for (const file of files) {
          const photoId = crypto.randomUUID();
          await tx.query(
            `INSERT INTO site_visit_photos (
              id, site_visit_id, uploader_id, file_path, original_name, mime_type, size_bytes, latitude, longitude, is_with_owner, uploaded_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
            [
              photoId,
              id,
              user.id,
              file.path,
              file.originalname,
              file.mimetype,
              file.size,
              parsedLat,
              parsedLng,
              isWithOwner,
            ]
          );
        }

        // Update Site Visit with technical specs
        await tx.query(
          `UPDATE site_visits SET
            status = 'COMPLETED',
            completion_details = $1,
            notes = COALESCE($2, notes),
            structure_height = $3,
            earthing_cable_length = $4,
            dc_cable_length = $5,
            ac_cable_length = $6,
            extra_materials_json = $7,
            geo_latitude = $8,
            geo_longitude = $9,
            geo_address = $10,
            photo_captured_with_owner = $11,
            completed_at = NOW(),
            updated_at = NOW()
          WHERE id = $12`,
          [
            completion_details.trim(),
            notes ? notes.trim() : null,
            structure_height ? structure_height.trim() : null,
            earthing_cable_length ? earthing_cable_length.trim() : null,
            dc_cable_length ? dc_cable_length.trim() : null,
            ac_cable_length ? ac_cable_length.trim() : null,
            extraMaterialsJson,
            parsedLat,
            parsedLng,
            geo_address ? geo_address.trim() : null,
            isWithOwner,
            id,
          ]
        );

        // Transition Lead back to PENDING, CURRENT TEAM = LEAD, ACTION REQUIRED = TRUE
        await tx.query(
          `UPDATE leads SET
            status = 'PENDING',
            current_team = 'LEAD',
            action_required = true,
            updated_at = NOW()
          WHERE id = $1`,
          [siteVisit.lead_id]
        );

        const summaryParts = [];
        if (structure_height) summaryParts.push(`Height: ${structure_height}`);
        if (earthing_cable_length) summaryParts.push(`Earthing: ${earthing_cable_length}`);
        if (dc_cable_length) summaryParts.push(`DC: ${dc_cable_length}`);
        if (ac_cable_length) summaryParts.push(`AC: ${ac_cable_length}`);

        await recordWorkflowHistory(tx, {
          leadId: siteVisit.lead_id,
          actorId: user.id,
          actorName: user.name,
          eventType: 'Site Visit Completed',
          previousState: 'SITE_VISIT_PENDING',
          newState: 'PENDING',
          remarks: `Site Visit completed by ${user.name} (${files.length} geo-tagged photos uploaded). ${summaryParts.length > 0 ? `[${summaryParts.join(', ')}] ` : ''}${completion_details}`,
          metadata: {
            site_visit_id: id,
            structure_height,
            earthing_cable_length,
            dc_cable_length,
            ac_cable_length,
            photos_count: files.length,
            geo_latitude: parsedLat,
            geo_longitude: parsedLng,
            photo_captured_with_owner: isWithOwner,
            extra_materials: extraMaterialsJson ? JSON.parse(extraMaterialsJson) : [],
          },
        });
      });

      res.json({
        message: 'Site Visit marked as completed. Lead has returned to Lead Team with technical specifications.',
        status: 'COMPLETED',
      });
    } catch (err: any) {
      console.error('Error completing site visit:', err);
      res.status(500).json({ error: err.message || 'Failed to complete site visit.' });
    }
  }
);

// 5. GET /api/site-visits/photos/:photoId - Secure Photo Serving
router.get('/photos/:photoId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { photoId } = req.params;
    const db = await getDB();

    const photoRes = await db.query(
      `SELECT sp.*, sv.lead_id, l.owner_id as lead_owner_id
       FROM site_visit_photos sp
       JOIN site_visits sv ON sp.site_visit_id = sv.id
       JOIN leads l ON sv.lead_id = l.id
       WHERE sp.id = $1`,
      [photoId]
    );

    if (photoRes.rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found.' });
    }

    const photo = photoRes.rows[0];

    // Authorization: If LEAD role, must be lead owner
    if (req.user?.role === 'LEAD' && photo.lead_owner_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to view this photo.' });
    }

    if (!fs.existsSync(photo.file_path)) {
      return res.status(404).json({ error: 'Photo file missing on disk.' });
    }

    res.setHeader('Content-Type', photo.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${photo.original_name}"`);
    fs.createReadStream(photo.file_path).pipe(res);
  } catch (err: any) {
    console.error('Error streaming photo:', err);
    res.status(500).json({ error: 'Failed to retrieve photo.' });
  }
});

export default router;
