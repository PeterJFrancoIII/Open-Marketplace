---
schema_version: "1.3"
document_id: "OM-STATE-001"
kind: "project_state"
updated_at: "2026-08-12T21:02:00Z"
updated_by: "codex_architect"
repository:
  name: "PeterJFrancoIII/Open-Marketplace"
  default_branch: "main"
  state_basis_commit: "0d73a0f580153a80383abd1d0d0c00668ad063aa"
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
  owner_reachable_preview_gate: "active"
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
    state: "blocked"
    review_stage: "owner_preview_unreachable"
    purpose: "account/admin portal with server-side authentication"
    architect_review: "passed_for_owner_test"
    branch_ci: {head: "dc5a23a99f97e0c2729d0f9a8cfdbcb59f603e27", workflow: "Deploy to Cloudflare Pages", result: "success"}
    subagent_handoff: "agent-memory/handoffs/2026-08-12--OM-ACC-002--cursor-grok-4-6.md"
    rejected_preview: {url: "http://localhost:5173/", reason: "human owner reported URL does not open", owner_reported_at: "2026-08-12T21:02:00Z"}
    owner_manual_result: "failed_preview_unreachable"
    acceptance_blocker: "OM-DEP-001 then human_owner_functional_pass"
  - id: "OM-DEP-001"
    branch: "feature/account-management-portal"
    pull_request: 21
    state: "assigned"
    purpose: "produce owner-reachable non-production HTTPS preview for PR #21 with working D1/auth/listing flow"
known_blockers:
  - {id: "OM-BLOCK-001", scope: "main", description: "Standard npm test wrapper requires GNU timeout on this Mac; PR #21 contains a portable correction."}
  - {id: "OM-BLOCK-002", scope: "main", description: "Main rendered HTML test contains the retired Open Exchange assertion; PR #21 contains a correction."}
  - {id: "OM-BLOCK-003", scope: "account_portal_production", description: "Production D1 migration, DB binding, authentication secret, admin allowlist, email verification delivery, password reset delivery, and production acceptance are not confirmed."}
  - {id: "OM-BLOCK-004", scope: "owner_preview", description: "Agent-local localhost preview was not reachable by the human owner; preview must be externally owner-reachable before manual functional acceptance."}
next_cursor_task: "OM-DEP-001"
next_architect_action: "Wait for OM-DEP-001 handoff containing an owner-reachable non-production HTTPS preview URL. Do not accept OM-ACC-002, merge PR #21, or deploy production until the human owner completes the functional checklist and reports pass."
---

# Current Project State

The account implementation passed architect review but failed the human preview gate because the supplied localhost URL was unreachable. OM-DEP-001 is now the execution-ready remediation task.
