import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { getDB } from '../db/index.ts';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { recordWorkflowHistory } from '../services/auditService.ts';
import { evaluateLeadDocuments, checkAndPerformHandoff } from '../services/documentService.ts';

const router = express.Router();

// Ensure documents upload directory exists
const docsUploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'ecp_documents');
if (!fs.existsSync(docsUploadDir)) {
  fs.mkdirSync(docsUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, docsUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per document
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid document format. Allowed types: PDF, JPEG, PNG, WEBP, DOC, DOCX.'));
    }
  },
});

// Helper: Lead access check
async function checkLeadAccess(leadId: string, user: any, db: any) {
  const leadRes = await db.query('SELECT * FROM leads WHERE id = $1', [leadId]);
  if (leadRes.rows.length === 0) {
    return { error: 'Lead not found', status: 404 };
  }
  const lead = leadRes.rows[0];

  if (user.role === 'LEAD' && lead.owner_id !== user.id) {
    return { error: 'Forbidden: You do not have access to this lead.', status: 403 };
  }
  return { lead };
}

// ============================================================================
// OWNER MASTER CONFIGURATION: DOCUMENT DEFINITIONS
// ============================================================================

router.get('/definitions', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const db = await getDB();
    const customerType = req.query.customer_type as string;
    let query = 'SELECT * FROM document_definitions';
    const params: any[] = [];

    if (customerType) {
      query += ' WHERE customer_type = $1 OR customer_type = $2';
      params.push(customerType, 'BOTH');
    }
    query += ' ORDER BY code ASC, name ASC';

    const result = await db.query(query, params);
    res.json({ definitions: result.rows });
  } catch (err: any) {
    console.error('Error fetching document definitions:', err);
    res.status(500).json({ error: 'Failed to fetch document definitions.' });
  }
});

router.post('/definitions', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res) => {
  try {
    const { code, name, description, customer_type } = req.body;
    if (!code || !name || !customer_type) {
      return res.status(400).json({ error: 'Code, Name, and Customer Type are required.' });
    }

    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '_');
    const db = await getDB();

    const id = crypto.randomUUID();
    const result = await db.query(
      `INSERT INTO document_definitions (id, code, name, description, customer_type, active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [id, cleanCode, name.trim(), description?.trim() || null, customer_type]
    );

    res.status(201).json({ definition: result.rows[0] });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A document definition with this code already exists.' });
    }
    console.error('Error creating document definition:', err);
    res.status(500).json({ error: 'Failed to create document definition.' });
  }
});

router.put('/definitions/:id', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { name, description, active, customer_type } = req.body;

    const db = await getDB();
    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];

    if (name !== undefined) {
      params.push(name.trim());
      updates.push(`name = $${params.length}`);
    }
    if (description !== undefined) {
      params.push(description?.trim() || null);
      updates.push(`description = $${params.length}`);
    }
    if (active !== undefined) {
      params.push(Boolean(active));
      updates.push(`active = $${params.length}`);
    }
    if (customer_type !== undefined) {
      params.push(customer_type);
      updates.push(`customer_type = $${params.length}`);
    }

    const result = await db.query(
      `UPDATE document_definitions SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document definition not found.' });
    }

    res.json({ definition: result.rows[0] });
  } catch (err: any) {
    console.error('Error updating document definition:', err);
    res.status(500).json({ error: 'Failed to update document definition.' });
  }
});

// ============================================================================
// OWNER MASTER CONFIGURATION: REQUIREMENT RULES
// ============================================================================

router.get('/rules', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const db = await getDB();
    const customerType = req.query.customer_type as string;

    let query = 'SELECT * FROM document_requirement_rules';
    const params: any[] = [];

    if (customerType) {
      query += ' WHERE customer_type = $1 OR customer_type = $2';
      params.push(customerType, 'BOTH');
    }
    query += ' ORDER BY display_order ASC, created_at ASC';

    const rulesRes = await db.query(query, params);

    // Fetch member items for each rule
    const rules = [];
    for (const rule of rulesRes.rows) {
      const itemsRes = await db.query(
        `SELECT dri.*, dd.code as document_code, dd.name as document_name, dd.active as definition_active
         FROM document_rule_items dri
         JOIN document_definitions dd ON dri.document_definition_id = dd.id
         WHERE dri.rule_id = $1
         ORDER BY dri.created_at ASC`,
        [rule.id]
      );
      rules.push({
        ...rule,
        items: itemsRes.rows,
      });
    }

    res.json({ rules });
  } catch (err: any) {
    console.error('Error fetching requirement rules:', err);
    res.status(500).json({ error: 'Failed to fetch requirement rules.' });
  }
});

