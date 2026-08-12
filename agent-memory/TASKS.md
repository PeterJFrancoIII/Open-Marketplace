---
schema_version: "1.2"
document_id: "OM-TASKS-001"
kind: "task_registry"
updated_at: "2026-08-12T20:58:03Z"
updated_by: "codex_architect"
tasks:
  - id: "OM-GOV-001"
    title: "Create repository-backed shared memory and agent rules"
    workstream: "OM-GOV"
    status: "accepted"
    owner_role: "codex_architect_admin"
    assigned_agent: "codex-architect"
    implementation_commit: "5d560e8335438c3da08b9589fdf12555037ddba4"
    handoff_commit: "9dc317cdb402dc5ad024da1f740d1091c4c62ea6"
    pull_request: 22
  - id: "OM-GOV-002"
    title: "Merge shared-memory governance and establish first canonical state"
    workstream: "OM-GOV"
    status: "accepted"
    owner_role: "codex_architect_admin"
    assigned_agent: "codex-architect"
    depends_on: ["OM-GOV-001"]
    merge_commit: "b7c634829210cf2e386129058710a98a1db26663"
    human_approval_received: true
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
    result: "reference implementation is substantial but requires governance reconciliation and owner-testable preview before acceptance; production gates remain open"
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
    required_source_head: "2a42055ec93297b5556eeec571844ec2f1b57cf3"
    target_base_ref: "main"
    observed_base_commit: "d357af8e3f027ba538c331fd97c62dc6d6eb2374"
    minimum_base_ancestor: "b7c634829210cf2e386129058710a98a1db26663"
    implementation_head: "9c28a5db9f4aa41932977a005806beb98b57c4e4"
    branch_tip: "dc5a23a99f97e0c2729d0f9a8cfdbcb59f603e27"
    handoff_path: "agent-memory/handoffs/2026-08-12--OM-ACC-002--cursor-grok-4-6.md"
    pull_request: 21
    pull_request_state: "draft"
    mergeable: true
    depends_on: ["OM-ACC-001"]
    functional_preview_required: true
    architect_review:
      status: "passed_for_owner_test"
      reviewed_head: "dc5a23a99f97e0c2729d0f9a8cfdbcb59f603e27"
      scope_result: "no OM-ACC-002 scope violation found"
      governance_result: "canonical governance files preserved from main"
      ci_result: "Cloudflare Pages workflow passed on reviewed branch tip"
      local_probe_result: "Cursor reports home, login, listings read, signup, signin, and account route functional after local-only D1 schema apply"
    allowed_paths:
      - ".env.example"
      - "ARCHITECTURE.md"
      - "CURSOR_START_HERE.md"
      - "README.md"
      - "app/**"
      - "components/**"
      - "drizzle/**"
      - "lib/**"
      - "package.json"
      - "package-lock.json"
      - "scripts/**"
      - "tests/**"
      - "agent-memory/handoffs/**"
    forbidden_actions:
      - "edit Master_Descriptor.md"
      - "edit agent-memory/STATE.md"
      - "edit agent-memory/TASKS.md"
      - "edit agent-memory/DECISIONS.md"
      - "merge PR #21"
      - "deploy to production"
      - "apply production D1 migrations"
      - "write secrets or private data to Git"
      - "mark owner manual test as pass"
    verification:
      - "git diff --check: passed"
      - "npm run lint: passed"
      - "npm test: 21 passed, 0 failed; production build passed"
      - "branch workflow on dc5a23a99f97e0c2729d0f9a8cfdbcb59f603e27: passed"
      - "local preview home/login/listings/auth/account probes: passed per subagent handoff"
    owner_manual_checklist:
      - "Open marketplace home and browse without signing in."
      - "Create a test account using non-sensitive test data."
      - "Sign in and open the account page."
      - "Create a test listing and confirm the listing uses the signed-in account identity."
      - "Sign out and confirm publishing is no longer available without signing in."
      - "Report pass/fail to Codex in ordinary language."
    completion_contract:
      subagent_status: "ready_for_review"
      architect_review: "passed_for_owner_test"
      owner_manual_result: "not_run"
      acceptance_blocker: "human_owner_functional_pass"
      handoff_required: true
      shared_memory_refs_required: true
      runnable_preview_required: true
  - id: "OM-DEP-001"
    title: "Specify and validate the account portal Cloudflare preview environment"
    workstream: "OM-DEP"
    status: "blocked"
    owner_role: "codex_architect_admin"
    assigned_agent: null
    depends_on: ["OM-ACC-002"]
    unblock_condition: "OM-ACC-002 is accepted after architect review and human owner functional pass"
    forbidden_actions: ["write secrets to Git or shared memory", "apply production migration", "change production URL"]
  - id: "OM-TRUST-001"
    title: "Author identity, hosting-node, priority, payment, and privacy contracts"
    workstream: "OM-IDV"
    status: "backlog"
    owner_role: "codex_architect_admin"
    assigned_agent: null
    depends_on: ["OM-GOV-002"]
---

# Task Registry

The YAML front matter is canonical. Cursor agents may execute only tasks with execution-ready status and explicit assignment. Cursor never self-accepts work. A user-facing task cannot be accepted while its owner manual functional result is `not_run` or `failed`.
