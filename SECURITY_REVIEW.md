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

### 2. CORS is wide open
**File:** `backend/src/index.ts` line 27

`app.use(cors())` with no configuration accepts requests from any origin. `TRUSTED_ORIGINS` is documented in `.env.example` and `CLAUDE.md` but is never passed to the cors() call.

**Fix:** Pass the allowed origins list:
```ts
app.use(cors({ origin: process.env.TRUSTED_ORIGINS?.split(',') }));
```

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

### 5. Admin auth is a single shared secret with no identity
**File:** `backend/src/middleware/adminAuth.ts`

The entire `/api/admin` prefix is excluded from `jwtAuth` (see `PUBLIC_ROUTES` in `jwtAuth.ts`). Admin routes are protected only by checking `x-admin-secret` against an env var — a static shared secret. There is:
- No rate limiting or lockout on failed attempts
- No IP restriction
- No user identity attached — audit logs for admin actions are anonymous
- No JWT context, so you cannot know which person performed an admin action

**Fix:** Require a valid JWT in addition to the admin secret, or replace the secret with a dedicated admin role enforced by `jwtAuth`. Add audit logging for every admin action.

---

### 6. ~~`externalReferenceId` injected into GraphQL query without validation~~ — RESOLVED

All query construction is now centralized in `backend/src/services/decompteQueries.ts`. The `validateSupplierId()` function asserts the value is a positive integer before any interpolation occurs. The `orderByDesc` parameter is sanitized to `[a-zA-Z_]` only. Both proxy routes catch the validation error and return 403. The old `tickets.ts` route that had no validation has been deleted.

---

### 7. 2FA backup codes and OTP values stored in plaintext
**Schema:** `TwoFactor.backupCodes` (`String`), `Verification.value` (`String`)

Both are stored as plain text in the database. If the database is compromised, all 2FA backup codes are immediately usable and all pending OTP codes are readable.

**Fix:** Hash backup codes with bcrypt before storing. For OTPs, store only a hash and compare on verification.

---

### 8. No rate limiting
There is no rate limiting on any endpoint. The most exposed surfaces:
- `POST /api/auth/token` — JWT issuance, brute-forceable credentials
- `POST /api/auth/` — login flow
- Proxy endpoints — can exhaust external API quotas

**Fix:** Add `express-rate-limit` at minimum on auth routes. Consider per-IP and per-user limits on proxy endpoints.

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

### 10. RBAC DB query on every request, no caching
**File:** `backend/src/services/rbacService.ts`

`hasRoleAccess()` queries `RoleEndpointMapping` on every single request. Role assignments change infrequently, but this adds a DB round-trip to every API call. Under load this becomes a latency bottleneck and unnecessary DB pressure.

**Fix:** Cache the role-to-endpoint mapping in memory (e.g. a `Map` populated at startup, invalidated when roles change via an admin action).

---

### 11. Missing security headers in NGINX
**File:** `nginx/nginx.conf`

Current headers: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`.

Missing:
- `Content-Security-Policy` — primary XSS defense in modern browsers
- `Strict-Transport-Security` — enforces HTTPS (add after TLS is in place)
- `Referrer-Policy` — prevents leaking URLs in referer headers
- `Permissions-Policy` — restricts access to browser APIs

Note: `X-XSS-Protection: 1; mode=block` is deprecated and ignored by modern browsers. CSP replaces it.

---

### 12. `AuditLog.userId` is not a foreign key
**Schema:** `backend/prisma/schema.prisma`

```prisma
model AuditLog {
  userId String?  // no @relation to User
}
```

There is no referential integrity between `AuditLog` and `User`. Deleting a user silently orphans their audit records with no cascade or restriction. You cannot join from audit logs to users at the DB level. For a security audit trail this is a meaningful gap.

**Fix:** Add a `@relation` with `onDelete: SetNull` (to preserve the log while clearing the user reference) or keep the current nullable field but add a DB-level foreign key constraint.

---

### 13. Swagger UI is publicly accessible
**File:** `backend/src/index.ts` line 32

`/api/docs` is in `PUBLIC_ROUTES` and requires no authentication. Attackers can enumerate all endpoints, parameters, and response schemas without credentials.

**Fix:** In production, either remove the route or gate it behind the admin secret or a JWT.

---

## Low / Investigate

### 14. JWT refresh mechanism
The backend issues JWTs for component-level API calls (`/api/auth/token`), but there is no visible refresh token endpoint or rotation logic in the codebase. Clarify:
- What is the JWT expiry duration?
- How does the frontend get a new token after expiry?
- Is the user silently logged out, or is there a silent refresh?

Long-lived JWTs are a security risk. Short-lived JWTs without refresh cause UX problems.

---

### 15. No request body size limit
**File:** `backend/src/index.ts` line 28

`app.use(express.json())` with no `limit` option defaults to 100kb but this should be made explicit. The 90-second `proxy_read_timeout` in NGINX combined with unconstrained body sizes creates a surface for memory exhaustion or slow-body attacks.

**Fix:**
```ts
app.use(express.json({ limit: '50kb' }));
```
Reduce NGINX `proxy_read_timeout` to a value appropriate for your API (e.g. 30s).

---

### 16. `X-Forwarded-For` without trusted proxy configuration
**File:** `nginx/nginx.conf`

NGINX passes `$proxy_add_x_forwarded_for` but there is no `set_real_ip_from` / `real_ip_header` configuration. If a CDN or load balancer sits in front of NGINX, the IP addresses in this header can be spoofed by clients. Any IP-based logic (rate limiting, audit logging, geo-restrictions) would be unreliable.

---

## Priority Order

| # | Action | Severity |
|---|---|---|
| 1 | ~~Investigate and remove agent log blocks~~ — DONE | ~~Critical~~ |
| 2 | Fix CORS: pass `TRUSTED_ORIGINS` to cors() | Critical |
| 3 | ~~Add TLS to NGINX~~ — DONE | ~~Critical~~ |
| 4 | ~~Remove `POST /api/tickets/graphql`~~ — DONE | ~~Critical~~ |
| 5 | ~~Validate `externalReferenceId` as integer before GraphQL interpolation~~ — DONE | ~~High~~ |
| 6 | Hash 2FA backup codes and OTP values | High |
| 7 | Add rate limiting on auth and proxy routes | High |
| 8 | Add user identity to admin actions / audit log | High |
| 9 | Cache RBAC role lookups in memory | Medium |
| 10 | Auth-gate or remove `/api/docs` in production | Medium |
| 11 | Add CSP, HSTS, Referrer-Policy headers to NGINX | Medium |
| 12 | Add FK constraint or relation for `AuditLog.userId` | Medium |
| 13 | Clarify JWT expiry and refresh strategy | Investigate |
| 14 | Set explicit body size limit in express.json() | Low |
| 15 | Configure `set_real_ip_from` in NGINX if behind a proxy | Low |
