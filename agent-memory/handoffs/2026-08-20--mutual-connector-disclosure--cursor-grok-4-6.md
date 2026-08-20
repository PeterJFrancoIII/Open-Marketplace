---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-MUTUAL-CONNECTOR-DISCLOSURE"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-20T20:42:00Z"
completed_at: "2026-08-20T20:47:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "a0301d2514da6da6f6bc81f84f852035b95f8335"
head_commit: "uncommitted"
authority: "human_owner_direct_instruction"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "a0301d2514da6da6f6bc81f84f852035b95f8335"
  paths:
    - "Master_Descriptor.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "agent-memory/handoffs/2026-08-20--seller-buyer-connector-disclosure--cursor-grok-4-6.md"
files_changed:
  - "lib/official-connector-facts.ts"
  - "lib/conversations.ts"
  - "app/official-connector-disclosure.tsx"
  - "app/marketplace.tsx"
  - "app/account/messages/messages-client.tsx"
  - "app/account/account-settings.tsx"
  - "app/privacy/page.tsx"
  - "app/globals.css"
  - "tests/official-connector-facts.test.mjs"
  - "tests/facebook-listing-proof.test.mjs"
  - "tests/chat-sale-credit.test.mjs"
  - "agent-memory/handoffs/2026-08-20--mutual-connector-disclosure--cursor-grok-4-6.md"
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
  - "Open a live listing detail and confirm the seller official social catalog lists all seven networks, with Facebook showing labeled official fields and Open Facebook profile as a secondary action."
  - "As a buyer, contact that seller and confirm Messages shows the seller official social catalog."
  - "As the seller, open that thread and confirm Messages shows the buyer official social catalog, including Not connected rows."
  - "Do not treat missing Facebook bio, cover, friends, work, or education as a display bug."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Owner must explicitly authorize commit and push before this catalog can reach the development Pages preview."
  - "The listing URL the owner reported still serves the older jammed Facebook chip until that deploy."
recommended_next_action: "Codex should review mutual official-connector disclosure on listing detail and Messages. Do not mark accepted until the owner sees the catalog on a development listing and in a buyer/seller thread."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-MUTUAL-CONNECTOR-DISCLOSURE

## Objective received

The owner reported the home listing “Open Facebook profile” surface and asked that buyers and sellers see the exact same official social-connector information about each other, including who a seller is selling to. Nothing official should be hidden.

## Shared-memory citations

Read `Master_Descriptor.md`, `agent-memory/README.md`, `agent-memory/STATE.md`, `agent-memory/TASKS.md`, `agent-memory/DECISIONS.md`, and the prior seller/buyer disclosure handoff. There is still no `TASKS.md` row for this Meta work. Authority remains human-owner direct instruction.

## Work performed

- Added `publicConnectorCatalog` so every official network is listed. Connected rows show the same labeled official fields Account settings uses. Missing networks show Not connected.
- Listing detail now renders that full catalog for registry listings. `Open Facebook profile` is a secondary button after the official fields, not the only buyer-visible Facebook content.
- Conversation payloads now include `buyerSocialProofs` and `sellerSocialProofs`. Messages shows the other party’s full official catalog.
- Starting or opening a conversation refreshes both parties’ stored official connector proofs so a seller can see who they are selling to.
- Did not invent Facebook friends, a join date, work, education, or any field Facebook did not return. Did not publish emails or tokens.

## Verification evidence

`npm test` exited 0 with 136 passing tests after `vinext` build.

## Runnable preview

The development Pages URL still serves `a0301d2514da6da6f6bc81f84f852035b95f8335`. This mutual catalog is uncommitted and not on that preview.

## Deviations and risks

- Homepage listing cards still show connected official chips only. The full seven-network catalog is on listing detail and in Messages so the homepage does not repeat six empty Not connected rows on every card.
- Complete disclosure still means official provider fields, not Facebook.com page fields that Login no longer returns.

## Review request

Review that listing detail and Messages now expose the same official connector catalog to both parties, and that Open Facebook profile no longer replaces the official field list.
