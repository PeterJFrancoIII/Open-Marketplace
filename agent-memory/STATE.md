---
schema_version: "1.2"
document_id: "OM-STATE-001"
kind: "project_state"
updated_at: "2026-08-12T20:58:03Z"
updated_by: "codex_architect"
repository:
  name: "PeterJFrancoIII/Open-Marketplace"
  default_branch: "main"
  state_basis_commit: "d357af8e3f027ba538c331fd97c62dc6d6eb2374"
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
  cursor_dispatch_protocol: "Codex writes and assigns a canonical task, then tells the human owner 'handoff to cursor'; the human owner invokes Cursor"
active_changes:
  - id: "OM-ACC-002"
    branch: "feature/account-management-portal"
    current_head: "dc5a23a99f97e0c2729d0f9a8cfdbcb59f603e27"
    implementation_head: "9c28a5db9f4aa41932977a005806beb98b57c4e4"
    pull_request: 21
    pull_request_state: "draft"
    mergeable: true
    state: "ready_for_review"
    review_stage: "awaiting_human_owner_functional_test"
    purpose: "account/admin portal with server-side authentication and owner-testable local preview"
    architect_review: "passed_for_owner_test"
    branch_ci: {head: "dc5a23a99f97e0c2729d0f9a8cfdbcb59f603e27", workflow: "Deploy to Cloudflare Pages", result: "success"}
    subagent_handoff: "agent-memory/handoffs/2026-08-12--OM-ACC-002--cursor-grok-4-6.md"
    local_preview:
      url: "http://localhost:5173/"
      status_at_handoff: "running_http_200"
      local_schema_command: "node scripts/apply-local-d1-migrations.mjs"
      start_command: "npm run dev"
      production: false
    owner_manual_result: "not_run"
    acceptance_blocker: "human_owner_functional_pass"
known_blockers:
  - {id: "OM-BLOCK-001", scope: "main", description: "Standard npm test wrapper requires GNU timeout on this Mac; PR #21 contains a portable correction."}
  - {id: "OM-BLOCK-002", scope: "main", description: "Main rendered HTML test contains the retired Open Exchange assertion; PR #21 contains a correction."}
  - {id: "OM-BLOCK-003", scope: "account_portal_production", description: "Production D1 migration, DB binding, authentication secret, admin allowlist, email verification delivery, password reset delivery, and production acceptance are not confirmed."}
next_cursor_task: null
next_architect_action: "Wait for human owner functional pass/fail on OM-ACC-002. If pass, accept OM-ACC-002 and author the next bounded deployment-preview task. If fail, author a corrective Cursor task from the owner's observed behavior. Do not merge PR #21 or deploy production before owner pass."
---

# Current Project State

OM-ACC-002 passed Codex architect review for manual owner testing at branch tip `dc5a23a99f97e0c2729d0f9a8cfdbcb59f603e27`. The feature is not accepted, merged, or production-approved. The human owner functional test is the current gate.
