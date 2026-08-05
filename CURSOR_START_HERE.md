# Cursor Agent Handoff — Open Marketplace

Open this extracted folder as the project root in Cursor. Read this file,
`README.md`, `SOCIAL_TRUST_FRAMEWORK.md`, `ARCHITECTURE.md`, and `POLICY.md`
before changing code.

## Project state

- Product: **Open Marketplace**, a lightweight open-source local marketplace.
- GitHub: https://github.com/PeterJFrancoIII/Open-Marketplace
- Framework: Next.js-compatible Vinext, React 19, TypeScript, Cloudflare Worker.
- Registry: Cloudflare D1 via Drizzle migrations.
- Media: image bytes remain in the seller's IndexedDB media vault.
- Latest validated source commit: social-trust PR 1+2 on `codex/social-trust-framework`.
- Current deployment:
  `https://open-exchange-market.tempus-innov-6508.chatgpt.site`
- Validation completed: ESLint, production build, artifact validation,
  rendered-page tests, trust-domain tests, and transaction-lifecycle tests.

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
11. Never create one universal trust score or use social popularity in ranking,
    permissions, reputation, or enforcement.
12. Accept reviews only from authenticated counterparties to a completed
    transaction and keep two-sided reviews sealed until simultaneous reveal.

## Important honesty boundaries

- Account creation dates and friend/follower counts are currently self-reported.
- Live-link checks are automated URL-health checks, not identity verification.
- Facebook OAuth (PKCE + encrypted grants) is implemented; Instagram/TikTok
  adapters, production authorization, transaction settlement, messages, and
  WebRTC cross-device media delivery are not complete.
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
- `app/api/oauth/[provider]/{begin,callback,disconnect,refresh}/` — Facebook
  PKCE OAuth + encrypted grants (PR 5).
- `app/api/disputes`, `appeals`, `moderation/actions`, `transparency`,
  `reviews/:id/report` — safety workflow (PR 6).
- `lib/trust/oauth/` — adapters, AES-GCM grant sealing, claim normalization.
- `lib/trust/safety.ts` — dispute/moderation/appeal/report domain rules.
- `lib/trust/portable/` — canonical serialization, ECDSA signing, VC export/verify.
- `app/api/profiles/[id]/trust/export`, `import-external`, `/api/trust/verify`,
  `/api/trust/keys` — portable trust (PR 7).
- `lib/social-health.ts` — allowlisted URL normalization, redirects, and health
  classification.
- `lib/media-store.ts` — IndexedDB media vault and SHA-256 asset storage.
- `lib/media-transport.ts` — WebRTC-ready transport contract.
- `lib/types.ts` — shared listing, media, social, and reputation types.
- `db/schema.ts` — listings, profiles, reports, and reputation-rating tables.
- `drizzle/` — generated D1 migrations.
- `ARCHITECTURE.md` — protocol, integrity, and availability design.
- `SOCIAL_TRUST_FRAMEWORK.md` — researched trust architecture, data contracts,
  threat model, acceptance criteria, and staged Cursor plan.
- `POLICY.md` — default public-instance restrictions.

## Recommended next milestones

1. ~~Complete PR 1 in `SOCIAL_TRUST_FRAMEWORK.md`: normalized trust storage,
   append-only events, deterministic projections, migration, and compatibility
   reads.~~
2. ~~Complete PR 2: authenticated transactions, two-party meetup completion,
   review eligibility, idempotency, and rate limits.~~
3. ~~Complete PR 3: 14-day double-blind reviews and Bayesian projections from
   eligible reviews.~~
4. ~~Complete PR 4: one accessible evidence-based trust card on every marketplace
   surface.~~
5. ~~Complete PR 5: official OAuth adapters, encrypted grants, and honest field
   degradation; keep link health separate from identity verification.~~
6. ~~Complete PR 6: disputes, appeals, rate limits, and transparent moderation.~~
7. ~~Complete PR 7: signed portable trust claims and verifiable exports.~~
8. Implement WebRTC data-channel media transfer and hash-check every received
   blob.
9. Configure the donation destination (`NEXT_PUBLIC_DONATION_URL`).

## Definition of done for each Cursor change

- Preserve the architecture rules above.
- Add or update tests for behavior changes.
- Run `npm run lint` and `npm test`.
- Generate and inspect a Drizzle migration after every schema change.
- Verify desktop and mobile layouts, keyboard access, and disabled/error states.
- Document new environment variables in `.env.example`.
- Do not commit secrets, tokens, social cookies, passwords, or private exports.

## Suggested first Cursor Agent prompt

> Read CURSOR_START_HERE.md, SOCIAL_TRUST_FRAMEWORK.md, README.md,
> ARCHITECTURE.md, and POLICY.md. Inspect the current code before editing.
> Implement only PR 1 from the Social Trust delivery plan. Preserve local-only
> media, the allowlisted link checker, and current compatibility reads. Do not
> create a universal trust score or any rating path without an authenticated
> completed transaction. Explain the plan, make focused changes, generate and
> inspect the migration, add tests, and finish by running lint and the full test
> suite.
