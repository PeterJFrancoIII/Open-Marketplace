# Cursor Grok 4.5 Handoff — Account and Admin Portals

You are implementing Batch B of the account-management plan in the existing checkout:

- Repository: `PeterJFrancoIII/Open-Marketplace`
- Branch: `feature/account-management-portal`
- Reviewed foundation commit: `6cfc2ef`
- Full plan: `docs/superpowers/plans/2026-08-11-account-management-portal.md`

Read this file completely, then read `README.md`, `ARCHITECTURE.md`, `POLICY.md`, `CURSOR_START_HERE.md`, the full plan, and every auth/account/admin file changed by `6cfc2ef` before editing.

## Objective

Build the first useful management portal. The standard user console owns the shared shell and account/listing functions. The admin console must visibly be an extension of that same shell, with additional read-only system information.

Work test-first in vertical slices. Complete this batch, run every verification command, and then stop for Codex review.

## Non-negotiable boundaries

- Do not switch branches, commit, push, merge, deploy, or modify Cloudflare state.
- Do not create or store real secrets or credentials.
- Do not alter `scripts/pages-worker-entry.mjs`, the deployment workflow, or the reviewed D1 migration.
- Preserve the marketplace grid, filters, cards, modal behavior, demo data, local-media rules, restricted-item policy, and public browsing.
- Do not implement document verification, email verification, password-reset email, payments, paid priority, destructive admin actions, role mutation, banning, deleting, or impersonation.
- Do not call an email address or account “verified.”
- All account, listing, and admin data must come from the validated server session and D1. Browser local storage is never an authentication or authorization source.
- Admin authorization is an exact, case-insensitive server-side check against `MARKETPLACE_ADMIN_EMAILS`. A signed-in non-admin must receive the framework not-found response, not a 403 page that confirms the admin route exists.
- Keep the reviewed production origin policy: deployed Pages origins are trusted; localhost origins are added only for an actual localhost request.
- Keep authentication infrastructure errors generic to the browser.
- Keep listing ownership server-derived. Never restore client-supplied `sellerId` or `sellerName` to the registry payload.
- A listing POST that returns 401 must close the composer, show `Log in to publish this listing.`, and navigate to `/login?returnTo=/%3Fcompose%3D1`; it must not become a local-success fallback.

## Current reviewed foundation

- Better Auth 1.6.27 is pinned and lazily constructed per request with Drizzle/D1.
- D1 user, session, account, verification, and database rate-limit tables exist.
- `/api/auth/*`, `/login`, a prominent right-most Login/My account action, session-gated listing writes, exact admin-email parsing, and return-path sanitizing exist.
- `app/account/route.ts` and `app/admin/route.ts` are deliberately minimal temporary shells. Replace them; do not keep route handlers alongside pages in the same segments.
- Twelve tests pass at the start of this batch.
- Codex already corrected state changes during React rendering, auth error leakage, production localhost trust, missing admin allowlist enforcement, and expired-session listing fallback.

## Slice B1 — behavior-level authenticated flow test

Add a durable test that exercises real public behavior through the built Worker:

1. Create an isolated in-memory SQLite database using Node's built-in `node:sqlite`.
2. Provide the minimal D1-compatible wrapper required by Drizzle (`prepare/bind/all/raw/run/first/batch/exec`) in a focused test helper; do not add a package dependency.
3. Apply `drizzle/0000_*.sql`, `0001_*.sql`, and `0002_*.sql` to that database.
4. Call the built Worker's public HTTP interface with a strong test-only `BETTER_AUTH_SECRET` and an `ASSETS` 404 stub.
5. Prove the following one behavior at a time:
   - a user can create an account;
   - `autoSignIn: false` means account creation does not grant an authenticated portal session;
   - the user can log in and open `/account`;
   - a normal signed-in user receives 404 from `/admin`;
   - an allowlisted signed-in user can open `/admin`;
   - a signed-in listing POST ignores browser-supplied seller identity and stores the session user ID/name.

