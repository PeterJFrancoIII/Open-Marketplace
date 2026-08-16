# open-marketplace-first-public-database-host

Synology Container Manager shows this container as
`open-marketplace-first-public-database-host`. That name is the function:
it is the first full host of the public Open Marketplace database.

It stores:

- listing metadata
- public seller profiles (display name, public pay-to contacts, public social links)
- listing photos by SHA-256

It never stores passwords, session cookies, Facebook tokens, or identity
documents. Cloudflare D1 remains the public preview registry until more hosts
are reachable. This host holds a complete duplicate so the dataset is not
browser-only.

If an older container named `open-marketplace-host` or
`open-marketplace-media-node` is still running, stop and remove that name,
then start this project. The data volume can stay attached.

## Replica floor and Main decrees

- Safe minimum copies: **3** (`HOST_MIN_REPLICAS`).
- While fewer than 3 hosts are live, every host keeps a **full** copy.
- Adding hosts automatically spreads read traffic (`hash(objectId) % hostCount`).
- After at least 3 hosts exist, Main may `PUT /v1/decree` with `"mode": "sharded"`.
- Hosts then `POST /v1/scale-down`. They refuse any delete that would leave a
  record below the replica floor.

## Synology Container Manager (Arch Linux)

1. Copy this `hosting-node` folder onto the NAS.
2. Create a Container Manager project from `compose.yaml`. The image is
   `archlinux:base` plus Python. The running container must be named
   `open-marketplace-first-public-database-host`.
3. If you already have an Arch Linux container, copy these files into it,
   name that container `open-marketplace-first-public-database-host`, and
   run `python /app/server.py` with the same environment variables.
4. Set `MEDIA_NODE_WRITE_TOKEN` or `HOST_WRITE_TOKEN` to a long random value.
   Do not commit it.
5. Start the project. Confirm `http://<nas-lan-ip>:8788/health` returns
   `"role":"full-replica"` and
   `"hostId":"open-marketplace-first-public-database-host"`.
6. Put HTTPS in front of port 8788 (Synology Reverse Proxy plus a certificate,
   Tailscale Serve, or a Cloudflare Tunnel). The live preview is HTTPS, so a
   plain `http://192.168...` origin is blocked by the browser.
7. On Account settings → First database host, save the `https://` origin and
   the same write token. The token stays in this browser.
8. Publish or re-save a listing. This host then holds the listing, the public
   seller profile, and the photos.

GET by hash and GET catalog/objects are public on purpose: that data is already
public on the marketplace. PUT/DELETE/sync/decree require the write token.
