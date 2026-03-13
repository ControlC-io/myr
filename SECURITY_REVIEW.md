# Security Review — Infrastructure Analysis

> Date: 2026-03-12
> Scope: Full stack (NGINX, Express backend, PostgreSQL schema, frontend auth flow)

---

## Critical

### 1. ~~Suspicious exfiltration code in `tickets.ts`~~ — RESOLVED

**Root cause identified and all blocks removed.**

The `#region agent log` blocks were instrumentation injected by the `webapp-testing` Claude Code agent skill during development sessions. The skill instruments code with telemetry to test runtime hypotheses. They were never cleaned up and got committed.

**Affected files (all cleaned):**
- `backend/src/routes/tickets.ts` — sent `suppliersIdAssign` and pagination params to port 7903
- `admin_frontend/src/pages/Login.tsx` — sent **admin email addresses** on every login attempt to port 7713
- `admin_frontend/src/pages/TwoFactorChallenge.tsx` — sent 2FA flow state to port 7713
- `admin_frontend/src/pages/EmailOtpChallenge.tsx` — sent OTP flow state to port 7713

The targets were `127.0.0.1` (localhost), so no data was sent to external servers. In production the calls failed silently. However, during development sessions where the agent skill listener was running, **admin email addresses were exposed on every login**. All blocks have been removed and verified clean.

---

### 2. ~~CORS is wide open~~ — RESOLVED

`cors()` now receives `{ origin: corsAllowedOrigins, credentials: true }` where `corsAllowedOrigins` is parsed from `TRUSTED_ORIGINS`. Express trust proxy is enabled so rate limiters see real client IPs. `BETTER_AUTH_URL` and `TRUSTED_ORIGINS` in `.env` updated to use HTTPS origins (`https://localhost`) to match TLS-terminated traffic from NGINX.

---

### 3. ~~No TLS~~ — RESOLVED

TLS is now active on both frontends. Self-signed certificates are used for local development.

**What was added:**
- `nginx/certs/localhost.crt` + `localhost.key` — self-signed dev cert (gitignored, generated locally)
- `nginx/generate-dev-certs.sh` — one-time cert generation script (run before first `docker-compose up`)
- `nginx/nginx.conf` — HTTP 80 → HTTPS 443 redirect + TLS server block for main frontend; HTTP 8080 → HTTPS 8443 redirect + TLS server block for admin frontend
- `docker-compose.yml` — port 8443 exposed, `./nginx/certs` mounted read-only into nginx container
- HSTS header added: `Strict-Transport-Security: max-age=31536000`
- TLS 1.2 + 1.3 only, strong cipher suite

**For production:** replace `nginx/certs/localhost.crt` and `localhost.key` with real certificates from your CA or Let's Encrypt (certbot). The nginx.conf paths stay the same (`/etc/nginx/certs/`). Increase HSTS `max-age` to `63072000` and add `; includeSubDomains; preload`.

---

### 4. ~~Old tickets route still accessible~~ — RESOLVED

`backend/src/routes/tickets.ts` and its registration in `index.ts` have been removed. `POST /api/tickets/graphql` no longer exists. All ticket access now goes through `POST /api/orgs/:orgId/proxy/tickets` which enforces org membership.

---

## High

### 5. Admin auth is a single shared secret with no identity — PARTIALLY RESOLVED

Rate limiting is now applied to `/api/admin` (100 req / 15 min per IP). All admin audit log entries now include `adminIp` in the `details` field for basic traceability. Full identity still requires either a JWT requirement alongside the secret or migrating admin routes to JWT + RBAC — that is a larger refactor tracked separately.

---

### 6. ~~`externalReferenceId` injected into GraphQL query without validation~~ — RESOLVED

All query construction is now centralized in `backend/src/services/decompteQueries.ts`. The `validateSupplierId()` function asserts the value is a positive integer before any interpolation occurs. The `orderByDesc` parameter is sanitized to `[a-zA-Z_]` only. Both proxy routes catch the validation error and return 403. The old `tickets.ts` route that had no validation has been deleted.

---

### 7. ~~OTP values stored in plaintext~~ — PARTIALLY RESOLVED

OTP codes in `Verification.value` are now hashed with bcrypt (cost 10) before storage. `verify-otp` uses `bcrypt.compare` instead of direct equality. Backup codes in `TwoFactor.backupCodes` are managed by Better Auth internally — that library stores them in its own format and is outside our control without forking.

---

### 8. ~~No rate limiting~~ — RESOLVED

`express-rate-limit` added. Limits: auth sign-in/sign-up/token endpoints: 20 req per 15 min per IP; admin endpoints: 100 req per 15 min per IP. `app.set('trust proxy', 1)` ensures real client IPs are used behind NGINX. Proxy endpoints still unrestricted — add per-user quotas if Decompte API has billing limits.

---

## Medium

### 9. Two overlapping, uncoordinated RBAC systems
The app has two independent access control layers that every new route must satisfy:

