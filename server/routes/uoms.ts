import express from 'express';
import crypto from 'crypto';
import { getDB } from '../db/index.ts';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth.ts';

const router = express.Router();

// Get UOMs
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const db = await getDB();
    const isOwnerOrManager = req.user?.role === 'OWNER' || req.user?.role === 'MANAGER';
    const { include_inactive, active } = req.query;

    let query = 'SELECT id, COALESCE(code, name) as code, name, description, active, created_at, deleted_at FROM uoms WHERE deleted_at IS NULL';
    const params: any[] = [];

    if (active !== undefined && active !== 'ALL' && active !== '') {
      params.push(active === 'true');
      query += ` AND active = $${params.length}`;
    } else if (!isOwnerOrManager || include_inactive !== 'true') {
      query += ' AND active = true';
    }
    query += ' ORDER BY name ASC';

    const result = await db.query(query, params);
    res.json({ uoms: result.rows });
  } catch (err: any) {
    console.error('Error fetching UOMs:', err);
    res.status(500).json({ error: 'Failed to retrieve UOMs.' });
  }
});

// Create UOM (OWNER ONLY)
router.post('/', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, code, description } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'UOM Name is required.' });
    }

    const cleanName = name.trim();
    const cleanCode = code && typeof code === 'string' && code.trim() ? code.trim() : cleanName;

    const db = await getDB();

    const existing = await db.query('SELECT id FROM uoms WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL', [
      cleanName,
    ]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'A UOM with this name already exists.' });
    }

    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO uoms (id, code, name, description, active, created_at)
       VALUES ($1, $2, $3, $4, true, NOW())`,
      [id, cleanCode, cleanName, description ? description.trim() : null]
    );

    const result = await db.query('SELECT id, COALESCE(code, name) as code, name, description, active, created_at FROM uoms WHERE id = $1', [id]);
    res.status(201).json({ uom: result.rows[0] });
  } catch (err: any) {
    console.error('Error creating UOM:', err);
    res.status(500).json({ error: 'Failed to create UOM.' });
  }
});

// Update UOM (OWNER ONLY)
router.put('/:id', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, active } = req.body;

    const db = await getDB();
    const existing = await db.query('SELECT id FROM uoms WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'UOM not found.' });
    }

    const updates: string[] = [];
    const params: any[] = [id];

    if (name !== undefined) {
      params.push(name.trim());
      updates.push(`name = $${params.length}`);
    }

    if (code !== undefined) {
      params.push(code ? code.trim() : null);
      updates.push(`code = $${params.length}`);
    }

    if (description !== undefined) {
      params.push(description ? description.trim() : null);
      updates.push(`description = $${params.length}`);
    }

    if (active !== undefined) {
      params.push(Boolean(active));
      updates.push(`active = $${params.length}`);
    }

    if (updates.length > 0) {
      await db.query(`UPDATE uoms SET ${updates.join(', ')} WHERE id = $1`, params);
    }

    const updatedRes = await db.query('SELECT id, COALESCE(code, name) as code, name, description, active, created_at FROM uoms WHERE id = $1', [id]);
    res.json({ uom: updatedRes.rows[0] });
  } catch (err: any) {
    console.error('Error updating UOM:', err);
    res.status(500).json({ error: 'Failed to update UOM.' });
  }
});

// Delete UOM (OWNER ONLY)
router.delete('/:id', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const db = await getDB();
    const uomRes = await db.query('SELECT * FROM uoms WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (uomRes.rows.length === 0) {
      return res.status(404).json({ error: 'UOM not found or already deleted.' });
    }

    const uom = uomRes.rows[0];

    // Soft delete to protect past quotations
    await db.query('UPDATE uoms SET active = false, deleted_at = NOW() WHERE id = $1', [id]);

    res.json({
      message: `UOM "${uom.name}" deleted successfully. Historical records preserved.`,
    });
  } catch (err: any) {
    console.error('Error deleting UOM:', err);
    res.status(500).json({ error: 'Failed to delete UOM.' });
  }
});

export default router;
