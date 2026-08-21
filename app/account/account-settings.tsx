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
import { emptyPayPalConnection, PAYPAL_ME_SETUP_URL } from "../../lib/paypal-public";
import {
  SHIPPING_BROKERS,
  type ShippingBrokerConnection,
  type ShippingBrokerId,
} from "../../lib/shipping-brokers";
import { FACEBOOK_CONNECT_SCOPES } from "../../lib/facebook-listing-proof";
import {
  officialConnectorDisplay,
  officialConnectorSummary,
  factsFromFacebookConnection,
  factsFromPaypalConnection,
} from "../../lib/official-connector-facts";
import {
  SOCIAL_CONNECTORS,
  TIKTOK_CONNECT_SCOPES,
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
  if (error === "paypal" || error === "paypal-session" || error === "paypal-state") {
    return "Log in with PayPal did not finish coming back to Open Marketplace. Click Log in with PayPal again, then continue on PayPal until this page reloads.";
  }
  if (error === "paypal-token") {
    return "PayPal signed you in, but Open Marketplace could not save the connection. Click Log in with PayPal again.";
  }
  return "Social Connect did not complete. Try again.";
}

function paypalLastReturnMessage(lastReturn?: string | null) {
  if (lastReturn === "started") {
    return "PayPal opened. This page stays Not connected until PayPal sends you back here. Stay on PayPal until this Account settings page reloads.";
  }
  if (
    lastReturn === "paypal" ||
    lastReturn === "paypal-session" ||
    lastReturn === "paypal-state"
  ) {
    return "Log in with PayPal did not finish coming back to Open Marketplace. Click Log in with PayPal again, then continue on PayPal until this page reloads.";
  }
  if (lastReturn === "paypal-token") {
    return "PayPal signed you in, but Open Marketplace could not save the connection. Click Log in with PayPal again.";
  }
  return "";
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
  about: null,
  location: null,
  hometown: null,
  websiteUrl: null,
  locale: null,
  gender: null,
  ageRange: null,
  coverUrl: null,
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
    initialPayPalConnection ?? emptyPayPalConnection(),
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
  const visibleError =
    error ||
    oauthError ||
    (!paypalConnection.connected
      ? paypalLastReturnMessage(paypalConnection.lastReturn)
      : "");
  void _initialSocialAccounts;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paypal") === "linked" || params.get("paypalme") === "setup") {
      const needsPaypalMe = params.get("paypalme") === "setup";
      params.delete("paypal");
      params.delete("paypalme");
      const next = `${window.location.pathname}${
        params.toString() ? `?${params.toString()}` : ""
      }#surface-paypal-input`;
      window.history.replaceState(null, "", next);
      void (async () => {
        try {
          const response = await fetch("/api/account/profile", {
            headers: { accept: "application/json" },
          });
          const result = (await response.json()) as {
            paypalConnection?: PayPalConnection;
            paymentDestinations?: PaymentDestination[];
          };
          if (result.paypalConnection) {
            setPaypalConnection(result.paypalConnection);
          }
          if (result.paymentDestinations) {
            setPaymentDrafts(destinationsByRail(result.paymentDestinations));
          }
          const filled = result.paypalConnection?.paypalMe
            ? `https://www.paypal.me/${result.paypalConnection.paypalMe}`
            : result.paypalConnection?.email || "";
          if (filled) {
            setPaymentDrafts((current) => ({
              ...current,
              paypal: current.paypal || filled,
            }));
          }
        } catch {
          /* The server-rendered PayPal connection still applies. */
        }
      })();
      setStatus(
        needsPaypalMe
          ? "PayPal is linked. Open paypal.me to create or copy your link, then save it here so buyers can pay you."
          : "PayPal is linked. Your PayPal pay-to is in the PayPal field.",
      );
      if (needsPaypalMe) {
        window.open(PAYPAL_ME_SETUP_URL, "_blank", "noopener,noreferrer");
      }
      return;
    }
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

  function paymentDestinationPayload() {
    return PAYMENT_RAILS.flatMap((rail) => {
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
    });
  }

  async function onSavePayments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("payment");
    setStatus("");
    setError("");
    try {
      const result = await saveProfile(
        {
          paymentDestinations: paymentDestinationPayload(),
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
            : id === "tiktok"
              ? [...TIKTOK_CONNECT_SCOPES]
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
          about: null,
          location: null,
          hometown: null,
          websiteUrl: null,
          locale: null,
          gender: null,
          ageRange: null,
          coverUrl: null,
        });
      }
      setSocialConnections((current) =>
        current.map((connection) =>
          connection.id === id
            ? {
                ...connection,
                connected: false,
                needsReconnect: false,
                name: null,
                handle: null,
                imageUrl: null,
                profileUrl: null,
                bio: null,
                location: null,
                websiteUrl: null,
                bannerUrl: null,
                locale: null,
                accountType: null,
                accountCreatedAt: null,
                connectionCount: null,
                followingCount: null,
                likesCount: null,
                contentCount: null,
                listedCount: null,
                providerVerified: false,
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

  async function onConnectPayment(railId: PaymentRail) {
    const rail = PAYMENT_RAILS.find((item) => item.id === railId);
    const label = rail?.label ?? "payment";
    setPending(`${railId}-connect`);
    setStatus("");
    setError("");
    if (railId === "paypal") {
      if (!paypalConnection.available) {
        setError(
          "Log in with PayPal is not available on this copy of the site yet.",
        );
        setPending(null);
        return;
      }
      window.location.assign("/api/paypal/connect");
      return;
    }
    const destination = paymentDrafts[railId].trim();
    if (!destination) {
      setError(
        `Enter your public ${label} destination, then click Connect ${label}.`,
      );
      setPending(null);
      return;
    }
    try {
      const result = await saveProfile({
        paymentDestinations: paymentDestinationPayload(),
      });
      if (!result) return;
      setPaymentDrafts(destinationsByRail(result.paymentDestinations ?? []));
      setStatus(
        `${label} connected. Buyers will see this public pay-to. This does not sign you in or take payments.`,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : `Could not connect ${label}.`,
      );
    } finally {
      setPending(null);
    }
  }

  async function onDisconnectPayment(railId: PaymentRail) {
    if (railId === "paypal") {
      await onDisconnectPayPal();
      return;
    }
    const rail = PAYMENT_RAILS.find((item) => item.id === railId);
    const label = rail?.label ?? "payment";
    setPending(`${railId}-disconnect`);
    setStatus("");
    setError("");
    try {
      const result = await saveProfile({
        paymentDestinations: PAYMENT_RAILS.flatMap((item) => {
          const destination =
            item.id === railId ? "" : paymentDrafts[item.id].trim();
          return destination
            ? [
                {
                  rail: item.id,
                  destination,
                  asset: item.asset,
                  networkId: item.networkId,
                  networkLabel: item.networkLabel,
                },
              ]
            : [];
        }),
      });
      if (!result) return;
      setPaymentDrafts(destinationsByRail(result.paymentDestinations ?? []));
      setStatus(`${label} disconnected.`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : `Could not disconnect ${label}.`,
      );
    } finally {
      setPending(null);
    }
  }

  async function onSavePaypalMe() {
    setPending("paypal-paypalme");
    setStatus("");
    setError("");
    try {
      const response = await fetch("/api/paypal/destination", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ destination: paymentDrafts.paypal }),
      });
      const result = (await response.json()) as {
        error?: string;
        paypalConnection?: PayPalConnection;
        paymentDestinations?: PaymentDestination[];
      };
      if (response.status === 401) {
        window.location.assign("/login?returnTo=%2Faccount");
        return;
      }
      if (!response.ok) {
        setError(result.error ?? "Could not save your paypal.me.");
        return;
      }
      if (result.paypalConnection) {
        setPaypalConnection(result.paypalConnection);
      }
      setPaymentDrafts(destinationsByRail(result.paymentDestinations ?? []));
      setStatus("paypal.me saved. Stay connected so buyers can trust this pay-to.");
      router.refresh();
    } catch (submitError) {
      setError(normalizeAuthError(submitError, "Could not save your paypal.me."));
    } finally {
      setPending(null);
    }
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
        paymentDestinations?: PaymentDestination[];
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
        result.paypalConnection ?? emptyPayPalConnection(paypalConnection.available),
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

  const officialPaypal = officialConnectorDisplay(
    factsFromPaypalConnection(paypalConnection),
  );

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
        <label className="portal-field" data-feedback-surface="Display name input">
          <span>Display name</span>
          <input
            name="name"
            autoComplete="name"
            aria-label="Display name"
            data-feedback-surface="Display name input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={80}
            disabled={pending !== null}
          />
        </label>
        <label className="portal-field" data-feedback-surface="Email input">
          <span>Email</span>
          <input
            type="email"
            name="email"
            aria-label="Email"
            data-feedback-surface="Email input"
            value={email}
            readOnly
            aria-readonly="true"
          />
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
        <label className="portal-field" data-feedback-surface="Current password input">
          <span>Current password</span>
          <input
            type="password"
            name="currentPassword"
            aria-label="Current password"
            data-feedback-surface="Current password input"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            minLength={12}
            maxLength={128}
            disabled={pending !== null}
          />
        </label>
        <label className="portal-field" data-feedback-surface="New password input">
          <span>New password</span>
          <input
            type="password"
            name="newPassword"
            aria-label="New password"
            data-feedback-surface="New password input"
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
            they do not control. Official fields are the first line of defense
            before verified buys and sells exist. The more official data a
            connection returns, the higher Social Credit can go.
          </p>
        </div>
        {SOCIAL_CONNECTORS.map((connector) => {
          const saved = connectionFor(connector.id);
          const facebook = connector.id === "facebook" ? facebookConnection : null;
          const available = facebook ? facebook.available : Boolean(saved?.available);
          const connected = facebook ? facebook.connected : Boolean(saved?.connected);
          const needsReconnect =
            connector.id === "tiktok" && Boolean(saved?.needsReconnect);
          const profileUrl = facebook ? facebook.profileUrl : saved?.profileUrl;
          const official = officialConnectorDisplay(
            facebook
              ? factsFromFacebookConnection(facebook)
              : {
                  name: saved?.name,
                  handle: saved?.handle,
                  profileUrl: saved?.profileUrl,
                  imageUrl: saved?.imageUrl,
                  bannerUrl: saved?.bannerUrl,
                  bio: saved?.bio,
                  location: saved?.location,
                  websiteUrl: saved?.websiteUrl,
                  locale: saved?.locale,
                  accountType: saved?.accountType,
                  accountCreatedAt: saved?.accountCreatedAt,
                  connectionCount: saved?.connectionCount,
                  followingCount: saved?.followingCount,
                  likesCount: saved?.likesCount,
                  contentCount: saved?.contentCount,
                  listedCount: saved?.listedCount,
                  connectionLabel: saved?.connectionLabel,
                  providerVerified: saved?.providerVerified,
                },
          );
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
                ) : needsReconnect ? (
                  <span className="portal-settings-health">Needs reconnect</span>
                ) : null}
              </div>
              {connector.id === "facebook" ? (
                <p className="portal-settings-note">
                  Connect Facebook to prove you control the account. Facebook
                  currently sends name, profile photo, profile link, hometown,
                  and current city after public_profile, user_link,
                  user_hometown, and user_location. Facebook no longer gives
                  apps a bio, cover photo, locale, website, friends list, or
                  work and education. Gender and age range need extra Facebook
                  permissions that this app does not request. Those values stay
                  on the Facebook connector and do not replace your Open
                  Marketplace email or name. Buyers see these same official
                  Facebook fields on your listings, and a seller sees the
                  buyer’s official connectors in Messages. It does not sign you in,
                  import listings, or make you Facebook verified.
                </p>
              ) : connector.id === "tiktok" ? (
                <p className="portal-settings-note">
                  Connect TikTok to prove you control the account. This uses
                  TikTok Login Kit with user.info.basic, user.info.profile, and
                  user.info.stats.                   The display name, username, profile link, avatar,
                  bio, follower count, following count, likes, video count, and
                  TikTok verified mark TikTok returns stay on this connector and
                  can raise Social Credit. They do not replace your Open
                  Marketplace email or name.
                  A typed TikTok URL cannot be saved. It does not sign you in,
                  import videos, read messages, or make you TikTok verified.
                </p>
              ) : connector.id === "instagram" ? (
                <p className="portal-settings-note">
                  Connect Instagram to prove you control the account. This uses
                  Instagram Login with instagram_business_basic. The username,
                  name, avatar, account type, and public counts Instagram returns
                  stay on this connector and can raise Social Credit. They do
                  not replace your Open Marketplace email or name. A typed
                  Instagram URL cannot be saved. It does not sign you in, import
                  posts, read messages, or make you Instagram verified.
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
                    {official.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={official.imageUrl} alt="" width={48} height={48} />
                    ) : null}
                    <div>
                      <p>
                        {official.headline
                          ? official.headline
                          : `${connector.label} account connected.`}
                        {officialConnectorSummary(official)
                          ? ` · ${officialConnectorSummary(official)}`
                          : ""}
                      </p>
                      {official.bio ? (
                        <p className="portal-settings-note">{official.bio}</p>
                      ) : null}
                      {official.websiteUrl ? (
                        <p className="portal-settings-note">{official.websiteUrl}</p>
                      ) : null}
                      {official.bannerUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className="portal-connector-banner"
                          src={official.bannerUrl}
                          alt=""
                          width={160}
                          height={48}
                        />
                      ) : null}
                      {official.providerVerified ? (
                        <p className="portal-settings-note">
                          {connector.label} shows its own verified mark on this
                          account. That is not an Open Marketplace verification
                          badge.
                        </p>
                      ) : null}
                    </div>
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
              ) : needsReconnect ? (
                <div className="portal-connector-actions">
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
                  <button
                    className="button button-dark"
                    type="button"
                    onClick={() => void onConnectSocial(connector.id)}
                    disabled={pending !== null}
                  >
                    {pending === `${connector.id}-connect`
                      ? "Connecting…"
                      : "Connect TikTok"}
                  </button>
                </div>
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
            Connect PayPal saves your personal paypal.me link or PayPal email.
            It is not a business PayPal account and does not use PayPal
            Business Login. Venmo, Cash App, Zelle, Apple Cash,
            Bitcoin on Bitcoin Mainnet, Ethereum on Ethereum Mainnet, Tether
            (USDT) on Ethereum Mainnet (ERC-20), BNB on BNB Smart Chain
            Mainnet, and USDC on Ethereum Mainnet (ERC-20) stay typed public
            contacts. These are connectors to the official apps, not a
            checkout.
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
          <div
            className="portal-settings-row"
            id={rail.id === "paypal" ? "paypal-connect-settings" : undefined}
            key={rail.id}
          >
            <div className="portal-settings-row-head">
              <strong>{rail.label}</strong>
              {rail.id === "paypal" && paypalConnection.connected ? (
                <span className="portal-settings-health">Linked</span>
              ) : rail.id === "paypal" && paymentDrafts.paypal ? (
                <span className="portal-settings-health">Connected</span>
              ) : paymentDrafts[rail.id] ? (
                <span className="portal-settings-health">Saved</span>
              ) : rail.id === "paypal" ? (
                <span className="portal-settings-health">Not connected</span>
              ) : null}
            </div>
            {rail.id === "paypal" ? (
              <p className="portal-settings-note">
                Log in with PayPal links your personal PayPal to this Open
                Marketplace account so buyers cannot spoof a pay-to. Stay
                connected. Finish on PayPal by continuing back here. Official
                name, photo, email, account type, and verified mark stay on
                this PayPal connector. They do not replace your Open Marketplace
                email or name. paypal.me is filled only when PayPal sends it or
                you save it after Login. Open Marketplace will not invent a
                paypal.me from your email or name. This is not a business checkout.
              </p>
            ) : null}
            {rail.id === "paypal" && paypalConnection.connected ? (
              <div className="portal-connector-identity">
                {officialPaypal.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={officialPaypal.imageUrl} alt="" width={48} height={48} />
                ) : null}
                <div>
                  <p>
                    {officialPaypal.headline
                      ? officialPaypal.headline
                      : "PayPal account linked."}
                    {officialConnectorSummary(officialPaypal)
                      ? ` · ${officialConnectorSummary(officialPaypal)}`
                      : ""}
                  </p>
                  {paypalConnection.email ? (
                    <p className="portal-settings-note">
                      PayPal email {paypalConnection.email}
                    </p>
                  ) : null}
                  {officialPaypal.websiteUrl ? (
                    <p className="portal-settings-note">{officialPaypal.websiteUrl}</p>
                  ) : null}
                  {officialPaypal.providerVerified ? (
                    <p className="portal-settings-note">
                      PayPal shows its own verified mark on this account. That
                      is not an Open Marketplace verification badge.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            <label
              className="portal-field"
              data-feedback-surface={`${rail.label} input`}
            >
              <span>{rail.hint}</span>
              <input
                id={`surface-${rail.id}-input`}
                name={rail.id}
                aria-label={rail.hint}
                data-feedback-surface={`${rail.label} input`}
                value={
                  rail.id === "paypal"
                    ? paymentDrafts.paypal ||
                      (paypalConnection.paypalMe
                        ? `https://www.paypal.me/${paypalConnection.paypalMe}`
                        : paypalConnection.email || "")
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
                  (rail.id === "paypal" && !paypalConnection.connected)
                }
                readOnly={rail.id === "paypal" && !paypalConnection.connected}
              />
            </label>
            <div className="portal-connector-actions">
              {rail.id === "paypal" && !paypalConnection.connected ? (
                <button
                  className="button button-dark"
                  type="button"
                  id="surface-connect-paypal"
                  data-feedback-surface="Connect PayPal"
                  onClick={() => void onConnectPayment("paypal")}
                  disabled={pending !== null}
                >
                  {pending === "paypal-connect"
                    ? "Connecting…"
                    : "Log in with PayPal"}
                </button>
              ) : null}
              {rail.id === "paypal" && paypalConnection.connected ? (
                <button
                  className="button button-dark"
                  type="button"
                  data-feedback-surface="Save paypal.me"
                  onClick={() => void onSavePaypalMe()}
                  disabled={pending !== null}
                >
                  {pending === "paypal-paypalme"
                    ? "Saving…"
                    : "Save paypal.me"}
                </button>
              ) : null}
              {rail.id === "paypal" &&
              (paypalConnection.connected || paymentDrafts.paypal) ? (
                <button
                  className="button button-ghost"
                  type="button"
                  data-feedback-surface="Disconnect PayPal"
                  onClick={() => void onDisconnectPayPal()}
                  disabled={pending !== null}
                >
                  {pending === "paypal-disconnect"
                    ? "Disconnecting…"
                    : "Disconnect PayPal"}
                </button>
              ) : rail.id !== "paypal" ? (
                <button
                  className="button button-dark"
                  type="button"
                  data-feedback-surface={`Connect ${rail.label}`}
                  onClick={() => void onConnectPayment(rail.id)}
                  disabled={pending !== null}
                >
                  {pending === `${rail.id}-connect`
                    ? "Connecting…"
                    : `Connect ${rail.label}`}
                </button>
              ) : null}
              <a
                className="button button-ghost"
                href={rail.connectUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open {rail.id === "paypal" ? "paypal.me" : rail.label}
              </a>
              {paymentDrafts[rail.id] && rail.id !== "paypal" ? (
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() => void onDisconnectPayment(rail.id)}
                  disabled={pending !== null}
                >
                  {pending === `${rail.id}-disconnect`
                    ? "Disconnecting…"
                    : "Disconnect"}
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
            <label
              className="portal-field"
              data-feedback-surface={`${rail.label} input`}
            >
              <span>{rail.hint}</span>
              <input
                id={`surface-${rail.id}-input`}
                name={rail.id}
                aria-label={rail.hint}
                data-feedback-surface={`${rail.label} input`}
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
              <button
                className="button button-dark"
                type="button"
                data-feedback-surface={`Connect ${rail.label}`}
                onClick={() => void onConnectPayment(rail.id)}
                disabled={pending !== null}
              >
                {pending === `${rail.id}-connect`
                  ? "Connecting…"
                  : `Connect ${rail.label}`}
              </button>
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
                  onClick={() => void onDisconnectPayment(rail.id)}
                  disabled={pending !== null}
                >
                  {pending === `${rail.id}-disconnect`
                    ? "Disconnecting…"
                    : "Disconnect"}
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
              <label
                className="portal-field"
                data-feedback-surface="Parcel Monkey input"
              >
                <span>Public Parcel Monkey account email, optional</span>
                <input
                  type="email"
                  name="parcelMonkeyAccount"
                  aria-label="Public Parcel Monkey account email, optional"
                  data-feedback-surface="Parcel Monkey input"
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
        <label className="portal-field" data-feedback-surface="Host origin input">
          <span>Host origin</span>
          <input
            type="url"
            name="mediaNodeOrigin"
            aria-label="Host origin"
            data-feedback-surface="Host origin input"
            placeholder="https://host.your-nas.example"
            value={mediaNodeOrigin}
            onChange={(event) => setMediaNodeOrigin(event.target.value)}
            disabled={pending !== null}
          />
        </label>
        <label className="portal-field" data-feedback-surface="Write token input">
          <span>Write token</span>
          <input
            type="password"
            name="mediaNodeToken"
            aria-label="Write token"
            data-feedback-surface="Write token input"
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
