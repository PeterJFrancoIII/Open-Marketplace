import { getMarketplaceSession } from "../../../../lib/auth";
import {
  PAYPAL_OAUTH_COOKIE,
  clearPaypalOauthCookie,
  paypalFallbackAccountId,
  paypalPublicPayTo,
  readPaypalOAuthSecrets,
  upsertPaypalAccount,
  verifyPaypalOAuthState,
  writePaypalPaymentDestination,
} from "../../../../lib/paypal-connect";
import { exchangePaypalLoginAuthorizationCode } from "../../../../lib/paypal-login-exchange";
import {
  consumePaypalOAuthAttempt,
  paypalCallbackOriginAllowed,
  paypalOAuthDisplayName,
  recordPaypalOAuthResult,
} from "../../../../lib/paypal-oauth-attempt";
import type { PaypalOAuthLastReturn } from "../../../../lib/types";

function cookieValue(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

async function redirectToAccount(
  origin: string,
  secure: boolean,
  error?: string,
  extras?: { paypal?: string; paypalme?: string },
  userId?: string,
) {
  if (userId) {
    const status: PaypalOAuthLastReturn =
      extras?.paypal === "linked"
        ? "linked"
        : error === "paypal-state" ||
            error === "paypal-session" ||
            error === "paypal-token" ||
            error === "paypal"
          ? error
          : "paypal";
    await recordPaypalOAuthResult(userId, status);
  }
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
  const session = await getMarketplaceSession(request);

  if (url.searchParams.get("error")) {
    return redirectToAccount(origin, secure, "paypal", undefined, session?.user.id);
  }

  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!state || !code) {
    return redirectToAccount(origin, secure, "paypal-state", undefined, session?.user.id);
  }

  const secrets = await readPaypalOAuthSecrets();
  if (!secrets.clientId || !secrets.clientSecret || !secrets.signingSecret) {
    return redirectToAccount(origin, secure, "paypal", undefined, session?.user.id);
  }

  const parsed = await verifyPaypalOAuthState(state, secrets.signingSecret);
  if (!parsed) {
    return redirectToAccount(origin, secure, "paypal-state", undefined, session?.user.id);
  }

  const attempt = await consumePaypalOAuthAttempt(parsed.nonce);
  if (!attempt || attempt.userId !== parsed.userId || !paypalCallbackOriginAllowed(origin)) {
    return redirectToAccount(origin, secure, "paypal-state", undefined, parsed.userId);
  }

  if (session?.user.id && session.user.id !== attempt.userId) {
    return redirectToAccount(attempt.returnOrigin, secure, "paypal-session", undefined, attempt.userId);
  }

  const nonce = cookieValue(request, PAYPAL_OAUTH_COOKIE);
  if (nonce && parsed.nonce !== nonce) {
    return redirectToAccount(attempt.returnOrigin, secure, "paypal-state", undefined, attempt.userId);
  }

  const exchanged = await exchangePaypalLoginAuthorizationCode({
    code,
    redirectUri: attempt.redirectUri,
    clientId: secrets.clientId,
    clientSecret: secrets.clientSecret,
    live: secrets.live,
  });
  if (!exchanged.ok) {
    return redirectToAccount(
      attempt.returnOrigin,
      secure,
      exchanged.reason === "redirect" ? "paypal-token-redirect" : "paypal-token",
      undefined,
      attempt.userId,
    );
  }

  const payerId = exchanged.value.payerId || paypalFallbackAccountId(attempt.userId);
  await upsertPaypalAccount({
    userId: attempt.userId,
    payerId,
    accessToken: exchanged.value.accessToken,
    refreshToken: exchanged.value.refreshToken,
    expiresIn: exchanged.value.expiresIn,
    scope: exchanged.value.scope,
    profile: { ...exchanged.value, payerId },
  });
  const payTo = paypalPublicPayTo({
    email: exchanged.value.email,
    paypalMe: exchanged.value.paypalMe,
  });
  if (payTo) {
    await writePaypalPaymentDestination(
      attempt.userId,
      session?.user.name?.trim() || (await paypalOAuthDisplayName(attempt.userId)),
      payTo,
    );
  }

  return redirectToAccount(
    attempt.returnOrigin,
    secure,
    undefined,
    { paypal: "linked", paypalme: payTo ? undefined : "setup" },
    attempt.userId,
  );
}
