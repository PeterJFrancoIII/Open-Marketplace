---
schema_version: "1.4"
document_id: "OM-TASKS-001"
kind: "task_registry"
updated_at: "2026-08-12T22:50:00Z"
updated_by: "codex_architect"
tasks:
  - {id: "OM-GOV-001", title: "Create repository-backed shared memory and agent rules", workstream: "OM-GOV", status: "accepted", owner_role: "codex_architect_admin", assigned_agent: "codex-architect", implementation_commit: "5d560e8335438c3da08b9589fdf12555037ddba4", handoff_commit: "9dc317cdb402dc5ad024da1f740d1091c4c62ea6", pull_request: 22}
  - {id: "OM-GOV-002", title: "Merge shared-memory governance and establish first canonical state", workstream: "OM-GOV", status: "accepted", owner_role: "codex_architect_admin", assigned_agent: "codex-architect", depends_on: ["OM-GOV-001"], merge_commit: "b7c634829210cf2e386129058710a98a1db26663", human_approval_received: true}
  - id: "OM-ACC-001"
    title: "Audit account/admin reference implementation against the master descriptor"
    workstream: "OM-ACC"
    status: "accepted"
    owner_role: "codex_architect_admin"
    assigned_agent: "codex-architect"
    branch: "feature/account-management-portal"
    reference_head: "2a42055ec93297b5556eeec571844ec2f1b57cf3"
    pull_request: 21
    depends_on: ["OM-GOV-002"]
    result: "substantial reference implementation; governance reconciliation completed; acceptance still requires owner-reachable preview and human functional pass"
  - id: "OM-ACC-002"
    title: "Reconcile PR #21 with governance main and prepare owner-testable account preview"
    workstream: "OM-ACC"
    status: "ready_for_review"
    review_stage: "awaiting_human_owner_functional_test"
    owner_role: "codex_architect_admin"
    assigned_agent: "cursor_implementation_subagent"
    branch: "feature/account-management-portal"
    base_branch: "main"
    shared_memory_ref: "main"
    current_head: "f6b5ab180a2da243d64662d82abecc452d62a3dc"
    account_implementation_head: "9c28a5db9f4aa41932977a005806beb98b57c4e4"
    preview_implementation_head: "5c68a7c7a5d94a332274074065f0d30a4a502a9e"
    pull_request: 21
    pull_request_state: "draft"
    mergeable: true
    depends_on: ["OM-ACC-001", "OM-DEP-001"]
    architect_review:
      account_scope: "passed_for_owner_test"
      owner_reachable_preview: "passed_for_owner_test"
      reviewed_branch_tip: "f6b5ab180a2da243d64662d82abecc452d62a3dc"
      branch_workflow: "passed"
    owner_preview:
      url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
      environment: "non_production"
      pages_project: "open-marketplace-demo"
      preview_database: "open-marketplace-account-preview-d1"
      handoff_path: "agent-memory/handoffs/2026-08-12--OM-DEP-001--cursor-grok-4-6.md"
    owner_manual_result: "not_run_on_https_preview"
    prior_owner_result: "failed_preview_unreachable"
    acceptance_blocker: "human_owner_functional_pass"
    owner_manual_checklist:
      - "Open marketplace home and browse without signing in."
      - "Create a test account using non-sensitive test data."
      - "Sign in and open the account page."
      - "Create a test listing and confirm the listing uses the signed-in account identity."
      - "Sign out and confirm publishing is no longer available without signing in."
      - "If using the configured preview-admin email, confirm Admin overview appears after sign-in."
      - "Report pass/fail to Codex in ordinary language."
    forbidden_actions:
      - "merge PR #21 before human functional pass"
      - "deploy account portal to production"
      - "mark owner manual test as pass"
  - id: "OM-DEP-001"
    title: "Deliver owner-reachable non-production account portal preview"
    workstream: "OM-DEP"
    status: "ready_for_review"
    review_stage: "awaiting_human_owner_functional_test"
    owner_role: "codex_architect_admin"
    assigned_agent: "cursor_implementation_subagent"
    supports_task: "OM-ACC-002"
    branch: "feature/account-management-portal"
    pull_request: 21
    shared_memory_ref: "main"
    observed_base_commit: "b470fb6a8745d1c914bc066661c868c73f810be2"
    implementation_head: "5c68a7c7a5d94a332274074065f0d30a4a502a9e"
    branch_tip: "f6b5ab180a2da243d64662d82abecc452d62a3dc"
    handoff_path: "agent-memory/handoffs/2026-08-12--OM-DEP-001--cursor-grok-4-6.md"
    architect_review:
      status: "passed_for_owner_test"
      existing_pages_project_reused: true
      production_url_change_authorized: false
      preview_surface: "Cloudflare Pages branch preview"
      latest_branch_workflow: "passed"
    functional_preview:
      url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
      deployment_url: "https://923a95f0.open-marketplace-demo.pages.dev/"
      environment: "non_production"
      pages_project: "open-marketplace-demo"
      preview_database: "open-marketplace-account-preview-d1"
    verification:
      - "git diff --check: passed"
      - "npm run lint: passed"
      - "npm test: 21 passed, 0 failed"
      - "latest branch Pages workflow at f6b5ab180a2da243d64662d82abecc452d62a3dc: passed"
      - "Cursor handoff reports HTTPS home/login/listings/auth/account/listing probes passed"
      - "Cursor handoff reports signed-out listing POST rejected and authenticated listing seller identity derived from session"
    owner_manual_result: "not_run"
    acceptance_blocker: "human_owner_functional_pass"
    architecture_note: "The current preview helper PATCH payload restates production deployment config while configuring preview settings. It is not production approval. Reusable automation hardening is tracked separately in OM-DEP-002 before this pattern is generalized."
    forbidden_actions:
      - "merge PR #21 before human functional pass"
      - "change production URL"
      - "apply account migrations to production D1"
      - "mark owner manual test as pass"
  - id: "OM-DEP-002"
    title: "Harden Pages preview configuration against production-setting drift"
    workstream: "OM-DEP"
    status: "backlog"
    owner_role: "codex_architect_admin"
    assigned_agent: null
    depends_on: ["OM-DEP-001"]
    objective: "Before preview automation is treated as a reusable framework, ensure branch-preview configuration cannot overwrite unrelated future production settings, or document and test the minimum Cloudflare API coupling that is unavoidable."
    architect_first: true
    forbidden_actions: ["change production URL", "change production D1 data", "assign Cursor before architect contract is written"]
  - id: "OM-ACC-003"
    title: "Design two-factor authentication framework"
    workstream: "OM-ACC"
    status: "backlog"
    owner_role: "codex_architect_admin"
    assigned_agent: null
    depends_on: ["OM-ACC-002"]
    architect_first: true
    required_design_outputs:
      - "threat model and which actions require second factor or step-up authentication"
      - "factor selection and enrollment model without inventing custom cryptography"
      - "recovery and lost-device policy"
      - "admin-account requirements"
      - "rate limits, audit events, storage boundaries, and privacy considerations"
      - "migration and rollout plan for existing accounts"
      - "test and owner-preview acceptance plan"
    forbidden_actions: ["implement 2FA before architecture acceptance", "store recovery secrets or private authentication material in Git/shared memory"]
  - id: "OM-TRUST-001"
    title: "Author identity, hosting-node, priority, payment, and privacy contracts"
    workstream: "OM-IDV"
    status: "backlog"
    owner_role: "codex_architect_admin"
    assigned_agent: null
    depends_on: ["OM-GOV-002"]
---

# Task Registry

The YAML front matter is canonical. Cursor may execute only tasks with execution-ready status and explicit assignment. Cursor never self-accepts. A user-facing task cannot be accepted while the owner result is `not_run`, `not_run_on_https_preview`, `failed`, or `failed_preview_unreachable`.
