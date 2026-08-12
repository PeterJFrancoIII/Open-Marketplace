---
schema_version: "1.1"
document_id: "OM-STATE-001"
kind: "project_state"
updated_at: "2026-08-12T20:22:00Z"
updated_by: "codex_architect"
repository:
  name: "PeterJFrancoIII/Open-Marketplace"
  default_branch: "main"
  state_basis_commit: "b7c634829210cf2e386129058710a98a1db26663"
production:
  provider: "Cloudflare Pages"
  project: "open-marketplace-demo"
  url: "https://open-marketplace-demo.pages.dev"
  account_portal_released: false
  last_governance_deploy: {commit: "b7c634829210cf2e386129058710a98a1db26663", result: "success", functional_ui_change: false}
governance:
  pull_request: 22
  state: "merged"
  merge_commit: "b7c634829210cf2e386129058710a98a1db26663"
  operating_model: "human_owner > codex_architect_admin > cursor_implementation_subagent"
  manual_functional_preview_gate: "active"
  cursor_shared_memory_citation_gate: "active"
active_changes:
  - id: "OM-ACC-002"
    branch: "feature/account-management-portal"
    current_head: "2a42055ec93297b5556eeec571844ec2f1b57cf3"
    pull_request: 21
    pull_request_state: "draft"
    mergeable: false
    state: "assigned"
    purpose: "reconcile account portal with governance main and prepare owner-testable local preview"
known_blockers:
  - {id: "OM-BLOCK-001", scope: "main", description: "Standard npm test wrapper requires GNU timeout on this Mac; PR #21 contains a portable correction."}
  - {id: "OM-BLOCK-002", scope: "main", description: "Main rendered HTML test contains the retired Open Exchange assertion; PR #21 contains a correction."}
  - {id: "OM-BLOCK-003", scope: "account_portal_production", description: "Production D1 migration, DB binding, authentication secret, admin allowlist, email verification delivery, password reset delivery, and production acceptance are not confirmed."}
next_cursor_task: "OM-ACC-002"
next_architect_action: "Review OM-ACC-002 evidence and present the runnable preview/checklist to the human owner; do not accept or merge before owner functional pass."
---

# Current Project State

PR #22 is merged. PR #21 must now be reconciled with the governance baseline and made manually testable before it can be considered for acceptance.
