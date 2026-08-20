import assert from "node:assert/strict";
import test from "node:test";
import {
  connectedSocialProof,
} from "../lib/social-connectors.ts";
import {
  factsFromFacebookConnection,
  factsFromSocialProof,
  officialConnectorDisplay,
  publicConnectorCatalog,
} from "../lib/official-connector-facts.ts";
import { connectedFacebookSocialProof } from "../lib/facebook-listing-proof.ts";

test("official connector display includes every stored public field", () => {
  const display = officialConnectorDisplay({
    name: "Peter Franco",
    firstName: "Peter",
    lastName: "Franco",
    shortName: "Pete",
    handle: "peterfranco",
    location: "New York, NY",
    hometown: "Philadelphia, PA",
    locale: "en_US",
    gender: "male",
    ageRange: "21-21",
    bio: "Seller bio from Facebook",
    websiteUrl: "https://www.example.com",
    profileUrl: "https://www.facebook.com/openmarketplace.seller",
    accountType: "BUSINESS",
    accountCreatedAt: "2018-06-15",
    connectionCount: 1200,
    followingCount: 80,
    likesCount: 3400,
    contentCount: 42,
    listedCount: 3,
    connectionLabel: "followers",
    providerVerified: true,
  });

  assert.equal(display.headline, "Peter Franco");
  assert.equal(display.handle, "peterfranco");
  assert.ok(display.alsoKnownAs.includes("Pete"));
  assert.ok(display.details.includes("1.2K followers"));
  assert.ok(display.details.includes("80 following"));
  assert.ok(display.details.includes("3.4K likes"));
  assert.ok(display.details.includes("42 posts"));
  assert.ok(display.details.includes("3 lists"));
  assert.ok(display.details.includes("BUSINESS"));
  assert.ok(display.details.includes("New York, NY"));
  assert.ok(display.details.includes("Hometown Philadelphia, PA"));
  assert.ok(display.details.includes("en_US"));
  assert.ok(display.details.includes("male"));
  assert.ok(display.details.includes("ages 21-21"));
  assert.ok(display.details.some((item) => item.startsWith("Joined ")));
  assert.equal(display.bio, "Seller bio from Facebook");
  assert.equal(display.websiteUrl, "https://www.example.com");
  assert.equal(display.providerVerified, true);
  assert.deepEqual(
    display.rows.map((row) => row.label),
    [
      "Name",
      "Username",
      "First name",
      "Last name",
      "Short name",
      "followers",
      "Following",
      "Likes",
      "Posts",
      "Lists",
      "Account type",
      "Current city",
      "Hometown",
      "Locale",
      "Gender",
      "Age range",
      "Joined",
      "About",
      "Website",
      "Profile",
    ],
  );
});

test("Facebook public profile labels name, current city, and hometown", () => {
  const display = officialConnectorDisplay({
    name: "Example Seller",
    firstName: "Example",
    lastName: "Seller",
    location: "Example City, ST",
    hometown: "Example Town, ST",
  });

  assert.deepEqual(display.rows, [
    { label: "Name", value: "Example Seller" },
    { label: "First name", value: "Example" },
    { label: "Last name", value: "Seller" },
    { label: "Current city", value: "Example City, ST" },
    { label: "Hometown", value: "Example Town, ST" },
  ]);
  assert.equal(display.bio, "");
  assert.equal(display.websiteUrl, "");
});

