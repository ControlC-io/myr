# Multi-Tenant Architecture & Auth Specification

This document serves as the primary reference for the Database Schema, Authentication Flow, and Security Middleware. It follows the **Secure Gateway Pattern** (Option 1 Architecture).

> **Source of truth:** For the live API surface, always refer to Swagger at `/api/docs` (served by the backend at `http://localhost:<PORT>/api/docs` or via nginx at `http://localhost/api/docs`).  
> This document is a higher‑level architectural guide and may describe both **current behavior** and **future/optional extensions**, which are explicitly labeled.

## 1. Database Schema (Prisma)

The system uses a **Multi-tenant RBAC (Role-Based Access Control)** model. Roles are contextual and tied to the Organization, not the User.

This section documents the current Prisma schema as implemented in `backend/prisma/schema.prisma`. Some tables are:
- **Domain-level multi‑tenant/RBAC models** (User, Organization, Member, AuditLog, SystemSettings, MemberRole).
- **Infrastructure models owned by Better Auth** (Account, Session, TwoFactor, Verification).
- **Gateway‑level RBAC models** (Role, UserRole, RoleEndpointMapping) used by the JWT middleware.

### 1.1 User Table (Better Auth Default)
Core identity managed by Better Auth, extended with RBAC and 2FA flags.
* `id`: String (Primary Key, UUID).
* `email`: String (Unique).
* `emailVerified`: Boolean (default `false`).
* `name`: String (Optional).
* `password`: String (Optional, credential storage for Better Auth).
* `image`: String (Optional).
* `twoFactorEnabled`: Boolean (default `false`).
* `createdAt`: DateTime (default `now()`).
* `updatedAt`: DateTime (`@updatedAt`).
* Relations:
  * `accounts`: `Account[]` (OAuth / credential accounts).
  * `sessions`: `Session[]`.
  * `twoFactor`: `TwoFactor?`.
  * `userRoles`: `UserRole[]`.
  * `members`: `Member[]`.

> Mapped to DB table `users`.

### 1.2 Organization Table
Represents isolated business entities (tenants).
* `id`: String (UUID Primary Key).
* `name`: String (e.g., "Company A").
* `slug`: String (Unique, URL friendly).
* `externalReferenceId`: String (Optional, for internal API mapping / supplier id).
* `createdAt`: DateTime (default `now()`).
* Relations:
  * `members`: `Member[]`.
  * `auditLogs`: `AuditLog[]`.

> Mapped to DB table `organizations`.

### 1.3 Member Table (The Link / Tenant RBAC)
Defines the relationship and specific role of a User within an Organization.
* `id`: String (UUID Primary Key).
* `userId`: String (Foreign Key -> `User.id`).
* `organizationId`: String (Foreign Key -> `Organization.id`).
* `role`: Enum `MemberRole` (`OWNER`, `ADMIN`, `MANAGER`, `VIEWER`) with default `VIEWER`.
* Constraints:
  * `@@unique([userId, organizationId])` – a user has at most one membership per organization.

> Mapped to DB table `members`.

### 1.4 MemberRole Enum
Defines the tenant‑scoped hierarchy used by `checkOrganizationAccess`:
* `OWNER` (highest privileges).
* `ADMIN`.
* `MANAGER`.
* `VIEWER` (read‑only).

### 1.5 AuditLog Table (Security Monitoring)
Tracks sensitive actions and internal proxy calls.
* `id`: String (UUID Primary Key).
* `action`: String (e.g., `PROXY_API_CALL`, `AUTH_TOGGLE`, `SIGN_IN`).
* `userId`: String (Optional FK -> `User.id`).
* `organizationId`: String (Optional FK -> `Organization.id`).
* `details`: JSON (Metadata like IP, payload, or response status).
* `timestamp`: DateTime (default `now()`).

> Mapped to DB table `audit_logs`.

### 1.6 SystemSettings Table (Admin Control)
Global feature flags for the Super Admin.
* `id`: String (UUID Primary Key).
* `settingKey`: String (Unique).
* `isEnabled`: Boolean (default `false`).
* `providerConfig`: JSON (Optional, stores provider‑specific config; named `providerConfig` in Prisma).
* Timestamps:
  * `createdAt`: DateTime (default `now()`).
  * `updatedAt`: DateTime (`@updatedAt`).

> Mapped to DB table `system_settings`.

### 1.7 Better Auth Infrastructure Tables
These tables are managed by Better Auth and should rarely be touched directly from business logic:

* `Account` (`accounts`):
  * Links a user to an OAuth/credential provider.
  * Fields: `providerId`, `accountId`, `accessToken`, `refreshToken`, `idToken`, etc.
  * Relation: `user` (`User`).

* `Session` (`sessions`):
  * Represents Better Auth sessions; uses `token` (not `sessionToken`).
  * Fields: `userId`, `token`, `expiresAt`, `ipAddress`, `userAgent`.

* `TwoFactor` (`two_factor`):
  * Stores TOTP secret and backup codes per user.
  * Fields: `secret`, `backupCodes`, `userId`.

* `Verification` (`verification`):
  * Generic verification tokens used by Better Auth (email verification, OTP, etc.).
  * Fields: `identifier`, `value`, `expiresAt`.

