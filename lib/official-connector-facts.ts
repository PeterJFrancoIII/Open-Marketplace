import {
  isSocialConnectorId,
  SOCIAL_CONNECTORS,
  type SocialConnectorId,
} from "./social-connectors.ts";
import type { FacebookConnection, SocialProof } from "./types";

function facebookVanityFromUrl(value?: string | null) {
  if (!value?.trim()) return "";
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (
      host !== "facebook.com" &&
      !host.endsWith(".facebook.com") &&
      host !== "fb.com" &&
      !host.endsWith(".fb.com")
    ) {
      return "";
    }
    const first = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (!first || first.toLowerCase() === "profile.php") return "";
    return first;
  } catch {
    return "";
  }
}

export type OfficialConnectorFacts = {
  name?: string | null;
  handle?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
  shortName?: string | null;
  imageUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  hometown?: string | null;
  websiteUrl?: string | null;
  locale?: string | null;
  gender?: string | null;
  ageRange?: string | null;
  accountType?: string | null;
  accountCreatedAt?: string | null;
  connectionCount?: number | null;
  followingCount?: number | null;
  likesCount?: number | null;
  contentCount?: number | null;
  listedCount?: number | null;
  connectionLabel?: string | null;
  providerVerified?: boolean;
  profileUrl?: string | null;
};

