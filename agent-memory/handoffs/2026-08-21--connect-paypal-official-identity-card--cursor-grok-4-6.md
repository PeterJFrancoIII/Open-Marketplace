---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-CONNECT-PAYPAL-CONSENT-RETURN"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-21T20:17:00Z"
completed_at: "2026-08-21T20:23:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "ed992a050393bfea448572ab5d5bcabd23e301bd"
head_commit: "uncommitted"
authority: "human_owner_direct_instruction"
community_surface:
  label: "PayPal input"
  href: "/account/settings?surface=paypal-input#surface-paypal-input"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "ed992a050393bfea448572ab5d5bcabd23e301bd"
  paths:
    - "Master_Descriptor.md"
    - "agent-memory/README.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "AGENTS.md"
    - "lib/paypal-public.ts"
    - "lib/paypal-connect.ts"
    - "app/account/account-settings.tsx"
files_changed:
  - "lib/types.ts"
  - "lib/paypal-public.ts"
  - "lib/paypal-connect.ts"
  - "lib/official-connector-facts.ts"
  - "app/api/paypal/callback/route.ts"
  - "app/account/account-settings.tsx"
  - "tests/paypal-connect.test.mjs"
  - "agent-memory/handoffs/2026-08-21--connect-paypal-official-identity-card--cursor-grok-4-6.md"
verification:
  - command: "npm test"
    exit_code: 0
    result: "143/143 passed. Official PayPal identity is stored on the account and shown on settings. PayPal email survives after paypal.me save."
functional_preview_required: true
functional_preview:
  status: "reachable"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings?surface=paypal-input#surface-paypal-input"
  start_command: null
owner_manual_checklist:
  - "Hard-refresh Account settings on the development URL while signed in."
  - "Disconnect PayPal if it already says Linked, then click Log in with PayPal and continue back to Open Marketplace."
  - "The PayPal row should show official Login fields PayPal actually sent: name, photo, email, account type, and verified mark when present."
  - "paypal.me fills only if PayPal sent it. If the pay-to field is still empty, open paypal.me, copy the link, and save it while Linked."
  - "Open Marketplace name and email must stay unchanged."
  - "Do not mark this owner manual test passed."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Owner retest after disconnect and Login again so the new identity snapshot is stored."
  - "Live extra scopes (email, profile, paypalattributes) still cannot be requested; they produced (invalid scope) on this live app. Official Login has no paypal.me attribute."
recommended_next_action: "Codex review of the official PayPal identity card. Redeploy the development preview. Do not mark accepted. Do not change the live bookmark. Do not put PayPal keys on production Pages."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-CONNECT-PAYPAL-CONSENT-RETURN

## Objective received
Owner said Login showed cooler information but the Open Marketplace account still did not receive the paypal.me link or the rest of the PayPal identity.

## Shared-memory citations
Read `Master_Descriptor.md`, `agent-memory/README.md`, `agent-memory/STATE.md`, `agent-memory/TASKS.md`, and official PayPal scope docs at https://developer.paypal.com/log-in/references. Official mapping: `openid` returns no user attributes; `profile` is full name; `email` is email; `paypalattributes` is verification status and payer ID. There is no paypal.me Login attribute.

## Work performed
The connector now stores a public PayPal identity snapshot from userinfo and the Login token (name, given name, family name, photo, email, account type, verified mark, locale, paypal.me when present). Account settings shows that official identity on the PayPal row the same way other connectors do. The PayPal email stays on the account after a paypal.me save. Open Marketplace name, email, and image are not overwritten. Tokens stay server-side. Live authorize scope stays `openid` so Login does not return to `(invalid scope)`. paypal.me is still not invented.

## Verification evidence
`npm test` exit 0, 143/143 passed.

## Deviations and risks
If live PayPal still sends only a payer id under `openid`, the official card will say the account is linked and will not invent name, email, or paypal.me. Requesting extra scopes on this live app still breaks Login. The owner must Disconnect and Log in with PayPal again after this deploy so the snapshot is written.

## Review request
Review the identity snapshot and settings card. Confirm the development preview is redeployed. Do not declare acceptance, merge approval, or production readiness.
