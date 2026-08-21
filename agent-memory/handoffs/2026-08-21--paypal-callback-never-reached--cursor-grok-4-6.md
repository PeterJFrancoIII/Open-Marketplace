---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-CONNECT-PAYPAL-CONSENT-RETURN"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "blocked"
started_at: "2026-08-21T22:53:00Z"
completed_at: "2026-08-21T22:58:00Z"
authority: "human_owner_direct_instruction"
implementation_change_authorized: true
paypal_oauth_rewrite_authorized: false
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "4d0ad28b8a27ce3ea9461393a9504817d833d6a1"
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
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "agent-memory/handoffs/2026-08-21--restore-paypal-connect-login-path--cursor-grok-4-6.md"
    - "Master_Descriptor.md"
    - "AGENTS.md"
files_changed:
  - "app/account/account-settings.tsx"
  - "tests/paypal-connect.test.mjs"
  - "agent-memory/handoffs/2026-08-21--paypal-callback-never-reached--cursor-grok-4-6.md"
verification:
  - command: "Cloudflare D1 aggregate query on open-marketplace-account-preview-d1"
    exit_code: 0
    result: "paypal auth_accounts=0; lastReturn statuses=started only; one unconsumed oauth attempt"
  - command: "gh run view 32534135499"
    exit_code: 0
    result: "4d0ad28 Pages deploy succeeded to alias and https://5af3683d.open-marketplace-demo.pages.dev"
functional_preview_required: true
functional_preview:
  status: "blocked_callback_never_reached"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings?surface=paypal-input#surface-paypal-input"
  start_command: null
owner_manual_checklist:
  - "After Log in with PayPal, look at the browser address bar before leaving PayPal."
  - "If the host is still paypal.com, PayPal did not send the return."
  - "If the host is feature-account-management-p, the return went to the old preview."
  - "If the host is feature-community-surface-re and the path is /api/paypal/callback, report the query string category only: code, error, or empty. Do not send codes or tokens."
  - "Confirm the Live app Return URL is exactly https://feature-community-surface-re.open-marketplace-demo.pages.dev/api/paypal/callback"
  - "Do not mark this owner manual test passed."
owner_manual_result: "failed_callback_never_reached"
blockers:
  - "GET /api/paypal/callback on the development preview never completed. lastReturn stayed started and no paypal auth account was written."
remaining_work:
  - "Owner reports the post-Login address-bar host. Do not issue another authorize-path rewrite until that return is observed."
recommended_next_action: "Owner confirms the PayPal address bar after Login and the exact Live Return URL. Do not add JS SDK v6 checkout. Do not mark PayPal accepted. Do not merge or deploy production."
contains_secrets_or_private_data: false
---

# Agent Handoff: PayPal callback never reached this preview

## Objective received
Owner: after restoring `/connect`, PayPal is still not connecting.

## Shared-memory citations
Assigned shared-memory space for the GitHub repository directory that handles this work:

- GitHub repository: `PeterJFrancoIII/Open-Marketplace`
- GitHub URL: https://github.com/PeterJFrancoIII/Open-Marketplace
- Repo directory: `/Users/computer/App Development/Marketplace/open-exchange-cursor-project/.worktrees/om-crowd-001`
- Assigned memory root: `agent-memory/`
- Exact ref: this publication commit

## Findings
Pages deployed `4d0ad28` successfully. The latest Connect attempt stored this exact redirect URI:

`https://feature-community-surface-re.open-marketplace-demo.pages.dev/api/paypal/callback`

Preview D1 evidence, no user identifiers:

- `auth_accounts.provider_id = paypal` count: 0
- lastReturn values: `started` only
- one unconsumed `paypal-oauth:` attempt still present

That means `/api/paypal/callback` on this preview never ran. Token exchange, Linked UI, and paypal.me fill cannot execute if the browser never returns here. Another authorize-path change will not create a Linked row.

Unsigned `/api/paypal/connect` on the live bookmark still returns `error=paypal`, so that old deploy is not a working Login host.

JS SDK v6 remains checkout-only and was not added.

## Work performed
Made the disconnected PayPal card show the last-return sentence on the card itself so the owner can read the failing boundary without scrolling to a top banner.

## Review request
Owner reports the address-bar host after PayPal Login. Do not declare acceptance, merge approval, or production readiness.
