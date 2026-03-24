/**
 * Integration tests — Tenant-scoped JWT routes
 *
 * Covers:
 *   GET /api/orgs/:orgId/profile    (requires VIEWER+)
 *   GET /api/orgs/:orgId/audit-logs (requires ADMIN+)
 *
 * Scenarios tested per endpoint:
 *   - No Authorization header → 401
 *   - Valid JWT but user is NOT a member → 403 (not a member)
 *   - Valid JWT, member with insufficient role → 403 (insufficient role)
 *   - Valid JWT, member with sufficient role → 200
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { MemberRole } from '@prisma/client';
import {
  buildApp, prisma, signJwt,
  createTestUser, createTestOrgWithMember,
  cleanupTestOrgs, cleanupTestUsers,
} from './helpers';

const app = buildApp();
const SLUG_PREFIX  = 'test-jwt-org-';
const EMAIL_SUFFIX = '@jwt-org-test.local';

let orgId: string;
let ownerId: string;
let ownerEmail: string;
let outsiderId: string;
let outsiderEmail: string;
let ownerJwt:   string;
let adminJwt:   string;
let managerJwt: string;
let viewerJwt:  string;
let outsiderJwt: string;

beforeAll(async () => {
  const owner   = await createTestUser(`owner${EMAIL_SUFFIX}`);
  const admin   = await createTestUser(`admin${EMAIL_SUFFIX}`);
  const manager = await createTestUser(`manager${EMAIL_SUFFIX}`);
  const viewer  = await createTestUser(`viewer${EMAIL_SUFFIX}`);
  const outsider = await createTestUser(`outsider${EMAIL_SUFFIX}`);

  ownerId = owner.id;
  ownerEmail = owner.email;
  outsiderId = outsider.id;
  outsiderEmail = outsider.email;

  const org = await createTestOrgWithMember(`${SLUG_PREFIX}main`, owner.id, MemberRole.OWNER);
  orgId = org.id;
  await prisma.member.createMany({
    data: [
      { userId: admin.id,   organizationId: orgId, role: MemberRole.ADMIN },
      { userId: manager.id, organizationId: orgId, role: MemberRole.MANAGER },
      { userId: viewer.id,  organizationId: orgId, role: MemberRole.VIEWER },
    ],
    skipDuplicates: true,
  });

  ownerJwt   = signJwt(owner.id,   owner.email);
  adminJwt   = signJwt(admin.id,   admin.email);
  managerJwt = signJwt(manager.id, manager.email);
  viewerJwt  = signJwt(viewer.id,  viewer.email);
  outsiderJwt= signJwt(outsider.id, outsider.email);
});

/**
 * Decode the payload part of a JWT without verifying the signature.
 * This is purely for test-time inspection / tampering simulations.
 */
function decodeJwtPayload(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT structure');
  }
  const payloadB64 = parts[1]
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4);
  const json = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(json);
}

/**
 * Return a new JWT string using the original header and signature, but with a
 * modified payload. This mimics an attacker editing the payload without
 * re-signing (so the HMAC signature no longer matches).
 */
function tamperJwtPayload(
  token: string,
  overrides: Record<string, unknown>
): string {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT structure');
  }
  const [headerB64, payloadB64, signature] = parts;

  const currentPayload = decodeJwtPayload(token);
  const newPayload = { ...currentPayload, ...overrides };
  const json = JSON.stringify(newPayload);

  const newPayloadB64 = Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `${headerB64}.${newPayloadB64}.${signature}`;
}

afterAll(async () => {
  await cleanupTestOrgs(SLUG_PREFIX);
  await cleanupTestUsers(EMAIL_SUFFIX);
  await prisma.$disconnect();
});

// ─── GET /api/orgs/:orgId/profile (VIEWER+) ──────────────────────────────────

