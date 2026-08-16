import {
  fetchMediaFromNode,
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
      if (node) {
        try {
          await publishMediaToNode(node, manifest.hash, file);
        } catch {
          // Local vault remains; the node copy is retried the next time this photo is stored.
        }
      }
      manifests.push(manifest);
    }
    return manifests;
  } finally {
    database.close();
  }
}

export async function getLocalMediaUrl(hash: string): Promise<string | null> {
  const database = await openMediaDatabase();
  try {
    const local = await getAsset(database, hash);
    if (local?.blob) return URL.createObjectURL(local.blob);

    const node = readMediaNodeConfig();
    if (!node) return null;
    const remote = await fetchMediaFromNode(node.origin, hash);
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
