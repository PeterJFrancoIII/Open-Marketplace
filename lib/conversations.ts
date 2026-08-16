import { and, desc, eq, gte, inArray, or } from "drizzle-orm";
import { getDb } from "../db";
import {
  authUsers,
  conversationMedia,
  conversationMessages,
  conversations,
  listings,
  profiles,
  reputationRatings,
  saleHistory,
} from "../db/schema";
import {
  EVIDENCE_REQUEST_NOTE_MAX,
  EVIDENCE_REQUEST_NOTE_MIN,
  MESSAGE_HOUR_LIMIT,
  MESSAGE_MAX_LENGTH,
  RATING_NOTE_MAX,
  RATING_NOTE_MIN,
  type SaleStatus,
  isSaleStatus,
} from "./conversation-limits";
import { parsePaymentDestinationsJson } from "./payment-destinations";
import { paypalPayHref } from "./paypal-pay-link";
import {
  evidenceArchiveDue,
  laterTimestamp,
} from "./evidence-limits";
import {
  parseSalePhotoJson,
  saleEvidenceMissing,
  sanitizeSalePhotos,
  serializeSalePhoto,
  verifySalePhotoUploads,
  type SalePhotoKind,
} from "./sale-evidence";
import { requireActualTrackingNumber } from "./tracking-number";
import { computeSocialCreditScore } from "./social-credit";

export {
  EVIDENCE_REQUEST_NOTE_MAX,
  EVIDENCE_REQUEST_NOTE_MIN,
  MESSAGE_HOUR_LIMIT,
  MESSAGE_MAX_LENGTH,
  RATING_NOTE_MAX,
  RATING_NOTE_MIN,
  SALE_STATUSES,
  isSaleStatus,
  saleStatusLabel,
} from "./conversation-limits";
export type { SaleStatus } from "./conversation-limits";

type Db = Awaited<ReturnType<typeof getDb>>;

export type ConversationActor = {
  id: string;
  name: string;
};

export function partySaleStatus(
  row: {
    buyerSaleStatus?: string | null;
    sellerSaleStatus?: string | null;
    buyerConfirmedAt?: string | null;
    sellerConfirmedAt?: string | null;
  },
  role: "buyer" | "seller",
): SaleStatus {
  const stored = role === "buyer" ? row.buyerSaleStatus : row.sellerSaleStatus;
  if (isSaleStatus(stored)) return stored;
  const confirmed = role === "buyer" ? row.buyerConfirmedAt : row.sellerConfirmedAt;
  return confirmed ? "complete" : "pending";
}

const SALE_PRICE_MAX_CENTS = 1_000_000_000;

export function effectiveSalePriceCents(
  row: { salePriceCents?: number | null },
  listing: { priceCents?: number | null } | null | undefined,
) {
  const stored = Number(row.salePriceCents ?? 0);
  if (Number.isSafeInteger(stored) && stored > 0) return stored;
  const listed = Number(listing?.priceCents ?? 0);
  return Number.isSafeInteger(listed) && listed > 0 ? listed : 0;
}

export function conversationCompleted(row: {
  buyerSaleStatus?: string | null;
  sellerSaleStatus?: string | null;
  buyerConfirmedAt?: string | null;
  sellerConfirmedAt?: string | null;
}) {
  return (
    partySaleStatus(row, "buyer") === "complete" &&
    partySaleStatus(row, "seller") === "complete"
  );
}

export async function ensureProfile(
  db: Db,
  userId: string,
  displayName: string,
) {
  const updatedAt = new Date().toISOString();
  await db
    .insert(profiles)
    .values({
      id: userId,
      displayName: displayName.trim() || "Marketplace user",
      updatedAt,
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: { displayName: displayName.trim() || "Marketplace user", updatedAt },
    });
}

export async function startConversation(
  db: Db,
  actor: ConversationActor,
  listingId: string,
) {
  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!listing) {
    return { ok: false as const, status: 404, error: "Listing not found." };
  }
  if (listing.status !== "active") {
    return {
      ok: false as const,
      status: 409,
      error: "This listing is no longer available to message.",
    };
  }
  if (listing.sellerId === actor.id) {
    return {
      ok: false as const,
      status: 400,
      error: "You cannot message your own listing.",
    };
  }

  await ensureProfile(db, actor.id, actor.name);
  await ensureProfile(db, listing.sellerId, listing.sellerName);

  const [existing] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.listingId, listing.id),
        eq(conversations.buyerId, actor.id),
      ),
    )
    .limit(1);
  if (existing) {
    return {
      ok: true as const,
      created: false,
      conversation: await conversationPayload(db, existing.id, actor.id),
    };
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.insert(conversations).values({
    id,
    listingId: listing.id,
    buyerId: actor.id,
    sellerId: listing.sellerId,
    salePriceCents: listing.priceCents,
    buyerMarksSafe: false,
    createdAt: now,
    updatedAt: now,
  });
  return {
    ok: true as const,
    created: true,
    conversation: await conversationPayload(db, id, actor.id),
  };
}

export async function listConversations(db: Db, userId: string) {
  const rows = await db
    .select()
    .from(conversations)
    .where(
      or(eq(conversations.buyerId, userId), eq(conversations.sellerId, userId)),
    )
    .orderBy(desc(conversations.updatedAt), desc(conversations.id))
    .limit(80);
  const payloads = [];
  for (const row of rows) {
    const payload = await conversationPayload(db, row.id, userId);
    if (payload) payloads.push(payload);
  }
  return payloads;
}

