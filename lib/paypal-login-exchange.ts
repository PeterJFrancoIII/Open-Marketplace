import {
  mergePaypalIdentity,
  parsePaypalIdToken,
  parsePaypalIdentity,
  paypalApiOrigin,
  paypalUserInfoUrls,
} from "./paypal-public";

/**
 * Exchange a Log in with PayPal authorization code. Live Login on this
 * project completed when the token form repeated the same redirect_uri
 * sent to /connect. Keep that URI from the stored attempt, not from the
 * callback request host, so a Pages alias and unique deploy host can differ.
 */
export async function exchangePaypalLoginAuthorizationCode(input: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  live: boolean;
}) {
  const basic = btoa(`${input.clientId}:${input.clientSecret}`);
  const tokenResponse = await fetch(`${paypalApiOrigin(input.live)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
  });
  if (!tokenResponse.ok) return null;

  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
    scope?: unknown;
    id_token?: unknown;
  };
  if (typeof tokenPayload.access_token !== "string" || !tokenPayload.access_token) {
    return null;
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
  };
}
