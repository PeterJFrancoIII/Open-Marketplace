---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-CONNECT-PAYPAL-CONSENT-RETURN"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-21T20:03:00Z"
completed_at: "2026-08-21T20:11:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "6ab3bd91824f024a9342f1dbe6a5a6a25fa91327"
head_commit: "uncommitted"
authority: "human_owner_direct_instruction"
community_surface:
  label: "PayPal input"
  href: "/account/settings?surface=paypal-input#surface-paypal-input"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "6ab3bd91824f024a9342f1dbe6a5a6a25fa91327"
  paths:
    - "Master_Descriptor.md"
    - "agent-memory/README.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "AGENTS.md"
    - "lib/paypal-public.ts"
    - "lib/paypal-connect.ts"
    - "app/api/paypal/callback/route.ts"
    - "app/account/account-settings.tsx"
files_changed:
  - "lib/paypal-public.ts"
  - "lib/paypal-connect.ts"
  - "app/api/paypal/callback/route.ts"
  - "app/account/account-settings.tsx"
  - "tests/paypal-connect.test.mjs"
  - "agent-memory/handoffs/2026-08-21--connect-paypal-input-empty-after-login--cursor-grok-4-6.md"
verification:
  - command: "npm test"
    exit_code: 0
    result: "143/143 passed. Connector now merges PayPal userinfo fragments with id_token claims and writes paypal.me or email into the public pay-to."
functional_preview_required: true
functional_preview:
  status: "reachable"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings?surface=paypal-input#surface-paypal-input"
  start_command: null
owner_manual_checklist:
  - "Hard-refresh Account settings on the development URL while signed in."
  - "Click Log in with PayPal and finish on PayPal by continuing back to Open Marketplace. Do not stop on the PayPal remembered page."
  - "After return, the PayPal input should show paypal.me or the PayPal email from Login, and the row should say Linked."
  - "Open Marketplace name and email must stay unchanged."
  - "If the field is still empty, PayPal did not send a pay-to with the live openid token. Save paypal.me while Linked."
  - "Do not mark this owner manual test passed."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Owner functional click of Log in with PayPal on the development URL after this commit is deployed."
  - "Live extra scopes (email, profile, paypalattributes) still cannot be requested until PayPal approves them. Do not add those scopes back."
recommended_next_action: "Codex review of the identity-merge connector fix. Redeploy the development preview so the owner can retest the PayPal input. Do not mark accepted. Do not change the live bookmark. Do not put PayPal keys on production Pages."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-CONNECT-PAYPAL-CONSENT-RETURN

## Objective received
Owner reported the same empty PayPal input after a working Log in with PayPal page. The surface is `/account/settings?surface=paypal-input#surface-paypal-input`. The connector was not writing Login identity into that field.

## Shared-memory citations
Read `Master_Descriptor.md`, `agent-memory/README.md`, `agent-memory/STATE.md`, `agent-memory/TASKS.md`, `agent-memory/DECISIONS.md`, and prior 2026-08-21 PayPal handoffs. Human-owner instruction outranks OM-DEC-014 for this connector. Official docs used: https://developer.paypal.com/log-in/build, https://developer.paypal.com/log-in/build-button, and https://developer.paypal.com/api/identity/v1/userinfo-get. PayPal says returned attributes depend on scopes associated with the client ID, and the current userinfo GET has no required schema query.

## Work performed
The live app can only request `openid`. The previous callback required a payer id on the first userinfo parse. When PayPal returned email without `sub` / `payer_id`, that email was discarded and the id_token fallback stored only `sub`. No public pay-to was written, so the PayPal input stayed empty even when Login itself worked.

The connector now:

- reads official userinfo URLs with and without schema;
- keeps email, name, paypal.me, and payer id from every successful userinfo body;
- merges those fragments with id_token claims instead of replacing them;
- writes paypal.me or PayPal email as the public pay-to when either is present;
- sends `paypalme=setup` only when Login produced no pay-to;
- returns the owner to `#surface-paypal-input` and reloads the saved pay-to into the field;
- keeps the OAuth cookie for one hour so a longer PayPal consent still returns.

Tokens stay server-side. Open Marketplace name, email, and image are not overwritten. Live extra scopes were not added. Production Pages and the live bookmark were not changed.

## Verification evidence
`npm test` exit 0, 143/143 passed.

## Runnable preview
Development URL: `https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings?surface=paypal-input#surface-paypal-input`. Owner checklist is in the front matter. `owner_manual_result: not_run`.

## Deviations and risks
If live PayPal still returns neither email nor paypal.me under `openid`, the input cannot be invented. The account can still show Linked, and the owner can save paypal.me after Login. Requesting `email` / `profile` / paypalattributes on this live app still produced `(invalid scope)` earlier today.

## Review request
Review the identity-merge callback and the PayPal input refill. Confirm the development preview is redeployed for owner retest. Do not declare acceptance, merge approval, or production readiness.
