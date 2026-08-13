---
schema_version: "1.6"
document_id: "OM-STATE-001"
kind: "project_state"
updated_at: "2026-08-13T02:30:00Z"
updated_by: "codex_architect"
repository:
  name: "PeterJFrancoIII/Open-Marketplace"
  default_branch: "main"
  state_basis_commit: "8e6e6f66f4b1cbd55d8720d1c75b83f4c05bc11b"
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
  manual_functional_preview_gate: "active"
  owner_reachable_preview_gate: "active"
  cursor_shared_memory_citation_gate: "active"
  cursor_dispatch_protocol: "Codex writes and assigns a canonical task, then tells the human owner 'handoff to cursor'; the human owner invokes Cursor"
active_changes:
  - id: "OM-ACC-002"
    branch: "feature/account-management-portal"
    current_head: "62669c5e993acb4bf7dc354ade0f5fea5db72f52"
    pull_request: 21
    pull_request_state: "draft"
    state: "blocked"
    review_stage: "payment_settings_correction_required_before_owner_test"
    purpose: "account/admin portal with server-side authentication and owner-managed social/payment settings"
    owner_preview:
      url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
      environment: "non_production"
      pages_project: "open-marketplace-demo"
      preview_database: "open-marketplace-account-preview-d1"
    owner_manual_result: "not_run_after_payment_architect_correction"
    acceptance_blocker: "OM-ACC-005 then human_owner_functional_pass"
  - id: "OM-DEP-001"
    branch: "feature/account-management-portal"
    current_head: "62669c5e993acb4bf7dc354ade0f5fea5db72f52"
    pull_request: 21
    state: "ready_for_review"
    review_stage: "owner_test_deferred_until_OM-ACC-005"
    purpose: "owner-reachable non-production HTTPS preview for PR #21"
    latest_branch_ci: {head: "62669c5e993acb4bf7dc354ade0f5fea5db72f52", workflow: "Deploy to Cloudflare Pages", run_id: 31660568138, result: "success"}
    preview_url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
    latest_reviewed_deployment_url: "https://95c543a4.open-marketplace-demo.pages.dev/"
    owner_manual_result: "not_run_after_OM-ACC-005"
  - id: "OM-ACC-004"
    branch: "feature/account-management-portal"
    implementation_head: "c4247d52813eda683cc55db4d777f67294a8195e"
    handoff_head: "62669c5e993acb4bf7dc354ade0f5fea5db72f52"
    pull_request: 21
    state: "changes_requested"
    review_stage: "architect_review_failed_payment_definition"
    purpose: "persistent social-media and recovered owner payment settings"
    handoff: "agent-memory/handoffs/2026-08-13--OM-ACC-004--cursor-grok-4-6.md"
    passed_review_surfaces:
      - "Facebook/Instagram/TikTok settings are persistent and session-owned"
      - "social links remain self-reported and link health is not identity verification"
      - "session-derived listing seller identity remains intact"
      - "27-test suite reported passing"
      - "implementation and latest branch Cloudflare Pages workflows succeeded"
      - "preview D1 only was migrated; production account D1 migration remains absent"
    changes_requested:
      - "replace stale fifth crypto Solana with current snapshot #5 USDC"
      - "bind each crypto asset to an explicit network so stablecoin destinations are not ambiguous"
  - id: "OM-ACC-005"
    branch: "feature/account-management-portal"
    pull_request: 21
    state: "assigned"
    review_stage: "implementation"
    purpose: "correct top-five crypto snapshot and explicit crypto-network semantics while preserving OM-ACC-004 social/account behavior"
    required_feature_head_ancestor: "62669c5e993acb4bf7dc354ade0f5fea5db72f52"
    launch_crypto_snapshot:
      date_utc: "2026-08-13"
      assets: ["BTC", "ETH", "USDT", "BNB", "USDC"]
      networks:
        BTC: "Bitcoin Mainnet"
        ETH: "Ethereum Mainnet"
        USDT: "Ethereum Mainnet (ERC-20)"
        BNB: "BNB Smart Chain Mainnet"
        USDC: "Ethereum Mainnet (ERC-20)"
    preview_requirement: "update the existing owner-reachable non-production Cloudflare Pages preview"
    owner_manual_result: "not_run"
queued_architecture:
  - id: "OM-ACC-003"
    purpose: "Codex design for two-factor authentication before any Cursor implementation"
    state: "backlog"
  - id: "OM-DEP-002"
    purpose: "Harden reusable Pages preview configuration against future production-setting drift"
    state: "backlog"
known_blockers:
  - {id: "OM-BLOCK-001", scope: "main", description: "Standard npm test wrapper requires GNU timeout on this Mac; PR #21 contains a portable correction."}
  - {id: "OM-BLOCK-002", scope: "main", description: "Main rendered HTML test contains the retired Open Exchange assertion; PR #21 contains a correction."}
  - {id: "OM-BLOCK-003", scope: "account_portal_production", description: "Production D1 migration, DB binding, authentication secret, admin allowlist, email verification delivery, password reset delivery, 2FA architecture, and production acceptance are not confirmed."}
  - {id: "OM-BLOCK-005", scope: "account_settings", description: "Original account settings omitted required social/payment settings; OM-ACC-004 added them but requires payment-definition correction before owner acceptance."}
  - {id: "OM-BLOCK-006", scope: "payment_settings", description: "OM-ACC-004 used Solana instead of current market-cap #5 USDC and stored multi-network crypto destinations without explicit network binding; OM-ACC-005 is assigned remediation."}
resolved_blockers:
  - {id: "OM-BLOCK-004", scope: "owner_preview", resolution: "Agent-only localhost rejected; persistent Cloudflare Pages branch-preview URL supplied for owner test."}
next_cursor_task: "OM-ACC-005"
next_architect_action: "Wait for OM-ACC-005 handoff. Review exact branch head, corrected payment set/network semantics, automated tests, production isolation, branch CI, and owner-reachable HTTPS preview. If the correction passes architect review, present the HTTPS preview to the human owner for manual functional pass/fail. Do not accept OM-ACC-002, merge PR #21, or deploy production before that pass and explicit release approval."
---

# Current Project State

OM-ACC-004 successfully added the requested social-settings framework and session-owned profile persistence, but its payment definition did not pass architect review. OM-ACC-005 is assigned to replace Solana with the verified launch-snapshot #5 asset USDC and to bind all crypto destinations to explicit networks. PR #21 remains draft and production remains unchanged.
