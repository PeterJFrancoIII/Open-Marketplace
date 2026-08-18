import { desc } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "../../../db";
import { communityReports } from "../../../db/schema";
import {
  compileCommunityDigest,
  type CommunityReportRecord,
} from "../../../lib/community-reports";
import { loadPortalSession } from "../../portal/load-portal";
import PortalShell from "../../portal/portal-shell";

export const dynamic = "force-dynamic";

function asRecord(
  row: typeof communityReports.$inferSelect,
): CommunityReportRecord {
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

export default async function AdminCommunityPage() {
  const { isAdmin, user } = await loadPortalSession("/admin/community");
  if (!isAdmin) {
    notFound();
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(communityReports)
    .orderBy(desc(communityReports.createdAt))
    .limit(200);
  const records = rows.map(asRecord);
  const digest = compileCommunityDigest(records);
  const queued = records.filter((report) => report.status === "queued");
  const filtered = records.filter(
    (report) => report.status === "filtered_security",
  );

  return (
    <PortalShell user={user} activeSection="community" isAdmin={true}>
      <section className="portal-panel" aria-labelledby="community-reports-title">
        <p className="portal-eyebrow">Administrator</p>
        <h1 id="community-reports-title">Community reports</h1>
        <p className="portal-lead">
          Crowdsourced bugs and feature requests from every surface. Agents
          compile the queued set at the end of each day. Security-control
          requests stay out of that queue.
        </p>
        <div className="portal-stat-row" aria-label="Community report totals">
          <div className="portal-stat">
            <strong>{digest.queuedBugCount}</strong>
            <span>Queued bugs today</span>
          </div>
          <div className="portal-stat">
            <strong>{digest.queuedFeatureCount}</strong>
            <span>Queued features today</span>
          </div>
          <div className="portal-stat">
            <strong>{digest.filteredSecurityCount}</strong>
            <span>Filtered security reports today</span>
          </div>
        </div>
      </section>

      <section className="portal-panel" aria-labelledby="daily-digest-title">
        <h2 id="daily-digest-title">Today’s digest</h2>
        <pre className="community-digest">{digest.markdown}</pre>
      </section>

      <section className="portal-panel" aria-labelledby="queued-reports-title">
        <h2 id="queued-reports-title">Queued community reports</h2>
        {queued.length === 0 ? (
          <p className="portal-empty">No queued community reports yet.</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Surface</th>
                  <th scope="col">Summary</th>
                  <th scope="col">Link</th>
                </tr>
              </thead>
              <tbody>
                {queued.map((report) => (
                  <tr key={report.id}>
                    <td>{report.kind === "bug" ? "Bug" : "Feature"}</td>
                    <td>{report.surfaceLabel}</td>
                    <td>{report.title}</td>
                    <td>
                      <Link href={report.surfaceHref}>{report.surfaceHref}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="portal-panel" aria-labelledby="filtered-reports-title">
        <h2 id="filtered-reports-title">Admin-only security filter</h2>
        <p className="portal-lead">
          These reports asked to change cybersecurity or access control. They
          are stored for administrators and never compiled into the community
          digest.
        </p>
        {filtered.length === 0 ? (
          <p className="portal-empty">No filtered security reports today.</p>
        ) : (
          <p className="portal-empty">
            {filtered.length} security-control report
            {filtered.length === 1 ? "" : "s"} held for administrators.
          </p>
        )}
      </section>
    </PortalShell>
  );
}
