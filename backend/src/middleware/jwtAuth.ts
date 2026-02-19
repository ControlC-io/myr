import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

export interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
}

// Augment Express Request to carry the decoded JWT user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      userRoles?: string[];
    }
  }
}

/**
 * Routes that do not require a JWT.
 * Matching is done against `${method}:${path}` or `*:${path}` for method wildcards.
 */
const PUBLIC_ROUTES: Array<{ method: string; pathPrefix: string }> = [
  { method: 'GET',  pathPrefix: '/api/health' },
  { method: 'GET',  pathPrefix: '/api/docs' },
  { method: 'GET',  pathPrefix: '/api$' },   // exact /api only
  { method: 'POST', pathPrefix: '/api/auth/token' },
  { method: 'POST', pathPrefix: '/api/auth/verify-otp' },
  { method: '*',    pathPrefix: '/api/auth/' },
  { method: '*',    pathPrefix: '/api/admin' },  // admin uses x-admin-secret via adminAuth
];

function isPublicRoute(method: string, path: string): boolean {
  return PUBLIC_ROUTES.some(({ method: m, pathPrefix }) => {
    const methodMatch = m === '*' || m === method.toUpperCase();
    // Support a trailing $ to signal an exact match
    const exactMatch = pathPrefix.endsWith('$');
    const cleanPrefix = exactMatch ? pathPrefix.slice(0, -1) : pathPrefix;
    const pathMatch = exactMatch ? path === cleanPrefix : path.startsWith(cleanPrefix);
    return methodMatch && pathMatch;
  });
}

/**
 * Check whether any of a user's roles grant access to a given endpoint + method.
 *
 * Logic:
 *  1. If NO role in the system has any mapping covering this path+method, allow
 *     access for any authenticated user (RBAC is opt-in / admin-configured).
 *  2. If at least one mapping exists system-wide for this path+method, only
 *     allow if the requesting user's roles contain a matching mapping.
 *
 * A mapping covers a path when:
 *  - endpoint matches the request path exactly OR is a prefix of the request path
 *  - method is either `*` or matches the request method (case-insensitive)
 */
async function hasRoleAccess(
  userId: string,
  requestMethod: string,
  requestPath: string
): Promise<boolean> {
  // Counter write: treat increment and decrement as one permission (either mapping allows both)
  const COUNTER_WRITE_PATHS = ['/api/counter/increment', '/api/counter/decrement'];
  const isCounterWrite =
    requestMethod.toUpperCase() === 'POST' &&
    COUNTER_WRITE_PATHS.includes(requestPath);

  function mappingCoversRequest(endpoint: string, method: string): boolean {
    const methodMatch =
      method === '*' || method.toUpperCase() === requestMethod.toUpperCase();
    let pathMatch =
      requestPath === endpoint ||
      requestPath.startsWith(endpoint.endsWith('/') ? endpoint : `${endpoint}/`);
    if (!pathMatch && isCounterWrite && methodMatch) {
      pathMatch =
        endpoint === '/api/counter' ||
        COUNTER_WRITE_PATHS.includes(endpoint);
    }
    return methodMatch && pathMatch;
  }

  // Check whether any mapping in the system covers this request
  const systemWideMappings = await prisma.roleEndpointMapping.findMany({});
  const anyMappingExists = systemWideMappings.some((m) =>
    mappingCoversRequest(m.endpoint, m.method)
  );

  // No mappings configured → allow any authenticated user
  if (!anyMappingExists) {
    return true;
  }

  // Mappings exist: check whether this user's roles grant access
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: { endpointMappings: true },
      },
    },
  });

  for (const ur of userRoles) {
    for (const mapping of ur.role.endpointMappings) {
      if (mappingCoversRequest(mapping.endpoint, mapping.method)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Centralized JWT authentication + RBAC middleware.
 *
 * 1. Skips public routes.
 * 2. Extracts and verifies the Bearer JWT from the Authorization header.
 * 3. Loads user roles and checks endpoint access via RoleEndpointMapping.
 * 4. Attaches decoded payload to req.user for downstream handlers.
 */
export const jwtAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (isPublicRoute(req.method, req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error('JWT_SECRET is not set');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, secret) as JwtPayload;
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: invalid or expired token' });
    return;
  }

  // Attach user info early so downstream handlers can use it even before RBAC check
  req.user = payload;
  req.userRoles = payload.roles;

  // RBAC: verify the user has a role that permits this endpoint
  const allowed = await hasRoleAccess(payload.userId, req.method, req.path);
  if (!allowed) {
    res.status(403).json({
      error: 'Forbidden: your role does not have access to this endpoint',
      endpoint: req.path,
      method: req.method,
    });
    return;
  }

  next();
};
