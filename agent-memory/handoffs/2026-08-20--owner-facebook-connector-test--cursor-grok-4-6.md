---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-FACEBOOK-CONNECTOR-TEST"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "partial"
started_at: "2026-08-20T19:12:00Z"
completed_at: "2026-08-20T19:22:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "38e7f7f18752e9d39ef8917d5bcfe7ce4d1bdde8"
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
    - "agent-memory/handoffs/2026-08-20--owner-facebook-login-ingest--cursor-grok-4-6.md"
files_changed:
  - "agent-memory/handoffs/2026-08-20--owner-facebook-connector-test--cursor-grok-4-6.md"
verification:
  - command: "gh run view 32407937451"
    exit_code: 0
    result: "Deploy to Cloudflare Pages succeeded in 40s for a0301d2 on feature/community-surface-reports"
  - command: "curl development /privacy"
    exit_code: 0
    result: "Development privacy now lists user_hometown and user_location"
  - command: "curl live-bookmark /privacy"
    exit_code: 0
    result: "Live bookmark still lists only user_link; live was not overwritten"
  - command: "devtools_app advanced_settings"
    exit_code: 0
    result: "Facebook oauth_redirect_uris still only the live-bookmark callback"
functional_preview_required: true
functional_preview:
  status: "deployed_waiting_owner_meta_redirect_and_reconnect"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings"
  start_command: null
owner_manual_checklist:
  - "In Meta Facebook Login settings, keep the live-bookmark callback and add https://feature-community-surface-re.open-marketplace-demo.pages.dev/api/auth/callback/facebook then Save."
  - "Sign in on the development URL, open Account settings, Disconnect Facebook if it is Connected, then Connect Facebook."
  - "Grant public_profile, user_link, user_hometown, and user_location. Decline email, birthday, phone, friends, Pages, Marketplace, and Commerce if offered."
  - "Confirm Open Marketplace name and email do not change."
  - "If Facebook returns hometown, location, locale, gender, age range, or cover, confirm they appear only on the Facebook connector."
owner_manual_result: "not_run"
blockers:
  - "Meta still allows only the live-bookmark Facebook callback. Development Connect will fail with redirect_uri mismatch until the owner saves the development callback in Facebook Login settings."
remaining_work:
  - "Owner adds the development Facebook redirect URI and reconnects Facebook on the development preview."
  - "Then create the separate Instagram app OM Social Proof, store preview-only INSTAGRAM credentials, and redeploy development."
  - "Do not deploy the Facebook ingest onto the live bookmark unless the owner explicitly asks."
recommended_next_action: "Owner saves the development Facebook redirect URI in Meta, then Disconnects and Connects Facebook on the development Account settings URL. After that, continue Instagram app creation. Do not switch the Facebook app to Live and do not submit App Review."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-FACEBOOK-CONNECTOR-TEST

## Objective received

Proceed with Facebook connector testing, then set up the next most important social connector (Instagram).

## Shared-memory citations

Read local `38e7f7f18752e9d39ef8917d5bcfe7ce4d1bdde8` plus STATE, TASKS, DECISIONS, and the 2026-08-20 Facebook Login ingest handoff. No TASKS.md row exists. Authority is human-owner direct instruction.

## Work performed

- Pushed `a0301d2514da6da6f6bc81f84f852035b95f8335` to `feature/community-surface-reports` only. GitHub Actions run 32407937451 deployed that commit to the development Pages alias. Production / live bookmark was not updated.
- Verified development `/privacy` now discloses `user_hometown` and `user_location`. Live bookmark `/privacy` still discloses only `public_profile` and `user_link`.
- Confirmed Meta app `2058991838072366` still has a single OAuth redirect: the live-bookmark Facebook callback. A copied Chrome profile opened Meta as a logged-out business login page, so the development callback was not added automatically.
- Instagram Login still has no Meta app and no GitHub preview credentials.

## Verification evidence

Pages deploy succeeded. Development privacy copy includes the new Facebook scopes. Live bookmark copy does not.

## Runnable preview

https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings

Facebook Connect from that origin will fail until Meta also allows:

`https://feature-community-surface-re.open-marketplace-demo.pages.dev/api/auth/callback/facebook`

## Deviations and risks

- Commit and non-production preview deploy were required so the owner can test the new Facebook ingest. Live bookmark was left on the prior Facebook scopes.
- Did not type any Meta password. Did not submit App Review. Did not create Instagram credentials.

## Review request

Codex should review the development-only deploy and the remaining Meta redirect blocker. Do not mark the owner Facebook test passed from this handoff.
