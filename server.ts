import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { getDB } from './server/db/index.ts';
import { seedInitialData } from './server/seed.ts';
import { authenticateToken } from './server/middleware/auth.ts';

import authRoutes from './server/routes/auth.ts';
import usersRoutes from './server/routes/users.ts';
import itemsRoutes from './server/routes/items.ts';
import uomsRoutes from './server/routes/uoms.ts';
import customFieldsRoutes from './server/routes/customFields.ts';
import leadsRoutes from './server/routes/leads.ts';
import siteVisitsRoutes from './server/routes/siteVisits.ts';
import dashboardRoutes from './server/routes/dashboard.ts';
import documentsRoutes from './server/routes/documents.ts';
import registrationRoutes from './server/routes/registration.ts';
import installationRoutes from './server/routes/installation.ts';
import accountsRoutes from './server/routes/accounts.ts';
import dispatchRoutes from './server/routes/dispatch.ts';

async function startServer() {
  const app = express();
  // In AI Studio / Cloud Run container environment, Nginx listens on 8080 and reverse proxies to 3000.
  // If PORT is 8080 or unset, the app server binds to 3000 so Nginx can reverse-proxy to it without EADDRINUSE conflict.
  let PORT = 3000;
  if (process.env.PORT && process.env.PORT !== '8080') {
    PORT = parseInt(process.env.PORT, 10);
  }

  // Initialize DB and Seed standard data
  try {
    await getDB();
    await seedInitialData();
  } catch (err) {
    console.error('[Startup] Failed to initialize database:', err);
  }

  // Base Middlewares
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));
  app.use(cookieParser());

  // Global Session Authentication Middleware
  app.use(authenticateToken);

  // Health check API
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Solar ERP - Lead Team Module (Build 1)',
      timestamp: new Date().toISOString(),
      timezone: 'Asia/Kolkata',
    });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/items', itemsRoutes);
  app.use('/api/uoms', uomsRoutes);
  app.use('/api/custom-fields', customFieldsRoutes);
  app.use('/api/leads', leadsRoutes);
  app.use('/api/site-visits', siteVisitsRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/documents', documentsRoutes);
  app.use('/api/registration', registrationRoutes);
  app.use('/api/installation', installationRoutes);
  app.use('/api/accounts', accountsRoutes);
  app.use('/api/dispatch', dispatchRoutes);

  // Fallback 404 handler for unknown /api/* endpoints (prevents falling through to Vite's index.html)
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Global Error handler for API routes (guarantees clean JSON output instead of HTML error pages)
  app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[API Error]:', err);
    if (res.headersSent) {
      return _next(err);
    }
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
      error: err.message || 'An unexpected error occurred.',
      code: err.code || undefined,
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Solar ERP Backend running on http://0.0.0.0:${PORT} [Asia/Kolkata]`);
  });
}

startServer().catch((err) => {
  console.error('[Fatal] Server failed to start:', err);
});
