import express, { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { createAuditLog } from '../middleware/auditLog';

const router = express.Router();

/**
 * @swagger
 * /api/admin/settings:
 *   get:
 *     summary: List all system settings
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of system settings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SystemSetting'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const settings = await prisma.systemSettings.findMany({
      orderBy: {
        settingKey: 'asc'
      }
    });
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * @swagger
 * /api/admin/settings/{key}:
 *   patch:
 *     summary: Update a specific system setting
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         example: auth_email_password_enabled
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isEnabled:
 *                 type: boolean
 *               providerConfig:
 *                 type: object
 *     responses:
 *       200:
 *         description: Updated setting
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SystemSetting'
 *       404:
 *         description: Setting not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.patch('/settings/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { isEnabled, providerConfig } = req.body;
    
    // Find the existing setting
    const existingSetting = await prisma.systemSettings.findUnique({
      where: { settingKey: key }
    });
    
    if (!existingSetting) {
      res.status(404).json({ error: 'Setting not found' });
      return;
    }
    
    // Prepare update data
    const updateData: any = {};
    if (typeof isEnabled === 'boolean') {
      updateData.isEnabled = isEnabled;
    }
    if (providerConfig !== undefined) {
      updateData.providerConfig = providerConfig;
    }
    
    // Update the setting
    const updatedSetting = await prisma.systemSettings.update({
      where: { settingKey: key },
      data: updateData
    });
    
    // Create audit log
    await createAuditLog(
      `UPDATE_SETTING: ${key}`,
      null, // userId can be added when auth is fully implemented
      {
        settingKey: key,
        changes: updateData,
        previousValue: {
          isEnabled: existingSetting.isEnabled,
          providerConfig: existingSetting.providerConfig
        }
      }
    );
    
    res.json(updatedSetting);
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

/**
 * @swagger
 * /api/admin/database:
 *   get:
 *     summary: Fetch database table overview or specific table data
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: table
 *         required: false
 *         schema:
 *           type: string
 *           enum: [users, accounts, sessions, system_settings, two_factor, audit_logs]
 *         description: When provided, returns all rows for that table (sensitive fields redacted)
 *     responses:
 *       200:
 *         description: Table row counts or specific table data
 *       400:
 *         description: Invalid table name
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/database', async (req: Request, res: Response) => {
  try {
    const { table } = req.query;

    const SENSITIVE_FIELDS = new Set([
      'password', 'secret', 'backupCodes', 'accessToken',
      'refreshToken', 'idToken', 'token'
    ]);

    const redactSensitive = (record: Record<string, any>): Record<string, any> => {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(record)) {
        if (SENSITIVE_FIELDS.has(key)) {
          result[key] = value !== null ? '[REDACTED]' : null;
        } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          result[key] = redactSensitive(value as Record<string, any>);
        } else if (Array.isArray(value)) {
          result[key] = value.map((item: any) =>
            typeof item === 'object' && item !== null ? redactSensitive(item) : item
          );
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    if (table && typeof table === 'string') {
      let data: any[] = [];

      switch (table) {
        case 'users':
          data = await prisma.user.findMany({
            include: {
              accounts: true,
              sessions: true,
              twoFactor: true
            },
            orderBy: { createdAt: 'desc' }
          });
          break;
        case 'accounts':
          data = await prisma.account.findMany({
            include: { user: { select: { id: true, email: true, name: true } } },
            orderBy: { createdAt: 'desc' }
          });
          break;
        case 'sessions':
          data = await prisma.session.findMany({
            include: { user: { select: { id: true, email: true, name: true } } },
            orderBy: { expiresAt: 'desc' }
          });
          break;
        case 'system_settings':
          data = await prisma.systemSettings.findMany({
            orderBy: { settingKey: 'asc' }
          });
          break;
        case 'two_factor':
          data = await prisma.twoFactor.findMany({
            include: { user: { select: { id: true, email: true, name: true } } }
          });
          break;
        case 'audit_logs':
          data = await prisma.auditLog.findMany({
            take: 1000,
            orderBy: { timestamp: 'desc' }
          });
          break;
        default:
          res.status(400).json({ error: 'Invalid table name' });
          return;
      }

      res.json({ table, data: data.map(redactSensitive) });
      return;
    }

    // Return counts for all tables
    const [users, accounts, sessions, settings, twoFactor, auditLogs] = await Promise.all([
      prisma.user.count(),
      prisma.account.count(),
      prisma.session.count(),
      prisma.systemSettings.count(),
      prisma.twoFactor.count(),
      prisma.auditLog.count()
    ]);

    res.json({
      tables: {
        users: { count: users },
        accounts: { count: accounts },
        sessions: { count: sessions },
        system_settings: { count: settings },
        two_factor: { count: twoFactor },
        audit_logs: { count: auditLogs }
      }
    });
  } catch (error) {
    console.error('Error fetching database data:', error);
    res.status(500).json({ error: 'Failed to fetch database data' });
  }
});

/**
 * @swagger
 * /api/admin/logs:
 *   get:
 *     summary: Fetch the 100 most recent audit logs
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of audit log entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AuditLog'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      take: 100,
      orderBy: {
        timestamp: 'desc'
      }
    });
    
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

export default router;
