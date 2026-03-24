import { Request, Response, NextFunction } from 'express';
import { MemberRole } from '@prisma/client';
import prisma from '../lib/prisma';

export type { MemberRole };

/**
 * Convenience alias: a route can require a single role or any one of several roles.
 *
 * Usage patterns (JWT context – routes under /api/orgs/:orgId/...)
 * ────────────────────────────────────────────────────────────────
 *  Read-only, any org member:
 *    router.get('/orgs/:orgId/profile', checkOrganizationAccess(MemberRole.VIEWER), handler)
 *
 *  Write access, managers and above:
 *    router.post('/orgs/:orgId/resources', checkOrganizationAccess(MemberRole.MANAGER), handler)
 *
 *  Admin-only actions:
 *    router.delete('/orgs/:orgId/…', checkOrganizationAccess(MemberRole.ADMIN), handler)
 *
 *  OWNER-only actions:
 *    router.patch('/orgs/:orgId/billing', checkOrganizationAccess(MemberRole.OWNER), handler)
 *
 * Note: jwtAuth is applied globally in index.ts, so req.user is already set before
 * this middleware runs on JWT-protected routes.
 *
 * Admin routes (/api/admin/…) bypass jwtAuth (PUBLIC_ROUTES in jwtAuth.ts) and are
 * guarded by x-admin-secret via adminAuth instead.  In that context req.user is
 * absent and this middleware only validates that the Organization exists.
 */
export type OrgRoleRequirement = MemberRole;

/**
 * Numeric hierarchy for role comparison.
 * Higher value = more privileged.
 *
 * VIEWER < MANAGER < ADMIN < OWNER
 */
export const ROLE_HIERARCHY: Record<MemberRole, number> = {
  VIEWER:  1,
  MANAGER: 2,
  ADMIN:   3,
  OWNER:   4,
};

export interface OrgMember {
  id: string;
  userId: string;
  organizationId: string;
  role: MemberRole;
}

// Augment Express.Request so downstream handlers can read the resolved member
declare global {
  namespace Express {
    interface Request {
      orgMember?: OrgMember;
    }
  }
}

/**
 * Factory middleware that enforces organization-level access control.
 *
 * Two modes depending on caller context:
 *   - JWT context  (req.user is set): validates membership + role hierarchy.
 *     Attaches req.orgMember for downstream handlers.
 *   - Admin context (req.user absent): only validates the org exists,
 *     because adminAuth already guards the route with x-admin-secret.
 *
 * orgId resolution order: req.params.orgId → x-organization-id header.
 *
 * @param requiredRole  Minimum role required. Defaults to VIEWER (org-exists check for admin).
 */
export const checkOrganizationAccess = (requiredRole: OrgRoleRequirement = MemberRole.VIEWER) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const orgId =
      (req.params.orgId as string | undefined) ||
      (req.headers['x-organization-id'] as string | undefined);

    if (!orgId) {
      res.status(400).json({
        error: 'Missing organizationId: provide it as a URL param (:orgId) or x-organization-id header',
      });
      return;
    }

    // ── Admin context (x-admin-secret): org-existence check only ────────────
    if (!req.user) {
      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org) {
        console.warn(`[checkOrganizationAccess] org not found: ${orgId}`);
        res.status(404).json({ error: 'Organization not found', orgId });
        return;
      }
      return next();
    }

    // ── JWT context: full membership + role hierarchy check ──────────────────
    let member: OrgMember | null;
    try {
      member = await prisma.member.findUnique({
        where: {
          userId_organizationId: {
            userId: req.user.userId,
            organizationId: orgId,
          },
        },
        select: { id: true, userId: true, organizationId: true, role: true },
      });
    } catch (err) {
      console.error('[checkOrganizationAccess] DB error:', err);
      res.status(500).json({ error: 'Internal server error during access check' });
      return;
    }

    if (!member) {
      console.warn(
        `[checkOrganizationAccess] non-member access attempt: userId=${req.user.userId} orgId=${orgId}`
      );
      res.status(403).json({
        error: 'Forbidden: you are not a member of this organization',
        source: 'org_membership',
        code: 'ORG_MEMBERSHIP_REQUIRED',
        orgId,
      });
      return;
    }

    if (ROLE_HIERARCHY[member.role] < ROLE_HIERARCHY[requiredRole]) {
      console.warn(
        `[checkOrganizationAccess] insufficient role: userId=${req.user.userId} ` +
        `orgId=${orgId} role=${member.role} required=${requiredRole}`
      );
      res.status(403).json({
        error: 'Forbidden: insufficient role',
        source: 'org_role',
        code: 'ORG_ROLE_INSUFFICIENT',
        yourRole: member.role,
        requiredRole,
      });
      return;
    }

    req.orgMember = member;
    next();
  };
