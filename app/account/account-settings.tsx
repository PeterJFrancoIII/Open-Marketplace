"use client";

import { type FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "../../lib/auth-client";
import { PAYMENT_RAILS } from "../../lib/payment-destinations";
import type {
  FacebookConnection,
  PaymentDestination,
  PaymentRail,
  SocialProof,
} from "../../lib/types";

type SocialDraft = {
  provider: "instagram" | "tiktok";
  url: string;
  accountCreatedAt: string;
  connectionCount: string;
  health?: SocialProof["health"];
  healthMessage?: string;
};

const emptySocialDrafts: SocialDraft[] = [
  { provider: "instagram", url: "", accountCreatedAt: "", connectionCount: "" },
  { provider: "tiktok", url: "", accountCreatedAt: "", connectionCount: "" },
];

function draftsFromAccounts(accounts: SocialProof[]): SocialDraft[] {
  return emptySocialDrafts.map((draft) => {
    const saved = accounts.find((account) => account.provider === draft.provider);
    if (!saved) return { ...draft };
    return {
      ...draft,
      url: saved.url ?? "",
      accountCreatedAt: saved.accountCreatedAt ?? "",
      connectionCount:
        saved.connectionCount == null ? "" : String(saved.connectionCount),
      health: saved.health,
      healthMessage: saved.healthMessage,
    };
  });
}

function destinationsByRail(destinations: PaymentDestination[]) {
  return Object.fromEntries(
    PAYMENT_RAILS.map((rail) => [
      rail.id,
      destinations.find((destination) => destination.rail === rail.id)?.destination ??
        "",
    ]),
  ) as Record<PaymentRail, string>;
}

const MANUAL_PAYMENT_RAILS = PAYMENT_RAILS.filter((rail) => rail.networkId == null);
const CRYPTO_PAYMENT_RAILS = PAYMENT_RAILS.filter((rail) => rail.networkId != null);

function normalizeAuthError(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "");
    if (/password|credential|invalid|incorrect|current/i.test(message)) {
      return message.length <= 160 ? message : fallback;
    }
  }
  if (error instanceof Error && error.message) {
    if (/network|fetch/i.test(error.message)) {
      return "Something went wrong. Try again.";
    }
  }
  return fallback;
}

function healthLabel(health: SocialProof["health"]) {
  if (health === "active") return "Link resolves";
  if (health === "dead" || health === "invalid") return "Fix or remove";
  if (health === "checking") return "Checking";
  if (health === "unknown") return "Recheck blocked";
  return "";
}

function providerName(provider: SocialDraft["provider"]) {
  if (provider === "tiktok") return "TikTok";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function facebookOauthErrorSubscribe() {
  return () => {};
}

function readFacebookOauthError() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("error")
    ? "Facebook Connect did not complete. Try again."
    : "";
}

const FACEBOOK_PUBLIC_PROFILE_SCOPE = "public_profile";
const emptyFacebookConnection: FacebookConnection = {
  available: false,
  connected: false,
  name: null,
  firstName: null,
  lastName: null,
  middleName: null,
  shortName: null,
  imageUrl: null,
};

