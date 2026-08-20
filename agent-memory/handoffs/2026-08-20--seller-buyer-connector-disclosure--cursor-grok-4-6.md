---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-SELLER-BUYER-CONNECTOR-DISCLOSURE"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-20T20:31:00Z"
completed_at: "2026-08-20T20:38:00Z"
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
    - "agent-memory/handoffs/2026-08-20--facebook-connector-fields-limit--cursor-grok-4-6.md"
files_changed:
  - "lib/types.ts"
  - "lib/official-connector-facts.ts"
  - "lib/facebook-listing-proof.ts"
  - "lib/auth.ts"
  - "app/official-connector-disclosure.tsx"
  - "app/account/account-settings.tsx"
  - "app/marketplace.tsx"
  - "app/globals.css"
  - "app/privacy/page.tsx"
  - "tests/official-connector-facts.test.mjs"
  - "tests/facebook-listing-proof.test.mjs"
  - "tests/facebook-connect.test.mjs"
  - "agent-memory/handoffs/2026-08-20--seller-buyer-connector-disclosure--cursor-grok-4-6.md"
verification:
  - command: "npm test"
    exit_code: 0
    result: "135/135 tests passed after vinext build"
  - command: "npm run lint -- --max-warnings=99"
    exit_code: 0
    result: "0 errors; 4 pre-existing warnings in messages-client.tsx and marketplace.tsx"
functional_preview_required: true
functional_preview:
  status: "code_not_on_public_preview"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/"
  start_command: null
owner_manual_checklist:
  - "On Account settings, connected Facebook should list labeled official fields, photo, and profile link."
  - "On a listing card and listing detail, buyers should see those same official Facebook fields, not a jammed one-line chip."
  - "Facebook username should only appear when Facebook returned a vanity profile path, not the Open Marketplace display name."
  - "Do not treat missing Facebook bio, cover, friends, work, or education as a display bug."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Owner must explicitly authorize commit and push before this seller/buyer disclosure can reach the development Pages preview."
  - "After deploy, the owner should open Account settings once so persist rewrites the stored Facebook SocialProof with first name, last name, and vanity handle."
  - "Demo listings still invent self-reported friends and join dates. That path was left unchanged."
  - "Do not add user_gender or user_age_range unless the owner explicitly requests that reconnect."
recommended_next_action: "Codex should review seller/buyer official-field parity. Do not mark accepted until the owner sees the labeled disclosure on both Account settings and a listing after a development deploy."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-SELLER-BUYER-CONNECTOR-DISCLOSURE

## Objective received

The owner asked that every official connector detail already pulled be displayed to both sellers in Account settings and buyers on listings, so the site discloses identity instead of hiding it.

## Shared-memory citations

Read `Master_Descriptor.md`, `agent-memory/README.md`, `agent-memory/STATE.md`, `agent-memory/TASKS.md`, `agent-memory/DECISIONS.md`, and the prior Facebook field-limit handoff. There is still no `TASKS.md` row for this Meta work. Authority remains human-owner direct instruction.

## Work performed

- Shared `OfficialConnectorDisclosure` now renders the same labeled official rows, photo, and banner for Account settings and listing chips.
- Listing cards and listing detail use that shared disclosure for every official Connect account. Demo and typed self-reported chips stay on the old invented-metrics path.
- Facebook listing proofs now persist first, last, middle, and short names. A Facebook username is stored only from a vanity profile path, not from the Open Marketplace display name.
- Added a seller/buyer parity test that the official Facebook connection object and the listing SocialProof produce the same labeled rows.
- Privacy and Account settings copy now say buyers see the same official Facebook fields as the seller.
- Did not invent Facebook friends, a join date, work, education, or any field Facebook did not return. Did not publish emails or request extra Facebook permissions.

## Verification evidence

`npm test` exited 0 with 135 passing tests after `vinext` build. Lint reported 0 errors and 4 pre-existing warnings.

## Runnable preview

The development Pages URL still serves `a0301d2514da6da6f6bc81f84f852035b95f8335`. This seller/buyer disclosure is uncommitted and not on that preview.

## Deviations and risks

- Complete disclosure here means official provider fields, not Facebook.com page fields that Login no longer returns.
- After deploy, an already-connected Facebook row may still lack first and last name until Account settings loads and persist rewrites the stored proof.

## Review request

Review that sellers and buyers now share one official-field renderer, that Facebook usernames are not invented from the marketplace name, and that the product still does not claim Facebook fields Meta does not send.