router.post('/rules', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res) => {
  try {
    const {
      rule_name,
      description,
      customer_type,
      requirement_type,
      condition_type = 'ALWAYS',
      condition_field_key = null,
      condition_expected_value = null,
      document_definition_ids = [],
      display_order = 0,
    } = req.body;

    if (!rule_name || !customer_type || !requirement_type) {
      return res.status(400).json({
        error: 'Rule Name, Customer Type, and Requirement Type are required.',
      });
    }

    if (!Array.isArray(document_definition_ids) || document_definition_ids.length === 0) {
      return res.status(400).json({
        error: 'At least one document definition must be attached to the requirement rule.',
      });
    }

    if (requirement_type === 'INDIVIDUAL' && document_definition_ids.length !== 1) {
      return res.status(400).json({
        error: 'An INDIVIDUAL requirement rule must link to exactly 1 document definition.',
      });
    }

    const db = await getDB();
    const ruleId = crypto.randomUUID();

    await db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO document_requirement_rules 
         (id, rule_name, description, customer_type, requirement_type, condition_type, 
          condition_field_key, condition_expected_value, active, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)`,
        [
          ruleId,
          rule_name.trim(),
          description?.trim() || null,
          customer_type,
          requirement_type,
          condition_type,
          condition_field_key?.trim() || null,
          condition_expected_value?.trim() || null,
          Number(display_order) || 0,
        ]
      );

      for (const defId of document_definition_ids) {
        const itemId = crypto.randomUUID();
        await tx.query(
          `INSERT INTO document_rule_items (id, rule_id, document_definition_id)
           VALUES ($1, $2, $3)`,
          [itemId, ruleId, defId]
        );
      }
    });

    res.status(201).json({ success: true, rule_id: ruleId });
  } catch (err: any) {
    console.error('Error creating requirement rule:', err);
    res.status(500).json({ error: err.message || 'Failed to create requirement rule.' });
  }
});

router.put('/rules/:id', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const {
      rule_name,
      description,
      customer_type,
      requirement_type,
      condition_type,
      condition_field_key,
      condition_expected_value,
      document_definition_ids,
      active,
      display_order,
    } = req.body;

    const db = await getDB();

    await db.transaction(async (tx) => {
      const updates: string[] = ['updated_at = NOW()'];
      const params: any[] = [id];

      if (rule_name !== undefined) {
        params.push(rule_name.trim());
        updates.push(`rule_name = $${params.length}`);
      }
      if (description !== undefined) {
        params.push(description?.trim() || null);
        updates.push(`description = $${params.length}`);
      }
      if (customer_type !== undefined) {
        params.push(customer_type);
        updates.push(`customer_type = $${params.length}`);
      }
      if (requirement_type !== undefined) {
        params.push(requirement_type);
        updates.push(`requirement_type = $${params.length}`);
      }
      if (condition_type !== undefined) {
        params.push(condition_type);
        updates.push(`condition_type = $${params.length}`);
      }
      if (condition_field_key !== undefined) {
        params.push(condition_field_key?.trim() || null);
        updates.push(`condition_field_key = $${params.length}`);
      }
      if (condition_expected_value !== undefined) {
        params.push(condition_expected_value?.trim() || null);
        updates.push(`condition_expected_value = $${params.length}`);
      }
      if (active !== undefined) {
        params.push(Boolean(active));
        updates.push(`active = $${params.length}`);
      }
      if (display_order !== undefined) {
        params.push(Number(display_order));
        updates.push(`display_order = $${params.length}`);
      }

      await tx.query(
        `UPDATE document_requirement_rules SET ${updates.join(', ')} WHERE id = $1`,
        params
      );

      // If document definitions provided, update junction table
      if (Array.isArray(document_definition_ids)) {
        await tx.query('DELETE FROM document_rule_items WHERE rule_id = $1', [id]);
        for (const defId of document_definition_ids) {
          const itemId = crypto.randomUUID();
          await tx.query(
            `INSERT INTO document_rule_items (id, rule_id, document_definition_id)
             VALUES ($1, $2, $3)`,
            [itemId, id, defId]
          );
        }
      }
    });

    res.json({ success: true, message: 'Rule updated.' });
  } catch (err: any) {
    console.error('Error updating requirement rule:', err);
    res.status(500).json({ error: err.message || 'Failed to update requirement rule.' });
  }
});

// ============================================================================
// LEAD DOCUMENT WORKSPACE & CHECKLIST
// ============================================================================

// Get checklist and evaluation for a lead
router.get('/leads/:leadId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { leadId } = req.params;
    const db = await getDB();
    const access = await checkLeadAccess(leadId, req.user, db);
    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    const checklist = await evaluateLeadDocuments(leadId, db);
    res.json({ checklist });
  } catch (err: any) {
    console.error('Error fetching lead document checklist:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch document checklist.' });
  }
});

// Upload document for a lead
router.post(
  '/leads/:leadId/upload',
  requireAuth,
  upload.single('file') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { leadId } = req.params;
      const { document_definition_id, rule_id } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No document file uploaded.' });
      }

      if (!document_definition_id) {
        // Clean up file if validation fails
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: 'Document definition ID is required.' });
      }

      const db = await getDB();
      const access = await checkLeadAccess(leadId, req.user, db);
      if (access.error) {
        fs.unlinkSync(file.path);
        return res.status(access.status).json({ error: access.error });
      }
      const lead = access.lead;

      // Workflow validation:
      // Lead Team users can upload if lead is QUALIFIED and still in LEAD team (or documentation_status is PENDING)
      if (lead.current_team !== 'LEAD') {
        fs.unlinkSync(file.path);
        return res.status(403).json({
          error: `Cannot upload documents: Lead has already progressed to ${lead.current_team}. Document modification is locked.`,
        });
      }

      // Verify document definition
      const defRes = await db.query(
        'SELECT * FROM document_definitions WHERE id = $1',
        [document_definition_id]
      );
      if (defRes.rows.length === 0) {
        fs.unlinkSync(file.path);
        return res.status(404).json({ error: 'Document definition not found.' });
      }
      const def = defRes.rows[0];

      const docId = crypto.randomUUID();

      // Transactional insert & gate evaluation
      let handoffResult: any = { handed_off: false };

      await db.transaction(async (tx) => {
        await tx.query(
          `INSERT INTO lead_documents 
           (id, lead_id, document_definition_id, rule_id, original_name, stored_file_name, 
            file_path, mime_type, file_size, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            docId,
            leadId,
            document_definition_id,
            rule_id || null,
            file.originalname,
            file.filename,
            file.path,
            file.mimetype,
            file.size,
            req.user!.id,
          ]
        );

        // Record workflow history
        await recordWorkflowHistory(tx, {
          leadId,
          actorId: req.user!.id,
          actorName: req.user!.name,
          eventType: 'DOCUMENT_UPLOADED',
          previousState: lead.status,
          newState: lead.status,
          remarks: `Uploaded document: ${def.name} (${file.originalname})`,
          metadata: {
            document_id: docId,
            document_code: def.code,
            document_name: def.name,
            file_size: file.size,
          },
        });

        // Check gate and execute auto-handoff if complete
        handoffResult = await checkAndPerformHandoff(leadId, req.user!.id, req.user!.name, tx);
      });

      res.status(201).json({
        success: true,
        document_id: docId,
        handed_off: handoffResult.handed_off,
        checklist: handoffResult.checklist,
      });
    } catch (err: any) {
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (_) {}
      }
      console.error('Error uploading lead document:', err);
      res.status(500).json({ error: err.message || 'Failed to upload document.' });
    }
  }
);

