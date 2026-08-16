import { count, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { listings, profiles } from "../../db/schema";
import { loadPortalSession } from "../portal/load-portal";
import PortalShell from "../portal/portal-shell";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { session, isAdmin, user } = await loadPortalSession("/account");

  const db = await getDb();
  const [statusCounts, profileRows] = await Promise.all([
    db
      .select({ status: listings.status, value: count() })
      .from(listings)
      .where(eq(listings.sellerId, session.user.id))
      .groupBy(listings.status),
    db
      .select()
      .from(profiles)
      .where(eq(profiles.id, session.user.id))
      .limit(1),
  ]);
  const profile = profileRows[0];

  const counts = {
    active: 0,
    draft: 0,
    sold: 0,
  };
  for (const row of statusCounts) {
    if (row.status === "active" || row.status === "draft" || row.status === "sold") {
      counts[row.status] = Number(row.value);
    }
  }

  return (
    <PortalShell user={user} activeSection="overview" isAdmin={isAdmin}>
      <section className="portal-panel" aria-labelledby="account-welcome">
        <p className="portal-eyebrow">Your console</p>
        <h1 id="account-welcome">Welcome, {session.user.name}</h1>
        <p className="portal-lead">
          Use the tabs on the left to open listings, messages, history, and
          account settings for this signed-in email.
        </p>

        <div className="portal-stat-row" aria-label="Listing counts">
          <div className="portal-stat">
            <strong>{counts.active}</strong>
            <span>Active</span>
          </div>
          <div className="portal-stat">
            <strong>{counts.draft}</strong>
            <span>Draft</span>
          </div>
          <div className="portal-stat">
            <strong>{counts.sold}</strong>
            <span>Sold</span>
          </div>
          <div
            className="portal-stat"
            title="Not a credit-bureau score. Not a verification badge."
          >
            <strong>{profile?.socialCreditScore ?? 0}</strong>
            <span>Social Credit</span>
          </div>
        </div>
        <p className="portal-settings-note">
          Social Credit is a marketplace number from ratings and completed
          sales. It is not a credit-bureau score and not a verification badge.
        </p>
      </section>
    </PortalShell>
  );
}
