import { getMarketplaceSession } from "../../../../lib/auth";
import {
  PAYPAL_OAUTH_COOKIE,
  clearPaypalOauthCookie,
  exchangePaypalAuthorizationCode,
  paypalFallbackAccountId,
  paypalPublicPayTo,
  readPaypalOAuthSecrets,
  upsertPaypalAccount,
  verifyPaypalOAuthState,
  writePaypalPaymentDestination,
} from "../../../../lib/paypal-connect";
import {
  consumePaypalOAuthAttempt,
  paypalOAuthDisplayName,
} from "../../../../lib/paypal-oauth-attempt";

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
  extras?: { paypal?: string; paypalme?: string },
) {
  const url = new URL("/account/settings", origin);
  if (error) url.searchParams.set("error", error);
  if (extras?.paypal) url.searchParams.set("paypal", extras.paypal);
  if (extras?.paypalme) url.searchParams.set("paypalme", extras.paypalme);
  url.hash = "surface-paypal-input";
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

  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!state || !code) {
    return redirectToAccount(origin, secure, "paypal-state");
  }

  const secrets = await readPaypalOAuthSecrets();
  if (!secrets.clientId || !secrets.clientSecret || !secrets.signingSecret) {
    return redirectToAccount(origin, secure, "paypal");
  }

  const parsed = await verifyPaypalOAuthState(state, secrets.signingSecret);
  if (!parsed) {
    return redirectToAccount(origin, secure, "paypal-state");
  }

  const attempt = await consumePaypalOAuthAttempt(parsed.nonce);
  if (
    !attempt ||
    attempt.userId !== parsed.userId ||
    attempt.redirectUri !== `${origin}/api/paypal/callback`
  ) {
    return redirectToAccount(origin, secure, "paypal-state");
  }

  const session = await getMarketplaceSession(request);
  if (session?.user.id && session.user.id !== attempt.userId) {
    return redirectToAccount(attempt.returnOrigin, secure, "paypal-session");
  }

  const nonce = cookieValue(request, PAYPAL_OAUTH_COOKIE);
  if (nonce && parsed.nonce !== nonce) {
    return redirectToAccount(attempt.returnOrigin, secure, "paypal-state");
  }

  const exchanged = await exchangePaypalAuthorizationCode({
    code,
    redirectUri: attempt.redirectUri,
    clientId: secrets.clientId,
    clientSecret: secrets.clientSecret,
    live: secrets.live,
  });
  if (!exchanged) {
    return redirectToAccount(attempt.returnOrigin, secure, "paypal-token");
  }

  const payerId = exchanged.payerId || paypalFallbackAccountId(attempt.userId);
  await upsertPaypalAccount({
    userId: attempt.userId,
    payerId,
    accessToken: exchanged.accessToken,
    refreshToken: exchanged.refreshToken,
    expiresIn: exchanged.expiresIn,
    scope: exchanged.scope,
    profile: { ...exchanged, payerId },
  });
  const payTo = paypalPublicPayTo({
    email: exchanged.email,
    paypalMe: exchanged.paypalMe,
  });
  if (payTo) {
    await writePaypalPaymentDestination(
      attempt.userId,
      session?.user.name?.trim() || (await paypalOAuthDisplayName(attempt.userId)),
      payTo,
    );
  }

  return redirectToAccount(attempt.returnOrigin, secure, undefined, {
    paypal: "linked",
    paypalme: payTo ? undefined : "setup",
  });
}
