---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "owner-auto-populate-social-urls"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-16T19:33:00Z"
completed_at: "2026-08-16T19:37:22Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/account-management-portal"
base_commit: "c450676d24a403c51c7b080a31ed68cb173d365f"
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
  - "lib/auth.ts"
  - "lib/facebook-listing-proof.ts"
  - "lib/profile-settings.ts"
  - "tests/facebook-connect.test.mjs"
  - "tests/facebook-listing-proof.test.mjs"
  - "agent-memory/handoffs/2026-08-16--owner-auto-populate-social-urls--cursor-grok-4-6.md"
verification:
  - command: "npm run lint"
    exit_code: 0
    result: "eslint passed"
  - command: "npm test"
    exit_code: 0
    result: "88 tests passed, 0 failed"
functional_preview_required: true
functional_preview:
  status: "ready_after_push"
  url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
  start_command: null
owner_manual_checklist:
  - "Hard-refresh the preview after Pages deploy."
  - "Connect Facebook. If Facebook sends a profile link, the Facebook URL field should fill itself."
  - "If that field is still empty, type only the Facebook username, leave the field, and confirm it becomes https://www.facebook.com/username."
  - "Type an Instagram username and a TikTok @username, then Connect social media. Those should become official profile URLs on listings."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Facebook Login still cannot invent a public facebook.com/{id} URL. Instagram and TikTok have no OAuth on this branch."
recommended_next_action: "Owner retests Account settings URL auto-fill on the preview. Do not merge PR #21 or deploy production."
---

# Agent Handoff: owner-auto-populate-social-urls

## Objective received

The human owner asked for Social Media connect to automatically
populate the user's URL.

## Shared-memory citations

Canonical GitHub `PeterJFrancoIII/Open-Marketplace` `origin/main`
`96adc20d240f6dd644e74981778d86eeb1e3808b`. Owner override on the
feature branch. Meta docs: `user_link` / Graph `link` is the official
Facebook profile URL and must not be invented from an app-scoped ID.

## Work performed

- Facebook Connect now persists Graph `link` using the access token
  from the account hook, so a Facebook-supplied profile URL fills the
  field and listings without a second paste.
- Official `profile.php?id=` Facebook URLs are accepted. Homepage-only
  `facebook.com` is still rejected. App-scoped IDs are not invented.
- Connect social media completes a typed username into the official
  Facebook, Instagram, or TikTok profile URL on blur and on save.

## Verification evidence

`npm run lint` exit 0. `npm test` exit 0: 88 passed, 0 failed.

## Review request

Codex should review username-to-URL expansion and the Facebook token
persist path. Do not mark accepted, merge PR #21, or deploy production.
