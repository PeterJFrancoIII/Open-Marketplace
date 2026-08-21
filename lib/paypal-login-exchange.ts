import {
  mergePaypalIdentity,
  parsePaypalIdToken,
  parsePaypalIdentity,
  paypalApiOrigin,
  paypalUserInfoUrls,
} from "./paypal-public";

export type PaypalLoginTokenFailure =
  | "client"
  | "code"
  | "redirect"
  | "request"
  | "service";

type PaypalLoginTokenPayload = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  id_token?: unknown;
};

function classifyPaypalTokenFailure(status: number, body: string): PaypalLoginTokenFailure {
  const normalized = body.toLowerCase();
  if (status >= 500) return "service";
  if (
    normalized.includes("invalid_client") ||
    normalized.includes("client authentication failed") ||
    normalized.includes("client credentials")
  ) {
    return "client";
  }
  if (
    normalized.includes("invalid_authz_code") ||
    normalized.includes("invalid authorization code") ||
    normalized.includes("authorization code is invalid") ||
    normalized.includes("authorization code not found") ||
    normalized.includes("invalid_grant")
  ) {
    return "code";
  }
  if (
    normalized.includes("invalid_redirect_uri") ||
    (normalized.includes("redirect_uri") &&
      (normalized.includes("required") ||
        normalized.includes("match") ||
        normalized.includes("mismatch")))
  ) {
    return "redirect";
  }
  return "request";
}

async function paypalTokenFailure(response: Response) {
  let body = "";
  try {
    body = await response.text();
  } catch {
    // Classification remains status-based when PayPal returns no readable body.
  }
  return classifyPaypalTokenFailure(response.status, body.slice(0, 4096));
}

async function requestPaypalLoginToken(input: {
  code: string;
  redirectUri?: string;
  clientId: string;
  clientSecret: string;
  live: boolean;
  includeRedirectUri: boolean;
}) {
  const basic = btoa(`${input.clientId}:${input.clientSecret}`);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
  });
  if (input.includeRedirectUri && input.redirectUri) {
    body.set("redirect_uri", input.redirectUri);
  }
  return fetch(`${paypalApiOrigin(input.live)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body,
  });
}

/**
 * Exchange a Log in with PayPal authorization code.
 *
 * PayPal's current Login guide documents Basic client authentication with
 * grant_type=authorization_code and code only. PayPal's current OAuth error
 * reference also documents redirect_uri-required / INVALID_REDIRECT_URI
 * failures. Use the documented Login form first and retry with the exact
 * authorize-time redirect URI only when PayPal explicitly says the redirect
 * URI is the problem. Never retry client, code, or generic request failures.
 */
export async function exchangePaypalLoginAuthorizationCode(input: {
  code: string;
  redirectUri?: string;
  clientId: string;
  clientSecret: string;
  live: boolean;
}) {
  let tokenResponse = await requestPaypalLoginToken({
    ...input,
    includeRedirectUri: false,
  });

  if (!tokenResponse.ok) {
    const firstFailure = await paypalTokenFailure(tokenResponse);
    if (firstFailure !== "redirect" || !input.redirectUri) {
      return { ok: false as const, reason: firstFailure };
    }
    tokenResponse = await requestPaypalLoginToken({
      ...input,
      includeRedirectUri: true,
    });
    if (!tokenResponse.ok) {
      return {
        ok: false as const,
        reason: await paypalTokenFailure(tokenResponse),
      };
    }
  }

  let tokenPayload: PaypalLoginTokenPayload;
  try {
    tokenPayload = (await tokenResponse.json()) as PaypalLoginTokenPayload;
  } catch {
    return { ok: false as const, reason: "request" as const };
  }
  if (typeof tokenPayload.access_token !== "string" || !tokenPayload.access_token) {
    return { ok: false as const, reason: "request" as const };
  }

  const userHeaders = {
    authorization: `Bearer ${tokenPayload.access_token}`,
    accept: "application/json",
  };
  let identity = mergePaypalIdentity();
  for (const userInfoUrl of paypalUserInfoUrls(input.live)) {
    const userResponse = await fetch(userInfoUrl, { headers: userHeaders });
    if (!userResponse.ok) continue;
    identity = mergePaypalIdentity(
      identity,
      parsePaypalIdentity(await userResponse.json()),
    );
  }
  if (typeof tokenPayload.id_token === "string") {
    identity = mergePaypalIdentity(
      identity,
      parsePaypalIdToken(tokenPayload.id_token),
    );
  }

  return {
    ok: true as const,
    value: {
      ...identity,
      payerId: identity.payerId,
      accessToken: tokenPayload.access_token,
      refreshToken:
        typeof tokenPayload.refresh_token === "string"
          ? tokenPayload.refresh_token
          : null,
      expiresIn:
        typeof tokenPayload.expires_in === "number" ? tokenPayload.expires_in : null,
      scope: typeof tokenPayload.scope === "string" ? tokenPayload.scope : null,
    },
  };
}
