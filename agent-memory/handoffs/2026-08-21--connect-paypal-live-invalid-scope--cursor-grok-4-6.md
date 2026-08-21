---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-CONNECT-PAYPAL-LIVE-INVALID-SCOPE"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-21T19:20:00Z"
completed_at: "2026-08-21T19:28:06Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "3c7d0db9f0083a84d12d62a5711f6d36b7b178eb"
head_commit: "uncommitted"
authority: "human_owner_direct_instruction"
community_surface:
  label: "Connect PayPal"
  href: "/account/settings?surface=connect-paypal#surface-connect-paypal"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "3c7d0db9f0083a84d12d62a5711f6d36b7b178eb"
  paths:
    - "Master_Descriptor.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "https://developer.paypal.com/log-in/build"
    - "https://developer.paypal.com/log-in/references"
files_changed:
  - "lib/paypal-public.ts"
  - "app/api/paypal/callback/route.ts"
  - "tests/paypal-connect.test.mjs"
  - "agent-memory/handoffs/2026-08-21--connect-paypal-live-invalid-scope--cursor-grok-4-6.md"
verification:
  - command: "npm test"
    exit_code: 0
    result: "140/140 passed after live Login scope was reduced to openid."
functional_preview_required: true
functional_preview:
  status: "stale_until_redeploy"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings"
  start_command: null
owner_manual_checklist:
  - "After the development preview is redeployed, hard-refresh Account settings while signed in."
  - "Click Log in with PayPal. Official PayPal Login for Open Marketplace should open, not Sorry about that."
  - "Complete personal PayPal Login. The Open Marketplace account should show Linked."
  - "If paypal.me is missing, official paypal.me setup should open. Save the paypal.me while Login stays connected."
  - "Do not mark this owner manual test passed."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Redeploy the development preview. The live error page is from the currently deployed extra scopes."
  - "Live Log in with PayPal currently accepts only the openid scope. Email, profile, and paypalattributes still return invalid scope on live."
recommended_next_action: "Codex review of the openid-only live Login fix, then redeploy the development preview. Do not mark accepted. Do not change the live bookmark. Do not put PayPal keys on production Pages. Do not store PayPal client IDs or user IDs from the failed URL in canonical memory."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-CONNECT-PAYPAL-LIVE-INVALID-SCOPE

## Objective received
Owner opened official live PayPal Login from the development preview and landed on PayPal's Sorry about that page.

## Shared-memory citations
Read canonical files at `3c7d0db9f0083a84d12d62a5711f6d36b7b178eb`. Official scope table: `openid` is Basic Authentication; `email`, `profile`, and `https://uri.paypal.com/services/paypalattributes` are additional attributes that require approval.

## Work performed
- Reproduced the live error. PayPal's page said `(invalid scope)`.
- Same live client on live PayPal with `openid` only opened official Log in with PayPal for Open Marketplace.
- `openid email`, `openid email profile`, and the previous payer-attribute scope all stayed on `(invalid scope)`.
- Same client on sandbox returned `(invalid client_id or redirect_uri)`, so this is a live app, not a sandbox mix-up.
- Authorize URL now requests only `openid`, encoded with `%20`.
- Userinfo may omit email under that scope. Callback still links the PayPal account by payer id and sends the user to paypal.me setup when no paypal.me is present.

## Verification evidence
`npm test` exit 0, 140/140 passed.

## Runnable preview
The development URL is unchanged. This scope fix is uncommitted and not deployed. The owner will keep seeing Sorry about that until the preview is redeployed.

## Deviations and risks
- Live Login currently cannot request email, profile, or payer-attribute scopes. That is a PayPal live-app permission state, not a requirement that end users have Business accounts.
- After Login, paypal.me remains the public pay-to. It is filled only if PayPal returns it or the user saves it while Login stays connected.

## Review request
Review that live Connect now requests only `openid`, that PayPal Login opens instead of invalid scope, and that the account still links without overwriting Open Marketplace email or name. Do not declare acceptance or production readiness.
