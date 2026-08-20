---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-RESTORE-CONNECTOR-CHIP-UI"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-20T20:54:00Z"
completed_at: "2026-08-20T21:00:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "e890999cef4462d73612304e0fc5101f22d8e899"
head_commit: "uncommitted"
authority: "human_owner_direct_instruction"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "e890999cef4462d73612304e0fc5101f22d8e899"
  paths:
    - "Master_Descriptor.md"
    - "agent-memory/README.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "agent-memory/HANDOFF_TEMPLATE.md"
    - "agent-memory/handoffs/2026-08-20--listing-details-catalog-visible--cursor-grok-4-6.md"
files_changed:
  - "app/marketplace.tsx"
  - "app/official-connector-disclosure.tsx"
  - "app/account/account-settings.tsx"
  - "app/account/messages/messages-client.tsx"
  - "app/globals.css"
  - "lib/official-connector-facts.ts"
  - "lib/social-connectors.ts"
  - "tests/official-connector-facts.test.mjs"
  - "tests/facebook-listing-proof.test.mjs"
  - "tests/facebook-connect.test.mjs"
  - "tests/chat-sale-credit.test.mjs"
  - "agent-memory/handoffs/2026-08-20--restore-connector-chip-ui--cursor-grok-4-6.md"
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
  - "After the development deploy, open a listing card and confirm the old 3-column chips are back: mark, name plus Connected-with line, Connected pill. PayPal should match."
  - "Open Listing Details and confirm the same chip chrome, with official values in the small line, plus a one-line Not connected list."
  - "Open Account settings and Messages and confirm compact identity / chips, not seven labeled boxes."
  - "Do not mark this owner manual test passed in this handoff."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Owner visual pass on the development Pages URL after this commit deploys."
  - "Instagram remains next: separate Instagram app OM Social Proof, instagram_business_basic only, development callback, preview-only GitHub secrets."
recommended_next_action: "Codex review of the chip-restore diff. Push/deploy only if the human owner still wants the development preview updated. Do not mark accepted or change the live bookmark."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-RESTORE-CONNECTOR-CHIP-UI

## Objective received
Confirm whether Connect already pulls every official field those connectors allow, and restore the pre-catalog chip design while still showing the same official values or more.

## Shared-memory citations
Read `Master_Descriptor.md`, `agent-memory/README.md`, `agent-memory/STATE.md`, `agent-memory/TASKS.md`, `agent-memory/DECISIONS.md`, and the listing-details catalog handoff on `feature/community-surface-reports` at `e890999cef4462d73612304e0fc5101f22d8e899`. There is no `TASKS.md` row for this Meta/social UI restore. Authority is human-owner direct instruction.

## Work performed
- Restored listing cards and listing details to the original 3-column `SocialAccountFact` chips. Official values now sit in the small Connected-with line instead of labeled definition lists.
- Listing details also show a one-line `Not connected:` list so missing networks stay disclosed without seven empty boxes.
- Messages now use `OfficialConnectorChips` with the same chip chrome.
- Account settings restored the compact photo-plus-one-line identity block.
- CSS restored `align-items: center` and card nowrap/ellipsis.
- Added `officialConnectorSummary` / `officialConnectorLine` for the jammed official line.
- Prefer TikTok `avatar_large_url` when Login Kit returns it.

## Field-pull evidence
Facebook Connect already requests `public_profile`, `user_link`, `user_hometown`, and `user_location`, and Graph already asks for name parts, large picture, link, about, website, hometown, location, locale, cover, age_range, and gender. Meta docs confirm about, website, locale, cover, education, and friends no longer return or are out of scope. Gender and age_range need extra permissions this app does not request. Friends, birthday, phone, email, Pages, and Marketplace stay forbidden.

TikTok Login Kit already requests `user.info.basic`, `user.info.profile`, and `user.info.stats`, and already maps display name, username, avatars, profile link, bio, follower/following/likes/video counts, and TikTok `is_verified`.

Instagram, X, LinkedIn, Reddit, and Discord readers already map the official profile fields those APIs return when connected. Instagram is not wired in preview secrets yet.

## Verification evidence
`npm test` exit 0, 136/136 passed after vinext build.

## Runnable preview
Development URL remains `https://feature-community-surface-re.open-marketplace-demo.pages.dev/`. This restore is not on that URL until committed and the Pages workflow finishes. Live bookmark must not be overwritten. `owner_manual_result` stays `not_run`.

## Deviations and risks
- No matching `TASKS.md` execution-ready row. Implementation followed human-owner direct instruction.
- Listing cards do not render empty Not-connected boxes. Details and Messages keep the one-line missing-network disclosure.
- Did not add `user_gender` or `user_age_range`.
- Did not invent Facebook friends, join dates, work, or education.

## Review request
Review the chip restore against `a0301d2` listing chrome and confirm official values still appear in the small line. Do not mark accepted, merge, or promote to the live bookmark.