export default function AccountSettings({
  initialName,
  email,
  initialSocialAccounts,
  initialPaymentDestinations,
  initialFacebookConnection,
}: {
  initialName: string;
  email: string;
  initialSocialAccounts: SocialProof[];
  initialPaymentDestinations: PaymentDestination[];
  initialFacebookConnection: FacebookConnection;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [socialDrafts, setSocialDrafts] = useState(() =>
    draftsFromAccounts(initialSocialAccounts),
  );
  const [paymentDrafts, setPaymentDrafts] = useState(() =>
    destinationsByRail(initialPaymentDestinations),
  );
  const [facebookConnection, setFacebookConnection] = useState(
    initialFacebookConnection ?? emptyFacebookConnection,
  );
  const [pending, setPending] = useState<
    | "name"
    | "password"
    | "signout"
    | "social"
    | "payment"
    | "facebook-connect"
    | "facebook-disconnect"
    | null
  >(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const oauthError = useSyncExternalStore(
    facebookOauthErrorSubscribe,
    readFacebookOauthError,
    () => "",
  );
  const visibleError = error || oauthError;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("error")) return;
    params.delete("error");
    params.delete("error_description");
    const next = `${window.location.pathname}${
      params.toString() ? `?${params.toString()}` : ""
    }#account-settings`;
    window.history.replaceState(null, "", next);
  }, []);

  async function onUpdateName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) {
      setStatus("");
      setError("Enter a display name.");
      return;
    }
    setPending("name");
    setStatus("");
    setError("");
    try {
      const result = await authClient.updateUser({ name: normalizedName });
      if (result.error) {
        setError(normalizeAuthError(result.error, "Could not update your name."));
        return;
      }
      setName(normalizedName);
      setStatus("Display name updated.");
      router.refresh();
    } catch (submitError) {
      setError(normalizeAuthError(submitError, "Could not update your name."));
    } finally {
      setPending(null);
    }
  }

  async function onChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("password");
    setStatus("");
    setError("");
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setError(
          normalizeAuthError(result.error, "Could not change your password."),
        );
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setStatus("Password updated. Other sessions were signed out.");
    } catch (submitError) {
      setError(
        normalizeAuthError(submitError, "Could not change your password."),
      );
    } finally {
      setPending(null);
    }
  }

  async function saveProfile(body: Record<string, unknown>, kind: "social" | "payment") {
    const response = await fetch("/api/account/profile", {
      method: "PUT",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as {
      error?: string;
      account?: SocialProof;
      socialAccounts?: SocialProof[];
      paymentDestinations?: PaymentDestination[];
      facebookConnection?: FacebookConnection;
    };
    if (result.facebookConnection) {
      setFacebookConnection(result.facebookConnection);
    }
    if (response.status === 401) {
      window.location.assign("/login?returnTo=%2Faccount");
      return null;
    }
    if (!response.ok) {
      if (kind === "social" && result.account) {
        setSocialDrafts((current) =>
          current.map((account) =>
            account.provider === result.account?.provider
              ? {
                  ...account,
                  health: result.account.health,
                  healthMessage: result.account.healthMessage,
                }
              : account,
          ),
        );
      }
      throw new Error(result.error ?? "Could not save settings.");
    }
    return result;
  }

  async function onSaveSocial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("social");
    setStatus("");
    setError("");
    try {
      const result = await saveProfile(
        {
          socialAccounts: socialDrafts
            .filter((account) => account.url.trim())
            .map((account) => ({
              provider: account.provider,
              url: account.url.trim(),
              accountCreatedAt: account.accountCreatedAt,
              connectionCount:
                account.connectionCount === ""
                  ? undefined
                  : Number(account.connectionCount),
              connectionLabel: "followers",
              metricsSource: "self-reported",
            })),
        },
        "social",
      );
      if (!result) return;
      setSocialDrafts(draftsFromAccounts(result.socialAccounts ?? []));
      setStatus("Social media links saved. A resolving URL is not a verified identity.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save social media links.",
      );
    } finally {
      setPending(null);
    }
  }

  async function onSavePayments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("payment");
    setStatus("");
    setError("");
    try {
      const result = await saveProfile(
        {
          paymentDestinations: PAYMENT_RAILS.flatMap((rail) => {
            const destination = paymentDrafts[rail.id].trim();
            return destination
              ? [
                  {
                    rail: rail.id,
                    destination,
                    asset: rail.asset,
                    networkId: rail.networkId,
                    networkLabel: rail.networkLabel,
                  },
                ]
              : [];
          }),
        },
        "payment",
      );
      if (!result) return;
      setPaymentDrafts(destinationsByRail(result.paymentDestinations ?? []));
      setStatus(
        "Payment destinations saved. These are public contacts, not a checkout.",
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save payment destinations.",
      );
    } finally {
      setPending(null);
    }
  }

  async function onConnectFacebook() {
    setPending("facebook-connect");
    setStatus("");
    setError("");
    try {
      const result = await authClient.linkSocial({
        provider: "facebook",
        callbackURL: "/account",
        errorCallbackURL: "/account",
        scopes: [FACEBOOK_PUBLIC_PROFILE_SCOPE],
      });
      if (result.error) {
        setError(
          normalizeAuthError(result.error, "Could not start Facebook Connect."),
        );
        return;
      }
    } catch (submitError) {
      setError(
        normalizeAuthError(submitError, "Could not start Facebook Connect."),
      );
    } finally {
      setPending(null);
    }
  }

  async function onDisconnectFacebook() {
    setPending("facebook-disconnect");
    setStatus("");
    setError("");
    try {
      const result = await authClient.unlinkAccount({
        providerId: "facebook",
      });
      if (result.error) {
        setError(
          normalizeAuthError(result.error, "Could not disconnect Facebook."),
        );
        return;
      }
      setFacebookConnection({
        available: facebookConnection.available,
        connected: false,
        name: null,
        imageUrl: null,
      });
      setStatus("Facebook disconnected. Your Open Marketplace account is unchanged.");
      router.refresh();
    } catch (submitError) {
      setError(
        normalizeAuthError(submitError, "Could not disconnect Facebook."),
      );
    } finally {
      setPending(null);
    }
  }

  async function onSignOut() {
    setPending("signout");
    setStatus("");
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError(normalizeAuthError(result.error, "Could not sign out."));
        setPending(null);
        return;
      }
      window.location.assign("/login");
    } catch (submitError) {
      setError(normalizeAuthError(submitError, "Could not sign out."));
      setPending(null);
    }
  }

  return (
    <section
      className="portal-panel"
      id="account-settings"
      aria-labelledby="account-settings-title"
    >
      <h2 id="account-settings-title">Account settings</h2>
      <p className="portal-lead">
        Update your display name, password, Facebook Connect, public social
        links, and public payment destinations. Email stays read-only until
        verification delivery is available.
      </p>

      <form className="portal-form" onSubmit={onUpdateName}>
        <label className="portal-field">
          <span>Display name</span>
          <input
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={80}
            disabled={pending !== null}
          />
        </label>
        <label className="portal-field">
          <span>Email</span>
          <input type="email" value={email} readOnly aria-readonly="true" />
        </label>
        <button
          className="button button-dark"
          type="submit"
          disabled={pending !== null}
        >
          {pending === "name" ? "Saving…" : "Save display name"}
        </button>
      </form>

      <form className="portal-form" onSubmit={onChangePassword}>
        <label className="portal-field">
          <span>Current password</span>
          <input
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            minLength={12}
            maxLength={128}
            disabled={pending !== null}
          />
        </label>
        <label className="portal-field">
          <span>New password</span>
          <input
            type="password"
            name="newPassword"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            minLength={12}
            maxLength={128}
            disabled={pending !== null}
          />
        </label>
        <button
          className="button button-dark"
          type="submit"
          disabled={pending !== null}
        >
          {pending === "password" ? "Updating…" : "Change password"}
        </button>
      </form>

      <div
        className="portal-form"
        id="facebook-connect-settings"
        aria-labelledby="facebook-connect-title"
      >
        <div>
          <h3 id="facebook-connect-title">Facebook</h3>
          <p className="portal-lead">
            Connect your Facebook account to prove you control it. This uses
            consumer Facebook Login and public_profile only, and reads every
            field Facebook returns on that permission: name, first name, last
            name, middle name, short name, and a large profile photo. If those
            marketplace fields are empty, they are filled from Facebook.
            Address, date of birth, phone, and email are not available from
            Facebook Login. It does not sign you in, import listings, or make
            you Facebook verified.
          </p>
        </div>
        <div className="portal-settings-row">
          <div className="portal-settings-row-head">
            <strong>Facebook</strong>
            {facebookConnection.connected ? (
              <span className="portal-settings-health">Connected</span>
            ) : null}
          </div>
          {facebookConnection.connected ? (
            <>
              {facebookConnection.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={facebookConnection.imageUrl}
                  alt=""
                  width={48}
                  height={48}
                />
              ) : null}
              <p>
                {facebookConnection.name
                  ? facebookConnection.name
                  : "Facebook account connected."}
              </p>
              {facebookConnection.firstName || facebookConnection.lastName ? (
                <p>
                  {[
                    facebookConnection.firstName,
                    facebookConnection.middleName,
                    facebookConnection.lastName,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </p>
              ) : null}
              <button
                className="button button-ghost"
                type="button"
                onClick={onDisconnectFacebook}
                disabled={pending !== null}
              >
                {pending === "facebook-disconnect"
                  ? "Disconnecting…"
                  : "Disconnect"}
              </button>
            </>
          ) : facebookConnection.available ? (
            <button
              className="button button-dark"
              type="button"
              onClick={onConnectFacebook}
              disabled={pending !== null}
            >
              {pending === "facebook-connect"
                ? "Connecting…"
                : "Connect Facebook"}
            </button>
          ) : (
            <p className="portal-settings-note">
              Facebook Connect is not configured in this environment.
            </p>
          )}
        </div>
      </div>

      <form
        className="portal-form"
        id="social-media-settings"
        onSubmit={onSaveSocial}
        aria-labelledby="social-media-title"
      >
        <div>
          <h3 id="social-media-title">Social media</h3>
          <p className="portal-lead">
            Instagram and TikTok still use typed profile URLs. A resolving URL
            is link-health evidence only. Those connectors cannot supply a
            photo, name, address, date of birth, or phone. It does not verify
            identity or count as a provider-connected Facebook account.
          </p>
        </div>
        {socialDrafts.map((account, index) => (
          <div className="portal-settings-row" key={account.provider}>
            <div className="portal-settings-row-head">
              <strong>{providerName(account.provider)}</strong>
              {account.health ? (
                <span className="portal-settings-health">
                  {healthLabel(account.health)}
                </span>
              ) : null}
            </div>
            <label className="portal-field">
              <span>Profile URL</span>
              <input
                type="url"
                value={account.url}
                onChange={(event) =>
                  setSocialDrafts((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index
                        ? {
                            ...row,
                            url: event.target.value,
                            health: undefined,
                            healthMessage: undefined,
                          }
                        : row,
                    ),
                  )
                }
                placeholder={`https://${account.provider}.com/your-profile`}
                disabled={pending !== null}
              />
            </label>
            <div className="portal-settings-inline">
              <label className="portal-field">
                <span>Account created</span>
                <input
                  type="date"
                  value={account.accountCreatedAt}
                  onChange={(event) =>
                    setSocialDrafts((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, accountCreatedAt: event.target.value }
                          : row,
                      ),
                    )
                  }
                  disabled={pending !== null || !account.url}
                />
              </label>
              <label className="portal-field">
                <span>Followers</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={account.connectionCount}
                  onChange={(event) =>
                    setSocialDrafts((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, connectionCount: event.target.value }
                          : row,
                      ),
                    )
                  }
                  disabled={pending !== null || !account.url}
                />
              </label>
            </div>
            {account.url ? (
              <button
                className="button button-ghost"
                type="button"
                onClick={() =>
                  setSocialDrafts((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index
                        ? {
                            ...row,
                            url: "",
                            accountCreatedAt: "",
                            connectionCount: "",
                            health: undefined,
                            healthMessage: undefined,
                          }
                        : row,
                    ),
                  )
                }
                disabled={pending !== null}
              >
                Remove {providerName(account.provider)}
              </button>
            ) : null}
            {account.healthMessage ? (
              <p className="portal-settings-note">{account.healthMessage}</p>
            ) : null}
          </div>
        ))}
        <button
          className="button button-dark"
          type="submit"
          disabled={pending !== null}
        >
          {pending === "social" ? "Saving…" : "Save social media"}
        </button>
      </form>

      <form
        className="portal-form"
        id="payment-options-settings"
        onSubmit={onSavePayments}
        aria-labelledby="payment-options-title"
      >
        <div>
          <h3 id="payment-options-title">Payment options</h3>
          <p className="portal-lead">
            Public payment methods: PayPal, Venmo, Cash App, Zelle, and Apple
            Cash. Crypto: Bitcoin on Bitcoin Mainnet, Ethereum on Ethereum
            Mainnet, Tether (USDT) on Ethereum Mainnet (ERC-20), BNB on BNB
            Smart Chain Mainnet, and USDC on Ethereum Mainnet (ERC-20). Do not
            paste private keys, seed phrases, bank details, or card numbers.
          </p>
          <p className="portal-settings-note">
            Zelle and Apple Cash are public payment contact information. Type an
            email or U.S. mobile number yourself; these fields are never filled
            from your login. Confirm the recipient independently before sending.
            This marketplace does not execute, insure, escrow, reverse, or
            protect the transfer.
          </p>
        </div>
        <h3 id="payment-methods-title">Payment methods</h3>
        {MANUAL_PAYMENT_RAILS.map((rail) => (
          <div className="portal-settings-row" key={rail.id}>
            <div className="portal-settings-row-head">
              <strong>{rail.label}</strong>
              {paymentDrafts[rail.id] ? (
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() =>
                    setPaymentDrafts((current) => ({ ...current, [rail.id]: "" }))
                  }
                  disabled={pending !== null}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <label className="portal-field">
              <span>{rail.hint}</span>
              <input
                value={paymentDrafts[rail.id]}
                onChange={(event) =>
                  setPaymentDrafts((current) => ({
                    ...current,
                    [rail.id]: event.target.value,
                  }))
                }
                autoComplete="off"
                spellCheck={false}
                disabled={pending !== null}
              />
            </label>
          </div>
        ))}
        <h3 id="crypto-payment-title">Crypto</h3>
        {CRYPTO_PAYMENT_RAILS.map((rail) => (
          <div className="portal-settings-row" key={rail.id}>
            <div className="portal-settings-row-head">
              <strong>{rail.networkLabel ? `${rail.label} · ${rail.networkLabel}` : rail.label}</strong>
              {paymentDrafts[rail.id] ? (
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() =>
                    setPaymentDrafts((current) => ({ ...current, [rail.id]: "" }))
                  }
                  disabled={pending !== null}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <label className="portal-field">
              <span>{rail.hint}</span>
              <input
                value={paymentDrafts[rail.id]}
                onChange={(event) =>
                  setPaymentDrafts((current) => ({
                    ...current,
                    [rail.id]: event.target.value,
                  }))
                }
                autoComplete="off"
                spellCheck={false}
                disabled={pending !== null}
              />
            </label>
          </div>
        ))}
        <button
          className="button button-dark"
          type="submit"
          disabled={pending !== null}
        >
          {pending === "payment" ? "Saving…" : "Save payment options"}
        </button>
      </form>

      <div className="portal-signout">
        <button
          className="button button-ghost"
          type="button"
          onClick={onSignOut}
          disabled={pending !== null}
        >
          {pending === "signout" ? "Signing out…" : "Sign out"}
        </button>
      </div>

      <div className="portal-status" role="status" aria-live="polite">
        {status && <p className="auth-success">{status}</p>}
        {visibleError && <p className="auth-error">{visibleError}</p>}
      </div>
    </section>
  );
}
