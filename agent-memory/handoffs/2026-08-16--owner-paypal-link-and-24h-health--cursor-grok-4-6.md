---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "owner-paypal-link-and-24h-health"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-16T16:24:00Z"
completed_at: "2026-08-16T16:36:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/account-management-portal"
base_commit: "eb8c2ec812e2a9291d607b9a3c396737b0595749"
head_commit: "uncommitted_at_handoff_write"
authority: "human_owner_explicit_request_2026-08-16"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "96adc20d240f6dd644e74981778d86eeb1e3808b"
  paths:
    - "Master_Descriptor.md"
    - "agent-memory/README.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
pull_request: 21
pull_request_state: "draft"
production_changed: false
merged: false
contains_secrets_or_private_data: false
files_changed:
  - ".github/workflows/deploy-cloudflare-pages.yml"
  - "app/account/account-settings.tsx"
  - "app/account/page.tsx"
  - "app/api/account/profile/route.ts"
  - "app/api/link-health/route.ts"
  - "app/api/listings/route.ts"
  - "app/api/paypal/callback/route.ts"
  - "app/api/paypal/connect/route.ts"
  - "app/api/paypal/disconnect/route.ts"
  - "app/marketplace.tsx"
  - "app/privacy/page.tsx"
  - "lib/auth.ts"
  - "lib/link-health.ts"
  - "lib/payment-destinations.ts"
  - "lib/paypal-connect.ts"
  - "lib/paypal-public.ts"
  - "lib/types.ts"
  - "scripts/configure-pages-preview.mjs"
  - "tests/link-health.test.mjs"
  - "tests/om-acc-010-restore.test.mjs"
  - "tests/paypal-connect.test.mjs"
  - "agent-memory/handoffs/2026-08-16--owner-paypal-link-and-24h-health--cursor-grok-4-6.md"
verification:
  - command: "npm run lint"
    exit_code: 0
    result: "eslint passed"
  - command: "npm test"
    exit_code: 0
    result: "87 tests passed, 0 failed"
functional_preview_required: true
functional_preview:
  status: "ready_after_push"
  url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
  start_command: null
owner_manual_checklist:
  - "Hard-refresh the preview Account settings Payment options section."
  - "If Link PayPal is visible, complete official Log in with PayPal and confirm the public pay-to email fills and the row reads Linked."
  - "If Link PayPal is hidden, PayPal Login is not configured on this preview yet; typed PayPal still saves."
  - "Open one of your listings and confirm the description shows PayPal · Linked or PayPal · Not linked."
  - "Confirm the first open of a listing in 24 hours rechecks social and payment links, and a later open in that window does not."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Owner must add preview PayPal app credentials and the PayPal return URL before Link PayPal works on the HTTPS preview"
  - "Owner functional pass on preview Account settings and listing detail"
recommended_next_action: "Owner tests Link PayPal and listing linked status on the preview URL after adding PayPal app credentials. Codex may review. Do not merge PR #21 or deploy production."
---

# Agent Handoff: owner-paypal-link-and-24h-health

## Objective received

The human owner asked for a PayPal Link button that fills the seller's
public pay-to contact from official PayPal Login, for listings to show
whether that PayPal account is currently linked, and for social and
payment links to be rechecked the first time a listing is opened in a
24-hour cycle.

## Shared-memory citations

Canonical GitHub `PeterJFrancoIII/Open-Marketplace` `origin/main`
`96adc20d240f6dd644e74981778d86eeb1e3808b`. Read `Master_Descriptor.md`,
`agent-memory/README.md`, `agent-memory/STATE.md`, `agent-memory/TASKS.md`,
`agent-memory/DECISIONS.md`, and `AGENTS.md`. Canonical STATE/TASKS remain
stale versus this branch. No Codex-assigned PayPal task matched; this
slice is an explicit owner override of OM-DEC-014's "OAuth out of scope"
note, using the same link-only pattern as Facebook Connect. OM-DEC-016 /
OM-DEC-017 remain in force for Facebook. Payment execution, checkout,
custody, and escrow remain out of scope.

## Work performed

- Added official Log in with PayPal as a signed-in link-only flow
  (`openid email profile`). It is not a sign-in or sign-up path.
- On success, the PayPal email is written as the public pay-to PayPal
  destination. Browser PUTs cannot mark a PayPal row as oauth or overwrite
  a linked email.
- Listing GET/POST/PATCH set `paypalLinked` from a live `auth_accounts`
  PayPal row. Cards and detail show **PayPal · Linked** or
  **PayPal · Not linked**.
- First detail open of a registry listing in a rolling 24 hours calls
  `/api/link-health`. Later opens in that window skip. Public viewers do
  not write health results back to D1. OAuth Facebook/PayPal are treated
  as linked from `auth_accounts`; typed emails and allowlisted payment
  URLs are format-checked or HTTPS-fetched.
- Preview-only Pages env wiring for `PAYPAL_CLIENT_ID`,
  `PAYPAL_CLIENT_SECRET`, and `PAYPAL_ENV`. Production Pages config is
  unchanged.

## Verification evidence

`npm run lint` exit 0. `npm test` exit 0: 87 passed, 0 failed.

## Runnable preview

Owner HTTPS preview:
https://feature-account-management-p.open-marketplace-demo.pages.dev/

Link PayPal stays hidden until preview PayPal credentials exist. Return
URL to add in the PayPal app:

`https://feature-account-management-p.open-marketplace-demo.pages.dev/api/paypal/callback`

GitHub preview vars/secrets: `PAGES_PREVIEW_PAYPAL_CLIENT_ID`,
`PAGES_PREVIEW_PAYPAL_CLIENT_SECRET`, optional `PAGES_PREVIEW_PAYPAL_ENV`
(`sandbox` default).

## Deviations and risks

- Owner override: PayPal Login is now in scope on this feature branch
  even though canonical OM-DEC-014 still says payment OAuth is out of
  scope.
- Live Log in with PayPal requires PayPal app review. Default env is
  sandbox.
- 24-hour freshness is stored in the viewer's `localStorage` plus
  `lastCheckedAt` on returned objects. It is not a server-side per-listing
  write, to avoid public DoS against D1.
- Instagram, TikTok, Venmo, Cash App, Zelle, and Apple Cash remain typed
  public contacts. No checkout, Orders API, or payouts.

## Review request

Codex should review the PayPal link-only OAuth path, listing
`paypalLinked` overlay, payment-save merge that blocks spoofed oauth
rows, and the 24-hour listing health check. Do not mark accepted, merge
PR #21, or deploy production.
