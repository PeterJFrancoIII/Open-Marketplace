---
schema_version: "1.8"
document_id: "OM-STATE-001"
kind: "project_state"
updated_at: "2026-08-13T02:47:00Z"
updated_by: "codex_architect"
repository:
  name: "PeterJFrancoIII/Open-Marketplace"
  default_branch: "main"
  state_basis_commit: "99a7a359dc9925a80e8e5ced0b10d622026e0b79"
production:
  provider: "Cloudflare Pages"
  project: "open-marketplace-demo"
  url: "https://open-marketplace-demo.pages.dev"
  account_portal_released: false
  account_schema_applied_to_production: false
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
  - id: "OM-ACC-002"
    branch: "feature/account-management-portal"
    current_head: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"
    pull_request: 21
    pull_request_state: "draft"
    state: "ready_for_review"
    review_stage: "awaiting_human_owner_functional_test"
    purpose: "account/admin portal with server-side authentication and owner-managed manual social/payment settings"
    architect_review: "passed_for_owner_test"
    latest_branch_ci: {head: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c", workflow: "Deploy to Cloudflare Pages", run_id: 31661766350, result: "success"}
    owner_preview:
      url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
      deployment_url: "https://760b2b84.open-marketplace-demo.pages.dev/"
      environment: "non_production"
      pages_project: "open-marketplace-demo"
      preview_database: "open-marketplace-account-preview-d1"
    owner_manual_result: "not_run_on_current_https_preview"
    acceptance_blocker: "human_owner_functional_pass"
  - id: "OM-DEP-001"
    branch: "feature/account-management-portal"
    current_head: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"
    pull_request: 21
    state: "ready_for_review"
    review_stage: "awaiting_human_owner_functional_test"
    purpose: "owner-reachable non-production HTTPS preview for PR #21"
    latest_branch_ci: {head: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c", workflow: "Deploy to Cloudflare Pages", run_id: 31661766350, result: "success"}
    preview_url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
    latest_reviewed_deployment_url: "https://760b2b84.open-marketplace-demo.pages.dev/"
    owner_manual_result: "not_run_on_current_https_preview"
  - id: "OM-ACC-004"
    branch: "feature/account-management-portal"
    implementation_head: "c4247d52813eda683cc55db4d777f67294a8195e"
    correction_head: "85a1102c4bc8a40c84be1a5416d23a582bc41846"
    current_head: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"
    pull_request: 21
    state: "ready_for_review"
    review_stage: "corrected_by_OM-ACC-005_awaiting_owner_test"
    purpose: "persistent Facebook/Instagram/TikTok URLs and manual public payment destinations"
    architect_review: "passed_for_owner_test_after_OM-ACC-005"
    owner_manual_result: "not_run_on_corrected_preview"
  - id: "OM-ACC-005"
    branch: "feature/account-management-portal"
    implementation_head: "85a1102c4bc8a40c84be1a5416d23a582bc41846"
    current_head: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c"
    pull_request: 21
    state: "ready_for_review"
    review_stage: "awaiting_human_owner_functional_test"
    purpose: "frozen top-five crypto payment set with explicit receive networks while preserving account/social behavior"
    architect_review: "passed_for_owner_test"
    handoff: "agent-memory/handoffs/2026-08-13--OM-ACC-005--cursor-grok-4-6.md"
    launch_payment_set:
      fiat: ["PayPal", "Venmo", "Cash App"]
      crypto: ["Bitcoin / Bitcoin Mainnet", "Ethereum / Ethereum Mainnet", "Tether (USDT) / Ethereum Mainnet (ERC-20)", "BNB / BNB Smart Chain Mainnet", "USDC / Ethereum Mainnet (ERC-20)"]
      excluded: ["Solana", "Zelle", "Apple Pay", "Stripe", "Plaid"]
    latest_branch_ci: {head: "bec794fe9589a4ae15fe71ddb2e463d98eaca78c", workflow: "Deploy to Cloudflare Pages", run_id: 31661766350, result: "success"}
    preview_url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
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
    scope: "Social and payment OAuth/provider Connect flows are not part of OM-ACC-004/005. Current UI uses manual public URLs/handles/addresses. Absence of Connect Facebook/PayPal/etc. controls is not a defect in the current acceptance gate. Create architecture/task only after an explicit human-owner request specifying providers and social/payment scope."
known_blockers:
  - {id: "OM-BLOCK-001", scope: "main", description: "Standard npm test wrapper requires GNU timeout on this Mac; PR #21 contains a portable correction."}
  - {id: "OM-BLOCK-002", scope: "main", description: "Main rendered HTML test contains the retired Open Exchange assertion; PR #21 contains a correction."}
  - {id: "OM-BLOCK-003", scope: "account_portal_production", description: "Production D1 migration, DB binding, authentication secret, admin allowlist, email verification delivery, password reset delivery, 2FA architecture, and production acceptance are not confirmed."}
resolved_blockers:
  - {id: "OM-BLOCK-004", scope: "owner_preview", resolution: "Agent-only localhost rejected; persistent Cloudflare Pages branch-preview URL supplied for owner test."}
  - {id: "OM-BLOCK-005", scope: "account_settings", resolution: "Required manual social/payment settings were implemented in OM-ACC-004 and corrected by OM-ACC-005; final validation is the human owner functional test."}
  - {id: "OM-BLOCK-006", scope: "payment_settings", resolution: "Solana was replaced by USDC and crypto destinations were bound to explicit launch networks in OM-ACC-005; architect review passed for owner testing."}
next_cursor_task: null
next_architect_action: "Wait for the human owner to test https://feature-account-management-p.open-marketplace-demo.pages.dev/ and report pass/fail on the current manual social/payment settings. OAuth Connect controls are out of scope and should not be treated as a failure unless the human owner explicitly changes the product requirement. Do not accept OM-ACC-002, merge PR #21, deploy production, or assign OM-FUL-001 before the account-preview owner gate is resolved."
---

# Current Project State

OM-ACC-005 passed Codex architect review. PR #21 remains draft at `bec794fe9589a4ae15fe71ddb2e463d98eaca78c`, the current Cloudflare Pages branch workflow passed, and the persistent HTTPS preview is ready for the human owner's functional test. Account settings intentionally use manual public social URLs and payment destinations; OAuth provider-connect flows remain unassigned and are not part of the current pass/fail gate. Production remains unchanged.
