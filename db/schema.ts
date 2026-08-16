import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const authUsers = sqliteTable(
  "auth_users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" })
      .notNull()
      .default(false),
    image: text("image"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("auth_users_email_idx").on(table.email)],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("auth_sessions_token_idx").on(table.token),
    index("auth_sessions_user_idx").on(table.userId),
  ],
);

export const authAccounts = sqliteTable(
  "auth_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("auth_accounts_provider_account_idx").on(
      table.providerId,
      table.accountId,
    ),
    index("auth_accounts_user_idx").on(table.userId),
  ],
);

export const authVerifications = sqliteTable(
  "auth_verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("auth_verifications_identifier_idx").on(table.identifier),
  ],
);

export const authRateLimits = sqliteTable(
  "auth_rate_limits",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    count: integer("count").notNull(),
    lastRequest: integer("last_request", { mode: "number" }).notNull(),
  },
  (table) => [uniqueIndex("auth_rate_limits_key_idx").on(table.key)],
);

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  socialAccountsJson: text("social_accounts_json").notNull().default("[]"),
  paymentDestinationsJson: text("payment_destinations_json")
    .notNull()
    .default("[]"),
  itemsSold: integer("items_sold").notNull().default(0),
  sellerRating: real("seller_rating"),
  sellerRatingCount: integer("seller_rating_count").notNull().default(0),
  buyerRating: real("buyer_rating"),
  buyerRatingCount: integer("buyer_rating_count").notNull().default(0),
  socialCreditScore: integer("social_credit_score").notNull().default(0),
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

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    buyerId: text("buyer_id").notNull(),
    sellerId: text("seller_id").notNull(),
    lastMessageAt: text("last_message_at"),
    buyerSaleStatus: text("buyer_sale_status").notNull().default("pending"),
    sellerSaleStatus: text("seller_sale_status").notNull().default("pending"),
    salePriceCents: integer("sale_price_cents").notNull().default(0),
    buyerMarksSafe: integer("buyer_marks_safe", { mode: "boolean" })
      .notNull()
      .default(false),
    buyerConfirmedAt: text("buyer_confirmed_at"),
    sellerConfirmedAt: text("seller_confirmed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("conversations_listing_buyer_idx").on(
      table.listingId,
      table.buyerId,
    ),
    index("conversations_buyer_idx").on(table.buyerId),
    index("conversations_seller_idx").on(table.sellerId),
  ],
);

export const conversationMessages = sqliteTable(
  "conversation_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id").notNull(),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("conversation_messages_thread_idx").on(table.conversationId, table.createdAt)],
);

export const saleHistory = sqliteTable(
  "sale_history",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    buyerId: text("buyer_id").notNull(),
    sellerId: text("seller_id").notNull(),
    title: text("title").notNull(),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    soldAt: text("sold_at").notNull(),
  },
  (table) => [
    uniqueIndex("sale_history_listing_idx").on(table.listingId),
    index("sale_history_buyer_idx").on(table.buyerId),
    index("sale_history_seller_idx").on(table.sellerId),
  ],
);
