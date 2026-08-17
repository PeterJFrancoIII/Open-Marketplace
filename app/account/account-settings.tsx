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
import { FACEBOOK_CONNECT_SCOPES } from "../../lib/facebook-listing-proof";
import {
  SOCIAL_CONNECTORS,
  type SocialConnection,
  type SocialConnectorId,
} from "../../lib/social-connectors";
import type {
  FacebookConnection,
  PayPalConnection,
  PaymentDestination,
  PaymentRail,
  SocialProof,
} from "../../lib/types";

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

function facebookOauthErrorSubscribe() {
  return () => {};
}

function readOauthError() {
  if (typeof window === "undefined") return "";
  const error = new URLSearchParams(window.location.search).get("error");
  if (!error) return "";
  if (error === "paypal") return "PayPal Link did not complete. Try again.";
  return "Social Connect did not complete. Try again.";
}

const emptyFacebookConnection: FacebookConnection = {
  available: false,
  connected: false,
  name: null,
  firstName: null,
  lastName: null,
  middleName: null,
  shortName: null,
  imageUrl: null,
  profileUrl: null,
};

const emptyPayPalConnection: PayPalConnection = {
  available: false,
  connected: false,
  email: null,
};

export default function AccountSettings({
  initialName,
  email,
  initialSocialAccounts: _initialSocialAccounts,
  initialPaymentDestinations,
  initialShippingBrokers,
  initialFacebookConnection,
  initialSocialConnections,
  initialPayPalConnection,
}: {
  initialName: string;
  email: string;
  initialSocialAccounts: SocialProof[];
  initialPaymentDestinations: PaymentDestination[];
  initialShippingBrokers: ShippingBrokerConnection[];
  initialFacebookConnection: FacebookConnection;
  initialSocialConnections?: SocialConnection[];
  initialPayPalConnection: PayPalConnection;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [paymentDrafts, setPaymentDrafts] = useState(() =>
    destinationsByRail(initialPaymentDestinations),
  );
  const [shippingDrafts, setShippingDrafts] = useState(() =>
    brokersById(initialShippingBrokers),
  );
  const [facebookConnection, setFacebookConnection] = useState(
    initialFacebookConnection ?? emptyFacebookConnection,
  );
  const [socialConnections, setSocialConnections] = useState<SocialConnection[]>(
    initialSocialConnections ?? [],
  );
  const [paypalConnection, setPaypalConnection] = useState(
    initialPayPalConnection ?? emptyPayPalConnection,
  );
  const [pending, setPending] = useState<string | null>(null);
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
    readOauthError,
    () => "",
  );
  const visibleError = error || oauthError;
  void _initialSocialAccounts;

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

  async function saveProfile(body: Record<string, unknown>) {
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
      socialConnections?: SocialConnection[];
      paypalConnection?: PayPalConnection;
    };
    if (result.facebookConnection) {
      setFacebookConnection(result.facebookConnection);
    }
    if (result.socialConnections) {
      setSocialConnections(result.socialConnections);
    }
    if (result.paypalConnection) {
      setPaypalConnection(result.paypalConnection);
    }
    if (response.status === 401) {
      window.location.assign("/login?returnTo=%2Faccount");
      return null;
    }
    if (!response.ok) {
      throw new Error(result.error ?? "Could not save settings.");
    }
    return result;
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

  function connectionFor(id: SocialConnectorId): SocialConnection | undefined {
    return socialConnections.find((connection) => connection.id === id);
  }

  async function onConnectSocial(id: SocialConnectorId) {
    const connector = SOCIAL_CONNECTORS.find((item) => item.id === id);
    setPending(`${id}-connect`);
    setStatus("");
    setError("");
    try {
      const result = await authClient.linkSocial({
        provider: id,
        callbackURL: "/account/settings",
        errorCallbackURL: "/account/settings",
        scopes:
          id === "facebook"
            ? [...FACEBOOK_CONNECT_SCOPES]
            : [...(connector?.scopes ?? [])],
      });
      if (result.error) {
        setError(
          normalizeAuthError(
            result.error,
            `Could not start ${connector?.label ?? id} Connect.`,
          ),
        );
        return;
      }
    } catch (submitError) {
      setError(
        normalizeAuthError(
          submitError,
          `Could not start ${connector?.label ?? id} Connect.`,
        ),
      );
    } finally {
      setPending(null);
    }
  }

  async function onDisconnectSocial(id: SocialConnectorId) {
    const connector = SOCIAL_CONNECTORS.find((item) => item.id === id);
    setPending(`${id}-disconnect`);
    setStatus("");
    setError("");
    try {
      const result = await authClient.unlinkAccount({
        providerId: id,
      });
      if (result.error) {
        setError(
          normalizeAuthError(
            result.error,
            `Could not disconnect ${connector?.label ?? id}.`,
          ),
        );
        return;
      }
      if (id === "facebook") {
        setFacebookConnection({
          available: facebookConnection.available,
          connected: false,
          name: null,
          firstName: null,
          lastName: null,
          middleName: null,
          shortName: null,
          imageUrl: null,
          profileUrl: null,
        });
      }
      setSocialConnections((current) =>
        current.map((connection) =>
          connection.id === id
            ? {
                ...connection,
                connected: false,
                name: null,
                handle: null,
                imageUrl: null,
                profileUrl: null,
                accountCreatedAt: null,
                connectionCount: null,
              }
            : connection,
        ),
      );
      setStatus(
        `${connector?.label ?? id} disconnected. Your Open Marketplace account is unchanged.`,
      );
      router.refresh();
    } catch (submitError) {
      setError(
        normalizeAuthError(
          submitError,
          `Could not disconnect ${connector?.label ?? id}.`,
        ),
      );
    } finally {
      setPending(null);
    }
  }

  async function onConnectPayPal() {
    setPending("paypal-connect");
    setStatus("");
    setError("");
    window.location.assign("/api/paypal/connect");
  }

  async function onDisconnectPayPal() {
    setPending("paypal-disconnect");
    setStatus("");
    setError("");
    try {
      const response = await fetch("/api/paypal/disconnect", {
        method: "POST",
        headers: { accept: "application/json" },
      });
      const result = (await response.json()) as {
        error?: string;
        paypalConnection?: PayPalConnection;
      };
      if (response.status === 401) {
        window.location.assign("/login?returnTo=%2Faccount");
        return;
      }
      if (!response.ok) {
        setError(result.error ?? "Could not disconnect PayPal.");
        return;
      }
      setPaypalConnection(
        result.paypalConnection ?? {
          available: paypalConnection.available,
          connected: false,
          email: null,
        },
      );
      setPaymentDrafts((current) => ({ ...current, paypal: "" }));
      setStatus("PayPal disconnected. Your Open Marketplace account is unchanged.");
      router.refresh();
    } catch (submitError) {
      setError(
        normalizeAuthError(submitError, "Could not disconnect PayPal."),
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
        id="social-media-settings"
        aria-labelledby="social-media-title"
      >
        <div>
          <h3 id="social-media-title">Social media</h3>
          <p className="portal-lead">
            Social profiles can only be added with official Connect. Typed usernames
            and pasted links are not accepted, so a seller cannot spoof a profile
            they do not control. Each official link can raise Social Credit.
          </p>
        </div>
        {SOCIAL_CONNECTORS.map((connector) => {
          const saved = connectionFor(connector.id);
          const facebook = connector.id === "facebook" ? facebookConnection : null;
          const available = facebook ? facebook.available : Boolean(saved?.available);
          const connected = facebook ? facebook.connected : Boolean(saved?.connected);
          const name = facebook ? facebook.name : saved?.name;
          const imageUrl = facebook ? facebook.imageUrl : saved?.imageUrl;
          const profileUrl = facebook ? facebook.profileUrl : saved?.profileUrl;
          return (
            <div
              className="portal-settings-row"
              id={
                connector.id === "facebook"
                  ? "facebook-connect-settings"
                  : `${connector.id}-connect-settings`
              }
              aria-labelledby={`${connector.id}-connect-title`}
              key={connector.id}
            >
              <div className="portal-settings-row-head">
                <strong id={`${connector.id}-connect-title`}>{connector.label}</strong>
                {connected ? (
                  <span className="portal-settings-health">Connected</span>
                ) : null}
              </div>
              {connector.id === "facebook" ? (
                <p className="portal-settings-note">
                  Connect Facebook to prove you control the account. This uses
                  consumer Facebook Login with public_profile and user_link.
                  Facebook Login fills the public profile URL when Facebook sends
                  one. Those values stay on the Facebook connector and do not
                  replace your Open Marketplace email or name. It does not sign you in,
                  import listings, or make you Facebook verified.
                </p>
              ) : (
                <p className="portal-settings-note">
                  Connect {connector.label} to prove you control the account.
                  Only fields that {connector.label} returns after Connect are
                  stored. A typed {connector.label} URL cannot be saved. It does
                  not sign you in or import listings.
                </p>
              )}
              {connected ? (
                <>
                  <div className="portal-connector-identity">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt="" width={48} height={48} />
                    ) : null}
                    <p>
                      {name
                        ? name
                        : `${connector.label} account connected.`}
                    </p>
                  </div>
                  <div className="portal-connector-actions">
                    {profileUrl ? (
                      <a
                        className="button button-ghost"
                        href={profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {connector.id === "facebook"
                          ? "Open Facebook profile"
                          : `Open ${connector.label} profile`}
                      </a>
                    ) : null}
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={() => void onDisconnectSocial(connector.id)}
                      disabled={pending !== null}
                    >
                      {pending === `${connector.id}-disconnect`
                        ? "Disconnecting…"
                        : "Disconnect"}
                    </button>
                  </div>
                </>
              ) : available ? (
                <div className="portal-connector-actions">
                  <button
                    className="button button-dark"
                    type="button"
                    onClick={() => void onConnectSocial(connector.id)}
                    disabled={pending !== null}
                  >
                    {pending === `${connector.id}-connect`
                      ? "Connecting…"
                      : `Connect ${connector.label}`}
                  </button>
                </div>
              ) : connector.id === "facebook" ? (
                <p className="portal-settings-note">
                  Facebook Login is not available on this copy of the site.
                </p>
              ) : (
                <p className="portal-settings-note">
                  Connect {connector.label} is not available on this copy of the site yet. A typed {connector.label} URL cannot be saved.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <form
        className="portal-form"
        id="payment-options-settings"
        onSubmit={onSavePayments}
        aria-labelledby="payment-options-title"
      >
        <div>
          <h3 id="payment-options-title">Payment options</h3>
          <p className="portal-lead">
            Link PayPal with official PayPal Login to fill your public pay-to
            email. Venmo, Cash App, Zelle, Apple Cash, Bitcoin on Bitcoin
            Mainnet, Ethereum on Ethereum Mainnet, Tether (USDT) on Ethereum
            Mainnet (ERC-20), BNB on BNB Smart Chain Mainnet, and USDC on
            Ethereum Mainnet (ERC-20) stay typed public contacts. These are
            connectors to the official apps, not a checkout.
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
              {rail.id === "paypal" && paypalConnection.connected ? (
                <span className="portal-settings-health">Linked</span>
              ) : paymentDrafts[rail.id] ? (
                <span className="portal-settings-health">Saved</span>
              ) : rail.id === "paypal" ? (
                <span className="portal-settings-health">Not linked</span>
              ) : null}
            </div>
            {rail.id === "paypal" ? (
              <p className="portal-settings-note">
                PayPal Link uses official Log in with PayPal and the email
                scope only. It fills this public pay-to contact. It does not
                sign you in, take payments, or hold money.
                {!paypalConnection.available && !paypalConnection.connected
                  ? " PayPal Login is not available on this copy of the site, so you can still save a public PayPal email or paypal.me link."
                  : ""}
              </p>
            ) : null}
            <label className="portal-field">
              <span>{rail.hint}</span>
              <input
                value={
                  rail.id === "paypal" && paypalConnection.connected
                    ? paypalConnection.email ?? paymentDrafts.paypal
                    : paymentDrafts[rail.id]
                }
                onChange={(event) =>
                  setPaymentDrafts((current) => ({
                    ...current,
                    [rail.id]: event.target.value,
                  }))
                }
                autoComplete="off"
                spellCheck={false}
                disabled={
                  pending !== null ||
                  (rail.id === "paypal" && paypalConnection.connected)
                }
              />
            </label>
            <div className="portal-connector-actions">
              {rail.id === "paypal" && paypalConnection.connected ? (
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() => void onDisconnectPayPal()}
                  disabled={pending !== null}
                >
                  {pending === "paypal-disconnect"
                    ? "Disconnecting…"
                    : "Disconnect PayPal"}
                </button>
              ) : rail.id === "paypal" && paypalConnection.available ? (
                <button
                  className="button button-dark"
                  type="button"
                  onClick={onConnectPayPal}
                  disabled={pending !== null}
                >
                  {pending === "paypal-connect" ? "Connecting…" : "Link PayPal"}
                </button>
              ) : null}
              <a
                className="button button-ghost"
                href={rail.connectUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open {rail.label}
              </a>
              {paymentDrafts[rail.id] &&
              !(rail.id === "paypal" && paypalConnection.connected) ? (
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
            Host {replicaStatus.hostId || "open-marketplace-first-public-database-host"} ·{" "}
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
