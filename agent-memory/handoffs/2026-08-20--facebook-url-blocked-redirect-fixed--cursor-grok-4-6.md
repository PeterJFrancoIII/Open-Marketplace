---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-FACEBOOK-CONNECTOR-TEST"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "partial"
started_at: "2026-08-20T19:24:00Z"
completed_at: "2026-08-20T19:40:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "a0301d2514da6da6f6bc81f84f852035b95f8335"
head_commit: "a0301d2514da6da6f6bc81f84f852035b95f8335"
authority: "human_owner_direct_instruction"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "a0301d2514da6da6f6bc81f84f852035b95f8335"
  paths:
    - "Master_Descriptor.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "agent-memory/handoffs/2026-08-20--facebook-url-blocked-redirect--cursor-grok-4-6.md"
files_changed:
  - "agent-memory/handoffs/2026-08-20--facebook-url-blocked-redirect--cursor-grok-4-6.md"
  - "agent-memory/handoffs/2026-08-20--facebook-url-blocked-redirect-fixed--cursor-grok-4-6.md"
verification:
  - command: "devtools_app basic_settings"
    exit_code: 0
    result: "base_domains now includes live-bookmark host and feature-community-surface-re.open-marketplace-demo.pages.dev"
  - command: "devtools_app advanced_settings"
    exit_code: 0
    result: "oauth_redirect_uris now includes both live-bookmark and development Facebook callbacks"
functional_preview_required: true
functional_preview:
  status: "deployed_waiting_owner_facebook_reconnect"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings"
  start_command: null
owner_manual_checklist:
  - "Sign in on the development URL and open Account settings."
  - "Disconnect Facebook if it is Connected, then Connect Facebook."
  - "Confirm Meta no longer shows URL Blocked."
  - "Grant public_profile, user_link, user_hometown, and user_location. Decline email, birthday, phone, friends, Pages, Marketplace, and Commerce if offered."
  - "Confirm Open Marketplace name and email do not change."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Owner reconnects Facebook on the development Account settings URL and reports pass/fail."
  - "Then create the separate Instagram app OM Social Proof and store preview-only Instagram credentials."
recommended_next_action: "Owner Disconnects and Connects Facebook on the development Account settings URL. After a successful connect, continue Instagram app creation. Do not switch the Facebook app to Live and do not submit App Review."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-FACEBOOK-CONNECTOR-TEST (URL Blocked fixed)

## Objective received

Owner attempted Facebook Connect on the development preview and received Meta URL Blocked because the redirect URI was not whitelisted.

## Shared-memory citations

Read local `a0301d2514da6da6f6bc81f84f852035b95f8335` plus STATE, TASKS, DECISIONS, AGENTS, and the earlier 2026-08-20 URL-blocked handoff. No TASKS.md row exists. Authority is human-owner direct instruction.

## Work performed

- Added `feature-community-surface-re.open-marketplace-demo.pages.dev` to Meta App domains. Live-bookmark domain was kept. Meta UI reported Changes saved. `devtools_app basic_settings` now lists both hosts.
- Added `https://feature-community-surface-re.open-marketplace-demo.pages.dev/api/auth/callback/facebook` to Valid OAuth Redirect URIs. Live-bookmark callback was kept. Meta UI reported Changes saved. `devtools_app advanced_settings` now lists both callbacks.
- Did not switch the Facebook app to Live and did not submit App Review.
- Did not change Open Marketplace implementation code in this slice.

## Verification evidence

Meta MCP now shows both App domains and both Facebook OAuth redirect URIs. Development listed twice in `oauth_redirect_uris` is a harmless tokenizer duplicate.

## Runnable preview

Development Account settings: `https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings`. Owner reconnect is still required.

## Deviations and risks

- Meta still shows the Facebook Login advanced-access banner. That is a later risk, not the URL Blocked cause.
- Instagram app creation remains deferred until Facebook Connect succeeds on development.

## Review request

Codex should treat the Meta whitelist change as done. Owner Facebook reconnect on development is still `not_run`. Do not mark the Facebook connector test accepted until the owner reports a successful Connect.
