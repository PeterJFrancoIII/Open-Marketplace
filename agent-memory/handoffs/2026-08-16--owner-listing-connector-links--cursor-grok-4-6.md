---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "owner-listing-connector-links"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-16T16:41:00Z"
completed_at: "2026-08-16T16:48:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/account-management-portal"
base_commit: "bf52a827bf6d3c149aeba85c456157e06b6f6e0f"
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
  - "app/account/account-settings.tsx"
  - "app/api/account/profile/route.ts"
  - "app/api/listings/route.ts"
  - "app/marketplace.tsx"
  - "app/privacy/page.tsx"
  - "lib/auth.ts"
  - "lib/facebook-listing-proof.ts"
  - "lib/profile-settings.ts"
  - "lib/social-health.ts"
  - "lib/types.ts"
  - "tests/facebook-connect.test.mjs"
  - "tests/facebook-listing-proof.test.mjs"
  - "agent-memory/handoffs/2026-08-16--owner-listing-connector-links--cursor-grok-4-6.md"
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
  - "If Facebook Connected has no link yet, open Account settings, Disconnect Facebook, then Connect Facebook again so Facebook can grant user_link."
  - "Click the Facebook Connected badge on a listing. It should open that seller's Facebook profile in a new tab, not stay on the marketplace."
  - "If Instagram or TikTok URLs are saved, those badges should open those profiles."
  - "A typed facebook.com URL must not become the Connected link. Only the Facebook Login profile link is used."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Owner must reconnect Facebook once so the existing public_profile-only token can gain user_link"
  - "Facebook may only complete the profile redirect for people Facebook allows. That is Facebook's rule, not a marketplace checkout."
recommended_next_action: "Owner retests listing connector clicks on the preview URL after reconnecting Facebook. Codex may review. Do not merge PR #21 or deploy production."
---

# Agent Handoff: owner-listing-connector-links

## Objective received

The human owner asked that clicking a listing connector (Facebook,
TikTok, and the rest) open that seller's real account so a buyer can
inspect that the person exists. The example was the Facebook Connected
badge, which previously stayed on the marketplace page.

## Shared-memory citations

Canonical GitHub `PeterJFrancoIII/Open-Marketplace` `origin/main`
`96adc20d240f6dd644e74981778d86eeb1e3808b`. Read `Master_Descriptor.md`,
`agent-memory/README.md`, `agent-memory/STATE.md`, `agent-memory/TASKS.md`,
`agent-memory/DECISIONS.md`, and `AGENTS.md`. No Codex-assigned connector
task matched; this slice is an explicit owner override. Facebook remains
link-only: no email, friends, birthday, or Marketplace APIs. Typed
Facebook URLs still cannot spoof Connected.

## Work performed

- Facebook Login now requests `public_profile` and official `user_link`.
  Graph `/me` also reads `link`. That profile URL is stored server-side
  on the Connected Facebook row and shown on listings.
- Listing cards and detail render social connectors as new-tab links
  when a real HTTPS profile URL exists. Connected Facebook is no longer
  forced to a non-clickable span.
- Instagram and TikTok already had URLs; they now use the same
  click-through helper so the listing card does not swallow the click.
- A typed facebook.com URL is not used as the Connected href. Only the
  Facebook Login profile link is.
- PayPal Linked becomes a link only when the public destination is
  already an HTTPS PayPal URL. An email-only PayPal contact stays
  non-link.

## Verification evidence

`npm run lint` exit 0. `npm test` exit 0: 87 passed, 0 failed.

## Runnable preview

https://feature-account-management-p.open-marketplace-demo.pages.dev/

Existing Facebook connections created before this slice only have
`public_profile`. The owner needs to Disconnect and Connect Facebook
once so Facebook can grant `user_link` and return a profile link.

## Deviations and risks

- Owner override of the earlier `public_profile` only Facebook scope.
  Email, friends, birthday, and location remain refused.
- Facebook documents `user_link` profile URLs as opaque and sometimes
  limited to people Facebook allows to see that profile. A buyer who is
  not allowed by Facebook may not land on the public profile. The
  marketplace does not invent `facebook.com/{app-scoped-id}` URLs.
- Live `user_link` for the general public may need Facebook App Review.

## Review request

Codex should review the `user_link` scope, server-only Facebook profile
URL persistence, and listing click-through. Do not mark accepted, merge
PR #21, or deploy production.
