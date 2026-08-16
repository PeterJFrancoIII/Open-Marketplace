import { attachMediaHosts } from "./image-manifest";
import {
  fetchMediaFromOrigins,
  publishMediaToNode,
  readMediaNodeConfig,
  toSha256Hash,
} from "./media-node";
import type { MediaManifest } from "./types";

const DATABASE_NAME = "open-exchange-media";
const DATABASE_VERSION = 1;
const STORE_NAME = "assets";

type StoredAsset = MediaManifest & {
  blob: Blob;
  storedAt: string;
};

function openMediaDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "hash" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Media database failed to open"));
  });
}

async function hashFile(file: File): Promise<string> {
  return toSha256Hash(await file.arrayBuffer());
}

function putAsset(database: IDBDatabase, asset: StoredAsset): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(asset);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Media could not be stored"));
  });
}

function getAsset(database: IDBDatabase, hash: string): Promise<StoredAsset | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(hash);
    request.onsuccess = () => resolve(request.result as StoredAsset | undefined);
    request.onerror = () => reject(request.error ?? new Error("Media could not be read"));
  });
}

function hostOriginsFor(extraOrigins: string[] = []): string[] {
  const node = readMediaNodeConfig();
  return [node?.origin, ...extraOrigins].filter((origin): origin is string => Boolean(origin));
}

export async function storeMedia(files: File[]): Promise<MediaManifest[]> {
  if (!files.length) return [];

  const database = await openMediaDatabase();
  const node = readMediaNodeConfig();
  try {
    const manifests: MediaManifest[] = [];
    for (const file of files) {
      const manifest: MediaManifest = {
        hash: await hashFile(file),
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
      };
      await putAsset(database, {
        ...manifest,
        blob: file,
        storedAt: new Date().toISOString(),
      });
      if (node?.writeToken) {
        try {
          await publishMediaToNode(node, manifest.hash, file);
        } catch {
          // pinListingMediaToHost retries from the local vault after hashing.
        }
      }
      manifests.push(node ? attachMediaHosts(manifest, [node.origin]) : manifest);
    }
    return manifests;
  } finally {
    database.close();
  }
}

export async function getLocalMediaUrl(
  hash: string,
  extraOrigins: string[] = [],
): Promise<string | null> {
  const database = await openMediaDatabase();
  try {
    const local = await getAsset(database, hash);
    if (local?.blob) return URL.createObjectURL(local.blob);

    const remote = await fetchMediaFromOrigins(hash, hostOriginsFor(extraOrigins));
    if (!remote) return null;
    await putAsset(database, {
      hash,
      name: "listing-photo",
      size: remote.size,
      type: remote.type || "application/octet-stream",
      blob: remote,
      storedAt: new Date().toISOString(),
    });
    return URL.createObjectURL(remote);
  } finally {
    database.close();
  }
}

export async function pinListingMediaToHost(
  manifests: MediaManifest[],
): Promise<MediaManifest[]> {
  const node = readMediaNodeConfig();
  if (!node?.writeToken || !manifests.length) {
    return manifests.map((manifest) => ({ ...manifest }));
  }
  const database = await openMediaDatabase();
  try {
    const pinned: MediaManifest[] = [];
    for (const manifest of manifests) {
      const local = await getAsset(database, manifest.hash);
      const blob =
        local?.blob ??
        (await fetchMediaFromOrigins(manifest.hash, hostOriginsFor(manifest.hosts)));
      if (blob) {
        await publishMediaToNode(node, manifest.hash, blob);
        if (!local?.blob) {
          await putAsset(database, {
            ...manifest,
            blob,
            storedAt: new Date().toISOString(),
          });
        }
      }
      pinned.push(attachMediaHosts(manifest, [node.origin]));
    }
    return pinned;
  } finally {
    database.close();
  }
}
