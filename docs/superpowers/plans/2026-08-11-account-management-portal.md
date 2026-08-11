# Account Management Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real account creation, login, a standard user-management portal, and an admin-only overview while keeping the existing marketplace interface intact and making login the clearest action in the header.

**Architecture:** Use Better Auth 1.6.27 with the existing Drizzle/D1 database so password hashing, sessions, CSRF checks, and account operations are not reimplemented locally. The public marketplace remains usable without an account, but listing writes and portal data are authorized on the server. The admin portal reuses the user portal shell and is granted only to exact email addresses configured in the server-side `MARKETPLACE_ADMIN_EMAILS` variable.

**Tech Stack:** Vinext/Next.js 16, React 19, TypeScript, Better Auth 1.6.27, Drizzle ORM, Cloudflare D1, Node test runner, ESLint.

---

## Product and security decisions for this slice

- Account method: display name, email, and password.
- Password policy: 12–128 characters; Better Auth performs hashing and verification.
- New accounts are not described as identity-verified. Email verification and password-reset delivery require an outbound email service and are a separate launch gate.
- Account creation does not automatically create an admin. Admin access is an exact, case-insensitive match against `MARKETPLACE_ADMIN_EMAILS`; the value is never accepted from browser input.
- The first admin console is read-only: account count, listing count, open-report count, and recent accounts. Ban, delete, impersonation, and role-changing actions are intentionally excluded.
- Listing ownership comes from the validated session. `sellerId` and `sellerName` supplied by the browser are ignored.
- The large `Log in` action is the right-most desktop and mobile header action. When authenticated, it becomes `My account`.
- No account, session, password, or administrator data is stored in browser local storage.

## File map

- Modify `package.json` and `package-lock.json`: add the pinned authentication packages and run all test files.
- Modify `db/schema.ts`: add Better Auth users, sessions, credential accounts, verification records, and database-backed rate-limit records.
- Create `drizzle/0002_*.sql` and update `drizzle/meta/*`: generated D1 migration.
- Create `lib/auth.ts`: request-scoped Better Auth configuration and session helpers.
- Create `lib/auth-client.ts`: browser client for sign-up, sign-in, session, profile, password, and sign-out operations.
- Create `lib/admin-policy.ts`: exact admin-email allowlist parsing and checks.
- Create `app/api/auth/[...all]/route.ts`: mount the authentication handler.
- Modify `app/api/listings/route.ts`: require a session for writes and derive seller identity from it.
- Create `app/login/page.tsx` and `app/login/login-panel.tsx`: combined login/create-account page.
- Create `app/portal/portal-shell.tsx`: shared account/admin navigation and page chrome.
- Create `app/account/page.tsx` and `app/account/account-settings.tsx`: protected standard user console.
- Create `app/admin/page.tsx`: protected admin extension of the same console.
- Modify `app/marketplace.tsx`: add the prominent login/account action and session-aware listing entry.
- Modify `app/globals.css`: login, authentication page, and portal responsive styles.
- Modify `tests/rendered-html.test.mjs`: repair the stale product-name assertion and cover public account entry points.
- Create `tests/auth-boundaries.test.mjs`: cover unauthenticated route and listing-write boundaries.
- Modify `.env.example`, `README.md`, `ARCHITECTURE.md`, and `CURSOR_START_HERE.md`: document bindings, limitations, and authorization rules.

### Task 1: Restore a trustworthy baseline

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Correct the stale product-name assertion**

Replace the retired assertion:

```js
assert.match(html, /open exchange/i);
```

with the current product name:

```js
assert.match(html, /open marketplace/i);
```

- [ ] **Step 2: Make the test script execute every repository test**

Set the script to:

```json
"test": "npm run build && node --test tests/*.test.mjs"
```

- [ ] **Step 3: Run the baseline checks**

Run:

```bash
bash scripts/sites-env.sh -- ./node_modules/.bin/vinext build
bash scripts/validate-artifact.sh
node --test tests/*.test.mjs
npm run lint
```

Expected: build and artifact validation succeed; the corrected rendered-page test and both Pages asset-routing tests pass; lint exits with zero errors.

- [ ] **Step 4: Commit the baseline correction**

```bash
git add package.json tests/rendered-html.test.mjs
git commit -m "test: restore marketplace baseline"
```

### Task 2: Add the D1 authentication model

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `db/schema.ts`
- Create: `drizzle/0002_*.sql`
- Modify: `drizzle/meta/_journal.json`
- Create: `drizzle/meta/0002_snapshot.json`

- [ ] **Step 1: Install pinned authentication dependencies**

```bash
npm install --save-exact better-auth@1.6.27 @better-auth/drizzle-adapter@1.6.27
```

