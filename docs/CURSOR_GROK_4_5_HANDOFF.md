# Cursor Grok 4.5 Handoff — Account Framework

You are implementing a security-sensitive account foundation in the Open Marketplace repository. Work only in the existing checkout and branch:

- Repository: `PeterJFrancoIII/Open-Marketplace`
- Branch: `feature/account-management-portal`
- Detailed plan: `docs/superpowers/plans/2026-08-11-account-management-portal.md`

Read `README.md`, `ARCHITECTURE.md`, `POLICY.md`, `CURSOR_START_HERE.md`, and the detailed plan before editing.

## What Codex already completed

1. Corrected the stale rendered-page assertion from Open Exchange to Open Marketplace.
2. Updated `npm test` to include every `tests/*.test.mjs` file.
3. Pinned `better-auth@1.6.27` and `@better-auth/drizzle-adapter@1.6.27`.
4. Added the five Drizzle/D1 auth tables and generated `drizzle/0002_married_wolverine.sql`.
5. Added a single red tracer test to `tests/rendered-html.test.mjs`. It currently fails because the public marketplace has no `/login` link, `.button-login` class, or `Log in` label.

Do not regenerate or rewrite the existing migration unless schema compatibility proves it is wrong. If it is wrong, stop and explain the exact mismatch before changing it.

## Non-negotiable rules

- Do not switch branches, push, merge, open a PR, deploy, or change Cloudflare production state.
- Do not commit secrets or create real credentials.
- Do not implement password hashing, session cookies, or CSRF protection yourself. Use Better Auth.
- Do not use browser local storage as an authentication or authorization source.
- Keep public marketplace browsing available without an account.
- Require a validated server session for listing writes and all portal data.
- Derive listing `sellerId` and `sellerName` from the validated session. Ignore browser-supplied ownership values.
- Admin access is an exact case-insensitive match against the server-only comma-separated `MARKETPLACE_ADMIN_EMAILS` value. Never accept the value or role from browser input.
- Do not add destructive admin operations, impersonation, paid priority listings, document verification, email verification, or password-reset email in this batch.
- Do not describe an account or email as verified.
- Preserve the current marketplace grid, filters, modal behavior, demo listings, local-media rules, social-link validation, restricted-item policy, and `scripts/pages-worker-entry.mjs` asset forwarding.
- Keep changes small and use existing patterns. Do not replace Vinext, Next.js, Drizzle, or the deployment workflow.

## Test-first workflow

Work in vertical red/green slices. Do not write all tests first.

1. Run the current red tracer:

   ```bash
   node --test tests/rendered-html.test.mjs
   ```

   Confirm it fails specifically on the missing `/login` link.

2. Make only the prominent account entry green:
   - Add a right-most `Log in` anchor in the existing marketplace top bar.
   - Use `className="button button-login"`.
   - Keep the full `Log in` label visible on desktop and mobile.
   - Add focused CSS so it is the largest and easiest header action without moving or restyling the listing grid.
   - Rebuild before rerunning rendered HTML because the test imports `dist/server/index.js`.

3. Add one login-page rendering test, watch it fail, then implement `/login` and make it green.

4. Add one unauthenticated boundary test, watch it fail, then add the smallest server auth/redirect behavior that makes it green.

5. Repeat for the next boundary. Never weaken or delete a failing assertion to obtain green.

## Batch A — implement now, then stop for Codex review

### A1. Prominent account entry

- Preserve server-rendered `Log in` HTML so the current tracer test passes.
- After hydration, `authClient.useSession()` may change it to `My account` for a valid session.
- The action must be last in `.top-actions`.
- A signed-out `List an item` action should navigate to `/login?returnTo=/%3Fcompose%3D1`; a signed-in user retains the existing composer.

### A2. Better Auth server plumbing

Create:

- `lib/admin-policy.ts`
- `lib/auth.ts`
- `lib/auth-client.ts`
- `app/api/auth/[...all]/route.ts`

Requirements:

- Use the existing `getDb()` Drizzle/D1 connection and `drizzleAdapter` with schema mappings for `authUsers`, `authSessions`, `authAccounts`, `authVerifications`, and `authRateLimits`.
- Construct auth lazily per request so builds and public static rendering do not require a live D1 binding.
- Email/password: enabled, `autoSignIn: false`, 12–128 characters.
- Database-backed rate limiting with `cf-connecting-ip` as the trusted client IP header.
- UUID IDs.
- Host allowlist: `open-marketplace-demo.pages.dev`, `*.open-marketplace-demo.pages.dev`, and `localhost:*`.
- Production fallback URL: `https://open-marketplace-demo.pages.dev`.
- Read `BETTER_AUTH_SECRET` from the Cloudflare Worker environment and fail closed for auth requests when absent.
- Expose small helpers for `getMarketplaceSession` and protected-route redirects.
- Keep the existing `app/chatgpt-auth.ts`; it belongs to the separate ChatGPT-hosting adapter and must not be presented as Cloudflare Pages authentication.

Add to `.env.example` with explanatory comments:

```dotenv
BETTER_AUTH_SECRET=
MARKETPLACE_ADMIN_EMAILS=
```

### A3. Login and account creation page

Create:

- `app/login/page.tsx`
- `app/login/login-panel.tsx`

Requirements:

- One page with clear `Log in` and `Create account` modes.
- Registration fields: display name, email, password.
- Login fields: email, password, remember-me.
- Use `authClient.signUp.email` and `authClient.signIn.email`.
- After registration, show `Account created. Log in to continue.` and switch to login mode because `autoSignIn` is false.
- Sanitize `returnTo`: accept only a single-origin relative path beginning with `/`, reject `//`, auth endpoint loops, and absolute URLs; fallback to `/account`.
- Expose loading and error states with accessible status messaging.
- State plainly that passwords require at least 12 characters.
- Do not claim email verification or offer a nonfunctional forgot-password link.
- Reuse the existing visual language; add only scoped auth styles to `app/globals.css`.

### A4. Boundary specifications

Create `tests/auth-boundaries.test.mjs` incrementally. By the end of Batch A it must prove:

- `/account` redirects a signed-out request to `/login?returnTo=%2Faccount`.
- `/admin` redirects a signed-out request to `/login?returnTo=%2Fadmin`.
- `POST /api/listings` without a valid session returns 401 and `{ "error": "Log in to publish a listing." }`.
- Public `GET /api/listings` remains available to the same degree it was before this work.

Add only the minimal protected `/account` and `/admin` route shells needed for these boundaries in Batch A. Full portal content belongs to Batch B.

## Verification before stopping

The repository's `npm run build` wrapper requires GNU `timeout`; if unavailable on macOS, use the equivalent commands below and report that fact rather than modifying the build wrapper:

```bash
npm run lint
bash scripts/sites-env.sh -- ./node_modules/.bin/vinext build
bash scripts/validate-artifact.sh
node --test tests/*.test.mjs
git diff --check
```

All commands must exit zero before you report Batch A complete. Do not commit the batch. In your report, list changed files, the red/green evidence, exact verification results, and any Vinext or Better Auth compatibility concern you found.
