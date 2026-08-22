---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-NEXT-CONNECTORS"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-22T23:09:00Z"
completed_at: "2026-08-22T23:20:00Z"
authority: "human_owner_direct_instruction"
implementation_change_authorized: false
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "146f9ba925d04a084e0292399c067fd2b924ad14"
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
    - "agent-memory/handoffs/2026-08-22--instagram-invalid-redirect-uri--cursor-grok-4-6.md"
files_changed:
  - "agent-memory/handoffs/2026-08-22--instagram-insufficient-developer-role--cursor-grok-4-6.md"
verification:
  - command: "Safari OM Social Proof App roles"
    exit_code: 0
    result: "Instagram Tester row exists. Pending status cleared after invite accept. Facebook Administrator role was already present and is not enough for Instagram Login."
  - command: "Safari Instagram Apps and websites Tester Invites"
    exit_code: 0
    result: "OM Social Proof-IG invite accepted on Aug 22, 2026. Instagram username is not recorded here."
functional_preview_required: true
functional_preview:
  status: "instagram_tester_invite_accepted"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings"
  start_command: null
owner_manual_checklist:
  - "Hard-refresh Account settings and click Connect Instagram again."
  - "Use the same Professional Instagram account that accepted the OM Social Proof-IG tester invite."
  - "If Instagram still errors, confirm that account is Business or Creator, not a personal consumer account."
  - "Confirm login still has no Instagram sign-in."
  - "Do not request Meta App Review or switch OM Social Proof to Live."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Owner completes Connect Instagram until Account settings shows Connected."
recommended_next_action: "Owner retries Connect Instagram on the development Account settings page. Do not mark accepted."
contains_secrets_or_private_data: false
---

# Agent Handoff: Instagram Insufficient Developer Role corrected

## Objective received

Owner hit Instagram OAuth error `Insufficient Developer Role` after the redirect URI fix.

## Shared-memory citations

Assigned shared-memory space for the GitHub repository directory that handles this work:

- GitHub repository: `PeterJFrancoIII/Open-Marketplace`
- GitHub URL: https://github.com/PeterJFrancoIII/Open-Marketplace
- Repo directory: `/Users/computer/App Development/Marketplace/open-exchange-cursor-project/.worktrees/om-crowd-001`
- Assigned memory root: `agent-memory/`

## Work performed

- Confirmed OM Social Proof remains in Development. Standard Access Instagram Login only works for Instagram testers on the app.
- Facebook Administrator on the Meta app is not an Instagram Tester. That mismatch is the Insufficient Developer Role error.
- Added the Instagram account currently logged into the owner's Safari session as an Instagram Tester on OM Social Proof.
- Accepted the `OM Social Proof-IG` tester invite in Instagram Settings > Apps and websites > Tester Invites.
- Did not record the Instagram username, email, or any secret. Did not request App Review. Did not switch the app to Live.

## Verification evidence

See front-matter `verification`.

## Runnable preview

https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings

No Pages deploy is required for this Meta/Instagram role change.

## Deviations and risks

Instagram Login still requires a Professional Instagram account. If Connect used a different Instagram account than the Safari session that accepted the invite, that other account still needs its own tester invite.

## Review request

Review the Development-mode tester correction. Owner still has to complete Connect Instagram. Do not mark accepted.
