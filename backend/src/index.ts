import dotenv from 'dotenv';

// Load environment variables before any module that reads them
dotenv.config();

import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import prisma from './lib/prisma';
import { auth, loadAuthConfig } from './lib/auth';
import { swaggerSpec } from './lib/swagger';
import { jwtAuth } from './middleware/jwtAuth';
import { adminAuth } from './middleware/adminAuth';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import rolesRouter from './routes/roles';
import counterRouter from './routes/counter';

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Core Middleware ───────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Swagger UI (public) ───────────────────────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /api:
 *   get:
 *     summary: API status
 *     tags:
 *       - Status
 *     responses:
 *       200:
 *         description: API is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Backend API is running
 */
app.get('/api', (_req, res) => {
  res.json({ message: 'Backend API is running' });
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check with live service status
 *     tags:
 *       - Status
 *     responses:
 *       200:
 *         description: All services healthy
 *       503:
 *         description: One or more services degraded
 */
app.get('/api/health', async (_req, res) => {
  const timestamp = new Date().toISOString();

  const dbStart = Date.now();
  let dbOk = false;
  let dbLatencyMs = 0;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
    dbLatencyMs = Date.now() - dbStart;
  } catch {
    dbLatencyMs = Date.now() - dbStart;
  }

  const allOk = dbOk;

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp,
    services: {
      api: { ok: true, message: 'Express API is running' },
      database: {
        ok: dbOk,
        latencyMs: dbLatencyMs,
        message: dbOk ? `Connected (${dbLatencyMs}ms)` : 'Connection failed',
      },
    },
  });
});

// ─── Public Auth Routes ────────────────────────────────────────────────────────
// /api/auth/token must be mounted BEFORE jwtAuth so it is not gated
app.use('/api/auth', authRouter);

// Better Auth routes (session-based; not gated by jwtAuth)
const DEBUG_AUTH_LOG = path.join(__dirname, '..', 'debug-auth.log');
app.all('/api/auth/*', async (req, res) => {
  try {
    // #region agent log
    try { fs.appendFileSync(DEBUG_AUTH_LOG, JSON.stringify({ sessionId: '8d83fd', message: 'auth handler hit', path: req.path, method: req.method, timestamp: Date.now() }) + '\n'); } catch (_) {}
    // #endregion agent log
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const url = `${protocol}://${host}${req.url}`;

    const bodyString =
      req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined;

    const webRequest = new Request(url, {
      method: req.method,
      headers: new Headers(req.headers as any),
      body: bodyString,
    });

    const response = await auth.handler(webRequest);

    const body = await response.text();

    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Ensure error responses (4xx/5xx) are always JSON so the client can show message/error
    if (response.status >= 400) {
      // #region agent log
      try { fs.appendFileSync(DEBUG_AUTH_LOG, JSON.stringify({ sessionId: '8d83fd', message: 'normalizing error response', status: response.status, bodyLen: body.length, timestamp: Date.now() }) + '\n'); } catch (_) {}
      // #endregion agent log
      let json: { message?: string; error?: string } | null = null;
      if (body.trim()) {
        try {
          json = JSON.parse(body) as { message?: string; error?: string };
        } catch {
          /* body is not JSON */
        }
      }
      const message = (json?.message ?? json?.error ?? body) || response.statusText;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Auth-Error-Normalized', '1');
      return res.json({ error: message, message });
    }

    res.send(body);
  } catch (error) {
    console.error('Auth handler error:', error);
    res.setHeader('X-Auth-Error-Normalized', '1');
    res.status(500).json({ error: 'Authentication error', message: (error as Error).message });
  }
});

// ─── Centralized JWT + RBAC Middleware ────────────────────────────────────────
// Applied globally; public routes are skipped inside the middleware itself.
app.use(jwtAuth);

// ─── Counter Routes (JWT protected) ──────────────────────────────────────────
app.use('/api/counter', counterRouter);

// ─── Admin API Routes (x-admin-secret auth; jwtAuth skips /api/admin via PUBLIC_ROUTES) ─
app.use('/api/admin', adminAuth);
app.use('/api/admin', adminRouter);
app.use('/api/admin', rolesRouter);

// ─── 404 for API (no route matched) ─────────────────────────────────────────────
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found', path: _req.path, method: _req.method });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await loadAuthConfig();

    app.listen(PORT, () => {
      console.log(`Backend server running on port ${PORT}`);
      console.log('Auth error responses (4xx/5xx) are normalized to JSON with X-Auth-Error-Normalized header');
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`Swagger docs available at http://localhost:${PORT}/api/docs`);
      console.log(`Auth endpoints available at /api/auth/*`);
      console.log(`Admin endpoints available at /api/admin/*`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
