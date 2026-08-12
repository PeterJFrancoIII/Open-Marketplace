---
schema_version: "1.1"
document:
  id: "OM-MASTER-001"
  kind: "project_master_descriptor"
  canonical: true
  status: "active"
  updated_at: "2026-08-12T20:22:00Z"
  updated_by: "codex_architect"
project:
  id: "open-marketplace"
  name: "Open Marketplace"
  repository: "PeterJFrancoIII/Open-Marketplace"
  repository_url: "https://github.com/PeterJFrancoIII/Open-Marketplace"
  default_branch: "main"
  production_branch: "main"
  production_url: "https://open-marketplace-demo.pages.dev"
authority:
  - rank: 1
    role: "human_owner"
    responsibility: "final product, functional acceptance, merge, and production authority"
  - rank: 2
    role: "codex_architect_admin"
    responsibility: "architecture, machine-readable contracts, task assignment, review, integration, and administration"
  - rank: 3
    role: "cursor_implementation_subagent"
    responsibility: "execute only assigned work packages and return evidence"
source_precedence:
  - "human_owner_instruction"
  - "Master_Descriptor.md"
  - "agent-memory/DECISIONS.md"
  - "agent-memory/STATE.md"
  - "agent-memory/TASKS.md"
  - "agent-memory/handoffs/<task-record>.md"
  - "CURSOR_START_HERE.md"
  - "README.md"
  - "ARCHITECTURE.md"
  - "POLICY.md"
status_vocabulary:
  task: ["backlog", "blocked", "assigned", "in_progress", "ready_for_review", "accepted", "cancelled"]
  workstream: ["specified", "framework_required", "reference_implementation", "preview_validation", "production_ready", "released"]
current_repository_state:
  state_basis_commit: "b7c634829210cf2e386129058710a98a1db26663"
  state_basis_semantics: "snapshot basis; the commit containing this file may be newer"
  governance_reference:
    branch: "agent/shared-agent-memory"
    implementation_commit: "5d560e8335438c3da08b9589fdf12555037ddba4"
    handoff_commit: "9dc317cdb402dc5ad024da1f740d1091c4c62ea6"
    merge_commit: "b7c634829210cf2e386129058710a98a1db26663"
    pull_request: 22
    pull_request_state: "merged"
  account_reference:
    branch: "feature/account-management-portal"
    commit: "2a42055ec93297b5556eeec571844ec2f1b57cf3"
    pull_request: 21
    pull_request_state: "draft"
    mergeable_after_governance_merge: false
    production_state: "not_released"
workstreams:
  - {id: "OM-GOV", name: "Agent governance and shared memory", status: "specified", architect: "codex_architect_admin", implementer: "codex_architect_admin"}
  - {id: "OM-ACC", name: "Account creation and account/admin consoles", status: "reference_implementation", architect: "codex_architect_admin", implementer: "cursor_implementation_subagent", reference_pull_request: 21}
  - {id: "OM-DEP", name: "Cloudflare preview and production configuration", status: "framework_required", architect: "codex_architect_admin", implementer: "cursor_implementation_subagent"}
  - {id: "OM-IDV", name: "High-assurance identity verification", status: "framework_required", architect: "codex_architect_admin", implementer: "cursor_implementation_subagent"}
  - {id: "OM-NODE", name: "Decentralized hosting-node registration and proof", status: "framework_required", architect: "codex_architect_admin", implementer: "cursor_implementation_subagent"}
  - {id: "OM-RANK", name: "Priority listing eligibility and deterministic ordering", status: "framework_required", architect: "codex_architect_admin", implementer: "cursor_implementation_subagent"}
  - {id: "OM-BILL", name: "Paid priority listings and dynamic pricing", status: "framework_required", architect: "codex_architect_admin", implementer: "cursor_implementation_subagent"}
  - {id: "OM-PRIV", name: "Ad-free hosting benefits and privacy/cookie policy", status: "framework_required", architect: "codex_architect_admin", implementer: "cursor_implementation_subagent"}
  - {id: "OM-MOD", name: "Moderation, audit log, and administrator capabilities", status: "framework_required", architect: "codex_architect_admin", implementer: "cursor_implementation_subagent"}
product_requirements:
  public_browsing: {required: true}
  account_creation: {required: true, identity_verified_by_default: false}
  decentralized_hosts:
    required: true
    eligibility_requires: ["high_assurance_identity_verification", "verifiable_hosting_node_operation"]
    permitted_benefits: ["priority_listing_status", "ad_free_experience"]
  priority_listings:
    presentation: "yellow_box"
    ordering: "before_regular_listings"
    regular_user_initial_fee_usd: "0.10"
    dynamic_pricing_required: true
    implementation_state: "architecture_required"
security_and_privacy_invariants:
  - "Never commit or log secrets, authentication tokens, cookies, passwords, or private exports."
  - "Never store raw identity documents in Git, shared memory, a public object store, or general marketplace metadata tables."
  - "Listing ownership, administrator status, verification status, host status, and priority eligibility are server-derived."
  - "Listing image bytes remain outside the public metadata registry."
  - "Public browsing remains available unless the human owner explicitly changes this requirement."
  - "No destructive administrator capability is added without authorization, audit logging, tests, and a separate task approval."
  - "No production approval is inferred from builds, tests, previews, or subagent reports."
shared_memory:
  root: "agent-memory"
  protocol: "agent-memory/README.md"
  state: "agent-memory/STATE.md"
  task_registry: "agent-memory/TASKS.md"
  decisions: "agent-memory/DECISIONS.md"
  handoff_template: "agent-memory/HANDOFF_TEMPLATE.md"
  github_citation_required_per_task: true
  citation_minimum:
    - "repository"
    - "canonical_ref_or_commit"
    - "Master_Descriptor.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/STATE.md"
manual_functional_acceptance:
  applies_to: "every user-facing behavior change"
  preview_required: true
  owner_checklist_required: true
  owner_is_test_operator: true
  owner_result_values: ["not_run", "pass", "fail"]
  required_result_before_codex_acceptance: "pass"
  required_result_before_merge: "pass"
  exemptions:
    - "docs_or_governance_only"
    - "tests_only_with_no_behavior_change"
    - "internal_maintenance_with_no_behavior_change"
  exemption_must_be_declared_in_task: true
production_gates:
  - {id: "PG-01", requirement: "all relevant tasks are accepted by Codex"}
  - {id: "PG-02", requirement: "tests, lint, build, artifact validation, and required visual checks pass"}
  - {id: "PG-03", requirement: "Cloudflare bindings, migrations, secrets, and rollback are verified in preview when applicable"}
  - {id: "PG-04", requirement: "security and privacy boundaries are reviewed"}
  - {id: "PG-05", requirement: "human owner manually passes the runnable preview for every user-facing behavior change"}
  - {id: "PG-06", requirement: "human owner gives explicit production approval"}
---

# Open Marketplace Master Descriptor

The YAML front matter is authoritative. The human owner and Codex jointly define architecture; Codex converts decisions into bounded machine-readable task contracts; Cursor implements assigned tasks only.

Every Cursor task must begin by reading the GitHub-backed shared memory and must end with exact shared-memory references in its handoff. Every user-facing change must remain runnable for the human owner and cannot be accepted or merged until the owner reports a manual functional pass.
