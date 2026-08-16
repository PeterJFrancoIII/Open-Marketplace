import { getMarketplaceSession } from "../../../../lib/auth";
import {
  PAYPAL_OAUTH_COOKIE,
  clearPaypalOauthCookie,
  exchangePaypalAuthorizationCode,
  readPaypalOAuthSecrets,
  upsertPaypalAccount,
  verifyPaypalOAuthState,
  writePaypalPaymentDestination,
} from "../../../../lib/paypal-connect";

function cookieValue(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

function redirectToAccount(
  origin: string,
  secure: boolean,
  error?: string,
) {
  const url = new URL("/account", origin);
  if (error) url.searchParams.set("error", error);
  url.hash = "payment-options-settings";
  return new Response(null, {
    status: 302,
    headers: {
      location: url.toString(),
      "set-cookie": clearPaypalOauthCookie(secure),
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const secure = origin.startsWith("https://");

  if (url.searchParams.get("error")) {
    return redirectToAccount(origin, secure, "paypal");
  }

  const session = await getMarketplaceSession(request);
  if (!session?.user.id || !session.user.name) {
    return redirectToAccount(origin, secure, "paypal");
  }

  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!state || !code) {
    return redirectToAccount(origin, secure, "paypal");
  }

  const secrets = await readPaypalOAuthSecrets();
  if (!secrets.clientId || !secrets.clientSecret || !secrets.signingSecret) {
    return redirectToAccount(origin, secure, "paypal");
  }
  const parsed = await verifyPaypalOAuthState(state, secrets.signingSecret);
  const nonce = cookieValue(request, PAYPAL_OAUTH_COOKIE);
  if (!parsed || parsed.userId !== session.user.id || parsed.nonce !== nonce) {
    return redirectToAccount(origin, secure, "paypal");
  }

  const exchanged = await exchangePaypalAuthorizationCode({
    code,
    redirectUri: `${origin}/api/paypal/callback`,
    clientId: secrets.clientId,
    clientSecret: secrets.clientSecret,
    live: secrets.live,
  });
  if (!exchanged) {
    return redirectToAccount(origin, secure, "paypal");
  }

  await upsertPaypalAccount({
    userId: session.user.id,
    payerId: exchanged.payerId,
    accessToken: exchanged.accessToken,
    refreshToken: exchanged.refreshToken,
    expiresIn: exchanged.expiresIn,
    scope: exchanged.scope,
  });
  await writePaypalPaymentDestination(
    session.user.id,
    session.user.name,
    exchanged.email,
  );

  return redirectToAccount(origin, secure);
}
