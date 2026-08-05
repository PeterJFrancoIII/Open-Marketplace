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