Treat `Set-Cookie` as opaque. Extract only the cookie name/value pairs needed for later requests. Do not assert password hashes, token formats, internal SQL, or Better Auth implementation details.

If a small D1 test wrapper cannot faithfully support the public flow, stop and report the exact incompatibility instead of weakening the tests or adding a large dependency.

## Slice B2 — shared portal shell and account overview

Create:

- `app/portal/portal-shell.tsx`
- `app/account/page.tsx`
- `app/account/account-settings.tsx`

Delete the temporary `app/account/route.ts`.

Requirements:

- `PortalShell` accepts authenticated user data, an active section, `isAdmin`, and children.
- Its navigation always has Overview, My listings, and Account settings. Add Admin overview only for an administrator.
- Reuse the existing wordmark and visual language. Include a clear Back to marketplace link.
- The server account page uses `headers()` and `requireMarketplaceSession(..., "/account")`.
- Query only rows where `listings.sellerId === session.user.id`.
- Render a welcome heading, active/draft/sold counts, recent listings or a clear empty state, account name, and read-only email.
- The client settings component supports:
  - `authClient.updateUser({ name })`;
  - `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })`;
  - `authClient.signOut()`.
- Password inputs enforce 12–128 characters. Email remains read-only. Use accessible pending/success/error status regions.
- Avoid exposing internal errors verbatim when a neutral user-facing message is more appropriate.

Make the authenticated `/account` live-flow test green before moving on.

## Slice B3 — admin extension

Create `app/admin/page.tsx` and delete the temporary `app/admin/route.ts`.

Requirements:

- Require the session first.
- Read `MARKETPLACE_ADMIN_EMAILS` only on the server and call `isAdminEmail`.
- Call `notFound()` for a signed-in non-admin.
- Reuse `PortalShell` with `isAdmin={true}`.
- Query and render real D1 values:
  - total registered accounts;
  - total active listings;
  - total open reports;
  - the 20 most recent accounts with name, email, and creation time.
- The admin view is read-only. No action buttons for deleting, banning, role changes, reset, or impersonation.

Make both normal-user and allowlisted-admin live-flow tests green.

## Slice B4 — finish listing ownership behavior

Review the current composer and endpoint together.

- Preserve the session-derived `sellerId` and `sellerName` in `POST /api/listings`.
- Preserve the reviewed 401 handling and sanitized login return.
- The composer may display the authenticated account name as read-only context, but must not send browser ownership fields.
- Add the live-flow assertion proving a malicious `sellerId`/`sellerName` payload cannot change the stored listing owner.
- Do not change the intended offline/local-save behavior for genuine registry unavailability beyond what is necessary for the 401 boundary.

## Slice B5 — responsive portal styling and documentation

Add scoped portal styles to `app/globals.css`:

- desktop sidebar approximately 240px plus content;
- at 720px and below, navigation becomes a horizontally scrollable row;
- usable at 1440px, 768px, and 320px;
- visible keyboard focus, legible tables/cards, and no horizontal page overflow.

Update:

- `README.md`
- `ARCHITECTURE.md`
- `CURSOR_START_HERE.md`

Document truthfully:

- D1-backed accounts and sessions;
- server-session ownership for listing writes;
- server-only exact admin allowlist;
- public browsing remains open;
- emails are not yet verified;
- password-reset delivery does not yet exist;
- account creation is not identity verification;
- required variables `BETTER_AUTH_SECRET` and `MARKETPLACE_ADMIN_EMAILS`;
- the migration must be applied before enabling accounts in an environment.

## Verification before stopping

The macOS host lacks GNU `timeout`, so use the direct Vinext command and do not modify the build wrapper:

```bash
npm run lint
bash scripts/sites-env.sh -- ./node_modules/.bin/vinext build
bash scripts/validate-artifact.sh
node --test tests/*.test.mjs
git diff --check
```

All must exit zero. Then report:

- every changed/added/deleted file;
- each red-to-green slice;
- exact verification results and total passing tests;
- any Better Auth, Vinext, D1-test-wrapper, or React compatibility concern;
- confirmation that you did not commit, push, merge, or deploy.
