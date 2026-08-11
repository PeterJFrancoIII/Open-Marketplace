# Cursor Agent Handoff — Open Marketplace

Open this extracted folder as the project root in Cursor. Read this file,
`Master_Descriptor.md`, `README.md`, `ARCHITECTURE.md`, and `POLICY.md` before
changing code. `Master_Descriptor.md` is the product-direction source of truth.

## Project state

- Product: **Open Marketplace**, a lightweight open-source local marketplace.
- GitHub: https://github.com/PeterJFrancoIII/Open-Marketplace
- Framework: Next.js-compatible Vinext, React 19, TypeScript, Cloudflare Worker.
- Registry: Cloudflare D1 via Drizzle migrations.
- Media: image bytes remain in the seller's IndexedDB media vault.
- Production branch: `main`.
- Production deployment: `https://open-marketplace-demo.pages.dev`.
- The source commit changes over time. Inspect the current branch and run fresh
  validation; do not treat an old handoff commit as proof that later work passes.

## Implemented functionality

- Responsive Marketplace-style listing grid.
- Search and filters for category, price, condition, buying format, and delivery.
- Best match, newest, ending soon, price, and distance sorting.
- Fixed-price and auction-shaped listings.
- Listing composer with local-only image storage and SHA-256 manifests.
- D1 metadata registry; no image bytes are accepted by `/api/listings`.
- Clickable Facebook, Instagram, and TikTok account links.
- Visible social-account creation dates and friend/follower counts.
- Live, allowlisted social-link health checks on load and publication.
- Manual social-link recheck from listing details.
- Dead or malformed links block publication and seller contact until fixed or
  removed.
- Visible items-sold, seller-rating, and buyer-rating summaries.
- Central profile and reputation-rating database tables.
- Donation URL hook, restricted-items policy, CI workflow, and MIT license.

## Canonical planned direction — not yet implemented

- Accounts are required for publishing and other accountable actions, with
  server-side ownership and a portable signed identity direction.
- Users may operate a verified full metadata replica or assigned shard/block.
- Verified Hosts must hold both a current high-assurance identity attestation
  and a current recurring data-hosting attestation.
- Raw photo ID and corroborating evidence remain with the designated verifier;
  only a minimal signed, revocable attestation reaches marketplace systems.
- Verified Hosts receive fee-free priority plus an ad-free,
  no-nonessential-tracking experience.
- Regular accounts may buy one disclosed priority term for $0.10 per listing at
  launch. Later price changes come only from a published deterministic qualified-
  active-account formula.
- Priority results appear before standard results, use an accessible yellow
  treatment, and state **Verified Host Priority** or **Paid Priority**.

Do not present any item in this section as live until its implementation,
migrations, tests, privacy controls, and user-facing states are complete.

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
11. Do not place raw photo ID, document numbers, selfies, biometric templates,
    or address evidence in D1, listing envelopes, replicas, logs, analytics, or
    public APIs. Community hosts receive attestations, never source evidence.
12. Do not award Verified Host benefits from a manual flag or self-reported
    uptime. Both identity and hosting attestations must be current and revocable.
13. Keep priority ranking transparent: policy filtering occurs first, the
    priority cohort precedes standard results, every priority card has an
    accessible yellow treatment and reason label, and no hidden admin boost is
    allowed.
14. Paid priority never bypasses moderation. Host and paid listings use the same
    published ordering and fair-rotation rules within the priority cohort.
15. Verified Host mode must suppress ad and nonessential tracking requests, not
    merely hide their visual output. Document any strictly necessary storage.
16. Pricing inputs, formula version, effective date, priority term, host-proof
    thresholds, and grace rules are public, versioned configuration.

## Important honesty boundaries

- Account creation dates and friend/follower counts are currently self-reported.
- Live-link checks are automated URL-health checks, not identity verification.
- Public OAuth, production authorization, transaction settlement, messages, and
  WebRTC cross-device media delivery are not complete.
