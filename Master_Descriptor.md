---
schema_version: "1.0"
document:
  id: "OM-MASTER-001"
  kind: "project_master_descriptor"
  canonical: true
  status: "active"
  updated_at: "2026-08-12T19:27:59Z"
  updated_by: "codex-architect"
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
    responsibility: "final product and production authority"
  - rank: 2
    role: "codex_architect_admin"
    responsibility: "architecture, task contracts, review, integration, and administration"
  - rank: 3
    role: "cursor_implementation_subagent"
    responsibility: "execute assigned work packages and return evidence"
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
  task:
    - "backlog"
    - "blocked"
    - "assigned"
    - "in_progress"
    - "ready_for_review"
    - "accepted"
    - "cancelled"
  workstream:
    - "specified"
    - "framework_required"
    - "reference_implementation"
    - "preview_validation"
    - "production_ready"
    - "released"
current_repository_state:
  main_commit: "38d823a754d5da62bd87fe4c436a5ac8140146dc"
  governance_branch: "agent/shared-agent-memory"
  account_reference:
    branch: "feature/account-management-portal"
    commit: "2a42055ec93297b5556eeec571844ec2f1b57cf3"
    pull_request: 21
    pull_request_state: "draft"
    ci_state: "passed"
    production_state: "not_released"
workstreams:
  - id: "OM-GOV"
    name: "Agent governance and shared memory"
    status: "reference_implementation"
    architect: "codex_architect_admin"
    implementer: "codex_architect_admin"
  - id: "OM-ACC"
    name: "Account creation and account/admin consoles"
    status: "reference_implementation"
    architect: "codex_architect_admin"
    implementer: "cursor_implementation_subagent"
    reference_pull_request: 21
  - id: "OM-DEP"
    name: "Cloudflare preview and production configuration"
    status: "framework_required"
    architect: "codex_architect_admin"
    implementer: "cursor_implementation_subagent"
  - id: "OM-IDV"
    name: "High-assurance identity verification"
    status: "framework_required"
    architect: "codex_architect_admin"
    implementer: "cursor_implementation_subagent"
  - id: "OM-NODE"
    name: "Decentralized hosting-node registration and proof"
    status: "framework_required"
    architect: "codex_architect_admin"
    implementer: "cursor_implementation_subagent"
  - id: "OM-RANK"
    name: "Priority listing eligibility and deterministic ordering"
    status: "framework_required"
    architect: "codex_architect_admin"
    implementer: "cursor_implementation_subagent"
  - id: "OM-BILL"
    name: "Paid priority listings and dynamic pricing"
    status: "framework_required"
    architect: "codex_architect_admin"
    implementer: "cursor_implementation_subagent"
  - id: "OM-PRIV"
    name: "Ad-free hosting benefits and privacy/cookie policy"
    status: "framework_required"
    architect: "codex_architect_admin"
    implementer: "cursor_implementation_subagent"
  - id: "OM-MOD"
    name: "Moderation, audit log, and administrator capabilities"
    status: "framework_required"
    architect: "codex_architect_admin"
    implementer: "cursor_implementation_subagent"
product_requirements:
  public_browsing:
    required: true
  account_creation:
    required: true
    identity_verified_by_default: false
  decentralized_hosts:
    required: true
    eligibility_requires:
      - "high_assurance_identity_verification"
      - "verifiable_hosting_node_operation"
    permitted_benefits:
      - "priority_listing_status"
      - "ad_free_experience"
  priority_listings:
    presentation: "yellow_box"
    ordering: "before_regular_listings"
    regular_user_initial_fee_usd: "0.10"
    dynamic_pricing_required: true
    implementation_state: "architecture_required"
security_and_privacy_invariants:
  - "Never commit or log secrets, authentication tokens, cookies, passwords, or private exports."
  - "Never store raw identity documents in Git, shared memory, a public object store, or the general marketplace metadata tables."
  - "Identity verification must use a purpose-built protected boundary with retention, deletion, access-audit, and incident-response rules."
  - "Listing ownership, administrator status, verification status, host status, and priority eligibility are server-derived."
  - "Listing image bytes remain outside the public metadata registry."
  - "Public browsing remains available unless the human owner explicitly changes this requirement."
  - "No destructive administrator capability is added without authorization, audit logging, tests, and a separate task approval."
  - "No production deployment is inferred from a passing build, preview, or subagent report."
production_gates:
  - id: "PG-01"
    requirement: "all relevant tasks are accepted by Codex"
  - id: "PG-02"
    requirement: "full tests, lint, build, artifact validation, and required visual checks pass"
  - id: "PG-03"
    requirement: "Cloudflare bindings, migrations, secrets, and rollback are verified in preview"
  - id: "PG-04"
    requirement: "security and privacy boundaries are reviewed"
  - id: "PG-05"
    requirement: "human owner gives explicit production approval"
shared_memory:
  root: "agent-memory"
  protocol: "agent-memory/README.md"
  state: "agent-memory/STATE.md"
  task_registry: "agent-memory/TASKS.md"
  decisions: "agent-memory/DECISIONS.md"
  handoff_template: "agent-memory/HANDOFF_TEMPLATE.md"
---

# Open Marketplace Master Descriptor

This file is the canonical machine-readable project contract. The YAML front
matter is authoritative. The prose below explains it for humans; it does not
silently override structured fields.

## Operating model

The human owner chooses product direction and production outcomes. Codex acts as
architect and administrator: it turns direction into bounded contracts,
frameworks, tests, assignments, review gates, and release decisions. Cursor IDE
and Cloud agents perform implementation work packages under those contracts.

Subagents do not self-assign broad objectives or declare acceptance. Each task
must identify allowed paths, forbidden actions, dependencies, expected outputs,
and executable acceptance checks. A task is accepted only after Codex reviews
the diff and verification evidence.

## Current truth

The account and admin portal exists as a reference implementation in draft PR
#21. It is not part of `main` or production. The shared-memory system is being
introduced independently on `agent/shared-agent-memory` so governance can be
reviewed without mixing it into feature code.

## Product direction requiring architecture

The marketplace is intended to support decentralized copies or database-hosting
nodes. A person receiving hosting benefits must pass high-assurance identity
verification and prove operation of an eligible node. The verification design
must minimize custody of sensitive identity data and make access, retention,
deletion, and incident handling explicit before implementation.

Eligible hosts may receive priority-listing status or an ad-free experience.
Priority listings appear in a yellow treatment and sort ahead of regular
listings. Regular users may purchase priority beginning at USD 0.10 per listing;
the later dynamic-pricing policy must be deterministic, disclosed, testable, and
not controlled by browser input.

These requirements are direction, not completed designs. `OM-IDV`, `OM-NODE`,
`OM-RANK`, `OM-BILL`, and `OM-PRIV` require architect-authored task contracts
before a Cursor subagent implements them.

## Release rule

No branch reaches production merely because an agent completed it, CI passed,
or a Cloudflare preview exists. Every applicable production gate in the YAML
front matter must be satisfied and the human owner must explicitly approve the
release.
