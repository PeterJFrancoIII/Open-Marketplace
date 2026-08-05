import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  socialAccountsJson: text("social_accounts_json").notNull().default("[]"),
  itemsSold: integer("items_sold").notNull().default(0),
  sellerRating: real("seller_rating"),
  sellerRatingCount: integer("seller_rating_count").notNull().default(0),
  buyerRating: real("buyer_rating"),
  buyerRatingCount: integer("buyer_rating_count").notNull().default(0),
  /** new | active | established | suspended | social_action_required */
  standing: text("standing").notNull().default("new"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const listings = sqliteTable(
  "listings",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    condition: text("condition").notNull(),
    category: text("category").notNull(),
    locationLabel: text("location_label").notNull(),
    distanceMiles: real("distance_miles"),
    format: text("format").notNull().default("Fixed price"),
    delivery: text("delivery").notNull().default("Pickup"),
    sellerId: text("seller_id").notNull(),
    sellerName: text("seller_name").notNull(),
    socialProofsJson: text("social_proofs_json").notNull().default("[]"),
    imageManifestJson: text("image_manifest_json").notNull().default("[]"),
    status: text("status").notNull().default("active"),
    endingAt: text("ending_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("listings_status_created_idx").on(table.status, table.createdAt),
    index("listings_category_price_idx").on(table.category, table.priceCents),
    index("listings_seller_idx").on(table.sellerId),
  ],
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    details: text("details").notNull().default(""),
    reporterFingerprint: text("reporter_fingerprint"),
    status: text("status").notNull().default("open"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("reports_listing_status_idx").on(table.listingId, table.status)],
);

/** Legacy demo ratings — superseded by `reviews` after PR 3. Keep for read compatibility. */
export const reputationRatings = sqliteTable(
  "reputation_ratings",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    raterId: text("rater_id").notNull(),
    role: text("role").notNull(),
    score: integer("score").notNull(),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("ratings_one_per_listing_role_idx").on(
      table.listingId,
      table.raterId,
      table.role,
    ),
    index("ratings_subject_role_idx").on(table.subjectId, table.role),
  ],
);

export const profileCredentials = sqliteTable(
  "profile_credentials",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    assuranceTier: text("assurance_tier").notNull().default("A0"),
    publicKeyJson: text("public_key_json"),
    provider: text("provider"),
    providerSubjectHash: text("provider_subject_hash"),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    index("profile_credentials_profile_idx").on(table.profileId),
    uniqueIndex("profile_credentials_provider_subject_idx").on(
      table.provider,
      table.providerSubjectHash,
    ),
  ],
);

export const socialConnections = sqliteTable(
  "social_connections",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerSubjectHash: text("provider_subject_hash"),
    canonicalUrl: text("canonical_url").notNull(),
    handle: text("handle"),
    status: text("status").notNull().default("unknown"),
    accountCreatedAt: text("account_created_at"),
    accountCreatedAtSource: text("account_created_at_source"),
    connectionCount: integer("connection_count"),
    connectionLabel: text("connection_label"),
    connectionCountSource: text("connection_count_source"),
    verifiedAt: text("verified_at"),
    lastCheckedAt: text("last_checked_at"),
    lastSuccessfulRefreshAt: text("last_successful_refresh_at"),
    consecutiveDefinitiveFailures: integer("consecutive_definitive_failures")
      .notNull()
      .default(0),
    nextCheckAt: text("next_check_at"),
    scopesJson: text("scopes_json"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("social_connections_profile_idx").on(table.profileId),
    uniqueIndex("social_connections_profile_provider_url_idx").on(
      table.profileId,
      table.provider,
      table.canonicalUrl,
    ),
    // Global provider subject uniqueness (merge-gate blocker 5).
    uniqueIndex("social_connections_provider_subject_idx").on(
      table.provider,
      table.providerSubjectHash,
    ),
  ],
);

/** Short-lived PKCE state — code_verifier never leaves the server. */
export const oauthSessions = sqliteTable(
  "oauth_sessions",
  {
    state: text("state").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    codeVerifier: text("code_verifier").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    returnTo: text("return_to").notNull().default("/"),
    nonce: text("nonce").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [
    index("oauth_sessions_profile_idx").on(table.profileId),
    index("oauth_sessions_expires_idx").on(table.expiresAt),
  ],
);

/** Encrypted provider refresh/access grants — ciphertext only in D1. */
export const providerGrants = sqliteTable(
  "provider_grants",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    socialConnectionId: text("social_connection_id").references(
      () => socialConnections.id,
      { onDelete: "set null" },
    ),
    provider: text("provider").notNull(),
    providerSubjectHash: text("provider_subject_hash").notNull(),
    grantKid: text("grant_kid").notNull().default("v1"),
    grantIv: text("grant_iv").notNull().default(""),
    grantCiphertext: text("grant_ciphertext").notNull().default(""),
    grantedScopesJson: text("granted_scopes_json").notNull().default("[]"),
    status: text("status").notNull().default("active"),
    expiresAt: text("expires_at"),
    nextRefreshAt: text("next_refresh_at"),
    refreshBackoffSeconds: integer("refresh_backoff_seconds").notNull().default(3600),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    index("provider_grants_profile_idx").on(table.profileId),
    uniqueIndex("provider_grants_profile_provider_idx").on(
      table.profileId,
      table.provider,
    ),
  ],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    sellerId: text("seller_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("proposed"),
    offerCents: integer("offer_cents"),
    currency: text("currency").notNull().default("USD"),
    meetupNonce: text("meetup_nonce"),
    meetupNonceExpiresAt: text("meetup_nonce_expires_at"),
    buyerConfirmedAt: text("buyer_confirmed_at"),
    sellerConfirmedAt: text("seller_confirmed_at"),
    completedAt: text("completed_at"),
    reviewDeadlineAt: text("review_deadline_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("transactions_buyer_idx").on(table.buyerId),
    index("transactions_seller_idx").on(table.sellerId),
    index("transactions_status_idx").on(table.status),
  ],
);

export const transactionEvents = sqliteTable(
  "transaction_events",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    actorProfileId: text("actor_profile_id"),
    eventType: text("event_type").notNull(),
    reason: text("reason").notNull().default(""),
    payloadHash: text("payload_hash").notNull(),
    priorEventHash: text("prior_event_hash"),
    occurredAt: text("occurred_at").notNull(),
  },
  (table) => [index("transaction_events_tx_idx").on(table.transactionId)],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    visibility: text("visibility").notNull().default("sealed"),
    overallScore: integer("overall_score").notNull(),
    body: text("body").notNull().default(""),
    revealedAt: text("revealed_at"),
    removedReason: text("removed_reason"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("reviews_one_per_tx_reviewer_role_idx").on(
      table.transactionId,
      table.reviewerId,
      table.role,
    ),
    index("reviews_subject_idx").on(table.subjectId, table.visibility),
  ],
);

