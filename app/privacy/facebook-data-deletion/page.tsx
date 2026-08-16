import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "../../legal/legal-shell";

export const metadata: Metadata = {
  title: "Facebook data deletion — Open Marketplace",
  description:
    "How to remove Facebook Login data from Open Marketplace, including Disconnect and Facebook’s Apps and Websites request.",
};

export default function FacebookDataDeletionPage() {
  return (
    <LegalShell
      title="Facebook data deletion"
      lead="You can remove the Facebook link from Open Marketplace without closing your marketplace account."
    >
      <section
        id="facebook-data-deletion"
        aria-labelledby="facebook-data-deletion-title"
      >
        <h2 id="facebook-data-deletion-title">While you can still sign in</h2>
        <ol className="legal-steps">
          <li>
            Open{" "}
            <Link href="/login?returnTo=%2Faccount">Open Marketplace</Link> and
            sign in with the email and password for that account.
          </li>
          <li>Go to Account settings.</li>
          <li>Find Facebook and choose Disconnect.</li>
        </ol>
        <p>
          Account Settings offers Disconnect now. Disconnect removes the
          active linked Facebook account credentials and tokens and the
          Facebook name and photo shown next to Connected, stops future
          Facebook access, and leaves the Open Marketplace account and
          session intact.
        </p>
      </section>

      <section aria-labelledby="facebook-apps-title">
        <h2 id="facebook-apps-title">From Facebook</h2>
        <p>
          If you removed Open Marketplace under Facebook&apos;s Apps and
          Websites settings, use <strong>Send Request</strong> on the removed
          app. Facebook then notifies us. We delete the Facebook Login link as
          soon as that notice arrives and return a confirmation code you can
          check here.
        </p>
        <p>
          Facebook&apos;s own page for this is{" "}
          <a
            href="https://www.facebook.com/settings?tab=applications"
            rel="noreferrer"
            target="_blank"
          >
            Settings, Apps and Websites
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="what-is-removed-title">
        <h2 id="what-is-removed-title">What is removed</h2>
        <ul>
          <li>The Facebook Login connection on this account.</li>
          <li>Facebook access tokens we stored for that connection.</li>
          <li>
            The Facebook name and profile photo used for the Connected
            display.
          </li>
        </ul>
        <p>
          Your Open Marketplace email, password, and listings stay unless you
          change or remove them yourself. Typed Facebook profile URLs that you
          saved as ordinary public links are not the same as a Connected
          Facebook Login account; edit those in Social media if you want them
          gone.
        </p>
      </section>

      <section aria-labelledby="confirmation-title">
        <h2 id="confirmation-title">Confirmation codes</h2>
        <p>
          When Facebook sends us a deletion request, we give Facebook a
          confirmation code and a status page. If you have that code, open{" "}
          <Link href="/privacy/facebook-data-deletion/status">
            deletion request status
          </Link>{" "}
          and paste it into the confirmation field, or use the link Facebook
          received.
        </p>
      </section>

      <p>
        The full <Link href="/privacy">Privacy Policy</Link> explains what
        Facebook Login can and cannot see.
      </p>
    </LegalShell>
  );
}
