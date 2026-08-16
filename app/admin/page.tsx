import { count, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "../../db";
import { authUsers, listings, reports } from "../../db/schema";
import { loadPortalSession } from "../portal/load-portal";
import PortalShell from "../portal/portal-shell";

export const dynamic = "force-dynamic";

function formatCreatedAt(value: Date | string | number | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

export default async function AdminPage() {
  const { isAdmin, user } = await loadPortalSession("/admin");
  if (!isAdmin) {
    notFound();
  }

  const db = await getDb();
  const [[accountCount], [activeListingCount], [openReportCount], recentAccounts] =
    await Promise.all([
      db.select({ value: count() }).from(authUsers),
      db
        .select({ value: count() })
        .from(listings)
        .where(eq(listings.status, "active")),
      db
        .select({ value: count() })
        .from(reports)
        .where(eq(reports.status, "open")),
      db
        .select({
          id: authUsers.id,
          name: authUsers.name,
          email: authUsers.email,
          createdAt: authUsers.createdAt,
        })
        .from(authUsers)
        .orderBy(desc(authUsers.createdAt))
        .limit(20),
    ]);

  return (
    <PortalShell user={user} activeSection="admin" isAdmin={true}>
      <section className="portal-panel" aria-labelledby="admin-overview-title">
        <p className="portal-eyebrow">Administrator</p>
        <h1 id="admin-overview-title">Admin overview</h1>
        <p className="portal-lead">
          Read-only system totals from D1. Destructive moderation actions are
          intentionally unavailable in this console.
        </p>

        <div className="portal-stat-row" aria-label="System totals">
          <div className="portal-stat">
            <strong>{accountCount?.value ?? 0}</strong>
            <span>Registered accounts</span>
          </div>
          <div className="portal-stat">
            <strong>{activeListingCount?.value ?? 0}</strong>
            <span>Active listings</span>
          </div>
          <div className="portal-stat">
            <strong>{openReportCount?.value ?? 0}</strong>
            <span>Open reports</span>
          </div>
        </div>
      </section>

      <section
        className="portal-panel"
        aria-labelledby="recent-accounts-title"
      >
        <h2 id="recent-accounts-title">Recent accounts</h2>
        {recentAccounts.length === 0 ? (
          <p className="portal-empty">No accounts registered yet.</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentAccounts.map((account) => (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td>{account.email}</td>
                    <td>{formatCreatedAt(account.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PortalShell>
  );
}
