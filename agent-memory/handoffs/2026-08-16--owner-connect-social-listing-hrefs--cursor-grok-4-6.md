---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "owner-connect-social-listing-hrefs"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-16T17:02:00Z"
completed_at: "2026-08-16T17:07:48Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/account-management-portal"
base_commit: "104de7aecbe1017617bd316ee5d26362b3b52414"
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
  - "app/marketplace.tsx"
  - "lib/facebook-listing-proof.ts"
  - "tests/facebook-connect.test.mjs"
  - "tests/facebook-listing-proof.test.mjs"
  - "agent-memory/handoffs/2026-08-16--owner-connect-social-listing-hrefs--cursor-grok-4-6.md"
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
  - "Hard-refresh the preview after Pages deploy."
  - "Account settings: paste https://facebook.com/your-profile, Instagram, and TikTok profile URLs."
  - "Click Connect social media."
  - "Hard-refresh the homepage. Buyer clicks on those listing chips should open those pages."
  - "Facebook Login still marks Facebook as Connected. It does not invent a facebook.com/{id} URL."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Owner must paste real profile URLs. Facebook Login on this preview still returns no public profile link."
recommended_next_action: "Owner saves profile URLs with Connect social media, then retests listing clicks. Do not merge PR #21 or deploy production."
---

# Agent Handoff: owner-connect-social-listing-hrefs

## Objective received

The human owner asked that Connect Social Media attach the seller's
social media links to the listing buttons so a buyer can open that
person's Facebook, Instagram, or TikTok page.

## Shared-memory citations

Canonical GitHub `PeterJFrancoIII/Open-Marketplace` `origin/main`
`96adc20d240f6dd644e74981778d86eeb1e3808b`. Owner override on the
feature branch. Live preview listings for seller Peter still had
Facebook Connected with `url: ""` and no Instagram or TikTok.

## Work performed

- Listing overlay now keeps a saved `facebook.com/...` profile URL as
  the Connected chip href when Facebook Login does not return
  `user_link`. Official Graph URLs still win over typed URLs. Connected
  status still requires Facebook Login.
- Account Social media now includes Facebook, Instagram, and TikTok
  profile URL fields. The save button is labeled Connect social media
  and those URLs are what buyers open from listings.
- Demo listing chips use profile-path URLs instead of site homepages,
  so sample cards are also clickable.

## Verification evidence

`npm run lint` exit 0. `npm test` exit 0: 87 passed, 0 failed.

## Review request

Codex should review the Connected-href fallback and the Social media
save path. Do not mark accepted, merge PR #21, or deploy production.