- [ ] **Step 2: Add the required Drizzle tables**

Add tables with these exported names and database names:

```ts
export const authUsers = sqliteTable(
  "auth_users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" })
      .notNull()
      .default(false),
    image: text("image"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("auth_users_email_idx").on(table.email)],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("auth_sessions_token_idx").on(table.token),
    index("auth_sessions_user_idx").on(table.userId),
  ],
);

export const authAccounts = sqliteTable(
  "auth_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("auth_accounts_provider_account_idx").on(
      table.providerId,
      table.accountId,
    ),
    index("auth_accounts_user_idx").on(table.userId),
  ],
);

export const authVerifications = sqliteTable(
  "auth_verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("auth_verifications_identifier_idx").on(table.identifier)],
);

export const authRateLimits = sqliteTable(
  "auth_rate_limits",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    count: integer("count").notNull(),
    lastRequest: integer("last_request", { mode: "number" }).notNull(),
  },
  (table) => [uniqueIndex("auth_rate_limits_key_idx").on(table.key)],
);
```

- [ ] **Step 3: Generate and inspect the migration**

```bash
npm run db:generate
```

Confirm that the migration only creates the five auth tables and their declared indexes; it must not drop or rewrite existing marketplace tables.

- [ ] **Step 4: Verify schema compilation**

```bash
npm run lint
bash scripts/sites-env.sh -- ./node_modules/.bin/vinext build
```

Expected: both commands exit zero.

- [ ] **Step 5: Commit the model**

```bash
git add package.json package-lock.json db/schema.ts drizzle
git commit -m "feat: add D1 account schema"
```

### Task 3: Implement server-side authentication and authorization

**Files:**
- Create: `lib/admin-policy.ts`
- Create: `lib/auth.ts`
- Create: `lib/auth-client.ts`
- Create: `app/api/auth/[...all]/route.ts`
- Modify: `.env.example`
- Create: `tests/auth-boundaries.test.mjs`

- [ ] **Step 1: Write failing boundary tests**

After building the worker, request `/account`, `/admin`, and an unauthenticated listing write. Assert:

```js
assert.equal(accountResponse.status, 307);
assert.match(accountResponse.headers.get("location") ?? "", /^\/login\?returnTo=%2Faccount/);

assert.equal(adminResponse.status, 307);
assert.match(adminResponse.headers.get("location") ?? "", /^\/login\?returnTo=%2Fadmin/);

assert.equal(listingResponse.status, 401);
assert.deepEqual(await listingResponse.json(), { error: "Log in to publish a listing." });
```

Run:

```bash
node --test tests/auth-boundaries.test.mjs
```

Expected: FAIL because protected routes and the authentication handler do not exist.

- [ ] **Step 2: Add exact allowlist logic**

Implement `lib/admin-policy.ts` with a small public interface:

```ts
export function isAdminEmail(email: string, configuredEmails: string): boolean {
  const normalized = email.trim().toLowerCase();
  return configuredEmails
    .split(",")
    .map((candidate) => candidate.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}
```

- [ ] **Step 3: Configure Better Auth per Cloudflare request**

`lib/auth.ts` must create the Drizzle adapter from `getDb()`, map the four core models and `rateLimit`, and use these options:

```ts
emailAndPassword: {
  enabled: true,
  autoSignIn: false,
  minPasswordLength: 12,
  maxPasswordLength: 128,
},
rateLimit: {
  enabled: true,
  storage: "database",
  modelName: "rateLimit",
},
advanced: {
  ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
  database: { generateId: "uuid" },
},
```

Read `BETTER_AUTH_SECRET` from the Worker environment and fail closed when it is absent. Allow only `open-marketplace-demo.pages.dev`, its Pages preview subdomains, and `localhost:*` as authentication hosts. Expose `getMarketplaceAuth()`, `getMarketplaceSession(headers)`, and `requireMarketplaceSession(headers, returnTo)`.

- [ ] **Step 4: Mount the standard Request/Response handler**

`app/api/auth/[...all]/route.ts`:

```ts
import { getMarketplaceAuth } from "../../../../lib/auth";

async function handle(request: Request) {
  const auth = await getMarketplaceAuth();
  return auth.handler(request);
}

export const GET = handle;
export const POST = handle;
```

- [ ] **Step 5: Create the browser client**

`lib/auth-client.ts`:

```ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  basePath: "/api/auth",
});
```

- [ ] **Step 6: Document required server variables**

Add to `.env.example`:

```dotenv
# Required server-only secret for signing and encrypting account sessions.
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=

# Exact, comma-separated account emails allowed to open /admin.
MARKETPLACE_ADMIN_EMAILS=
```

- [ ] **Step 7: Make the boundary test green**

