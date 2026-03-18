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
import { proxyGraphQL, proxyRestGet, proxyRestPost, proxyRestPostJson } from '../services/proxyService';
import { buildSupplierQuery, buildTicketsQuery, buildInterventionsQuery } from '../services/decompteQueries';

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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orgs/:orgId/proxy/interventions
// Proxies a GraphQL request for upcoming interventions scoped to this org's client.
// Minimum role: VIEWER
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/:orgId/proxy/interventions',
  checkOrganizationAccess(MemberRole.VIEWER),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;

      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }
      if (!org.externalReferenceId) { res.status(403).json({ error: 'Organization has no linked supplier' }); return; }

      const today = new Date().toISOString().split('T')[0];
      const { dateBegin = `>${today}` } = req.body as { dateBegin?: string };

      let query: string;
      try {
        query = buildInterventionsQuery({ supplierId: org.externalReferenceId, dateBegin });
      } catch {
        res.status(403).json({ error: 'Organization has no valid supplier reference' });
        return;
      }

      const externalJson = await proxyGraphQL(query) as { data?: { ticalIntervention?: unknown } };

      await createAuditLog(
        'PROXY_API_CALL',
        req.user!.userId,
        { orgId, externalReferenceId: org.externalReferenceId, endpoint: 'interventions' },
        orgId,
      );

      const intervention = externalJson.data?.ticalIntervention ?? null;
      res.json({ intervention });
    } catch (error: any) {
      console.error('Proxy interventions request failed:', error);
      const remoteStatus = error.response?.status;
      res.status(remoteStatus ? 502 : 500).json({
        error: 'Proxy request failed',
        details: error.response?.data || error.message,
        remoteStatus,
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orgs/:orgId/proxy/factures
// Proxies a REST request for billing documents.
// Minimum role: VIEWER
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/:orgId/proxy/factures',
  checkOrganizationAccess(MemberRole.VIEWER),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;

      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }
      if (!org.externalReferenceId) { res.status(403).json({ error: 'Organization has no linked supplier' }); return; }

      const data = await proxyRestGet(`/api/accounting/${encodeURIComponent(org.externalReferenceId)}/docs`);

      await createAuditLog(
        'PROXY_API_CALL',
        req.user!.userId,
        { orgId, externalReferenceId: org.externalReferenceId, endpoint: 'factures' },
        orgId,
      );

      res.json(data);
    } catch (error: any) {
      console.error('Proxy factures request failed:', error);
      const remoteStatus = error.response?.status;
      res.status(remoteStatus ? 502 : 500).json({
        error: 'Proxy request failed',
        details: error.response?.data || error.message,
        remoteStatus,
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orgs/:orgId/proxy/orders
// Proxies a REST POST request for the order list.
// Minimum role: VIEWER
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/:orgId/proxy/orders',
  checkOrganizationAccess(MemberRole.VIEWER),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;

      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }
      if (!org.externalReferenceId) { res.status(403).json({ error: 'Organization has no linked supplier' }); return; }

      const data = await proxyRestPost('/api/command/list', { clientId: org.externalReferenceId });

      await createAuditLog(
        'PROXY_API_CALL',
        req.user!.userId,
        { orgId, externalReferenceId: org.externalReferenceId, endpoint: 'orders' },
        orgId,
      );

      res.json(data);
    } catch (error: any) {
      console.error('Proxy orders request failed:', error);
      const remoteStatus = error.response?.status;
      res.status(remoteStatus ? 502 : 500).json({
        error: 'Proxy request failed',
        details: error.response?.data || error.message,
        remoteStatus,
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orgs/:orgId/proxy/offers
// Proxies a REST POST request for the offer list scoped to this org's client.
// Minimum role: VIEWER
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/:orgId/proxy/offers',
  checkOrganizationAccess(MemberRole.VIEWER),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;

      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }
      if (!org.externalReferenceId) { res.status(403).json({ error: 'Organization has no linked supplier' }); return; }

      const data = await proxyRestPost('/api/offer/list', { clientId: org.externalReferenceId });

      await createAuditLog(
        'PROXY_API_CALL',
        req.user!.userId,
        { orgId, externalReferenceId: org.externalReferenceId, endpoint: 'offers' },
        orgId,
      );

      res.json(data);
    } catch (error: any) {
      console.error('Proxy offers request failed:', error);
      const remoteStatus = error.response?.status;
      res.status(remoteStatus ? 502 : 500).json({
        error: 'Proxy request failed',
        details: error.response?.data || error.message,
        remoteStatus,
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orgs/:orgId/proxy/bcp-bookings
// Proxies the BCP room booking list and filters to this org's customer.
// Minimum role: VIEWER
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/:orgId/proxy/bcp-bookings',
  checkOrganizationAccess(MemberRole.VIEWER),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;

      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }

      const bookings = await proxyRestPost('/api/bcp/roombooking/list');

      await createAuditLog(
        'PROXY_API_CALL',
        req.user!.userId,
        { orgId, externalReferenceId: org.externalReferenceId, endpoint: 'bcp-bookings' },
        orgId,
      );

      res.json(bookings);
    } catch (error: any) {
      console.error('Proxy BCP bookings request failed:', error);
      const remoteStatus = error.response?.status;
      res.status(remoteStatus ? 502 : 500).json({
        error: 'Proxy request failed',
        details: error.response?.data || error.message,
        remoteStatus,
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/orgs/:orgId/proxy/supplier/update
// Proxies multiple REST requests to Rapix to update supplier and/or contacts.
// Minimum role: MANAGER
// ─────────────────────────────────────────────────────────────────────────────
router.put(
  '/:orgId/proxy/supplier/update',
  checkOrganizationAccess(MemberRole.MANAGER),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const { requesterContactId, supplierAttributes, contactUpdates } = req.body as {
        requesterContactId: number;
        supplierAttributes?: Record<string, string>;
        contactUpdates?: Array<{
          contactId: number;
          attributes: Record<string, string>;
        }>;
      };

      if (!requesterContactId) {
        res.status(400).json({ error: 'requesterContactId is required' });
        return;
      }

      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }
      if (!org.externalReferenceId) {
        res.status(403).json({ error: 'Organization has no linked supplier' });
        return;
      }

      const customerId = org.externalReferenceId;
      const results: any[] = [];
      let requestCount = 0;

      // 1. Update supplier attributes if any
      if (supplierAttributes && Object.keys(supplierAttributes).length > 0) {
        const payload = {
          app: 'myr',
          requester_type: 'Tical\\Contact',
          requester_id: requesterContactId,
          customer_id: parseInt(customerId, 10),
          content: {
            op: 'update',
            entity_type: 'Tical\\Customer',
            entity_id: parseInt(customerId, 10),
            attributes: supplierAttributes,
          },
        };
        const result = await proxyRestPostJson('/api/request/new', payload);
        results.push({ type: 'supplier', result });
        requestCount++;
      }

      // 2. Update contact attributes if any
      if (contactUpdates && contactUpdates.length > 0) {
        for (const update of contactUpdates) {
          if (Object.keys(update.attributes).length > 0) {
            const payload = {
              app: 'myr',
              requester_type: 'Tical\\Contact',
              requester_id: requesterContactId,
              customer_id: parseInt(customerId, 10),
              content: {
                op: 'update',
                entity_type: 'Tical\\Customer.contact',
                entity_id: update.contactId,
                attributes: update.attributes,
              },
            };
            const result = await proxyRestPostJson('/api/request/new', payload);
            results.push({ type: 'contact', contactId: update.contactId, result });
            requestCount++;
          }
        }
      }

      // Log the update action
      await createAuditLog(
        'SUPPLIER_UPDATE_REQUESTED',
        req.user!.userId,
        { orgId, customerId, requestCount, supplierAttributes, contactUpdatesCount: contactUpdates?.length ?? 0 },
        orgId
      );

      res.json({ success: true, requestCount, results });
    } catch (error: any) {
      console.error('Supplier update proxy failed:', error);
      const remoteStatus = error.response?.status;
      res.status(remoteStatus ? 502 : 500).json({
        error: 'Supplier update proxy failed',
        details: error.response?.data || error.message,
        remoteStatus,
      });
    }
  }
);

export default router;
