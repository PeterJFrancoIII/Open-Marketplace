import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { listings } from "../../../db/schema";
import { loadPortalSession } from "../../portal/load-portal";
import PortalShell from "../../portal/portal-shell";

export const dynamic = "force-dynamic";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export default async function AccountListingsPage() {
  const { session, isAdmin, user } = await loadPortalSession("/account/listings");
  const recent = await (await getDb())
    .select()
    .from(listings)
    .where(eq(listings.sellerId, session.user.id))
    .orderBy(desc(listings.createdAt))
    .limit(200);

  return (
    <PortalShell user={user} activeSection="listings" isAdmin={isAdmin}>
      <section
        className="portal-panel"
        id="my-listings"
        aria-labelledby="my-listings-title"
      >
        <p className="portal-eyebrow">Your console</p>
        <h1 id="my-listings-title">My listings</h1>
        <p className="portal-lead">
          These are the listings on this signed-in account. Only this email can
          change them.
        </p>
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
                  <th scope="col">Actions</th>
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
                    <td>
                      <a
                        className="portal-edit-link"
                        href={`/?listing=${encodeURIComponent(listing.id)}&edit=1`}
                      >
                        Edit
                      </a>
                    </td>
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
