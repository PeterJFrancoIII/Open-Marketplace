---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-LISTING-DETAILS-CATALOG-VISIBLE"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-20T20:48:00Z"
completed_at: "2026-08-20T20:51:00Z"
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
files_changed:
  - "app/marketplace.tsx"
  - "app/api/listings/route.ts"
  - "app/globals.css"
  - "lib/facebook-listing-proof.ts"
  - "tests/facebook-listing-proof.test.mjs"
  - "agent-memory/handoffs/2026-08-20--listing-details-catalog-visible--cursor-grok-4-6.md"
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
  - "After the development deploy, open a live listing card and the listing detail and look for Official social connectors immediately under the seller name."
  - "Confirm Facebook and TikTok connected rows show labeled official fields, and the other five networks show Not connected."
  - "Do not treat a missing Facebook bio as a display bug."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "The development Pages site still served the older jammed Facebook chip when the owner looked. This catalog is not visible there until commit, push, and Pages deploy finish."
recommended_next_action: "Commit and push this branch so the owner-reachable development listing can show the official social catalog."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-LISTING-DETAILS-CATALOG-VISIBLE

## Objective received

The owner reported that listing details still did not show the official social-media connector details we had been discussing.

## Shared-memory citations

Read the prior mutual-disclosure handoff and inspected the live development listing API. The listing already stored Facebook and TikTok Connect proofs, but the public site still served `a0301d2514da6da6f6bc81f84f852035b95f8335`, which has no official catalog UI. The stored Facebook link was an app-scoped user-id path, not a public profile URL.

## Work performed

- Put `OfficialConnectorCatalog` at the top of the listing-detail seller card and on registry listing cards so the official fields are not below the fold or hidden behind Open Facebook profile.
- Stop treating Facebook `app_scoped_user_id` paths as public profile URLs.
- Refresh stored official proofs on listing GET when Facebook is connected but the stored public URL or official values are missing.
- Did not invent Facebook friends, bio, work, or education.

## Verification evidence

`npm test` exited 0 with 136 passing tests.

## Review request

Review that listing cards and listing details now render the official social catalog, and that a development deploy is required before the owner can see it.