export async function getConversationForUser(
  db: Db,
  conversationId: string,
  userId: string,
) {
  return conversationPayload(db, conversationId, userId);
}

export async function listMessages(
  db: Db,
  conversationId: string,
  userId: string,
) {
  const conversation = await conversationPayload(db, conversationId, userId);
  if (!conversation) return null;
  const messages = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(conversationMessages.createdAt)
    .limit(200);
  return { conversation, messages };
}

export async function sendMessage(
  db: Db,
  actor: ConversationActor,
  conversationId: string,
  rawBody: string,
) {
  const conversation = await conversationPayload(db, conversationId, actor.id);
  if (!conversation) {
    return { ok: false as const, status: 404, error: "Conversation not found." };
  }
  const body = rawBody.trim();
  if (!body) {
    return { ok: false as const, status: 400, error: "Enter a message." };
  }
  if (body.length > MESSAGE_MAX_LENGTH) {
    return {
      ok: false as const,
      status: 400,
      error: `Messages are limited to ${MESSAGE_MAX_LENGTH} characters.`,
    };
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await db
    .select({ id: conversationMessages.id })
    .from(conversationMessages)
    .where(
      and(
        eq(conversationMessages.senderId, actor.id),
        gte(conversationMessages.createdAt, hourAgo),
      ),
    );
  if (recent.length >= MESSAGE_HOUR_LIMIT) {
    return {
      ok: false as const,
      status: 429,
      error: "Too many messages in the last hour. Try again later.",
    };
  }

  const now = new Date().toISOString();
  const message = {
    id: crypto.randomUUID(),
    conversationId,
    senderId: actor.id,
    body,
    createdAt: now,
  };
  await db.insert(conversationMessages).values(message);
  await db
    .update(conversations)
    .set({ lastMessageAt: now, updatedAt: now })
    .where(eq(conversations.id, conversationId));
  return { ok: true as const, message };
}

async function wipeConversation(db: Db, conversationId: string) {
  await db
    .delete(conversationMedia)
    .where(eq(conversationMedia.conversationId, conversationId));
  await db
    .delete(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId));
  await db.delete(conversations).where(eq(conversations.id, conversationId));
}

export async function cancelConversation(
  db: Db,
  actor: ConversationActor,
  conversationId: string,
  action: "request" | "withdraw" = "request",
) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!row || (row.buyerId !== actor.id && row.sellerId !== actor.id)) {
    return { ok: false as const, status: 404, error: "Conversation not found." };
  }
  if (conversationCompleted(row)) {
    return {
      ok: false as const,
      status: 409,
      error: "This sale is complete and cannot be cancelled.",
    };
  }

  const isBuyer = row.buyerId === actor.id;
  const myRequestedAt = isBuyer
    ? row.buyerCancelRequestedAt
    : row.sellerCancelRequestedAt;
  const otherRequestedAt = isBuyer
    ? row.sellerCancelRequestedAt
    : row.buyerCancelRequestedAt;
  const now = new Date().toISOString();

  if (action === "withdraw") {
    if (isBuyer) {
      await db
        .update(conversations)
        .set({ buyerCancelRequestedAt: null, updatedAt: now })
        .where(eq(conversations.id, conversationId));
    } else {
      await db
        .update(conversations)
        .set({ sellerCancelRequestedAt: null, updatedAt: now })
        .where(eq(conversations.id, conversationId));
    }
    return {
      ok: true as const,
      deleted: false as const,
      conversation: await conversationPayload(db, conversationId, actor.id),
    };
  }

  if (action !== "request") {
    return {
      ok: false as const,
      status: 400,
      error: "Choose request or withdraw.",
    };
  }

  if (otherRequestedAt) {
    await wipeConversation(db, conversationId);
    return { ok: true as const, deleted: true as const };
  }

  if (!myRequestedAt) {
    if (isBuyer) {
      await db
        .update(conversations)
        .set({ buyerCancelRequestedAt: now, updatedAt: now })
        .where(eq(conversations.id, conversationId));
    } else {
      await db
        .update(conversations)
        .set({ sellerCancelRequestedAt: now, updatedAt: now })
        .where(eq(conversations.id, conversationId));
    }
  }

  return {
    ok: true as const,
    deleted: false as const,
    conversation: await conversationPayload(db, conversationId, actor.id),
  };
}

export type SaleEvidenceInput = {
  trackingNumber?: unknown;
  paymentReceipt?: unknown;
  receivedItem?: unknown;
  receivedPackaging?: unknown;
  shippedItem?: unknown;
  shippedPackaging?: unknown;
};

function evidenceFromRow(row: {
  trackingNumber?: string | null;
  paymentReceiptJson?: string | null;
  receivedItemJson?: string | null;
  receivedPackagingJson?: string | null;
  shippedItemJson?: string | null;
  shippedPackagingJson?: string | null;
  evidenceRequestNote?: string | null;
  evidenceRequestedAt?: string | null;
}) {
  return {
    trackingNumber: row.trackingNumber?.trim() || null,
    paymentReceipt: parseSalePhotoJson(row.paymentReceiptJson, "paymentReceipt"),
    receivedItem: parseSalePhotoJson(row.receivedItemJson, "receivedItem"),
    receivedPackaging: parseSalePhotoJson(
      row.receivedPackagingJson,
      "receivedPackaging",
    ),
    shippedItem: parseSalePhotoJson(row.shippedItemJson, "shippedItem"),
    shippedPackaging: parseSalePhotoJson(
      row.shippedPackagingJson,
      "shippedPackaging",
    ),
    evidenceRequestNote: row.evidenceRequestNote?.trim() || null,
    evidenceRequestedAt: row.evidenceRequestedAt || null,
  };
}