// Delete/Replace document (Allowed only while still in LEAD team)
router.delete('/leads/:leadId/:docId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { leadId, docId } = req.params;
    const db = await getDB();
    const access = await checkLeadAccess(leadId, req.user, db);
    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }
    const lead = access.lead;

    // Check if lead has already been handed off to Registration
    if (lead.current_team !== 'LEAD') {
      return res.status(403).json({
        error: `Cannot delete document: Lead has already progressed to ${lead.current_team}. Document modification is locked.`,
      });
    }

    const docRes = await db.query(
      `SELECT ld.*, dd.name as doc_name, dd.code as doc_code 
       FROM lead_documents ld
       JOIN document_definitions dd ON ld.document_definition_id = dd.id
       WHERE ld.id = $1 AND ld.lead_id = $2 AND ld.deleted_at IS NULL`,
      [docId, leadId]
    );

    if (docRes.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found or already deleted.' });
    }
    const doc = docRes.rows[0];

    // Soft-delete document to preserve audit trail
    await db.transaction(async (tx) => {
      await tx.query(
        `UPDATE lead_documents 
         SET deleted_at = NOW(), deleted_by = $1 
         WHERE id = $2`,
        [req.user!.id, docId]
      );

      await recordWorkflowHistory(tx, {
        leadId,
        actorId: req.user!.id,
        actorName: req.user!.name,
        eventType: 'DOCUMENT_DELETED',
        previousState: lead.status,
        newState: lead.status,
        remarks: `Removed document: ${doc.doc_name} (${doc.original_name})`,
        metadata: {
          document_id: docId,
          document_code: doc.doc_code,
          document_name: doc.doc_name,
        },
      });
    });

    const checklist = await evaluateLeadDocuments(leadId, db);
    res.json({ success: true, checklist });
  } catch (err: any) {
    console.error('Error deleting lead document:', err);
    res.status(500).json({ error: err.message || 'Failed to delete document.' });
  }
});

// Download/View document file securely
router.get('/leads/:leadId/:docId/file', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { leadId, docId } = req.params;
    const db = await getDB();
    const access = await checkLeadAccess(leadId, req.user, db);
    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    const docRes = await db.query(
      'SELECT * FROM lead_documents WHERE id = $1 AND lead_id = $2 AND deleted_at IS NULL',
      [docId, leadId]
    );

    if (docRes.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found or has been removed.' });
    }
    const doc = docRes.rows[0];

    if (!fs.existsSync(doc.file_path)) {
      return res.status(404).json({ error: 'Document file not found on disk.' });
    }

    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(doc.original_name)}"`
    );
    res.sendFile(path.resolve(doc.file_path));
  } catch (err: any) {
    console.error('Error downloading lead document:', err);
    res.status(500).json({ error: 'Failed to access document file.' });
  }
});

export default router;
