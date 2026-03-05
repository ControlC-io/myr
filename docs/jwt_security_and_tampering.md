## JWT: Signature, Security, and Tampering

This document explains **how a JWT works**, **what the signature actually protects**, and **why knowing another user’s `userId` is not enough to impersonate them**, using the current backend implementation as reference.

---

### 1. JWT Structure

A JSON Web Token (JWT) has three dot‑separated parts:

- **Header** (JSON, Base64URL‑encoded)
- **Payload** (claims, JSON, Base64URL‑encoded)
- **Signature** (binary, Base64URL‑encoded)

General form:

```text
header.payload.signature
```

Example:

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
.
eyJ1c2VySWQiOiIxMjMiLCJlbWFpbCI6ImEudXNlckBleGFtcGxlLmNvbSIsInJvbGVzIjpbIkFETUlOIl19
.
hV7S1lDJkN6JG3h2M7d9eO7b8WQ9y7xfC4KWPmTnGiE
```

---

### 2. Header

The **header** describes the token type and the signing algorithm, for example:

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

In our backend we use `jsonwebtoken` and a symmetric secret (`JWT_SECRET`), which typically means HS256 (HMAC‑SHA256).

---

### 3. Payload (claims)

The **payload** contains the *claims* (data) about the user or context. In our system we use something like:

```json
{
  "userId": "some-uuid",
  "email": "user@example.com",
  "roles": ["ADMIN", "VIEWER"],
  "exp": 1700000000
}
```

- **`userId`**: internal identifier of the user.
- **`email`**: user email (useful for auditing and context).
- **`roles`**: gateway‑level roles used for RBAC.
- **`exp`**: token expiration timestamp.

Important: the payload is **not secret**; anyone with the token can decode it (Base64URL). The security comes from the **signature**, which makes the token tamper‑evident.

---

### 4. Signature and Verification

For HS256, the signature is calculated as:

\[
\text{signature} = \text{HMAC-SHA256}(\text{secret}, \text{base64Url(header)} + "." + \text{base64Url(payload)})
\]

- The server knows a secret `JWT_SECRET`.
- To **verify** the token, the server recomputes the HMAC using the header and payload from the token plus `JWT_SECRET`.
- It compares the result with the `signature` part of the token.

If the header or payload change **even by one bit**, the HMAC changes and the comparison fails → the token is invalid.

In our `jwtAuth` middleware (`backend/src/middleware/jwtAuth.ts`):

```ts
payload = jwt.verify(token, secret) as JwtPayload;
```

If the signature does not match or the token is expired, `jwt.verify` throws and we respond with `401 Unauthorized: invalid or expired token`.

---

### 5. How We Use It in the Backend

#### 5.1. Signing tokens (tests)

In `backend/tests/helpers.ts`:

```ts
export const JWT_SECRET = process.env.JWT_SECRET ?? 'change_me_jwt_secret';

export function signJwt(userId: string, email: string, roles: string[] = []) {
  return jwt.sign({ userId, email, roles }, JWT_SECRET, { expiresIn: '1h' });
}
```

#### 5.2. Verifying tokens (production)

In `backend/src/middleware/jwtAuth.ts`:

```ts
const token = authHeader.slice(7);
const secret = process.env.JWT_SECRET;

payload = jwt.verify(token, secret) as JwtPayload;
req.user = payload;
req.userRoles = payload.roles;

