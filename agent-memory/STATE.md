---
schema_version: "1.10"
document_id: "OM-STATE-001"
kind: "project_state"
updated_at: "2026-08-18T23:10:00Z"
updated_by: "human_owner_via_cursor"
repository:
  name: "PeterJFrancoIII/Open-Marketplace"
  default_branch: "main"
  state_basis_commit: "3c771d0d39ae3819db1b5af5b317b996af597db2"
production:
  provider: "Cloudflare Pages"
  project: "open-marketplace-demo"
  url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
  retired_public_url: "https://open-marketplace-demo.pages.dev"
  live_commit: "a4a78df3f3573f7d5d25a19f046a28503c9931fd"
  live_bookmark_url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
  account_portal_released: false
  account_schema_applied_to_production: false
development:
  branch: "feature/community-surface-reports"
  current_head: "90280c1d223a24d7ff069391647bbeab7fe9adc4"
  preview_url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/"
  purpose: "Community surface reports and later accepted experiments"
  must_not_overwrite_live: true
governance:
  pull_request: 22
  state: "merged"
  merge_commit: "b7c634829210cf2e386129058710a98a1db26663"
  operating_model: "human_owner > codex_architect_admin > cursor_implementation_subagent"
  owner_operator_mode: "ui_only_non_coding"
  agent_support_requirement: "Do not require the human owner to edit code, run terminal commands, or operate Git. Owner acceptance is performed through reachable UI and plain-language pass/fail reporting."
  manual_functional_preview_gate: "active"
  owner_reachable_preview_gate: "active"
  cursor_shared_memory_citation_gate: "active"
  cursor_dispatch_protocol: "Codex writes and assigns a canonical task, then tells the human owner 'handoff to cursor'; the human owner invokes Cursor"