function isShippingEvidencePatch(patch: Record<string, string | null>) {
  return (
    "trackingNumber" in patch ||
    "shippedItemJson" in patch ||
    "shippedPackagingJson" in patch
  );
}

function readEvidencePatch(
  role: "buyer" | "seller",
  input: SaleEvidenceInput | undefined,
):
  | { ok: true; patch: Record<string, string | null> }
  | { ok: false; status: number; error: string } {
  if (!input) return { ok: true, patch: {} };
  const patch: Record<string, string | null> = {};
  if (input.trackingNumber !== undefined) {
    if (role !== "seller") {
      return {
        ok: false,
        status: 403,
        error: "Only the seller can add the tracking number.",
      };
    }
    const trackingNumber = requireActualTrackingNumber(input.trackingNumber);
    if (!trackingNumber) {
      return {
        ok: false,
        status: 400,
        error: "Enter the actual UPS, USPS, FedEx, or DHL tracking number for this item.",
      };
    }
    patch.trackingNumber = trackingNumber;
  }
  const sellerPhotoFields = [
    ["shippedItem", "shippedItemJson", "item"],
    ["shippedPackaging", "shippedPackagingJson", "shipping box"],
  ] as const;
  const buyerPhotoFields = [
    ["paymentReceipt", "paymentReceiptJson", "payment receipt"],
    ["receivedItem", "receivedItemJson", "product photo"],
    ["receivedPackaging", "receivedPackagingJson", "packaging photo"],
  ] as const;
  for (const [key, column, label] of sellerPhotoFields) {
    if (input[key] === undefined) continue;
    if (role !== "seller") {
      return {
        ok: false,
        status: 403,
        error: `Only the seller can upload the ${label} photo.`,
      };
    }
    const photos = sanitizeSalePhotos(input[key], key);
    if (!photos.length) {
      return {
        ok: false,
        status: 400,
        error: `Upload a photo of the ${label}. Image bytes stay off this registry.`,
      };
    }
    patch[column] = serializeSalePhoto(photos);
  }
  for (const [key, column, label] of buyerPhotoFields) {
    if (input[key] === undefined) continue;
    if (role !== "buyer") {
      return {
        ok: false,
        status: 403,
        error: `Only the buyer can upload the ${label}.`,
      };
    }
    const photos = sanitizeSalePhotos(input[key], key);
    if (!photos.length) {
      return {
        ok: false,
        status: 400,
        error: `Upload a photo of the ${label}. Image bytes stay off this registry.`,
      };
    }
    patch[column] = serializeSalePhoto(photos);
  }
  return { ok: true, patch };
}

async function storeEvidencePhotos(
  db: Db,
  conversationId: string,
  role: "buyer" | "seller",
  input: SaleEvidenceInput | undefined,
) {
  if (!input) return { ok: true as const };
  const fields: Array<[keyof SaleEvidenceInput, SalePhotoKind, string]> =
    role === "seller"
      ? [
          ["shippedItem", "shippedItem", "shippedItemJson"],
          ["shippedPackaging", "shippedPackaging", "shippedPackagingJson"],
        ]
      : [
          ["paymentReceipt", "paymentReceipt", "paymentReceiptJson"],
          ["receivedItem", "receivedItem", "receivedItemJson"],
          ["receivedPackaging", "receivedPackaging", "receivedPackagingJson"],
        ];
  const jsonPatch: Record<string, string | null> = {};
  for (const [key, kind, column] of fields) {
    if (input[key] === undefined) continue;
    const verified = await verifySalePhotoUploads(input[key], kind);
    if (!verified.ok) {
      return { ok: false as const, status: 400, error: verified.error };
    }
    await db
      .delete(conversationMedia)
      .where(
        and(
          eq(conversationMedia.conversationId, conversationId),
          eq(conversationMedia.kind, kind),
        ),
      );
    for (const [slot, item] of verified.items.entries()) {
      await db.insert(conversationMedia).values({
        id: crypto.randomUUID(),
        conversationId,
        hash: item.manifest.hash,
        kind,
        slot,
        name: item.manifest.name,
        type: item.manifest.type,
        size: item.manifest.size,
        bytesBase64: item.bytesBase64,
        exifJson: item.exif ? JSON.stringify(item.exif) : null,
        quality: item.manifest.quality ?? "full",
        width: item.exif.width ?? item.manifest.width ?? null,
        height: item.exif.height ?? item.manifest.height ?? null,
      });
    }
    jsonPatch[column] = serializeSalePhoto(
      verified.items.map((item) => item.manifest),
    );
  }
  return { ok: true as const, jsonPatch };
}

export async function getConversationMedia(
  db: Db,
  actor: ConversationActor,
  conversationId: string,
  hash: string,
) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!row || (row.buyerId !== actor.id && row.sellerId !== actor.id)) {
    return { ok: false as const, status: 404, error: "Conversation not found." };
  }
  const [media] = await db
    .select()
    .from(conversationMedia)
    .where(
      and(
        eq(conversationMedia.conversationId, conversationId),
        eq(conversationMedia.hash, hash),
      ),
    )
    .limit(1);
  if (!media) {
    return { ok: false as const, status: 404, error: "Sale photo not found." };
  }
  const bytes = Uint8Array.from(atob(media.bytesBase64), (char) =>
    char.charCodeAt(0),
  );
  return {
    ok: true as const,
    name: media.name,
    type: media.type,
    bytes,
  };
}

