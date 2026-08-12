---
schema_version: "1.0"
document_id: "OM-TASKS-001"
kind: "task_registry"
updated_at: "2026-08-12T19:34:00Z"
updated_by: "codex_architect"
tasks:
  - id: "OM-GOV-001"
    title: "Create repository-backed shared memory and agent rules"
    workstream: "OM-GOV"
    status: "ready_for_review"
    owner_role: "codex_architect_admin"
    assigned_agent: "codex-architect"
    branch: "agent/shared-agent-memory"
    base_branch: "main"
    base_commit: "38d823a754d5da62bd87fe4c436a5ac8140146dc"
    implementation_commit: "5d560e8335438c3da08b9589fdf12555037ddba4"
    pull_request: 22
    depends_on: []
    allowed_paths:
      - "AGENTS.md"
      - ".cursor/rules/shared-memory.mdc"
      - "Master_Descriptor.md"
      - "agent-memory/**"
      - "CURSOR_START_HERE.md"
    forbidden_actions:
      - "modify application code"
      - "modify product tests"
      - "merge to main"
      - "deploy to production"
    outputs:
      - "cross-agent authority rules"
      - "machine-readable master descriptor"
      - "shared state, task, decision, and handoff protocol"
    acceptance:
      - "all Markdown front matter parses as YAML"
      - "Cursor rule uses valid always-apply MDC metadata"
      - "all referenced shared-memory paths exist"
      - "git diff contains documentation and rule files only"
      - "markdown links and task IDs resolve consistently"
  - id: "OM-GOV-002"
    title: "Merge shared-memory governance and establish first canonical state"
    workstream: "OM-GOV"
    status: "blocked"
    owner_role: "codex_architect_admin"
    assigned_agent: null
    depends_on:
      - "OM-GOV-001"
    unblock_condition: "OM-GOV-001 is reviewed and the human owner approves integration"
    forbidden_actions:
      - "merge without human approval"
      - "deploy application code"
  - id: "OM-ACC-001"
    title: "Audit account/admin reference implementation against the master descriptor"
    workstream: "OM-ACC"
    status: "blocked"
    owner_role: "codex_architect_admin"
    assigned_agent: null
    branch: "feature/account-management-portal"
    pull_request: 21
    depends_on:
      - "OM-GOV-002"
    unblock_condition: "shared-memory governance is present on main"
    outputs:
      - "requirements coverage matrix"
      - "accepted gaps and subagent work packages"
      - "production readiness decision"
    forbidden_actions:
      - "merge PR 21 during the audit"
      - "deploy to production"
  - id: "OM-DEP-001"
    title: "Specify and validate the account portal Cloudflare preview environment"
    workstream: "OM-DEP"
    status: "blocked"
    owner_role: "codex_architect_admin"
    assigned_agent: null
    depends_on:
      - "OM-ACC-001"
    required_inputs:
      - "accepted account/admin framework"
      - "preview D1 database decision"
      - "secret and admin-email configuration supplied outside Git"
    forbidden_actions:
      - "write secrets to Git or shared memory"
      - "apply production migration"
      - "change production URL"
  - id: "OM-TRUST-001"
    title: "Author identity, hosting-node, priority, payment, and privacy contracts"
    workstream: "OM-IDV"
    status: "backlog"
    owner_role: "codex_architect_admin"
    assigned_agent: null
    depends_on:
      - "OM-GOV-002"
    outputs:
      - "PII-minimizing identity verification boundary"
      - "hosting-node proof and revocation contract"
      - "priority eligibility and deterministic ordering contract"
      - "paid priority and dynamic pricing contract"
      - "ad-free and cookie-consent contract"
    forbidden_actions:
      - "collect real identity documents"
      - "implement payment processing"
      - "grant priority from browser input"
      - "assign implementation before contracts are approved"
---

# Task Registry

The YAML front matter is canonical. Cursor agents may not self-assign backlog or
blocked tasks. Codex updates task states after reviewing evidence and resolving
dependencies.