active_changes:
  - id: "OM-CROWD-001"
    branch: "feature/community-surface-reports"
    current_head: "uncommitted"
    state: "in_progress"
    purpose: "Per-surface community bug and feature reports with daily digest and administrator-only security filter"
    owner_manual_result: "not_run"
  - id: "OM-ACC-002"
    branch: "feature/account-management-portal"
    current_head: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"
    pull_request: 21
    pull_request_state: "draft"
    state: "blocked"
    review_stage: "owner_expanded_manual_payment_set_requires_OM-ACC-006"
    purpose: "account/admin portal with server-side authentication and owner-managed manual social/payment settings"
    prior_architect_review: "passed_for_owner_test_before_owner_payment-set_expansion"
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
    acceptance_blocker: "OM-ACC-006 then human_owner_functional_pass"
  - id: "OM-DEP-001"
    branch: "feature/account-management-portal"
    current_head: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"
    pull_request: 21
    state: "ready_for_review"
    review_stage: "owner_test_deferred_until_OM-ACC-006"
    purpose: "owner-reachable non-production HTTPS preview for PR #21"
    latest_branch_ci: {head: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c", workflow: "Deploy to Cloudflare Pages", run_id: 31661766350, result: "success"}
    preview_url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
    latest_reviewed_deployment_url: "https://760b2b84.open-marketplace-demo.pages.dev/"
    owner_manual_result: "not_run_after_OM-ACC-006"
  - id: "OM-ACC-004"
    branch: "feature/account-management-portal"
    implementation_head: "c4247d52813eda683cc55db4d777f67294a8195e"
    correction_head: "85a1102c4bc8a40c84be1a5416d23a582bc41846"
    current_head: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"
    pull_request: 21
    state: "ready_for_review"
    review_stage: "component_preserved_pending_OM-ACC-006"
    purpose: "persistent Facebook/Instagram/TikTok URLs and manual public payment destinations"
    architect_review: "social/account component passed; payment set now expanded by owner"
    owner_manual_result: "not_run_after_OM-ACC-006"
  - id: "OM-ACC-005"
    branch: "feature/account-management-portal"
    implementation_head: "85a1102c4bc8a40c84be1a5416d23a582bc41846"
    current_head: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"
    pull_request: 21
    state: "ready_for_review"
    review_stage: "crypto_component_passed_architect_review"
    purpose: "frozen top-five crypto payment set with explicit receive networks while preserving account/social behavior"
    architect_review: "passed_for_owner_test_before_OM-ACC-006_scope_expansion"
    launch_crypto_set: ["Bitcoin / Bitcoin Mainnet", "Ethereum / Ethereum Mainnet", "Tether (USDT) / Ethereum Mainnet (ERC-20)", "BNB / BNB Smart Chain Mainnet", "USDC / Ethereum Mainnet (ERC-20)"]
    handoff: "agent-memory/handoffs/2026-08-13--OM-ACC-005--cursor-grok-4-6.md"
    owner_manual_result: "not_run_after_OM-ACC-006"
  - id: "OM-ACC-006"
    branch: "feature/account-management-portal"
    pull_request: 21
    state: "assigned"
    review_stage: "implementation"
    purpose: "add Zelle and Apple Cash manual public destinations so the payment-method set is exactly PayPal, Venmo, Cash App, Zelle, and Apple Cash while preserving the existing five crypto rails"
    required_feature_head_ancestor: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"
    owner_requirement_source: "Human owner handoff at 2026-08-13T02:51:00Z"
    public_identifier_rules:
      Zelle: "manually entered email or U.S. mobile number; never auto-fill private login contact data"
      Apple_Cash: "manually entered email or U.S. mobile number; never auto-fill private login contact data"
    safety_boundary: "These are public P2P contact destinations only. No provider verification, payment execution, escrow, reversal, protection claim, OAuth, or checkout. UI must warn users to confirm the recipient independently."
    preview_requirement: "update the existing owner-reachable non-production Cloudflare Pages preview"
    owner_manual_result: "not_run"
queued_architecture:
  - id: "OM-FUL-001"
    purpose: "Implement owner-defined listing handling time, shipping tracking-proof evidence, and prepayment video-chat guidance from OM-DEC-011 through OM-DEC-013."
    state: "backlog"
    sequencing: "Do not assign until the account-preview owner gate is resolved."
    product_contract:
      handling_time: "same_day | 1_day | 2_days | 3_days; max 3 days; visible on listing; means ready to ship or pickup"
      tracking_proof: "shipping only; seller uploads photo/screenshot; bytes remain browser-local; registry stores hash plus optional public tracking number; no live carrier tracker"
      prepayment_video_chat: "encouraged before money moves; external/user-arranged; no built-in room; no video-verified badge; no in-app checkout"
  - id: "OM-ACC-003"
    purpose: "Codex design for two-factor authentication before any Cursor implementation"
    state: "backlog"
  - id: "OM-DEP-002"
    purpose: "Harden reusable Pages preview configuration against future production-setting drift"
    state: "backlog"
deferred_capabilities:
  - id: "oauth_provider_linking"
    status: "unassigned"
    scope: "Social and payment OAuth/provider Connect flows remain outside OM-ACC-004/005/006. Current launch requirement is manual public URLs/handles/addresses/contact identifiers only."
known_blockers:
  - {id: "OM-BLOCK-001", scope: "main", description: "Standard npm test wrapper requires GNU timeout on this Mac; PR #21 contains a portable correction."}
  - {id: "OM-BLOCK-002", scope: "main", description: "Main rendered HTML test contains the retired Open Exchange assertion; PR #21 contains a correction."}
  - {id: "OM-BLOCK-003", scope: "account_portal_production", description: "Production D1 migration, DB binding, authentication secret, admin allowlist, email verification delivery, password reset delivery, 2FA architecture, and production acceptance are not confirmed."}
  - {id: "OM-BLOCK-007", scope: "manual_payment_methods", description: "Owner requires five manual payment methods; current preview has only PayPal, Venmo, and Cash App. Zelle and Apple Cash are assigned in OM-ACC-006."}
resolved_blockers:
  - {id: "OM-BLOCK-004", scope: "owner_preview", resolution: "Agent-only localhost rejected; persistent Cloudflare Pages branch-preview URL supplied for owner test."}
  - {id: "OM-BLOCK-005", scope: "account_settings", resolution: "Required manual social/profile settings and base payment settings were implemented; final account acceptance now includes OM-ACC-006."}
  - {id: "OM-BLOCK-006", scope: "crypto_payment_settings", resolution: "Solana was replaced by USDC and crypto destinations were bound to explicit launch networks in OM-ACC-005; architect review passed for that component."}
next_cursor_task: "OM-CROWD-001"
next_architect_action: "Wait for OM-ACC-006 handoff. Review exact five manual payment methods, Zelle/Apple Cash public-contact validation and privacy warning, unchanged social/crypto behavior, automated tests, production isolation, branch CI, and the updated owner-reachable HTTPS preview. If review passes, present the preview to the human owner for manual functional pass/fail. Do not accept OM-ACC-002, merge PR #21, deploy production, or assign OM-FUL-001 before that gate is resolved."
---

# Current Project State

The human owner expanded the account-settings launch requirement to exactly three social profiles, five manual payment methods, and five crypto rails. The current preview already satisfies the social and crypto sets but has only three of the five manual payment methods. OM-ACC-006 is assigned to add Zelle and Apple Cash as deliberately entered public email/U.S.-mobile contact destinations, with no OAuth or checkout. PR #21 remains draft and production remains unchanged.
