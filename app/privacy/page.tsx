import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "../legal/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy — Open Marketplace",
  description:
    "How Open Marketplace handles accounts, listings, Facebook Login, and PayPal Login on this site.",
};

const sections = [
  { id: "identity-and-scope", label: "Who we are" },
  { id: "data-currently-handled", label: "Information we handle" },
  { id: "local-media-boundary", label: "Photographs" },
  { id: "facebook-connect-disclosure", label: "Facebook Login" },
  { id: "facebook-exclusions", label: "What Facebook does not give us" },
  { id: "social-connectors-disclosure", label: "Other social Connect" },
  { id: "paypal-connect-disclosure", label: "PayPal Login" },
  { id: "provider-credential-boundary", label: "How Facebook credentials are kept" },
  { id: "purposes", label: "Why we use this information" },
  { id: "sharing-and-sale", label: "Sharing" },
  { id: "retention", label: "How long we keep it" },
  { id: "facebook-data-deletion", label: "Deleting Facebook data" },
  { id: "children", label: "Children" },
  { id: "effective-date", label: "Effective date" },
] as const;

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      lead="This policy explains what Open Marketplace collects, what Facebook Login and PayPal Login can add, and how you can remove those links. Anyone can read it. You do not need an account."
    >
      <nav aria-label="On this page">
        <ul className="privacy-toc">
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.label}</a>
            </li>
          ))}
        </ul>
      </nav>

      <section id="identity-and-scope" aria-labelledby="identity-and-scope-title">
        <h2 id="identity-and-scope-title">Who we are</h2>
        <p>
          Open Marketplace is an independent marketplace. People browse listings
          without signing in. People who want to publish or manage a listing
          create an account with an email address and password.
        </p>
        <p>
          Facebook and Meta are external account providers, not the operator of
          this marketplace. A Facebook link never moves a listing onto Facebook,
          and it never makes Facebook responsible for a sale.
        </p>
      </section>

      <section
        id="data-currently-handled"
        aria-labelledby="data-currently-handled-title"
      >
        <h2 id="data-currently-handled-title">Information we handle</h2>
        <p>When you use an account, we handle:</p>
        <ul>
          <li>The name and email address you give us.</li>
          <li>
            Sign-in, session, and security records needed to keep you signed in
            and to protect the account.
          </li>
          <li>
            Public profile, listing, and payment-destination details that you
            choose to publish.
          </li>
          <li>
            Marketplace catalog records for those listings and the account they
            belong to.
          </li>
        </ul>
      </section>

      <section
        id="local-media-boundary"
        aria-labelledby="local-media-boundary-title"
      >
        <h2 id="local-media-boundary-title">Photographs</h2>
        <p>
          Listing image bytes remain on the seller&apos;s device or on a host
          the seller chooses. The public catalog keeps listing metadata and
          content hashes, not the photographs themselves.
        </p>
      </section>

      <section
        id="facebook-connect-disclosure"
        aria-labelledby="facebook-connect-disclosure-title"
      >
        <h2 id="facebook-connect-disclosure-title">Facebook Login</h2>
        <p>
          Signed-in people can choose Connect. That uses consumer Facebook
          Login and asks for <code>public_profile</code> and{" "}
          <code>user_link</code>. We use the public name, profile photo, and
          profile link Facebook returns so Account settings can show that the
          account is Connected and so a listing connector can open that
          Facebook profile. Those Facebook details stay with the Facebook
          link. They do not replace your Open Marketplace name or email.
        </p>
        <p>
          Facebook Login is not a way to create or open an Open Marketplace
          account.
        </p>
      </section>

      <section
        id="facebook-exclusions"
        aria-labelledby="facebook-exclusions-title"
      >
        <h2 id="facebook-exclusions-title">What Facebook does not give us</h2>
        <p>Open Marketplace does not ask Facebook for:</p>
        <ul>
          <li>Facebook email permission.</li>
          <li>Facebook friends or followers.</li>
          <li>Facebook Pages.</li>
          <li>Facebook Marketplace data.</li>
          <li>Facebook listings or listing photos.</li>
          <li>Facebook Commerce data.</li>
          <li>
            Government-identity verification, or any “Facebook verified” label.
          </li>
        </ul>
      </section>

      <section
        id="social-connectors-disclosure"
        aria-labelledby="social-connectors-disclosure-title"
      >
        <h2 id="social-connectors-disclosure-title">Other social Connect</h2>
        <p>
          Signed-in people can also Connect Instagram, TikTok, X, LinkedIn,
          Reddit, and Discord when those official apps are configured on this
          copy of the site. Only public fields the provider returns after
          Connect are stored: a handle, a profile link, an account-created
          date, or a public connection count when the provider sends one.
          Typed usernames and pasted links are not accepted. Provider emails
          are not published on listings. These links are not a way to create
          or open an Open Marketplace account.
        </p>
      </section>

      <section
        id="paypal-connect-disclosure"
        aria-labelledby="paypal-connect-disclosure-title"
      >
        <h2 id="paypal-connect-disclosure-title">PayPal Login</h2>
        <p>
          Signed-in people can choose Link PayPal. That uses official Log in
          with PayPal and asks for <code>openid</code>, <code>email</code>, and{" "}
          <code>profile</code> only. We use the PayPal email so your public
          pay-to contact can be filled and so listings can show whether PayPal
          is currently linked. PayPal Login is not a way to create or open an
          Open Marketplace account, and this marketplace does not take, hold,
          or send PayPal payments.
        </p>
        <p>
          You can remove the PayPal link in Account settings. PayPal tokens
          stay on the server. They are not placed in public listing records.
        </p>
      </section>

      <section
        id="provider-credential-boundary"
        aria-labelledby="provider-credential-boundary-title"
      >
        <h2 id="provider-credential-boundary-title">
          How Facebook credentials are kept
        </h2>
        <p>
          Facebook access credentials and tokens remain server-side. They are
          not placed in public profile pages, public listing records, or
          public project files.
        </p>
      </section>

      <section id="purposes" aria-labelledby="purposes-title">
        <h2 id="purposes-title">Why we use this information</h2>
        <p>We use it to:</p>
        <ul>
          <li>Operate accounts and keep sessions working.</li>
          <li>Show the marketplace features you asked for.</li>
          <li>Protect the service against abuse.</li>
          <li>
            Link a Facebook account when a signed-in person chooses Connect.
          </li>
        </ul>
      </section>

      <section
        id="sharing-and-sale"
        aria-labelledby="sharing-and-sale-title"
      >
        <h2 id="sharing-and-sale-title">Sharing</h2>
        <p>
          Open Marketplace does not sell Facebook profile data. Hosting
          companies that run the site may process the records needed to keep
          the service online. We may also disclose information when the law
          requires it.
        </p>
      </section>

      <section id="retention" aria-labelledby="retention-title">
        <h2 id="retention-title">How long we keep it</h2>
        <p>
          Account and listing records stay while the account is open and the
          listing is on the catalog. Facebook Login tokens and the Connected
          profile are removed when you disconnect, or when Facebook asks us to
          delete that link. We do not keep a separate advertising profile.
        </p>
      </section>

      <section
        id="facebook-data-deletion"
        aria-labelledby="facebook-data-deletion-title"
      >
        <h2 id="facebook-data-deletion-title">Deleting Facebook data</h2>
        <p>
          Account Settings offers Disconnect now. Disconnect removes the
          active linked Facebook account credentials and tokens and the
          Facebook name and photo shown next to Connected, stops future
          Facebook access, and leaves the Open Marketplace account and
          session intact.
        </p>
        <p>
          Step-by-step instructions, including what to do from Facebook&apos;s
          own Apps and Websites page, are on{" "}
          <Link href="/privacy/facebook-data-deletion">
            Facebook data deletion
          </Link>
          .
        </p>
      </section>

      <section id="children" aria-labelledby="children-title">
        <h2 id="children-title">Children</h2>
        <p>
          Open Marketplace is not directed at children under 13. Facebook Login
          is only available to people Facebook already allows to use that
          product.
        </p>
      </section>

      <section id="effective-date" aria-labelledby="effective-date-title">
        <h2 id="effective-date-title">Effective date</h2>
        <p className="privacy-effective">16 August 2026</p>
      </section>
    </LegalShell>
  );
}
