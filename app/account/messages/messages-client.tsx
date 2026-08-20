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
import {
  EVIDENCE_PHOTOS_PER_KIND,
  prepareEvidenceUpload,
  readAsDataUrl,
} from "../../../lib/evidence-photo";
import type { EvidenceExif } from "../../../lib/exif-jpeg";
import { getLocalMediaUrl, storeMedia } from "../../../lib/media-store";
import {
  TRACKING_EMBED_SCRIPT,
  requireActualTrackingNumber,
  saleTrackingDetails,
} from "../../../lib/tracking-embed";
import type { MediaManifest, SocialProof } from "../../../lib/types";
import { OfficialConnectorChips } from "../../official-connector-disclosure";

type Rating = { score: number; note: string };

type EvidencePhoto = MediaManifest & {
  dataUrl?: string;
  exif?: EvidenceExif | null;
  width?: number;
  height?: number;
  quality?: "full" | "archival";
};

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
  buyerSocialProofs: SocialProof[];
  sellerSocialProofs: SocialProof[];
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
  paymentReceipt: EvidencePhoto[];
  receivedItem: EvidencePhoto[];
  receivedPackaging: EvidencePhoto[];
  shippedItem: EvidencePhoto[];
  shippedPackaging: EvidencePhoto[];
  evidenceRequestNote: string | null;
  evidenceRequestedAt: string | null;
  myCancelRequested: boolean;
  otherCancelRequested: boolean;
  completedAt: string | null;
  evidenceArchivedAt: string | null;
  evidenceArchiveDue: boolean;
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

function asPhotos(value: EvidencePhoto[] | EvidencePhoto | null | undefined) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function evidenceMetaLines(photo: EvidencePhoto) {
  const exif = photo.exif ?? {};
  const lines: Array<[string, string]> = [];
  if (exif.make || exif.model) {
    lines.push(["Camera", [exif.make, exif.model].filter(Boolean).join(" ")]);
  }
  if (exif.dateTimeOriginal || exif.dateTime) {
    lines.push(["Taken", String(exif.dateTimeOriginal || exif.dateTime)]);
  }
  if (photo.width && photo.height) {
    lines.push(["Size", `${photo.width}×${photo.height}`]);
  } else if (exif.width && exif.height) {
    lines.push(["Size", `${exif.width}×${exif.height}`]);
  }
  if (exif.bitDepth) lines.push(["Bit depth", `${exif.bitDepth}-bit`]);
  if (exif.iso) lines.push(["ISO", String(exif.iso)]);
  if (exif.exposureTime) lines.push(["Exposure", exif.exposureTime]);
  if (exif.fNumber) lines.push(["Aperture", exif.fNumber]);
  if (exif.focalLength) lines.push(["Lens", exif.focalLength]);
  if (exif.software) lines.push(["Software", exif.software]);
  if (exif.gpsLatitude != null && exif.gpsLongitude != null) {
    lines.push(["GPS", `${exif.gpsLatitude}, ${exif.gpsLongitude}`]);
  }
  lines.push(["File", `${photo.name} · ${Math.round(photo.size / 1024)} KB`]);
  lines.push(["Quality", photo.quality === "archival" ? "Archival" : "Full size"]);
  return lines;
}

function useEvidenceUrl(conversationId: string, photo: EvidencePhoto | null) {
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

  return url;
}

function EvidenceLightbox({
  conversationId,
  label,
  photo,
  onClose,
}: {
  conversationId: string;
  label: string;
  photo: EvidencePhoto;
  onClose: () => void;
}) {
  const url = useEvidenceUrl(conversationId, photo);
  const isPdf = photo.type.toLowerCase() === "application/pdf";
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="portal-evidence-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Inspect ${label}`}
      onClick={onClose}
    >
      <div
        className="portal-evidence-lightbox-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="portal-evidence-lightbox-photo">
          {url && isPdf ? (
            <a href={url} target="_blank" rel="noreferrer">
              Open {label.toLowerCase()}
            </a>
          ) : url ? (
            <img src={url} alt={label} />
          ) : (
            <p className="portal-empty">Loading photo…</p>
          )}
        </div>
        <aside className="portal-evidence-metadata">
          <h4>Evidence metadata</h4>
          <dl>
            {evidenceMetaLines(photo).map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <button className="button button-ghost" type="button" onClick={onClose}>
            Close
          </button>
        </aside>
      </div>
    </div>
  );
}

