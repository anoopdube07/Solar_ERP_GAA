import express from 'express';
import crypto from 'crypto';
import { getDB } from '../db/index.js';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get UOMs
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const db = await getDB();
    const isOwnerOrManager = req.user?.role === 'OWNER' || req.user?.role === 'MANAGER';
    const { include_inactive } = req.query;

    let query = 'SELECT * FROM uoms';
    if (!isOwnerOrManager || include_inactive !== 'true') {
      query += ' WHERE active = true';
    }
    query += ' ORDER BY name ASC';

    const result = await db.query(query);
    res.json({ uoms: result.rows });
  } catch (err: any) {
    console.error('Error fetching UOMs:', err);
    res.status(500).json({ error: 'Failed to retrieve UOMs.' });
  }
});

// Create UOM (OWNER ONLY)
router.post('/', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'UOM Name is required.' });
    }

    const db = await getDB();

    const existing = await db.query('SELECT id FROM uoms WHERE LOWER(name) = LOWER($1)', [
      name.trim(),
    ]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'A UOM with this name already exists.' });
    }

    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO uoms (id, name, description, active, created_at)
       VALUES ($1, $2, $3, true, NOW())`,
      [id, name.trim(), description ? description.trim() : null]
    );

    const result = await db.query('SELECT * FROM uoms WHERE id = $1', [id]);
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
    const { name, description, active } = req.body;

    const db = await getDB();
    const existing = await db.query('SELECT id FROM uoms WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'UOM not found.' });
    }

    const updates: string[] = [];
    const params: any[] = [id];

    if (name !== undefined) {
      params.push(name.trim());
      updates.push(`name = $${params.length}`);
    }

    if (description !== undefined) {
      params.push(description ? description.trim() : null);
      updates.push(`description = $${params.length}`);
    }

    if (active !== undefined) {
      params.push(Boolean(active));
      updates.push(`active = $${params.length}`);
    }

    await db.query(`UPDATE uoms SET ${updates.join(', ')} WHERE id = $1`, params);

    const updatedRes = await db.query('SELECT * FROM uoms WHERE id = $1', [id]);
    res.json({ uom: updatedRes.rows[0] });
  } catch (err: any) {
    console.error('Error updating UOM:', err);
    res.status(500).json({ error: 'Failed to update UOM.' });
  }
});

export default router;
