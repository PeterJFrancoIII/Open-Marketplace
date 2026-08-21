---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-CONNECT-PAYPAL-CONSENT-RETURN"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-21T22:39:00Z"
completed_at: "2026-08-21T22:44:00Z"
authority: "human_owner_direct_instruction"
implementation_change_authorized: true
paypal_sdk_v6_in_scope: false
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "fa9efde6b0b4725422d870848fcb83c460e81a54"
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
    - "agent-memory/handoffs/2026-08-21--paypal-return-url-enabled-sdk-v6-out-of-scope--cursor-grok-4-6.md"
    - "Master_Descriptor.md"
    - "AGENTS.md"
files_changed:
  - "lib/paypal-public.ts"
  - "lib/paypal-login-exchange.ts"
  - "lib/paypal-oauth-attempt.ts"
  - "app/api/paypal/callback/route.ts"
  - "tests/paypal-connect.test.mjs"
  - "tests/paypal-oauth-return.test.mjs"
  - "agent-memory/handoffs/2026-08-21--restore-paypal-connect-login-path--cursor-grok-4-6.md"
verification:
  - command: "npm run build && node --experimental-strip-types --test tests/paypal-oauth-return.test.mjs tests/paypal-connect.test.mjs"
    exit_code: 0
    result: "18/18 PayPal tests passed, including Pages alias vs unique-host return"
  - command: "node --experimental-strip-types --test tests/*.test.mjs"
    exit_code: 0
    result: "147/147 passed"
functional_preview_required: true
functional_preview:
  status: "ready_for_owner_retest_after_pages_deploy"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings?surface=paypal-input#surface-paypal-input"
  start_command: null
owner_manual_checklist:
  - "Wait for the Cloudflare Pages deploy of this commit."
  - "Hard-refresh the development settings URL while signed in."
  - "Click Log in with PayPal and stay on PayPal until Open Marketplace reloads."
  - "The PayPal row must say Linked."
  - "Do not mark this owner manual test passed."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Owner retests Linked after Pages deploys this restore."
recommended_next_action: "Owner retests the development settings URL after deploy. Do not add JS SDK v6 checkout. Do not mark PayPal accepted. Do not merge or deploy production."
contains_secrets_or_private_data: false
---

# Agent Handoff: Restore the original Log in with PayPal /connect path

## Objective received
Owner: Login still does not show Linked after the Return URL was enabled. The first implementation worked in a few iterations; later changes have failed consistently.

## Shared-memory citations
Assigned shared-memory space for the GitHub repository directory that handles this work:

- GitHub repository: `PeterJFrancoIII/Open-Marketplace`
- GitHub URL: https://github.com/PeterJFrancoIII/Open-Marketplace
- Repo directory: `/Users/computer/App Development/Marketplace/open-exchange-cursor-project/.worktrees/om-crowd-001`
- Assigned memory root: `agent-memory/`
- Exact ref: this publication commit

Official sources compared:

- First working program: `bf52a82` (`/connect`, token form includes `redirect_uri`)
- Current official go-live example: `https://www.paypal.com/connect?flowEntry=static&...`
- Later speculative path: `/signin/authorize` plus token form without `redirect_uri`

## Findings
The first working Login used official `/connect`. Later iterations changed the authorize path to `/signin/authorize`, dropped `redirect_uri` from the token form, and rejected callbacks unless the request origin exactly matched the stored redirect URI. That last check can fail on Cloudflare Pages when the alias host and the unique deploy host differ.

JS SDK v6 remains checkout-only and was not added.

## Work performed
Restored the original `/connect` authorize URL (openid only, because live extra scopes were already proven invalid). Token exchange again sends the stored `redirect_uri`. Callback accepts any allowed Open Marketplace host and exchanges against the stored URI.

## Review request
Owner retests Linked on the development preview after Pages deploys this commit. Do not declare acceptance, merge approval, or production readiness.
