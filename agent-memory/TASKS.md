---
schema_version: "1.5"
document_id: "OM-TASKS-001"
kind: "task_registry"
updated_at: "2026-08-13T01:54:00Z"
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
    review_stage: "owner_functional_gap_found"
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
    depends_on: ["OM-ACC-001", "OM-DEP-001", "OM-ACC-004"]
    architect_review:
      account_scope: "passed_for_owner_test_before_owner_gap_report"
      owner_reachable_preview: "passed_for_owner_test"
      reviewed_branch_tip: "f6b5ab180a2da243d64662d82abecc452d62a3dc"
      branch_workflow: "passed"
    owner_preview:
      url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
      environment: "non_production"
      pages_project: "open-marketplace-demo"
      preview_database: "open-marketplace-account-preview-d1"
      handoff_path: "agent-memory/handoffs/2026-08-12--OM-DEP-001--cursor-grok-4-6.md"
    owner_manual_result: "failed_missing_required_settings"
    prior_owner_result: "failed_preview_unreachable"
    owner_observation: "User settings should include options to link social media accounts and the payment options previously described by the owner to the Cursor agent."
    failed_requirements:
      - "account settings omit persistent social-media linking"
      - "account settings omit the exact owner-specified payment-link options previously described to Cursor"
    acceptance_blocker: "OM-ACC-004 then human_owner_functional_pass"
    forbidden_actions:
      - "merge PR #21 before human functional pass"
      - "deploy account portal to production"
      - "mark owner manual test as pass"
  - id: "OM-DEP-001"
    title: "Deliver owner-reachable non-production account portal preview"
    workstream: "OM-DEP"
    status: "ready_for_review"
    review_stage: "awaiting_human_owner_functional_test_after_account_correction"
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
    owner_manual_result: "not_run_after_OM-ACC-004"
    acceptance_blocker: "OM-ACC-004 then human_owner_functional_pass"
    architecture_note: "The current preview helper PATCH payload restates production deployment config while configuring preview settings. It is not production approval. Reusable automation hardening is tracked separately in OM-DEP-002 before this pattern is generalized."
    forbidden_actions:
      - "merge PR #21 before human functional pass"
      - "change production URL"
      - "apply account migrations to production D1"
      - "mark owner manual test as pass"
  - id: "OM-ACC-004"
    title: "Add persistent social-media and owner-specified payment-link settings"
    workstream: "OM-ACC"
    status: "assigned"
    review_stage: "implementation"
    owner_role: "codex_architect_admin"
    assigned_agent: "cursor_implementation_subagent"
    supports_task: "OM-ACC-002"
    branch: "feature/account-management-portal"
    pull_request: 21
    shared_memory_ref: "main"
    target_base_ref: "main"
    contract_base_commit: "53856c06e23587dca12de597af8a67529a7f8e21"
    required_feature_head_ancestor: "f6b5ab180a2da243d64662d82abecc452d62a3dc"
    depends_on: ["OM-ACC-001", "OM-DEP-001"]
    owner_observation: "User settings should have options to link social medias and payment options previously described to the Cursor agent."
    objective: "Extend authenticated User/Account settings so each user can persistently add, edit, and remove their social-media links and the exact payment-link options the owner previously specified to Cursor, then make the corrected account flow available on the existing owner-reachable HTTPS preview."
    required_shared_memory_paths:
      - "Master_Descriptor.md"
      - "AGENTS.md"
      - "agent-memory/README.md"
      - "agent-memory/STATE.md"
      - "agent-memory/TASKS.md"
      - "agent-memory/DECISIONS.md"
    confirmed_social_platforms:
      - "Facebook"
      - "Instagram"
      - "TikTok"
    social_contract:
      - "Use or extend the existing social-account/profile model rather than creating a competing per-page-only data model."
      - "Expose the existing supported social-account fields in authenticated account settings, with add/update/remove and persistence across reload/sign-out/sign-in."
      - "At minimum Facebook, Instagram, and TikTok links must be supported because those platforms are already part of the marketplace trust surface."
      - "Reuse the existing allowlisted social-link normalization/health-check boundary where applicable."
      - "A resolving URL is link-health evidence only; never label a social identity verified solely because the URL resolves."
      - "New-listing social defaults should come from the signed-in user's saved profile where compatible with the existing listing social-proof model; do not allow browser-supplied data to change account ownership."
    payment_requirements:
      source_of_truth: "the exact payment options previously described by the human owner to the Cursor agent"
      recovery_order:
        - "Cursor IDE/local agent conversation and task context in which the owner previously specified payment options"
        - "repository branches, handoffs, docs, or task artifacts that record those exact owner requirements"
      no_guessing: true
      blocked_if_unrecoverable: "blocked_missing_exact_payment_option_list"
      implementation_boundary:
        - "Implement account-level public payment destination/link/handle metadata for only the exact recovered owner-specified options."
        - "Do not add guessed providers or substitute common payment platforms."
        - "Do not implement custody, escrow, checkout, settlement, bank/card credential storage, provider API secrets, or private payment authentication material in this task."
        - "Validate and normalize public identifiers/URLs and reject unsafe arbitrary schemes or malformed destinations."
        - "Never store secrets, access tokens, private keys, card numbers, bank credentials, or passwords in profile data, Git, logs, handoffs, or shared memory."
    ownership_and_storage_contract:
      - "Account/profile mutations require a validated server session and derive the user/profile owner from that session."
      - "One account must not read private settings or modify another account's profile settings."
      - "Persist settings in D1 using the existing profile model where sound; if schema changes are required, add a forward migration and preserve existing account/listing data."
      - "Public-facing social/payment metadata must be explicitly modeled as public profile/contact metadata; authentication credentials remain separate."
    allowed_paths:
      - "app/account/**"
      - "app/api/**"
      - "components/**"
      - "db/**"
      - "drizzle/**"
      - "lib/**"
      - "scripts/**"
      - "tests/**"
      - "README.md"
      - "CURSOR_START_HERE.md"
      - "ARCHITECTURE.md"
      - "package.json"
      - "package-lock.json"
      - "agent-memory/handoffs/**"
    repository_actions:
      - "fetch canonical main immediately before work and record the observed commit"
      - "merge/rebase current main into feature/account-management-portal without weakening canonical governance"
      - "preserve f6b5ab180a2da243d64662d82abecc452d62a3dc as an ancestor"
      - "edit allowed paths only"
      - "commit and push task changes to feature/account-management-portal"
      - "leave PR #21 draft"
    cloudflare_actions_authorized:
      scope: "non-production preview only"
      pages_project: "open-marketplace-demo"
      preview_database: "open-marketplace-account-preview-d1"
      allowed:
        - "apply only OM-ACC-004-required forward migrations to the dedicated preview D1"
        - "redeploy the feature/account-management-portal branch preview"
        - "probe the owner-reachable HTTPS preview and account/profile APIs"
      forbidden:
        - "apply migrations to production D1"
        - "modify the production URL"
        - "modify production account data"
        - "write secrets to Git/shared memory/handoffs"
    verification_required:
      - "record canonical main commit and cited shared-memory paths before edits"
      - "record evidence identifying the exact recovered owner-specified payment options; do not include any secret values"
      - "git diff --check"
      - "npm run lint"
      - "npm test"
      - "tests prove only the authenticated owner can mutate profile settings"
      - "tests prove supported social settings persist and can be removed"
      - "tests prove payment destinations are restricted to the recovered allowed option set and unsafe values are rejected"
      - "tests prove no social link is promoted to verified based only on URL health"
      - "existing public browsing, authentication, admin authorization, and session-derived listing ownership remain intact"
      - "branch Pages workflow succeeds on the returned exact head"
      - "owner-reachable HTTPS preview shows the corrected settings UI"
    owner_manual_checklist:
      - "Sign in and open Account settings on the HTTPS preview."
      - "Confirm a Social media section exists with Facebook, Instagram, and TikTok."
      - "Add, edit, remove, save, reload, and re-open social links; confirm saved values persist as expected."
      - "Confirm a Payment options section contains the exact options previously specified to Cursor, with no invented providers."
      - "Add/edit/remove a non-sensitive test payment destination for each supported option and confirm persistence."
      - "Create a new listing and confirm saved social profile data is used as intended without changing the signed-in seller identity."
      - "Sign out or use a different account and confirm another user's settings cannot be edited."
      - "Report pass/fail to Codex in ordinary language."
    forbidden_actions:
      - "invent payment platforms or payment requirements"
      - "merge PR #21"
      - "deploy account changes to production"
      - "apply production D1 migrations"
      - "weaken authentication or server-derived ownership boundaries"
      - "claim social identity verification from link health"
      - "store payment/authentication secrets or private financial credentials"
      - "mark human owner functional test pass"
    completion_contract:
      subagent_status: "ready_for_review_or_blocked"
      handoff_required: true
      shared_memory_refs_required: true
      exact_payment_requirement_evidence_required: true
      owner_reachable_https_preview_required: true
      owner_manual_result: "not_run"
      no_merge: true
      no_production_release: true
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

The YAML front matter is canonical. Cursor may execute only tasks with execution-ready status and explicit assignment. Cursor never self-accepts. A user-facing task cannot be accepted while the owner result is `not_run`, `not_run_on_https_preview`, `failed`, `failed_preview_unreachable`, or `failed_missing_required_settings`.