function markEvidenceJsonArchival(
  jsonPatch: Record<string, string | null> | undefined,
) {
  if (!jsonPatch) return {};
  const next: Record<string, string | null> = {};
  for (const [column, value] of Object.entries(jsonPatch)) {
    if (!value) {
      next[column] = value;
      continue;
    }
    try {
      const parsed = JSON.parse(value) as unknown;
      const list = Array.isArray(parsed) ? parsed : [parsed];
      next[column] = JSON.stringify(
        list.map((item) =>
          item && typeof item === "object"
            ? { ...item, quality: "archival" }
            : item,
        ),
      );
    } catch {
      next[column] = value;
    }
  }
  return next;
}

export async function archiveConversationEvidence(
  db: Db,
  actor: ConversationActor,
  conversationId: string,
  photos: SaleEvidenceInput,
) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!row || (row.buyerId !== actor.id && row.sellerId !== actor.id)) {
    return { ok: false as const, status: 404, error: "Conversation not found." };
  }
  if (!conversationCompleted(row)) {
    return {
      ok: false as const,
      status: 409,
      error: "Evidence stays full size until both people mark Complete.",
    };
  }
  const completedAt = laterTimestamp(row.buyerConfirmedAt, row.sellerConfirmedAt);
  if (!evidenceArchiveDue(completedAt)) {
    return {
      ok: false as const,
      status: 409,
      error: "Full-size evidence stays available for seven days after Complete.",
    };
  }
  const stored = await storeEvidencePhotos(db, conversationId, "seller", {
    shippedItem: photos.shippedItem,
    shippedPackaging: photos.shippedPackaging,
  });
  if (!stored.ok) return stored;
  const buyerStored = await storeEvidencePhotos(db, conversationId, "buyer", {
    paymentReceipt: photos.paymentReceipt,
    receivedItem: photos.receivedItem,
    receivedPackaging: photos.receivedPackaging,
  });
  if (!buyerStored.ok) return buyerStored;
  const now = new Date().toISOString();
  await db
    .update(conversations)
    .set({
      ...markEvidenceJsonArchival(stored.jsonPatch),
      ...markEvidenceJsonArchival(buyerStored.jsonPatch),
      evidenceArchivedAt: now,
      updatedAt: now,
    })
    .where(eq(conversations.id, conversationId));
  await db
    .update(listings)
    .set({ archivedAt: now, updatedAt: now })
    .where(eq(listings.id, row.listingId));
  await db
    .update(conversationMedia)
    .set({ quality: "archival" })
    .where(eq(conversationMedia.conversationId, conversationId));
  return {
    ok: true as const,
    conversation: await conversationPayload(db, conversationId, actor.id),
  };
}

export async function updateSaleEvidence(
  db: Db,
  actor: ConversationActor,
  conversationId: string,
  input: SaleEvidenceInput,
) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!row || (row.buyerId !== actor.id && row.sellerId !== actor.id)) {
    return { ok: false as const, status: 404, error: "Conversation not found." };
  }
  if (conversationCompleted(row)) {
    return {
      ok: false as const,
      status: 409,
      error: "This sale is complete and the proof cannot be changed.",
    };
  }
  const role = row.buyerId === actor.id ? "buyer" : "seller";
  if (partySaleStatus(row, role) === "complete") {
    return {
      ok: false as const,
      status: 409,
      error: "Complete proof cannot be changed.",
    };
  }
  const parsed = readEvidencePatch(role, input);
  if (!parsed.ok) {
    return { ok: false as const, status: parsed.status, error: parsed.error };
  }
  if (!Object.keys(parsed.patch).length) {
    return {
      ok: false as const,
      status: 400,
      error: "Add a tracking number or a sale photo.",
    };
  }
  const buyerAccepted =
    partySaleStatus(row, "buyer") === "in_transfer" ||
    partySaleStatus(row, "buyer") === "complete";
  const requestOpen = Boolean(row.evidenceRequestedAt);
  if (
    role === "seller" &&
    buyerAccepted &&
    !requestOpen &&
    isShippingEvidencePatch(parsed.patch)
  ) {
    return {
      ok: false as const,
      status: 409,
      error:
        "The buyer accepted this shipping evidence. They can ask for additional evidence if something is missing.",
    };
  }
  const nextPatch: Record<string, string | null> = { ...parsed.patch };
  if (role === "seller" && isShippingEvidencePatch(parsed.patch)) {
    nextPatch.evidenceRequestNote = null;
    nextPatch.evidenceRequestedAt = null;
  }
  const stored = await storeEvidencePhotos(db, conversationId, role, input);
  if (!stored.ok) {
    return { ok: false as const, status: stored.status, error: stored.error };
  }
  await db
    .update(conversations)
    .set({
      ...nextPatch,
      ...stored.jsonPatch,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(conversations.id, conversationId));
  return {
    ok: true as const,
    conversation: await conversationPayload(db, conversationId, actor.id),
  };
}

