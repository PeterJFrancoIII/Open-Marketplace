---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "owner-instagram-connect"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "partial"
started_at: "2026-08-19T22:43:00Z"
completed_at: "2026-08-19T22:52:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "38e7f7f18752e9d39ef8917d5bcfe7ce4d1bdde8"
head_commit: "uncommitted"
authority: "human_owner_direct_instruction"
files_changed:
  - "agent-memory/handoffs/2026-08-19--owner-instagram-connect-create-app--cursor-grok-4-6.md"
verification:
  - command: "devtools_app_list"
    exit_code: 0
    result: "Only existing Facebook app 2058991838072366 was listed before create-app submit. New app not created yet."
functional_preview_required: true
functional_preview:
  status: "blocked_meta_password_reauth"
  url: "https://developers.facebook.com/apps/creation/"
  start_command: null
owner_manual_checklist:
  - "On the Meta Create app Overview screen, re-enter the Meta/Facebook password in Meta's own dialog. Do not paste the password into chat."
  - "After Submit succeeds, tell Cursor to continue Instagram."
owner_manual_result: "not_run"
blockers:
  - "Meta asked the owner to re-enter their password before creating OM Social Proof. Browser was unlocked for that human-only step."
remaining_work:
  - "Finish creating OM Social Proof after password reauth"
  - "Configure Instagram Login redirect https://feature-community-surface-re.open-marketplace-demo.pages.dev/api/auth/callback/instagram"
  - "Store preview-only GitHub INSTAGRAM client id/secret. Do not print the secret."
  - "Do not request App Review or go live"
recommended_next_action: "Owner completes Meta password reauth on the open Create app page, then tells Cursor to continue Instagram."
contains_secrets_or_private_data: false
---

# Agent Handoff: owner-instagram-connect create-app

## Objective received
Continue Instagram Connect setup after Facebook and TikTok.

## Work performed
- Confirmed existing Open Marketplace Facebook app `2058991838072366` is App type None and cannot host official Instagram Login.
- Started a new Meta app named `OM Social Proof` (Instagram cannot appear in the app name).
- Selected use case Manage messaging and content on Instagram.
- Connected unverified Open Marketplace business portfolio.
- Publishing requirements: none identified.
- Clicked Create app. Meta then required password reauth. Browser unlocked so the owner can type the password only in Meta's dialog.

## Review request
No Instagram App ID or secret exists yet. Resume after the owner submits the Meta password dialog.
