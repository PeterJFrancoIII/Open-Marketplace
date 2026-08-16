import type { SocialProof } from "./types";

export function isConnectedFacebookProof(account: SocialProof): boolean {
  return account.provider === "facebook" && account.metricsSource === "oauth";
}

export function connectedFacebookSocialProof(sellerName: string): SocialProof {
  const handle = sellerName.trim() || "Facebook";
  return {
    provider: "facebook",
    url: "",
    handle,
    metricsSource: "oauth",
    health: "active",
    healthMessage: "Connected with Facebook Login.",
    connectionLabel: "friends",
  };
}

export function mergeConnectedFacebookProof(
  accounts: SocialProof[],
  facebookConnected: boolean,
  sellerName: string,
): SocialProof[] {
  const others = accounts.filter((account) => account.provider !== "facebook");
  const typedFacebook = accounts.filter(
    (account) => account.provider === "facebook" && !isConnectedFacebookProof(account),
  );
  if (!facebookConnected) {
    return [...typedFacebook, ...others];
  }
  return [connectedFacebookSocialProof(sellerName), ...others];
}
