import { count, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../db";
import { listings, profiles } from "../../db/schema";
import { parsePaymentDestinationsJson } from "../../lib/payment-destinations";
import { parseSocialAccountsJson } from "../../lib/profile-settings";
import {
  fillEmptyProfileFromFacebook,
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
      .limit(8),
    db
      .select()
      .from(profiles)
      .where(eq(profiles.id, session.user.id))
      .limit(1),
  ]);
  const profile = profileRows[0];
  const facebookConnection = await getFacebookConnection(requestHeaders);
  const identity = await fillEmptyProfileFromFacebook(
    session.user.id,
    session.user,
    facebookConnection,
  );

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
        name: identity.name ?? session.user.name,
        email: session.user.email,
        image: identity.image,
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
                    <td>{listing.title}</td>
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

      <section className="portal-panel" aria-labelledby="account-profile-title">
        <h2 id="account-profile-title">Profile</h2>
        <dl className="portal-definition-list">
          {identity.image ? (
            <div>
              <dt>Photo</dt>
              <dd>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={identity.image}
                  alt=""
                  width={48}
                  height={48}
                />
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Name</dt>
            <dd>{identity.name ?? session.user.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{session.user.email}</dd>
          </div>
        </dl>
      </section>

      <AccountSettings
        initialName={identity.name ?? session.user.name}
        email={session.user.email}
        initialSocialAccounts={parseSocialAccountsJson(profile?.socialAccountsJson)}
        initialPaymentDestinations={parsePaymentDestinationsJson(
          profile?.paymentDestinationsJson,
        )}
        initialFacebookConnection={facebookConnection}
      />
    </PortalShell>
  );
}
