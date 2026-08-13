---
schema_version: "1.6"
document_id: "OM-TASKS-001"
kind: "task_registry"
updated_at: "2026-08-13T02:30:00Z"
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
    status: "blocked"
    review_stage: "payment_settings_correction_required_before_owner_test"
    owner_role: "codex_architect_admin"
    assigned_agent: "cursor_implementation_subagent"
    branch: "feature/account-management-portal"
    base_branch: "main"
    shared_memory_ref: "main"
    current_head: "62669c5e993acb4bf7dc354ade0f5fea5db72f52"
    account_implementation_head: "9c28a5db9f4aa41932977a005806beb98b57c4e4"
    preview_implementation_head: "5c68a7c7a5d94a332274074065f0d30a4a502a9e"
    pull_request: 21
    pull_request_state: "draft"
    depends_on: ["OM-ACC-001", "OM-DEP-001", "OM-ACC-004", "OM-ACC-005"]
    owner_preview:
      url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
      environment: "non_production"
      pages_project: "open-marketplace-demo"
      preview_database: "open-marketplace-account-preview-d1"
    owner_manual_result: "not_run_after_payment_architect_correction"
    prior_owner_results:
      - "failed_preview_unreachable"
      - "failed_missing_required_settings"
    acceptance_blocker: "OM-ACC-005 then human_owner_functional_pass"
    forbidden_actions: ["merge PR #21", "deploy account portal to production", "mark owner manual test as pass"]
  - id: "OM-DEP-001"
    title: "Deliver owner-reachable non-production account portal preview"
    workstream: "OM-DEP"
    status: "ready_for_review"
    review_stage: "owner_test_deferred_until_OM-ACC-005"
    owner_role: "codex_architect_admin"
    assigned_agent: "cursor_implementation_subagent"
    supports_task: "OM-ACC-002"
    branch: "feature/account-management-portal"
    pull_request: 21
    shared_memory_ref: "main"
    implementation_head: "5c68a7c7a5d94a332274074065f0d30a4a502a9e"
    branch_tip: "62669c5e993acb4bf7dc354ade0f5fea5db72f52"
    latest_branch_workflow: {run_id: 31660568138, workflow: "Deploy to Cloudflare Pages", result: "success", head: "62669c5e993acb4bf7dc354ade0f5fea5db72f52"}
    functional_preview:
      url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
      latest_reviewed_deployment_url: "https://95c543a4.open-marketplace-demo.pages.dev/"
      environment: "non_production"
      pages_project: "open-marketplace-demo"
      preview_database: "open-marketplace-account-preview-d1"
    owner_manual_result: "not_run_after_OM-ACC-005"
    architecture_note: "The preview helper still requires separate OM-DEP-002 hardening before it is generalized as reusable infrastructure."
    forbidden_actions: ["merge PR #21", "change production URL", "apply account migrations to production D1", "mark owner manual test as pass"]
  - id: "OM-ACC-004"
    title: "Add persistent social-media and owner-specified payment-link settings"
    workstream: "OM-ACC"
    status: "changes_requested"
    review_stage: "architect_review_failed_payment_definition"
    owner_role: "codex_architect_admin"
    assigned_agent: "cursor_implementation_subagent"
    supports_task: "OM-ACC-002"
    branch: "feature/account-management-portal"
    pull_request: 21
    shared_memory_ref: "main"
    implementation_commit: "c4247d52813eda683cc55db4d777f67294a8195e"
    handoff_commit: "62669c5e993acb4bf7dc354ade0f5fea5db72f52"
    handoff_path: "agent-memory/handoffs/2026-08-13--OM-ACC-004--cursor-grok-4-6.md"
    returned_status: "ready_for_review"
    architect_review:
      social_settings: "pass"
      session_owned_profile_mutation: "pass"
      social_self_reported_boundary: "pass"
      automated_tests: "pass_reported_27"
      implementation_workflow: {run_id: 31660457017, result: "success", head: "c4247d52813eda683cc55db4d777f67294a8195e"}
      latest_branch_workflow: {run_id: 31660568138, result: "success", head: "62669c5e993acb4bf7dc354ade0f5fea5db72f52"}
      preview_reachability_evidence: "pass_from_cursor_handoff_and_workflow"
      payment_definition: "changes_requested"
    payment_review_findings:
      - "The owner requirement recovered by Cursor was PayPal, Venmo, Cash App, and a top-five crypto requirement; the individual crypto list was not directly owner-named."
      - "Cursor used Solana as the fifth crypto, but the architect's 2026-08-13 market-cap verification from CoinGecko and CoinMarketCap placed USDC at #5 and Solana below #5."
      - "USDT exists on multiple supported blockchains, and the current model stores a bare destination without an explicit network. Ambiguous crypto destinations are unsafe for a marketplace payment-contact feature."
      - "The correction must preserve the working social/account implementation and replace only the unsafe/stale payment definition and validation semantics."
    acceptance_blocker: "OM-ACC-005"
    forbidden_actions: ["accept OM-ACC-004 as final", "merge PR #21", "deploy to production", "apply production D1 migrations"]
  - id: "OM-ACC-005"
    title: "Correct top-five crypto rails and bind every crypto destination to an explicit network"
    workstream: "OM-ACC"
    status: "assigned"
    review_stage: "implementation"
    owner_role: "codex_architect_admin"
    assigned_agent: "cursor_implementation_subagent"
    supports_task: "OM-ACC-002"
    remediates_task: "OM-ACC-004"
    branch: "feature/account-management-portal"
    pull_request: 21
    shared_memory_ref: "main"
    required_feature_head_ancestor: "62669c5e993acb4bf7dc354ade0f5fea5db72f52"
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
        interpretation: "For this launch snapshot, 'top 5 cryptos' means the five highest market-cap cryptoassets including Bitcoin, consistent with the prior five-asset Cursor implementation."
        evidence: "Architect verified the market-cap ordering against current CoinGecko and CoinMarketCap results before assigning this correction."
        assets:
          - {asset: "BTC", label: "Bitcoin", network_id: "bitcoin_mainnet", network_label: "Bitcoin Mainnet"}
          - {asset: "ETH", label: "Ethereum", network_id: "ethereum_mainnet", network_label: "Ethereum Mainnet"}
          - {asset: "USDT", label: "Tether (USDT)", network_id: "usdt_ethereum", network_label: "Ethereum Mainnet (ERC-20)"}
          - {asset: "BNB", label: "BNB", network_id: "bnb_bsc", network_label: "BNB Smart Chain Mainnet"}
          - {asset: "USDC", label: "USDC", network_id: "usdc_ethereum", network_label: "Ethereum Mainnet (ERC-20)"}
      remove_from_launch_allowlist:
        - "Solana"
      rationale:
        - "The top-five list is frozen as a launch snapshot rather than dynamically re-ranked, so saved account settings do not change meaning when market rankings move."
        - "Tether and USDC operate on multiple blockchains; a receive destination must therefore bind a network explicitly."
        - "The initial single-network scope is intentionally narrow: Bitcoin Mainnet, Ethereum Mainnet/ERC-20, and BNB Smart Chain Mainnet. Additional networks require a later reviewed task."
    implementation_requirements:
      - "Preserve Facebook, Instagram, and TikTok account settings, persistence, link-health behavior, and forced self-reported status from OM-ACC-004."
      - "Preserve session-derived account ownership and seller identity boundaries."
      - "Replace Solana with USDC in the launch payment UI, allowlist, types, docs, and tests."
      - "Model crypto destinations with an explicit stable asset+network identifier; bare ambiguous ids such as usdt, bnb, or usdc are not sufficient for persisted data."
      - "UI labels must show both asset and network before the user saves an address."
      - "Store only public receive identifiers/addresses. Never store or log private keys, seed phrases, passwords, card/bank credentials, OAuth tokens, or wallet signing secrets."
      - "Validate address syntax appropriate to the fixed network where feasible without custom cryptography; fail closed on unsupported networks or malformed/secret-looking input."
      - "If existing preview profile JSON contains the removed Solana rail or legacy ambiguous crypto ids, ignore or safely normalize/migrate preview data without inventing a destination or network."
      - "Do not implement wallet signing, WalletConnect, payment execution, conversion, custody, escrow, refunds, fees, settlement, or provider OAuth in this task."
    allowed_paths:
      - "app/account/**"
      - "app/api/account/profile/**"
      - "app/api/listings/**"
      - "db/**"
      - "drizzle/**"
      - "lib/payment-destinations.ts"
      - "lib/types.ts"
      - "tests/**"
      - "scripts/**"
      - "README.md"
      - "CURSOR_START_HERE.md"
      - "ARCHITECTURE.md"
      - "agent-memory/handoffs/**"
    repository_actions:
      - "fetch canonical main immediately before work and record the observed commit"
      - "merge/rebase current main into feature/account-management-portal without weakening governance"
      - "preserve 62669c5e993acb4bf7dc354ade0f5fea5db72f52 as an ancestor"
      - "make only the narrow correction described by OM-ACC-005"
      - "commit and push to feature/account-management-portal"
      - "leave PR #21 draft"
    cloudflare_actions_authorized:
      scope: "non-production preview only"
      pages_project: "open-marketplace-demo"
      preview_database: "open-marketplace-account-preview-d1"
      allowed:
        - "apply only a forward preview migration if the corrected data model actually requires one"
        - "redeploy the feature branch preview"
        - "probe the HTTPS preview and relevant account/profile APIs"
      forbidden:
        - "apply migrations to production D1"
        - "modify production account data"
        - "change the production URL"
        - "write secrets to Git/shared memory/handoffs"
    verification_required:
      - "record canonical main commit and cited shared-memory paths before edits"
      - "git diff --check"
      - "npm run lint"
      - "npm test"
      - "tests prove the exact launch payment set is PayPal, Venmo, Cash App, BTC, ETH, USDT, BNB, and USDC"
      - "tests prove Solana, Zelle, Apple Pay, Stripe, Plaid, unsupported networks, and unsafe secret-looking values are rejected/not shown"
      - "tests prove each crypto destination has the expected explicit network id/label"
      - "tests prove save/reload/remove persistence for corrected payment destinations"
      - "tests prove one account cannot read or mutate another account's settings"
      - "tests prove Facebook/Instagram/TikTok persistence and self-reported status remain unchanged"
      - "tests prove listing publication remains session-owned and saved profile social defaults still work"
      - "branch Pages workflow succeeds on the returned exact head"
      - "owner-reachable HTTPS preview shows corrected payment labels and networks"
      - "production D1 remains without account migrations and production URL remains unchanged"
    owner_manual_checklist_after_architect_review:
      - "Sign in and open Account settings on the HTTPS preview."
      - "Confirm Facebook, Instagram, and TikTok are still present."
      - "Confirm Payment options shows PayPal, Venmo, Cash App, Bitcoin, Ethereum, Tether (USDT), BNB, and USDC; Solana should not appear."
      - "Confirm every crypto option visibly names its network: Bitcoin Mainnet; Ethereum Mainnet; USDT Ethereum/ERC-20; BNB Smart Chain Mainnet; USDC Ethereum/ERC-20."
      - "Use only non-sensitive test/public destinations to add, edit, remove, save, reload, and confirm persistence."
      - "Confirm a different account cannot edit the first account's settings and listing seller identity remains the signed-in account."
      - "Report pass/fail to Codex in ordinary language."
    forbidden_actions:
      - "modify working social semantics outside what is required for compatibility"
      - "re-rank crypto assets dynamically at runtime"
      - "add extra crypto assets or networks"
      - "merge PR #21"
      - "deploy account changes to production"
      - "apply production D1 migrations"
      - "store private financial/authentication material"
      - "mark human owner functional test pass"
    completion_contract:
      subagent_status: "ready_for_review_or_blocked"
      handoff_required: true
      shared_memory_refs_required: true
      exact_head_and_workflow_evidence_required: true
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
