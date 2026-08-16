# Architecture

## Design rule

The registry is a searchable bulletin board, not a file host. It can disappear and be rebuilt from signed listing envelopes without taking seller-owned media with it.

## Components

| Component | Holds | Must not hold |
| --- | --- | --- |
| Browser media vault | Original image blobs, local previews, device key | Other sellers' durable media by default |
| Metadata registry | Listing fields, filters, social claims, reputation summaries, hashes, availability hints | Photos, videos, message contents |
| Peer transport | Short-lived encrypted image chunks | Durable media or listing authority |
| Identity adapter | OAuth attestation metadata | Social passwords or copied session cookies |
| Donation provider | Contributions and receipts | Marketplace identity graph |

## Listing publication

1. The seller chooses images in the listing composer.
2. The browser computes a SHA-256 digest for every image.
3. The browser stores each blob in IndexedDB under its digest.
4. The browser publishes listing metadata plus the image manifest to the registry.
5. The registry indexes only fields needed for search, sort, policy, and discovery.

The current code implements steps 1–5. It does not upload image bytes.

## Media retrieval protocol

`lib/media-transport.ts` is the implementation boundary for the next layer.

1. A buyer requests a manifest hash.
2. The registry relays a short-lived WebRTC offer to the seller's active session.
3. Seller and buyer exchange ICE candidates through expiring signaling records.
4. The seller streams chunks over an encrypted WebRTC data channel.
5. The buyer reassembles the blob and verifies its SHA-256 digest.
6. A mismatch is discarded and reported; a match may be cached locally with explicit consent.
7. Signaling records expire within minutes. No media chunk enters the registry.

Start with polling for offers. It is simpler and cheaper than a permanent WebSocket service. TURN relays may be necessary for some networks; make relay use visible because TURN can temporarily carry encrypted traffic and creates the main variable cost.

## Availability trade-offs

There is no magic offline peer. Choose one or more explicit modes:

- **Seller online only:** cheapest and strongest seller control; images disappear when the seller closes the app.
- **Trusted-device seeding:** the seller keeps a low-power device online.
- **Encrypted community pinning:** opt-in peers store ciphertext and the seller controls decryption capability.
- **External content address:** the seller publishes an IPFS/other content address and accepts that third parties may retain the bytes.

The default framework chooses seller-online-only.

The first trusted full host is a Synology Arch Linux container
(`hosting-node/`). It stores the public marketplace dataset: listing
metadata, public seller profiles, and content-addressed photos. It does not
store passwords, sessions, Facebook tokens, or identity documents. Cloudflare
D1 remains the public preview registry. A host always keeps its operator's
own listings and photos, even after a later scale-down decree. Listings may
advertise the host's public HTTPS origin as an availability hint so other
browsers can fetch photos by hash. While fewer than three hosts are live,
every host also keeps a complete copy of the public set. Adding hosts spreads
read traffic by `hash(objectId) % hostCount`. After the replica floor is met,
Main may issue a sharded decree; hosts then scale down only when at least
three duplicates of each record remain and never drop owner-pinned items.

## Identity proofs

The UI accepts public profile URLs so the information architecture can be tested. Treat these as unverified claims. A production identity adapter should use official OAuth flows and store:

- provider name;
- provider subject identifier;
- current public handle;
- verification timestamp;
- scopes granted;
- optional signed attestation version.

Never ask users to paste social passwords, cookies, access tokens, or private profile exports into the app.

Public payment destinations are account-level contact metadata for the launch
set: PayPal, Venmo, Cash App, Zelle, and Apple Cash, plus Bitcoin on Bitcoin
Mainnet, Ethereum on Ethereum Mainnet, Tether (USDT) on Ethereum Mainnet
(ERC-20), BNB on BNB Smart Chain Mainnet, and USDC on Ethereum Mainnet
(ERC-20). Zelle and Apple Cash store only a deliberately typed email or U.S.
mobile number; they are never auto-filled from the account login. Crypto
destinations are asset-and-network bound; ambiguous rails such as bare USDT or
Solana are not stored. Store only public emails, handles, URLs, addresses, or
contact identifiers. Never store private keys, seed phrases, bank/card
credentials, or provider tokens. A saved destination is not checkout, custody,
or a verified payment identity.

The live-link checker accepts only allowlisted HTTPS Facebook, Instagram, and
TikTok profile hosts. It follows only allowlisted redirects, caps response
inspection, treats 404/410 and recognized unavailable-page markers as dead,
and returns unknown when a platform blocks automated checks. Unknown is not
silently mislabeled as verified. Dead or malformed links block publication.

## Reputation

Profile reputation is independent of individual listings. The registry keeps
items sold, buyer rating/count, and seller rating/count in the profile record,
while atomic rating events live in `reputation_ratings`. The public UI reads
the central summary on every listing. A production rating write must require
an authenticated completed transaction and allow no more than one rating per
party, listing, and role.

## Integrity and portability

The next protocol revision should wrap every listing in a canonical JSON envelope signed by the seller's device key. A registry then indexes envelopes without becoming their authority. Include a monotonic revision, prior revision hash, expiry, and tombstone state so edits and deletions are auditable.

## Minimal central cost

Keep the registry lean:

- paginate every query;
- index status/date, category/price, and seller ID;
- cap text and manifest sizes;
- expire signaling data aggressively;
- perform no image transcoding;
- let sellers calculate hashes;
- publish operating costs and donation balances.

## Security work before launch

- Public authentication and server-side authorization are present for account
  sessions and listing writes. Email verification delivery, password-reset
  delivery, and identity-document checks are still launch gates.
- Rate limits per account, device, and network.
- Signed listing envelopes and replay protection.
- File-type sniffing and safe image decoding on the buyer device.
- Report, quarantine, appeal, and transparent moderation workflows.
- CSAM detection/reporting plan that does not turn the registry into a media store.
- Jurisdiction-aware restricted-item rules.
- Abuse-resistant signaling and TURN quotas.
- Privacy, retention, and law-enforcement request policies.

## Account authorization

Accounts and sessions live in D1 through Better Auth. Public browsing remains
open. `POST /api/listings` requires a validated session and stores
session-derived `sellerId` / `sellerName` only. Authenticated `GET`/`PUT`
`/api/account/profile` persist that session's public social and payment
metadata; browser fields cannot select another user. Admin access to `/admin` is an
exact server-side allowlist check against `MARKETPLACE_ADMIN_EMAILS`; signed-in
non-admins receive the framework not-found response. Required environment
variables are `BETTER_AUTH_SECRET` and `MARKETPLACE_ADMIN_EMAILS`. Apply the
auth migration before enabling accounts in an environment. Emails are not yet
verified, password-reset delivery does not exist, and account creation is not
identity verification.