### 1.8 Gateway RBAC Tables (Endpoint‑Level RBAC)
These models power the centralized JWT middleware and are separate from tenant `MemberRole`:

* `Role` (`roles`):
  * `id`, `name` (unique), `description`, timestamps.
  * Relations: `userRoles`, `endpointMappings`.

* `UserRole` (`user_roles`):
  * Junction User ↔ Role.
  * Unique constraint on `(userId, roleId)`.

* `RoleEndpointMapping` (`role_endpoint_mappings`):
  * Maps a role to an API endpoint and HTTP method (e.g. `GET /api/admin/settings`).
  * Unique constraint on `(roleId, endpoint, method)`.

---

## 2. Security & Request Lifecycle

The Backend acts as a **Secure Gateway** between the DMZ and the Internal Infrastructure.

> **Note on the architecture diagram (`docs/assets/multi_tenant_architecture_auth_spec.png`):**
> The diagram is a target-state design and includes elements not yet implemented:
> - "Rate Limiting / Threat Detection" — not implemented (open item in SECURITY_REVIEW.md).
> - "Route Validation Service", "Analytics/Audit", "User Profile Service" — aspirational internal APIs, not present in current code.
> What is implemented today: the Secure Gateway (backend), PostgreSQL, JWT + org-level RBAC middleware, and the Decompte proxy routes.

### 2.1 Deep Validation Middleware
Every request to a protected endpoint must pass through the `checkOrganizationAccess` middleware:
1. **Identity Verification**: Validate the JWT/Session via Better Auth.
2. **Context Extraction**: Get `organizationId` from the URL params or headers.
3. **Membership Check**: Query the `Member` table to ensure the `userId` belongs to the `organizationId`.
4. **Role Check**: Verify if the user's role meets the required permission level for the operation.

### 2.2 Internal Proxy Pattern
Once authorized, the Backend performs the request to the internal private API:
* **Input**: Organization ID and user intent.
* **Backend Action**: Executes a secure call (native `fetch`) to the internal URL.
* **Output**: Data is returned to the Frontend only after successful authorization and optional data sanitization.

Concretely, the implementation today uses:

- `jwtAuth` middleware (`backend/src/middleware/jwtAuth.ts`) to:
  - Validate the Bearer JWT (`Authorization: Bearer <token>`).
  - Attach the decoded payload (`userId`, `email`, `roles`) to `req.user`.
  - Enforce endpoint‑level RBAC via `RoleEndpointMapping` and `hasRoleAccess`.
- `checkOrganizationAccess` middleware (`backend/src/middleware/auth.ts`) to:
  - Resolve `orgId` from `:orgId` route param or `x-organization-id` header.
  - Validate membership in `Member` and role hierarchy based on `MemberRole`.
  - Attach `req.orgMember` for downstream handlers.

The external API proxy uses two dedicated services (native `fetch`, no axios):
- `backend/src/services/proxyService.ts` — single HTTP caller for the Decompte GraphQL endpoint. Reads `DECOMPTE_API_BASE`, `DECOMPTE_API_KEY`, `DECOMPTE_API_BEARER` from env. All external API calls go through here.
- `backend/src/services/decompteQueries.ts` — all GraphQL query builders (`buildSupplierQuery`, `buildTicketsQuery`). Also validates `externalReferenceId` as a safe integer before interpolation. **This is the only file to update when the external API changes its query structure.**

Example tenant‑aware routes (implemented in `backend/src/routes/organizationResources.ts`):

- `GET /api/orgs/{orgId}/profile` – requires at least `VIEWER`.
- `GET /api/orgs/{orgId}/audit-logs` – requires at least `ADMIN` and is fully paginated.
- `POST /api/orgs/{orgId}/proxy/supplier` – requires `VIEWER`. Proxies GraphQL to Decompte using `org.externalReferenceId` as the supplier ID.
- `POST /api/orgs/{orgId}/proxy/tickets` – requires `VIEWER`. Same pattern, returns paginated ticket list.

---

## 3. Administrative Requirements

### 3.1 Pagination Pattern
All listing endpoints (Logs, Users, Settings) must implement standard pagination:
* `GET /api/orgs/:orgId/resource?page=1&limit=20`

### 3.2 2FA (Two-Factor Authentication)

**Current implementation (code today)**  
* **Method**: TOTP (Time‑based One‑Time Password) via Better Auth `twoFactor` plugin configured in `backend/src/lib/auth.ts`.  
* **Storage**: `TwoFactor` table holds the shared secret and backup codes per user.  
* **Toggle**: `User.twoFactorEnabled` indicates whether 2FA is active for the account.  
* **Audit logs**: sign‑in, sign‑up and sign‑out flows emit `SIGN_IN`, `SIGN_UP`, `SIGN_OUT` entries in `AuditLog` via Better Auth hooks.

**Email OTP (implemented)**
* **Email‑based OTP** via `email_service` (SendGrid) is implemented and active. Users can choose to receive a 6-digit OTP by email instead of using an authenticator app.
* Login flow: `Login.tsx` → detects `emailOtpRequired` → `/auth/email-otp` → `EmailOtpChallenge.tsx` → `verifyEmailOtp()`.
* All email secrets remain in the internal network `.env` and are accessed only via the `email_service` microservice.