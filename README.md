# Open Marketplace

**Source:** https://github.com/PeterJFrancoIII/Open-Marketplace

Open Marketplace (formerly Open Exchange in the SOL 5.6 scaffold) is a deliberately small, open-source marketplace starter. It uses a familiar local-market grid, detailed eBay-style sorting, and a metadata-only registry. Photos stay in the seller's browser; the registry stores only listing text, prices, filters, identity claims, and content hashes.

This repository is an MVP framework, not a promise that a browser can serve photos while it is closed. The current build stores and previews seller media locally. Cross-device transfer is intentionally isolated behind a small WebRTC-ready transport contract so it can be completed without ever turning the registry into an image host.

## What works now

- Responsive marketplace grid with desktop and mobile layouts.
- Search plus filters for category, price, condition, buying format, and fulfillment.
- Sorts for best match, newest, ending soon, price, and distance.
- Fixed-price and auction-shaped listings.
- Listing composer with local image previews.
- SHA-256 image manifests; image blobs are stored in IndexedDB and never sent to `/api/listings`.
- Cloudflare D1 metadata registry with indexed listing fields.
- Clickable Facebook, Instagram, and TikTok profiles with visible account age,
  friend/follower counts, check status, and last-check timestamps.
- Live allowlisted link checks on page load, manual recheck, and publication;
  dead or malformed profile links must be fixed or removed.
- Central buyer/seller reputation summaries and items-sold counts on every listing.
- Donation call-to-action configured with one public URL.
- Demo data when the registry is unavailable, so the UI is easy to evaluate locally.
- Default restricted-items policy and a report table ready for moderation tooling.

## Important boundaries

- A resolving social URL proves only that the link works. Account creation dates
  and connection counts remain self-reported until provider OAuth supplies them.
  Provider OAuth requires developer applications, callback URLs, and each
  provider's approval. Add that after choosing the deployment domain.
- Cross-device image delivery is not complete in this scaffold. `lib/media-transport.ts` defines the boundary; connect a WebRTC data-channel implementation and a minimal signaling endpoint next.
- The seller must have an active browser session for true device-to-device media delivery. For offline availability, add opt-in encrypted community pinning or accept that media is unavailable.
- The public starter blocks weapons, ammunition, explosives, controlled substances, stolen goods, and other unlawful listings. See `POLICY.md`.
- Do not rely on a client-generated device ID for production authorization. Registry writes need real authentication and server-side ownership checks before a public launch.

## Local development

Requirements: Node.js 22.13 or newer and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The starter uses Vinext and Cloudflare-compatible bindings. Set `NEXT_PUBLIC_DONATION_URL` to a GitHub Sponsors, Open Collective, or other transparent funding page.

## Data layout

The central registry stores:

- title, description, price, condition, category, and location label;
- fixed-price or auction format and pickup/shipping options;
- seller display name and public social-profile claims;
- public account creation date, friend/follower count, link-health result, and
  when the link was last checked;
- centrally computed items sold plus separate buyer and seller ratings;
- media filename, MIME type, byte length, and SHA-256 digest;
- status and timestamps.

It does **not** store image bytes. Seller images live in the `open-exchange-media` IndexedDB database on the seller's device.

## Database migrations

The D1 binding is named `DB` in `.openai/hosting.json`.

```bash
npm run db:generate
```

Commit the generated SQL under `drizzle/`. The hosting platform applies the migration to the real D1 database during deployment.

## Cursor Auto Agent handoff

Give Cursor this repository and ask it to work through these milestones in order:

1. Connect `MediaTransport` to WebRTC data channels, using the registry only for short-lived signaling messages.
2. Verify each received blob against the advertised SHA-256 hash before rendering it.
3. Add public authentication and server-side listing ownership checks.
4. Replace self-reported social metrics with provider-specific OAuth
   attestations; keep live URL health as a separate signal.
5. Add a report/review UI, rate limits, spam controls, and a transparent moderation log.
6. Add signed listing envelopes so registry operators cannot silently alter listing metadata.
7. Configure `NEXT_PUBLIC_DONATION_URL` and the public repository URL.

`ARCHITECTURE.md` contains the protocol shape and failure modes.

## Deployment

The checked-in build emits a Cloudflare Worker-compatible artifact. The metadata registry can be hosted on a low-cost edge database. A fork that targets another platform should replace only the small registry adapter; the browser media vault and transport contract are platform-independent.

## Funding and governance

The intended operating model is transparent community funding: publish recurring costs, donation totals, and maintainer grants. Do not sell listing visibility or user activity. Add a governance document before accepting outside funds.

## License

MIT. Fork it, run it, and contribute improvements back when you can.
