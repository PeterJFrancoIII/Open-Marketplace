---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "owner-instagram-connect"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "partial"
started_at: "2026-08-19T22:29:00Z"
completed_at: "2026-08-19T22:35:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "38e7f7f18752e9d39ef8917d5bcfe7ce4d1bdde8"
head_commit: "uncommitted"
authority: "human_owner_direct_instruction"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "38e7f7f18752e9d39ef8917d5bcfe7ce4d1bdde8"
  paths:
    - "Master_Descriptor.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "agent-memory/handoffs/2026-08-18--owner-tiktok-connect--cursor-grok-4-6.md"
    - "agent-memory/handoffs/2026-08-19--owner-instagram-connect--cursor-grok-4-6.md"
files_changed:
  - "lib/social-connectors.ts"
  - "app/account/account-settings.tsx"
  - "app/privacy/page.tsx"
  - "tests/social-connectors.test.mjs"
  - "agent-memory/handoffs/2026-08-19--owner-instagram-connect-scope--cursor-grok-4-6.md"
verification:
  - command: "node --experimental-strip-types --test tests/social-connectors.test.mjs tests/privacy-policy.test.mjs tests/rendered-html.test.mjs"
    exit_code: 0
    result: "17/17 passed (source tests; privacy/terms rendered HTML still uses last dist build)"
  - command: "gh variable list --repo PeterJFrancoIII/Open-Marketplace"
    exit_code: 0
    result: "Preview vars present for Facebook and TikTok only. Instagram, X, LinkedIn, Reddit, Discord absent."
functional_preview_required: true
functional_preview:
  status: "blocked_missing_instagram_app"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/"
  start_command: null
owner_manual_checklist:
  - "Stay signed in at https://developers.facebook.com/apps/2058991838072366/dashboard/ and tell Cursor to continue Instagram setup."
  - "Have a Professional Instagram account (Business or Creator) ready as the tester. Personal consumer IG cannot authorize Instagram Login."
  - "After preview credentials exist and development is redeployed, sign in and Connect Instagram."
  - "Confirm login still has no Instagram sign-in."
owner_manual_result: "not_run"
blockers:
  - "Cursor browser MCP dropped after the Meta dashboard was opened. Instagram product was not added. No Instagram App ID/secret stored."
  - "Official Instagram Login requires a Business-type Meta app. Existing Open Marketplace app 2058991838072366 currently has Facebook Login and Catalog API only."
remaining_work:
  - "Add Instagram product or create Business-type Open Marketplace Instagram app"
  - "Save development callback /api/auth/callback/instagram"
  - "Store preview-only GitHub INSTAGRAM client id/secret"
  - "Redeploy development preview only after those credentials exist"
  - "Then continue in order: X, LinkedIn, Reddit, Discord"
recommended_next_action: "Owner stays signed into Meta for Developers and tells Cursor to continue Instagram dashboard setup. Do not paste the Instagram App Secret into chat."
contains_secrets_or_private_data: false
---

# Agent Handoff: owner-instagram-connect scope

## Objective received

Set up remaining official Connect apps in catalog order. Facebook and TikTok
already exist. Instagram is next, then X, LinkedIn, Reddit, Discord.

## Shared-memory citations

Read local `38e7f7f18752e9d39ef8917d5bcfe7ce4d1bdde8` plus the files listed
above. Companion blocked portal handoff:
`agent-memory/handoffs/2026-08-19--owner-instagram-connect--cursor-grok-4-6.md`.

## Work performed

- Confirmed GitHub preview credentials exist only for Facebook and TikTok.
- Inspected Meta app Open Marketplace `2058991838072366`: Facebook Login and
  Catalog API only; Facebook callback is on the live bookmark origin.
- Updated Instagram Connect from deprecated Basic Display `user_profile` to
  official Instagram Login `instagram_business_basic`. Authorize and token
  URLs already match current Meta docs. No messaging, comments, or publish
  scopes.
- Account Settings and Privacy now describe Instagram Login as Connect-only.

## Verification evidence

Source connector/privacy tests 17/17. Full `npm test` was not re-run for this
scope-only slice.

## Deviations and risks

Instagram Login needs a Professional Instagram account and an Instagram App
ID/secret from the Instagram product, not the Facebook App ID. The dashboard
browser session was opened, then browser MCP became unavailable before Add
Product completed.

## Review request

Review the Instagram scope change. Portal credential wiring is still blocked
until the Meta Instagram product exists.
