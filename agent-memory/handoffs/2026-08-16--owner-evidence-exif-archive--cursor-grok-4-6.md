---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "owner-evidence-exif-archive"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-16T22:53:00Z"
completed_at: "2026-08-16T23:06:34Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/account-management-portal"
base_commit: "8ee7dba55870822d8bdecf62fbd4d5337b578b9a"
head_commit: "uncommitted_at_handoff_write"
authority: "human_owner_explicit_request_2026-08-16"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "96adc20d240f6dd644e74981778d86eeb1e3808b"
  paths:
    - "Master_Descriptor.md"
    - "agent-memory/README.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
pull_request: 21
pull_request_state: "draft"
production_changed: false
merged: false
contains_secrets_or_private_data: false
files_changed:
  - "app/account/messages/messages-client.tsx"
  - "app/api/conversations/evidence/archive/route.ts"
  - "app/globals.css"
  - "db/schema.ts"
  - "drizzle/0011_evidence_exif_archive.sql"
  - "drizzle/meta/_journal.json"
  - "lib/conversations.ts"
  - "lib/evidence-codec.ts"
  - "lib/evidence-limits.ts"
  - "lib/evidence-photo.ts"
  - "lib/exif-jpeg.ts"
  - "lib/sale-evidence.ts"
  - "scripts/apply-local-d1-migrations.mjs"
  - "tests/chat-sale-credit.test.mjs"
  - "tests/helpers/memory-d1.mjs"
  - "agent-memory/handoffs/2026-08-16--owner-evidence-exif-archive--cursor-grok-4-6.md"
verification:
  - command: "npm run lint"
    exit_code: 0
    result: "eslint passed with existing SaleProof/lightbox no-img-element warnings and the existing messages poller exhaustive-deps warning"
  - command: "npm test"
    exit_code: 0
    result: "99 tests passed, 0 failed; new EXIF/three-photo/early-archive test; sale-flow photo fields are arrays; public listings and replica omit EXIF/GPS/archive payloads"
  - command: "preview D1 8ddff0ae-f810-4d71-955e-4aab40a00e27 apply 0011 one statement at a time"
    exit_code: 0
    result: "conversation_media gained slot, exif_json, quality, width, height; conversations.evidence_archived_at and listings.archived_at exist; unique index is now (conversation_id, kind, slot); production D1 was not queried or altered"
functional_preview_required: true
functional_preview:
  status: "ready_after_push"
  url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
  start_command: null
owner_manual_checklist:
  - "Hard-refresh the preview after the latest Pages deploy."
  - "Use two windows (normal + incognito) so seller and buyer sessions do not overwrite each other."
  - "As the seller, click In-Transfer and upload 1–3 item photos and 1–3 shipping-box photos."
  - "Confirm each evidence window shows camera/taken/size/bit-depth/file metadata under the photo."
  - "Click a photo and confirm it expands in a lightbox with the same Evidence metadata sidebar."
  - "Upload a fourth photo of one type and confirm the site stops at three."
  - "Upload an oversize or 10-bit photo and confirm this computer compresses it with the in-app encoder before upload, then EXIF still appears."
  - "As the buyer, upload 1–3 payment receipts, received-item photos, and packaging photos, then Accept Evidence and Complete."
  - "Confirm public homepage listing JSON has no EXIF, GPS, hashes, or photo bytes."
  - "Do not expect archival compression until seven days after both people mark Complete."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Codex may assign a canonical OM-FUL/OM-ACC task if this owner override should enter TASKS.md."
  - "Listing image bytes are not stored in D1, so seven-day archival cannot recompress listing photos; only listings.archived_at is stamped."
recommended_next_action: "Owner click-tests EXIF, lightbox inspect, 1–3 photos per type, and client-side oversize encode on the preview URL. Codex may review. Do not merge PR #21 or deploy production."
---

# Agent Handoff: owner-evidence-exif-archive

## Objective received

