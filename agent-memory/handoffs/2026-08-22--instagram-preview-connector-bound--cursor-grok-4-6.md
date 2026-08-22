---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-NEXT-CONNECTORS"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-22T20:36:00Z"
completed_at: "2026-08-22T20:48:00Z"
authority: "human_owner_direct_instruction"
implementation_change_authorized: false
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "a24c5f7ceb202707072a5b12c2a3ff9f62cb56ec"
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
    - "agent-memory/TASKS.md"
    - "Master_Descriptor.md"
    - "AGENTS.md"
    - "lib/social-connectors.ts"
    - "agent-memory/handoffs/2026-08-22--next-connectors-instagram--cursor-grok-4-6.md"
files_changed:
  - "agent-memory/handoffs/2026-08-22--instagram-preview-connector-bound--cursor-grok-4-6.md"
verification:
  - command: "devtools_app_list"
    exit_code: 0
    result: "OM Social Proof app exists beside Open Marketplace Facebook app. Instagram Login product is on the new app."
  - command: "Safari Instagram business login settings"
    exit_code: 0
    result: "Development OAuth redirect saved. Deauthorize and data deletion URLs saved to the development privacy page. App stayed in development. App Review was not submitted."
  - command: "gh variable set PAGES_PREVIEW_INSTAGRAM_CLIENT_ID / gh secret set PAGES_PREVIEW_INSTAGRAM_CLIENT_SECRET"
    exit_code: 0
    result: "Preview Instagram App ID length 16 stored. Matching preview secret stored. Secret file removed. Secret not printed."
functional_preview_required: true
functional_preview:
  status: "credentials_bound_awaiting_pages_deploy"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings"
  start_command: null
owner_manual_checklist:
  - "Wait until the latest Deploy to Cloudflare Pages run for this branch succeeds."
  - "Sign in on the development preview and open Account settings."
  - "Confirm Connect Instagram is available after Facebook and TikTok."
  - "Connect Instagram with a Professional Instagram account (Business or Creator). A personal consumer account cannot authorize Instagram Login."
  - "If Instagram asks for a tester, add that Professional account as an Instagram tester on OM Social Proof while the app stays in Development."
  - "Confirm login still has no Instagram sign-in."
  - "Do not request Meta App Review or switch OM Social Proof to Live."
  - "Do not put Instagram keys on production Pages."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Pages deploy must apply the new preview Instagram bindings."
  - "Owner Connects Instagram until Account settings shows Connected."
  - "Then continue official Connect in order: X, LinkedIn, Reddit, Discord."
recommended_next_action: "After the Pages deploy succeeds, owner clicks Connect Instagram on development Account settings. Do not mark accepted. Do not merge or deploy production."
contains_secrets_or_private_data: false
---

# Agent Handoff: Instagram preview Login credentials bound

## Objective received

Owner: continue Instagram.

## Shared-memory citations

Assigned shared-memory space for the GitHub repository directory that handles this work:

- GitHub repository: `PeterJFrancoIII/Open-Marketplace`
- GitHub URL: https://github.com/PeterJFrancoIII/Open-Marketplace
- Repo directory: `/Users/computer/App Development/Marketplace/open-exchange-cursor-project/.worktrees/om-crowd-001`
- Assigned memory root: `agent-memory/`

Official social Connect order remains Facebook, TikTok, Instagram, X, LinkedIn, Reddit, Discord.

## Work performed

- Confirmed the owner completed Meta password reauth. Meta app `OM Social Proof` now exists for Instagram Login. The existing Facebook app `Open Marketplace` was left unchanged.
- Saved the development Instagram callback `https://feature-community-surface-re.open-marketplace-demo.pages.dev/api/auth/callback/instagram`.
- Saved deauthorize and data deletion URLs to the development privacy page. App Review was not started. The app remains in Development / unpublished.
- Saved development privacy, terms, and data-deletion URLs on OM Social Proof basic settings. Did not add messaging, comments, publish, or insights permissions.
- Stored preview-only GitHub `PAGES_PREVIEW_INSTAGRAM_CLIENT_ID` and `PAGES_PREVIEW_INSTAGRAM_CLIENT_SECRET`. Production Pages was not changed.
- Did not print the Instagram App Secret. The temporary secret file was removed.

## Verification evidence

See front-matter `verification`. No secrets are stored in this file.

## Runnable preview

Development Account settings: https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings

Connect Instagram becomes available after the branch Pages deploy applies the new preview bindings.

## Deviations and risks

Instagram Login only authorizes Professional Instagram accounts. Development-mode apps may also require the connecting account to hold an Instagram tester role.

The program already requests `instagram_business_basic` only. Extra Instagram messaging or publish scopes were not added.

## Review request

Review the preview-only Instagram credential bind and the Meta dashboard settings. Owner still has to complete Connect Instagram after deploy. Do not mark accepted.
