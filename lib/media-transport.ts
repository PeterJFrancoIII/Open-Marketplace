import type { MediaManifest } from "./types";

/**
 * The registry never implements this interface. A browser-to-browser adapter
 * (normally WebRTC data channels) owns media discovery and transfer.
 */
export interface MediaTransport {
  announce(listingId: string, assets: MediaManifest[]): Promise<void>;
  request(
    listingId: string,
    asset: MediaManifest,
    onChunk: (chunk: Uint8Array) => void,
  ): Promise<void>;
  stop(listingId: string): Promise<void>;
}

export class TransportNotConnectedError extends Error {
  constructor() {
    super("No peer media transport has been connected to this instance.");
    this.name = "TransportNotConnectedError";
  }
}

export const disconnectedMediaTransport: MediaTransport = {
  async announce() {
    throw new TransportNotConnectedError();
  },
  async request() {
    throw new TransportNotConnectedError();
  },
  async stop() {
    // Nothing is registered while disconnected.
  },
};