export async function setSaleStatus(
  db: Db,
  actor: ConversationActor,
  conversationId: string,
  status: SaleStatus,
  evidence?: SaleEvidenceInput,
) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!row || (row.buyerId !== actor.id && row.sellerId !== actor.id)) {
    return { ok: false as const, status: 404, error: "Conversation not found." };
  }

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, row.listingId))
    .limit(1);
  if (!listing) {
    return { ok: false as const, status: 404, error: "Listing not found." };
  }
  if (listing.status === "sold" && !conversationCompleted(row)) {
    return {
      ok: false as const,
      status: 409,
      error: "This listing was already sold in another conversation.",
    };
  }

  const isBuyer = row.buyerId === actor.id;
  const myStatus = partySaleStatus(row, isBuyer ? "buyer" : "seller");
  if (conversationCompleted(row) && status !== "complete") {
    return {
      ok: false as const,
      status: 409,
      error: "This sale is complete and cannot be reversed.",
    };
  }
  if (myStatus === "complete" && status !== "complete") {
    return {
      ok: false as const,
      status: 409,
      error: "Complete cannot be reversed.",
    };
  }

  const role = isBuyer ? "buyer" : "seller";
  if (role === "buyer" && status === "in_transfer") {
    return {
      ok: false as const,
      status: 403,
      error: "Only the seller marks In-Transfer. Accept the shipping evidence instead.",
    };
  }
  if (role === "buyer" && status === "complete") {
    const sellerStatus = partySaleStatus(row, "seller");
    if (sellerStatus !== "in_transfer" && sellerStatus !== "complete") {
      return {
        ok: false as const,
        status: 409,
        error: "Wait for the seller to submit In-Transfer shipping evidence.",
      };
    }
    if (myStatus !== "in_transfer") {
      return {
        ok: false as const,
        status: 400,
        error: "Accept the shipping evidence before marking Complete.",
      };
    }
  }
  const parsed = readEvidencePatch(role, evidence);
  if (!parsed.ok) {
    return { ok: false as const, status: parsed.status, error: parsed.error };
  }
  const nextEvidence = evidenceFromRow({
    ...row,
    ...parsed.patch,
  });
  const missing = saleEvidenceMissing(role, status, nextEvidence);
  if (missing) {
    return { ok: false as const, status: 400, error: missing };
  }
  if (role === "seller" && isShippingEvidencePatch(parsed.patch)) {
    parsed.patch.evidenceRequestNote = null;
    parsed.patch.evidenceRequestedAt = null;
  }
  const stored = await storeEvidencePhotos(db, conversationId, role, evidence);
  if (!stored.ok) {
    return { ok: false as const, status: stored.status, error: stored.error };
  }

  if (myStatus === status && !Object.keys(parsed.patch).length) {
    return {
      ok: true as const,
      conversation: await conversationPayload(db, conversationId, actor.id),
    };
  }

  const now = new Date().toISOString();
  const nextBuyerStatus = isBuyer ? status : partySaleStatus(row, "buyer");
  const nextSellerStatus = isBuyer ? partySaleStatus(row, "seller") : status;
  const nextBuyerConfirmedAt =
    nextBuyerStatus === "complete" ? row.buyerConfirmedAt ?? now : null;
  const nextSellerConfirmedAt =
    nextSellerStatus === "complete" ? row.sellerConfirmedAt ?? now : null;
  await db
    .update(conversations)
    .set({
      ...parsed.patch,
      ...stored.jsonPatch,
      buyerSaleStatus: nextBuyerStatus,
      sellerSaleStatus: nextSellerStatus,
      buyerConfirmedAt: nextBuyerConfirmedAt,
      sellerConfirmedAt: nextSellerConfirmedAt,
      updatedAt: now,
    })
    .where(eq(conversations.id, conversationId));

  if (
    nextBuyerStatus === "complete" &&
    nextSellerStatus === "complete" &&
    listing.status === "active"
  ) {
    const [existingSale] = await db
      .select({ id: saleHistory.id })
      .from(saleHistory)
      .where(eq(saleHistory.listingId, listing.id))
      .limit(1);
    if (!existingSale) {
      await completeSale(
        db,
        {
          ...row,
          buyerSaleStatus: nextBuyerStatus,
          sellerSaleStatus: nextSellerStatus,
          buyerConfirmedAt: nextBuyerConfirmedAt,
          sellerConfirmedAt: nextSellerConfirmedAt,
        },
        listing,
        now,
      );
    }
  }

  return {
    ok: true as const,
    conversation: await conversationPayload(db, conversationId, actor.id),
  };
}

