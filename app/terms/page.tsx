import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "../legal/legal-shell";

export const metadata: Metadata = {
  title: "Terms of Use — Open Marketplace",
  description:
    "The rules for using Open Marketplace, including accounts, listings, and Facebook Login.",
};

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of Use"
      lead="These terms cover browsing the catalog and using an account on this site."
    >
      <section aria-labelledby="service-title">
        <h2 id="service-title">The service</h2>
        <p>
          Open Marketplace is an independent classifieds site. Anyone may
          browse. Publishing or editing a listing requires an account you
          create with email and password. We do not hold goods, take payment,
          or stand in the middle of a sale.
        </p>
      </section>

      <section aria-labelledby="accounts-title">
        <h2 id="accounts-title">Accounts</h2>
        <p>
          You are responsible for the email and password you use here. Facebook
          Login, when offered, only confirms that a signed-in person controls a
          Facebook account. It does not sign you into Open Marketplace and it
          does not create an account.
        </p>
      </section>

      <section aria-labelledby="listings-title">
        <h2 id="listings-title">Listings</h2>
        <p>
          Listings must describe goods you may lawfully sell. Do not list
          firearms, explosives, controlled substances, stolen or counterfeit
          goods, sexual services, or anything else the site policy already
          rejects. Photographs stay with you. The public catalog stores a
          record of the listing, not the image bytes.
        </p>
      </section>

      <section aria-labelledby="payments-title">
        <h2 id="payments-title">Payments and contact</h2>
        <p>
          Public pay-to links and shipping estimates are conveniences. The
          marketplace does not send money, hold money, or book a shipment.
          Confirm the other person yourself before you pay or ship.
        </p>
      </section>

      <section aria-labelledby="facebook-title">
        <h2 id="facebook-title">Facebook</h2>
        <p>
          A Connected Facebook account is proof of that Facebook login, not a
          verified seller badge and not a Facebook Marketplace listing. See the{" "}
          <Link href="/privacy">Privacy Policy</Link> and{" "}
          <Link href="/privacy/facebook-data-deletion">
            Facebook data deletion
          </Link>{" "}
          instructions for what that link includes and how to remove it.
        </p>
      </section>

      <section aria-labelledby="changes-title">
        <h2 id="changes-title">Changes</h2>
        <p>
          If these terms change, the new text will appear on this page with an
          updated date.
        </p>
        <p className="privacy-effective">16 August 2026</p>
      </section>
    </LegalShell>
  );
}