function SaleProof({
  conversationId,
  label,
  photos,
}: {
  conversationId: string;
  label: string;
  photos: EvidencePhoto[] | EvidencePhoto | null;
}) {
  const list = asPhotos(photos);
  const [inspecting, setInspecting] = useState<EvidencePhoto | null>(null);
  if (!list.length) {
    return <p className="portal-empty">{label}: not uploaded yet.</p>;
  }
  return (
    <div className="portal-sale-proof-set">
      <h4>{label}</h4>
      <div className="portal-sale-proof-grid">
        {list.map((photo) => (
          <SaleProofThumb
            key={photo.hash}
            conversationId={conversationId}
            label={label}
            photo={photo}
            onOpen={() => setInspecting(photo)}
          />
        ))}
      </div>
      {inspecting ? (
        <EvidenceLightbox
          conversationId={conversationId}
          label={label}
          photo={inspecting}
          onClose={() => setInspecting(null)}
        />
      ) : null}
    </div>
  );
}

function SaleProofThumb({
  conversationId,
  label,
  photo,
  onOpen,
}: {
  conversationId: string;
  label: string;
  photo: EvidencePhoto;
  onOpen: () => void;
}) {
  const url = useEvidenceUrl(conversationId, photo);
  const isPdf = photo.type.toLowerCase() === "application/pdf";
  return (
    <figure className="portal-sale-proof">
      {url && isPdf ? (
        <button className="portal-sale-proof-open" type="button" onClick={onOpen}>
          Open {label.toLowerCase()}
        </button>
      ) : url ? (
        <button className="portal-sale-proof-open" type="button" onClick={onOpen}>
          <img src={url} alt={label} />
        </button>
      ) : null}
      <figcaption>
        {photo.name}
        {photo.exif?.make || photo.exif?.model
          ? ` · ${[photo.exif?.make, photo.exif?.model].filter(Boolean).join(" ")}`
          : ""}
      </figcaption>
      <dl className="portal-evidence-meta-inline">
        {evidenceMetaLines(photo).map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
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
  const [shippedItemDraft, setShippedItemDraft] = useState<EvidencePhoto[]>([]);
  const [shippedPackagingDraft, setShippedPackagingDraft] = useState<EvidencePhoto[]>([]);
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

  async function archiveDueEvidence(thread: ConversationSummary) {
    if (!thread.evidenceArchiveDue || !selectedId || busy === "archive") return;
    setBusy("archive");
    try {
      const kinds = [
        "shippedItem",
        "shippedPackaging",
        "paymentReceipt",
        "receivedItem",
        "receivedPackaging",
      ] as const;
      const body: Record<string, EvidencePhoto[]> = {};
      for (const kind of kinds) {
        const photos = asPhotos(thread[kind]);
        const archived: EvidencePhoto[] = [];
        for (const photo of photos) {
          const response = await fetch(
            `/api/conversations/evidence/media?conversationId=${encodeURIComponent(selectedId)}&hash=${encodeURIComponent(photo.hash)}`,
          );
          if (!response.ok) continue;
          const blob = await response.blob();
          const file = new File([blob], photo.name, { type: photo.type });
          const prepared = await prepareEvidenceUpload(file, "archival");
          const dataUrl = await readAsDataUrl(prepared.file);
          const [manifest] = await storeMedia([prepared.file]);
          if (!manifest) continue;
          archived.push({
            ...manifest,
            dataUrl,
            exif: prepared.exif,
            width: prepared.width,
            height: prepared.height,
            quality: "archival",
          });
        }
        if (archived.length) body[kind] = archived;
      }
      if (!Object.keys(body).length) return;
      await fetch("/api/conversations/evidence/archive", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ conversationId: selectedId, ...body }),
      });
      await Promise.all([loadThread(selectedId), loadInbox()]);
    } finally {
      setBusy("");
    }
  }

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
      if (response.status === 404) {
        setConversation(null);
        setMessages([]);
        setSelectedId("");
        router.replace("/account/messages");
        void loadInbox();
        setError("This conversation was cancelled and deleted.");
        return;
      }
      setError(payload.error ?? "Conversation not found.");
      return;
    }
    setConversation(payload.conversation);
    setMessages(payload.messages ?? []);
    setError("");
    if (payload.conversation.evidenceArchiveDue) {
      void archiveDueEvidence(payload.conversation);
    }
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
    setShippedItemDraft([]);
    setShippedPackagingDraft([]);
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

  function currentPhotos(
    kind: "shippedItem" | "shippedPackaging" | "paymentReceipt" | "receivedItem" | "receivedPackaging",
  ) {
    if (kind === "shippedItem" && shippedItemDraft.length) return shippedItemDraft;
    if (kind === "shippedPackaging" && shippedPackagingDraft.length) {
      return shippedPackagingDraft;
    }
    return asPhotos(conversation?.[kind]);
  }

  async function uploadSalePhoto(
    kind:
      | "paymentReceipt"
      | "receivedItem"
      | "receivedPackaging"
      | "shippedItem"
      | "shippedPackaging",
    files: FileList | File[] | File | undefined,
    persist = true,
  ) {
    const incoming = !files
      ? []
      : files instanceof File
        ? [files]
        : [...files];
    if (!incoming.length) return;
    setBusy("evidence");
    setError("");
    try {
      const next = [...currentPhotos(kind)];
      for (const file of incoming) {
        if (next.length >= EVIDENCE_PHOTOS_PER_KIND) break;
        const prepared = await prepareEvidenceUpload(file);
        const [manifest] = await storeMedia([prepared.file]);
        if (!manifest) {
          setError("Could not store that photo on this device.");
          return;
        }
        const dataUrl = await readAsDataUrl(prepared.file);
        next.push({
          ...manifest,
          dataUrl,
          exif: prepared.exif,
          width: prepared.width,
          height: prepared.height,
          quality: prepared.quality,
        });
      }
      if (kind === "shippedItem") setShippedItemDraft(next);
      if (kind === "shippedPackaging") setShippedPackagingDraft(next);
      if (persist) await persistSaleEvidence({ [kind]: next });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not store that photo on this device.",
      );
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
    const shippedItem = currentPhotos("shippedItem");
    const shippedPackaging = currentPhotos("shippedPackaging");
    if (!shippedItem.length || !shippedPackaging.length) {
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
      setShippedItemDraft([]);
      setShippedPackagingDraft([]);
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

  async function cancelTransaction(action: "request" | "withdraw") {
    if (!selectedId) return;
    setBusy("cancel");
    setError("");
    try {
      const response = await fetch("/api/conversations/cancel", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ conversationId: selectedId, action }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        conversation?: ConversationSummary;
        deleted?: boolean;
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "Could not update the cancel request.");
        return;
      }
      if (payload.deleted) {
        setConversation(null);
        setMessages([]);
        setSelectedId("");
        setDraft("");
        setShowTransferPrompt(false);
        router.replace("/account/messages");
        await loadInbox();
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
                    {item.otherCancelRequested
                      ? " · Cancel requested"
                      : item.myCancelRequested
                        ? " · Waiting to cancel"
                        : item.lastMessagePreview
                          ? ` · ${item.lastMessagePreview}`
                          : ""}
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
            <OfficialConnectorChips
              accounts={
                conversation.myRole === "buyer"
                  ? conversation.sellerSocialProofs
                  : conversation.buyerSocialProofs
              }
              heading={
                conversation.myRole === "buyer"
                  ? "Seller official social connectors"
                  : "Buyer official social connectors"
              }
            />

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
                  shipping evidence in this window, use Accept Transit Evidence
                  or ask for additional evidence.
                </p>
              ) : null}
              {conversation.completed ? (
                <p>Both people marked Complete. The listing is archived and this record is locked.</p>
              ) : conversation.otherConfirmed ? (
                <p className="portal-settings-note">
                  {otherName} marked Complete. Your Complete will lock the sale.
                </p>
              ) : null}

              <h3>Cancel transaction</h3>
              <p className="portal-settings-note">
                Both people must agree. That closes this document and deletes
                the chat history from the system.
              </p>
              {conversation.completed ? (
                <p className="portal-settings-note">
                  This sale is complete and cannot be cancelled.
                </p>
              ) : conversation.myCancelRequested &&
                !conversation.otherCancelRequested ? (
                <>
                  <p className="portal-cancel-request">
                    Waiting for {otherName} to agree to cancel.
                  </p>
                  <button
                    className="button button-ghost"
                    type="button"
                    disabled={busy === "cancel"}
                    onClick={() => void cancelTransaction("withdraw")}
                  >
                    {busy === "cancel" ? "Updating…" : "Withdraw cancel"}
                  </button>
                </>
              ) : conversation.otherCancelRequested &&
                !conversation.myCancelRequested ? (
                <>
                  <p className="portal-cancel-request">
                    {otherName} asked to cancel. Agree to cancel and delete
                    this chat.
                  </p>
                  <button
                    className="button button-primary"
                    type="button"
                    disabled={busy === "cancel"}
                    onClick={() => void cancelTransaction("request")}
                  >
                    {busy === "cancel" ? "Deleting…" : "Agree and delete"}
                  </button>
                </>
              ) : (
                <button
                  className="button button-ghost"
                  type="button"
                  disabled={busy === "cancel"}
                  onClick={() => void cancelTransaction("request")}
                >
                  {busy === "cancel" ? "Updating…" : "Cancel transaction"}
                </button>
              )}

              <h3>Shipping evidence</h3>
              <p className="portal-settings-note">
                The seller clicks In-Transfer to enter a real tracking number,
                verify it in this shipping details window, and upload one to
                three photos of the item and of the shipping box. Click a photo
                to inspect it and review the EXIF metadata. Files larger than
                4K 10-bit are compressed on this computer by the in-app
                encoder. Full-size proof stays until seven days after both
                people mark Complete, then it is archived. Photo bytes stay
                off the public registry.
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
                    <span>Photos of the item (1–3)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) =>
                        void uploadSalePhoto(
                          "shippedItem",
                          event.target.files ?? undefined,
                          false,
                        )
                      }
                    />
                  </label>
                  <label className="portal-field">
                    <span>Photos of the shipping box (1–3)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) =>
                        void uploadSalePhoto(
                          "shippedPackaging",
                          event.target.files ?? undefined,
                          false,
                        )
                      }
                    />
                  </label>
                  <SaleProof
                    conversationId={conversation.id}
                    label="Item photo"
                    photos={currentPhotos("shippedItem")}
                  />
                  <SaleProof
                    conversationId={conversation.id}
                    label="Shipping box"
                    photos={currentPhotos("shippedPackaging")}
                  />
                  <div className="portal-sale-status-row">
                    <button
                      className="button button-primary"
                      type="submit"
                      disabled={
                        busy === "sale" ||
                        busy === "evidence" ||
                        !requireActualTrackingNumber(trackingValue) ||
                        !currentPhotos("shippedItem").length ||
                        !currentPhotos("shippedPackaging").length
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
                      ...(shippedItemDraft.length
                        ? { shippedItem: shippedItemDraft }
                        : {}),
                      ...(shippedPackagingDraft.length
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
                    <span>Photos of the item (1–3)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) =>
                        void uploadSalePhoto(
                          "shippedItem",
                          event.target.files ?? undefined,
                        )
                      }
                    />
                  </label>
                  <label className="portal-field">
                    <span>Photos of the shipping box (1–3)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) =>
                        void uploadSalePhoto(
                          "shippedPackaging",
                          event.target.files ?? undefined,
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
                    photos={conversation.shippedItem}
                  />
                  <SaleProof
                    conversationId={conversation.id}
                    label="Shipping box"
                    photos={conversation.shippedPackaging}
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
                          ? "Choose Accept Transit Evidence if this shipment looks correct."
                          : "Accept Transit Evidence is available after the seller submits In-Transfer shipping details."}
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
                        {busy === "evidence" ? "Saving…" : "Accept Transit Evidence"}
                      </button>
                      {error ? <p className="portal-error">{error}</p> : null}
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
                Accept Transit Evidence confirms the seller tracking number and
                shipment photos. Complete still needs the payment receipt plus
                photos of the product received and the packaging.
              </p>
              {conversation.myRole === "buyer" && conversation.mySaleStatus !== "complete" ? (
                <div className="portal-form">
                  <label className="portal-field">
                    <span>Payment receipt (1–3)</span>
                    <input
                      type="file"
                      accept="image/*,.pdf,application/pdf"
                      multiple
                      onChange={(event) =>
                        void uploadSalePhoto(
                          "paymentReceipt",
                          event.target.files ?? undefined,
                        )
                      }
                    />
                  </label>
                  <label className="portal-field">
                    <span>Photos of the product received (1–3)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) =>
                        void uploadSalePhoto(
                          "receivedItem",
                          event.target.files ?? undefined,
                        )
                      }
                    />
                  </label>
                  <label className="portal-field">
                    <span>Photos of the packaging (1–3)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) =>
                        void uploadSalePhoto(
                          "receivedPackaging",
                          event.target.files ?? undefined,
                        )
                      }
                    />
                  </label>
                </div>
              ) : null}
              <SaleProof
                conversationId={conversation.id}
                label="Payment receipt"
                photos={conversation.paymentReceipt}
              />
              <SaleProof
                conversationId={conversation.id}
                label="Product received"
                photos={conversation.receivedItem}
              />
              <SaleProof
                conversationId={conversation.id}
                label="Packaging received"
                photos={conversation.receivedPackaging}
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
