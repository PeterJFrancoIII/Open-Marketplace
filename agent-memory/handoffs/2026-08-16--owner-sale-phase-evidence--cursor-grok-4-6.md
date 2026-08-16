---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "owner-sale-phase-evidence"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-16T21:05:00Z"
completed_at: "2026-08-16T21:16:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/account-management-portal"
base_commit: "9c4cc6ec38284fbc340c9ba4b23a9292768867ad"
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
  - "app/api/conversations/evidence/route.ts"
  - "app/api/conversations/sale/route.ts"
  - "app/globals.css"
  - "db/schema.ts"
  - "drizzle/0007_sale_evidence.sql"
  - "drizzle/meta/_journal.json"
  - "lib/conversations.ts"
  - "lib/sale-evidence.ts"
  - "scripts/apply-local-d1-migrations.mjs"
  - "tests/chat-sale-credit.test.mjs"
  - "tests/helpers/memory-d1.mjs"
  - "agent-memory/handoffs/2026-08-16--owner-sale-phase-evidence--cursor-grok-4-6.md"
verification:
  - command: "npm run lint"
    exit_code: 0
    result: "eslint passed with one existing-style @next/next/no-img-element warning on SaleProof blob previews"
  - command: "npm test"
    exit_code: 0
    result: "95 tests passed, 0 failed; sale flow now requires tracking/receipt/delivery proof and keeps those fields off public listings"
  - command: "preview D1 8ddff0ae-f810-4d71-955e-4aab40a00e27 apply 0007 tracking_number payment_receipt_json received_item_json received_packaging_json"
    exit_code: 0
    result: "pragma_table_info confirmed all four columns on preview conversations; production D1 was not queried or altered"
functional_preview_required: true
functional_preview:
  status: "ready_after_push"
  url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
  start_command: null
owner_manual_checklist:
  - "Hard-refresh the preview after the latest Pages deploy."
  - "As the seller, try In-Transfer without a tracking number and confirm it is rejected."
  - "As the seller, save a tracking number or PICKUP, then mark In-Transfer."
  - "As the buyer, try In-Transfer without a payment receipt and confirm it is rejected."
  - "As the buyer, upload a payment receipt, then mark In-Transfer."
  - "As the buyer, try Complete without both delivery photos and confirm it is rejected."
  - "As the buyer, upload a product photo and a packaging photo, then mark Complete."
  - "Confirm the homepage and public listing JSON do not show the tracking number, receipt, or delivery photos."
  - "Confirm Messages still shows the tracking number to the buyer and proof captions when the local vault or media node can resolve the hash."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Codex may assign a canonical OM-FUL/OM-ACC task if this owner override should enter TASKS.md."
recommended_next_action: "Owner tests In-Transfer and Complete proof uploads on the preview URL. Codex may review. Do not merge PR #21 or deploy production."
---

# Agent Handoff: owner-sale-phase-evidence

## Objective received

The human owner asked that when a sale enters the In-Transit phase the
seller upload a tracking number and the buyer upload a payment receipt,
and that when the sale enters Complete the buyer upload a photo of the
received product and a photo of the packaging.

Owner language "In-Transit" maps to the existing `in_transfer` /
**In-Transfer** control. The status enum and button label were not
renamed.

## Shared-memory citations

Read from this worktree plus canonical `origin/main`
`96adc20d240f6dd644e74981778d86eeb1e3808b`:

- `Master_Descriptor.md`
- `agent-memory/README.md`
- `agent-memory/STATE.md`
- `agent-memory/TASKS.md`
- `agent-memory/DECISIONS.md`

Canonical TASKS/STATE remain stale versus this branch. No Codex task ID
covers this slice. Authority is the human owner's explicit request.

## Work performed

- Added private conversation columns for `tracking_number`,
  `payment_receipt_json`, `received_item_json`, and
  `received_packaging_json`.
- Stored only sanitized `MediaManifest` fields (hash, name, size, type,
  hosts). Image/PDF bytes and data URLs are stripped and never written
  to D1.
- Seller cannot mark In-Transfer or Complete without a tracking number.
  `PICKUP` is accepted for in-person handoff. URLs are rejected.
- Buyer cannot mark In-Transfer without a payment-receipt manifest.
- Buyer cannot mark Complete without the receipt plus received-item and
  packaging photos. Skipping In-Transfer still requires all buyer proof.
- Seller Complete requires tracking only. Delivery photos are buyer-only.
- Role locks: seller cannot upload buyer photos; buyer cannot set
  tracking (`403`). Evidence cannot change after that party marked
  Complete, or after both completed (`409`).
- Pending ↔ In-Transfer stays reversible. Saved proof is kept if a party
  returns to Pending.
- Evidence is conversation-private. Public `GET /api/listings` and the
  replica catalog do not receive tracking, receipt, or delivery photos.
- Chat stays text-only. Proof is not a `conversation_messages` body.
- Messages UI adds a Sale proof box: seller tracking field; buyer file
  inputs; captions/previews via `storeMedia` / `getLocalMediaUrl`.

## Verification evidence

- `npm run lint` exit 0.
- `npm test` exit 0, **95/95**.
- Preview D1 `open-marketplace-account-preview-d1`
  (`8ddff0ae-f810-4d71-955e-4aab40a00e27`) now has the four 0007
  columns. Production D1 was not migrated.

## Runnable preview

https://feature-account-management-p.open-marketplace-demo.pages.dev/

Hard-refresh after Pages deploys this push. `owner_manual_result` stays
`not_run`.

## Deviations and risks

- Master Descriptor tracking-proof allows an optional public tracking
  number on the registry. This slice keeps the tracking number private
  to the conversation so it does not appear on public listings.
- Proof photo bytes follow the listing-photo pattern (device vault plus
  optional media-node hosts), not D1 blobs. The other party sees a
  preview only when the hash resolves locally or on a media node.
- Receipts may be images or PDF. Delivery photos are images only.
- No live carrier tracking lookup.

## Review request

Codex should review the evidence gates, privacy boundary, and preview D1
0007 apply. Do not mark accepted, merge PR #21, or deploy production
until the human owner reports a functional pass.