export async function acceptSaleEvidence(
  db: Db,
  actor: ConversationActor,
  conversationId: string,
  evidence?: SaleEvidenceInput,
) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!row || (row.buyerId !== actor.id && row.sellerId !== actor.id)) {
    return { ok: false as const, status: 404, error: "Conversation not found." };
  }
  if (row.buyerId !== actor.id) {
    return {
      ok: false as const,
      status: 403,
      error: "Only the buyer can accept shipping evidence.",
    };
  }
  if (conversationCompleted(row) || partySaleStatus(row, "buyer") === "complete") {
    return {
      ok: false as const,
      status: 409,
      error: "This sale is complete and the proof cannot be changed.",
    };
  }
  const sellerStatus = partySaleStatus(row, "seller");
  if (sellerStatus !== "in_transfer" && sellerStatus !== "complete") {
    return {
      ok: false as const,
      status: 409,
      error: "Wait for the seller to submit In-Transfer shipping evidence.",
    };
  }
  const parsed = readEvidencePatch("buyer", evidence);
  if (!parsed.ok) {
    return { ok: false as const, status: parsed.status, error: parsed.error };
  }
  const nextEvidence = evidenceFromRow({
    ...row,
    ...parsed.patch,
  });
  const shippingMissing = saleEvidenceMissing("seller", "in_transfer", nextEvidence);
  if (shippingMissing) {
    return { ok: false as const, status: 409, error: shippingMissing };
  }
  const stored = await storeEvidencePhotos(db, conversationId, "buyer", evidence);
  if (!stored.ok) {
    return { ok: false as const, status: stored.status, error: stored.error };
  }

  const now = new Date().toISOString();
  await db
    .update(conversations)
    .set({
      ...parsed.patch,
      ...stored.jsonPatch,
      buyerSaleStatus: "in_transfer",
      evidenceRequestNote: null,
      evidenceRequestedAt: null,
      updatedAt: now,
    })
    .where(eq(conversations.id, conversationId));
  return {
    ok: true as const,
    conversation: await conversationPayload(db, conversationId, actor.id),
  };
}

export async function requestAdditionalEvidence(
  db: Db,
  actor: ConversationActor,
  conversationId: string,
  rawNote: unknown,
) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!row || (row.buyerId !== actor.id && row.sellerId !== actor.id)) {
    return { ok: false as const, status: 404, error: "Conversation not found." };
  }
  if (row.buyerId !== actor.id) {
    return {
      ok: false as const,
      status: 403,
      error: "Only the buyer can ask for additional shipping evidence.",
    };
  }
  if (conversationCompleted(row) || partySaleStatus(row, "buyer") === "complete") {
    return {
      ok: false as const,
      status: 409,
      error: "This sale is complete and the proof cannot be changed.",
    };
  }
  if (partySaleStatus(row, "seller") !== "in_transfer") {
    return {
      ok: false as const,
      status: 409,
      error: "Wait for the seller to submit In-Transfer shipping evidence.",
    };
  }
  const note = typeof rawNote === "string" ? rawNote.trim() : "";
  if (
    note.length < EVIDENCE_REQUEST_NOTE_MIN ||
    note.length > EVIDENCE_REQUEST_NOTE_MAX
  ) {
    return {
      ok: false as const,
      status: 400,
      error: `Explain what is missing in ${EVIDENCE_REQUEST_NOTE_MIN}–${EVIDENCE_REQUEST_NOTE_MAX} characters.`,
    };
  }
  const now = new Date().toISOString();
  await db
    .update(conversations)
    .set({
      evidenceRequestNote: note,
      evidenceRequestedAt: now,
      buyerSaleStatus:
        partySaleStatus(row, "buyer") === "in_transfer"
          ? "pending"
          : partySaleStatus(row, "buyer"),
      updatedAt: now,
    })
    .where(eq(conversations.id, conversationId));
  return {
    ok: true as const,
    conversation: await conversationPayload(db, conversationId, actor.id),
  };
}

export async function updatePaypalSale(
  db: Db,
  actor: ConversationActor,
  conversationId: string,
  patch: {
    salePriceCents?: number;
    buyerMarksSafe?: boolean;
  },
) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!row || (row.buyerId !== actor.id && row.sellerId !== actor.id)) {
    return { ok: false as const, status: 404, error: "Conversation not found." };
  }

  const hasPrice = patch.salePriceCents !== undefined;
  const hasSafe = patch.buyerMarksSafe !== undefined;
  if (!hasPrice && !hasSafe) {
    return {
      ok: false as const,
      status: 400,
      error: "Set a sale price or Friends and Family choice.",
    };
  }

  const isBuyer = row.buyerId === actor.id;
  if (hasPrice && isBuyer) {
    return {
      ok: false as const,
      status: 403,
      error: "Only the seller can change the sale price.",
    };
  }
  if (hasSafe && !isBuyer) {
    return {
      ok: false as const,
      status: 403,
      error: "Only the buyer can mark this sale safe for Friends and Family.",
    };
  }

  const next: {
    updatedAt: string;
    salePriceCents?: number;
    buyerMarksSafe?: boolean;
  } = { updatedAt: new Date().toISOString() };

  if (hasPrice) {
    const salePriceCents = Number(patch.salePriceCents);
    if (
      !Number.isSafeInteger(salePriceCents) ||
      salePriceCents < 1 ||
      salePriceCents > SALE_PRICE_MAX_CENTS
    ) {
      return {
        ok: false as const,
        status: 400,
        error: "Enter a sale price greater than zero.",
      };
    }
    next.salePriceCents = salePriceCents;
  }
  if (hasSafe) {
    next.buyerMarksSafe = Boolean(patch.buyerMarksSafe);
  }

  await db
    .update(conversations)
    .set(next)
    .where(eq(conversations.id, conversationId));

  return {
    ok: true as const,
    conversation: await conversationPayload(db, conversationId, actor.id),
  };
}

