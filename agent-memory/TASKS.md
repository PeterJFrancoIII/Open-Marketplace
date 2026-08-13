---
schema_version: "1.8"
document_id: "OM-TASKS-001"
kind: "task_registry"
updated_at: "2026-08-13T02:51:00Z"
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
    review_stage: "owner_expanded_manual_payment_set_requires_OM-ACC-006"
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
    depends_on: ["OM-ACC-001", "OM-DEP-001", "OM-ACC-004", "OM-ACC-005", "OM-ACC-006"]
    architect_review:
      prior_scope_status: "passed_for_owner_test"
      reviewed_branch_tip: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"
      latest_branch_workflow: {run_id: 31661766350, result: "success", head: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"}
    owner_required_launch_sets:
      social_profiles: ["Facebook", "Instagram", "TikTok"]
      manual_payment_methods: ["PayPal", "Venmo", "Cash App", "Zelle", "Apple Cash"]
      crypto: ["Bitcoin / Bitcoin Mainnet", "Ethereum / Ethereum Mainnet", "Tether (USDT) / Ethereum Mainnet (ERC-20)", "BNB / BNB Smart Chain Mainnet", "USDC / Ethereum Mainnet (ERC-20)"]
      oauth_provider_connect: false
    owner_preview:
      url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
      environment: "non_production"
      pages_project: "open-marketplace-demo"
      preview_database: "open-marketplace-account-preview-d1"
    owner_manual_result: "not_run_after_manual_payment_set_expansion"
    prior_owner_results: ["failed_preview_unreachable", "failed_missing_required_settings"]
    acceptance_blocker: "OM-ACC-006 then human_owner_functional_pass"
    oauth_scope_note: "Current acceptance scope remains paste-and-save public fields. OAuth/provider Connect buttons are not implemented and their absence is not a defect."
    forbidden_actions: ["merge PR #21 before human functional pass", "deploy account portal to production", "mark owner manual test as pass"]
  - id: "OM-DEP-001"
    title: "Deliver owner-reachable non-production account portal preview"
    workstream: "OM-DEP"
    status: "ready_for_review"
    review_stage: "owner_test_deferred_until_OM-ACC-006"
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
    owner_manual_result: "not_run_after_OM-ACC-006"
    acceptance_blocker: "OM-ACC-006 then human_owner_functional_pass"
    architecture_note: "The preview helper still requires separate OM-DEP-002 hardening before it is generalized as reusable infrastructure."
    forbidden_actions: ["merge PR #21 before human functional pass", "change production URL", "apply account migrations to production D1", "mark owner manual test as pass"]
  - id: "OM-ACC-004"
    title: "Add persistent social-media and owner-specified payment-link settings"
    workstream: "OM-ACC"
    status: "ready_for_review"
    review_stage: "social_and_base_payment_component_preserved"
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
    architect_review: {social_settings: "pass", session_owned_profile_mutation: "pass", social_self_reported_boundary: "pass", payment_definition: "corrected_by_OM-ACC-005"}
    owner_manual_result: "not_run_after_OM-ACC-006"
    acceptance_blocker: "OM-ACC-006 then human_owner_functional_pass"
    forbidden_actions: ["merge PR #21 before human functional pass", "deploy to production", "apply production D1 migrations"]
  - id: "OM-ACC-005"
    title: "Correct top-five crypto rails and bind every crypto destination to an explicit network"
    workstream: "OM-ACC"
    status: "ready_for_review"
    review_stage: "crypto_component_passed_architect_review"
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
    architect_payment_contract:
      manual_payment_methods_at_review: ["PayPal", "Venmo", "Cash App"]
      crypto_snapshot:
        snapshot_date_utc: "2026-08-13"
        assets:
          - {asset: "BTC", label: "Bitcoin", network_id: "bitcoin_mainnet", network_label: "Bitcoin Mainnet"}
          - {asset: "ETH", label: "Ethereum", network_id: "ethereum_mainnet", network_label: "Ethereum Mainnet"}
          - {asset: "USDT", label: "Tether (USDT)", network_id: "usdt_ethereum", network_label: "Ethereum Mainnet (ERC-20)"}
          - {asset: "BNB", label: "BNB", network_id: "bnb_bsc", network_label: "BNB Smart Chain Mainnet"}
          - {asset: "USDC", label: "USDC", network_id: "usdc_ethereum", network_label: "Ethereum Mainnet (ERC-20)"}
        removed_from_launch_allowlist: ["Solana"]
    verification:
      - "git diff --check passed"
      - "npm run lint passed"
      - "npm test passed: 27 tests, 0 failed"
      - "implementation workflow run 31661669792 passed at 85a1102c4bc8a40c84be1a5416d23a582bc41846"
      - "latest branch workflow run 31661766350 passed at bec794fe9589a4ae15fe71ddb2e463d98eaca78c"
      - "preview API persisted PayPal plus USDC on Ethereum Mainnet and rejected Solana"
      - "production D1 still contains only _cf_KV; account migrations were not applied"
    architect_review:
      status: "passed_for_owner_test_before_OM-ACC-006_scope_expansion"
      reviewed_implementation_commit: "85a1102c4bc8a40c84be1a5416d23a582bc41846"
      reviewed_branch_tip: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"
      social_settings_preserved: true
      production_isolation_preserved: true
      oauth_connect_controls_in_scope: false
    owner_scope_expansion_after_review: "OM-ACC-006 adds Zelle and Apple Cash as manual payment methods; OM-ACC-005 crypto semantics remain unchanged."
    owner_manual_result: "not_run_after_OM-ACC-006"
    forbidden_actions: ["merge PR #21 before human functional pass", "deploy account changes to production", "apply production D1 migrations", "store private financial/authentication material", "mark human owner functional test pass"]
  - id: "OM-ACC-006"
    title: "Complete five manual payment methods with Zelle and Apple Cash"
    workstream: "OM-ACC"
    status: "assigned"
    review_stage: "implementation"
    owner_role: "codex_architect_admin"
    assigned_agent: "cursor_implementation_subagent"
    supports_task: "OM-ACC-002"
    branch: "feature/account-management-portal"
    pull_request: 21
    shared_memory_ref: "main"
    required_feature_head_ancestor: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"
    depends_on: ["OM-ACC-005"]
    owner_requirement_source: "Human owner handoff to Main at 2026-08-13T02:51:00Z explicitly requires top 3 social profiles, top 5 manual payment methods, and the existing top 5 crypto rails; OAuth remains out of scope."
    objective: "Preserve the working Facebook/Instagram/TikTok and BTC/ETH/USDT/BNB/USDC account settings, and add the two missing paste-and-save public payment methods Zelle and Apple Cash so the manual payment-method set is exactly PayPal, Venmo, Cash App, Zelle, and Apple Cash."
    required_shared_memory_paths: ["Master_Descriptor.md", "AGENTS.md", "agent-memory/README.md", "agent-memory/STATE.md", "agent-memory/TASKS.md", "agent-memory/DECISIONS.md"]
    exact_launch_sets:
      social_profiles: ["Facebook", "Instagram", "TikTok"]
      manual_payment_methods:
        - {id: "paypal", label: "PayPal"}
        - {id: "venmo", label: "Venmo"}
        - {id: "cashapp", label: "Cash App"}
        - {id: "zelle", label: "Zelle"}
        - {id: "apple_cash", label: "Apple Cash"}
      crypto:
        - {id: "bitcoin_mainnet", asset: "BTC", label: "Bitcoin", network_label: "Bitcoin Mainnet"}
        - {id: "ethereum_mainnet", asset: "ETH", label: "Ethereum", network_label: "Ethereum Mainnet"}
        - {id: "usdt_ethereum", asset: "USDT", label: "Tether (USDT)", network_label: "Ethereum Mainnet (ERC-20)"}
        - {id: "bnb_bsc", asset: "BNB", label: "BNB", network_label: "BNB Smart Chain Mainnet"}
        - {id: "usdc_ethereum", asset: "USDC", label: "USDC", network_label: "Ethereum Mainnet (ERC-20)"}
    public_identifier_contract:
      zelle:
        accepted: ["email address manually entered by the user", "U.S. mobile number manually entered by the user"]
        normalization: "Lowercase email; normalize a valid U.S. mobile number to +1XXXXXXXXXX after stripping common formatting."
        provider_fact_basis: "Official Zelle guidance says recipients use an enrolled email address or U.S. mobile number."
      apple_cash:
        accepted: ["email address manually entered by the user", "U.S. mobile number manually entered by the user"]
        normalization: "Lowercase email; normalize a valid U.S. mobile number to +1XXXXXXXXXX after stripping common formatting."
        provider_fact_basis: "Official Apple Cash guidance uses person/contact selection and transaction records can identify a person by name, phone number, or email; this marketplace stores only the manually supplied phone/email contact, not Apple credentials."
      privacy_and_safety:
        - "Never auto-fill Zelle or Apple Cash from the account login email, a private phone number, contacts, device address book, or another profile field. The user must deliberately type the public destination."
        - "Label these fields as public payment contact information and warn that saved values can be exposed anywhere the marketplace currently exposes public payment destinations."
        - "Do not claim the marketplace or provider verified that the contact is enrolled, belongs to the seller, or is safe to pay."
        - "Show a concise P2P warning: confirm the recipient independently before sending; the marketplace does not execute, insure, escrow, reverse, or protect the transfer."
        - "Do not store bank details, debit/card numbers, bank usernames/passwords, Apple Account credentials, access tokens, private keys, seed phrases, or other secrets."
    implementation_requirements:
      - "Extend the existing payment-destination model and UI; do not create a second competing profile-payment model."
      - "Keep the five crypto rails and network labels from OM-ACC-005 unchanged."
      - "Keep Facebook/Instagram/TikTok persistence, self-reported status, social link-health behavior, and listing social defaults unchanged."
      - "Keep profile mutation session-owned and listing seller identity derived from the authenticated server session."
      - "Zelle and Apple Cash are manual public contact destinations only. Do not call provider APIs, inspect banking apps, verify enrollment, initiate payments, generate checkout, or add OAuth."
      - "Reject malformed email/phone inputs, non-U.S. phone numbers for these two rails, secret-looking values, unsafe URL schemes, and duplicate rail entries."
      - "No SQL migration is expected because payment_destinations_json already exists; if a migration becomes necessary, stop and explain why before applying anything beyond the dedicated preview D1."
    allowed_paths: ["app/account/**", "app/api/account/profile/**", "app/api/listings/**", "lib/payment-destinations.ts", "lib/types.ts", "tests/**", "README.md", "CURSOR_START_HERE.md", "ARCHITECTURE.md", "agent-memory/handoffs/**"]
    repository_actions:
      - "fetch canonical main immediately before work and record the observed commit"
      - "merge/rebase current main into feature/account-management-portal without weakening canonical governance"
      - "preserve bec794fe9589a4ae15fe71ddb2e463d98eaca78c as an ancestor"
      - "make only the narrow OM-ACC-006 payment-method extension"
      - "commit and push to feature/account-management-portal"
      - "leave PR #21 draft"
    cloudflare_actions_authorized:
      scope: "non-production preview only"
      pages_project: "open-marketplace-demo"
      preview_database: "open-marketplace-account-preview-d1"
      allowed: ["redeploy the feature branch preview", "probe the HTTPS preview and relevant account/profile APIs"]
      forbidden: ["apply migrations to production D1", "modify production account data", "change the production URL", "write secrets to Git/shared memory/handoffs"]
    verification_required:
      - "record canonical main commit and cited shared-memory paths before edits"
      - "git diff --check"
      - "npm run lint"
      - "npm test"
      - "tests prove manual payment methods are exactly PayPal, Venmo, Cash App, Zelle, and Apple Cash"
      - "tests prove the existing five crypto rails/network labels remain exactly BTC/ETH/USDT/BNB/USDC as defined by OM-ACC-005"
      - "tests prove Facebook/Instagram/TikTok behavior remains unchanged"
      - "tests prove valid Zelle and Apple Cash email/U.S.-mobile inputs save, reload, edit, and remove"
      - "tests prove malformed/non-U.S. phone numbers and secret-looking Zelle/Apple Cash inputs fail closed"
      - "tests prove private account login email/phone is never auto-copied into either public payment field"
      - "tests prove one account cannot read private settings or mutate another account's profile"
      - "tests prove listing publication remains session-owned"
      - "branch Pages workflow succeeds on the exact returned branch tip"
      - "owner-reachable HTTPS preview visibly contains 3 social profiles, 5 manual payment methods, and 5 crypto rails"
      - "production D1 remains without account migrations and production URL remains unchanged"
    owner_manual_checklist:
      - "Sign in and open Account settings on the HTTPS preview."
      - "Confirm Social media has Facebook, Instagram, and TikTok."
      - "Confirm manual Payment methods has exactly PayPal, Venmo, Cash App, Zelle, and Apple Cash."
      - "Confirm Crypto still has Bitcoin, Ethereum, Tether (USDT), BNB, and USDC with the existing named networks."
      - "Confirm Zelle and Apple Cash explain that the email/phone entered is public contact information and are not automatically filled from your login."
      - "Using only non-sensitive test contact information, add/save/reload/edit/remove Zelle and Apple Cash values."
      - "Confirm the page warns you to verify the recipient before a peer-to-peer transfer and does not present these methods as marketplace checkout or protected payment."
      - "Do not fail this task merely because OAuth Connect buttons are absent; OAuth remains out of scope."
      - "Report pass/fail to Codex in ordinary language."
    forbidden_actions:
      - "add OAuth/provider Connect flows"
      - "add Apple Pay instead of Apple Cash"
      - "change the five crypto assets or their networks"
      - "auto-populate public payment contact fields from private authentication/profile contact data"
      - "store or log private financial/authentication material"
      - "merge PR #21"
      - "deploy account changes to production"
      - "apply production D1 migrations"
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
