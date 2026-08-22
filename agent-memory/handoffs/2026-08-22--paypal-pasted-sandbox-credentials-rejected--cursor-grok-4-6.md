---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-CONNECT-PAYPAL-CONSENT-RETURN"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "blocked"
started_at: "2026-08-22T19:33:00Z"
completed_at: "2026-08-22T19:36:00Z"
authority: "human_owner_direct_instruction"
implementation_change_authorized: false
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "b0cd256100bec2d90003841e465cdff1521c22b9"
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
    - "agent-memory/handoffs/2026-08-22--paypal-live-browser-tools-down--cursor-grok-4-6.md"
    - "Master_Descriptor.md"
    - "AGENTS.md"
files_changed:
  - "agent-memory/handoffs/2026-08-22--paypal-pasted-sandbox-credentials-rejected--cursor-grok-4-6.md"
verification:
  - command: "gh variable get PAGES_PREVIEW_PAYPAL_CLIENT_ID / PAGES_PREVIEW_PAYPAL_ENV (lengths and equality only)"
    exit_code: 0
    result: "GitHub preview client ID length 82. Preview env live. That ID is not the sandbox Default Application ID (length 80)."
  - command: "Safari AppleScript of PayPal Developer"
    exit_code: 0
    result: "Open tab is /dashboard/applications/sandbox with Default Application and a secret field. Upgrade-for-live copy is still present."
functional_preview_required: true
functional_preview:
  status: "blocked_on_live_secret_not_sandbox_paste"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings?surface=paypal-input#surface-paypal-input"
  start_command: null
owner_manual_checklist:
  - "Rotate the sandbox secret that was pasted in chat."
  - "Do not paste client IDs or secrets into chat again."
  - "Open Apps & Credentials, switch to Live, leave the Live secret visible, and say ready."
  - "Do not put PayPal keys on production Pages."
  - "Do not mark this owner manual test passed."
owner_manual_result: "not_run"
blockers:
  - "Owner pasted Sandbox Default Application credentials. Those were not stored."
  - "Development preview is PAYPAL_ENV=live with a different 82-character Live client ID. A sandbox secret cannot authenticate that Live app."
  - "Safari Developer tab is still on the sandbox applications list."
remaining_work:
  - "Owner rotates the exposed sandbox secret."
  - "Owner opens the Live app and leaves a fresh Live secret on screen without pasting it."
  - "Cursor binds only that Live secret to preview GitHub/Pages, never production."
  - "Owner retests Connect until last-return is Linked."
recommended_next_action: "Do not apply the pasted sandbox pair. Owner rotates that secret, then opens Live Apps and says ready. Do not switch the marketplace to sandbox. Do not mark accepted. Do not merge or deploy production."
contains_secrets_or_private_data: false
---

# Agent Handoff: Pasted PayPal keys are sandbox and were not stored

## Objective received
Owner pasted a PayPal Client ID and Secret so Cursor could attach them to the development preview.

## Shared-memory citations
Assigned shared-memory space for the GitHub repository directory that handles this work:

- GitHub repository: `PeterJFrancoIII/Open-Marketplace`
- GitHub URL: https://github.com/PeterJFrancoIII/Open-Marketplace
- Repo directory: `/Users/computer/App Development/Marketplace/open-exchange-cursor-project/.worktrees/om-crowd-001`
- Assigned memory root: `agent-memory/`
- Program head before this record: `b0cd256100bec2d90003841e465cdff1521c22b9`

No client IDs, secrets, or personal emails are stored here.

## Findings
The pasted Client ID is the Sandbox Default Application, not the Live app already bound on this preview. GitHub `PAGES_PREVIEW_PAYPAL_ENV` is `live` and the stored preview Client ID length is 82. The sandbox Default Application ID length is 80. Safari is on `/dashboard/applications/sandbox`.

Those values were not written to Git, `agent-memory/`, GitHub secrets, or Cloudflare production. Applying them would keep Connect failing as `paypal-token-client`.

## Review request
Do not mark accepted. The next Live secret must be read from the Live dashboard without being pasted into chat.
