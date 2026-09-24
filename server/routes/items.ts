import express from 'express';
import crypto from 'crypto';
import { getDB } from '../db/index.ts';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth.ts';

const router = express.Router();

// Get items: Owner/Manager see all; Lead users see active items only
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const db = await getDB();
    const isOwnerOrManager = req.user?.role === 'OWNER' || req.user?.role === 'MANAGER';
    const { include_inactive } = req.query;

    let query = 'SELECT * FROM items';
    if (!isOwnerOrManager || include_inactive !== 'true') {
      query += ' WHERE active = true';
    }
    query += ' ORDER BY name ASC';

    const result = await db.query(query);
    res.json({ items: result.rows });
  } catch (err: any) {
    console.error('Error fetching items:', err);
    res.status(500).json({ error: 'Failed to retrieve items.' });
  }
});

// Create item (OWNER ONLY)
router.post('/', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description, rate, default_uom } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Item Name is required.' });
    }

    const numericRate = Math.max(0, Number(rate) || 0);
    const db = await getDB();
    const id = crypto.randomUUID();

    await db.query(
      `INSERT INTO items (id, name, description, rate, default_uom, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
      [id, name.trim(), description ? description.trim() : null, numericRate, default_uom || null]
    );

    const result = await db.query('SELECT * FROM items WHERE id = $1', [id]);
    res.status(201).json({ item: result.rows[0] });
  } catch (err: any) {
    console.error('Error creating item:', err);
    res.status(500).json({ error: 'Failed to create item.' });
  }
});

// Update item (OWNER ONLY)
router.put('/:id', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { name, description, rate, default_uom, active } = req.body;

    const db = await getDB();
    const itemRes = await db.query('SELECT id FROM items WHERE id = $1', [id]);
    if (itemRes.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found.' });
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

    if (rate !== undefined) {
      params.push(Math.max(0, Number(rate) || 0));
      updates.push(`rate = $${params.length}`);
    }

    if (default_uom !== undefined) {
      params.push(default_uom || null);
      updates.push(`default_uom = $${params.length}`);
    }

    if (active !== undefined) {
      params.push(Boolean(active));
      updates.push(`active = $${params.length}`);
    }

    updates.push('updated_at = NOW()');

    await db.query(`UPDATE items SET ${updates.join(', ')} WHERE id = $1`, params);

    const updatedRes = await db.query('SELECT * FROM items WHERE id = $1', [id]);
    res.json({ item: updatedRes.rows[0] });
  } catch (err: any) {
    console.error('Error updating item:', err);
    res.status(500).json({ error: 'Failed to update item.' });
  }
});

export default router;
