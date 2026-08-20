---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-DEDUPE-LISTING-PAYPAL-CHIP"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-20T21:09:00Z"
completed_at: "2026-08-20T21:11:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "4dbcca7e4dd145ac8684476a9e9f1b2bf8d29b5b"
head_commit: "uncommitted"
authority: "human_owner_direct_instruction"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "4dbcca7e4dd145ac8684476a9e9f1b2bf8d29b5b"
  paths:
    - "Master_Descriptor.md"
    - "agent-memory/README.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "agent-memory/HANDOFF_TEMPLATE.md"
    - "agent-memory/handoffs/2026-08-20--restore-connector-chip-ui--cursor-grok-4-6.md"
files_changed:
  - "app/marketplace.tsx"
  - "tests/payment-links.test.mjs"
  - "tests/paypal-connect.test.mjs"
  - "agent-memory/handoffs/2026-08-20--dedupe-listing-paypal-chip--cursor-grok-4-6.md"
verification:
  - command: "npm test"
    exit_code: 0
    result: "136/136 tests passed after vinext build"
functional_preview_required: true
functional_preview:
  status: "code_not_on_public_preview"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/"
  start_command: null
owner_manual_checklist:
  - "After the development deploy, open a listing card and confirm there is one PayPal chip."
  - "Open Listing Details and confirm Pay the seller has one PayPal chip, not a second PayPal pay-to row."
  - "Other pay-to rails such as Venmo or crypto should still appear when published."
  - "Do not mark this owner manual test passed in this handoff."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Owner visual pass on the development Pages URL after this commit deploys."
recommended_next_action: "Codex review of the PayPal chip dedupe. Do not mark accepted or change the live bookmark."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-DEDUPE-LISTING-PAYPAL-CHIP

## Objective received
Remove the duplicate PayPal connector UI on listings and keep only one.

## Shared-memory citations
Read `Master_Descriptor.md`, `agent-memory/README.md`, `agent-memory/STATE.md`, `agent-memory/TASKS.md`, `agent-memory/DECISIONS.md`, and the chip-restore handoff on `feature/community-surface-reports` at `4dbcca7e4dd145ac8684476a9e9f1b2bf8d29b5b`. There is no `TASKS.md` row for this PayPal UI fix. Authority is human-owner direct instruction.

## Work performed
Listing details had two PayPal rows: the Login connector chip and the pay-to destination row from `paymentLinksFor`. Kept a single `PayPalListingFact` chip on cards and details. Filtered PayPal out of the remaining pay-to list so Venmo, Cash App, Zelle, Apple Cash, and crypto still appear. The kept chip still opens the PayPal pay link when a destination exists, and the official destination is shown on the same chip.

## Verification evidence
`npm test` exit 0, 136/136 passed after vinext build.

## Runnable preview
Development URL remains `https://feature-community-surface-re.open-marketplace-demo.pages.dev/`. This fix is not on that URL until committed and the Pages workflow finishes. Live bookmark must not be overwritten. `owner_manual_result` stays `not_run`.

## Deviations and risks
- No matching `TASKS.md` execution-ready row. Implementation followed human-owner direct instruction.
- Did not change PayPal Connect, tokens, or checkout behavior.

## Review request
Confirm listing cards and Listing Details show one PayPal chip. Do not mark accepted, merge, or promote to the live bookmark.
