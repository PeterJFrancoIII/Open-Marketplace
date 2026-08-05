# Cursor Agent Handoff — Open Marketplace

Open this extracted folder as the project root in Cursor. Read this file,
`README.md`, `SOCIAL_TRUST_FRAMEWORK.md`, `ARCHITECTURE.md`, and `POLICY.md`
before changing code.

## Current merge gate — BLOCKED

- Verdict: `OPEN_MARKETPLACE_MAIN_REVIEW_FIX_REQUIRED`
- Pull request: [PR 1](https://github.com/PeterJFrancoIII/Open-Marketplace/pull/1)
- Main-reviewed head: `e0e3653e6b9d42ad293fd3b759a3df732b9a6dec`
- Rule: do **not** merge, deploy, wire production services, or begin WebRTC work until a new Main review returns PASS.
- This GitHub branch is the source of truth. Ignore older ZIP files, patch files, and local handoff bundles.

### Required remediation

1. Replace caller-controlled `X-Profile-Id` / `X-Device-Id` identity with server-authenticated identity. Until then, disable protected mutations. Add negative authorization tests for transactions, reviews, disputes, appeals, OAuth ownership, moderation, and trust export.
2. Apply strict runtime schemas to listing manifests and external credentials. Strip unknown fields; enforce field and total byte limits; reject data URLs, base64 payloads, blobs, and binary-shaped fields so D1 can never receive media bytes.
3. Require independent buyer and seller attestations before a transaction can reach `completed` or `review_window`. One party must never manufacture a review-eligible transaction.
4. Make transaction-derived `trust_projections` the only source for rating UI and native portable claims. Cryptographically sign and hash-chain runtime trust events; never publish `unsigned:...` events as trusted provenance.
5. Enforce global uniqueness of provider + provider-subject identity, move Facebook secrets/tokens out of request URLs, and accept only same-origin relative `returnTo` paths.
6. Validate at startup that configured registry private/public JWKs are one matching P-256 keypair. Fail closed when missing, malformed, or mismatched.
7. Repair migration `0007` so an existing `0006` database with duplicate review responses is cleaned or quarantined without data loss before the unique index is created.

### Evidence required before Main re-review

- Install the prepared workflow at `.github/workflows/ci.yml`; do not leave it only under `docs/ci/`.
- Run `npm ci`, `npm run lint`, `npm test`, `npm run build`, and `npm audit --omit=dev`.
- Prove migrations `0000` → `0007` on an empty D1 database and `0001` → `0007` plus dirty `0006` → `0007` on populated fixtures.
- Add regression tests for every remediation item above, including hostile payloads and unauthorized callers.
- Resolve the production dependency advisories or document an explicit reviewed exception.
- Split the oversized branch into staged, reviewable PRs before merging: trust foundation, transactions, reviews/projections, UI, OAuth, moderation, portable trust, and branding.
- Request a fresh defect-first Main review. Only a PASS authorizes merge/deploy/wiring or new feature work.


## Project state

- Product: **Open Marketplace**, a lightweight open-source local marketplace.
- GitHub: https://github.com/PeterJFrancoIII/Open-Marketplace
- Framework: Next.js-compatible Vinext, React 19, TypeScript, Cloudflare Worker.
- Registry: Cloudflare D1 via Drizzle migrations.
- Media: image bytes remain in the seller's IndexedDB media vault.
- Current review branch: `codex/social-trust-framework`; the reviewed head above is blocked pending remediation.
- Current deployment:
  `https://open-exchange-market.tempus-innov-6508.chatgpt.site`
- Last Main review: 46/46 tests passed and lint had no errors, but there is no installed CI workflow, migration `0007` is unsafe for dirty existing data, and production dependency advisories remain.

## Implemented functionality

- Responsive Marketplace-style listing grid.
- Search and filters for category, price, condition, buying format, and delivery.
- Best match, newest, ending soon, price, and distance sorting.
- Fixed-price and auction-shaped listings.
- Listing composer with local-only image storage and SHA-256 manifests.
- D1 metadata registry design; strict schema enforcement that guarantees no media bytes reach D1 is a current merge blocker.
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

- Authentication and authorization are not production-ready: caller-controlled identity headers make protected mutations impersonable until remediation item 1 is complete.
- Existing trust exports and UI ratings are not production-grade provenance until transaction-derived projections and signed hash-chained events are wired end to end.

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

1. Fix the seven Main-review blockers above, beginning with server-authenticated identity.
2. Install CI and add regression tests for every blocker.
3. Prove all fresh and upgrade migration paths, including duplicate-response data at `0006`.
4. Split the current oversized PR into the staged review units listed above.
5. Run the full evidence suite and request Main re-review.
6. Only after PASS: merge the approved stages, configure the donation destination, and then plan WebRTC media transfer.

## Definition of done for each Cursor change

- Preserve the architecture rules above.
- Add or update tests for behavior changes.
- Run `npm run lint` and `npm test`.
- Generate and inspect a Drizzle migration after every schema change.
- Verify desktop and mobile layouts, keyboard access, and disabled/error states.
- Document new environment variables in `.env.example`.
- Do not commit secrets, tokens, social cookies, passwords, or private exports.

## Suggested Cursor Agent prompt

> Work only on the merge-gate remediation for Open Marketplace PR 1 on
> `codex/social-trust-framework`. Read `CURSOR_START_HERE.md`,
> `SOCIAL_TRUST_FRAMEWORK.md`, `ARCHITECTURE.md`, and `POLICY.md` before
> editing. Preserve local-only media, separate buyer/seller reputation, and the
> rule that social popularity never ranks or grants permissions. Fix the seven
> blockers in the listed order, starting with server-authenticated identity.
> Add adversarial regression tests, install CI, and verify fresh plus dirty
> upgrade migrations through `0007`. Do not start WebRTC or other features,
> and do not merge, deploy, or wire production services. Finish with exact
> commands, return codes, and the commit SHA for a new Main review.
