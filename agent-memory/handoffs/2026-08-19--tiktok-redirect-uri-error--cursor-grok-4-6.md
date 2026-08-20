---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "TIKTOK-APP-REVIEW-READINESS"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "blocked"
started_at: "2026-08-19T21:49:00Z"
completed_at: "2026-08-19T21:50:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "0422f5c1dccae33fcde01ec7fac7d10af6b254a3"
head_commit: "uncommitted"
files_changed:
  - "agent-memory/handoffs/2026-08-19--tiktok-redirect-uri-error--cursor-grok-4-6.md"
verification: []
functional_preview_required: false
functional_preview:
  status: "not_applicable"
  url: "https://developers.tiktok.com/app/7675494970317998100/sandbox/7675505392745138197"
  start_command: null
owner_manual_result: "not_run"
blockers:
  - "Owner hit TikTok Login Kit redirect_uri rejection while adding sandbox Target User PeterWasKing4NHr."
  - "Deployed previews currently 404 /api/auth/callback/tiktok because TikTok Connect code is still uncommitted."
remaining_work:
  - "Owner confirms Sandbox Login Kit redirect URI is exactly the development callback and Apply changes, then retries Add account."
  - "If it fails again, owner pastes the tiktok.com authorize URL so the requested redirect_uri can be read."
recommended_next_action: "Do not submit or deploy production. Fix sandbox Login Kit redirect URI, then retry Add account."
contains_secrets_or_private_data: false
---

# Agent Handoff: TikTok redirect_uri error

Owner received TikTok's standard Login Kit error naming `redirect_uri` after
trying to add the sandbox target user. Official Login Kit rules require an
exact HTTPS static match. The intended sandbox callback remains:

`https://feature-community-surface-re.open-marketplace-demo.pages.dev/api/auth/callback/tiktok`
