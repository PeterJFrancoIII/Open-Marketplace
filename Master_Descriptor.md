# Master Descriptor — Open Marketplace

This file is the canonical product-direction document for Open Marketplace. It
defines what the default project is intended to become, including account,
decentralization, verification, ranking, privacy, and funding requirements.
These requirements are **planned direction unless a feature is explicitly
listed as implemented in `README.md` and covered by tests**.

## Document authority

Use this order when project documents overlap:

1. `Master_Descriptor.md` — product direction and non-negotiable outcomes.
2. `ARCHITECTURE.md` — technical boundaries and protocol design.
3. `POLICY.md` — default instance rules, enforcement, and appeals.
4. `README.md` — current capabilities and operator instructions.
5. `CURSOR_START_HERE.md` — implementation handoff and sequencing.

If two documents conflict, reconcile them before implementation. Do not use
this hierarchy to bypass a security, privacy, legal, or moderation safeguard.

## Product goal

Open Marketplace will be an account-based, open-source marketplace whose
listing metadata can be independently replicated. Users who contribute useful,
verifiable hosting capacity receive marketplace benefits. Users who do not host
may purchase the same clearly disclosed priority treatment for a small fee.

The incentive system must not create a public identity database, a hidden
ranking market, or a moderation bypass.

## Core terms

- **Account:** a user-controlled marketplace identity used to own listings,
  purchases, reputation, payments, and host status. Anonymous browsing may
  remain available, but publishing and other accountable actions require an
  authenticated account.
- **Replica:** a verified full copy of eligible marketplace metadata.
- **Shard or block host:** a verified host serving an assigned, content-addressed
  portion of eligible marketplace metadata.
- **Host:** an account operating a conforming replica or shard and responding to
  integrity and availability challenges.
- **Verified Host:** a host with both a current high-assurance identity
  attestation and a current hosting attestation.
- **Priority listing:** a listing displayed in the priority cohort before
  standard listings, with an accessible yellow treatment and a visible reason.
- **Qualified active account:** a Sybil-resistant, recently active account used
  by the published dynamic-pricing rule. Merely registering accounts must not
  increase the price.

## 1. Accounts and portable identity

1. An account is required to publish, edit, renew, or remove a listing; buy
   priority placement; submit authenticated ratings; or enroll as a host.
2. Listing and profile ownership must be enforced on the server. A
   client-generated device identifier is not authorization.
3. The long-term identity model should use user-controlled signing keys and
   signed, portable records so a user can move between conforming instances.
   Email, passkeys, OAuth, and similar methods are authentication adapters, not
   the sole authority over portable marketplace identity.
4. Account recovery, key rotation, revocation, and instance migration must have
   explicit, auditable flows.
5. Regular accounts do not need to submit photo ID merely to browse or publish,
   unless a separate lawful risk-control policy applies. High-assurance identity
   verification is mandatory for hosts because hosting earns system benefits
   and adds infrastructure trust.

## 2. Decentralized data and host qualification

1. Eligible listing metadata must be representable as canonical, signed,
   content-addressed records that multiple operators can validate and rebuild.
2. The protocol may recognize a full metadata replica or an assigned shard or
   block. The assigned data scope, protocol version, and availability target
   must be machine-readable.
3. A host earns status through recurring challenge-response proofs of:

   - possession of the assigned records;
   - record integrity against published hashes or signed envelopes;
   - availability and sufficient response quality; and
   - use of a supported protocol version.

4. Self-reporting that a node is online is not proof. Host status must expire
   automatically when proofs or identity attestations expire.
5. Grace windows, challenge frequency, minimum availability, supported replica
   sizes, and suspension thresholds must be public, versioned configuration.
6. Replication is limited to data explicitly eligible for replication. Raw
   identity evidence, private messages, payment credentials, secrets, private
   reports, and other restricted records are never part of a host copy.

## 3. High-assurance verification for hosts

A host must complete a clearly disclosed verification flow before receiving
host benefits. The default assurance package includes government-issued photo
ID plus high-confidence corroboration such as document-authenticity checks,
liveness and selfie matching, and verified contact or address information where
lawful and proportionate. The exact provider and checks require privacy,
security, accessibility, and legal review before launch.

Verification must follow these boundaries:

1. A designated identity-verification provider or tightly controlled trust
   function processes the source evidence. Community hosts do not receive it.
2. Raw photo-ID images, document numbers, selfies, biometric templates, and
   address evidence must never enter the public registry, listing envelopes,
   community replicas, analytics, application logs, or public profiles.
3. The marketplace receives only a minimal, signed, revocable attestation. It
   may include a pseudonymous subject identifier, assurance level, verifier,
   issue time, expiry time, revocation status, and only the jurisdictional facts
   actually required by policy.
4. Any confidential mapping needed to trace a verified host after credible
   fraud or misuse remains encrypted and access-controlled by the verifier or
   authorized trust function. Access must require a documented investigation or
   valid legal process, be logged, and follow the published disclosure policy.
5. Traceability does not mean public doxxing. Other users and replica operators
   see verification status, not the host's civil identity or documents.
6. The project must publish consent, retention, deletion, breach-response,
   accessibility, correction, and appeal procedures before collecting evidence.
7. Revocation or expiry removes Verified Host benefits after the disclosed
   grace and appeal rules; it does not silently delete the underlying account.

## 4. Verified Host benefits

While both attestations remain current, a Verified Host receives:

1. **Fee-free priority:** eligible listings from that account enter the priority
   cohort without paying the per-listing priority fee.
2. **Ad-free operation:** the default marketplace experience for that account
   contains no advertising.
