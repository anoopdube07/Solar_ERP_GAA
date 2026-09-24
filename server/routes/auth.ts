import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDB } from '../db/index.ts';
import {
  AuthenticatedRequest,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
  requireAuth,
} from '../middleware/auth.ts';

const router = express.Router();

// Check if first-run setup is required
router.get('/status', async (req: AuthenticatedRequest, res) => {
  try {
    const db = await getDB();
    const result = await db.query('SELECT COUNT(*) as count FROM users');
    const userCount = parseInt(result.rows[0].count, 10);

    res.json({
      initialized: userCount > 0,
      user: req.user || null,
      sessionId: req.sessionId || null,
      token: req.sessionId || null,
    });
  } catch (err: any) {
    console.error('Error fetching auth status:', err);
    res.status(500).json({ error: 'Internal server error checking system status.' });
  }
});

// First-run Owner setup
router.post('/first-run-setup', async (req, res) => {
  try {
    const db = await getDB();
    const countRes = await db.query('SELECT COUNT(*) as count FROM users');
    const userCount = parseInt(countRes.rows[0].count, 10);

    if (userCount > 0) {
      return res.status(403).json({
        error: 'First-run setup has already been completed. Contact the Owner for access.',
      });
    }

    const { name, username, password, confirm_password } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ error: 'Owner Name, Username, and Password are required.' });
    }

    if (password !== confirm_password) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    await db.query(
      `INSERT INTO users (id, username, password_hash, name, role, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'OWNER', true, NOW(), NOW())`,
      [userId, username.trim().toLowerCase(), passwordHash, name.trim()]
    );

    // Create session for the new Owner
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.query(
      `INSERT INTO sessions (id, user_id, expires_at, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [sessionId, userId, expiresAt]
    );

    res.cookie('solar_session', sessionId, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      message: 'Owner account created successfully.',
      user: {
        id: userId,
        username: username.trim().toLowerCase(),
        name: name.trim(),
        role: 'OWNER',
        active: true,
      },
      sessionId,
      token: sessionId,
    });
  } catch (err: any) {
    console.error('Error during first-run setup:', err);
    res.status(500).json({ error: 'Failed to complete first-run setup.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    const rateCheck = checkLoginRateLimit(ip);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Too many failed login attempts. Please wait ${rateCheck.waitSeconds} seconds before trying again.`,
      });
    }

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const db = await getDB();
    const result = await db.query('SELECT * FROM users WHERE username = $1', [
      username.trim().toLowerCase(),
    ]);

    if (result.rows.length === 0) {
      recordFailedLogin(ip);
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = result.rows[0];

    if (!user.active) {
      return res.status(403).json({
        error: 'Your account is currently inactive. Please contact the Owner.',
      });
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      recordFailedLogin(ip);
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    resetLoginAttempts(ip);

    // Update last_login_at
    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // Create session
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.query(
      `INSERT INTO sessions (id, user_id, expires_at, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [sessionId, user.id, expiresAt]
    );

    res.cookie('solar_session', sessionId, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Login successful.',
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        active: user.active,
        last_login_at: new Date().toISOString(),
      },
      sessionId,
      token: sessionId,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'An unexpected error occurred during login.' });
  }
});

// Quick Switch User (Internal testing / demonstration helper)
router.post('/quick-login', async (req, res) => {
  try {
    const { username, role } = req.body;
    if (!username && !role) {
      return res.status(400).json({ error: 'Username or role is required.' });
    }

    const db = await getDB();
    const cleanUsername = (username || '').trim().toLowerCase();

    // Map common aliases between different role switcher conventions
    const usernameAliases: Record<string, string[]> = {
      owner: ['owner'],
      manager: ['manager', 'manager1'],
      manager1: ['manager1', 'manager'],
      instmgr: ['instmgr', 'inst_mgr'],
      inst_mgr: ['inst_mgr', 'instmgr'],
      lead1: ['lead1', 'lead2', 'lead'],
      lead2: ['lead2', 'lead1'],
      instmember: ['instmember'],
      reg1: ['reg1', 'registration'],
      accounts: ['accounts', 'accountant'],
      accountant: ['accountant', 'accounts'],
      dispatch: ['dispatch', 'dispatch1'],
      dispatch1: ['dispatch1', 'dispatch'],
    };

    const targetUsernames = cleanUsername && usernameAliases[cleanUsername]
      ? usernameAliases[cleanUsername]
      : (cleanUsername ? [cleanUsername] : []);

    let user: any = null;

    // 1. Try finding by username aliases first
    if (targetUsernames.length > 0) {
      const placeholders = targetUsernames.map((_, i) => `$${i + 1}`).join(', ');
      const userRes = await db.query(
        `SELECT * FROM users WHERE LOWER(username) IN (${placeholders}) AND active = true ORDER BY (LOWER(username) = $1) DESC LIMIT 1`,
        targetUsernames
      );
      if (userRes.rows.length > 0) {
        user = userRes.rows[0];
      }
    }

    // 2. If not found by username, try by role
    const targetRole = role || (
      cleanUsername.includes('owner') ? 'OWNER' :
      cleanUsername.includes('manager') ? 'MANAGER' :
      cleanUsername.includes('inst_mgr') || cleanUsername.includes('instmgr') ? 'INSTALLATION_MANAGER' :
      cleanUsername.includes('inst') ? 'INSTALLATION_MEMBER' :
      cleanUsername.includes('reg') ? 'REGISTRATION' :
      cleanUsername.includes('account') ? 'ACCOUNTS' :
      cleanUsername.includes('dispatch') ? 'DISPATCH' :
      cleanUsername.includes('lead') ? 'LEAD' : null
    );

    if (!user && targetRole) {
      const roleRes = await db.query(
        'SELECT * FROM users WHERE role = $1 AND active = true ORDER BY created_at ASC LIMIT 1',
        [targetRole]
      );
      if (roleRes.rows.length > 0) {
        user = roleRes.rows[0];
      }
    }

    // 3. If still no active user exists for this role, auto-provision this test role user
    if (!user) {
      const passwordHash = await bcrypt.hash('Solar@123', 10);
      const newUserId = crypto.randomUUID();
      const fallbackRole = targetRole || 'LEAD';
      const fallbackUsername = cleanUsername || fallbackRole.toLowerCase();
      const fallbackName = fallbackRole === 'OWNER' ? 'Rajesh Sharma (Owner)' :
        fallbackRole === 'MANAGER' ? 'Pooja Verma (Sales Manager)' :
        fallbackRole === 'INSTALLATION_MANAGER' ? 'Suresh Patel (Installation Manager)' :
        fallbackRole === 'INSTALLATION_MEMBER' ? 'Vikas Singh (Installation Member)' :
        fallbackRole === 'REGISTRATION' ? 'Rohan Deshmukh (Registration Exec)' :
        fallbackRole === 'ACCOUNTS' ? 'Kavita Shah (Accounts Exec)' :
        fallbackRole === 'DISPATCH' ? 'Dinesh Rathore (Dispatch Exec)' :
        'Amit Kumar (Sales Rep)';

      await db.query(
        `INSERT INTO users (id, username, password_hash, name, role, active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
        [newUserId, fallbackUsername, passwordHash, fallbackName, fallbackRole]
      );

      const createdRes = await db.query('SELECT * FROM users WHERE id = $1', [newUserId]);
      user = createdRes.rows[0];
    }

    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO sessions (id, user_id, expires_at, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [sessionId, user.id, expiresAt]
    );

    res.cookie('solar_session', sessionId, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: `Signed in as ${user.name}`,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        active: user.active,
        last_login_at: new Date().toISOString(),
      },
      sessionId,
      token: sessionId,
    });
  } catch (err: any) {
    console.error('Quick login error:', err);
    res.status(500).json({ error: 'Failed to switch user.' });
  }
});

// Logout
router.post('/logout', async (req: AuthenticatedRequest, res) => {
  try {
    if (req.sessionId) {
      const db = await getDB();
      await db.query('DELETE FROM sessions WHERE id = $1', [req.sessionId]);
    }
    res.clearCookie('solar_session');
    res.json({ message: 'Logged out successfully.' });
  } catch (err: any) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Failed to log out.' });
  }
});

// Current user profile
router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

export default router;
