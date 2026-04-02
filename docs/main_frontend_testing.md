# Main Frontend – Testing Strategy

This document describes how to smoke‑test the `main_frontend` app using Playwright, following the `webapp-testing` skill.

## 1. Targets

- Main app at `http://localhost` when running behind nginx, or `http://localhost:5173` during local development.
- Backend API at `http://localhost:3000` for local dev.

## 2. Key flows to cover

- **Anonymous navigation**
  - Visit `/` (Home), `/login`, and `/register` and ensure the pages load without console errors.
  - From Home, follow links to Login and Register.
- **Registration with pre-validation**
  - Attempt to register with an email that is **not** in the external supplier system → error message "Your email address is not registered in our system." (key `register.form.errorNotRegistered`).
  - Attempt to register with a valid supplier email → registration proceeds normally.
  - If the external API is unreachable during registration → `503` error displayed, registration blocked.
- **Authentication**
  - Failed login with wrong password → generic error message, user remains on the login page.
  - Successful login without 2FA/OTP → supplier context loads, redirected to `/dashboard` and navbar shows the user session.
  - Successful login requiring TOTP 2FA → `/auth/2fa-challenge` flow, then `/dashboard` after a valid code.
  - Successful login requiring email OTP → `/auth/email-otp` flow, then `/dashboard` after a valid code.
- **Supplier context loading**
  - After login, `GET /api/user/supplier-context` is called. A loading spinner shows while it resolves.
  - If the response contains companies, the app renders normally and `selectedSupplierId` is set to the first company (or the last persisted one from `localStorage`).
  - If the response contains no companies, `NoAccessPage` is rendered with a logout button — no other page is accessible.
  - If the user has multiple companies, a dropdown selector appears in the Navbar showing the company's `raisonsociale` (or `name`, falling back to the supplier ID). Selecting a different company triggers data refetches on all pages.
- **Role-based access control (frontend)**
  - Nav items and dashboard quick link cards are hidden for roles that do not have access. A user with no matching role sees an empty nav section (e.g., the entire "Administrative" group disappears).
  - Direct URL navigation to a restricted route (e.g., `/invoice` without `MYR-ADMIN` or `MYR-MANAGER`) silently redirects to `/dashboard`.
  - The four application roles are: `MYR-ADMIN`, `MYR-MANAGER`, `MYR-TICKET`, `MYR-SECURITE`.
  - The permission map lives in `main_frontend/src/config/routePermissions.ts` — update it there to change access rules without touching components.
  - Role enforcement is split across two layers:
    - `RoleGuard` component wraps route elements in `App.tsx` and redirects if `currentRoles` (from `useSupplier()`) does not include any required role.
    - `isVisible()` in `Navbar.tsx` and the `visibleLinks` filter in `DashboardQuickLinks.tsx` hide items from navigation and the dashboard grid.
  - Verify: log in as `MYR-TICKET` only → only Tickets and Interventions are visible; `/invoice` redirects to `/dashboard`.
- **Protected UI**
  - Access `/dashboard` without a session redirects to `/login`.
  - After login, refreshing `/dashboard` keeps the session alive (JWT and supplier context are restored from `localStorage`).
  - `Counter` component loads for an authenticated user and can increment/decrement the value; an unauthenticated call returns the proper error UI.
- **Navigation once authenticated**
  - Use the navbar and dashboard quick links to open:
    - Tickets (`/tickets`), Interventions (`/intervention`), Invoices (`/invoice`), SEPA mandate (`/sepa`), Customer information (`/customer-information`),
    - BCP room reservations (`/reservation-salles-bcp`), Offers (`/offer`), Orders (`/orders`), Contracts (`/services`), KYC (`/kyc`), Security (`/securite`), Resources (`/ressources`).
  - Each route should render its page or placeholder component without errors.
  - All data pages use `useOrg()` → `selectedSupplierId` as the org ID. No page fetches `/orgs/mine` directly.
- **Info page (`/info`)**
  - Should show a card for each company from the supplier context, with supplier ID, contact ID, and roles as badges.
  - The active company card should be highlighted.
  - Active roles for the selected company are shown in a summary card.
- **Company selector (multi-company users)**
  - When a user has more than one company, the Navbar selector shows `raisonsociale` (commercial name) falling back to `name` (legal name) then supplier ID. Assert the option text is not a raw number.
  - Switching companies triggers a data reload on all pages via React Query.

## 3. Running tests with `with_server.py`

From the project root:

```bash
python scripts/with_server.py \
  --server "cd backend && npm run dev" --port 3000 \
  --server "cd main_frontend && npm run dev" --port 5173 \
  -- python tests/main_frontend_e2e.py
```

The helper starts both servers, waits for them to be healthy, and then executes the Playwright script.

## 4. Skeleton Playwright script

```python
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:5173"

def test_main_frontend_smoke():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Home page
        page.goto(f"{BASE_URL}/")
        page.wait_for_load_state("networkidle")

        # Navigate to login
        page.click('a[href="/login"]')
        page.wait_for_url("**/login")

        # Invalid login attempt
        page.fill('input[type="email"]', "user@example.com")
        page.fill('input[type="password"]', "wrong-password")
        page.click('button[type="submit"]')

        # TODO: assert generic error message is visible

        # Successful login with a seeded user (adjust credentials to your seed data)
        page.fill('input[type="password"]', "correct-password")
        page.click('button[type="submit"]')
        page.wait_for_url("**/dashboard")

        # Dashboard quick links
        page.click('button:has-text("Tickets")')
        page.wait_for_url("**/tickets")

        # Capture a full-page screenshot for manual inspection
        page.screenshot(path="main_frontend_dashboard.png", full_page=True)
        browser.close()
```

Extend this script with:

- End-to-end 2FA and email-OTP flows when you have deterministic test users and shared secrets.
- Checks that hitting `/dashboard` without cookies redirects back to `/login`.
- Registration rejection test: use an email not in the external supplier system and assert the `errorNotRegistered` message.
- NoAccessPage test: mock `GET /api/user/supplier-context` to return `{ data: { contactSupplier: { data: [] } } }` and assert the no-access screen renders with a logout button.
- Company selector test: mock supplier context with 2+ companies and assert the Navbar dropdown is visible and switching companies triggers a data reload.