The human owner asked that uploaded sale photos keep EXIF and metadata
and show that metadata in the Evidence windows; that photos stay full
size until seven days after both parties mark Complete, then compress to
archival quality with the listing; that clicking a chat evidence photo
expands it for closer inspection; that each required evidence type needs
at least one photo and may have up to three; and that files larger than
4K 10-bit be compressed on the uploader’s computer by an encoder that
lives in the app.

## Shared-memory citations

Read canonical GitHub `PeterJFrancoIII/Open-Marketplace` `origin/main`
`96adc20d240f6dd644e74981778d86eeb1e3808b` plus local
`Master_Descriptor.md`, `agent-memory/README.md`, `agent-memory/STATE.md`,
`agent-memory/TASKS.md`, and `agent-memory/DECISIONS.md`. Canonical STATE
and TASKS remain stale versus this feature branch. No Codex-assigned
execution-ready task covered this slice. Authority is the human owner’s
explicit 2026-08-16 request.

## Work performed

- Added an in-repo JPEG EXIF parser/injector (`lib/exif-jpeg.ts`). The
  server extracts EXIF from uploaded bytes and does not trust
  client-supplied metadata.
- Conversation JSON now stores arrays of photo manifests (legacy single
  objects still parse as one-item arrays). `conversation_media` unique
  key is `(conversation_id, kind, slot)` so each kind can hold 1–3
  photos.
- Evidence windows show metadata under each thumb. Clicking a photo
  opens `EvidenceLightbox` with a larger image and an Evidence metadata
  sidebar. Escape or backdrop closes it.
- In-app client encoder (`lib/evidence-codec.ts`) runs on the uploader’s
  computer. Limits are 3840×2160 and 8-bit. Oversize, 10-bit, or
  over-budget files are encoded with `createImageBitmap` plus
  OffscreenCanvas/canvas JPEG; APP1/APP2/APP13 metadata is copied back.
  Files already inside the 4K / 8-bit / store budget keep original
  bytes.
- Seven days after both Complete, opening the thread re-encodes stored
  evidence in archival mode (max edge 1600, quality 0.58) and POSTs
  `/api/conversations/evidence/archive`. Earlier archive attempts return
  409. Signed-out archive returns 401.
- Preview D1 `open-marketplace-account-preview-d1`
  (`8ddff0ae-f810-4d71-955e-4aab40a00e27`) received migration `0011`
  one statement at a time. Production D1 was not queried or altered.

## Verification evidence

`npm run lint` exit 0. `npm test` exit 0, 99 passed / 0 failed. Preview
D1 `pragma_table_info` confirmed `slot`, `exif_json`, `quality`,
`width`, `height`, `evidence_archived_at`, and `listings.archived_at`.
Unique index is `conversation_media_kind_slot_idx`.

## Runnable preview

HTTPS preview after push:
https://feature-account-management-p.open-marketplace-demo.pages.dev/

Owner checklist is in the front matter. `owner_manual_result: not_run`.

## Deviations and risks

- The in-app encoder is browser canvas JPEG, not WASM mozjpeg/AVIF. It
  lives in the repo and runs on the user’s computer. It is the tightest
  lossless-to-the-eye encode the current Pages/browser stack can run
  without a new native codec binary.
- D1 row size cannot hold raw 4K originals. Store budget is 1.2 MB. A
  photo already over that budget is client-encoded immediately even
  though the owner asked for full size until day 7. Photos that already
  fit stay untouched until archival.
- Listing image bytes are not in the public metadata registry. “Compress
  the entire listing” after day 7 currently stamps `listings.archived_at`
  only. Public sold listings were already compact.
- After day 7, either conversation party can POST replacement archival
  bytes. Codex should review whether archive must bind to existing
  photos more tightly.
- GPS and camera EXIF stay in the private conversation payload and
  evidence windows. Public listings and the replica catalog omit EXIF,
  GPS, hashes, data URLs, and `bytes_base64`.

## Review request

Codex should review the EXIF extract/display path, the 1–3 photo cap,
the client encoder, the seven-day archive gate, and the preview-only D1
`0011` apply. Do not mark this accepted, merge PR #21, or deploy
production until the human owner click-tests the preview.
