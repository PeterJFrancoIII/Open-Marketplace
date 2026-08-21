import { getMarketplaceSession } from "../../../../lib/auth";
import {
  createPaypalOAuthNonce,
  getPayPalConnectAvailability,
  paypalAuthorizeUrl,
  paypalOauthCookie,
  paypalStateExpiry,
  readPaypalOAuthSecrets,
  signPaypalOAuthState,
} from "../../../../lib/paypal-connect";
import {
  recordPaypalOAuthResult,
  storePaypalOAuthAttempt,
} from "../../../../lib/paypal-oauth-attempt";

function accountRedirect(origin: string, error?: string) {
  const url = new URL("/account/settings", origin);
  if (error) url.searchParams.set("error", error);
  url.hash = "payment-options-settings";
  return url.toString();
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const available = await getPayPalConnectAvailability();
  if (!available) {
    return Response.redirect(accountRedirect(origin, "paypal"), 302);
  }
  const session = await getMarketplaceSession(request);
  if (!session?.user.id) {
    return Response.redirect(
      `${origin}/login?returnTo=${encodeURIComponent("/account/settings")}`,
      302,
    );
  }
  const secrets = await readPaypalOAuthSecrets();
  if (!secrets.clientId || !secrets.clientSecret || !secrets.signingSecret) {
    return Response.redirect(accountRedirect(origin, "paypal"), 302);
  }
  const nonce = createPaypalOAuthNonce();
  const expiresAt = paypalStateExpiry();
  const redirectUri = `${origin}/api/paypal/callback`;
  const state = await signPaypalOAuthState(
    {
      userId: session.user.id,
      nonce,
      exp: expiresAt,
    },
    secrets.signingSecret,
  );
  await storePaypalOAuthAttempt({
    userId: session.user.id,
    nonce,
    redirectUri,
    returnOrigin: origin,
    expiresAt,
  });
  await recordPaypalOAuthResult(session.user.id, "started");
  const location = paypalAuthorizeUrl({
    clientId: secrets.clientId,
    redirectUri,
    state,
    live: secrets.live,
  });
  return new Response(null, {
    status: 302,
    headers: {
      location,
      "set-cookie": paypalOauthCookie(nonce, origin.startsWith("https://")),
    },
  });
}