3. **No nonessential tracking:** advertising, cross-site tracking, and optional
   analytics cookies or equivalent identifiers are disabled. Strictly necessary
   authentication, security, fraud-prevention, and user-requested preference
   storage may still be used and must be documented.

Benefits must be computed from current attestations, not a manually maintained
allowlist. A suspension must state the reason and provide an appeal route.

## 5. Priority listing presentation and ranking

1. Search and browse results render the priority cohort before the standard
   cohort when priority is applicable to that query.
2. Every priority card uses an accessible yellow border or background and a
   text label. Color alone must never communicate the status.
3. The label states the basis: **Verified Host Priority** or **Paid Priority**.
   Paid placement must be recognizable as paid placement.
4. Within the priority cohort, ordering uses the same published relevance,
   recency, distance, quality, and fair-rotation signals. Paying more must not
   buy a higher position, and operators must not add undisclosed manual boosts.
5. Standard listings remain searchable and discoverable. Rotation or capacity
   limits must prevent a large priority cohort from permanently capturing every
   visible position.
6. Priority never overrides restricted-item rules, fraud controls, quarantine,
   account suspension, or other moderation decisions.

## 6. Paid priority for non-hosts

1. A regular account may purchase priority for an eligible listing instead of
   hosting marketplace data.
2. The launch price is **USD $0.10 per listing for one disclosed priority
   term**. The interface must show the term length before purchase; its exact
   duration is an implementation decision still to be approved.
3. Verified Hosts receive the same placement benefit with the fee waived while
   host eligibility is current.
4. The price increases as the network gains Qualified Active Accounts. Before
   launch, governance must approve a deterministic formula, measurement window,
   update cadence, rounding rule, and reasonable bounds. Those values and their
   version history must be public configuration, not an undisclosed admin input.
5. The current price, formula version, effective date, and total charge must be
   shown before confirmation. A price change cannot alter an open checkout or
   apply retroactively to an already purchased term.
6. The system should support prepaid credit or batched settlement when necessary
   so payment-processing fees do not make a ten-cent purchase impractical.
7. Failed publication, duplicate charge, cancellation, and moderation-before-
   activation cases require explicit refund or credit rules.

## 7. Funding and privacy

Paid priority, voluntary donations, and privacy-respecting advertising may fund
the default project. Operators must publish material operating costs, the
current priority-price configuration, and the existence of paid placement.

The project must not sell user activity or identity data. Core browsing and
listing functions must not depend on advertising or cross-site tracking
cookies. Where nonessential storage or analytics is offered, obtain appropriate
consent and provide a real opt-out. Verified Host mode disables those funding
devices automatically.

## 8. Governance and auditability

- Host-proof rules, priority-term duration, pricing inputs, and ranking rules
  live in versioned public configuration.
- Changes include an effective date and migration behavior and are announced
  before taking effect.
- Audit records cover attestation status changes, host-proof decisions,
  priority purchases, price versions, refunds, ranking reason codes, and
  privileged access to traceability mappings. Audit records must not contain raw
  identity evidence.
- Anti-Sybil and anti-collusion controls must prevent fake accounts, fake hosts,
  or circular traffic from manipulating rewards or the dynamic price.
- Users can inspect why a listing received priority and appeal an incorrect host,
  payment, moderation, or ranking decision.
- A fork may adopt different economics, but it must disclose that divergence and
  must not falsely claim compatibility with the default incentive policy.

## 9. Delivery sequence

Implement and verify these layers in order:

1. Production accounts, authentication, ownership, recovery, and key rotation.
2. Signed listing envelopes and a portable account identity.
3. High-assurance verification adapter with minimal revocable attestations.
4. Replica and shard protocol plus recurring integrity/availability proofs.
5. Host-status state machine, expiry, suspension, grace, and appeal flows.
6. Priority ranking cohort, yellow accessible presentation, reason labels, and
   fair rotation.
7. Ten-cent paid-priority ledger, receipts/refunds, and public dynamic-pricing
   configuration.
8. Verified Host ad-free and no-nonessential-tracking mode.
9. Abuse, privacy, security, accessibility, payment, and jurisdictional review;
   then monitored staged release.

## 10. Decisions required before implementation is complete

The direction above is fixed, but these parameters are intentionally not
invented in this document:

- identity-verification provider, supported documents, jurisdictions, and
  evidence-retention period;
- replica versus shard sizes, proof algorithm, uptime target, challenge cadence,
  and grace window;
- priority-term duration and maximum visible priority share;
- Qualified Active Account definition, growth-price formula, update cadence,
  rounding, and price bounds;
- payment rail, minimum prepaid balance, refund timing, and tax treatment; and
- ad provider, consent mechanism, and whether advertising is enabled at all on
  the default instance.

Each decision must be recorded publicly with threat-model, privacy, cost,
accessibility, and abuse analysis before production rollout.

## 11. Acceptance criteria

The direction is implemented only when all of the following are demonstrable:

- an unauthenticated user cannot publish or buy priority;
- a regular authenticated account can publish without submitting host ID;
- host enrollment requires high-assurance verification and successful recurring
  data-hosting proofs;
- no raw identity evidence appears in a registry export, replica, log, analytics
  event, listing envelope, or public API response;
- losing either current attestation removes fee-free host priority according to
  the disclosed grace and appeal rules;
- priority results appear before standard results, with accessible yellow cards
  and explicit Verified Host Priority or Paid Priority labels;
- a regular account can buy one priority term for the displayed launch price of
  $0.10, with a receipt and tested refund/credit behavior;
- a public, deterministic pricing version changes the displayed price only from
  qualified network growth and never changes an in-progress checkout;
- a Verified Host sees no ads or nonessential tracking while essential storage
  is disclosed; and
- ranking, moderation, verification, payments, and privileged traceability
  access are auditable and have usable appeal paths.
