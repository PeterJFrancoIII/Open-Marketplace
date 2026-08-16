---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "owner-connector-clicks-dead"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-16T16:51:00Z"
completed_at: "2026-08-16T16:55:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/account-management-portal"
base_commit: "33c661d156c87a833ac959af9999f268ee8d00b8"
head_commit: "pending_commit_after_handoff"
authority: "human_owner_explicit_request_2026-08-16"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "96adc20d240f6dd644e74981778d86eeb1e3808b"
  paths:
    - "Master_Descriptor.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
pull_request: 21
pull_request_state: "draft"
production_changed: false
merged: false
contains_secrets_or_private_data: false
files_changed:
  - "app/account/account-settings.tsx"
  - "app/api/listings/route.ts"
  - "app/globals.css"
  - "app/marketplace.tsx"
  - "lib/auth.ts"
  - "lib/profile-settings.ts"
  - "tests/facebook-connect.test.mjs"
  - "tests/facebook-listing-proof.test.mjs"
  - "agent-memory/handoffs/2026-08-16--owner-connector-clicks-dead--cursor-grok-4-6.md"
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
  - "Hard-refresh the preview homepage."
  - "Click PayPal on your listing. It should open paypal.me/PeterFranco in a new tab, not the listing."
  - "Facebook Connected still has no Facebook-supplied profile URL. In Account settings, paste your public facebook.com profile and Save Facebook profile."
  - "Hard-refresh and click the Facebook badge. It should open that Facebook profile."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Owner must save a public facebook.com profile if Facebook Login does not return user_link"
recommended_next_action: "Owner retests listing connector clicks on the preview URL. Do not merge PR #21 or deploy production."
---

# Agent Handoff: owner-connector-clicks-dead

## Objective received

The human owner reported that listing connector buttons were not
connecting to anything.

## Shared-memory citations

Canonical GitHub `PeterJFrancoIII/Open-Marketplace` `origin/main`
`96adc20d240f6dd644e74981778d86eeb1e3808b`. Owner override on the
feature branch. Live preview listings for seller Peter showed Facebook
Connected with `url: ""` and a typed PayPal destination
`https://paypal.me/PeterFranco`.

## Work performed

- Verified the live listing JSON: Facebook Connected had no profile URL,
  so the badge rendered as a non-link. The listing card was also a
  `role="button"` that swallowed clicks on inner links.
- Listing cards no longer use `role="button"`. Clicks on `a` or `button`
  do not open the listing.
- PayPal chips now use the existing pay-to href helper, so
  `paypal.me/PeterFranco` opens even when PayPal Login is not linked.
- Homepage-only social URLs (`facebook.com`, `instagram.com`) are not
  treated as a person's profile.
- Listing GET backfills a Facebook Graph profile link when Facebook
  Login actually returns one. Empty Graph results are not written in a
  loop.
- Account settings now lets a Connected Facebook user save a public
  `facebook.com` profile so listings can open it. Facebook Login does
  not always return that link.

## Verification evidence

`npm run lint` exit 0. `npm test` exit 0: 87 passed, 0 failed.

## Review request

Codex should review the card click fix and the Facebook profile URL
save path. Do not mark accepted, merge PR #21, or deploy production.
