import { count, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../db";
import { listings, profiles } from "../../db/schema";
import { parsePaymentDestinationsJson } from "../../lib/payment-destinations";
import { parseSocialAccountsJson } from "../../lib/profile-settings";
import { parseShippingBrokersJson } from "../../lib/shipping-brokers";
import {
  getFacebookConnection,
  getMarketplaceAdminEmails,
  requireMarketplaceSession,
} from "../../lib/auth";
import { isAdminEmail } from "../../lib/admin-policy";
import AccountSettings from "./account-settings";
import PortalShell from "../portal/portal-shell";

export const dynamic = "force-dynamic";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export default async function AccountPage() {
  const requestHeaders = await headers();
  const session = await requireMarketplaceSession(requestHeaders, "/account");
  const adminEmails = await getMarketplaceAdminEmails();
  const isAdmin = isAdminEmail(session.user.email, adminEmails);

  const db = await getDb();
  const [statusCounts, recent, profileRows] = await Promise.all([
    db
      .select({ status: listings.status, value: count() })
      .from(listings)
      .where(eq(listings.sellerId, session.user.id))
      .groupBy(listings.status),
    db
      .select()
      .from(listings)
      .where(eq(listings.sellerId, session.user.id))
      .orderBy(desc(listings.createdAt))
      .limit(200),
    db
      .select()
      .from(profiles)
      .where(eq(profiles.id, session.user.id))
      .limit(1),
  ]);
  const profile = profileRows[0];
  const facebookConnection = await getFacebookConnection(requestHeaders);

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
    <PortalShell
      user={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
      activeSection="overview"
      isAdmin={isAdmin}
    >
      <section className="portal-panel" aria-labelledby="account-welcome">
        <p className="portal-eyebrow">Your console</p>
        <h1 id="account-welcome">Welcome, {session.user.name}</h1>
        <p className="portal-lead">
          Manage the listings tied to this signed-in account. Ownership always
          comes from the server session.
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
        </div>
      </section>

      <section
        className="portal-panel"
        id="my-listings"
        aria-labelledby="my-listings-title"
      >
        <h2 id="my-listings-title">My listings</h2>
        {recent.length === 0 ? (
          <p className="portal-empty">
            No listings yet. Publish from the marketplace composer while signed
            in.
          </p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Status</th>
                  <th scope="col">Price</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((listing) => (
                  <tr key={listing.id}>
                    <td>
                      <a
                        className="portal-listing-link"
                        href={`/?listing=${encodeURIComponent(listing.id)}`}
                      >
                        {listing.title}
                      </a>
                    </td>
                    <td>{listing.status}</td>
                    <td>{formatPrice(listing.priceCents)}</td>
                    <td>{listing.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AccountSettings
        initialName={session.user.name}
        email={session.user.email}
        initialSocialAccounts={parseSocialAccountsJson(profile?.socialAccountsJson)}
        initialPaymentDestinations={parsePaymentDestinationsJson(
          profile?.paymentDestinationsJson,
        )}
        initialShippingBrokers={parseShippingBrokersJson(
          profile?.paymentDestinationsJson,
        )}
        initialFacebookConnection={facebookConnection}
      />
    </PortalShell>
  );
}
