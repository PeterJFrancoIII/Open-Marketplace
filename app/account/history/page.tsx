import { headers } from "next/headers";
import { getDb } from "../../../db";
import { listSaleHistory } from "../../../lib/conversations";
import {
  getMarketplaceAdminEmails,
  requireMarketplaceSession,
} from "../../../lib/auth";
import { isAdminEmail } from "../../../lib/admin-policy";
import PortalShell from "../../portal/portal-shell";

export const dynamic = "force-dynamic";

function formatPrice(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export default async function HistoryPage() {
  const requestHeaders = await headers();
  const session = await requireMarketplaceSession(requestHeaders, "/account/history");
  const adminEmails = await getMarketplaceAdminEmails();
  const isAdmin = isAdminEmail(session.user.email, adminEmails);
  const history = await listSaleHistory(await getDb(), session.user.id);

  return (
    <PortalShell
      user={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
      activeSection="history"
      isAdmin={isAdmin}
    >
      <section className="portal-panel" aria-labelledby="history-title">
        <p className="portal-eyebrow">Completed sales</p>
        <h1 id="history-title">History</h1>
        <p className="portal-lead">
          Compact sold and purchased records for this signed-in account. Full
          descriptions and messages stay in Messages.
        </p>
        {history.length === 0 ? (
          <p className="portal-empty">
            No completed sales yet. A listing moves here after both people confirm.
          </p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Role</th>
                  <th scope="col">Other party</th>
                  <th scope="col">Price</th>
                  <th scope="col">Sold</th>
                  <th scope="col">Your rating</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <a
                        className="portal-listing-link"
                        href={`/account/messages?id=${encodeURIComponent(row.conversationId)}`}
                      >
                        {row.title}
                      </a>
                    </td>
                    <td>{row.myRole === "buyer" ? "Purchased" : "Sold"}</td>
                    <td>{row.otherPartyName}</td>
                    <td>{formatPrice(row.priceCents, row.currency)}</td>
                    <td>{row.soldAt}</td>
                    <td>
                      {row.myRating
                        ? `${row.myRating.score}/5 · ${row.myRating.note}`
                        : "Not rated yet"}
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