| System | Where | Enforced by |
|---|---|---|
| `Role` / `RoleEndpointMapping` | Endpoint level | `jwtAuth` middleware |
| `MemberRole` (OWNER/ADMIN/MANAGER/VIEWER) | Org membership level | `checkOrganizationAccess()` |

These are not coordinated. Granting access to a new org-scoped route requires correctly updating two separate tables. It is easy to grant one and forget the other. The mental model for "can this user do this?" spans two different DB queries with different logic.

**Investigate:** Decide whether endpoint-level RBAC is necessary in addition to org-level RBAC, or whether one system can be simplified away.

---

### 10. ~~RBAC DB query on every request, no caching~~ — RESOLVED

`lib/rbac.ts` now caches the full `RoleEndpointMapping` table in memory with a 60-second TTL. `invalidateRbacCache()` is exported and called from `routes/roles.ts` after any endpoint mapping create or delete, so changes take effect immediately rather than waiting for TTL expiry.

---

### 11. ~~Missing security headers in NGINX~~ — RESOLVED

Added to both HTTPS server blocks: `Content-Security-Policy` (allows unsafe-inline/eval for Vite dev — tighten in production), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. Removed deprecated `X-XSS-Protection`. HSTS was already present. `set_real_ip_from` added for Docker subnets.

---

### 12. ~~`AuditLog.userId` is not a foreign key~~ — RESOLVED

Added `user User? @relation(fields: [userId], references: [id], onDelete: SetNull)` to `AuditLog` and `auditLogs AuditLog[]` to `User`. Deleting a user now sets `userId` to null on their audit records rather than orphaning them. Run `prisma db push` (or `docker exec backend_api npx prisma db push`) to apply the FK constraint.

---

### 13. ~~Swagger UI is publicly accessible~~ — RESOLVED

In production (`NODE_ENV=production`), the `adminAuth` middleware is mounted before the Swagger UI handler, requiring `x-admin-secret` to access `/api/docs`. In development the route remains open for convenience.

---

## Low / Investigate

### 14. JWT refresh mechanism
The backend issues JWTs for component-level API calls (`/api/auth/token`), but there is no visible refresh token endpoint or rotation logic in the codebase. Clarify:
- What is the JWT expiry duration?
- How does the frontend get a new token after expiry?
- Is the user silently logged out, or is there a silent refresh?

Long-lived JWTs are a security risk. Short-lived JWTs without refresh cause UX problems.

---

### 15. ~~No request body size limit~~ — RESOLVED

`express.json({ limit: '50kb' })` and `express.urlencoded({ limit: '50kb' })` are now explicit. NGINX `proxy_read_timeout` remains at 90s — reduce to 30s in production once confirmed no legitimate long-running endpoints exist.

---

### 16. ~~`X-Forwarded-For` without trusted proxy configuration~~ — RESOLVED

Added `real_ip_header X-Forwarded-For` and `set_real_ip_from` for Docker subnets (172.16/12, 10.0/8, 127.0.0.1) in `nginx/nginx.conf`. If a CDN or upstream load balancer is added in production, add its subnet to `set_real_ip_from`.

---

## Priority Order

| # | Action | Severity |
|---|---|---|
| 1 | ~~Investigate and remove agent log blocks~~ — DONE | ~~Critical~~ |
| 2 | ~~Fix CORS: pass `TRUSTED_ORIGINS` to cors()~~ — DONE | ~~Critical~~ |
| 3 | ~~Add TLS to NGINX~~ — DONE | ~~Critical~~ |
| 4 | ~~Remove `POST /api/tickets/graphql`~~ — DONE | ~~Critical~~ |
| 5 | ~~Validate `externalReferenceId` as integer before GraphQL interpolation~~ — DONE | ~~High~~ |
| 6 | ~~Hash OTP values before storage~~ — DONE (backup codes: Better Auth internal) | ~~High~~ |
| 7 | ~~Add rate limiting on auth and proxy routes~~ — DONE | ~~High~~ |
| 8 | ~~Add IP identity to admin audit log~~ — DONE (full JWT auth for admin: future) | ~~High~~ |
| 9 | ~~Cache RBAC role lookups in memory~~ — DONE | ~~Medium~~ |
| 10 | ~~Auth-gate `/api/docs` in production~~ — DONE | ~~Medium~~ |
| 11 | ~~Add CSP, Referrer-Policy, Permissions-Policy headers to NGINX~~ — DONE | ~~Medium~~ |
| 12 | ~~Add FK constraint for `AuditLog.userId`~~ — DONE (apply with `prisma db push`) | ~~Medium~~ |
| 13 | Clarify JWT expiry and refresh strategy | Investigate |
| 14 | ~~Set explicit body size limit in express.json()~~ — DONE | ~~Low~~ |
| 15 | ~~Configure `set_real_ip_from` in NGINX~~ — DONE | ~~Low~~ |
