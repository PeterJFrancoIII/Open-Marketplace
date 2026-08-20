---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "TIKTOK-APP-REVIEW-READINESS"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "blocked"
started_at: "2026-08-19T21:53:00Z"
completed_at: "2026-08-19T21:54:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
head_commit: "uncommitted"
files_changed:
  - "agent-memory/handoffs/2026-08-19--tiktok-scope-error--cursor-grok-4-6.md"
verification: []
owner_manual_result: "not_run"
blockers:
  - "After redirect_uri was corrected, TikTok Add account failed with a scope rejection. Log id 20260819215252FA3E56E4A6D2D40B3A1C."
  - "Sandbox previously had user.info.basic and user.info.profile. Owner was asked to drop profile; the sandbox may now have no usable Login Kit scope applied."
remaining_work:
  - "Owner restores user.info.basic on Sandbox Open Marketplace Dev, Apply changes, retries Add account as PeterWasKing4NHr."
  - "If Add account still fails, temporarily restore user.info.profile on the sandbox only. App code still requests basic only."
recommended_next_action: "Restore user.info.basic on the sandbox and retry Add account. Do not submit or deploy production."
contains_secrets_or_private_data: false
---

# Agent Handoff: TikTok scope error

Owner progressed past redirect_uri. TikTok now rejects the Add account
OAuth request for `scope`. Login Kit requires `user.info.basic`.
