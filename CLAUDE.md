# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MyR is a secure DMZ-architecture application with network segmentation. Frontends live in a DMZ network and never touch the database directly — only the backend can reach PostgreSQL and the email service.

## Architecture

```
DMZ Network:        NGINX (80/8080/443) → main_frontend (5173) / admin_frontend (5174)
Internal Network:   backend (3000) → PostgreSQL (5432) + email_service (3001)
```

NGINX proxies `/api/*` → backend, serves frontends as static/dev servers. The backend is the sole gateway between the DMZ and internal data.

**Auth flow**: Better Auth handles sessions (cookie-based); the backend also issues JWTs for client-side use. Both tokens coexist — sessions for web pages, JWTs for API calls from components.

**RBAC**: `RoleEndpointMapping` table maps roles to (HTTP method + endpoint path). The `jwtAuth` middleware enforces this per-request after verifying the JWT.

**Multi-tenancy**: Organizations are isolated via the `Member` model. Org-scoped routes live under `/api/orgs/:orgId/*`.

## Commands

### Full Stack (Docker)
```bash
docker-compose up --build -d          # Start all services
docker-compose logs -f backend        # Tail backend logs
docker exec backend_api npm run seed  # Seed database
npx prisma db push                    # Apply schema changes
npx prisma studio                     # Visual DB browser (localhost:5555)
```

### Backend (local dev)
```bash
cd backend
npm run dev          # ts-node-dev with hot reload (port 3000)
npm run build        # tsc compile to dist/
npm run test         # Jest integration tests (runs in band)
npm run seed         # Seed DB via ts-node src/scripts/seed.ts
npm run prisma:push  # prisma db push
```

### Frontend (local dev)
```bash
cd main_frontend && npm run dev    # Vite dev server (port 5173)
cd admin_frontend && npm run dev   # Vite dev server (port 5174)
npm run lint                       # ESLint (max-warnings 0)
npm run build                      # tsc + vite build
```

### Running a single test file
```bash
cd backend && npx jest tests/admin.members.test.ts --runInBand
```

### Local dev without Docker
Run only PostgreSQL in Docker:
```bash
docker-compose up postgres -d
```
Then run backend and frontends locally. Set `DATABASE_URL` in backend `.env` to point to `localhost:5432`.

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/index.ts` | Express entry: route mounting, middleware setup, public route allowlist |
| `backend/src/lib/auth.ts` | Better Auth config + `loadAuthConfig()` (reads SystemSettings from DB) |
| `backend/src/middleware/jwtAuth.ts` | Central JWT verification + RBAC enforcement (skips public routes) |
| `backend/src/middleware/adminAuth.ts` | Admin-only guard (checks `admin` role) |
| `backend/src/services/rbacService.ts` | RBAC logic: resolves user roles → allowed endpoints |
| `backend/src/services/organizationAccessService.ts` | Validates user membership in org before scoped access |
| `backend/src/services/proxyService.ts` | `proxyGraphQL()` — single caller for the Decompte external GraphQL API |
| `backend/src/services/decompteQueries.ts` | All Decompte GraphQL query builders (`buildSupplierQuery`, `buildTicketsQuery`). Update here when the external API changes fields or arguments. |
| `backend/src/lib/rbac.ts` | RBAC helpers and role constants |
| `backend/prisma/schema.prisma` | 20-model schema: User, Org, Member, Role, AuditLog, etc. |
| `shared/auth/AuthProvider.tsx` | React context: session + JWT state, `useAuth()` hook |
| `shared/auth/authClient.ts` | Better Auth browser client init |
| `nginx/nginx.conf` | Reverse proxy rules, security headers |
| `backend/tests/helpers.ts` | Test utilities: build app, create test users/orgs, sign JWTs |

## Code Conventions (from .cursorrules)

- **TypeScript strict mode everywhere** — no `any`, no implicit types
- **Const over let**, functional patterns
- **All async code** uses try/catch blocks
- **No hardcoded config** — all from env vars or the `SystemSettings` DB table
- **English only** in code, comments, and user-facing strings
- **No hyphens in text** — use spaces or underscores in docs/comments

## Database

PostgreSQL 16 via Prisma ORM. Schema is in `backend/prisma/schema.prisma`.

Key models:
- `User` / `Account` / `Session` — Better Auth models
- `Organization` / `Member` — multi-tenancy (Member links User→Org with role: OWNER/ADMIN/MANAGER/VIEWER)
- `Role` / `UserRole` / `RoleEndpointMapping` — RBAC
- `SystemSettings` — dynamic feature flags (auth provider toggles, JSON config)
- `AuditLog` — action trail with user, org, details, timestamp
- `TwoFactor` / `Verification` — 2FA (TOTP + email OTP)

## Testing

Tests are in `backend/tests/`. They use Jest + Supertest against a real PostgreSQL database (the test DATABASE_URL must point to an accessible instance). Tests run with `--runInBand` (sequential) to avoid DB conflicts.

`helpers.ts` exposes `buildApp()`, `createTestUser()`, `createTestOrg()`, and JWT signing utilities for test setup.

## Environment Variables

See `.env.example` at the root. Critical vars:
- `DATABASE_URL` — Prisma connection string
- `JWT_SECRET` / `BETTER_AUTH_SECRET` — signing secrets
- `TRUSTED_ORIGINS` — CORS allowlist (must include admin frontend origin)
- `EMAIL_SERVICE_SECRET` — shared secret between backend and email microservice
- `DECOMPTE_API_BASE` / `DECOMPTE_API_KEY` — external accounting API proxy
