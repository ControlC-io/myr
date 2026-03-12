/**
 * Tenant-scoped resource routes — canonical example of JWT + checkOrganizationAccess.
 *
 * All routes here are protected by:
 *   1. jwtAuth (global, applied in index.ts) — validates the Bearer JWT and attaches req.user.
 *   2. checkOrganizationAccess(role) — verifies the caller is a member of the org
 *      with at least the specified role, then attaches req.orgMember.
 *
 * Pattern to copy for any new tenant-aware feature:
 *   router.get('/orgs/:orgId/resource', checkOrganizationAccess(MemberRole.VIEWER), handler)
 *   router.post('/orgs/:orgId/resource', checkOrganizationAccess(MemberRole.MANAGER), handler)
 */

import express, { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { MemberRole } from '@prisma/client';
import { checkOrganizationAccess } from '../middleware/auth';
import { createAuditLog } from '../middleware/auditLog';
import { proxyGraphQL } from '../services/proxyService';
import { buildSupplierQuery, buildTicketsQuery } from '../services/decompteQueries';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orgs/mine
// Returns the organizations the authenticated user belongs to.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/orgs/mine:
 *   get:
 *     summary: Get organizations for the authenticated user
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of organizations
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/mine', async (req: Request, res: Response) => {
  try {
    const members = await prisma.member.findMany({
      where: { userId: req.user!.userId },
      include: { organization: true },
    });

    res.json({
      organizations: members.map((m) => ({
        ...m.organization,
        role: m.role,
      })),
    });
  } catch (error) {
    console.error('Error fetching user organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orgs/:orgId/profile
// Returns the organization info and the caller's own member record.
// Minimum role: VIEWER (any member of the org may read this).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/orgs/{orgId}/profile:
 *   get:
 *     summary: Get organization profile (caller's membership context)
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Organization profile with caller's role
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Organization not found
 */
router.get(
  '/:orgId/profile',
  checkOrganizationAccess(MemberRole.VIEWER),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        include: { _count: { select: { members: true } } },
      });

      if (!org) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      res.json({
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          externalReferenceId: org.externalReferenceId,
          createdAt: org.createdAt,
          memberCount: org._count.members,
        },
        // req.orgMember is populated by checkOrganizationAccess
        member: req.orgMember,
      });
    } catch (error) {
      console.error('Error fetching org profile:', error);
      res.status(500).json({ error: 'Failed to fetch organization profile' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orgs/:orgId/audit-logs
// Returns paginated audit logs scoped to this organization.
// Minimum role: ADMIN (only Admins and Owners may inspect the security trail).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/orgs/{orgId}/audit-logs:
 *   get:
 *     summary: Get audit logs for an organization (ADMIN+)
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
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
 *         description: Paginated audit log entries for the organization
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get(
  '/:orgId/audit-logs',
  checkOrganizationAccess(MemberRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip  = (page - 1) * limit;

      const [data, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: { organizationId: orgId },
          skip,
          take: limit,
          orderBy: { timestamp: 'desc' },
        }),
        prisma.auditLog.count({ where: { organizationId: orgId } }),
      ]);

      // Record that this audit log was accessed
      await createAuditLog(
        'ORG_AUDIT_LOG_VIEWED',
        req.user!.userId,
        { orgId, page, limit },
        orgId
      );

      res.json({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      console.error('Error fetching org audit logs:', error);
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orgs/:orgId/proxy/supplier
// Proxies a GraphQL request for supplier information.
// Minimum role: VIEWER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/orgs/{orgId}/proxy/supplier:
 *   post:
 *     summary: Proxy GraphQL supplier request
 *     tags:
 *       - Proxy
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Proxied response
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  '/:orgId/proxy/supplier',
  checkOrganizationAccess(MemberRole.VIEWER),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
      });

      if (!org) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      if (!org.externalReferenceId) {
        res.status(403).json({ error: 'Organization has no linked supplier' });
        return;
      }

      const supplierId = org.externalReferenceId;

      let query: string;
      try {
        query = buildSupplierQuery(supplierId);
      } catch {
        res.status(403).json({ error: 'Organization has no valid supplier reference' });
        return;
      }

      const data = await proxyGraphQL(query);

      // Log the proxy action
      await createAuditLog(
        'PROXY_API_CALL',
        req.user!.userId,
        { orgId, supplierId, query },
        orgId
      );

      res.json(data);
    } catch (error: any) {
      console.error('Proxy request failed:', error);
      // Use 502 for remote API failures so the frontend does not mistake them
      // for the user's own auth errors (401/403).
      const remoteStatus = error.response?.status;
      const httpStatus = remoteStatus ? 502 : 500;
      res.status(httpStatus).json({
        error: 'Proxy request failed',
        details: error.response?.data || error.message,
        remoteStatus,
      });
    }
  }
);

/**
 * @openapi
 * /orgs/{orgId}/proxy/tickets:
 *   post:
 *     summary: Proxy GraphQL tickets request
 *     tags:
 *       - Proxy
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Proxied response
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  '/:orgId/proxy/tickets',
  checkOrganizationAccess(MemberRole.VIEWER),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
      });

      if (!org) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      if (!org.externalReferenceId) {
        res.status(403).json({ error: 'Organization has no linked supplier' });
        return;
      }

      const supplierId = org.externalReferenceId;

      const {
        paginLimit = 10,
        paginPage = 1,
        orderByDesc = 'date',
      } = req.body as {
        paginLimit?: number;
        paginPage?: number;
        orderByDesc?: string;
      };

      let query: string;
      try {
        query = buildTicketsQuery({ supplierId, paginLimit, paginPage, orderByDesc });
      } catch {
        res.status(403).json({ error: 'Organization has no valid supplier reference' });
        return;
      }

      const externalJson = await proxyGraphQL(query) as { data?: { ticket?: unknown } };

      await createAuditLog(
        'PROXY_API_CALL',
        req.user!.userId,
        { orgId, supplierId, query },
        orgId
      );

      const ticket = externalJson.data?.ticket ?? null;
      res.json({ ticket });
    } catch (error: any) {
      console.error('Proxy request failed:', error);
      const remoteStatus = error.response?.status;
      const httpStatus = remoteStatus ? 502 : 500;
      res.status(httpStatus).json({
        error: 'Proxy request failed',
        details: error.response?.data || error.message,
        remoteStatus,
      });
    }
  }
);

export default router;
