---
schema_version: "1.3"
document_id: "OM-TASKS-001"
kind: "task_registry"
updated_at: "2026-08-12T21:02:00Z"
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
    status: "blocked"
    review_stage: "owner_preview_unreachable"
    owner_role: "codex_architect_admin"
    assigned_agent: "cursor_implementation_subagent"
    branch: "feature/account-management-portal"
    base_branch: "main"
    shared_memory_ref: "main"
    observed_base_commit: "d357af8e3f027ba538c331fd97c62dc6d6eb2374"
    implementation_head: "9c28a5db9f4aa41932977a005806beb98b57c4e4"
    branch_tip: "dc5a23a99f97e0c2729d0f9a8cfdbcb59f603e27"
    handoff_path: "agent-memory/handoffs/2026-08-12--OM-ACC-002--cursor-grok-4-6.md"
    pull_request: 21
    pull_request_state: "draft"
    mergeable: true
    depends_on: ["OM-ACC-001"]
    architect_review:
      status: "passed_for_owner_test"
      reviewed_head: "dc5a23a99f97e0c2729d0f9a8cfdbcb59f603e27"
      scope_result: "passed"
      governance_result: "passed"
      branch_workflow_result: "passed"
    owner_manual_result: "failed_preview_unreachable"
    owner_observation: "http://localhost:5173/ does not open"
    acceptance_blocker: "OM-DEP-001 then human_owner_functional_pass"
    forbidden_actions: ["merge PR #21", "deploy to production", "mark owner manual test as pass"]
  - id: "OM-DEP-001"
    title: "Deliver owner-reachable non-production account portal preview"
    workstream: "OM-DEP"
    status: "assigned"
    owner_role: "codex_architect_admin"
    assigned_agent: "cursor_implementation_subagent"
    supports_task: "OM-ACC-002"
    branch: "feature/account-management-portal"
    pull_request: 21
    shared_memory_ref: "main"
    target_base_ref: "main"
    required_feature_head_ancestor: "dc5a23a99f97e0c2729d0f9a8cfdbcb59f603e27"
    depends_on: ["OM-GOV-002", "OM-ACC-001"]
    objective: "Provide an HTTPS preview that the human owner can open from their browser and use to test PR #21 end-to-end. Prefer the existing Cloudflare Pages branch preview. Do not count agent-only localhost as success."
    required_shared_memory_paths:
      - "Master_Descriptor.md"
      - "AGENTS.md"
      - "agent-memory/README.md"
      - "agent-memory/STATE.md"
      - "agent-memory/TASKS.md"
      - "agent-memory/DECISIONS.md"
    preview_contract:
      environment: "non_production"
      delivery: "owner_reachable_https_url"
      preferred_surface: "Cloudflare Pages branch preview for feature/account-management-portal"
      fallback_surface: "temporary Cloudflare Tunnel only if the URL remains reachable for the owner's test session"
      forbidden_surface: "agent-only localhost"
      required_binding: "DB"
      required_secret_names: ["BETTER_AUTH_SECRET"]
      optional_preview_var_names: ["MARKETPLACE_ADMIN_EMAILS"]
      required_user_flows: ["public browse", "create account", "sign in", "account page", "create listing as signed-in user", "sign out", "publishing blocked while signed out"]
      owner_manual_result_on_handoff: "not_run"
    allowed_paths:
      - ".github/workflows/deploy-cloudflare-pages.yml"
      - ".env.example"
      - ".openai/hosting.json"
      - "ARCHITECTURE.md"
      - "CURSOR_START_HERE.md"
      - "README.md"
      - "scripts/**"
      - "tests/**"
      - "agent-memory/handoffs/**"
      - "app/**"
      - "db/**"
      - "drizzle/**"
      - "lib/**"
      - "package.json"
      - "package-lock.json"
    repository_actions:
      - "fetch canonical main immediately before work"
      - "keep feature/account-management-portal based on current main"
      - "edit allowed_paths only and only as needed for preview correctness"
      - "commit and push task changes to feature/account-management-portal"
      - "leave PR #21 draft"
    cloudflare_actions_authorized:
      scope: "non-production only"
      account_access: "use existing Cloudflare OAuth/Wrangler session; do not require or store an API token in Git"
      pages_project: "open-marketplace-demo"
      allowed:
        - "inspect current branch preview deployment and obtain its canonical preview URL"
        - "create or reuse a dedicated non-production D1 database for account-preview data if required"
        - "apply drizzle migrations 0000 through 0002 to the dedicated preview D1 only"
        - "bind the dedicated preview D1 to binding name DB for the non-production preview"
        - "set a generated non-production BETTER_AUTH_SECRET in Cloudflare preview/runtime secret storage"
        - "set MARKETPLACE_ADMIN_EMAILS only to non-sensitive preview test email values if needed"
        - "deploy or redeploy feature/account-management-portal to the non-production Pages preview"
        - "inspect deployment logs/status and externally probe the returned HTTPS URL"
      forbidden:
        - "modify production D1 data or production D1 migrations"
        - "replace or change the production URL https://open-marketplace-demo.pages.dev"
        - "modify DNS or zone sentineldefensetechnologies.co.za"
        - "write secrets, tokens, cookies, or credentials to Git/shared memory/handoff"
        - "merge PR #21"
        - "mark human owner functional test pass"
    verification_required:
      - "record canonical main commit and cited shared-memory paths"
      - "git diff --check"
      - "npm run lint"
      - "npm test"
      - "record exact HTTPS preview URL"
      - "external GET preview home returns 200"
      - "external GET /login returns 200"
      - "preview D1/auth smoke probe succeeds without production credentials"
      - "authenticated listing POST uses server session identity"
      - "signed-out listing POST is rejected"
      - "preview URL is not localhost and is intended for human-owner access"
    completion_contract:
      subagent_status: "ready_for_review_or_blocked"
      handoff_required: true
      shared_memory_refs_required: true
      preview_url_required: true
      owner_manual_result: "not_run"
      no_merge: true
      no_production_release: true
  - id: "OM-TRUST-001"
    title: "Author identity, hosting-node, priority, payment, and privacy contracts"
    workstream: "OM-IDV"
    status: "backlog"
    owner_role: "codex_architect_admin"
    assigned_agent: null
    depends_on: ["OM-GOV-002"]
---

# Task Registry

The YAML front matter is canonical. Cursor may execute only tasks with execution-ready status and explicit assignment. Cursor never self-accepts. A user-facing task cannot be accepted while the owner result is `not_run`, `failed`, or `failed_preview_unreachable`.
