import express from 'express';
import crypto from 'crypto';
import { getDB } from '../db/index.ts';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import type {  CustomerType, FieldType  } from '../../shared/types.ts';

const router = express.Router();

const VALID_TYPES: FieldType[] = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'CURRENCY',
  'SELECT',
  'DATE',
  'BOOLEAN',
  'EMAIL',
  'PHONE',
  'URL',
];

// Get custom field definitions for customer type
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { customer_type, include_inactive } = req.query;

    if (customer_type && customer_type !== 'B2C' && customer_type !== 'B2B') {
      return res.status(400).json({ error: 'Customer type must be either B2C or B2B.' });
    }

    const db = await getDB();
    let query = 'SELECT * FROM lead_custom_field_definitions WHERE deleted_at IS NULL';
    const params: any[] = [];

    if (customer_type) {
      params.push(customer_type);
      query += ` AND customer_type = $${params.length}`;
    }

    if (include_inactive !== 'true') {
      query += ' AND active = true';
    }

    query += ' ORDER BY customer_type ASC, display_order ASC, created_at ASC';

    const result = await db.query(query, params);

    const fields = result.rows.map((row) => ({
      ...row,
      options: row.options_json ? JSON.parse(row.options_json) : [],
    }));

    res.json({ fields });
  } catch (err: any) {
    console.error('Error fetching custom fields:', err);
    res.status(500).json({ error: 'Failed to retrieve custom fields.' });
  }
});

// Create custom field definition (OWNER ONLY)
router.post('/', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res) => {
  try {
    const {
      customer_type,
      field_key,
      label,
      type,
      required_at_creation,
      required_before_yes,
      display_order,
      options,
    } = req.body;

    if (!customer_type || (customer_type !== 'B2C' && customer_type !== 'B2B')) {
      return res.status(400).json({ error: 'Customer type must be B2C or B2B.' });
    }

    if (!label || !field_key) {
      return res.status(400).json({ error: 'Field key and label are required.' });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid field type. Allowed: ${VALID_TYPES.join(', ')}` });
    }

    const cleanKey = field_key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    // Prevent overriding permanent system fields
    const permanentKeys = ['customer_name', 'mobile_number', 'customer_type', 'loan_required', 'credit_extended'];
    if (permanentKeys.includes(cleanKey)) {
      return res.status(400).json({ error: 'Cannot create field with reserved system key name.' });
    }

    const db = await getDB();
    const existing = await db.query(
      'SELECT id FROM lead_custom_field_definitions WHERE customer_type = $1 AND field_key = $2',
      [customer_type, cleanKey]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: `A field with key "${cleanKey}" already exists for ${customer_type}.` });
    }

    const id = crypto.randomUUID();
    const optionsJson = type === 'SELECT' && Array.isArray(options) ? JSON.stringify(options) : null;

    await db.query(
      `INSERT INTO lead_custom_field_definitions (
        id, customer_type, field_key, label, type, required_at_creation, required_before_yes, active, display_order, options_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, NOW(), NOW())`,
      [
        id,
        customer_type,
        cleanKey,
        label.trim(),
        type,
        Boolean(required_at_creation),
        Boolean(required_before_yes),
        Number(display_order) || 0,
        optionsJson,
      ]
    );

    const result = await db.query('SELECT * FROM lead_custom_field_definitions WHERE id = $1', [id]);
    const row = result.rows[0];
    res.status(201).json({
      field: {
        ...row,
        options: row.options_json ? JSON.parse(row.options_json) : [],
      },
    });
  } catch (err: any) {
    console.error('Error creating custom field:', err);
    res.status(500).json({ error: 'Failed to create custom field definition.' });
  }
});

// Update custom field (OWNER ONLY)
router.put('/:id', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const {
      customer_type,
      label,
      type,
      required_at_creation,
      required_before_yes,
      active,
      display_order,
      options,
    } = req.body;

    const db = await getDB();
    const existing = await db.query('SELECT * FROM lead_custom_field_definitions WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Field definition not found.' });
    }

    const updates: string[] = [];
    const params: any[] = [id];

    if (customer_type !== undefined && (customer_type === 'B2C' || customer_type === 'B2B')) {
      params.push(customer_type);
      updates.push(`customer_type = $${params.length}`);
    }

    if (label !== undefined) {
      params.push(label.trim());
      updates.push(`label = $${params.length}`);
    }

    if (type !== undefined) {
      if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({ error: 'Invalid field type.' });
      }
      params.push(type);
      updates.push(`type = $${params.length}`);
    }

    if (required_at_creation !== undefined) {
      params.push(Boolean(required_at_creation));
      updates.push(`required_at_creation = $${params.length}`);
    }

    if (required_before_yes !== undefined) {
      params.push(Boolean(required_before_yes));
      updates.push(`required_before_yes = $${params.length}`);
    }

    if (active !== undefined) {
      params.push(Boolean(active));
      updates.push(`active = $${params.length}`);
    }

    if (display_order !== undefined) {
      params.push(Number(display_order) || 0);
      updates.push(`display_order = $${params.length}`);
    }

    if (options !== undefined) {
      params.push(Array.isArray(options) ? JSON.stringify(options) : null);
      updates.push(`options_json = $${params.length}`);
    }

    updates.push('updated_at = NOW()');

    await db.query(
      `UPDATE lead_custom_field_definitions SET ${updates.join(', ')} WHERE id = $1`,
      params
    );

    const result = await db.query('SELECT * FROM lead_custom_field_definitions WHERE id = $1', [id]);
    const row = result.rows[0];
    res.json({
      field: {
        ...row,
        options: row.options_json ? JSON.parse(row.options_json) : [],
      },
    });
  } catch (err: any) {
    console.error('Error updating custom field:', err);
    res.status(500).json({ error: 'Failed to update custom field definition.' });
  }
});

// Delete custom field (OWNER ONLY)
router.delete('/:id', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const db = await getDB();

    const existing = await db.query(
      'SELECT id, label, field_key FROM lead_custom_field_definitions WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Field definition not found or already deleted.' });
    }

    const field = existing.rows[0];

    // Soft-delete to protect historical values in lead_custom_field_values
    await db.query(
      'UPDATE lead_custom_field_definitions SET active = false, deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
      [id]
    );

    res.json({ message: `Custom field "${field.label}" deleted successfully. Historical values preserved.` });
  } catch (err: any) {
    console.error('Error deleting custom field:', err);
    res.status(500).json({ error: 'Failed to delete custom field.' });
  }
});

export default router;
