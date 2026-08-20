---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-FACEBOOK-CONNECTOR-TEST"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "partial"
started_at: "2026-08-20T19:24:00Z"
completed_at: "2026-08-20T19:32:00Z"
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
    - "agent-memory/handoffs/2026-08-20--owner-facebook-connector-test--cursor-grok-4-6.md"
files_changed:
  - "agent-memory/handoffs/2026-08-20--facebook-url-blocked-redirect--cursor-grok-4-6.md"
verification:
  - command: "devtools_app advanced_settings"
    exit_code: 0
    result: "oauth_redirect_uris still only the live-bookmark Facebook callback"
  - command: "devtools_app basic_settings"
    exit_code: 0
    result: "base_domains still only feature-account-management-p.open-marketplace-demo.pages.dev"
functional_preview_required: true
functional_preview:
  status: "deployed_blocked_on_meta_oauth_redirect_whitelist"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings"
  start_command: null
owner_manual_checklist:
  - "In Meta App settings > Basic, keep the live-bookmark App domain and add feature-community-surface-re.open-marketplace-demo.pages.dev, then Save Changes."
  - "In Facebook Login settings, keep the live-bookmark callback chip and add https://feature-community-surface-re.open-marketplace-demo.pages.dev/api/auth/callback/facebook as a second chip, then Save Changes."
  - "Do not remove the live-bookmark domain or callback. Do not switch the app to Live. Do not submit App Review."
  - "After both chips are saved, sign in on the development URL, Disconnect Facebook if Connected, then Connect Facebook."
owner_manual_result: "not_run"
blockers:
  - "Development Facebook Connect fails with URL Blocked because Meta has not persisted the development callback."
  - "Cursor browser session reached Facebook Login settings, typed the development URI, and clicked Save, but Meta's tokenizer never created a second chip. Hidden oauth_redirect[] still had only the live-bookmark URI."
  - "App domains currently contain only the live-bookmark host. Meta likely refuses to tokenize a redirect whose host is not an App domain."
  - "Cursor IDE browser MCP dropped after opening Basic settings, so the App-domain add was not completed from this session."
remaining_work:
  - "Persist the development App domain and development Facebook callback in Meta, then verify both via Meta MCP."
  - "Owner reconnects Facebook on the development Account settings URL."
  - "Then create the separate Instagram app OM Social Proof and store preview-only Instagram credentials."
recommended_next_action: "Owner or a restored Cursor browser session adds the development App domain first, then the development Facebook callback chip, then Save. After Meta MCP shows both redirect URIs, reconnect Facebook on development. Do not change live bookmark, do not switch the app to Live, and do not submit App Review."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-FACEBOOK-CONNECTOR-TEST (URL Blocked)

## Objective received

Owner attempted Facebook Connect on the development preview and received Meta URL Blocked because the redirect URI is not whitelisted.

## Shared-memory citations

Read local `a0301d2514da6da6f6bc81f84f852035b95f8335` plus STATE, TASKS, DECISIONS, AGENTS, and the 2026-08-20 Facebook connector-test handoff. No TASKS.md row exists. Authority is human-owner direct instruction.

## Work performed

- Confirmed the failure is Meta whitelist, not Open Marketplace code. Better Auth builds the Facebook callback from the current host, so development sends `https://feature-community-surface-re.open-marketplace-demo.pages.dev/api/auth/callback/facebook`.
- Meta app `2058991838072366` still has Client OAuth Login ON, Web OAuth Login ON, Enforce HTTPS ON, and Strict Mode ON.
- Valid OAuth Redirect URIs still contain only `https://feature-account-management-p.open-marketplace-demo.pages.dev/api/auth/callback/facebook`.
- App domains still contain only `feature-account-management-p.open-marketplace-demo.pages.dev`.
- In the Cursor browser Facebook Login settings page, the development callback was typed into Valid OAuth Redirect URIs and Save Changes was clicked. Meta reported saved, but the value stayed as uncommitted text, not a second chip. `devtools_app advanced_settings` still returns only the live-bookmark URI.
- Navigation to Basic settings confirmed the live-bookmark App domain chip. The Cursor IDE browser then disconnected before the development domain could be added.

## Verification evidence

Meta MCP `advanced_settings` and `basic_settings` still show only the live-bookmark host and callback. No implementation files were changed in this slice. Live bookmark was not overwritten.

## Runnable preview

Development Account settings: `https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings`. Facebook Connect will keep failing until Meta persists the development callback.

## Deviations and risks

- No TASKS.md row. Scope stayed on the owner-reported Facebook URL Blocked failure.
- Did not change Better Auth to reuse the live-bookmark callback. That would complete OAuth on the live host and skip the development ingest under test.
- Did not switch the Facebook app to Live and did not submit App Review.
- Instagram app creation remains blocked until Facebook Connect works on development.

## Review request

Codex should treat this as still blocked on Meta dashboard state, not an Open Marketplace callback-path bug. Review only after Meta MCP shows both the live-bookmark and development Facebook callbacks.