function trimText(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function compactOfficialCount(value?: number | null): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function officialMonthYear(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const date = new Date(/T/.test(value) ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export type OfficialConnectorDisplay = ReturnType<typeof officialConnectorDisplay>;

export function officialConnectorDisplay(facts: OfficialConnectorFacts) {
  const name = trimText(facts.name);
  const handle = trimText(facts.handle).replace(/^@/, "");
  const extraName = [facts.firstName, facts.middleName, facts.lastName]
    .map((part) => trimText(part))
    .filter(Boolean)
    .join(" ");
  const shortName = trimText(facts.shortName);
  const alsoKnownAs = [extraName, shortName].filter(
    (value) => value && value !== name,
  );
  const uniqueAlsoKnownAs = [...new Set(alsoKnownAs)];

  const details: string[] = [];
  const followers = compactOfficialCount(facts.connectionCount);
  if (followers) {
    details.push(`${followers} ${facts.connectionLabel ?? "followers"}`);
  }
  const following = compactOfficialCount(facts.followingCount);
  if (following) details.push(`${following} following`);
  const likes = compactOfficialCount(facts.likesCount);
  if (likes) details.push(`${likes} likes`);
  const posts = compactOfficialCount(facts.contentCount);
  if (posts) details.push(`${posts} posts`);
  const lists = compactOfficialCount(facts.listedCount);
  if (lists) details.push(`${lists} lists`);
  if (trimText(facts.accountType)) details.push(trimText(facts.accountType));
  if (trimText(facts.location)) details.push(trimText(facts.location));
  if (
    trimText(facts.hometown) &&
    trimText(facts.hometown) !== trimText(facts.location)
  ) {
    details.push(`Hometown ${trimText(facts.hometown)}`);
  }
  if (trimText(facts.locale)) details.push(trimText(facts.locale));
  if (trimText(facts.gender)) details.push(trimText(facts.gender));
  if (trimText(facts.ageRange)) details.push(`ages ${trimText(facts.ageRange)}`);
  const joined = officialMonthYear(facts.accountCreatedAt);
  if (joined) details.push(`Joined ${joined}`);

  return {
    headline: name || (handle ? `@${handle}` : ""),
    handle: handle && handle.toLowerCase() !== name.toLowerCase() ? handle : "",
    alsoKnownAs: uniqueAlsoKnownAs,
    details,
    rows: officialConnectorRows(facts),
    bio: trimText(facts.bio),
    websiteUrl: trimText(facts.websiteUrl),
    imageUrl: trimText(facts.imageUrl),
    bannerUrl: trimText(facts.bannerUrl),
    providerVerified: facts.providerVerified === true,
  };
}

export function officialConnectorSummary(official: OfficialConnectorDisplay): string {
  return [
    official.handle ? `@${official.handle}` : "",
    ...official.alsoKnownAs,
    ...official.details,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function officialConnectorLine(official: OfficialConnectorDisplay): string {
  return [officialConnectorSummary(official), official.bio, official.websiteUrl]
    .filter(Boolean)
    .join(" · ");
}

export function officialConnectorRows(facts: OfficialConnectorFacts) {
  const rows: { label: string; value: string }[] = [];
  const name = trimText(facts.name);
  const handle = trimText(facts.handle).replace(/^@/, "");
  const firstName = trimText(facts.firstName);
  const lastName = trimText(facts.lastName);
  const middleName = trimText(facts.middleName);
  const shortName = trimText(facts.shortName);
  if (name) rows.push({ label: "Name", value: name });
  if (handle && handle.toLowerCase() !== name.toLowerCase()) {
    rows.push({ label: "Username", value: `@${handle}` });
  }
  if (firstName && firstName !== name) rows.push({ label: "First name", value: firstName });
  if (middleName) rows.push({ label: "Middle name", value: middleName });
  if (lastName && lastName !== name) rows.push({ label: "Last name", value: lastName });
  if (shortName && shortName !== name) rows.push({ label: "Short name", value: shortName });
  const followers = compactOfficialCount(facts.connectionCount);
  if (followers) {
    rows.push({
      label: facts.connectionLabel ?? "followers",
      value: followers,
    });
  }
  const following = compactOfficialCount(facts.followingCount);
  if (following) rows.push({ label: "Following", value: following });
  const likes = compactOfficialCount(facts.likesCount);
  if (likes) rows.push({ label: "Likes", value: likes });
  const posts = compactOfficialCount(facts.contentCount);
  if (posts) rows.push({ label: "Posts", value: posts });
  const lists = compactOfficialCount(facts.listedCount);
  if (lists) rows.push({ label: "Lists", value: lists });
  if (trimText(facts.accountType)) {
    rows.push({ label: "Account type", value: trimText(facts.accountType) });
  }
  if (trimText(facts.location)) {
    rows.push({ label: "Current city", value: trimText(facts.location) });
  }
  if (trimText(facts.hometown)) {
    rows.push({ label: "Hometown", value: trimText(facts.hometown) });
  }
  if (trimText(facts.locale)) rows.push({ label: "Locale", value: trimText(facts.locale) });
  if (trimText(facts.gender)) rows.push({ label: "Gender", value: trimText(facts.gender) });
  if (trimText(facts.ageRange)) {
    rows.push({ label: "Age range", value: trimText(facts.ageRange) });
  }
  const joined = officialMonthYear(facts.accountCreatedAt);
  if (joined) rows.push({ label: "Joined", value: joined });
  if (trimText(facts.bio)) rows.push({ label: "About", value: trimText(facts.bio) });
  if (trimText(facts.websiteUrl)) {
    rows.push({ label: "Website", value: trimText(facts.websiteUrl) });
  }
  if (trimText(facts.profileUrl)) {
    rows.push({ label: "Profile", value: trimText(facts.profileUrl) });
  }
  return rows;
}

export function factsFromSocialProof(account: SocialProof): OfficialConnectorFacts {
  return {
    name: account.displayName,
    handle:
      account.provider === "facebook"
        ? account.handle || facebookVanityFromUrl(account.url)
        : account.handle,
    firstName: account.firstName,
    lastName: account.lastName,
    middleName: account.middleName,
    shortName: account.shortName,
    imageUrl: account.imageUrl,
    bannerUrl: account.bannerUrl,
    bio: account.bio,
    location: account.location,
    hometown: account.hometown,
    websiteUrl: account.websiteUrl,
    locale: account.locale,
    gender: account.gender,
    ageRange: account.ageRange,
    accountType: account.accountType,
    accountCreatedAt: account.accountCreatedAt,
    connectionCount: account.connectionCount,
    followingCount: account.followingCount,
    likesCount: account.likesCount,
    contentCount: account.contentCount,
    listedCount: account.listedCount,
    connectionLabel: account.connectionLabel,
    providerVerified: account.hasProviderBadge,
    profileUrl: account.url,
  };
}

export function factsFromFacebookConnection(
  facebook: FacebookConnection,
): OfficialConnectorFacts {
  return {
    name: facebook.name,
    handle: facebookVanityFromUrl(facebook.profileUrl),
    firstName: facebook.firstName,
    lastName: facebook.lastName,
    middleName: facebook.middleName,
    shortName: facebook.shortName,
    imageUrl: facebook.imageUrl,
    bannerUrl: facebook.coverUrl,
    bio: facebook.about,
    location: facebook.location,
    hometown: facebook.hometown,
    websiteUrl: facebook.websiteUrl,
    locale: facebook.locale,
    gender: facebook.gender,
    ageRange: facebook.ageRange,
    profileUrl: facebook.profileUrl,
  };
}

export type PublicConnectorEntry = {
  id: SocialConnectorId;
  label: string;
  connected: boolean;
  profileUrl: string;
  official: OfficialConnectorDisplay;
};

export function publicConnectorCatalog(
  accounts: SocialProof[],
): PublicConnectorEntry[] {
  const byProvider = new Map<SocialConnectorId, SocialProof>();
  for (const account of accounts) {
    if (account.metricsSource !== "oauth" || !isSocialConnectorId(account.provider)) {
      continue;
    }
    byProvider.set(account.provider, account);
  }
  return SOCIAL_CONNECTORS.map((connector) => {
    const account = byProvider.get(connector.id);
    const official = officialConnectorDisplay(
      account
        ? connector.id === "facebook"
          ? {
              ...factsFromSocialProof(account),
              connectionCount: null,
              accountCreatedAt: null,
            }
          : factsFromSocialProof(account)
        : {},
    );
    return {
      id: connector.id,
      label: connector.label,
      connected: Boolean(account),
      profileUrl: account?.url?.trim() || official.websiteUrl || "",
      official,
    };
  });
}
