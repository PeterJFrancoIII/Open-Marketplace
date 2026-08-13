# Cursor Agent Handoff — Open Marketplace

## Required coordination bootstrap

Open this repository as a project root in Cursor. Before changing any file,
read `AGENTS.md`, `Master_Descriptor.md`, `agent-memory/README.md`,
`agent-memory/STATE.md`, `agent-memory/TASKS.md`, and
`agent-memory/DECISIONS.md`. Then read this file, `README.md`,
`ARCHITECTURE.md`, and `POLICY.md`.

Cursor agents are implementation subagents. Work only from a task ID assigned
in `agent-memory/TASKS.md`, stay inside its allowed paths and actions, and write
an append-only handoff under `agent-memory/handoffs/` before stopping. Codex is
the architect and administrator and reconciles canonical state after review.

If this file conflicts with `Master_Descriptor.md` or the accepted shared-memory
records, stop and report the conflict; do not follow stale text.

## Project state

- Product: **Open Marketplace**, a lightweight open-source local marketplace.
- GitHub: https://github.com/PeterJFrancoIII/Open-Marketplace
- Framework: Next.js-compatible Vinext, React 19, TypeScript, Cloudflare Worker.
- Registry: Cloudflare D1 via Drizzle migrations.
- Accounts: Better Auth 1.6.27 with D1 users/sessions; listing writes require a
  server session; `/admin` uses the exact `MARKETPLACE_ADMIN_EMAILS` allowlist.
- Media: image bytes remain in the seller's IndexedDB media vault.
- Working branch: `feature/account-management-portal`.
- Existing Pages project and URL: `open-marketplace-demo` at
  `https://open-marketplace-demo.pages.dev`.
- The account portal work on this branch is not deployed. Validate the current
  HEAD and configure D1 migrations/runtime secrets before release.

## Implemented functionality

- Responsive Marketplace-style listing grid.
- Search and filters for category, price, condition, buying format, and delivery.
- Best match, newest, ending soon, price, and distance sorting.
- Fixed-price and auction-shaped listings.
- Listing composer with local-only image storage and SHA-256 manifests.
- D1 metadata registry; no image bytes are accepted by `/api/listings`.
- Account creation/login, `/account` management console, and read-only `/admin`
  overview for allowlisted administrators.
- Persistent Facebook, Instagram, and TikTok links plus public PayPal, Venmo,
  Cash App, Bitcoin (Bitcoin Mainnet), Ethereum (Ethereum Mainnet), USDT
  (Ethereum Mainnet ERC-20), BNB (BNB Smart Chain Mainnet), and USDC (Ethereum
  Mainnet ERC-20) destinations in account settings. New listings default to the
  signed-in profile's saved social links.
- Clickable Facebook, Instagram, and TikTok account links.
- Visible social-account creation dates and friend/follower counts.
- Live, allowlisted social-link health checks on load and publication.
- Manual social-link recheck from listing details.
- Dead or malformed links block publication and seller contact until fixed or
  removed.
- Visible items-sold, seller-rating, and buyer-rating summaries.
- Central profile and reputation-rating database tables.
- Donation URL hook, restricted-items policy, CI workflow, and MIT license.

## Non-negotiable architecture rules

1. Never upload listing image bytes to the registry. Only store content hashes,
   MIME type, filename, and size.
2. Keep seller media in IndexedDB and deliver it through a future peer transport.
3. Keep the registry replaceable and cheap. It indexes metadata; it is not the
   authority over user-owned files.
4. Never label a social account or metric as provider-verified unless it came
   from an official OAuth flow and has `metricsSource: "oauth"`.
5. A resolving URL means only that the URL is live. It does not prove identity.
6. Preserve the allowlist and redirect checks in `lib/social-health.ts`; do not
   introduce arbitrary server-side URL fetching or SSRF risk.
7. Do not bypass the dead/invalid-link publishing block. Users must fix or
   remove a broken link.
8. Ratings writes must eventually require an authenticated completed
   transaction. Do not expose an anonymous rating-write endpoint.
9. Preserve the default restricted-items policy and applicable-law checks.
10. Keep D1 structured data behind the existing database helper and commit every
    generated migration.
