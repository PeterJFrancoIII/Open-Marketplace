"use client";

import { type FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "../../lib/auth-client";
import {
  parseMediaNodeOrigin,
  probeMediaNode,
  readMediaNodeConfig,
  writeMediaNodeConfig,
} from "../../lib/media-node";
import {
  fetchReplicaStatus,
  replicaStatusSummary,
  type ReplicaStatus,
} from "../../lib/replica-host";
import { PAYMENT_RAILS } from "../../lib/payment-destinations";
import {
  SHIPPING_BROKERS,
  type ShippingBrokerConnection,
  type ShippingBrokerId,
} from "../../lib/shipping-brokers";
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

function brokersById(brokers: ShippingBrokerConnection[]) {
  return Object.fromEntries(
    SHIPPING_BROKERS.map((broker) => {
      const saved = brokers.find((item) => item.id === broker.id);
      return [
        broker.id,
        {
          connected: Boolean(saved),
          account: saved?.account ?? "",
        },
      ];
    }),
  ) as Record<ShippingBrokerId, { connected: boolean; account: string }>;
}

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
  initialShippingBrokers,
  initialFacebookConnection,
}: {
  initialName: string;
  email: string;
  initialSocialAccounts: SocialProof[];
  initialPaymentDestinations: PaymentDestination[];
  initialShippingBrokers: ShippingBrokerConnection[];
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
  const [shippingDrafts, setShippingDrafts] = useState(() =>
    brokersById(initialShippingBrokers),
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
    | "shipping"
    | "facebook-connect"
    | "facebook-disconnect"
    | "media-node"
    | null
  >(null);
  const [mediaNodeOrigin, setMediaNodeOrigin] = useState(
    () => readMediaNodeConfig()?.origin ?? "",
  );
  const [mediaNodeToken, setMediaNodeToken] = useState(
    () => readMediaNodeConfig()?.writeToken ?? "",
  );
  const [replicaStatus, setReplicaStatus] = useState<ReplicaStatus | null>(null);
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

  async function saveProfile(
    body: Record<string, unknown>,
    kind: "social" | "payment" | "shipping",
  ) {
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
      shippingBrokers?: ShippingBrokerConnection[];
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

  async function onSaveShipping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("shipping");
    setStatus("");
    setError("");
    try {
      const result = await saveProfile(
        {
          shippingBrokers: SHIPPING_BROKERS.flatMap((broker) => {
            const draft = shippingDrafts[broker.id];
            return draft.connected
              ? [{ id: broker.id, account: draft.account.trim() || null }]
              : [];
          }),
        },
        "shipping",
      );
      if (!result) return;
      setShippingDrafts(brokersById(result.shippingBrokers ?? []));
      setStatus(
        "Shipping connectors saved. These open official calculators. They are not a booking.",
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save shipping connectors.",
      );
    } finally {
      setPending(null);
    }
  }

  async function onSaveMediaNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("media-node");
    setStatus("");
    setError("");
    try {
      const origin = mediaNodeOrigin.trim();
      if (!origin) {
        writeMediaNodeConfig(null);
        setMediaNodeToken("");
        setReplicaStatus(null);
        setStatus("First database host disconnected on this device.");
        return;
      }
      const parsed = parseMediaNodeOrigin(origin);
      if (!parsed) {
        setError(
          "Use an https origin for the Synology host, or http://localhost for local testing.",
        );
        return;
      }
      writeMediaNodeConfig({ origin: parsed, writeToken: mediaNodeToken });
      setMediaNodeOrigin(parsed);
      setStatus(
        "First database host saved on this device. Public listings, public seller profiles, and listing photos are copied there. Passwords and Facebook tokens are not. The public registry still stores hashes, not photo bytes.",
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save the first database host.",
      );
    } finally {
      setPending(null);
    }
  }

  async function onProbeMediaNode() {
    setPending("media-node");
    setStatus("");
    setError("");
    try {
      const parsed = parseMediaNodeOrigin(mediaNodeOrigin);
      if (!parsed) {
        setError(
          "Use an https origin for the Synology host, or http://localhost for local testing.",
        );
        return;
      }
      const ok = await probeMediaNode(parsed);
      if (!ok) {
        setError(
          "The host did not answer as a full replica. Check HTTPS, CORS, and that the Arch Linux container is running.",
        );
        return;
      }
      const replica = await fetchReplicaStatus(parsed).catch(() => null);
      setReplicaStatus(replica);
      setStatus(
        replica
          ? `First database host is reachable. ${replicaStatusSummary(replica)}`
          : "First database host is reachable from this browser.",
      );
    } catch {
      setError(
        "This browser could not reach the host. The live preview needs an https origin.",
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
        firstName: null,
        lastName: null,
        middleName: null,
        shortName: null,
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
        Update your display name, password, and connectors. Email stays
        read-only until verification delivery is available.
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
            name, middle name, short name, and a large profile photo. Those
            values stay on the Facebook connector and do not replace your Open
            Marketplace email or name. Address, date of birth, phone, and email
            are not available from
            Facebook Login. It does not sign you in, import listings, or make
            you Facebook verified.
          </p>
        </div>
        <div className="portal-settings-row">
          <div className="portal-settings-row-head">
            <strong>Facebook Login</strong>
            {facebookConnection.connected ? (
              <span className="portal-settings-health">Connected</span>
            ) : null}
          </div>
          {facebookConnection.connected ? (
            <>
              <div className="portal-connector-identity">
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
              </div>
              <div className="portal-connector-actions">
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
              </div>
            </>
          ) : facebookConnection.available ? (
            <div className="portal-connector-actions">
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
            </div>
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
            Connect public pay-to destinations for PayPal, Venmo, Cash App,
            Zelle, Apple Cash, Bitcoin on Bitcoin Mainnet, Ethereum on Ethereum
            Mainnet, Tether (USDT) on Ethereum Mainnet (ERC-20), BNB on BNB
            Smart Chain Mainnet, and USDC on Ethereum Mainnet (ERC-20). These
            are connectors to the official apps, not a checkout.
          </p>
          <p className="portal-settings-note">
            Zelle and Apple Cash are public payment contact information. Type an
            email or U.S. mobile number yourself; these fields are never filled
            from your login. Confirm the recipient independently before sending.
            This marketplace does not execute, insure, escrow, reverse, or
            protect the transfer. Do not paste private keys, seed phrases, bank
            details, or card numbers.
          </p>
        </div>
        {MANUAL_PAYMENT_RAILS.map((rail) => (
          <div className="portal-settings-row" key={rail.id}>
            <div className="portal-settings-row-head">
              <strong>{rail.label}</strong>
              {paymentDrafts[rail.id] ? (
                <span className="portal-settings-health">Connected</span>
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
            <div className="portal-connector-actions">
              <a
                className="button button-ghost"
                href={rail.connectUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open {rail.label}
              </a>
              {paymentDrafts[rail.id] ? (
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() =>
                    setPaymentDrafts((current) => ({ ...current, [rail.id]: "" }))
                  }
                  disabled={pending !== null}
                >
                  Disconnect
                </button>
              ) : null}
            </div>
          </div>
        ))}
        <h3 id="crypto-payment-title">Crypto</h3>
        {CRYPTO_PAYMENT_RAILS.map((rail) => (
          <div className="portal-settings-row" key={rail.id}>
            <div className="portal-settings-row-head">
              <strong>{rail.networkLabel ? `${rail.label} · ${rail.networkLabel}` : rail.label}</strong>
              {paymentDrafts[rail.id] ? (
                <span className="portal-settings-health">Connected</span>
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
            <div className="portal-connector-actions">
              <a
                className="button button-ghost"
                href={rail.connectUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open {rail.label}
              </a>
              {paymentDrafts[rail.id] ? (
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() =>
                    setPaymentDrafts((current) => ({ ...current, [rail.id]: "" }))
                  }
                  disabled={pending !== null}
                >
                  Disconnect
                </button>
              ) : null}
            </div>
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

      <form
        className="portal-form"
        id="shipping-broker-settings"
        onSubmit={onSaveShipping}
        aria-labelledby="shipping-brokers-title"
      >
        <div>
          <h3 id="shipping-brokers-title">Shipping connectors</h3>
          <p className="portal-lead">
            Connect the official shipping brokers you use. Each button opens
            that broker’s own site. The marketplace does not buy postage, book
            a label, or hold a shipment.
          </p>
        </div>
        {SHIPPING_BROKERS.map((broker) => (
          <div className="portal-settings-row" key={broker.id}>
            <div className="portal-settings-row-head">
              <strong>{broker.label}</strong>
              {shippingDrafts[broker.id].connected ? (
                <span className="portal-settings-health">Connected</span>
              ) : null}
            </div>
            <p className="portal-settings-note">{broker.hint}</p>
            {broker.id === "parcel_monkey" && shippingDrafts[broker.id].connected ? (
              <label className="portal-field">
                <span>Public Parcel Monkey account email, optional</span>
                <input
                  type="email"
                  value={shippingDrafts[broker.id].account}
                  onChange={(event) =>
                    setShippingDrafts((current) => ({
                      ...current,
                      [broker.id]: {
                        ...current[broker.id],
                        account: event.target.value,
                      },
                    }))
                  }
                  autoComplete="off"
                  disabled={pending !== null}
                />
              </label>
            ) : null}
            <div className="portal-connector-actions">
              <a
                className="button button-ghost"
                href={broker.href}
                target="_blank"
                rel="noreferrer"
              >
                Open {broker.label}
              </a>
              {shippingDrafts[broker.id].connected ? (
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() =>
                    setShippingDrafts((current) => ({
                      ...current,
                      [broker.id]: { connected: false, account: "" },
                    }))
                  }
                  disabled={pending !== null}
                >
                  Disconnect
                </button>
              ) : (
                <button
                  className="button button-dark"
                  type="button"
                  onClick={() =>
                    setShippingDrafts((current) => ({
                      ...current,
                      [broker.id]: { ...current[broker.id], connected: true },
                    }))
                  }
                  disabled={pending !== null}
                >
                  Connect {broker.label}
                </button>
              )}
            </div>
          </div>
        ))}
        <button
          className="button button-dark"
          type="submit"
          disabled={pending !== null}
        >
          {pending === "shipping" ? "Saving…" : "Save shipping connectors"}
        </button>
      </form>

      <form
        className="portal-form"
        id="first-database-host-settings"
        onSubmit={onSaveMediaNode}
        aria-labelledby="first-database-host-title"
      >
        <div>
          <h3 id="first-database-host-title">First database host</h3>
          <p className="portal-lead">
            Your Synology Arch Linux container is the first full host of the
            public marketplace database: listings, public seller profiles, and
            listing photos. Run <code>hosting-node/</code>, put HTTPS in front
            of it, then save that origin here. Passwords and Facebook tokens
            stay off this host. The write token is stored only in this browser.
            Until three hosts are online, every host keeps a complete copy.
            After that, Main can issue a scale-down decree that shrinks each
            host only while at least three duplicates remain.
          </p>
        </div>
        <label className="portal-field">
          <span>Host origin</span>
          <input
            type="url"
            name="mediaNodeOrigin"
            placeholder="https://host.your-nas.example"
            value={mediaNodeOrigin}
            onChange={(event) => setMediaNodeOrigin(event.target.value)}
            disabled={pending !== null}
          />
        </label>
        <label className="portal-field">
          <span>Write token</span>
          <input
            type="password"
            name="mediaNodeToken"
            autoComplete="off"
            value={mediaNodeToken}
            onChange={(event) => setMediaNodeToken(event.target.value)}
            disabled={pending !== null}
          />
        </label>
        {replicaStatus && (
          <p className="portal-lead">
            Host {replicaStatus.hostId || "synology-nas-001"} ·{" "}
            {replicaStatus.hostCount} live host
            {replicaStatus.hostCount === 1 ? "" : "s"} · minimum{" "}
            {replicaStatus.minReplicas} copies · mode {replicaStatus.mode}
            {replicaStatus.counts
              ? ` · ${replicaStatus.counts.listing ?? 0} listings, ${replicaStatus.counts.profile ?? 0} profiles, ${replicaStatus.counts.media ?? 0} photos`
              : ""}
          </p>
        )}
        <div className="portal-connector-actions">
          <button
            className="button button-ghost"
            type="button"
            onClick={() => void onProbeMediaNode()}
            disabled={pending !== null}
          >
            Test connection
          </button>
          <button
            className="button button-dark"
            type="submit"
            disabled={pending !== null}
          >
            {pending === "media-node" ? "Saving…" : "Save first database host"}
          </button>
        </div>
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