describe('GET /api/orgs/:orgId/profile', () => {
  const path = () => `/api/orgs/${orgId}/profile`;

  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).get(path());
    expect(res.status).toBe(401);
  });

  it('returns 403 for outsider (not a member)', async () => {
    const res = await request(app).get(path()).set('Authorization', `Bearer ${outsiderJwt}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not a member/i);
    expect(res.body.source).toBe('org_membership');
    expect(res.body.code).toBe('ORG_MEMBERSHIP_REQUIRED');
  });

  it('returns 200 for VIEWER', async () => {
    const res = await request(app).get(path()).set('Authorization', `Bearer ${viewerJwt}`);
    expect(res.status).toBe(200);
    expect(res.body.organization).toHaveProperty('id', orgId);
    expect(res.body.member).toHaveProperty('role', 'VIEWER');
  });

  it('returns 200 for MANAGER', async () => {
    const res = await request(app).get(path()).set('Authorization', `Bearer ${managerJwt}`);
    expect(res.status).toBe(200);
    expect(res.body.member.role).toBe('MANAGER');
  });

  it('returns 200 for OWNER', async () => {
    const res = await request(app).get(path()).set('Authorization', `Bearer ${ownerJwt}`);
    expect(res.status).toBe(200);
    expect(res.body.member.role).toBe('OWNER');
  });
});

// ─── GET /api/orgs/:orgId/audit-logs (ADMIN+) ────────────────────────────────

describe('GET /api/orgs/:orgId/audit-logs', () => {
  const path = () => `/api/orgs/${orgId}/audit-logs`;

  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).get(path());
    expect(res.status).toBe(401);
  });

  it('returns 403 for outsider (not a member)', async () => {
    const res = await request(app).get(path()).set('Authorization', `Bearer ${outsiderJwt}`);
    expect(res.status).toBe(403);
  });

  it('returns 403 for VIEWER (insufficient role)', async () => {
    const res = await request(app).get(path()).set('Authorization', `Bearer ${viewerJwt}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/insufficient role/i);
    expect(res.body.source).toBe('org_role');
    expect(res.body.code).toBe('ORG_ROLE_INSUFFICIENT');
    expect(res.body.yourRole).toBe('VIEWER');
    expect(res.body.requiredRole).toBe('ADMIN');
  });

  it('returns 403 for MANAGER (insufficient role)', async () => {
    const res = await request(app).get(path()).set('Authorization', `Bearer ${managerJwt}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 for ADMIN', async () => {
    const res = await request(app).get(path()).set('Authorization', `Bearer ${adminJwt}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 200 for OWNER', async () => {
    const res = await request(app).get(path()).set('Authorization', `Bearer ${ownerJwt}`);
    expect(res.status).toBe(200);
  });
});

// ─── JWT Tampering & Forgery Resistance ───────────────────────────────────────

describe('JWT tampering & forgery resistance', () => {
  const profilePath = () => `/api/orgs/${orgId}/profile`;
  const auditLogsPath = () => `/api/orgs/${orgId}/audit-logs`;

  it('rejects a token where the userId in the payload is tampered to another valid user', async () => {
    const tampered = tamperJwtPayload(outsiderJwt, { userId: ownerId });

    const res = await request(app)
      .get(profilePath())
      .set('Authorization', `Bearer ${tampered}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid or expired token/i);
  });

  it('rejects a token signed with the wrong secret even if the payload looks valid', async () => {
    const forged = jwt.sign(
      { userId: ownerId, email: ownerEmail, roles: [] },
      'not_the_real_jwt_secret',
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .get(profilePath())
      .set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid or expired token/i);
  });

  it('rejects a token where roles are elevated in the payload without re-signing', async () => {
    const tampered = tamperJwtPayload(viewerJwt, { roles: ['ADMIN'] });

    const res = await request(app)
      .get(auditLogsPath())
      .set('Authorization', `Bearer ${tampered}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid or expired token/i);
  });
});

// ─── RBAC global 403 ──────────────────────────────────────────────────────────

describe('RBAC global 403', () => {
  const rbacEmail = `rbac-no-role${EMAIL_SUFFIX}`;
  const rbacSlug = `${SLUG_PREFIX}rbac`;
  let rbacTestOrgId: string;
  let rbacTestUserJwt: string;
  let rbacRoleName = 'RestrictedRole-' + Date.now();

  beforeAll(async () => {
    const user = await createTestUser(rbacEmail);
    const org = await createTestOrgWithMember(rbacSlug, user.id, MemberRole.VIEWER);
    rbacTestOrgId = org.id;
    rbacTestUserJwt = signJwt(user.id, user.email);

    // Create a role and a mapping for the profile route
    await prisma.role.create({
      data: {
        name: rbacRoleName,
        endpointMappings: {
          create: {
            endpoint: `/api/orgs/${rbacTestOrgId}/profile`,
            method: 'GET'
          }
        }
      }
    });

    // Invalidate the RBAC cache
    const { invalidateRbacCache } = require('../src/lib/rbac');
    invalidateRbacCache();
  });

  afterAll(async () => {
    await prisma.roleEndpointMapping.deleteMany({
      where: { endpoint: `/api/orgs/${rbacTestOrgId}/profile` }
    });
    await prisma.role.deleteMany({ where: { name: rbacRoleName } });
    await prisma.member.deleteMany({ where: { organizationId: rbacTestOrgId } });
    await prisma.organization.delete({ where: { id: rbacTestOrgId } });
    await prisma.user.deleteMany({ where: { email: rbacEmail } });
  });

  it('returns 403 with rbac_global source when blocked by RoleEndpointMapping', async () => {
    const res = await request(app)
      .get(`/api/orgs/${rbacTestOrgId}/profile`)
      .set('Authorization', `Bearer ${rbacTestUserJwt}`);

    expect(res.status).toBe(403);
    expect(res.body.source).toBe('rbac_global');
    expect(res.body.code).toBe('RBAC_ROLE_ENDPOINT_DENIED');
  });
});

