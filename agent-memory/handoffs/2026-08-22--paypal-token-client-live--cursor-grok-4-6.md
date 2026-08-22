---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-CONNECT-PAYPAL-CONSENT-RETURN"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "blocked"
started_at: "2026-08-22T18:46:00Z"
completed_at: "2026-08-22T18:50:00Z"
authority: "human_owner_direct_instruction"
implementation_change_authorized: false
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "8bfb1b1795772bd32ccf53f5fddc0a1a78272777"
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
    - "agent-memory/handoffs/2026-08-22--paypal-token-not-a-link-refusal--cursor-grok-4-6.md"
    - "Master_Descriptor.md"
    - "AGENTS.md"
files_changed:
  - "agent-memory/handoffs/2026-08-22--paypal-token-client-live--cursor-grok-4-6.md"
verification:
  - command: "Preview D1 aggregate query"
    exit_code: 0
    result: "paypal auth_accounts=0; lastReturn statuses=paypal-state and paypal-token-client"
  - command: "Node live Connect trace against development preview"
    exit_code: 0
    result: "Unsigned connect 302 /login. Signed connect 302 www.paypal.com/connect scope=openid redirect_uri on development callback. client_id length 82. lastReturn null on throwaway account."
  - command: "cursor-ide-browser navigate"
    exit_code: 1
    result: "Server not found: cursor-ide-browser"
functional_preview_required: true
functional_preview:
  status: "reachable_blocked_on_live_client_secret"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings?surface=paypal-input#surface-paypal-input"
  start_command: null
owner_manual_checklist:
  - "In PayPal Developer Dashboard, open the Live Log in with PayPal app."
  - "Confirm the Live client ID is the one bound on the development Pages preview."
  - "Create or copy a fresh Live client secret."
  - "Update only the preview Pages secret PAYPAL_CLIENT_SECRET. Do not put PayPal keys on production Pages."
  - "Do not paste the secret into chat, Git, or agent-memory."
  - "Hard-refresh Account settings and click Log in with PayPal again."
  - "Success is Linked. If it fails, report the exact visible state."
  - "Do not mark this owner manual test passed."
owner_manual_result: "failed_paypal-token-client"
blockers:
  - "Live token exchange returned paypal-token-client. PayPal rejected the app credentials. Linked cannot be written until the preview Live client ID and secret match."
  - "Cursor in-app browser remains unavailable, so a full UI Login watch could not run. Connect was proven over HTTPS."
remaining_work:
  - "Owner refreshes the preview Live PayPal client secret against the same Live app."
  - "Owner retests Linked after that secret is saved."
recommended_next_action: "Fix the preview Live client secret. Do not change the authorize path or token form. Do not mark accepted. Do not merge or deploy production."
contains_secrets_or_private_data: false
---

# Agent Handoff: Live Login reaches callback; PayPal rejects the client

## Objective received
Owner: tried Login again; it still did not link. Asked Cursor to try it.

## Shared-memory citations
Assigned shared-memory space for the GitHub repository directory that handles this work:

- GitHub repository: `PeterJFrancoIII/Open-Marketplace`
- GitHub URL: https://github.com/PeterJFrancoIII/Open-Marketplace
- Repo directory: `/Users/computer/App Development/Marketplace/open-exchange-cursor-project/.worktrees/om-crowd-001`
- Assigned memory root: `agent-memory/`
- Program head: `8bfb1b1795772bd32ccf53f5fddc0a1a78272777`

No user IDs, emails, tokens, or client secrets are stored here.

## Findings
The owner's latest completed return recorded `paypal-token-client`. That status is written only when PayPal's token response classifies as invalid client / client authentication failed. Preview D1 still has zero `provider_id = paypal` rows.

A live Connect trace on the development preview, after the Pages deploy of `8bfb1b1`, showed:

- Unsigned connect → `/login`
- Signed connect → `https://www.paypal.com/connect` with `scope=openid`, `flowEntry=static`, development callback, client id length 82
- Preview env: `PAYPAL_ENV=live`; client id and secret bindings are present; production Pages still has no PayPal keys

The in-app browser could not be driven (`Server not found: cursor-ide-browser`). Cursor cannot complete PayPal's own login without the owner's PayPal account.

This is not a link-refusal bug in `upsertPaypalAccount`. The exchange never received a usable access token because PayPal rejected the client credentials.

## Review request
Owner updates the preview Live client secret for the same Live app, then retests. Do not declare acceptance, merge approval, or production readiness.