const allowed = await hasRoleAccess(payload.userId, req.method, req.path);
```

Flow:

1. The client sends `Authorization: Bearer <jwt>`.
2. `jwtAuth` verifies the signature using `JWT_SECRET`.
3. If it is valid, it attaches `userId`, `email`, and `roles` to `req.user` and checks RBAC.
4. If it is invalid or tampered, it returns **401** before reaching business logic.

---

### 6. What If an Attacker Knows a Valid `userId`?

Scenario:

- The attacker has a valid JWT for some `outsider` user.
- The attacker also knows the `userId` of another user `owner` with more privileges.

Typical attack attempt:

1. Decode the JWT (header and payload are Base64URL‑encoded).
2. Change `"userId": "<outsider-id>"` to `"userId": "<owner-id>"`.
3. Re‑encode the payload in Base64URL, leaving the original signature untouched.

This is exactly what we simulate in the tests with a function like:

```ts
function tamperJwtPayload(token: string, overrides: Record<string, unknown>): string {
  // 1. Split into header.payload.signature
  // 2. Decode and modify the payload
  // 3. Re‑encode the payload but keep the original signature
}
```

On the server:

1. `jwtAuth` reads the header and payload from the token.
2. It recomputes the HMAC using `JWT_SECRET`.
3. Because the payload changed but the signature did not, the new HMAC **no longer matches** the original signature.
4. `jwt.verify` throws → we respond with **401 Unauthorized**.

Conclusion:

- **Knowing another user’s `userId` is not enough** to impersonate them without also knowing the signing secret.
- Any change to the payload (including `userId` or `roles`) without re‑signing with `JWT_SECRET` breaks the signature and is detected.

---

### 7. JWT Tampering Tests in This Project

We added integration tests in `backend/tests/org.jwt.test.ts` to demonstrate these points.

#### 7.1. Tampering helpers (tests only)

In the tests we define:

- `decodeJwtPayload(token)`: decodes the payload without verifying the signature.
- `tamperJwtPayload(token, overrides)`: builds a new token using the same header and signature, but with a modified payload.

This imitates what an attacker can do by editing the token on the client.

#### 7.2. Case 1 – Change `userId` to another real user

- Start from a valid `outsiderJwt` (real user outside the organization).
- Use `tamperJwtPayload` to replace `userId` with the `owner`’s id.
- Call `GET /api/orgs/:orgId/profile` with that tampered token.

**Expected result:**  
`jwtAuth` returns **401 Unauthorized** with message `"invalid or expired token"`.

> This shows that you **cannot impersonate another user** just by editing `userId` in the payload.

#### 7.3. Case 2 – Token signed with the wrong secret

- Build a token with a valid payload (`{ userId, email, roles }`), but sign it with `'not_the_real_jwt_secret'` instead of `JWT_SECRET`.
- Call `GET /api/orgs/:orgId/profile` again.

**Expected result:**  
Again **401 Unauthorized**, `"invalid or expired token"`.

> A token with the correct shape but signed with a different secret **is not accepted**.

#### 7.4. Case 3 – Elevate roles in the payload

- Start from a legitimate `viewerJwt`.
- Modify the payload so that `roles: ['ADMIN']`, keeping the original signature.
- Call `GET /api/orgs/:orgId/audit-logs`, which requires `ADMIN+`.

**Expected result:**  
The server responds **401 Unauthorized** (verification failure), not 403.

> The attempt to escalate permissions by changing `roles` on the client fails before even reaching the RBAC layer.

---

### 8. Conclusions

- A JWT is **readable** but not **forgeable** without knowing the secret (or private key for asymmetric schemes).
- The **signature protects the integrity** of the header and payload: any change invalidates the token.
- In this project:
  - `JWT_SECRET` is used both for signing (in tests) and for verification (in the middleware).
  - Tampering with `userId` or `roles` without re‑signing always results in **401 Unauthorized**.
- The tests in `backend/tests/org.jwt.test.ts` document and validate this behavior, showing that:
  - **Knowing a valid `userId` does not let you manipulate a JWT to gain privileges.**
  - **Attempts to forge or escalate permissions by editing the payload are detected and blocked.**

---

### 9. How to run the JWT tests locally

To reproduce the JWT behavior and tampering protections on your own machine, follow these steps:

1. **Use Node 20 (via `nvm-windows`)**
   - In PowerShell:
     ```powershell
     nvm install 20
     nvm use 20
     node -v   # should show v20.x.x
     ```

2. **Ensure Postgres from Docker is running**
   - From the project root:
     ```powershell
     cd C:\Dev\myr
     docker compose up -d
     ```
   - This starts the `postgres` service exposed on `localhost:5432` (see `docker-compose.yml`).

3. **From the `backend` folder, configure environment for tests**
   - Open a new PowerShell with Node 20 active:
     ```powershell
     cd C:\Dev\myr\backend

     # Point Prisma at the Postgres container
     $env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/myrtest?schema=public"

     # Define the JWT secret used by jwtAuth and test helpers
     $env:JWT_SECRET = "change_me_jwt_secret"
     ```

4. **Run only the JWT integration test suite**
   ```powershell
   npm test -- --runInBand -- org.jwt.test.ts
   ```

If everything is configured correctly, you should see:

- All **profile** and **audit-logs** tests passing (correct 401/403/200 behavior).
- All **“JWT tampering & forgery resistance”** tests passing, confirming that:
  - Tokens with tampered `userId` or `roles` are rejected with **401**.
  - Tokens signed with the wrong secret are also rejected with **401**.


