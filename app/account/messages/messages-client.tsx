"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MESSAGE_MAX_LENGTH,
  RATING_NOTE_MAX,
  RATING_NOTE_MIN,
  SALE_STATUSES,
  type SaleStatus,
  saleStatusLabel,
} from "../../../lib/conversation-limits";
import { getLocalMediaUrl, storeMedia } from "../../../lib/media-store";
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
  label,
  photo,
}: {
  label: string;
  photo: MediaManifest | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const photoKey = photo
    ? `${photo.hash}:${(photo.hosts ?? []).join(",")}`
    : "";

  useEffect(() => {
    if (!photoKey || !photo) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    void getLocalMediaUrl(photo.hash, photo.hosts ?? []).then((next) => {
      if (cancelled) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      objectUrl = next;
      setUrl(next);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo, photoKey]);

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
    kind: "paymentReceipt" | "receivedItem" | "receivedPackaging",
    file: File | undefined,
  ) {
    if (!file) return;
    setBusy("evidence");
    setError("");
    try {
      const [manifest] = await storeMedia([file]);
      if (!manifest) {
        setError("Could not store that photo on this device.");
        return;
      }
      await persistSaleEvidence({ [kind]: manifest });
    } catch {
      setError("Could not store that photo on this device.");
    } finally {
      setBusy("");
    }
  }

  async function setCurrentSaleStatus(status: SaleStatus) {
    if (!selectedId) return;
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
          ...(conversation?.myRole === "seller" && trackingValue.trim()
            ? { trackingNumber: trackingValue }
            : {}),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not update this sale.");
        return;
      }
      await Promise.all([loadThread(selectedId), loadInbox()]);
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

            <div className="portal-sale-box">
              <h3>Sale status</h3>
              <p className="portal-settings-note">
                Pending and In-Transfer can be changed. Complete cannot be
                reversed. The listing stays active until both people mark
                Complete. This does not send, hold, or execute payment.
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
                    const locked =
                      conversation.completed ||
                      (conversation.mySaleStatus === "complete" && status !== "complete");
                    return (
                      <button
                        key={status}
                        className={`button${
                          conversation.mySaleStatus === status
                            ? " button-primary"
                            : " button-ghost"
                        }`}
                        type="button"
                        disabled={locked || busy === "sale"}
                        onClick={() => void setCurrentSaleStatus(status)}
                      >
                        {saleStatusLabel(status)}
                      </button>
                    );
                  })}
                </div>
              )}
              {conversation.completed ? (
                <p>Both people marked Complete. The listing is archived and this record is locked.</p>
              ) : conversation.otherConfirmed ? (
                <p className="portal-settings-note">
                  {otherName} marked Complete. Your Complete will lock the sale.
                </p>
              ) : null}
            </div>

            <div className="portal-sale-box">
              <h3>Sale proof</h3>
              <p className="portal-settings-note">
                In-Transfer needs the seller tracking number and the buyer
                payment receipt. Complete needs the buyer to upload a photo of
                the product they received and a photo of the packaging. Photo
                bytes stay off the public registry.
              </p>
              {conversation.myRole === "seller" ? (
                <form
                  className="portal-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveSaleEvidence({ trackingNumber: trackingValue });
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
                      placeholder="Carrier tracking, or PICKUP"
                    />
                  </label>
                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={busy === "evidence" || conversation.mySaleStatus === "complete"}
                  >
                    {busy === "evidence" ? "Saving…" : "Save tracking number"}
                  </button>
                </form>
              ) : (
                <p>
                  Tracking number: {conversation.trackingNumber ?? "Not added yet"}
                </p>
              )}
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
              <SaleProof label="Payment receipt" photo={conversation.paymentReceipt} />
              <SaleProof label="Product received" photo={conversation.receivedItem} />
              <SaleProof label="Packaging received" photo={conversation.receivedPackaging} />
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
