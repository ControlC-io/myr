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
- `backend/src/services/decompteQueries.ts` — all GraphQL query builders. **This is the only file to update when the external API changes its query structure.** Current builders:
  - `buildSupplierQuery(supplierId)` — full supplier data for the proxy routes.
  - `buildTicketsQuery(...)` — paginated ticket list.
  - `buildContactSupplierQuery(email)` — pre-registration check; returns `{ total }` only.
  - `buildContactSupplierDataQuery(email)` — full contact+supplier+roles data; used by `/api/user/supplier-context`.

Example tenant-aware routes (implemented in `backend/src/routes/organizationResources.ts`):

- `GET /api/orgs/{orgId}/profile` – requires at least `VIEWER`.
- `GET /api/orgs/{orgId}/audit-logs` – requires at least `ADMIN` and is fully paginated.
- `POST /api/orgs/{orgId}/proxy/supplier` – requires `VIEWER`. Proxies GraphQL to Decompte using `org.externalReferenceId` as the supplier ID.
- `POST /api/orgs/{orgId}/proxy/tickets` – requires `VIEWER`. Same pattern, returns paginated ticket list.

User context route (implemented in `backend/src/routes/userContext.ts`):

- `GET /api/user/supplier-context` – requires JWT. Fetches the authenticated user's companies and roles from the external `contactSupplier` API using the email from the JWT payload. Also auto-syncs each company as an `Organization` record and the user as a `MANAGER` member in the local DB (see section 2.3 below). This is the **source of truth for company and role data** in the main frontend.

### 2.3 Supplier Context and Org Auto-Sync

The main frontend uses an **external API as the source of truth** for company membership and roles. The local `Organization` and `Member` tables serve as a synchronized cache to satisfy `checkOrganizationAccess` on proxy routes.

**Flow on every login / app load:**

```
JWT obtained
  └── GET /api/user/supplier-context
       ├── Calls contactSupplier(email) on the external Decompte GraphQL API
       ├── For each company returned:
       │    ├── Upserts Organization(id=supplierId, externalReferenceId=supplierId)
       │    └── Upserts Member(userId, organizationId=supplierId, role=MANAGER)
       └── Returns { data: { contactSupplier: { data: [...] } } } to the frontend
```

The `supplierId` from the external API **is used directly as the `Organization.id`** in the local DB. This allows `/api/orgs/:orgId/proxy/*` routes to resolve the org and pass `checkOrganizationAccess` using the supplier ID as the `:orgId` param.

**What `org.externalReferenceId` is used for:**
The proxy route handler (`POST /api/orgs/:orgId/proxy/supplier`) reads `org.externalReferenceId` to build the GraphQL query. The auto-sync sets `externalReferenceId = supplierId` so the proxy can identify which supplier to query.

**No access case:**
If the external API returns an empty list, the frontend shows `NoAccessPage` and no proxy calls are made. The local DB is not modified.

### 2.4 Pre-Registration Supplier Validation

Before a new user can register (sign up via `POST /api/auth/sign-up/email`), the backend interceptor in `backend/src/routes/betterAuthProxy.ts` calls:

```
contactSupplier(contactEmail: "<email>", is_deleted: false) { total }
```

- If `total > 0`: registration is allowed and the request is forwarded to Better Auth.
- If `total = 0`: returns `403` with `{ error: "USER_NOT_REGISTERED", code: "USER_NOT_REGISTERED" }`.
- If the external API is unreachable: returns `503` (fail-closed — registration is blocked).

This ensures only users whose email exists in the external supplier system can create an account.

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

---

## 4. Troubleshooting & Onboarding

### 4.1 New User Access Checklist
When a user is registered but receives a `403 Forbidden` error, follow this checklist:

1. **Identity**: Ensure the user has a valid JWT (check `Authorization: Bearer <token>` header).
2. **Supplier context loaded**: The `GET /api/user/supplier-context` call must have completed successfully after login. This is what creates the `Organization` and `Member` records. If the external API was unreachable at login time, these records may not exist yet — ask the user to log out and back in.
3. **Organization Membership**:
    * Check the `Member` table for a row matching `userId` and `organizationId` (the supplier ID).
    * Verify the `Member.role` is `MANAGER` (set automatically by the sync).
4. **Organization Configuration**:
    * For proxy routes (e.g., `/api/orgs/:orgId/proxy/*`), ensure `Organization.externalReferenceId` equals the supplier ID. The auto-sync sets this, but a manually created org may have it null → returns `403 "Organization has no linked supplier"`.
5. **Global RBAC**:
    * Check if the endpoint has an entry in `RoleEndpointMapping`. If it does, the user must have a matching `UserRole` assigned. By default no mappings exist (opt-in RBAC), so all authenticated users pass.
6. **Diagnostic Fields**:
    * The `403` response includes `source` and `code` fields to identify which layer blocked the request:
        * `source: 'rbac_global'`, `code: 'RBAC_ROLE_ENDPOINT_DENIED'`: Blocked by the gateway-level RBAC (missing `UserRole` for a mapped endpoint).
        * `source: 'org_membership'`, `code: 'ORG_MEMBERSHIP_REQUIRED'`: Blocked because the user is not a member of the organization.
        * `source: 'org_role'`, `code: 'ORG_ROLE_INSUFFICIENT'`: Blocked because the user's role in the organization is insufficient.
        * No `source` field, message `"Organization has no linked supplier"`: `Organization.externalReferenceId` is null — the proxy cannot build a GraphQL query.

### 4.2 Switching Organizations
The active organization is managed client-side by the `SupplierContext` (`main_frontend/src/context/SupplierContext.tsx`):

* On login / app load, `GET /api/user/supplier-context` returns the user's companies from the external API.
* `selectedSupplierId` is stored in `localStorage` (key `myr_selected_supplier`) and defaults to the first company.
* All pages use `useOrg()` → `selectedSupplierId` as the `:orgId` for proxy calls. Changing the selected company automatically triggers React Query refetches.
* If the user has more than one company, a dropdown selector appears in the Navbar.
* The backend has no concept of "active org" in the session — `orgId` is always passed in the URL per request.