export async function submitRating(
  db: Db,
  actor: ConversationActor,
  conversationId: string,
  score: number,
  rawNote: string,
) {
  const conversation = await conversationPayload(db, conversationId, actor.id);
  if (!conversation) {
    return { ok: false as const, status: 404, error: "Conversation not found." };
  }
  if (!conversation.completed) {
    return {
      ok: false as const,
      status: 409,
      error: "Both people must mark the sale complete before rating.",
    };
  }
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return { ok: false as const, status: 400, error: "Choose a rating from 1 to 5." };
  }
  const note = rawNote.trim();
  if (note.length < RATING_NOTE_MIN || note.length > RATING_NOTE_MAX) {
    return {
      ok: false as const,
      status: 400,
      error: `Explain the rating in ${RATING_NOTE_MIN}–${RATING_NOTE_MAX} characters.`,
    };
  }
  if (conversation.myRating) {
    return {
      ok: false as const,
      status: 409,
      error: "You already rated this sale.",
    };
  }

  const subjectId =
    conversation.myRole === "buyer" ? conversation.sellerId : conversation.buyerId;
  const role = conversation.myRole === "buyer" ? "seller" : "buyer";
  await ensureProfile(
    db,
    subjectId,
    conversation.myRole === "buyer"
      ? conversation.sellerName
      : conversation.buyerName,
  );
  await db.insert(reputationRatings).values({
    id: crypto.randomUUID(),
    listingId: conversation.listingId,
    subjectId,
    raterId: actor.id,
    role,
    score,
    note,
  });
  await recomputeProfileReputation(db, subjectId);
  return {
    ok: true as const,
    conversation: await conversationPayload(db, conversationId, actor.id),
  };
}

export async function listSaleHistory(db: Db, userId: string) {
  const rows = await db
    .select()
    .from(saleHistory)
    .where(or(eq(saleHistory.buyerId, userId), eq(saleHistory.sellerId, userId)))
    .orderBy(desc(saleHistory.soldAt))
    .limit(80);
  const listingIds = rows.map((row) => row.listingId);
  const partyIds = [...new Set(rows.flatMap((row) => [row.buyerId, row.sellerId]))];
  const [ratings, partyProfiles] = await Promise.all([
    listingIds.length
      ? db
          .select()
          .from(reputationRatings)
          .where(inArray(reputationRatings.listingId, listingIds))
      : Promise.resolve([]),
    partyIds.length
      ? db.select().from(profiles).where(inArray(profiles.id, partyIds))
      : Promise.resolve([]),
  ]);
  const nameById = new Map(
    partyProfiles.map((profile) => [profile.id, profile.displayName]),
  );
  return rows.map((row) => {
    const myRole = row.buyerId === userId ? "buyer" : "seller";
    const otherPartyId = myRole === "buyer" ? row.sellerId : row.buyerId;
    const myRating = ratings.find(
      (rating) =>
        rating.listingId === row.listingId &&
        rating.raterId === userId &&
        rating.role === (myRole === "buyer" ? "seller" : "buyer"),
    );
    return {
      id: row.id,
      listingId: row.listingId,
      conversationId: row.conversationId,
      title: row.title,
      priceCents: row.priceCents,
      currency: row.currency,
      soldAt: row.soldAt,
      myRole,
      otherPartyId,
      otherPartyName: nameById.get(otherPartyId) ?? "Marketplace user",
      myRating: myRating
        ? { score: myRating.score, note: myRating.note }
        : null,
    };
  });
}

async function completeSale(
  db: Db,
  row: typeof conversations.$inferSelect,
  listing: typeof listings.$inferSelect,
  soldAt: string,
) {
  await db
    .update(listings)
    .set({ status: "sold", updatedAt: soldAt })
    .where(eq(listings.id, listing.id));

  const [sellerProfile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, listing.sellerId))
    .limit(1);
  const itemsSold = (sellerProfile?.itemsSold ?? 0) + 1;
  const socialCreditScore = computeSocialCreditScore({
    sellerRating: sellerProfile?.sellerRating,
    sellerRatingCount: sellerProfile?.sellerRatingCount,
    buyerRating: sellerProfile?.buyerRating,
    buyerRatingCount: sellerProfile?.buyerRatingCount,
    itemsSold,
  });
  if (sellerProfile) {
    await db
      .update(profiles)
      .set({ itemsSold, socialCreditScore, updatedAt: soldAt })
      .where(eq(profiles.id, listing.sellerId));
  } else {
    await db.insert(profiles).values({
      id: listing.sellerId,
      displayName: listing.sellerName,
      itemsSold,
      socialCreditScore,
      updatedAt: soldAt,
    });
  }

  await db.insert(saleHistory).values({
    id: crypto.randomUUID(),
    listingId: listing.id,
    conversationId: row.id,
    buyerId: row.buyerId,
    sellerId: row.sellerId,
    title: listing.title,
    priceCents: effectiveSalePriceCents(row, listing),
    currency: listing.currency,
    soldAt,
  });
}

