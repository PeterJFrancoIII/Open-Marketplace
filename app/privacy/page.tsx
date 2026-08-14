import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Open Marketplace",
  description:
    "How Open Marketplace handles account, listing, and future Facebook Connect data.",
};

const sections = [
  { id: "identity-and-scope", label: "Identity and scope" },
  { id: "data-currently-handled", label: "Data currently handled" },
  { id: "local-media-boundary", label: "Local-media boundary" },
  { id: "facebook-connect-disclosure", label: "Facebook Connect disclosure" },
  { id: "facebook-exclusions", label: "Facebook exclusions" },
  { id: "provider-credential-boundary", label: "Provider credential boundary" },
  { id: "purposes", label: "Purposes" },
  { id: "sharing-and-sale", label: "Sharing and sale" },
  { id: "retention", label: "Retention" },
  { id: "facebook-data-deletion", label: "Facebook data deletion" },
  { id: "effective-date", label: "Effective date" },
] as const;

export default function PrivacyPage() {
  return (
    <div className="auth-shell">
      <a className="privacy-skip" href="#privacy-content">
        Skip to privacy policy
      </a>
      <header className="auth-topbar">
        <Link className="wordmark" href="/" aria-label="Open Marketplace home">
          <span className="wordmark-mark">↔</span>
          <span className="wordmark-copy">open marketplace</span>
        </Link>
      </header>
      <main className="auth-main">
        <article className="privacy-doc" id="privacy-content">
          <section className="portal-panel" aria-labelledby="privacy-title">
            <p className="portal-eyebrow">Public policy</p>
            <h1 id="privacy-title">Privacy Policy</h1>
            <p className="portal-lead">
              This page describes how the Open Marketplace account preview
              handles information today, and what Facebook Connect will and will
              not do if it is later enabled. It does not require an account.
            </p>
            <p>
              <Link className="privacy-home" href="/">
                Back to marketplace
              </Link>
            </p>
            <nav aria-label="On this page">
              <ul className="privacy-toc">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`}>{section.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          </section>

          <section
            className="portal-panel"
            id="identity-and-scope"
            aria-labelledby="identity-and-scope-title"
          >
            <h2 id="identity-and-scope-title">Identity and scope</h2>
            <p>
              Open Marketplace is an independent marketplace. Facebook and Meta
              are external account providers, not the operator of this
              marketplace. Listings, listing photos, and marketplace accounts
              stay on Open Marketplace.
            </p>
          </section>

          <section
            className="portal-panel"
            id="data-currently-handled"
            aria-labelledby="data-currently-handled-title"
          >
            <h2 id="data-currently-handled-title">Data currently handled</h2>
            <p>
              The account preview currently handles the following categories of
              information:
            </p>
            <ul>
              <li>Account name and email address.</li>
              <li>
                Better Auth authentication, account, session, and security
                records used to sign in and keep the session.
              </li>
              <li>
                Public profile, listing, and payment-destination data that a
                signed-in user deliberately submits.
              </li>
              <li>
                Marketplace registry metadata for listings and related account
                records.
              </li>
            </ul>
          </section>

          <section
            className="portal-panel"
            id="local-media-boundary"
            aria-labelledby="local-media-boundary-title"
          >
            <h2 id="local-media-boundary-title">Local-media boundary</h2>
            <p>
              Listing image bytes remain on the seller&apos;s device. Central
              storage keeps listing metadata and content hashes, not the listing
              image bytes themselves.
            </p>
          </section>

          <section
            className="portal-panel"
            id="facebook-connect-disclosure"
            aria-labelledby="facebook-connect-disclosure-title"
          >
            <h2 id="facebook-connect-disclosure-title">
              Facebook Connect disclosure
            </h2>
            <p>
              Facebook Connect is not yet enabled on this preview. This preview
              does not currently receive Facebook data through Facebook Login.
            </p>
            <p>
              Before Facebook Connect is enabled, Open Marketplace will request
              consumer Facebook Login <code>public_profile</code> only. Provider-supplied
              profile identity will be used solely for explicit account linking
              and a Connected status under OM-DEC-017.
            </p>
          </section>

          <section
            className="portal-panel"
            id="facebook-exclusions"
            aria-labelledby="facebook-exclusions-title"
          >
            <h2 id="facebook-exclusions-title">Facebook exclusions</h2>
            <p>
              Open Marketplace does not claim, and does not plan to collect, any
              of the following through Facebook Connect:
            </p>
            <ul>
              <li>Facebook email permission.</li>
              <li>Facebook friends or followers.</li>
              <li>Facebook Pages.</li>
              <li>Facebook Marketplace data.</li>
              <li>Facebook listings or listing photos.</li>
              <li>Facebook Commerce data.</li>
              <li>
                Government-identity verification, or any “Facebook verified”
                label.
              </li>
            </ul>
          </section>

          <section
            className="portal-panel"
            id="provider-credential-boundary"
            aria-labelledby="provider-credential-boundary-title"
          >
            <h2 id="provider-credential-boundary-title">
              Provider credential boundary
            </h2>
            <p>
              When Facebook Connect is later implemented, provider tokens and
              connection credentials will remain server-side. They will not be
              exposed in public profile JSON, public listings, logs, Git, or
              agent handoffs.
            </p>
          </section>

          <section
            className="portal-panel"
            id="purposes"
            aria-labelledby="purposes-title"
          >
            <h2 id="purposes-title">Purposes</h2>
            <p>Open Marketplace uses the information described here to:</p>
            <ul>
              <li>Operate accounts and sessions.</li>
              <li>Provide marketplace features the user requested.</li>
              <li>Maintain security and abuse controls.</li>
              <li>
                Perform explicit provider account linking when that feature is
                enabled.
              </li>
            </ul>
          </section>

          <section
            className="portal-panel"
            id="sharing-and-sale"
            aria-labelledby="sharing-and-sale-title"
          >
            <h2 id="sharing-and-sale-title">Sharing and sale</h2>
            <p>
              Open Marketplace does not sell Facebook profile data. Hosting and
              infrastructure providers may process service data as needed to
              host and operate the service. Information may also be disclosed
              when legally required.
            </p>
          </section>

          <section
            className="portal-panel"
            id="retention"
            aria-labelledby="retention-title"
          >
            <h2 id="retention-title">Retention</h2>
            <p>
              Records are retained only as needed for the account, service, and
              security purposes described on this page. This product has not
              adopted a fixed legal retention period.
            </p>
          </section>

          <section
            className="portal-panel"
            id="facebook-data-deletion"
            aria-labelledby="facebook-data-deletion-title"
          >
            <h2 id="facebook-data-deletion-title">Facebook data deletion</h2>
            <p>
              Facebook Connect is not yet enabled, so this preview does not
              currently receive Facebook data through Facebook Login. There is
              therefore no Facebook Login dataset to delete on this preview
              today, and Account Settings does not yet offer Disconnect.
            </p>
            <p>
              Before Facebook Connect is enabled for users, Account Settings
              will provide Disconnect. Disconnect must stop future provider
              access and remove the active Facebook connection credentials,
              tokens, and provider-supplied Facebook profile data used for
              Connected qualification. This page documents that contract. It
              does not implement Facebook Login, OAuth, or Disconnect.
            </p>
            <p>
              A private privacy-request contact channel will be published before
              public Facebook Connect launch. Do not post credentials, tokens,
              or other sensitive personal data in a public GitHub issue or any
              other public channel.
            </p>
          </section>

          <section
            className="portal-panel"
            id="effective-date"
            aria-labelledby="effective-date-title"
          >
            <h2 id="effective-date-title">Effective date</h2>
            <p className="privacy-effective">2026-08-14</p>
          </section>
        </article>
      </main>
    </div>
  );
}
