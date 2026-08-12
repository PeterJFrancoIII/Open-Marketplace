---
schema_version: "1.1"
document_id: "OM-TASKS-001"
kind: "task_registry"
updated_at: "2026-08-12T20:22:00Z"
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
    result: "reference implementation is substantial but requires governance rebase and owner-testable preview before acceptance; production gates remain open"
  - id: "OM-ACC-002"
    title: "Reconcile PR #21 with governance main and prepare owner-testable account preview"
    workstream: "OM-ACC"
    status: "assigned"
    owner_role: "codex_architect_admin"
    assigned_agent: "cursor_implementation_subagent"
    branch: "feature/account-management-portal"
    base_branch: "main"
    required_source_head: "2a42055ec93297b5556eeec571844ec2f1b57cf3"
    target_base_commit: "b7c634829210cf2e386129058710a98a1db26663"
    pull_request: 21
    depends_on: ["OM-ACC-001"]
    functional_preview_required: true
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
    authorized_actions:
      - "fetch main"
      - "rebase or merge main into feature/account-management-portal"
      - "resolve conflicts while preserving canonical governance precedence"
      - "edit allowed_paths only"
      - "run local migrations against local development storage only"
      - "create a non-production local authentication secret outside Git if needed"
      - "run tests, lint, build, and local development server"
      - "commit task changes to feature/account-management-portal"
      - "push feature/account-management-portal"
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
    implementation_requirements:
      - "Read and cite GitHub shared memory before edits."
      - "Bring PR #21 onto the current governance baseline without weakening governance files."
      - "Preserve public browsing and server-derived seller/admin identity boundaries."
      - "Make the account flow runnable locally for the human owner without production credentials."
      - "Do not fake email verification, password reset, identity verification, or production readiness."
      - "Leave a local preview running when the IDE environment permits; otherwise provide the exact one-command start procedure."
    verification:
      - "git diff --check"
      - "npm run lint"
      - "npm test"
      - "local preview loads marketplace home"
      - "local preview supports sign up -> sign in -> account -> create listing -> sign out, or task reports blocked with exact missing local runtime dependency"
    owner_manual_checklist:
      - "Open marketplace home and browse without signing in."
      - "Create a test account using non-sensitive test data."
      - "Sign in and open the account page."
      - "Create a test listing and confirm the listing uses the signed-in account identity."
      - "Sign out and confirm publishing is no longer available without signing in."
      - "Report pass/fail to Codex in ordinary language."
    completion_contract:
      subagent_status: "ready_for_review_or_blocked"
      owner_manual_result: "not_run"
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
    unblock_condition: "OM-ACC-002 passes architect review and human local functional acceptance"
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

The YAML front matter is canonical. Cursor agents may execute only tasks with execution-ready status and explicit assignment. Cursor never self-accepts work.