Run the build and boundary test again. Expected: all three unauthenticated boundaries pass.

- [ ] **Step 8: Commit authentication plumbing**

```bash
git add .env.example lib app/api/auth tests/auth-boundaries.test.mjs
git commit -m "feat: add D1-backed authentication"
```

### Task 4: Add the prominent login and account-creation experience

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `app/marketplace.tsx`
- Create: `app/login/page.tsx`
- Create: `app/login/login-panel.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the failing public-interface tests**

Add assertions that the marketplace HTML includes:

```js
assert.match(html, /href=["']\/login["']/i);
assert.match(html, />Log in</i);
```

Fetch `/login` and assert:

```js
assert.equal(loginResponse.status, 200);
const loginHtml = await loginResponse.text();
assert.match(loginHtml, /Log in to Open Marketplace/i);
assert.match(loginHtml, /Create account/i);
assert.match(loginHtml, /12 characters/i);
```

Expected: FAIL before the login page and header action exist.

- [ ] **Step 2: Build a combined login/create-account panel**

The client panel has two modes. Login calls:

```ts
await authClient.signIn.email({ email, password, rememberMe: true });
```

Registration calls:

```ts
await authClient.signUp.email({ name, email, password });
```

On registration success, switch back to login and show `Account created. Log in to continue.` On login success, navigate only to a sanitized relative `returnTo` value or `/account`. Render server messages in a `role="status"` region, disable submission while pending, and retain typed email after an error.

- [ ] **Step 3: Add the right-most header action**

Use `authClient.useSession()` in `app/marketplace.tsx`. Render:

```tsx
<a className="button button-login" href={session ? "/account" : "/login"}>
  <span aria-hidden="true">{session ? "●" : "↗"}</span>
  {session ? "My account" : "Log in"}
</a>
```

Keep it after `List an item` so it remains the right-most action. If a signed-out visitor chooses `List an item`, send them to `/login?returnTo=/%3Fcompose%3D1`; signed-in users keep the existing composer.

- [ ] **Step 4: Style the action without changing the marketplace layout**

Add a dedicated class:

```css
.button-login {
  background: var(--brand);
  box-shadow: 0 8px 22px rgba(90, 79, 243, 0.24);
  color: #fff;
  font-size: 16px;
  min-height: 50px;
  padding: 0 22px;
}

.button-login:hover {
  background: var(--brand-dark);
}
```

Add responsive authentication-card styles that preserve a full `Log in` label at 320px width and do not hide it under `.desktop-action`.

- [ ] **Step 5: Run the rendered-interface tests**

Expected: the marketplace and login-page assertions pass.

- [ ] **Step 6: Commit the public experience**

```bash
git add app/marketplace.tsx app/login app/globals.css tests/rendered-html.test.mjs
git commit -m "feat: add prominent account entry"
```

### Task 5: Build the standard account portal

**Files:**
- Create: `app/portal/portal-shell.tsx`
- Create: `app/account/page.tsx`
- Create: `app/account/account-settings.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Implement one shared portal shell**

`PortalShell` accepts `user`, `activeSection`, `isAdmin`, and `children`. Its navigation always contains `Overview`, `My listings`, and `Account settings`; it adds `Admin overview` only when `isAdmin` is true. The header contains the existing Open Marketplace wordmark and a link back to `/`.

- [ ] **Step 2: Protect the account page on the server**

Use `headers()` and `requireMarketplaceSession(..., "/account")`. Query only listings where `listings.sellerId` equals `session.user.id`. Render:

- a welcome heading using the authenticated name;
- active/draft/sold listing counts derived from that user's rows;
- a recent-listings table or a clear empty state;
- account name and email;
- the account-settings client component.

- [ ] **Step 3: Add safe self-service operations**

The settings component uses `authClient.updateUser({ name })`, `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })`, and `authClient.signOut()`. Email is read-only in this slice because changing it safely requires email verification delivery.

- [ ] **Step 4: Verify responsive and keyboard behavior**

At desktop widths, render a 240px portal sidebar and content region. At 720px and below, change the sidebar into a horizontally scrollable navigation row. All links, forms, and submit states remain keyboard reachable and visibly focused.

- [ ] **Step 5: Commit the standard portal**

```bash
git add app/portal app/account app/globals.css
git commit -m "feat: add user account portal"
```

### Task 6: Extend the portal for administrators

**Files:**
- Create: `app/admin/page.tsx`
- Modify: `tests/auth-boundaries.test.mjs`
- Modify: `app/globals.css`

- [ ] **Step 1: Add an authorization test before the page**

Keep the unauthenticated `/admin` redirect assertion and add a focused test for `isAdminEmail` covering whitespace, case folding, exact matches, and rejecting suffix attacks such as `owner@example.com.attacker.test`.

- [ ] **Step 2: Require both a session and the server allowlist**

The admin page first requires a valid session, then checks:

```ts
isAdminEmail(session.user.email, env.MARKETPLACE_ADMIN_EMAILS ?? "")
```

For a signed-in non-admin, return the framework's not-found response instead of exposing an admin page or account inventory.

- [ ] **Step 3: Reuse the standard portal shell**

Render `PortalShell` with `isAdmin={true}` and add real D1-derived cards for:

- total registered accounts from `authUsers`;
- total active listings from `listings`;
- open reports from `reports`;
- the 20 most recent accounts with name, email, and creation time.

Do not add ban, delete, password-reset, or impersonation controls in this slice.

- [ ] **Step 4: Commit the admin extension**

```bash
git add app/admin app/globals.css tests/auth-boundaries.test.mjs
git commit -m "feat: add admin portal overview"
```

### Task 7: Enforce authenticated listing ownership

**Files:**
- Modify: `app/api/listings/route.ts`
- Modify: `app/marketplace.tsx`
- Modify: `tests/auth-boundaries.test.mjs`

- [ ] **Step 1: Keep the unauthenticated write test red**

Before changing the endpoint, verify that the new test fails because anonymous listing publication is still accepted or reaches the registry path.

- [ ] **Step 2: Validate the session before parsing seller identity**

At the beginning of `POST`:

```ts
const session = await getMarketplaceSession(request.headers);
if (!session) {
  return Response.json(
    { error: "Log in to publish a listing." },
    { status: 401 },
  );
}
```

Set:

```ts
const sellerId = session.user.id;
const sellerName = session.user.name;
```

Remove `sellerId` and `sellerName` from the required browser payload and never fall back to the client-generated device ID for registry writes.

- [ ] **Step 3: Handle an expired session in the composer**

If the endpoint returns 401, close the composer, show `Log in to publish this listing.`, and navigate to `/login?returnTo=/%3Fcompose%3D1`. Do not silently save an authenticated user's intended registry listing as if it were published.

- [ ] **Step 4: Run the boundary tests**

Expected: anonymous `POST /api/listings` returns exactly 401, while public `GET /api/listings` remains available.

- [ ] **Step 5: Commit ownership enforcement**

```bash
git add app/api/listings/route.ts app/marketplace.tsx tests/auth-boundaries.test.mjs
git commit -m "fix: enforce listing ownership"
```

### Task 8: Document, verify, preview, and prepare deployment

**Files:**
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `CURSOR_START_HERE.md`

- [ ] **Step 1: Document exact honesty and launch boundaries**

State that accounts and sessions are D1-backed, registry writes require a session, admin access uses a server-only exact email allowlist, email addresses are not yet verified, password reset is not yet available, and account creation must not be marketed as identity verification.

- [ ] **Step 2: Run full fresh verification**

```bash
npm run lint
bash scripts/sites-env.sh -- ./node_modules/.bin/vinext build
bash scripts/validate-artifact.sh
node --test tests/*.test.mjs
git diff --check
```

Expected: every command exits zero and the Node summary reports zero failed tests.

- [ ] **Step 3: Run local visual checks**

Verify at 1440px, 768px, and 320px:

- the existing marketplace grid, filters, and listing cards remain unchanged;
- `Log in` is the right-most, largest header action;
- login and registration forms show loading, success, and error states;
- `/account` redirects when signed out and renders only the signed-in user's data;
- `/admin` is absent for ordinary accounts and extends the same portal for an allowlisted admin;
- keyboard focus is visible and Escape/modal behavior on the marketplace still works.

- [ ] **Step 4: Configure preview secrets without committing them**

Set `BETTER_AUTH_SECRET` and `MARKETPLACE_ADMIN_EMAILS` in the Cloudflare Pages preview environment, apply the generated D1 migration to the preview database, and deploy the feature branch. Do not apply the production migration or merge until preview account creation, login, logout, and both authorization boundaries pass.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md ARCHITECTURE.md CURSOR_START_HERE.md
git commit -m "docs: describe account authorization"
```

## Self-review

- Spec coverage: account creation, login, a conspicuous header action, a standard user console, and a richer admin console each have an implementation task.
- Security coverage: passwords are delegated to an established library; sessions and administrator checks are server-side; listing ownership cannot come from browser input; rate limiting uses D1 and Cloudflare's trusted client-IP header.
- Scope control: email delivery, identity-document verification, destructive admin actions, decentralized-host verification, and paid priority listings remain separate workstreams.
- Existing UI protection: the marketplace component receives only a small session-aware header/listing-entry change, and the plan requires visual checks at three widths before deployment.
