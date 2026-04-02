import express, { Request, Response } from 'express';
import { proxyGraphQL, ProxyError } from '../services/proxyService';
import { buildContactSupplierDataQuery } from '../services/decompteQueries';
import prisma from '../lib/prisma';

const router = express.Router();

interface SupplierCompany {
  contact: { email: string; id: number };
  supplier: { id: number; name: string; raisonsociale: string };
  roles: Array<{ contactroles: { name: string } }>;
}

interface SupplierContextResponse {
  data?: {
    contactSupplier?: {
      data?: SupplierCompany[];
    };
  };
}

/**
 * Syncs the user's external supplier memberships to the local DB.
 * Creates Organization + Member records for each supplier so that
 * checkOrganizationAccess() works using the supplier ID as orgId.
 */
async function syncSupplierMemberships(userId: string, companies: SupplierCompany[]): Promise<void> {
  for (const company of companies) {
    const supplierId = String(company.supplier.id);
    const slug = `supplier-${supplierId}`;

    try {
      // Upsert Organization — use supplier ID as the org ID
      await prisma.organization.upsert({
        where: { id: supplierId },
        create: { id: supplierId, name: `Supplier ${supplierId}`, slug, externalReferenceId: supplierId },
        update: { externalReferenceId: supplierId },
      });

      // Upsert Member — grant MANAGER so both read and write proxy routes pass
      await prisma.member.upsert({
        where: { userId_organizationId: { userId, organizationId: supplierId } },
        create: { userId, organizationId: supplierId, role: 'MANAGER' },
        update: {},
      });
    } catch (err) {
      // Log but don't fail the request — data can still be returned to the client
      console.warn(`[userContext] Failed to sync supplier ${supplierId} for user ${userId}:`, (err as Error).message);
    }
  }
}

/**
 * GET /api/user/supplier-context
 * Returns the authenticated user's companies and roles from the external supplier API.
 * Also syncs each supplier as an Organization+Member in the local DB so that
 * existing proxy routes (which use checkOrganizationAccess) work with the supplier ID.
 */
router.get('/supplier-context', async (req: Request, res: Response): Promise<void> => {
  try {
    const email = req.user!.email;
    const userId = req.user!.userId;
    const query = buildContactSupplierDataQuery(email);
    const data = await proxyGraphQL(query) as SupplierContextResponse;

    const companies = data?.data?.contactSupplier?.data ?? [];
    await syncSupplierMemberships(userId, companies);

    res.json(data);
  } catch (error: unknown) {
    const proxyErr = error as ProxyError;
    if (proxyErr.response) {
      res.status(502).json({
        error: 'Supplier API unavailable',
        details: proxyErr.response.data,
      });
      return;
    }
    console.error('Supplier context fetch failed:', (error as Error).message);
    res.status(500).json({ error: 'Failed to fetch supplier context' });
  }
});

export default router;
