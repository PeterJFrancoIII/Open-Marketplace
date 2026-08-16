# Trusted media node (first Synology copy)

This container is the first trusted-device seed for listing photos. It stores
image bytes by SHA-256 only. It does not hold the Cloudflare D1 listing
registry and never receives Facebook tokens or identity documents.

## Synology Container Manager

1. Copy this `hosting-node` folder onto the NAS.
2. In Container Manager, create a project from `compose.yaml`.
3. Set `MEDIA_NODE_WRITE_TOKEN` to a long random value. Do not commit it.
4. Start the project. Confirm `http://<nas-lan-ip>:8788/health` returns
   `{"ok":true,"role":"trusted-media-node"}`.
5. Put HTTPS in front of port 8788 with Synology Reverse Proxy plus a
   certificate, Tailscale Serve, or a Cloudflare Tunnel. The live preview is
   HTTPS, so a plain `http://192.168...` node will be blocked by the browser.
6. On Account settings → Trusted media node, save the `https://` origin and
   the same write token. The token stays in this browser; it is not written to
   the public registry.
7. Publish or re-save a listing with photos so this node receives a copy.
   Another browser that has the same node URL can then load those photos.

GET by hash is public on purpose: listing manifests already publish the hash.
PUT requires the write token.
