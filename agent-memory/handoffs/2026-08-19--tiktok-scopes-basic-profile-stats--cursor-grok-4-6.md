---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "TIKTOK-APP-REVIEW-READINESS"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-19T21:55:00Z"
completed_at: "2026-08-19T21:57:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "0422f5c1dccae33fcde01ec7fac7d10af6b254a3"
head_commit: "uncommitted"
files_changed:
  - "lib/social-connectors.ts"
  - "lib/auth.ts"
  - "app/account/account-settings.tsx"
  - "app/privacy/page.tsx"
  - "app/terms/page.tsx"
  - "tests/social-connectors.test.mjs"
  - "tests/tiktok-connect.test.mjs"
  - "tests/privacy-policy.test.mjs"
  - "agent-memory/handoffs/2026-08-19--tiktok-scopes-basic-profile-stats--cursor-grok-4-6.md"
verification:
  - command: "npm test"
    exit_code: 0
    result: "128/128 tests passed after vinext build"
owner_manual_result: "not_run"
recommended_next_action: "Owner retries sandbox Add account now that portal scopes include basic, profile, and stats. Codex reviews the owner override of the first-review basic-only packet. Do not submit or deploy production."
contains_secrets_or_private_data: false
---

# Agent Handoff: TikTok basic + profile + stats

Owner instructed that `user.info.basic`, `user.info.profile`, and
`user.info.stats` are enabled on the TikTok app and should populate
Open Marketplace. This overrides the GPT first-review packet that
limited the first submission to `user.info.basic` only.

Connect still does not sign the user in. Tokens stay server-side.
Official TikTok fields now fill Account Settings, listing social proof,
and Social Credit when the connection validates.
