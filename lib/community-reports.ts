export const COMMUNITY_REPORT_KINDS = ["bug", "feature"] as const;
export type CommunityReportKind = (typeof COMMUNITY_REPORT_KINDS)[number];

export const COMMUNITY_REPORT_STATUSES = [
  "queued",
  "filtered_security",
  "reviewed",
] as const;
export type CommunityReportStatus = (typeof COMMUNITY_REPORT_STATUSES)[number];

export const COMMUNITY_REPORT_LIMITS = {
  titleMin: 8,
  titleMax: 120,
  detailsMin: 1,
  detailsMax: 2000,
  surfaceIdMax: 80,
  hrefMax: 500,
  pagePathMax: 200,
  reportsPerFingerprintPerDay: 20,
} as const;

export const SECURITY_FILTER_PUBLIC_MESSAGE =
  "Security and access-control work is reserved for administrators. This note was not added to the community queue.";

export type CommunityReportRecord = {
  id: string;
  kind: CommunityReportKind;
  status: CommunityReportStatus;
  title: string;
  details: string;
  surfaceId: string;
  surfaceLabel: string;
  surfaceHref: string;
  pagePath: string;
  reporterUserId: string | null;
  createdAt: string;
};

export type CommunityReportInput = {
  kind: string;
  title: string;
  details: string;
  surfaceId: string;
  surfaceLabel: string;
  surfaceHref: string;
  pagePath: string;
};

export type ParsedCommunityReport = {
  kind: CommunityReportKind;
  title: string;
  details: string;
  surfaceId: string;
  surfaceLabel: string;
  surfaceHref: string;
  pagePath: string;
};

export type CommunityReportClassification = {
  status: Extract<CommunityReportStatus, "queued" | "filtered_security">;
  filterReason: "security_control" | null;
};

export type CommunityDigestGroup = {
  surfaceId: string;
  surfaceHref: string;
  surfaceLabel: string;
  count: number;
  titles: string[];
};

export type CommunityDigest = {
  date: string;
  queuedBugCount: number;
  queuedFeatureCount: number;
  filteredSecurityCount: number;
  bugs: CommunityDigestGroup[];
  features: CommunityDigestGroup[];
  markdown: string;
};

const SECURITY_SURFACE_RE =
  /(^|\/|[-_.#?=&])(admin|auth|oauth|2fa|two-factor|password|session|secret|encrypt|cryptograph|waf|firewall|csp|csrf|ssrf|xss)([-_.#?=&/]|$)/i;

const SECURITY_CHANGE_RE =
  /\b(bypass|exploit|privilege\s+escalat|sql\s*inject|xss|csrf|ssrf|rce|zero[- ]day|malware|keylogger|backdoor|rootkit|hijack\s+session|steal\s+(token|cookie|password|secret)|disable\s+(auth|2fa|https|csp|waf)|remove\s+(password|2fa|authentication)|become\s+admin|make\s+me\s+admin|change\s+who\s+is\s+admin|invent\s+(crypto|encryption)|roll\s+your\s+own\s+(crypto|auth)|let\s+users?\s+(control|own|manage)\s+security|community[- ]owned\s+security|open\s+admin\s+to|unrestricted\s+admin)\b/i;

const SECURITY_FEATURE_RE =
  /\b(add|change|redesign|replace|remove|weaken|relax|skip|turn\s+off)\b[\s\S]{0,40}\b(2fa|two-factor|authentication|authorization|encryption|access\s+control|admin\s+allowlist|password\s+policy|session\s+cookie|security)\b/i;

export function isCommunityReportKind(
  value: string,
): value is CommunityReportKind {
  return (COMMUNITY_REPORT_KINDS as readonly string[]).includes(value);
}

export function slugSurfaceId(parts: string[]): string {
  const raw = parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return raw.slice(0, COMMUNITY_REPORT_LIMITS.surfaceIdMax) || "surface";
}

export function buildSurfaceHref(pagePath: string, surfaceId: string): string {
  const rawPath = pagePath.trim() || "/";
  const withoutHash = rawPath.split("#")[0] || "/";
  const prefixed = withoutHash.startsWith("/") ? withoutHash : `/${withoutHash}`;
  const [pathname, query = ""] = prefixed.split("?");
  const params = new URLSearchParams(query);
  params.set("surface", surfaceId);
  return `${pathname}?${params.toString()}#surface-${encodeURIComponent(surfaceId)}`;
}

export function sanitizeSurfaceHref(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  if (trimmed.includes("\\")) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return null;
  if (trimmed.length > COMMUNITY_REPORT_LIMITS.hrefMax) return null;
  return trimmed;
}

export function sanitizePagePath(value: string): string | null {
  const href = sanitizeSurfaceHref(value.split("#")[0] || "");
  if (!href) return null;
  const path = href.split("?")[0] || "/";
  if (path.length > COMMUNITY_REPORT_LIMITS.pagePathMax) return null;
  return path;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function parseCommunityReportInput(
  body: unknown,
): { ok: true; value: ParsedCommunityReport } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Report details are required." };
  }
  const record = body as Record<string, unknown>;
  const kind = typeof record.kind === "string" ? record.kind.trim() : "";
  if (!isCommunityReportKind(kind)) {
    return { ok: false, error: "Choose Bug or Feature Request." };
  }
  const title = collapseWhitespace(typeof record.title === "string" ? record.title : "");
  const details = collapseWhitespace(
    typeof record.details === "string" ? record.details : "",
  );
  if (
    title.length < COMMUNITY_REPORT_LIMITS.titleMin ||
    title.length > COMMUNITY_REPORT_LIMITS.titleMax
  ) {
    return {
      ok: false,
      error: `Summaries must be ${COMMUNITY_REPORT_LIMITS.titleMin}–${COMMUNITY_REPORT_LIMITS.titleMax} characters.`,
    };
  }
  if (
    details.length < COMMUNITY_REPORT_LIMITS.detailsMin ||
    details.length > COMMUNITY_REPORT_LIMITS.detailsMax
  ) {
    return {
      ok: false,
      error: `Details must be ${COMMUNITY_REPORT_LIMITS.detailsMin}–${COMMUNITY_REPORT_LIMITS.detailsMax} characters.`,
    };
  }
  const surfaceId = slugSurfaceId([
    typeof record.surfaceId === "string" ? record.surfaceId : "",
  ]);
  const surfaceLabel = collapseWhitespace(
    typeof record.surfaceLabel === "string" ? record.surfaceLabel : surfaceId,
  ).slice(0, 120);
  const pagePath = sanitizePagePath(
    typeof record.pagePath === "string" ? record.pagePath : "/",
  );
  const surfaceHref = sanitizeSurfaceHref(
    typeof record.surfaceHref === "string"
      ? record.surfaceHref
      : pagePath
        ? buildSurfaceHref(pagePath, surfaceId)
        : "",
  );
  if (!pagePath || !surfaceHref) {
    return { ok: false, error: "The selected surface link is not valid." };
  }
  return {
    ok: true,
    value: {
      kind,
      title,
      details,
      surfaceId,
      surfaceLabel: surfaceLabel || surfaceId,
      surfaceHref,
      pagePath,
    },
  };
}

export function isSecurityControlSurface(
  pagePath: string,
  surfaceId: string,
  surfaceHref: string,
): boolean {
  const haystack = `${pagePath} ${surfaceId} ${surfaceHref}`;
  if (pagePath === "/admin" || pagePath.startsWith("/admin/")) return true;
  if (pagePath.startsWith("/api/auth")) return true;
  return SECURITY_SURFACE_RE.test(haystack);
}

export function classifyCommunityReport(input: {
  kind: CommunityReportKind;
  title: string;
  details: string;
  surfaceId: string;
  surfaceHref: string;
  pagePath: string;
}): CommunityReportClassification {
  const text = `${input.title}\n${input.details}`;
  const securitySurface = isSecurityControlSurface(
    input.pagePath,
    input.surfaceId,
    input.surfaceHref,
  );
  if (SECURITY_CHANGE_RE.test(text)) {
    return { status: "filtered_security", filterReason: "security_control" };
  }
  if (input.kind === "feature" && SECURITY_FEATURE_RE.test(text)) {
    return { status: "filtered_security", filterReason: "security_control" };
  }
  if (input.kind === "feature" && securitySurface) {
    return { status: "filtered_security", filterReason: "security_control" };
  }
  return { status: "queued", filterReason: null };
}

function utcDateStamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toISOString().slice(0, 10);
}