test("connected Facebook listing proof keeps official values and not friends", () => {
  const proof = connectedFacebookSocialProof(
    "Keep This Name",
    "https://www.facebook.com/openmarketplace.seller",
    {
      displayName: "Peter Franco",
      firstName: "Peter",
      lastName: "Franco",
      bio: "Seller bio from Facebook",
      location: "New York, NY",
      hometown: "Philadelphia, PA",
      websiteUrl: "https://www.example.com",
      locale: "en_US",
      gender: "male",
      ageRange: "21-21",
    },
  );

  assert.equal(proof.displayName, "Peter Franco");
  assert.equal(proof.firstName, "Peter");
  assert.equal(proof.lastName, "Franco");
  assert.equal(proof.handle, "openmarketplace.seller");
  assert.equal(proof.location, "New York, NY");
  assert.equal(proof.hometown, "Philadelphia, PA");
  assert.equal(proof.bio, "Seller bio from Facebook");
  assert.equal(proof.websiteUrl, "https://www.example.com");
  assert.equal(proof.locale, "en_US");
  assert.equal(proof.gender, "male");
  assert.equal(proof.ageRange, "21-21");
  assert.equal(proof.connectionCount, undefined);
  assert.equal(proof.accountCreatedAt, undefined);
  assert.equal(proof.hasLocation, true);
  assert.equal(proof.hasBio, true);
});

test("seller Facebook connection and buyer listing proof expose the same official rows", () => {
  const facebook = {
    available: true,
    connected: true,
    name: "Example Seller",
    firstName: "Example",
    lastName: "Seller",
    middleName: null,
    shortName: null,
    imageUrl: "https://graph.facebook.com/example/picture",
    profileUrl: "https://www.facebook.com/example.seller",
    about: null,
    location: "Example City, ST",
    hometown: "Example Town, ST",
    websiteUrl: null,
    locale: null,
    gender: null,
    ageRange: null,
    coverUrl: null,
  };
  const proof = connectedFacebookSocialProof("Keep This Name", facebook.profileUrl, {
    displayName: facebook.name,
    firstName: facebook.firstName,
    lastName: facebook.lastName,
    imageUrl: facebook.imageUrl,
    location: facebook.location,
    hometown: facebook.hometown,
  });

  assert.deepEqual(
    officialConnectorDisplay(factsFromFacebookConnection(facebook)).rows,
    officialConnectorDisplay(factsFromSocialProof(proof)).rows,
  );
});

test("public connector catalog shows every official network and hides nothing connected", () => {
  const catalog = publicConnectorCatalog([
    connectedFacebookSocialProof(
      "Keep This Name",
      "https://www.facebook.com/example.seller",
      {
        displayName: "Example Seller",
        firstName: "Example",
        lastName: "Seller",
        location: "Example City, ST",
        hometown: "Example Town, ST",
      },
    ),
  ]);

  assert.deepEqual(
    catalog.map((row) => row.id),
    ["facebook", "tiktok", "instagram", "twitter", "linkedin", "reddit", "discord"],
  );
  assert.equal(catalog[0].connected, true);
  assert.equal(catalog[0].label, "Facebook");
  assert.ok(catalog[0].official.rows.some((row) => row.label === "Current city"));
  assert.equal(catalog.filter((row) => !row.connected).length, 6);
});

test("connected social proof stores official values for listing display", () => {
  const proof = connectedSocialProof({
    provider: "tiktok",
    providerAccountId: "open-id",
    name: "Open Marketplace",
    handle: "openmarketplace",
    profileUrl: "https://www.tiktok.com/@openmarketplace",
    bio: "Official TikTok bio",
    location: "Philadelphia",
    imageUrl: "https://example.com/avatar.jpg",
    connectionCount: 12,
    followingCount: 4,
    likesCount: 90,
    contentCount: 7,
    providerVerified: true,
  });

  const display = officialConnectorDisplay(factsFromSocialProof(proof));
  assert.equal(display.headline, "Open Marketplace");
  assert.equal(display.handle, "openmarketplace");
  assert.ok(display.details.includes("12 followers"));
  assert.ok(display.details.includes("4 following"));
  assert.ok(display.details.includes("90 likes"));
  assert.ok(display.details.includes("7 posts"));
  assert.equal(display.bio, "Official TikTok bio");
  assert.equal(proof.location, "Philadelphia");
  assert.equal(proof.hasProviderBadge, true);
});
