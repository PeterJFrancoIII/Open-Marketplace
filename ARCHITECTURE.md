# Architecture

## Design rule

The registry is a searchable bulletin board, not a file host. It can disappear and be rebuilt from signed listing envelopes without taking seller-owned media with it.

`Master_Descriptor.md` defines the product outcomes this architecture must
support. The account, host-verification, replication, and priority systems below
are planned architecture, not claims about the current MVP.

## Components

| Component | Holds | Must not hold |
| --- | --- | --- |
| Browser media vault | Original image blobs, local previews, device key | Other sellers' durable media by default |
| Metadata registry | Listing fields, filters, social claims, reputation summaries, hashes, availability hints | Photos, videos, message contents |
| Peer transport | Short-lived encrypted image chunks | Durable media or listing authority |
| Account and identity adapter | Public keys, authentication metadata, ownership, OAuth attestations | Password plaintext, copied session cookies, raw host-verification evidence |
| Verification provider or trust function | Source identity evidence for the disclosed minimum retention period | Marketplace ranking authority or public identity records |
| Verification attestation registry | Pseudonymous subject, assurance level, verifier, issue/expiry/revocation state | Photo ID, document numbers, selfies, biometric templates, address evidence |
| Replica or shard host | Eligible signed listing records and public protocol data | Identity evidence, secrets, payment credentials, private messages or reports |
| Host-proof service | Assigned data scope, challenge results, availability, protocol version | Raw identity evidence or arbitrary private traffic |
| Ranking and pricing config | Public rule versions, price inputs, priority terms, ranking reason codes | Secret boosts or individually negotiated placement |
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

## Identity proofs

The UI accepts public profile URLs so the information architecture can be tested. Treat these as unverified claims. A production identity adapter should use official OAuth flows and store:

- provider name;
- provider subject identifier;
- current public handle;
- verification timestamp;
- scopes granted;
- optional signed attestation version.

Never ask users to paste social passwords, cookies, access tokens, or private profile exports into the app.

The live-link checker accepts only allowlisted HTTPS Facebook, Instagram, and
TikTok profile hosts. It follows only allowlisted redirects, caps response
inspection, treats 404/410 and recognized unavailable-page markers as dead,
and returns unknown when a platform blocks automated checks. Unknown is not
silently mislabeled as verified. Dead or malformed links block publication.

## Accounts and portable identity

Production writes require authenticated accounts and server-side ownership
checks. The target protocol uses a user-controlled signing key for portable
marketplace identity, with passkeys, email, OAuth, or other mechanisms acting as
authentication and recovery adapters. Account recovery, key rotation,
revocation, and migration must produce auditable state transitions.

Anonymous browsing may remain available. Listing publication, edits, priority
purchases, ratings, host enrollment, and other accountable actions require an
account. A browser-generated device identifier never grants authority by itself.

## Host identity verification

Regular marketplace identity and high-assurance host identity are separate
layers. A host-verification provider processes government photo ID and approved
corroborating checks, then returns a minimal signed and revocable attestation.
Marketplace services and community nodes consume the attestation, never the
source evidence.

The attestation schema may include only the pseudonymous subject, assurance
level, verifier, issue time, expiry, revocation state, and strictly necessary
jurisdictional claims. Any confidential mapping required for a documented fraud
or misuse investigation stays encrypted with the verifier or authorized trust
function. Access is policy-gated and audited. It is not part of registry export,
replication, analytics, application logs, or a public profile.

## Replica and shard proof

The decentralized storage layer distributes only records explicitly marked as
replication-eligible. Canonical signed envelopes and content hashes allow a node
to validate a full metadata replica or an assigned shard without trusting the
source registry.

A proof service issues unpredictable challenges for records within the node's
assignment and records integrity, availability, response quality, and protocol
version. A current hosting attestation is derived from recurring successful
proofs; self-reported uptime is insufficient. Identity and hosting attestations
have independent expiry and revocation. Both must be current for Verified Host
benefits.

Proof cadence, availability threshold, shard assignment, grace period, and
supported protocol versions belong in signed or otherwise auditable public
configuration. Anti-Sybil and anti-collusion controls must prevent fake nodes or
circular traffic from manufacturing host status.

## Priority ranking, pricing, and ad-free mode

Ranking is a two-cohort pipeline:

1. Filter every listing through eligibility, moderation, policy, and query
   matching.
2. Place eligible Verified Host and Paid Priority listings in the priority
   cohort.
3. Order that cohort with published relevance, recency, distance, quality, and
   fair-rotation rules.
4. Render the standard cohort after it, while preserving searchability and
   preventing permanent capture by priority inventory.

Each priority result carries a machine-readable reason code and a visible
**Verified Host Priority** or **Paid Priority** label. The UI provides an
accessible yellow treatment; color is not the only signal. Payment amount never
changes ordering within the cohort, and no hidden administrator boost exists.

Paid priority launches at USD $0.10 per listing for one disclosed term. A
versioned pricing service later derives the current fee from Sybil-resistant
qualified network growth using a deterministic formula approved through public
governance. Price version, inputs, effective date, term, and total are fixed for
an active checkout and recorded with the receipt. Host eligibility waives the
fee; it does not create a different secret ranking tier.

Verified Host mode removes ads and nonessential tracking identifiers. Essential
authentication, security, fraud-prevention, and requested preference storage
remain separate, documented concerns. Ad and analytics code must be gated so
host mode does not merely hide an ad while continuing its tracking requests.

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
- replicate no raw identity evidence or other restricted records;
- batch or pre-fund micropayments when direct ten-cent settlement is uneconomic;
- publish operating costs and donation balances.

## Security work before launch

- Public authentication and server-side authorization.
- Portable signing keys, recovery, rotation, and revocation.
- Rate limits per account, device, and network.
- Signed listing envelopes and replay protection.
- Threat-modeled high-assurance host verification with minimal attestations,
  evidence retention/deletion rules, breach response, and audited access.
- Abuse-resistant replica challenges, shard assignment, host expiry, and
  suspension/appeal flows.
- Transparent priority ranking, price versioning, payment receipts/refunds, and
  verified ad/tracking suppression for hosts.
- File-type sniffing and safe image decoding on the buyer device.
- Report, quarantine, appeal, and transparent moderation workflows.
- CSAM detection/reporting plan that does not turn the registry into a media store.
- Jurisdiction-aware restricted-item rules.
- Abuse-resistant signaling and TURN quotas.
- Privacy, retention, and law-enforcement request policies.
