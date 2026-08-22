import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "../legal/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy — Open Marketplace",
  description:
    "How Open Marketplace handles accounts, listings, optional Facebook Login, TikTok Login Kit, and PayPal Login.",
};

const sections = [
  { id: "identity-and-scope", label: "Who we are" },
  { id: "data-currently-handled", label: "Information we handle" },
  { id: "local-media-boundary", label: "Photographs" },
  { id: "facebook-connect-disclosure", label: "Facebook Login" },
  { id: "facebook-exclusions", label: "What Facebook does not give us" },
  { id: "tiktok-connect-disclosure", label: "TikTok Login Kit" },
  { id: "social-connectors-disclosure", label: "Other social Connect" },
  { id: "paypal-connect-disclosure", label: "PayPal Login" },
  { id: "provider-credential-boundary", label: "How provider credentials are kept" },
  { id: "purposes", label: "Why we use this information" },
  { id: "sharing-and-sale", label: "Sharing" },
  { id: "retention", label: "How long we keep it" },
  { id: "facebook-data-deletion", label: "Deleting Facebook data" },
  { id: "tiktok-data-deletion", label: "Deleting TikTok data" },
  { id: "children", label: "Children" },
  { id: "effective-date", label: "Effective date" },
] as const;

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      lead="This policy explains what Open Marketplace collects, what optional Facebook Login, TikTok Login Kit, and PayPal Login can add, and how you can remove those links. Anyone can read it. You do not need an account."
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
        <p>
          TikTok is also an external account provider. A TikTok link never moves
          a listing onto TikTok, and it never makes TikTok responsible for a
          sale.
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
          Signed-in people can choose Connect. That uses Facebook Login and
          asks for <code>public_profile</code>, <code>user_link</code>,{" "}
          <code>user_hometown</code>, and <code>user_location</code>. We use
          the public name, profile photo, profile link, hometown, and current
          city Facebook returns so the seller in Account settings and buyers on
          listings see those same official Facebook details. A seller also sees
          the buyer’s official connectors in Messages. A listing connector can
          open that Facebook profile. Facebook no longer returns
          a bio, cover photo,
          locale, or website to apps. Gender and age range need extra
          permissions that this app does not request. Those Facebook details
          stay with the Facebook link. They do not replace your Open
          Marketplace name or email.
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
          <li>Facebook birthday or mobile phone permission.</li>
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
        id="tiktok-connect-disclosure"
        aria-labelledby="tiktok-connect-disclosure-title"
      >
        <h2 id="tiktok-connect-disclosure-title">TikTok Login Kit</h2>
        <p>
          Signed-in people can choose Connect TikTok. That optional connection
          uses TikTok Login Kit OAuth and asks for{" "}
          <code>user.info.basic</code>, <code>user.info.profile</code>, and{" "}
          <code>user.info.stats</code>. After the user authorizes TikTok, our
          server exchanges the authorization code and reads the TikTok
          app-scoped <code>open_id</code>, display name, username, profile
          link, avatar, and follower count TikTok returns. We use those fields
          to show the linked TikTok identity on the existing Open Marketplace
          account and, when connected, on listings and Social Credit. Official
          fields include display name, username, profile link, avatar, bio,
          follower count, following count, likes, and video count when TikTok
          returns them. Those TikTok details stay with the TikTok connector.
          They do not replace your Open Marketplace name, email, or image.
        </p>
        <p>
          TikTok Login Kit is not a way to create or open an Open Marketplace
          account. Open Marketplace does not post to TikTok, read TikTok
          videos, or read TikTok messages.
        </p>
        <p>
          TikTok access tokens, refresh tokens, and the client secret remain
          server-side. They are not placed in public profile pages, public
          listing records, or public project files.
        </p>
      </section>

      <section
        id="social-connectors-disclosure"
        aria-labelledby="social-connectors-disclosure-title"
      >
        <h2 id="social-connectors-disclosure-title">Other social Connect</h2>
        <p>
          Signed-in people can also Connect Instagram, X, LinkedIn, Reddit, and
          Discord when those official apps are configured on this copy of the
          site. Instagram Login asks for{" "}
          <code>instagram_business_basic</code> only. It does not import posts
          or read messages. Only public fields the provider returns after Connect are
          stored: every public profile field the provider already returns after
          Connect — handle, display name, profile link, avatar, banner, bio,
          location, website, account type, locale, created date, and public
          counts such as followers, following, likes, posts, lists, or karma.
          More official fields raise Social Credit. That social signal is the
          first line of defense before verified buys and sells exist. Typed
          usernames and pasted links are not accepted. Provider emails are not
          published on listings. A provider verified mark is not an Open
          Marketplace verification badge. These links are not a way to create
          or open an Open Marketplace account.
        </p>
      </section>

      <section
        id="paypal-connect-disclosure"
        aria-labelledby="paypal-connect-disclosure-title"
      >
        <h2 id="paypal-connect-disclosure-title">PayPal Login</h2>
        <p>
          Signed-in people can choose Log in with PayPal. That uses official
          PayPal Login and asks for <code>openid</code> only. If PayPal also
          returns an email or a paypal.me address, we may use that as the
          public pay-to after you connect. Listings can show whether PayPal is
          currently linked. PayPal Login is not a way to create or open an
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
          How provider credentials are kept
        </h2>
        <p>
          Facebook access credentials and tokens remain server-side. They are
          not placed in public profile pages, public listing records, or
          public project files.
        </p>
        <p>
          TikTok Login Kit tokens and the TikTok client secret also remain
          server-side. They are not placed in public profile pages, public
          listing records, or public project files.
        </p>
        <p>
          PayPal Login tokens and the PayPal client secret also remain
          server-side. They are not placed in public profile pages, public
          listing records, or public project files.
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
          <li>
            Link a TikTok identity to an existing marketplace account when a
            signed-in person chooses Connect TikTok.
          </li>
          <li>
            Link a PayPal identity to an existing marketplace account when a
            signed-in person chooses Log in with PayPal.
          </li>
        </ul>
      </section>

      <section
        id="sharing-and-sale"
        aria-labelledby="sharing-and-sale-title"
      >
        <h2 id="sharing-and-sale-title">Sharing</h2>
        <p>
          Open Marketplace does not sell Facebook profile data. Open
          Marketplace does not sell TikTok provider data. Open Marketplace
          does not sell PayPal Login data. Hosting companies
          that run the site may process the records needed to keep the service
          online. We may also disclose information when the law requires it.
        </p>
      </section>

      <section id="retention" aria-labelledby="retention-title">
        <h2 id="retention-title">How long we keep it</h2>
        <p>
          Account and listing records stay while the account is open and the
          listing is on the catalog. Facebook Login tokens and the Connected
          profile are removed when you disconnect, or when Facebook asks us to
          delete that link. TikTok Login Kit tokens and the linked TikTok
          identity are removed when you disconnect TikTok. PayPal Login tokens
          and the linked PayPal identity are removed when you disconnect
          PayPal. We do not keep a separate advertising profile.
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

      <section
        id="tiktok-data-deletion"
        aria-labelledby="tiktok-data-deletion-title"
      >
        <h2 id="tiktok-data-deletion-title">Deleting TikTok data</h2>
        <p>
          Account Settings offers Disconnect now. Disconnect removes the
          active linked TikTok authorization and tokens and the TikTok display
          name shown next to Connected, stops future TikTok access, and leaves
          the Open Marketplace account and session intact.
        </p>
        <p>
          You can also remove Open Marketplace from TikTok&apos;s own connected
          apps settings. That revocation causes later Open Marketplace checks
          to fail closed. Account Settings then shows Needs reconnect with
          Disconnect and Connect TikTok, and does not keep displaying a stale
          Connected state.
        </p>
      </section>

      <section id="children" aria-labelledby="children-title">
        <h2 id="children-title">Children</h2>
        <p>
          Open Marketplace is not directed at children under 13. Facebook Login
          is only available to people Facebook already allows to use that
          product. TikTok Login Kit is only available to people TikTok already
          allows to use that product. PayPal Login is only available to people
          PayPal already allows to use that product.
        </p>
      </section>

      <section id="effective-date" aria-labelledby="effective-date-title">
        <h2 id="effective-date-title">Effective date</h2>
        <p className="privacy-effective">22 August 2026</p>
      </section>
    </LegalShell>
  );
}
