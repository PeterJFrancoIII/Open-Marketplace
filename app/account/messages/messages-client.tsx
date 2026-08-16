"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EVIDENCE_REQUEST_NOTE_MAX,
  EVIDENCE_REQUEST_NOTE_MIN,
  MESSAGE_MAX_LENGTH,
  RATING_NOTE_MAX,
  RATING_NOTE_MIN,
  SALE_STATUSES,
  type SaleStatus,
  saleStatusLabel,
} from "../../../lib/conversation-limits";
import { prepareEvidenceFile, readAsDataUrl } from "../../../lib/evidence-photo";
import { getLocalMediaUrl, storeMedia } from "../../../lib/media-store";
import {
  TRACKING_EMBED_SCRIPT,
  requireActualTrackingNumber,
  saleTrackingDetails,
} from "../../../lib/tracking-embed";
import type { MediaManifest } from "../../../lib/types";

type Rating = { score: number; note: string };

type ConversationSummary = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingStatus: string;
  listingPriceCents: number;
  listingCurrency: string;
  salePriceCents: number;
  buyerMarksSafe: boolean;
  paypalDestination: string | null;
  paypalLinked: boolean;
  paypalKind: "goods_and_services" | "friends_and_family";
  paypalPayHref: string | null;
  soldAt: string | null;
  buyerId: string;
  sellerId: string;
  buyerName: string;
  sellerName: string;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  completed: boolean;
  myRole: "buyer" | "seller";
  mySaleStatus: SaleStatus;
  otherSaleStatus: SaleStatus;
  myConfirmed: boolean;
  otherConfirmed: boolean;
  myRating: Rating | null;
  otherRating: Rating | null;
  trackingNumber: string | null;
  paymentReceipt: MediaManifest | null;
  receivedItem: MediaManifest | null;
  receivedPackaging: MediaManifest | null;
  shippedItem: MediaManifest | null;
  shippedPackaging: MediaManifest | null;
  evidenceRequestNote: string | null;
  evidenceRequestedAt: string | null;
};

type ConversationMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function SaleProof({
  conversationId,
  label,
  photo,
}: {
  conversationId: string;
  label: string;
  photo: (MediaManifest & { dataUrl?: string }) | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const photoKey = photo
    ? `${conversationId}:${photo.hash}:${photo.dataUrl ? "draft" : "saved"}:${(photo.hosts ?? []).join(",")}`
    : "";

  useEffect(() => {
    if (!photoKey || !photo) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    void (async () => {
      if (photo.dataUrl) {
        setUrl(photo.dataUrl);
        return;
      }
      const local = await getLocalMediaUrl(photo.hash, photo.hosts ?? []);
      if (cancelled) {
        if (local) URL.revokeObjectURL(local);
        return;
      }
      if (local) {
        objectUrl = local;
        setUrl(local);
        return;
      }
      const response = await fetch(
        `/api/conversations/evidence/media?conversationId=${encodeURIComponent(conversationId)}&hash=${encodeURIComponent(photo.hash)}`,
        { headers: { accept: photo.type || "image/*" } },
      );
      if (!response.ok || cancelled) return;
      const blob = await response.blob();
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [conversationId, photo, photoKey]);

  if (!photo) {
    return <p className="portal-empty">{label}: not uploaded yet.</p>;
  }
  const isPdf = photo.type.toLowerCase() === "application/pdf";
  return (
    <figure className="portal-sale-proof">
      {url && isPdf ? (
        <a href={url} target="_blank" rel="noreferrer">
          Open {label.toLowerCase()}
        </a>
      ) : url ? (
        <img src={url} alt={label} />
      ) : null}
      <figcaption>
        {label}: {photo.name}
      </figcaption>
    </figure>
  );
}

function TrackingUpdates({
  trackingNumber,
  waiting = false,
}: {
  trackingNumber: string;
  waiting?: boolean;
}) {
  const reactId = useId().replace(/:/g, "");
  const containerId = `yq-${reactId}`;
  const [liveNumber, setLiveNumber] = useState(trackingNumber);
  const [useFallback, setUseFallback] = useState(false);
  const details = useMemo(() => saleTrackingDetails(liveNumber), [liveNumber]);

  useEffect(() => {
    const timer = window.setTimeout(() => setLiveNumber(trackingNumber), 700);
    return () => window.clearTimeout(timer);
  }, [trackingNumber]);

  useEffect(() => {
    if (!details || details.kind !== "carrier") return;
    let cancelled = false;
    const compact = details.number.replace(/[\s-]/g, "");

    function start() {
      const trackSingle = (
        window as Window & {
          YQV5?: { trackSingle?: (options: Record<string, string | number>) => void };
        }
      ).YQV5?.trackSingle;
      if (!trackSingle || cancelled) return;
      trackSingle({
        YQ_ContainerId: containerId,
        YQ_Height: 420,
        YQ_Fc: "0",
        YQ_Lang: "en",
        YQ_Num: compact,
      });
    }

    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-om-17track='1']",
    );
    if (existing) {
      if (
        (window as Window & { YQV5?: { trackSingle?: unknown } }).YQV5?.trackSingle
      ) {
        start();
      } else {
        existing.addEventListener("load", start, { once: true });
      }
    } else {
      const script = document.createElement("script");
      script.src = TRACKING_EMBED_SCRIPT;
      script.async = true;
      script.dataset.om17track = "1";
      script.addEventListener("load", start, { once: true });
      script.addEventListener("error", () => {
        if (!cancelled) setUseFallback(true);
      });
      document.body.appendChild(script);
    }

    const failTimer = window.setTimeout(() => {
      if (
        !cancelled &&
        !(window as Window & { YQV5?: unknown }).YQV5
      ) {
        setUseFallback(true);
      }
    }, 4000);

    return () => {
      cancelled = true;
      window.clearTimeout(failTimer);
    };
  }, [containerId, details]);

  if (!details) {
    if (!waiting) return null;
    return (
      <div className="portal-tracking-updates">
        <h4>Shipping details</h4>
        <p className="portal-settings-note">
          Enter a UPS, USPS, FedEx, or DHL tracking number to verify this
          shipment in the approved provider window.
        </p>
      </div>
    );
  }
  if (details.kind === "pickup") {
    return (
      <p className="portal-settings-note">
        In-person pickup. No carrier tracking.
      </p>
    );
  }

  return (
    <div className="portal-tracking-updates">
      <h4>Shipping details</h4>
      <p className="portal-settings-note">
        {details.carrier === "unknown"
          ? "Carrier will be identified from the tracking number."
          : `${details.carrierLabel} ${details.number}`}
      </p>
      <div className="portal-tracking-links">
        {details.officialHref ? (
          <a href={details.officialHref} target="_blank" rel="noreferrer">
            Open official {details.carrierLabel} tracking
          </a>
        ) : null}
        {details.aftershipHref ? (
          <a href={details.aftershipHref} target="_blank" rel="noreferrer">
            Open AfterShip
          </a>
        ) : null}
      </div>
      <div id={containerId} className="portal-tracking-embed" />
      {useFallback && details.embedHref ? (
        <iframe
          className="portal-tracking-frame"
          title={`17TRACK updates for ${details.number}`}
          src={details.embedHref}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          referrerPolicy="no-referrer"
        />
      ) : null}
      <p className="portal-settings-note">
        Tracking updates use 17TRACK&apos;s official embed for UPS, USPS,
        FedEx, and DHL. Official carrier pages stay the source of truth.
      </p>
    </div>
  );
}

function sellerCanEditShipping(conversation: ConversationSummary) {
  if (conversation.myRole !== "seller") return false;
  if (conversation.completed || conversation.mySaleStatus === "complete") {
    return false;
  }
  const buyerAccepted =
    conversation.otherSaleStatus === "in_transfer" ||
    conversation.otherSaleStatus === "complete";
  return !buyerAccepted || Boolean(conversation.evidenceRequestedAt);
}

function formatWhen(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MessagesClient({
  userId,
  initialConversationId,
  initialInbox,
  initialThread,
}: {
  userId: string;
  initialConversationId: string;
  initialInbox: ConversationSummary[];
  initialThread: {
    conversation: ConversationSummary;
    messages: ConversationMessage[];
  } | null;
}) {
  const router = useRouter();
  const [inbox, setInbox] = useState<ConversationSummary[]>(initialInbox);
  const [conversation, setConversation] = useState<ConversationSummary | null>(
    initialThread?.conversation ?? null,
  );
  const [messages, setMessages] = useState<ConversationMessage[]>(
    initialThread?.messages ?? [],
  );
  const [selectedId, setSelectedId] = useState(initialConversationId);
  const [draft, setDraft] = useState("");
  const [score, setScore] = useState(5);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [priceDraft, setPriceDraft] = useState("");
  const [priceDirty, setPriceDirty] = useState(false);
  const [trackingDraft, setTrackingDraft] = useState("");
  const [trackingDirty, setTrackingDirty] = useState(false);
  const [showTransferPrompt, setShowTransferPrompt] = useState(false);
  const [evidenceRequestDraft, setEvidenceRequestDraft] = useState("");
  const [shippedItemDraft, setShippedItemDraft] = useState<
    (MediaManifest & { dataUrl?: string }) | null
  >(null);
  const [shippedPackagingDraft, setShippedPackagingDraft] = useState<
    (MediaManifest & { dataUrl?: string }) | null
  >(null);
  const trackingValue = trackingDirty
    ? trackingDraft
    : conversation?.trackingNumber ?? "";
  const salePriceDraft = priceDirty
    ? priceDraft
    : conversation
      ? (conversation.salePriceCents / 100).toFixed(2)
      : "";

  const otherName = useMemo(() => {
    if (!conversation) return "";
    return conversation.myRole === "buyer"
      ? conversation.sellerName
      : conversation.buyerName;
  }, [conversation]);

  async function loadInbox() {
    const response = await fetch("/api/conversations", {
      headers: { accept: "application/json" },
    });
    const payload = (await response.json().catch(() => ({}))) as {
      conversations?: ConversationSummary[];
      error?: string;
    };
    if (!response.ok) {
      setError(payload.error ?? "Could not load messages.");
      return;
    }
    setInbox(payload.conversations ?? []);
  }

  async function loadThread(conversationId: string) {
    const response = await fetch(
      `/api/conversations?id=${encodeURIComponent(conversationId)}`,
      { headers: { accept: "application/json" } },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      conversation?: ConversationSummary;
      messages?: ConversationMessage[];
      error?: string;
    };
    if (!response.ok || !payload.conversation) {
      setError(payload.error ?? "Conversation not found.");
      return;
    }
    setConversation(payload.conversation);
    setMessages(payload.messages ?? []);
    setError("");
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadInbox();
      if (selectedId) void loadThread(selectedId);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [selectedId]);

  function openThread(conversationId: string) {
    setSelectedId(conversationId);
    setPriceDirty(false);
    setTrackingDirty(false);
    setShowTransferPrompt(false);
    setEvidenceRequestDraft("");
    setShippedItemDraft(null);
    setShippedPackagingDraft(null);
    router.replace(`/account/messages?id=${encodeURIComponent(conversationId)}`);
    void loadThread(conversationId);
  }

  async function sendCurrentMessage() {
    if (!selectedId || !draft.trim()) return;
    setBusy("send");
    setError("");
    try {
      const response = await fetch("/api/conversations/messages", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ conversationId: selectedId, body: draft }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not send that message.");
        return;
      }
      setDraft("");
      await Promise.all([loadThread(selectedId), loadInbox()]);
    } finally {
      setBusy("");
    }
  }

  async function updatePaypalSale(patch: {
    salePriceCents?: number;
    buyerMarksSafe?: boolean;
  }) {
    if (!selectedId) return;
    setBusy("paypal");
    setError("");
    try {
      const response = await fetch("/api/conversations/paypal", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ conversationId: selectedId, ...patch }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not update the PayPal sale.");
        return;
      }
      setPriceDirty(false);
      await Promise.all([loadThread(selectedId), loadInbox()]);
    } finally {
      setBusy("");
    }
  }

  async function persistSaleEvidence(patch: Record<string, unknown>) {
    if (!selectedId) return false;
    const response = await fetch("/api/conversations/evidence", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ conversationId: selectedId, ...patch }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not save that sale proof.");
      return false;
    }
    setTrackingDirty(false);
    await Promise.all([loadThread(selectedId), loadInbox()]);
    return true;
  }

  async function saveSaleEvidence(patch: Record<string, unknown>) {
    if (!selectedId) return;
    setBusy("evidence");
    setError("");
    try {
      await persistSaleEvidence(patch);
    } finally {
      setBusy("");
    }
  }

  async function uploadSalePhoto(
    kind:
      | "paymentReceipt"
      | "receivedItem"
      | "receivedPackaging"
      | "shippedItem"
      | "shippedPackaging",
    file: File | undefined,
    persist = true,
  ) {
    if (!file) return;
    setBusy("evidence");
    setError("");
    try {
      const prepared = await prepareEvidenceFile(file);
      const [manifest] = await storeMedia([prepared]);
      if (!manifest) {
        setError("Could not store that photo on this device.");
        return;
      }
      const dataUrl = await readAsDataUrl(prepared);
      const evidencePhoto = { ...manifest, dataUrl };
      if (kind === "shippedItem") setShippedItemDraft(evidencePhoto);
      if (kind === "shippedPackaging") setShippedPackagingDraft(evidencePhoto);
      if (persist) await persistSaleEvidence({ [kind]: evidencePhoto });
    } catch {
      setError("Could not store that photo on this device.");
    } finally {
      setBusy("");
    }
  }

  async function setCurrentSaleStatus(
    status: SaleStatus,
    extra: Record<string, unknown> = {},
  ) {
    if (!selectedId) return false;
    setBusy("sale");
    setError("");
    try {
      const response = await fetch("/api/conversations/sale", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: selectedId,
          status,
          ...extra,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not update this sale.");
        return false;
      }
      await Promise.all([loadThread(selectedId), loadInbox()]);
      return true;
    } finally {
      setBusy("");
    }
  }

  function chooseSaleStatus(status: SaleStatus) {
    if (!conversation) return;
    if (status === "in_transfer") {
      if (conversation.myRole !== "seller") {
        setError("Only the seller marks In-Transfer. Accept the shipping evidence instead.");
        return;
      }
      if (conversation.completed || conversation.mySaleStatus === "complete") return;
      setShowTransferPrompt(true);
      window.requestAnimationFrame(() => {
        document.getElementById("in-transfer-prompt")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
      return;
    }
    void setCurrentSaleStatus(status);
  }

  async function submitSellerInTransfer() {
    if (!conversation) return;
    const trackingNumber = requireActualTrackingNumber(trackingValue);
    if (!trackingNumber) {
      setError(
        "Enter the actual UPS, USPS, FedEx, or DHL tracking number for this item.",
      );
      return;
    }
    const shippedItem = shippedItemDraft ?? conversation.shippedItem;
    const shippedPackaging = shippedPackagingDraft ?? conversation.shippedPackaging;
    if (!shippedItem || !shippedPackaging) {
      setError(
        "Upload a photo of the item and the shipping box before marking In-Transfer.",
      );
      return;
    }
    const ok = await setCurrentSaleStatus("in_transfer", {
      trackingNumber,
      shippedItem,
      shippedPackaging,
    });
    if (ok) {
      setShowTransferPrompt(false);
      setShippedItemDraft(null);
      setShippedPackagingDraft(null);
    }
  }

  async function acceptCurrentEvidence() {
    if (!selectedId) return;
    setBusy("evidence");
    setError("");
    try {
      await persistSaleEvidence({ action: "accept" });
    } finally {
      setBusy("");
    }
  }

  async function requestMoreEvidence() {
    if (!selectedId) return;
    setBusy("evidence");
    setError("");
    try {
      await persistSaleEvidence({
        action: "request",
        note: evidenceRequestDraft,
      });
    } finally {
      setBusy("");
    }
  }

  async function submitCurrentRating() {
    if (!selectedId) return;
    setBusy("rating");
    setError("");
    try {
      const response = await fetch("/api/conversations/rating", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: selectedId,
          score,
          note,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not save that rating.");
        return;
      }
      setNote("");
      await Promise.all([loadThread(selectedId), loadInbox()]);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="portal-messages">
      <section className="portal-panel" aria-labelledby="messages-inbox-title">
        <p className="portal-eyebrow">Inbox</p>
        <h1 id="messages-inbox-title">Messages</h1>
        <p className="portal-lead">
          Text only. Confirming sold or purchased is a mutual record, not
          checkout or payment.
        </p>
        {inbox.length === 0 ? (
          <p className="portal-empty">No conversations yet. Contact a seller from a live listing.</p>
        ) : (
          <ul className="portal-thread-list">
            {inbox.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`portal-thread-link${item.id === selectedId ? " active" : ""}`}
                  onClick={() => openThread(item.id)}
                >
                  <strong>{item.listingTitle}</strong>
                  <small>
                    {item.myRole === "buyer" ? item.sellerName : item.buyerName}
                    {item.lastMessagePreview ? ` · ${item.lastMessagePreview}` : ""}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="portal-panel" aria-labelledby="messages-thread-title">
        {!conversation ? (
          <>
            <h2 id="messages-thread-title">Thread</h2>
            <p className="portal-empty">Choose a conversation to read and reply.</p>
          </>
        ) : (
          <>
            <p className="portal-eyebrow">
              {conversation.myRole === "buyer" ? "Buying" : "Selling"} ·{" "}
              {formatMoney(conversation.salePriceCents, conversation.listingCurrency)}
            </p>
            <h2 id="messages-thread-title">{conversation.listingTitle}</h2>
            <p className="portal-lead">
              With {otherName}. Listing is {conversation.listingStatus}.
            </p>

            <ol className="portal-message-list">
              {messages.length === 0 ? (
                <li className="portal-empty">No messages yet. Say hello.</li>
              ) : (
                messages.map((message) => (
                  <li
                    key={message.id}
                    className={`portal-message${message.senderId === userId ? " mine" : ""}`}
                  >
                    <strong>{message.senderId === userId ? "You" : otherName}</strong>
                    <p>{message.body}</p>
                    <time dateTime={message.createdAt}>{formatWhen(message.createdAt)}</time>
                  </li>
                ))
              )}
            </ol>

            <form
              className="portal-form"
              onSubmit={(event) => {
                event.preventDefault();
                void sendCurrentMessage();
              }}
            >
              <label className="portal-field">
                <span>Message</span>
                <textarea
                  value={draft}
                  maxLength={MESSAGE_MAX_LENGTH}
                  rows={3}
                  onChange={(event) => setDraft(event.target.value)}
                />
              </label>
              <button className="button button-primary" type="submit" disabled={busy === "send"}>
                {busy === "send" ? "Sending…" : "Send"}
              </button>
            </form>

            <div className="portal-sale-box portal-shipping-evidence">
              <h3>Sale status</h3>
              <p className="portal-settings-note">
                Pending and In-Transfer can be changed. Complete cannot be
                reversed. The listing stays active until both people mark
                Complete. Only the seller can click In-Transfer. This does
                not send, hold, or execute payment.
              </p>
              <p className="portal-settings-note">
                {otherName} is {saleStatusLabel(conversation.otherSaleStatus)}.
                You are {saleStatusLabel(conversation.mySaleStatus)}.
              </p>
              {conversation.listingStatus === "sold" && !conversation.completed ? (
                <p className="portal-empty">This listing was sold in another conversation.</p>
              ) : (
                <div className="portal-sale-status-row" role="group" aria-label="Your sale status">
                  {SALE_STATUSES.map((status) => {
                    const buyerBlockedTransfer =
                      status === "in_transfer" && conversation.myRole !== "seller";
                    const locked =
                      conversation.completed ||
                      buyerBlockedTransfer ||
                      (conversation.mySaleStatus === "complete" && status !== "complete");
                    return (
                      <button
                        key={status}
                        className={`button${
                          conversation.mySaleStatus === status ||
                          (status === "in_transfer" && showTransferPrompt)
                            ? " button-primary"
                            : " button-ghost"
                        }`}
                        type="button"
                        disabled={locked || busy === "sale"}
                        title={
                          buyerBlockedTransfer
                            ? "Only the seller can click In-Transfer."
                            : undefined
                        }
                        onClick={() => chooseSaleStatus(status)}
                      >
                        {saleStatusLabel(status)}
                      </button>
                    );
                  })}
                </div>
              )}
              {conversation.myRole === "buyer" ? (
                <p className="portal-settings-note">
                  Only the seller can click In-Transfer. After they submit
                  shipping evidence in this window, use Accept Evidence or ask
                  for additional evidence.
                </p>
              ) : null}
              {conversation.completed ? (
                <p>Both people marked Complete. The listing is archived and this record is locked.</p>
              ) : conversation.otherConfirmed ? (
                <p className="portal-settings-note">
                  {otherName} marked Complete. Your Complete will lock the sale.
                </p>
              ) : null}

              <h3>Shipping evidence</h3>
              <p className="portal-settings-note">
                The seller clicks In-Transfer to enter a real tracking number,
                verify it in this shipping details window, and upload photos of
                the item and the shipping box. The buyer then chooses Accept
                Evidence if they want to. Photo bytes stay off the public
                registry.
              </p>
              {conversation.evidenceRequestNote ? (
                <p className="portal-evidence-request">
                  Additional evidence requested
                  {conversation.evidenceRequestedAt
                    ? ` ${formatWhen(conversation.evidenceRequestedAt)}`
                    : ""}
                  : {conversation.evidenceRequestNote}
                </p>
              ) : null}
              {conversation.myRole === "seller" &&
              !conversation.completed &&
              conversation.mySaleStatus !== "complete" &&
              showTransferPrompt ? (
                <form
                  id="in-transfer-prompt"
                  className="portal-form portal-transfer-prompt"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitSellerInTransfer();
                  }}
                >
                  <h4>In-Transfer</h4>
                  <p className="portal-settings-note">
                    Enter the actual UPS, USPS, FedEx, or DHL tracking number.
                    The approved provider window below verifies that number.
                    Then upload the required shipment photos.
                  </p>
                  <label className="portal-field">
                    <span>Tracking number</span>
                    <input
                      value={trackingValue}
                      maxLength={80}
                      required
                      autoFocus
                      onChange={(event) => {
                        setTrackingDirty(true);
                        setTrackingDraft(event.target.value);
                      }}
                      placeholder="Actual UPS, USPS, FedEx, or DHL tracking number"
                    />
                  </label>
                  <TrackingUpdates
                    waiting
                    trackingNumber={
                      requireActualTrackingNumber(trackingValue) ?? ""
                    }
                  />
                  <label className="portal-field">
                    <span>Photo of the item</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        void uploadSalePhoto(
                          "shippedItem",
                          event.target.files?.[0],
                          false,
                        )
                      }
                    />
                  </label>
                  <label className="portal-field">
                    <span>Photo of the shipping box</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        void uploadSalePhoto(
                          "shippedPackaging",
                          event.target.files?.[0],
                          false,
                        )
                      }
                    />
                  </label>
                  <SaleProof
                    conversationId={conversation.id}
                    label="Item photo"
                    photo={shippedItemDraft ?? conversation.shippedItem}
                  />
                  <SaleProof
                    conversationId={conversation.id}
                    label="Shipping box"
                    photo={shippedPackagingDraft ?? conversation.shippedPackaging}
                  />
                  <div className="portal-sale-status-row">
                    <button
                      className="button button-primary"
                      type="submit"
                      disabled={
                        busy === "sale" ||
                        busy === "evidence" ||
                        !requireActualTrackingNumber(trackingValue) ||
                        !(shippedItemDraft ?? conversation.shippedItem) ||
                        !(shippedPackagingDraft ?? conversation.shippedPackaging)
                      }
                    >
                      {busy === "sale" ? "Saving…" : "Submit In-Transfer evidence"}
                    </button>
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={() => setShowTransferPrompt(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : conversation.myRole === "seller" &&
                sellerCanEditShipping(conversation) &&
                (conversation.mySaleStatus === "in_transfer" ||
                  Boolean(conversation.evidenceRequestedAt)) ? (
                <form
                  className="portal-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveSaleEvidence({
                      trackingNumber: trackingValue,
                      ...(shippedItemDraft ? { shippedItem: shippedItemDraft } : {}),
                      ...(shippedPackagingDraft
                        ? { shippedPackaging: shippedPackagingDraft }
                        : {}),
                    });
                  }}
                >
                  <label className="portal-field">
                    <span>Tracking number</span>
                    <input
                      value={trackingValue}
                      maxLength={80}
                      onChange={(event) => {
                        setTrackingDirty(true);
                        setTrackingDraft(event.target.value);
                      }}
                      placeholder="Actual UPS, USPS, FedEx, or DHL tracking number"
                    />
                  </label>
                  <TrackingUpdates
                    trackingNumber={
                      requireActualTrackingNumber(trackingValue) ??
                      conversation.trackingNumber ??
                      ""
                    }
                  />
                  <label className="portal-field">
                    <span>Photo of the item</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        void uploadSalePhoto(
                          "shippedItem",
                          event.target.files?.[0],
                        )
                      }
                    />
                  </label>
                  <label className="portal-field">
                    <span>Photo of the shipping box</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        void uploadSalePhoto(
                          "shippedPackaging",
                          event.target.files?.[0],
                        )
                      }
                    />
                  </label>
                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={busy === "evidence"}
                  >
                    {busy === "evidence" ? "Saving…" : "Save shipping evidence"}
                  </button>
                </form>
              ) : (
                <>
                  {conversation.myRole === "seller" &&
                  conversation.mySaleStatus === "pending" ? (
                    <p className="portal-settings-note">
                      Click In-Transfer to enter the tracking number, verify it
                      in the shipping details window, and upload the required
                      shipment photos.
                    </p>
                  ) : (
                    <p>
                      Tracking number:{" "}
                      {conversation.trackingNumber ?? "Not added yet"}
                    </p>
                  )}
                  <TrackingUpdates
                    trackingNumber={conversation.trackingNumber ?? ""}
                  />
                </>
              )}
              {!(
                conversation.myRole === "seller" &&
                showTransferPrompt &&
                !conversation.completed &&
                conversation.mySaleStatus !== "complete"
              ) ? (
                <>
                  <SaleProof
                    conversationId={conversation.id}
                    label="Item photo"
                    photo={conversation.shippedItem}
                  />
                  <SaleProof
                    conversationId={conversation.id}
                    label="Shipping box"
                    photo={conversation.shippedPackaging}
                  />
                </>
              ) : null}
              {conversation.myRole === "buyer" &&
              !conversation.completed &&
              conversation.mySaleStatus !== "complete" ? (
                <div className="portal-form">
                  {conversation.mySaleStatus === "in_transfer" ? (
                    <p className="portal-settings-note">
                      You accepted this shipping evidence.
                    </p>
                  ) : (
                    <>
                      <p className="portal-settings-note">
                        {conversation.otherSaleStatus === "in_transfer" ||
                        conversation.otherSaleStatus === "complete"
                          ? "Choose Accept Evidence if this shipment looks correct."
                          : "Accept Evidence is available after the seller submits In-Transfer shipping details."}
                      </p>
                      <button
                        className="button button-primary"
                        type="button"
                        disabled={
                          busy === "evidence" ||
                          (conversation.otherSaleStatus !== "in_transfer" &&
                            conversation.otherSaleStatus !== "complete")
                        }
                        onClick={() => void acceptCurrentEvidence()}
                      >
                        {busy === "evidence" ? "Saving…" : "Accept Evidence"}
                      </button>
                    </>
                  )}
                  {conversation.otherSaleStatus === "in_transfer" ? (
                    <>
                      <label className="portal-field">
                        <span>
                          Ask for additional evidence ({EVIDENCE_REQUEST_NOTE_MIN}–
                          {EVIDENCE_REQUEST_NOTE_MAX} characters)
                        </span>
                        <textarea
                          value={evidenceRequestDraft}
                          minLength={EVIDENCE_REQUEST_NOTE_MIN}
                          maxLength={EVIDENCE_REQUEST_NOTE_MAX}
                          rows={3}
                          onChange={(event) =>
                            setEvidenceRequestDraft(event.target.value)
                          }
                        />
                      </label>
                      <button
                        className="button button-ghost"
                        type="button"
                        disabled={busy === "evidence"}
                        onClick={() => void requestMoreEvidence()}
                      >
                        Ask for additional evidence
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="portal-sale-box">
              <h3>Delivery proof</h3>
              <p className="portal-settings-note">
                Accept Evidence needs the buyer payment receipt. Complete needs
                a photo of the product received and a photo of the packaging.
              </p>
              {conversation.myRole === "buyer" && conversation.mySaleStatus !== "complete" ? (
                <div className="portal-form">
                  <label className="portal-field">
                    <span>Payment receipt</span>
                    <input
                      type="file"
                      accept="image/*,.pdf,application/pdf"
                      onChange={(event) =>
                        void uploadSalePhoto(
                          "paymentReceipt",
                          event.target.files?.[0],
                        )
                      }
                    />
                  </label>
                  <label className="portal-field">
                    <span>Photo of the product received</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        void uploadSalePhoto("receivedItem", event.target.files?.[0])
                      }
                    />
                  </label>
                  <label className="portal-field">
                    <span>Photo of the packaging</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        void uploadSalePhoto(
                          "receivedPackaging",
                          event.target.files?.[0],
                        )
                      }
                    />
                  </label>
                </div>
              ) : null}
              <SaleProof
                conversationId={conversation.id}
                label="Payment receipt"
                photo={conversation.paymentReceipt}
              />
              <SaleProof
                conversationId={conversation.id}
                label="Product received"
                photo={conversation.receivedItem}
              />
              <SaleProof
                conversationId={conversation.id}
                label="Packaging received"
                photo={conversation.receivedPackaging}
              />
            </div>

            <div className="portal-sale-box">
              <h3>PayPal</h3>
              <p className="portal-settings-note">
                PayPal fields fill from the current sale price. The marketplace
                does not send, hold, escrow, or execute payment. Default is
                Goods and Services.
              </p>
              {conversation.myRole === "seller" ? (
                <form
                  className="portal-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const cents = Math.round(Number(salePriceDraft) * 100);
                    void updatePaypalSale({ salePriceCents: cents });
                  }}
                >
                  <label className="portal-field">
                    <span>Sale price</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      value={salePriceDraft}
                      onChange={(event) => {
                        setPriceDirty(true);
                        setPriceDraft(event.target.value);
                      }}
                    />
                  </label>
                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={busy === "paypal"}
                  >
                    {busy === "paypal" ? "Saving…" : "Update sale price"}
                  </button>
                </form>
              ) : (
                <p>
                  Sale price{" "}
                  {formatMoney(conversation.salePriceCents, conversation.listingCurrency)}
                </p>
              )}
              {conversation.paypalPayHref ? (
                <>
                  {conversation.myRole === "buyer" ? (
                    <>
                      <label className="portal-safe-sale">
                        <input
                          type="checkbox"
                          checked={conversation.buyerMarksSafe}
                          disabled={busy === "paypal"}
                          onChange={(event) =>
                            void updatePaypalSale({
                              buyerMarksSafe: event.target.checked,
                            })
                          }
                        />
                        <span>
                          I judge this sale safe. Use Friends and Family
                          instead. That choice is mine and drops PayPal
                          purchase protection.
                        </span>
                      </label>
                      <a
                        className="button button-primary"
                        href={conversation.paypalPayHref}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {conversation.buyerMarksSafe
                          ? "Pay with PayPal · Friends and Family"
                          : "Pay with PayPal · Goods and Services"}
                      </a>
                    </>
                  ) : (
                    <p className="portal-settings-note">
                      Buyer pays{" "}
                      {formatMoney(
                        conversation.salePriceCents,
                        conversation.listingCurrency,
                      )}{" "}
                      as{" "}
                      {conversation.buyerMarksSafe
                        ? "Friends and Family"
                        : "Goods and Services"}
                      {conversation.paypalLinked ? " to your linked PayPal." : "."}
                    </p>
                  )}
                </>
              ) : (
                <p className="portal-empty">
                  {conversation.myRole === "seller"
                    ? "Add a PayPal email in Account settings so the buyer can pay this sale price."
                    : "This seller has not published a PayPal destination yet."}
                </p>
              )}
            </div>

            {conversation.completed ? (
              <div className="portal-sale-box">
                <h3>Rate {otherName}</h3>
                {conversation.myRating ? (
                  <p>
                    You rated {conversation.myRating.score}/5. {conversation.myRating.note}
                  </p>
                ) : (
                  <form
                    className="portal-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitCurrentRating();
                    }}
                  >
                    <label className="portal-field">
                      <span>Score</span>
                      <select
                        value={score}
                        onChange={(event) => setScore(Number(event.target.value))}
                      >
                        {[1, 2, 3, 4, 5].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="portal-field">
                      <span>Why ({RATING_NOTE_MIN}–{RATING_NOTE_MAX} characters)</span>
                      <textarea
                        value={note}
                        minLength={RATING_NOTE_MIN}
                        maxLength={RATING_NOTE_MAX}
                        rows={4}
                        onChange={(event) => setNote(event.target.value)}
                        required
                      />
                    </label>
                    <button
                      className="button button-primary"
                      type="submit"
                      disabled={busy === "rating"}
                    >
                      {busy === "rating" ? "Saving…" : "Save rating"}
                    </button>
                  </form>
                )}
              </div>
            ) : null}

            {error ? <p className="portal-error">{error}</p> : null}
          </>
        )}
      </section>
    </div>
  );
}
