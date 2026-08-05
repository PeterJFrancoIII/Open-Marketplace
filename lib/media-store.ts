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

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashFile(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${toHex(digest)}`;
}

function putAsset(database: IDBDatabase, asset: StoredAsset): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(asset);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Media could not be stored"));
  });
}

export async function storeMedia(files: File[]): Promise<MediaManifest[]> {
  if (!files.length) return [];

  const database = await openMediaDatabase();
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
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(hash);
      request.onsuccess = () => {
        const asset = request.result as StoredAsset | undefined;
        resolve(asset?.blob ? URL.createObjectURL(asset.blob) : null);
      };
      request.onerror = () => reject(request.error ?? new Error("Media could not be read"));
    });
  } finally {
    database.close();
  }
}
