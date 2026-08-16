---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "owner-listing-facebook-connected"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-16T16:12:00Z"
completed_at: "2026-08-16T16:17:30Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/account-management-portal"
base_commit: "5fde2888f1cdf8d72f5c641d649e5be1d1e9eab7"
head_commit: "uncommitted_at_handoff_write"
authority: "human_owner_explicit_request_2026-08-16"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "96adc20d240f6dd644e74981778d86eeb1e3808b"
  paths:
    - "Master_Descriptor.md"
    - "ARCHITECTURE.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
pull_request: 21
pull_request_state: "draft"
production_changed: false
merged: false
contains_secrets_or_private_data: false
files_changed:
  - "lib/facebook-listing-proof.ts"
  - "lib/social-health.ts"
  - "app/api/listings/route.ts"
  - "app/marketplace.tsx"
  - "app/globals.css"
  - "tests/facebook-listing-proof.test.mjs"
  - "tests/facebook-connect.test.mjs"
  - "tests/om-acc-010-restore.test.mjs"
  - "agent-memory/handoffs/2026-08-16--owner-listing-facebook-connected--cursor-grok-4-6.md"
verification:
  - command: "npm run lint"
    exit_code: 0
    result: "eslint passed"
  - command: "npm test"
    exit_code: 0
    result: "76 tests passed, 0 failed"
functional_preview_required: true
functional_preview:
  status: "ready_after_push"
  url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
  start_command: null
owner_manual_checklist:
  - "Hard-refresh the preview homepage and open one of your own listings."
  - "Confirm the card and item page no longer say No social account supplied."
  - "Confirm Facebook reads as Connected with Facebook Login, not a typed facebook.com URL and not a fake friends or join-date count."
  - "Confirm Account settings still shows Facebook Connected, and that Disconnect would remove the listing badge after refresh."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Owner functional pass on the preview listing page"
recommended_next_action: "Owner retests their listing on the preview URL. Codex may review the Facebook overlay. Do not merge PR #21 or deploy production."
---

# Agent Handoff: owner-listing-facebook-connected

## Objective received

The human owner reported that their own listing still showed
"No social account supplied" after a successful Facebook Connect.

## Shared-memory citations

Canonical GitHub `PeterJFrancoIII/Open-Marketplace` `origin/main`
`96adc20d240f6dd644e74981778d86eeb1e3808b`. Read `Master_Descriptor.md`,
`agent-memory/README.md`, `agent-memory/STATE.md`, `agent-memory/TASKS.md`,
`agent-memory/DECISIONS.md`, `AGENTS.md`, and `CURSOR_START_HERE.md`.
Canonical STATE/TASKS remain stale versus this branch. No Codex-assigned
OM-NODE or listing-social task matched; this slice is an explicit owner
override. OM-DEC-016 / OM-DEC-017 remain in force: Facebook qualifies only
through provider-controlled linking, `public_profile` only, no spoofable
listing-form social editor.

## Work performed

Listing GET/POST/PATCH previously copied only typed `profiles.socialAccountsJson`
into `socialProofsJson`. Facebook Connect lives in `auth_accounts` and was
never attached, so a real Login link produced an empty social row.

- Added `lib/facebook-listing-proof.ts` to overlay a public Connected Facebook
  proof when a seller has a `provider_id = facebook` account row.
- Listing reads now batch those seller ids and merge the live connection.
  Compose still sends `socialProofs: []`. Browser-supplied Facebook URLs are
  still ignored. Typed Instagram/TikTok URLs are unchanged.
- The overlay is connection-scoped and live: Disconnect removes the listing
  badge on the next GET. No Facebook tokens, app-scoped ids, email, photo
  bytes, or Graph profile URLs are written into listing JSON.
- Listing cards/detail render Connected Facebook as a non-link badge with
  "Connected with Facebook Login". They do not invent friends counts or join
  dates for oauth Facebook.
- Social-health pass-through keeps oauth Facebook from being marked invalid
  for lacking a public profile URL.

## Verification evidence

`npm run lint` exit 0. `npm test` exit 0, 76/76 passed, including the new
listing overlay test and the existing Facebook Connect / typed-URL /
Disconnect assertions.

## Runnable preview

Owner-reachable preview after feature-branch push:
https://feature-account-management-p.open-marketplace-demo.pages.dev/

## Deviations and risks

No Codex task ID authorized this path set. Scope stayed on listing display of
an already-linked Facebook account. Instagram/TikTok OAuth, Facebook email,
Marketplace APIs, and the listing social editor were not added. Facebook
Login still does not yield a public facebook.com profile URL, so the badge
is not a profile link.

## Review request

Codex should review that listing social display is derived from
`auth_accounts` rather than browser-supplied `socialProofs`, that typed
Facebook URLs still never read as Connected, and that no tokens or
app-scoped ids leak into public listing JSON. Do not mark accepted, merge
PR #21, or deploy production from this handoff.
