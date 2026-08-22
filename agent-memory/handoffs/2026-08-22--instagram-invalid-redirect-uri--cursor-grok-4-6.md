---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-NEXT-CONNECTORS"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-22T22:14:00Z"
completed_at: "2026-08-22T22:22:00Z"
authority: "human_owner_direct_instruction"
implementation_change_authorized: true
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "23bb71f3fa879262d7cc261c3ab0cb5c396d716e"
head_commit: "this_publication_commit"
github_publication:
  inter_agent_review_handoff: true
  program_and_memory_pushed: true
  github_url: "https://github.com/PeterJFrancoIII/Open-Marketplace"
  handling_branch: "feature/community-surface-reports"
  pushed_commit: "this_publication_commit"
shared_memory_refs:
  github_repository: "PeterJFrancoIII/Open-Marketplace"
  github_url: "https://github.com/PeterJFrancoIII/Open-Marketplace"
  repo_directory: "/Users/computer/App Development/Marketplace/open-exchange-cursor-project/.worktrees/om-crowd-001"
  assigned_memory_root: "agent-memory/"
  canonical_ref_or_commit: "this_publication_commit"
  paths:
    - "agent-memory/README.md"
    - "agent-memory/HANDOFF_TEMPLATE.md"
    - "Master_Descriptor.md"
    - "AGENTS.md"
    - "lib/auth.ts"
    - "lib/social-connectors.ts"
    - "agent-memory/handoffs/2026-08-22--instagram-preview-connector-bound--cursor-grok-4-6.md"
files_changed:
  - "lib/auth.ts"
  - "lib/social-connectors.ts"
  - "tests/social-connectors.test.mjs"
  - "agent-memory/handoffs/2026-08-22--instagram-invalid-redirect-uri--cursor-grok-4-6.md"
verification:
  - command: "node --experimental-strip-types --test --test-name-pattern='Instagram Connect uses Instagram Login' tests/social-connectors.test.mjs"
    exit_code: 0
    result: "1/1 passed"
  - command: "Safari OM Social Proof Business login settings"
    exit_code: 0
    result: "OAuth redirect URI is now the genericOAuth path /api/auth/oauth2/callback/instagram. The incorrect /api/auth/callback/instagram URI was removed."
functional_preview_required: true
functional_preview:
  status: "meta_redirect_uri_corrected"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings"
  start_command: null
owner_manual_checklist:
  - "Hard-refresh Account settings and click Connect Instagram again."
  - "Use a Professional Instagram account (Business or Creator)."
  - "Confirm Instagram no longer shows Invalid redirect_uri."
  - "Confirm login still has no Instagram sign-in."
  - "Do not request Meta App Review or switch OM Social Proof to Live."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Owner completes Connect Instagram until Account settings shows Connected."
recommended_next_action: "Owner retries Connect Instagram on the development Account settings page. Do not mark accepted."
contains_secrets_or_private_data: false
---

# Agent Handoff: Instagram Invalid redirect_uri corrected

## Objective received

Owner hit Instagram OAuth error `Invalid redirect_uri` after Connect Instagram.

## Shared-memory citations

Assigned shared-memory space for the GitHub repository directory that handles this work:

- GitHub repository: `PeterJFrancoIII/Open-Marketplace`
- GitHub URL: https://github.com/PeterJFrancoIII/Open-Marketplace
- Repo directory: `/Users/computer/App Development/Marketplace/open-exchange-cursor-project/.worktrees/om-crowd-001`
- Assigned memory root: `agent-memory/`

## Work performed

- Confirmed Better Auth `genericOAuth` sends and exchanges Instagram Login against `/api/auth/oauth2/callback/instagram`, not `/api/auth/callback/instagram`.
- The Meta Business login settings still had the Facebook-style callback. That mismatch is the Invalid redirect_uri error.
- Replaced the Meta OAuth redirect URI with `https://feature-community-surface-re.open-marketplace-demo.pages.dev/api/auth/oauth2/callback/instagram`.
- Documented that callback path in `lib/social-connectors.ts`, `lib/auth.ts`, and the Instagram source test.

## Verification evidence

See front-matter `verification`. No secrets are stored here.

## Runnable preview

https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings

The Meta URI change is live immediately. A Pages deploy is not required for the owner retry.

## Deviations and risks

Instagram Login still requires a Professional Instagram account and may require an Instagram tester role while OM Social Proof stays in Development.

## Review request

Review the documented genericOAuth callback path and the Meta URI correction. Owner still has to complete Connect Instagram. Do not mark accepted.
