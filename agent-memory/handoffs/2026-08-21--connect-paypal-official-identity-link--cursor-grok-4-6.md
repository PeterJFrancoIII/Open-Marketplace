---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-CONNECT-PAYPAL-IDENTITY-LINK"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-21T18:26:00Z"
completed_at: "2026-08-21T18:32:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "47574bdd5b3f6b45344ee9fdba1ad828f3802aa3"
head_commit: "uncommitted"
authority: "human_owner_direct_instruction"
community_surface:
  label: "Connect PayPal"
  href: "/account/settings?surface=connect-paypal#surface-connect-paypal"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "47574bdd5b3f6b45344ee9fdba1ad828f3802aa3"
  paths:
    - "Master_Descriptor.md"
    - "agent-memory/README.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "AGENTS.md"
    - "app/account/account-settings.tsx"
    - "lib/paypal-public.ts"
    - "lib/paypal-connect.ts"
    - "app/api/paypal/connect/route.ts"
    - "app/api/paypal/callback/route.ts"
files_changed:
  - "app/account/account-settings.tsx"
  - "lib/payment-destinations.ts"
  - "lib/paypal-connect.ts"
  - "lib/paypal-public.ts"
  - "tests/paypal-connect.test.mjs"
  - "agent-memory/handoffs/2026-08-21--connect-paypal-official-identity-link--cursor-grok-4-6.md"
verification:
  - command: "npm test"
    exit_code: 0
    result: "139/139 passed after restoring official Log in with PayPal Identity linking."
functional_preview_required: true
functional_preview:
  status: "reachable"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings"
  start_command: null
owner_manual_checklist:
  - "Hard-refresh Account settings on the development URL while signed in."
  - "Click Connect PayPal. Official PayPal Login should open automatically. Do not paste a paypal.me link."
  - "Approve sharing email and PayPal account ID. The public PayPal pay-to should fill from PayPal and stay filled after refresh."
  - "Open Marketplace name and email must stay unchanged."
  - "Disconnect PayPal should stay cleared after refresh."
  - "Do not mark this owner manual test passed."
owner_manual_result: "not_run"
blockers:
  - "Preview Pages still bind sandbox PayPal app credentials. Live personal PayPal Login needs live REST app credentials on preview only, plus PayPal app review for live Log in with PayPal."
remaining_work:
  - "Owner functional click of official Connect PayPal on the development URL after deploy."
  - "Bind live PayPal REST credentials to preview only when the marketplace developer app can issue live Log in with PayPal credentials. Do not put PayPal keys on production Pages."
recommended_next_action: "Codex review of official Identity linking. Redeploy the development preview so the owner can test. Do not mark accepted. Do not change the live bookmark. Do not put PayPal keys on production Pages."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-CONNECT-PAYPAL-IDENTITY-LINK

## Objective received
Owner said Connect PayPal was not working and must automatically connect the user's PayPal account to the Open Marketplace account. Study current PayPal documentation and add the connector properly.

## Shared-memory citations
Read `Master_Descriptor.md`, `agent-memory/README.md`, `agent-memory/STATE.md`, `agent-memory/TASKS.md`, `agent-memory/DECISIONS.md`, and the prior paypal.me handoff. Human-owner instruction outranks OM-DEC-014 for this connector. Official PayPal docs used: https://developer.paypal.com/log-in/how-it-works (updated 2026-08-17), https://developer.paypal.com/log-in/build, https://developer.paypal.com/log-in/build-button, https://developer.paypal.com/log-in/references, and https://developer.paypal.com/api/identity/v1/userinfo-get.

## Work performed
PayPal's current Identity docs say an existing website account is linked by Log in with PayPal (OAuth 2.0 / OpenID Connect), not by pasting paypal.me. Connect PayPal now launches `/api/paypal/connect` when the marketplace PayPal app is bound. The authorize URL stays on official `/connect` with `flowEntry=static`, `response_type=code`, `fullPage=true`, and documented scopes `openid email profile` plus `https://uri.paypal.com/services/paypalattributes` so the PayPal account ID (payer ID) is returned. The callback now reads official `/v1/identity/openidconnect/userinfo` first, then the older `/v1/identity/oauth2/userinfo?schema=paypalv1.1` fallback, and writes the PayPal email as the public pay-to. Open Marketplace name, email, and image are not overwritten. Tokens stay server-side. Unsigned PayPal social sign-in stays rejected. Production Pages and the live bookmark were not changed.

## Verification evidence
`npm test` exit 0, 139/139 passed.

## Deviations and risks
The typed paypal.me Connect path is no longer the button's primary behavior. `/api/paypal/destination` remains for leftover typed values. Preview still uses sandbox PayPal app credentials, so the official Login window may be sandbox until live credentials are bound to preview. Live Log in with PayPal also requires PayPal app review.

## Review request
Confirm Connect PayPal starts official Identity Login and auto-fills the public PayPal pay-to after consent. Do not mark accepted.
