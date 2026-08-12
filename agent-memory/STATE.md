---
schema_version: "1.0"
document_id: "OM-STATE-001"
kind: "project_state"
updated_at: "2026-08-12T19:34:00Z"
updated_by: "codex_architect"
repository:
  name: "PeterJFrancoIII/Open-Marketplace"
  default_branch: "main"
  main_commit: "38d823a754d5da62bd87fe4c436a5ac8140146dc"
production:
  provider: "Cloudflare Pages"
  project: "open-marketplace-demo"
  url: "https://open-marketplace-demo.pages.dev"
  account_portal_released: false
active_changes:
  - id: "OM-GOV-001"
    branch: "agent/shared-agent-memory"
    commit: "5d560e8335438c3da08b9589fdf12555037ddba4"
    pull_request: 22
    pull_request_state: "draft"
    state: "ready_for_review"
    purpose: "repository-backed shared memory and agent rules"
  - id: "OM-ACC-001"
    branch: "feature/account-management-portal"
    commit: "2a42055ec93297b5556eeec571844ec2f1b57cf3"
    pull_request: 21
    pull_request_state: "draft"
    ci_state: "passed"
    production_state: "not_released"
validation:
  main_baseline:
    checked_at: "2026-08-12T19:27:59Z"
    lint: "passed"
    direct_vinext_build: "passed"
    artifact_validation: "passed"
    node_tests: "failed_known_stale_assertion"
    failing_test: "tests/rendered-html.test.mjs expects retired text 'open exchange'"
    correction_location: "feature/account-management-portal commit d14f751"
known_blockers:
  - id: "OM-BLOCK-001"
    scope: "main"
    description: "The standard npm test wrapper requires GNU timeout on this Mac. Use the documented direct Vinext build sequence until the wrapper is made portable."
  - id: "OM-BLOCK-002"
    scope: "main"
    description: "The main-branch rendered HTML test contains the retired Open Exchange assertion."
  - id: "OM-BLOCK-003"
    scope: "account_portal_production"
    description: "Production D1 migration, DB binding, authentication secret, admin allowlist, and production acceptance have not been confirmed."
next_architect_action: "Obtain human review for PR #22, then reconcile PR #21 against the accepted master descriptor."
---

# Current Project State

The YAML front matter is the machine-readable snapshot. This prose highlights
the operational consequence: the account/admin reference implementation is
reviewable but not production-approved, and the governance/shared-memory change
must be accepted before new implementation packages are assigned.
