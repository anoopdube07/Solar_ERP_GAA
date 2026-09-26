import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDB } from '../db/index.ts';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import type {  UserRole  } from '../../shared/types.ts';

const router = express.Router();

const VALID_ROLES: UserRole[] = [
  'OWNER',
  'MANAGER',
  'LEAD',
  'INSTALLATION_MANAGER',
  'INSTALLATION_MEMBER',
  'REGISTRATION',
  'ACCOUNTS',
  'DISPATCH',
  'SERVICE',
];

// Get all users
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const db = await getDB();
    const currentUser = req.user!;

    const { role, active } = req.query;
    let query = `SELECT id, username, name, role, active, created_at, updated_at, last_login_at, deleted_at FROM users WHERE deleted_at IS NULL`;
    const params: any[] = [];

    if (role && VALID_ROLES.includes(role as UserRole)) {
      params.push(role);
      query += ` AND role = $${params.length}`;
    }

    if (active !== undefined && active !== 'ALL' && active !== '') {
      params.push(active === 'true');
      query += ` AND active = $${params.length}`;
    }

    query += ` ORDER BY name ASC, created_at DESC`;

    const result = await db.query(query, params);
    res.json({ users: result.rows });
  } catch (err: any) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to retrieve users.' });
  }
});

// Create new user (OWNER ONLY)
router.post('/', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, username, password, role } = req.body;

    if (!name || !username || !password || !role) {
      return res.status(400).json({ error: 'Name, Username, Password, and Role are required.' });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Allowed roles: ${VALID_ROLES.join(', ')}` });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const db = await getDB();

    // Check existing username
    const existing = await db.query('SELECT id FROM users WHERE username = $1', [
      username.trim().toLowerCase(),
    ]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists. Please choose a different username.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();

    await db.query(
      `INSERT INTO users (id, username, password_hash, name, role, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
      [id, username.trim().toLowerCase(), passwordHash, name.trim(), role]
    );

    res.status(201).json({
      message: 'User created successfully.',
      user: {
        id,
        username: username.trim().toLowerCase(),
        name: name.trim(),
        role,
        active: true,
      },
    });
  } catch (err: any) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// Update user details or active status (OWNER ONLY)
router.put('/:id', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { name, username, role, active } = req.body;

    const db = await getDB();
    const userRes = await db.query('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const targetUser = userRes.rows[0];

    // Protect last active owner from being deactivated or downgraded
    if (targetUser.role === 'OWNER' && (active === false || (role && role !== 'OWNER'))) {
      const ownerCountRes = await db.query(
        `SELECT COUNT(*) as count FROM users WHERE role = 'OWNER' AND active = true AND deleted_at IS NULL AND id != $1`,
        [id]
      );
      if (parseInt(ownerCountRes.rows[0].count, 10) === 0) {
        return res.status(400).json({
          error: 'Cannot deactivate or change role of the sole active Owner in the system.',
        });
      }
    }

    const updates: string[] = [];
    const params: any[] = [id];

    if (name !== undefined) {
      params.push(name.trim());
      updates.push(`name = $${params.length}`);
    }

    if (username !== undefined && username.trim().toLowerCase() !== targetUser.username) {
      const cleanUsername = username.trim().toLowerCase();
      const existing = await db.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2 AND deleted_at IS NULL',
        [cleanUsername, id]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Username already in use by another user.' });
      }
      params.push(cleanUsername);
      updates.push(`username = $${params.length}`);
    }

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Invalid role.' });
      }
      params.push(role);
      updates.push(`role = $${params.length}`);
    }

    if (active !== undefined) {
      params.push(Boolean(active));
      updates.push(`active = $${params.length}`);
      // If deactivating user, delete their active sessions immediately
      if (!active) {
        await db.query('DELETE FROM sessions WHERE user_id = $1', [id]);
      }
    }

    updates.push('updated_at = NOW()');

    await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $1`,
      params
    );

    const updatedRes = await db.query(
      'SELECT id, username, name, role, active, updated_at FROM users WHERE id = $1',
      [id]
    );

    res.json({
      message: 'User updated successfully.',
      user: updatedRes.rows[0],
    });
  } catch (err: any) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// Delete user (OWNER ONLY)
router.delete('/:id', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user!;

    if (id === currentUser.id) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const db = await getDB();
    const userRes = await db.query('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found or already deleted.' });
    }

    const targetUser = userRes.rows[0];

    // Protect sole active owner
    if (targetUser.role === 'OWNER') {
      const ownerCountRes = await db.query(
        `SELECT COUNT(*) as count FROM users WHERE role = 'OWNER' AND active = true AND deleted_at IS NULL AND id != $1`,
        [id]
      );
      if (parseInt(ownerCountRes.rows[0].count, 10) === 0) {
        return res.status(400).json({
          error: 'Cannot delete the sole active Owner in the system.',
        });
      }
    }

    // Soft delete user to retain historical integrity for past leads, quotations, and audit logs
    await db.query(
      `UPDATE users SET active = false, deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Invalidate active sessions
    await db.query('DELETE FROM sessions WHERE user_id = $1', [id]);

    res.json({
      message: `User ${targetUser.name} (@${targetUser.username}) deleted successfully. Historical records preserved.`,
    });
  } catch (err: any) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// Reset user password (OWNER ONLY)
router.post('/:id/reset-password', requireAuth, requireRole('OWNER'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const db = await getDB();
    const userRes = await db.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const passwordHash = await bcrypt.hash(new_password, 10);

    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      passwordHash,
      id,
    ]);

    // Invalidate existing sessions for security
    await db.query('DELETE FROM sessions WHERE user_id = $1', [id]);

    res.json({ message: 'User password reset successfully.' });
  } catch (err: any) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: 'Failed to reset user password.' });
  }
});

export default router;