11. Listing ownership is server-derived from the session. Never restore
    client-supplied `sellerId` or `sellerName` to the registry payload.
12. Do not call an email address or account “verified.” Email verification and
    password-reset delivery are not available yet.

## Important honesty boundaries

- Account creation dates and friend/follower counts are currently self-reported.
- Live-link checks are automated URL-health checks, not identity verification.
- Account emails are not verified; password reset is not available; account
  creation is not identity verification.
- Public browsing remains open without signing in.
- Provider OAuth, transaction settlement, messages, and WebRTC cross-device
  media delivery are not complete.
- A seller browser must be online for true seller-device media delivery unless
  an explicit encrypted pinning mode is added.
- The contact-seller button is a transport placeholder.

## First commands

```bash
npm ci
cp .env.example .env.local
npm run lint
npm test
npm run dev
node scripts/apply-local-d1-migrations.mjs
```

Node.js 22.13 or newer is required. Set `NEXT_PUBLIC_DONATION_URL`,
`BETTER_AUTH_SECRET`, and `MARKETPLACE_ADMIN_EMAILS` in `.env.local`. Apply the
D1 migrations under `drizzle/` before enabling accounts in an environment. The
GitHub Pages workflow deploys application files but does not apply migrations or
inject application runtime secrets.

## Primary code map

- `app/marketplace.tsx` — marketplace UI, listing form, filters, ratings, and
  trust-account presentation.
- `app/globals.css` — responsive visual system.
- `app/account/` / `app/admin/` / `app/portal/` — authenticated management
  consoles sharing one portal shell.
- `app/login/` — combined login and account-creation UI.
- `app/api/listings/route.ts` — D1 listing reads/writes and publication rules.
- `app/api/account/profile/route.ts` — session-owned social and payment settings.
- `app/api/auth/[...all]/route.ts` — Better Auth handler.
- `app/api/social-health/route.ts` — social-link checking endpoint.
- `lib/auth.ts` / `lib/auth-client.ts` / `lib/admin-policy.ts` — session helpers
  and exact admin allowlist checks.
- `lib/social-health.ts` — allowlisted URL normalization, redirects, and health
  classification.
- `lib/payment-destinations.ts` / `lib/profile-settings.ts` — public payment
  destination validation and profile social persistence.
- `lib/media-store.ts` — IndexedDB media vault and SHA-256 asset storage.
- `lib/media-transport.ts` — WebRTC-ready transport contract.
- `lib/types.ts` — shared listing, media, social, and reputation types.
- `db/schema.ts` — listings, profiles, reports, reputation, and auth tables.
- `drizzle/` — generated D1 migrations.
- `ARCHITECTURE.md` — protocol, integrity, and availability design.
- `POLICY.md` — default public-instance restrictions.

## Recommended next milestones

1. Add email verification and password-reset delivery once outbound email exists.
2. Add provider OAuth adapters and refresh account metadata through official APIs.
3. Recompute rating summaries only from completed, authenticated transactions.
4. Implement WebRTC data-channel media transfer with expiring registry signaling.
5. Hash-check every received media blob before rendering it.
6. Add reports, quarantine, appeal, rate limits, and an auditable moderation log.
7. Add signed canonical listing envelopes and revision/tombstone history.
8. Configure the donation destination (`NEXT_PUBLIC_DONATION_URL`). Repo URL is already set to `PeterJFrancoIII/Open-Marketplace`.

## Definition of done for each Cursor change

- Preserve the architecture rules above.
- Add or update tests for behavior changes.
- Run `npm run lint` and `npm test`.
- Generate and inspect a Drizzle migration after every schema change.
- Verify desktop and mobile layouts, keyboard access, and disabled/error states.
- Document new environment variables in `.env.example`.
- Do not commit secrets, tokens, social cookies, passwords, or private exports.

## Suggested first Cursor Agent prompt

> Read CURSOR_START_HERE.md, README.md, ARCHITECTURE.md, and POLICY.md. Inspect
> the current code before editing. Build the next milestone without violating
> the local-media, live-link, reputation-integrity, or restricted-items rules.
> Explain your plan, make focused changes, generate migrations if required, and
> finish by running lint and tests.
