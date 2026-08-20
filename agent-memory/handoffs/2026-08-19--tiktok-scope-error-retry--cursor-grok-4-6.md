---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "TIKTOK-APP-REVIEW-READINESS"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "blocked"
started_at: "2026-08-19T22:03:00Z"
completed_at: "2026-08-19T22:06:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
head_commit: "uncommitted"
files_changed:
  - "agent-memory/handoffs/2026-08-19--tiktok-scope-error-retry--cursor-grok-4-6.md"
verification: []
owner_manual_result: "not_run"
blockers:
  - "TikTok Add account still rejected with invalid_scope. Log id 2026081922024446184E67C16C020BBB6F."
  - "This is the developer-portal tester login, not Open Marketplace Connect. Uncommitted TikTok Connect is not deployed."
remaining_work:
  - "On Sandbox Open Marketplace Dev only: keep user.info.basic and user.info.profile, remove other scopes including user.info.stats, Apply changes, retry Add account as PeterWasKing4NHr."
  - "If it still fails, owner pastes the tiktok.com authorize URL so the requested scope= value can be read."
recommended_next_action: "Fix sandbox scopes for Add account. Do not submit or deploy production."
contains_secrets_or_private_data: false
---

# Agent Handoff: TikTok scope error retry

Owner retried Add account after enabling basic, profile, and stats.
TikTok still rejected the tester login for `scope`. Official error
category is `invalid_scope`: requested scope invalid, unknown, or
malformed.

Add account uses the sandbox app config, not the uncommitted marketplace
code. Sandbox typically needs `user.info.basic` plus `user.info.profile`.
Extra scopes on the sandbox can make the tester login request a scope
TikTok will not grant yet.