function groupReports(reports: CommunityReportRecord[]): CommunityDigestGroup[] {
  const groups = new Map<string, CommunityDigestGroup>();
  for (const report of reports) {
    const existing = groups.get(report.surfaceId);
    if (existing) {
      existing.count += 1;
      if (existing.titles.length < 5) existing.titles.push(report.title);
      continue;
    }
    groups.set(report.surfaceId, {
      surfaceId: report.surfaceId,
      surfaceHref: report.surfaceHref,
      surfaceLabel: report.surfaceLabel,
      count: 1,
      titles: [report.title],
    });
  }
  return [...groups.values()].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.surfaceId.localeCompare(right.surfaceId);
  });
}

function renderGroupMarkdown(heading: string, groups: CommunityDigestGroup[]): string {
  if (groups.length === 0) return `## ${heading}\n\nNone.\n`;
  const lines = [`## ${heading}`, ""];
  for (const group of groups) {
    lines.push(`### ${group.surfaceLabel} (\`${group.surfaceId}\`)`);
    lines.push(`- Surface: ${group.surfaceHref}`);
    lines.push(`- Reports: ${group.count}`);
    for (const title of group.titles) {
      lines.push(`- ${title}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export function compileCommunityDigest(
  reports: CommunityReportRecord[],
  date = new Date(),
): CommunityDigest {
  const day = utcDateStamp(date);
  const sameDay = reports.filter((report) => utcDateStamp(report.createdAt) === day);
  const queuedBugs = sameDay.filter(
    (report) => report.kind === "bug" && report.status === "queued",
  );
  const queuedFeatures = sameDay.filter(
    (report) => report.kind === "feature" && report.status === "queued",
  );
  const filtered = sameDay.filter((report) => report.status === "filtered_security");
  const bugs = groupReports(queuedBugs);
  const features = groupReports(queuedFeatures);
  const markdown = [
    `# Community surface reports — ${day}`,
    "",
    "Crowdsourced development digest for human review. Security-control reports are excluded.",
    "",
    `- Queued bugs: ${queuedBugs.length}`,
    `- Queued feature requests: ${queuedFeatures.length}`,
    `- Filtered security-control reports (admin only): ${filtered.length}`,
    "",
    renderGroupMarkdown("Bugs", bugs),
    renderGroupMarkdown("Feature requests", features),
  ].join("\n");
  return {
    date: day,
    queuedBugCount: queuedBugs.length,
    queuedFeatureCount: queuedFeatures.length,
    filteredSecurityCount: filtered.length,
    bugs,
    features,
    markdown,
  };
}

export function communityReportPublicResponse(status: CommunityReportStatus) {
  if (status === "filtered_security") {
    return {
      accepted: true,
      queued: false,
      status,
      message: SECURITY_FILTER_PUBLIC_MESSAGE,
    };
  }
  return {
    accepted: true,
    queued: true,
    status,
    message: "Saved. Thank you for testing this surface.",
  };
}
