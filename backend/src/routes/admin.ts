import express, { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { createAuditLog } from '../middleware/auditLog';
import { checkOrganizationAccess } from '../middleware/auth';

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
      null,
      {
        settingKey: key,
        changes: updateData,
        previousValue: {
          isEnabled: existingSetting.isEnabled,
          providerConfig: existingSetting.providerConfig,
        },
        adminIp: req.ip,
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
    const { organizationId } = req.query;
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 100));

    const where = organizationId && typeof organizationId === 'string'
      ? { organizationId }
      : {};

    const logs = await prisma.auditLog.findMany({
      where,
      take: limit,
      orderBy: { timestamp: 'desc' },
    });

    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/**
 * @swagger
 * /api/admin/logs:
 *   get:
 *     summary: Fetch audit logs (optionally filtered by organizationId)
 *     tags:
 *       - Admin
 *     security:
 *       - adminSecret: []
 *     parameters:
 *       - in: query
 *         name: organizationId
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter logs to a specific organization
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Array of audit log entries
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /api/admin/organizations:
 *   get:
 *     summary: List all organizations (paginated)
 *     tags:
 *       - Admin
 *     security:
 *       - adminSecret: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated list of organizations
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/organizations', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.organization.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { members: true } } },
      }),
      prisma.organization.count(),
    ]);

    res.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

/**
 * @swagger
 * /api/admin/organizations/{orgId}/members:
 *   get:
 *     summary: List members of a specific organization (paginated)
 *     tags:
 *       - Admin
 *     security:
 *       - adminSecret: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated list of organization members
 *       400:
 *         description: Missing orgId
 *       404:
 *         description: Organization not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get(
  '/organizations/:orgId/members',
  checkOrganizationAccess(),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        prisma.member.findMany({
          where: { organizationId: orgId },
          skip,
          take: limit,
          orderBy: { role: 'asc' },
          include: {
            user: {
              select: { id: true, email: true, name: true, image: true },
            },
          },
        }),
        prisma.member.count({ where: { organizationId: orgId } }),
      ]);

      res.json({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      console.error('Error fetching organization members:', error);
      res.status(500).json({ error: 'Failed to fetch organization members' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Organization CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/organizations:
 *   post:
 *     summary: Create a new organization (tenant)
 *     tags:
 *       - Admin
 *     security:
 *       - adminSecret: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, slug]
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               externalReferenceId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created organization
 *       400:
 *         description: Validation error or duplicate slug
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/organizations', async (req: Request, res: Response) => {
  try {
    const { name, slug, externalReferenceId } = req.body as {
      name?: string;
      slug?: string;
      externalReferenceId?: string;
    };

    if (!name?.trim()) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    if (!slug?.trim()) {
      res.status(400).json({ error: 'slug is required' });
      return;
    }
    const slugNorm = slug.trim().toLowerCase().replace(/\s+/g, '-');
    if (!/^[a-z0-9-]+$/.test(slugNorm)) {
      res.status(400).json({ error: 'slug may only contain lowercase letters, numbers and hyphens' });
      return;
    }

    const existing = await prisma.organization.findUnique({ where: { slug: slugNorm } });
    if (existing) {
      res.status(400).json({ error: 'An organization with this slug already exists', slug: slugNorm });
      return;
    }

    const org = await prisma.organization.create({
      data: {
        name: name.trim(),
        slug: slugNorm,
        externalReferenceId: externalReferenceId?.trim() || null,
      },
    });

    await createAuditLog('ORG_CREATED', null, { orgId: org.id, name: org.name, slug: org.slug, adminIp: req.ip }, org.id);

    res.status(201).json(org);
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

/**
 * @swagger
 * /api/admin/organizations/{orgId}:
 *   patch:
 *     summary: Update organization name or external reference ID
 *     tags:
 *       - Admin
 *     security:
 *       - adminSecret: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               externalReferenceId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated organization
 *       404:
 *         description: Organization not found
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.patch('/organizations/:orgId', checkOrganizationAccess(), async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { name, externalReferenceId } = req.body as { name?: string; externalReferenceId?: string };

    const updateData: Record<string, unknown> = {};
    if (name?.trim()) updateData.name = name.trim();
    if (externalReferenceId !== undefined) updateData.externalReferenceId = externalReferenceId?.trim() || null;

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'Nothing to update: provide name or externalReferenceId' });
      return;
    }

    const org = await prisma.organization.update({
      where: { id: orgId },
      data: updateData,
    });

    await createAuditLog('ORG_UPDATED', null, { orgId, changes: updateData, adminIp: req.ip }, orgId);

    res.json(org);
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Member management (invite / change role / remove)
// ─────────────────────────────────────────────────────────────────────────────

const VALID_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'VIEWER'] as const;
type RoleString = typeof VALID_ROLES[number];

/**
 * @swagger
 * /api/admin/organizations/{orgId}/members:
 *   post:
 *     summary: Add (invite) a user to an organization by email
 *     tags:
 *       - Admin
 *     security:
 *       - adminSecret: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, role]
 *             properties:
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [OWNER, ADMIN, MANAGER, VIEWER]
 *     responses:
 *       201:
 *         description: Member created or updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Organization or user not found
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  '/organizations/:orgId/members',
  checkOrganizationAccess(),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const { email, role } = req.body as { email?: string; role?: string };

      if (!email?.trim()) {
        res.status(400).json({ error: 'email is required' });
        return;
      }
      if (!role || !VALID_ROLES.includes(role as RoleString)) {
        res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
        return;
      }

      const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      if (!user) {
        res.status(404).json({ error: 'No user found with this email address', email });
        return;
      }

      const member = await prisma.member.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
        update: { role: role as RoleString },
        create: { userId: user.id, organizationId: orgId, role: role as RoleString },
        include: { user: { select: { id: true, email: true, name: true, image: true } } },
      });

      await createAuditLog(
        'MEMBER_INVITED',
        null,
        { orgId, userEmail: email, role, adminIp: req.ip },
        orgId
      );

      res.status(201).json(member);
    } catch (error) {
      console.error('Error adding member:', error);
      res.status(500).json({ error: 'Failed to add member' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{orgId}/members/{userId}:
 *   patch:
 *     summary: Change a member's role within an organization
 *     tags:
 *       - Admin
 *     security:
 *       - adminSecret: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [OWNER, ADMIN, MANAGER, VIEWER]
 *     responses:
 *       200:
 *         description: Updated member record
 *       400:
 *         description: Validation error
 *       404:
 *         description: Member not found
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.patch(
  '/organizations/:orgId/members/:userId',
  checkOrganizationAccess(),
  async (req: Request, res: Response) => {
    try {
      const { orgId, userId } = req.params;
      const { role } = req.body as { role?: string };

      if (!role || !VALID_ROLES.includes(role as RoleString)) {
        res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
        return;
      }

      const existing = await prisma.member.findUnique({
        where: { userId_organizationId: { userId, organizationId: orgId } },
      });
      if (!existing) {
        res.status(404).json({ error: 'Member not found in this organization' });
        return;
      }

      const member = await prisma.member.update({
        where: { userId_organizationId: { userId, organizationId: orgId } },
        data: { role: role as RoleString },
        include: { user: { select: { id: true, email: true, name: true, image: true } } },
      });

      await createAuditLog(
        'MEMBER_ROLE_CHANGED',
        null,
        { orgId, userId, previousRole: existing.role, newRole: role, adminIp: req.ip },
        orgId
      );

      res.json(member);
    } catch (error) {
      console.error('Error updating member role:', error);
      res.status(500).json({ error: 'Failed to update member role' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{orgId}/members/{userId}:
 *   delete:
 *     summary: Remove a member from an organization
 *     tags:
 *       - Admin
 *     security:
 *       - adminSecret: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member removed
 *       404:
 *         description: Member not found
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete(
  '/organizations/:orgId/members/:userId',
  checkOrganizationAccess(),
  async (req: Request, res: Response) => {
    try {
      const { orgId, userId } = req.params;

      const existing = await prisma.member.findUnique({
        where: { userId_organizationId: { userId, organizationId: orgId } },
        include: { user: { select: { email: true } } },
      });
      if (!existing) {
        res.status(404).json({ error: 'Member not found in this organization' });
        return;
      }

      await prisma.member.delete({
        where: { userId_organizationId: { userId, organizationId: orgId } },
      });

      await createAuditLog(
        'MEMBER_REMOVED',
        null,
        { orgId, userId, userEmail: existing.user.email, previousRole: existing.role, adminIp: req.ip },
        orgId
      );

      res.json({ message: 'Member removed successfully', userId, organizationId: orgId });
    } catch (error) {
      console.error('Error removing member:', error);
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }
);

export default router;
