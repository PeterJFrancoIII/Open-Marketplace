import { trustCardFromLegacyProfile } from "./compatibility.ts";
import type { TrustCardModel } from "./types.ts";

/** Deterministic fixtures for PR 1 projection/rebuild tests. */
export const trustFixtures = {
  newSeller: (): TrustCardModel =>
    trustCardFromLegacyProfile({
      profileId: "fixture-new",
      displayName: "New Neighbor",
      memberSince: "2026-08-01T00:00:00.000Z",
      itemsSold: 0,
      sellerRatingCount: 0,
      buyerRatingCount: 0,
      socialProofs: [],
    }),

  activeSeller: (): TrustCardModel =>
    trustCardFromLegacyProfile({
      profileId: "fixture-active",
      displayName: "Active Trader",
      memberSince: "2025-01-01T00:00:00.000Z",
      itemsSold: 12,
      sellerRating: 4.8,
      sellerRatingCount: 10,
      buyerRating: 5,
      buyerRatingCount: 4,
      socialProofs: [
        {
          provider: "instagram",
          url: "https://instagram.com/activetrader",
          handle: "activetrader",
          connectionCount: 420,
          connectionLabel: "followers",
          metricsSource: "self-reported",
          health: "active",
          accountCreatedAt: "2019-04-01",
        },
      ],
    }),

  establishedSeller: (): TrustCardModel =>
    trustCardFromLegacyProfile({
      profileId: "fixture-established",
      displayName: "Established Shop",
      memberSince: "2022-06-15T00:00:00.000Z",
      itemsSold: 86,
      sellerRating: 5,
      sellerRatingCount: 72,
      buyerRating: 4.9,
      buyerRatingCount: 18,
      socialProofs: [
        {
          provider: "tiktok",
          url: "https://www.tiktok.com/@shop",
          handle: "shop",
          connectionCount: 12420,
          connectionLabel: "followers",
          metricsSource: "oauth",
          health: "active",
        },
        {
          provider: "facebook",
          url: "https://www.facebook.com/shop",
          health: "active",
          metricsSource: "self-reported",
          accountCreatedAt: "2016-01-01",
        },
      ],
    }),

  socialActionRequired: (): TrustCardModel =>
    trustCardFromLegacyProfile({
      profileId: "fixture-action",
      displayName: "Needs Fix",
      memberSince: "2024-03-01T00:00:00.000Z",
      itemsSold: 5,
      sellerRating: 4.5,
      sellerRatingCount: 4,
      socialActionRequired: true,
      socialProofs: [
        {
          provider: "facebook",
          url: "https://www.facebook.com/deadprofile",
          health: "dead",
          lastCheckedAt: "2026-08-05T12:00:00.000Z",
        },
      ],
    }),

  suspended: (): TrustCardModel =>
    trustCardFromLegacyProfile({
      profileId: "fixture-suspended",
      displayName: "Suspended",
      memberSince: "2023-01-01T00:00:00.000Z",
      itemsSold: 40,
      suspended: true,
      socialProofs: [],
    }),
};
