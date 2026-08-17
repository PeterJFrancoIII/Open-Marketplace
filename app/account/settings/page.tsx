import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { profiles } from "../../../db/schema";
import { getFacebookConnection, getSocialConnections } from "../../../lib/auth";
import { parsePaymentDestinationsJson } from "../../../lib/payment-destinations";
import { getPayPalConnection } from "../../../lib/paypal-connect";
import { parseSocialAccountsJson } from "../../../lib/profile-settings";
import { parseShippingBrokersJson } from "../../../lib/shipping-brokers";
import { loadPortalSession } from "../../portal/load-portal";
import PortalShell from "../../portal/portal-shell";
import AccountSettings from "../account-settings";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const { requestHeaders, session, isAdmin, user } =
    await loadPortalSession("/account/settings");

  const db = await getDb();
  const profileRows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, session.user.id))
    .limit(1);
  const profile = profileRows[0];
  const [facebookConnection, socialConnections, paypalConnection] = await Promise.all([
    getFacebookConnection(requestHeaders),
    getSocialConnections(requestHeaders),
    getPayPalConnection(requestHeaders),
  ]);

  return (
    <PortalShell user={user} activeSection="settings" isAdmin={isAdmin}>
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
        initialSocialConnections={socialConnections}
        initialPayPalConnection={paypalConnection}
      />
    </PortalShell>
  );
}