- Account creation, high-assurance host verification, decentralized replica or
  shard proof, priority placement, paid priority, dynamic pricing, and Verified
  Host ad-free mode are not complete.
- The $0.10 launch price is approved product direction, but priority-term
  duration and the qualified-active-account growth formula still require a
  documented governance decision before implementation.
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
```

Node.js 22.13 or newer is required. Set `NEXT_PUBLIC_DONATION_URL` in
`.env.local` if a donation destination is available.

## Primary code map

- `app/marketplace.tsx` — marketplace UI, listing form, filters, ratings, and
  trust-account presentation.
- `app/globals.css` — responsive visual system.
- `app/api/listings/route.ts` — D1 listing reads/writes and publication rules.
- `app/api/social-health/route.ts` — social-link checking endpoint.
- `lib/social-health.ts` — allowlisted URL normalization, redirects, and health
  classification.
- `lib/media-store.ts` — IndexedDB media vault and SHA-256 asset storage.
- `lib/media-transport.ts` — WebRTC-ready transport contract.
- `lib/types.ts` — shared listing, media, social, and reputation types.
- `db/schema.ts` — listings, profiles, reports, and reputation-rating tables.
- `drizzle/` — generated D1 migrations.
- `Master_Descriptor.md` — canonical product direction, incentives, privacy
  boundaries, delivery sequence, and acceptance criteria.
- `ARCHITECTURE.md` — protocol, integrity, and availability design.
- `POLICY.md` — default public-instance restrictions.

## Recommended next milestones

1. Add real public authentication and enforce listing/profile ownership on the
   server.
2. Add recovery and key rotation, then signed canonical listing envelopes and a
   portable identity binding.
3. Add an authenticated profile editor and provider OAuth adapters; keep social
   URL health separate from identity verification.
4. Add the high-assurance host-verification adapter and minimal revocable
   attestation schema. Complete privacy, retention, accessibility, and legal
   review before accepting real evidence.
5. Implement full-replica and shard assignment, synchronization, recurring
   integrity/availability challenges, expiry, suspension, and appeal.
6. Add the two-cohort priority pipeline, accessible yellow cards, explicit
   reason labels, fair rotation, and tests proving moderation runs first.
7. Add the $0.10-per-listing priority ledger, disclosed term, receipts/refunds,
   and versioned dynamic-pricing configuration after its formula is approved.
8. Add Verified Host ad-free and no-nonessential-tracking mode, with network and
   storage tests proving suppression.
9. Recompute rating summaries only from completed, authenticated transactions.
10. Implement WebRTC data-channel media transfer with expiring registry
    signaling and hash-check every received media blob before rendering it.
11. Add reports, quarantine, appeal, rate limits, and an auditable moderation
    log.
12. Configure the donation destination (`NEXT_PUBLIC_DONATION_URL`). Repo URL is
    already set to `PeterJFrancoIII/Open-Marketplace`.

## Definition of done for each Cursor change

- Preserve the architecture rules above.
- Add or update tests for behavior changes.
- Run `npm run lint` and `npm test`.
- Generate and inspect a Drizzle migration after every schema change.
- Verify desktop and mobile layouts, keyboard access, and disabled/error states.
- For identity and replication work, test that raw verification evidence cannot
  enter registries, replicas, logs, analytics, listing envelopes, or public APIs.
- For incentives, test expiry/revocation, priority reason codes, ordering,
  moderation precedence, price locking, receipts/refunds, fair rotation, and
  actual suppression of ad/tracking requests in Verified Host mode.
- Document new environment variables in `.env.example`.
- Do not commit secrets, tokens, social cookies, passwords, or private exports.

## Suggested first Cursor Agent prompt

> Read Master_Descriptor.md, CURSOR_START_HERE.md, README.md, ARCHITECTURE.md,
> and POLICY.md. Inspect the current code before editing. Build the next
> milestone without violating the account-ownership, raw-identity-evidence,
> local-media, live-link, ranking-transparency, reputation-integrity, or
> restricted-items rules. Explain your plan, make focused changes, generate
> migrations if required, and finish by running lint and tests.