async function recomputeProfileReputation(db: Db, subjectId: string) {
  const ratings = await db
    .select()
    .from(reputationRatings)
    .where(eq(reputationRatings.subjectId, subjectId));
  const sellerScores = ratings
    .filter((rating) => rating.role === "seller")
    .map((rating) => rating.score);
  const buyerScores = ratings
    .filter((rating) => rating.role === "buyer")
    .map((rating) => rating.score);
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, subjectId))
    .limit(1);
  const sellerRating = average(sellerScores);
  const buyerRating = average(buyerScores);
  const socialCreditScore = computeSocialCreditScore({
    sellerRating,
    sellerRatingCount: sellerScores.length,
    buyerRating,
    buyerRatingCount: buyerScores.length,
    itemsSold: profile?.itemsSold ?? 0,
  });
  const updatedAt = new Date().toISOString();
  if (profile) {
    await db
      .update(profiles)
      .set({
        sellerRating,
        sellerRatingCount: sellerScores.length,
        buyerRating,
        buyerRatingCount: buyerScores.length,
        socialCreditScore,
        updatedAt,
      })
      .where(eq(profiles.id, subjectId));
    return;
  }
  const [user] = await db
    .select({ name: authUsers.name })
    .from(authUsers)
    .where(eq(authUsers.id, subjectId))
    .limit(1);
  await db.insert(profiles).values({
    id: subjectId,
    displayName: user?.name ?? "Marketplace user",
    sellerRating,
    sellerRatingCount: sellerScores.length,
    buyerRating,
    buyerRatingCount: buyerScores.length,
    socialCreditScore,
    updatedAt,
  });
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function conversationPayload(db: Db, conversationId: string, userId: string) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!row || (row.buyerId !== userId && row.sellerId !== userId)) return null;

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, row.listingId))
    .limit(1);
  const [buyer] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, row.buyerId))
    .limit(1);
  const [seller] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, row.sellerId))
    .limit(1);
  const [buyerUser] = buyer
    ? []
    : await db
        .select({ name: authUsers.name })
        .from(authUsers)
        .where(eq(authUsers.id, row.buyerId))
        .limit(1);
  const ratings = await db
    .select()
    .from(reputationRatings)
    .where(eq(reputationRatings.listingId, row.listingId));
  const myRole = row.buyerId === userId ? "buyer" : "seller";
  const myRatingRole = myRole === "buyer" ? "seller" : "buyer";
  const myRating = ratings.find(
    (rating) => rating.raterId === userId && rating.role === myRatingRole,
  );
  const otherRating = ratings.find(
    (rating) => rating.raterId !== userId && rating.listingId === row.listingId,
  );
  const [lastMessage] = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(desc(conversationMessages.createdAt))
    .limit(1);
  const [sale] = await db
    .select({ soldAt: saleHistory.soldAt })
    .from(saleHistory)
    .where(eq(saleHistory.listingId, row.listingId))
    .limit(1);
  const salePriceCents = effectiveSalePriceCents(row, listing);
  const paypalDestination =
    parsePaymentDestinationsJson(seller?.paymentDestinationsJson).find(
      (destination) => destination.rail === "paypal",
    ) ?? null;
  const paypalKind = row.buyerMarksSafe
    ? "friends_and_family"
    : "goods_and_services";
  const paypalPayHrefValue = paypalDestination
    ? paypalPayHref({
        destination: paypalDestination.destination,
        amountCents: salePriceCents,
        currency: listing?.currency ?? "USD",
        itemName: listing?.title ?? "Marketplace listing",
        kind: paypalKind,
      })
    : null;

  return {
    id: row.id,
    listingId: row.listingId,
    listingTitle: listing?.title ?? "Listing",
    listingStatus: listing?.status ?? "active",
    listingPriceCents: listing?.priceCents ?? 0,
    listingCurrency: listing?.currency ?? "USD",
    salePriceCents,
    buyerMarksSafe: Boolean(row.buyerMarksSafe),
    paypalDestination: paypalDestination?.destination ?? null,
    paypalLinked: paypalDestination?.source === "oauth",
    paypalKind,
    paypalPayHref: paypalPayHrefValue,
    soldAt: sale?.soldAt ?? null,
    buyerId: row.buyerId,
    sellerId: row.sellerId,
    buyerName: buyer?.displayName ?? buyerUser?.name ?? "Buyer",
    sellerName: seller?.displayName ?? listing?.sellerName ?? "Seller",
    lastMessageAt: row.lastMessageAt,
    lastMessagePreview: lastMessage?.body?.slice(0, 140) ?? "",
    buyerSaleStatus: partySaleStatus(row, "buyer"),
    sellerSaleStatus: partySaleStatus(row, "seller"),
    buyerConfirmedAt: row.buyerConfirmedAt,
    sellerConfirmedAt: row.sellerConfirmedAt,
    completed: conversationCompleted(row),
    myRole,
    mySaleStatus: partySaleStatus(row, myRole),
    otherSaleStatus: partySaleStatus(row, myRole === "buyer" ? "seller" : "buyer"),
    myConfirmed: partySaleStatus(row, myRole) === "complete",
    otherConfirmed:
      partySaleStatus(row, myRole === "buyer" ? "seller" : "buyer") === "complete",
    myRating: myRating ? { score: myRating.score, note: myRating.note } : null,
    otherRating: otherRating
      ? { score: otherRating.score, note: otherRating.note }
      : null,
    myCancelRequested: Boolean(
      myRole === "buyer"
        ? row.buyerCancelRequestedAt
        : row.sellerCancelRequestedAt,
    ),
    otherCancelRequested: Boolean(
      myRole === "buyer"
        ? row.sellerCancelRequestedAt
        : row.buyerCancelRequestedAt,
    ),
    completedAt: conversationCompleted(row)
      ? laterTimestamp(row.buyerConfirmedAt, row.sellerConfirmedAt)
      : null,
    evidenceArchivedAt: row.evidenceArchivedAt ?? null,
    evidenceArchiveDue:
      !row.evidenceArchivedAt &&
      evidenceArchiveDue(
        conversationCompleted(row)
          ? laterTimestamp(row.buyerConfirmedAt, row.sellerConfirmedAt)
          : null,
      ),
    ...evidenceFromRow(row),
  };
}
