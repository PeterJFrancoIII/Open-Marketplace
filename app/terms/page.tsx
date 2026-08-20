import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "../legal/legal-shell";

export const metadata: Metadata = {
  title: "Terms of Service — Open Marketplace",
  description:
    "The rules for using Open Marketplace, including accounts, listings, payments, and optional social connections.",
};

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of Service"
      lead="These terms cover browsing the catalog and using an account on this site."
    >
      <section aria-labelledby="service-title">
        <h2 id="service-title">The service</h2>
        <p>
          Open Marketplace is an independent classifieds website. Anyone may
          browse listings. Publishing or editing a listing requires an account
          you create with email and password. We do not hold goods, take
          payment, escrow funds, or stand in the middle of a sale.
        </p>
      </section>

      <section aria-labelledby="accounts-title">
        <h2 id="accounts-title">Accounts</h2>
        <p>
          You are responsible for the email and password you use here. Keep
          those credentials confidential. Optional Facebook Login and TikTok
          Login Kit, when offered, only confirm that a signed-in person
          controls that provider account. Facebook Login, when offered, does
          not sign you into Open Marketplace and it does not create an
          account. TikTok Login Kit also does not sign you into Open
          Marketplace and it does not create an account.
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

      <section aria-labelledby="responsibility-title">
        <h2 id="responsibility-title">Your responsibility for listings and transactions</h2>
        <p>
          You are responsible for the accuracy of your listings, the goods you
          offer, and any deal you make with another person. Confirm the other
          person yourself before you pay, ship, or meet. Open Marketplace does
          not inspect items, guarantee a sale, or resolve payment disputes
          between buyers and sellers.
        </p>
      </section>

      <section aria-labelledby="prohibited-title">
        <h2 id="prohibited-title">Prohibited behavior</h2>
        <p>Do not use the site to:</p>
        <ul>
          <li>Post listings the site policy rejects.</li>
          <li>Impersonate another person or spoof a social profile.</li>
          <li>Attempt to bypass authentication, rate limits, or access controls.</li>
          <li>Scrape, flood, or otherwise abuse the service.</li>
          <li>Collect or publish another person&apos;s private information without a lawful reason.</li>
        </ul>
      </section>

      <section aria-labelledby="payments-title">
        <h2 id="payments-title">Third-party providers and payment destinations</h2>
        <p>
          Public pay-to links and shipping estimates are conveniences. The
          marketplace does not send money, hold money, or book a shipment.
          PayPal Login, when offered, only links a PayPal identity to an
          existing Open Marketplace account. Venmo, Cash App, Zelle, Apple
          Cash, and crypto destinations are public contact details you choose
          to publish. Those providers are not the operator of this site.
        </p>
      </section>

      <section aria-labelledby="social-title">
        <h2 id="social-title">Social-account connections</h2>
        <p>
          Signed-in people may optionally Connect a social account they already
          control. A Connected account is proof of that provider login, not a
          verified seller badge and not a listing on that provider. Facebook
          Connect, when offered, uses consumer Facebook Login. See the{" "}
          <Link href="/privacy">Privacy Policy</Link> and{" "}
          <Link href="/privacy/facebook-data-deletion">
            Facebook data deletion
          </Link>{" "}
          instructions for what that link includes and how to remove it.
        </p>
        <p>
          TikTok Connect, when offered, uses TikTok Login Kit with{" "}
          <code>user.info.basic</code>, <code>user.info.profile</code>, and{" "}
          <code>user.info.stats</code>. It links an existing Open Marketplace
          account to a TikTok app-scoped <code>open_id</code> and may show the
          public name, username, profile link, bio, follower count, and other
          public stats TikTok returns. Official social fields are the first
          line of defense before verified buys and sells exist. It does not
          create or open an Open Marketplace account,
          post to TikTok, or read videos or messages. You can disconnect
          TikTok in Account Settings. See the{" "}
          <Link href="/privacy">Privacy Policy</Link> for what that link
          includes and how to remove it.
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

      <section aria-labelledby="ip-title">
        <h2 id="ip-title">Intellectual property</h2>
        <p>
          You keep the rights you already have in photographs and listing text
          you publish. You grant Open Marketplace a limited license to display
          that listing metadata on the catalog while the listing is live. Do
          not post material you do not have the right to publish. Open
          Marketplace, the site name, and the site marks belong to the
          operator.
        </p>
      </section>

      <section aria-labelledby="availability-title">
        <h2 id="availability-title">Service availability</h2>
        <p>
          The site may be interrupted for maintenance, hosting issues, or
          abuse-prevention. We do not promise uninterrupted availability or
          that every listing will remain visible.
        </p>
      </section>

      <section aria-labelledby="disclaimers-title">
        <h2 id="disclaimers-title">Disclaimers</h2>
        <p>
          The service is provided as is. Open Marketplace is independent of
          Meta, Facebook, Instagram, TikTok, PayPal, and other third-party
          providers named on the site. Those providers are not responsible for
          sales made here, and this site is not responsible for those
          providers&apos; products.
        </p>
      </section>

      <section aria-labelledby="limitation-title">
        <h2 id="limitation-title">Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, the operator is not liable
          for lost profits, lost goods, payment losses, or indirect damages
          arising from a listing, a conversation, or a deal between users. If
          liability cannot be excluded, it is limited to the amount you paid
          the operator for the service in the three months before the claim,
          which is typically zero because browsing and listing here do not
          charge a marketplace fee.
        </p>
      </section>

      <section aria-labelledby="termination-title">
        <h2 id="termination-title">Account suspension and termination</h2>
        <p>
          We may suspend or close an account that violates these terms, the
          site policy, or applicable law. You may stop using the site at any
          time. Disconnecting a social or payment provider does not close your
          Open Marketplace account.
        </p>
      </section>

      <section aria-labelledby="changes-title">
        <h2 id="changes-title">Changes</h2>
        <p>
          If these terms change, the new text will appear on this page with an
          updated date.
        </p>
      </section>

      <section aria-labelledby="contact-title">
        <h2 id="contact-title">Operator and legal contact</h2>
        <p>
          Open Marketplace is operated by Peter J. Franco III. It is
          independent of Meta, Facebook, Instagram, and TikTok. Use the
          on-site report control or Account Settings contact paths for
          service issues. These terms are for use of this website and do not
          create a partnership, employment, or escrow relationship.
        </p>
        <p className="privacy-effective">19 August 2026</p>
      </section>
    </LegalShell>
  );
}
