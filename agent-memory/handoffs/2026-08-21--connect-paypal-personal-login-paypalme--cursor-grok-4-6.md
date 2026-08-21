---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-CONNECT-PAYPAL-PERSONAL-LOGIN-ME"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-21T19:02:00Z"
completed_at: "2026-08-21T19:08:55Z"
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
    - "agent-memory/README.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "agent-memory/HANDOFF_TEMPLATE.md"
    - "CURSOR_START_HERE.md"
files_changed:
  - "app/account/account-settings.tsx"
  - "app/api/paypal/callback/route.ts"
  - "app/api/paypal/destination/route.ts"
  - "app/marketplace.tsx"
  - "lib/payment-destinations.ts"
  - "lib/paypal-connect.ts"
  - "lib/paypal-public.ts"
  - "lib/types.ts"
  - "tests/paypal-connect.test.mjs"
  - "agent-memory/handoffs/2026-08-21--connect-paypal-personal-login-paypalme--cursor-grok-4-6.md"
verification:
  - command: "npm test"
    exit_code: 0
    result: "140/140 passed after personal Log in with PayPal + paypal.me wiring."
functional_preview_required: true
functional_preview:
  status: "stale_until_redeploy"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings"
  start_command: null
owner_manual_checklist:
  - "Hard-refresh Account settings on the development URL while signed in."
  - "Click Log in with PayPal. Complete official PayPal Login with a personal PayPal account."
  - "PayPal should show Linked on the Open Marketplace account."
  - "If paypal.me already exists and PayPal returns it, the public pay-to should fill automatically."
  - "If paypal.me is missing, the site should open official paypal.me setup. After creating or copying the link, save it while Login stays connected."
  - "Disconnect PayPal should stay cleared after refresh."
  - "Do not mark this owner manual test passed."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Redeploy the development preview so the owner can click the new Login + paypal.me flow."
  - "Live Log in with PayPal may still be pending PayPal app review even after env is live."
recommended_next_action: "Codex review of personal Log in with PayPal plus paypal.me fill/setup. Redeploy the development preview. Do not mark accepted. Do not change the live bookmark. Do not put PayPal keys on production Pages. Do not tell end users they need a Business PayPal account."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-CONNECT-PAYPAL-PERSONAL-LOGIN-ME

## Objective received
Owner said the PayPal connector is Log in with PayPal for Open Marketplace users. After Login, PayPal shows connected and the public pay-to is the user's paypal.me. If they do not have paypal.me, take them to the official setup page. This is not a business-account API or checkout. Purpose is anti-spoof: official Login fills identity and users must stay connected.

## Shared-memory citations
Read canonical files at `3c7d0db9f0083a84d12d62a5711f6d36b7b178eb`. `agent-memory/TASKS.md` has no matching execution-ready row. Authority is human-owner direct instruction. Official PayPal Identity userinfo documents email, name, payer id, and `account_type: PERSONAL`. It does not document a paypal.me handle.

## Work performed
- Kept Connect as official `/api/paypal/connect` Log in with PayPal for personal accounts.
- After callback, PayPal is marked connected. If userinfo includes a paypal.me URL, that becomes the public pay-to.
- If userinfo has no paypal.me, callback sends the user to settings with `paypalme=setup`, and settings opens `https://www.paypal.com/paypalme`.
- Saving a paypal.me now requires an active PayPal Login. Typed paypal.me without Login is rejected.
- Settings button label is Log in with PayPal. Copy says personal Login, stay connected, not a business checkout.
- Listings no longer publish PayPal emails on the chip; they show paypal.me when present.
- Open Marketplace name and email are still not overwritten. Tokens stay server-side. Unsigned PayPal social sign-in stays rejected.

## Verification evidence
`npm test` exit 0, 140/140 passed.

## Runnable preview
Development URL is unchanged. This work is uncommitted and not deployed. Owner cannot see the new flow until Codex or an authorized deploy updates the preview.

## Deviations and risks
- PayPal Identity does not return paypal.me in the documented userinfo schema. Automatic fill works only if PayPal includes a paypal.me URL. Otherwise the user is sent to official paypal.me setup and saves the handle while Login remains connected.
- A marketplace developer REST app is still required for the Login button to exist. That is infrastructure for Open Marketplace, not a product requirement that end users be businesses.
- Live Login may still fail or stay pending review on PayPal's side.

## Review request
Review that Connect is personal Log in with PayPal, that paypal.me is the public pay-to, that missing paypal.me opens official setup, and that typed paypal.me cannot spoof a pay-to without Login. Do not declare acceptance, merge approval, or production readiness.
