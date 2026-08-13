---
schema_version: "1.7"
document_id: "OM-TASKS-001"
kind: "task_registry"
updated_at: "2026-08-13T02:47:00Z"
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
    result: "substantial reference implementation; governance reconciliation completed; final account acceptance still requires owner-reachable preview and human functional pass"
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
    current_head: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"
    account_implementation_head: "9c28a5db9f4aa41932977a005806beb98b57c4e4"
    preview_implementation_head: "5c68a7c7a5d94a332274074065f0d30a4a502a9e"
    payment_correction_head: "85a1102c4bc8a40c84be1a5416d23a582bc41846"
    pull_request: 21
    pull_request_state: "draft"
    depends_on: ["OM-ACC-001", "OM-DEP-001", "OM-ACC-004", "OM-ACC-005"]
    architect_review:
      status: "passed_for_owner_test"
      reviewed_branch_tip: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"
      latest_branch_workflow: {run_id: 31661766350, result: "success", head: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"}
    owner_preview:
      url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
      deployment_url: "https://760b2b84.open-marketplace-demo.pages.dev/"
      environment: "non_production"
      pages_project: "open-marketplace-demo"
      preview_database: "open-marketplace-account-preview-d1"
    owner_manual_result: "not_run_on_current_https_preview"
    prior_owner_results:
      - "failed_preview_unreachable"
      - "failed_missing_required_settings"
    acceptance_blocker: "human_owner_functional_pass"
    oauth_scope_note: "Current acceptance scope is manual public social URLs and manual public payment destinations. OAuth/provider Connect buttons are not implemented and their absence is not an OM-ACC-002 defect. No OAuth task is assigned unless the human owner explicitly requests it."
    forbidden_actions: ["merge PR #21 before human functional pass", "deploy account portal to production", "mark owner manual test as pass"]
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
    implementation_head: "5c68a7c7a5d94a332274074065f0d30a4a502a9e"
    branch_tip: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"
    latest_branch_workflow: {run_id: 31661766350, workflow: "Deploy to Cloudflare Pages", result: "success", head: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"}
    functional_preview:
      url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
      latest_reviewed_deployment_url: "https://760b2b84.open-marketplace-demo.pages.dev/"
      environment: "non_production"
      pages_project: "open-marketplace-demo"
      preview_database: "open-marketplace-account-preview-d1"
    owner_manual_result: "not_run_on_current_https_preview"
    acceptance_blocker: "human_owner_functional_pass"
    architecture_note: "The preview helper still requires separate OM-DEP-002 hardening before it is generalized as reusable infrastructure."
    forbidden_actions: ["merge PR #21 before human functional pass", "change production URL", "apply account migrations to production D1", "mark owner manual test as pass"]
  - id: "OM-ACC-004"
    title: "Add persistent social-media and owner-specified payment-link settings"
    workstream: "OM-ACC"
    status: "ready_for_review"
    review_stage: "corrected_by_OM-ACC-005_awaiting_owner_test"
    owner_role: "codex_architect_admin"
    assigned_agent: "cursor_implementation_subagent"
    supports_task: "OM-ACC-002"
    branch: "feature/account-management-portal"
    pull_request: 21
    shared_memory_ref: "main"
    implementation_commit: "c4247d52813eda683cc55db4d777f67294a8195e"
    handoff_commit: "62669c5e993acb4bf7dc354ade0f5fea5db72f52"
    handoff_path: "agent-memory/handoffs/2026-08-13--OM-ACC-004--cursor-grok-4-6.md"
    correction_task: "OM-ACC-005"
    architect_review:
      social_settings: "pass"
      session_owned_profile_mutation: "pass"
      social_self_reported_boundary: "pass"
      payment_definition: "corrected_by_OM-ACC-005"
    owner_manual_result: "not_run_on_corrected_preview"
    acceptance_blocker: "human_owner_functional_pass"
    forbidden_actions: ["merge PR #21 before human functional pass", "deploy to production", "apply production D1 migrations"]
  - id: "OM-ACC-005"
    title: "Correct top-five crypto rails and bind every crypto destination to an explicit network"
    workstream: "OM-ACC"
    status: "ready_for_review"
    review_stage: "awaiting_human_owner_functional_test"
    owner_role: "codex_architect_admin"
    assigned_agent: "cursor_implementation_subagent"
    supports_task: "OM-ACC-002"
    remediates_task: "OM-ACC-004"
    branch: "feature/account-management-portal"
    pull_request: 21
    shared_memory_ref: "main"
    required_feature_head_ancestor: "62669c5e993acb4bf7dc354ade0f5fea5db72f52"
    implementation_commit: "85a1102c4bc8a40c84be1a5416d23a582bc41846"
    handoff_commit: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"
    handoff_path: "agent-memory/handoffs/2026-08-13--OM-ACC-005--cursor-grok-4-6.md"
    depends_on: ["OM-ACC-004"]
    objective: "Preserve the working OM-ACC-004 social/account settings while correcting the launch crypto payment rails to the architect-approved 2026-08-13 top-five snapshot and making every crypto destination explicitly asset-and-network bound before owner functional testing."
    required_shared_memory_paths:
      - "Master_Descriptor.md"
      - "AGENTS.md"
      - "agent-memory/README.md"
      - "agent-memory/STATE.md"
      - "agent-memory/TASKS.md"
      - "agent-memory/DECISIONS.md"
    architect_payment_contract:
      fiat_rails:
        - {id: "paypal", label: "PayPal"}
        - {id: "venmo", label: "Venmo"}
        - {id: "cashapp", label: "Cash App"}
      crypto_snapshot:
        snapshot_date_utc: "2026-08-13"
        interpretation: "For this launch snapshot, top-five crypto means the five frozen market-cap assets including Bitcoin used by OM-DEC-010."
        assets:
          - {asset: "BTC", label: "Bitcoin", network_id: "bitcoin_mainnet", network_label: "Bitcoin Mainnet"}
          - {asset: "ETH", label: "Ethereum", network_id: "ethereum_mainnet", network_label: "Ethereum Mainnet"}
          - {asset: "USDT", label: "Tether (USDT)", network_id: "usdt_ethereum", network_label: "Ethereum Mainnet (ERC-20)"}
          - {asset: "BNB", label: "BNB", network_id: "bnb_bsc", network_label: "BNB Smart Chain Mainnet"}
          - {asset: "USDC", label: "USDC", network_id: "usdc_ethereum", network_label: "Ethereum Mainnet (ERC-20)"}
      remove_from_launch_allowlist: ["Solana"]
    implementation_requirements:
      - "Preserve Facebook, Instagram, and TikTok account settings, persistence, link-health behavior, and forced self-reported status from OM-ACC-004."
      - "Preserve session-derived account ownership and seller identity boundaries."
      - "Replace Solana with USDC in launch payment UI, allowlist, types, docs, and tests."
      - "Persist crypto destinations with stable asset-and-network identifiers and visible network labels."
      - "Store only public receive identifiers/addresses; never store or log private keys, seed phrases, passwords, card/bank credentials, OAuth tokens, or wallet signing secrets."
      - "Reject unsupported rails/networks and unsafe or malformed secret-looking input."
      - "Do not implement wallet signing, WalletConnect, payment execution, conversion, custody, escrow, refunds, fees, settlement, or provider OAuth in this task."
    verification:
      - "git diff --check passed"
      - "npm run lint passed"
      - "npm test passed: 27 tests, 0 failed"
      - "implementation workflow run 31661669792 passed at 85a1102c4bc8a40c84be1a5416d23a582bc41846"
      - "latest branch workflow run 31661766350 passed at bec794fe9589a4ae15fe71ddb2e463d98eaca78c"
      - "preview account HTML shows Facebook, Instagram, TikTok and the corrected payment rails with explicit networks"
      - "preview API persisted PayPal plus USDC on Ethereum Mainnet and rejected Solana"
      - "preview D1 already contained payment_destinations_json; no new migration was needed"
      - "production D1 still contains only _cf_KV; account migrations were not applied"
      - "production URL remained unchanged"
    architect_review:
      status: "passed_for_owner_test"
      reviewed_implementation_commit: "85a1102c4bc8a40c84be1a5416d23a582bc41846"
      reviewed_branch_tip: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"
      current_payment_set: ["PayPal", "Venmo", "Cash App", "Bitcoin", "Ethereum", "Tether (USDT)", "BNB", "USDC"]
      social_settings_preserved: true
      production_isolation_preserved: true
      oauth_connect_controls_in_scope: false
    functional_preview:
      url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
      deployment_url: "https://760b2b84.open-marketplace-demo.pages.dev/"
      environment: "non_production"
      preview_database: "open-marketplace-account-preview-d1"
    owner_manual_checklist:
      - "Sign in and open Account settings on the HTTPS preview."
      - "Confirm Facebook, Instagram, and TikTok manual profile URL fields are present."
      - "Add/edit/remove a non-sensitive test social URL and confirm save/reload persistence."
      - "Confirm Payment options shows PayPal, Venmo, Cash App, Bitcoin, Ethereum, Tether (USDT), BNB, and USDC; Solana should not appear."
      - "Confirm every crypto option visibly names its network: Bitcoin Mainnet; Ethereum Mainnet; USDT Ethereum/ERC-20; BNB Smart Chain Mainnet; USDC Ethereum/ERC-20."
      - "Use only non-sensitive public/test destinations to add, edit, remove, save, reload, and confirm persistence."
      - "Confirm publishing remains tied to the signed-in seller identity."
      - "Do not fail this task merely because OAuth Connect buttons are absent; OAuth was explicitly out of scope."
      - "Report pass/fail to Codex in ordinary language."
    owner_manual_result: "not_run"
    acceptance_blocker: "human_owner_functional_pass"
    forbidden_actions:
      - "merge PR #21 before human functional pass"
      - "deploy account changes to production"
      - "apply production D1 migrations"
      - "store private financial/authentication material"
      - "mark human owner functional test pass"
    completion_contract:
      subagent_status: "ready_for_review"
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
    objective: "Before preview automation is treated as reusable framework infrastructure, ensure branch-preview configuration cannot overwrite unrelated future production settings, or document/test minimum unavoidable Cloudflare API coupling."
    architect_first: true
  - id: "OM-ACC-003"
    title: "Design two-factor authentication framework"
    workstream: "OM-ACC"
    status: "backlog"
    owner_role: "codex_architect_admin"
    assigned_agent: null
    depends_on: ["OM-ACC-002"]
    architect_first: true
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

The YAML front matter is canonical. Cursor may execute only tasks with execution-ready status and explicit assignment. Cursor never self-accepts. A user-facing task cannot be accepted while the owner functional result is not an explicit pass.