export const reviewDimensions = sqliteTable(
  "review_dimensions",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    dimension: text("dimension").notNull(),
    score: integer("score"),
    boolValue: integer("bool_value"),
    tag: text("tag"),
  },
  (table) => [index("review_dimensions_review_idx").on(table.reviewId)],
);

export const reviewResponses = sqliteTable(
  "review_responses",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("public_response"),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("review_responses_review_idx").on(table.reviewId),
    uniqueIndex("review_responses_one_per_review_idx").on(table.reviewId),
  ],
);

export const trustEvents = sqliteTable(
  "trust_events",
  {
    id: text("id").primaryKey(),
    subjectProfileId: text("subject_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    actorProfileId: text("actor_profile_id"),
    eventType: text("event_type").notNull(),
    occurredAt: text("occurred_at").notNull(),
    payloadHash: text("payload_hash").notNull(),
    priorEventHash: text("prior_event_hash"),
    registryId: text("registry_id").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    signature: text("signature").notNull(),
  },
  (table) => [
    index("trust_events_subject_idx").on(table.subjectProfileId, table.occurredAt),
  ],
);

export const trustProjections = sqliteTable(
  "trust_projections",
  {
    profileId: text("profile_id")
      .primaryKey()
      .references(() => profiles.id, { onDelete: "cascade" }),
    projectionVersion: text("projection_version").notNull(),
    calculatedAt: text("calculated_at").notNull(),
    lastEventId: text("last_event_id"),
    payloadJson: text("payload_json").notNull(),
  },
);

export const disputes = sqliteTable(
  "disputes",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    openedBy: text("opened_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("open"),
    reasonCode: text("reason_code").notNull(),
    summary: text("summary").notNull().default(""),
    resolutionCode: text("resolution_code"),
    publicOutcome: text("public_outcome"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    resolvedAt: text("resolved_at"),
  },
  (table) => [index("disputes_tx_idx").on(table.transactionId)],
);

export const moderationActions = sqliteTable(
  "moderation_actions",
  {
    id: text("id").primaryKey(),
    subjectProfileId: text("subject_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    issuerId: text("issuer_id").notNull(),
    action: text("action").notNull(),
    ruleCode: text("rule_code").notNull(),
    publicReason: text("public_reason").notNull().default(""),
    status: text("status").notNull().default("active"),
    scopeJson: text("scope_json"),
    expiresAt: text("expires_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("moderation_actions_subject_idx").on(table.subjectProfileId)],
);

export const appeals = sqliteTable(
  "appeals",
  {
    id: text("id").primaryKey(),
    moderationActionId: text("moderation_action_id")
      .notNull()
      .references(() => moderationActions.id, { onDelete: "cascade" }),
    appellantId: text("appellant_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("open"),
    statement: text("statement").notNull(),
    decisionPublic: text("decision_public"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    resolvedAt: text("resolved_at"),
  },
  (table) => [index("appeals_action_idx").on(table.moderationActionId)],
);

export const reviewReports = sqliteTable(
  "review_reports",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    reasonCode: text("reason_code").notNull(),
    status: text("status").notNull().default("open"),
    details: text("details").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    resolvedAt: text("resolved_at"),
  },
  (table) => [
    index("review_reports_review_idx").on(table.reviewId),
    uniqueIndex("review_reports_one_per_reporter_idx").on(
      table.reviewId,
      table.reporterId,
    ),
  ],
);

/** External VC evidence — never folded into native rating aggregates. */
export const externalTrustClaims = sqliteTable(
  "external_trust_claims",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    sourceLabel: text("source_label").notNull(),
    issuer: text("issuer").notNull(),
    claimType: text("claim_type").notNull(),
    valueJson: text("value_json").notNull(),
    evidenceLabel: text("evidence_label").notNull().default("external"),
    credentialId: text("credential_id").notNull(),
    status: text("status").notNull().default("unverified"),
    validFrom: text("valid_from").notNull(),
    validUntil: text("valid_until").notNull(),
    rawCredentialJson: text("raw_credential_json").notNull(),
    importedAt: text("imported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("external_trust_claims_profile_idx").on(table.profileId),
    uniqueIndex("external_trust_claims_credential_idx").on(
      table.profileId,
      table.credentialId,
    ),
  ],
);
