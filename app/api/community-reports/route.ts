import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "../../../db";
import { communityReports } from "../../../db/schema";
import { isAdminEmail } from "../../../lib/admin-policy";
import {
  getMarketplaceAdminEmails,
  getMarketplaceSession,
} from "../../../lib/auth";
import {
  COMMUNITY_REPORT_LIMITS,
  classifyCommunityReport,
  communityReportPublicResponse,
  compileCommunityDigest,
  parseCommunityReportInput,
  type CommunityReportRecord,
} from "../../../lib/community-reports";

function registryError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected registry error";
  const unavailable =
    message.includes("no such table") || message.includes("binding `DB`");
  return Response.json(
    {
      error: unavailable ? "registry_unavailable" : "registry_error",
      message: unavailable
        ? "The metadata registry is not initialized yet."
        : "The metadata registry could not complete this request.",
    },
    { status: unavailable ? 503 : 500 },
  );
}

async function fingerprintFrom(request: Request) {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";
  const userAgent = request.headers.get("user-agent") || "";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${ip}\n${userAgent}`),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function asRecord(row: typeof communityReports.$inferSelect): CommunityReportRecord {
  return {
    id: row.id,
    kind: row.kind === "feature" ? "feature" : "bug",
    status:
      row.status === "filtered_security"
        ? "filtered_security"
        : row.status === "reviewed"
          ? "reviewed"
          : "queued",
    title: row.title,
    details: row.details,
    surfaceId: row.surfaceId,
    surfaceLabel: row.surfaceLabel,
    surfaceHref: row.surfaceHref,
    pagePath: row.pagePath,
    reporterUserId: row.reporterUserId,
    createdAt: row.createdAt,
  };
}

async function requireAdmin(request: Request) {
  const session = await getMarketplaceSession(request);
  const adminEmails = await getMarketplaceAdminEmails();
  if (!session || !isAdminEmail(session.user.email, adminEmails)) {
    return {
      session: null,
      response: Response.json(
        { error: "Administrator access required." },
        { status: 403 },
      ),
    };
  }
  return { session, response: null };
}

export async function POST(request: Request) {
  try {
    const parsed = parseCommunityReportInput(await request.json());
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const fingerprint = await fingerprintFrom(request);
    const session = await getMarketplaceSession(request);
    const db = await getDb();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recent = await db
      .select({ id: communityReports.id, createdAt: communityReports.createdAt })
      .from(communityReports)
      .where(
        and(
          eq(communityReports.reporterFingerprint, fingerprint),
          gte(communityReports.createdAt, since.slice(0, 19).replace("T", " ")),
        ),
      )
      .limit(COMMUNITY_REPORT_LIMITS.reportsPerFingerprintPerDay + 5);

    const recentCount = recent.filter((row) => {
      const created = Date.parse(row.createdAt.replace(" ", "T") + "Z");
      return Number.isFinite(created) && created >= Date.now() - 24 * 60 * 60 * 1000;
    }).length;
    if (recentCount >= COMMUNITY_REPORT_LIMITS.reportsPerFingerprintPerDay) {
      return Response.json(
        { error: "Please wait before sending more reports from this browser." },
        { status: 429 },
      );
    }

    const classification = classifyCommunityReport(parsed.value);
    const id = crypto.randomUUID();
    await db.insert(communityReports).values({
      id,
      kind: parsed.value.kind,
      status: classification.status,
      title: parsed.value.title,
      details: parsed.value.details,
      surfaceId: parsed.value.surfaceId,
      surfaceLabel: parsed.value.surfaceLabel,
      surfaceHref: parsed.value.surfaceHref,
      pagePath: parsed.value.pagePath,
      filterReason: classification.filterReason,
      reporterUserId: session?.user.id ?? null,
      reporterFingerprint: fingerprint,
    });

    return Response.json({
      id,
      ...communityReportPublicResponse(classification.status),
    });
  } catch (error) {
    return registryError(error);
  }
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.session) return admin.response;

    const url = new URL(request.url);
    const includeFiltered = url.searchParams.get("include") === "filtered";
    const digest = url.searchParams.get("view") === "digest";
    const db = await getDb();
    const rows = await db
      .select()
      .from(communityReports)
      .orderBy(desc(communityReports.createdAt))
      .limit(digest ? 500 : 100);
    const records = rows.map(asRecord);
    if (digest) {
      const dateValue = url.searchParams.get("date");
      const date = dateValue ? new Date(`${dateValue}T12:00:00.000Z`) : new Date();
      return Response.json(compileCommunityDigest(records, date));
    }
    return Response.json({
      reports: includeFiltered
        ? records
        : records.filter((report) => report.status !== "filtered_security"),
    });
  } catch (error) {
    return registryError(error);
  }
}
