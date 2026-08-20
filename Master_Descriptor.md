---
schema_version: "1.3"
document:
  id: "OM-MASTER-001"
  kind: "project_master_descriptor"
  canonical: true
  status: "active"
  updated_at: "2026-08-18T23:10:00Z"
  updated_by: "human_owner_via_cursor"
project:
  id: "open-marketplace"
  name: "Open Marketplace"
  repository: "PeterJFrancoIII/Open-Marketplace"
  repository_url: "https://github.com/PeterJFrancoIII/Open-Marketplace"
  default_branch: "main"
  production_branch: "main"
  production_url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
  retired_public_url: "https://open-marketplace-demo.pages.dev"
authority:
  - rank: 1
    role: "human_owner"
    responsibility: "final product, functional acceptance, merge, and production authority"
  - rank: 2
    role: "codex_architect_admin"
    responsibility: "architecture, machine-readable contracts, task assignment, review, integration, and administration"
  - rank: 3
    role: "cursor_implementation_subagent"
    responsibility: "execute only assigned work packages and return evidence"
source_precedence:
  - "human_owner_instruction"
  - "Master_Descriptor.md"
  - "GOVERNANCE.md"
  - "agent-memory/DECISIONS.md"
  - "agent-memory/STATE.md"
  - "agent-memory/TASKS.md"
  - "agent-memory/handoffs/<task-record>.md"
  - "CURSOR_START_HERE.md"
  - "README.md"
  - "ARCHITECTURE.md"
  - "POLICY.md"
status_vocabulary:
  task: ["backlog", "blocked", "assigned", "in_progress", "ready_for_review", "accepted", "cancelled"]
  workstream: ["specified", "framework_required", "reference_implementation", "preview_validation", "production_ready", "released"]
current_repository_state:
  state_basis_commit: "b7c634829210cf2e386129058710a98a1db26663"
  state_basis_semantics: "snapshot basis; the commit containing this file may be newer"
  governance_reference:
    branch: "agent/shared-agent-memory"
    implementation_commit: "5d560e8335438c3da08b9589fdf12555037ddba4"
    handoff_commit: "9dc317cdb402dc5ad024da1f740d1091c4c62ea6"
    merge_commit: "b7c634829210cf2e386129058710a98a1db26663"
    pull_request: 22
    pull_request_state: "merged"
  account_reference:
    branch: "feature/account-management-portal"
    commit: "2a42055ec93297b5556eeec571844ec2f1b57cf3"
    pull_request: 21
    pull_request_state: "draft"
    mergeable_after_governance_merge: false
    production_state: "not_released"
workstreams:
  - {id: "OM-GOV", name: "Agent governance and shared memory", status: "specified", architect: "codex_architect_admin", implementer: "codex_architect_admin"}
  - {id: "OM-CROWD", name: "Crowdsourced surface reports and daily human review", status: "reference_implementation", architect: "codex_architect_admin", implementer: "cursor_implementation_subagent"}
  - {id: "OM-ACC", name: "Account creation and account/admin consoles", status: "reference_implementation", architect: "codex_architect_admin", implementer: "cursor_implementation_subagent", reference_pull_request: 21}
  - {id: "OM-DEP", name: "Cloudflare preview and production configuration", status: "framework_required", architect: "codex_architect_admin", implementer: "cursor_implementation_subagent"}
  - {id: "OM-FUL", name: "Listing fulfillment and transaction confidence", status: "specified", architect: "codex_architect_admin", implementer: "cursor_implementation_subagent"}
  - {id: "OM-IDV", name: "High-assurance identity verification", status: "framework_required", architect: "codex_architect_admin", implementer: "cursor_implementation_subagent"}
  - {id: "OM-NODE", name: "Decentralized hosting-node registration and proof", status: "framework_required", architect: "codex_architect_admin", implementer: "cursor_implementation_subagent"}
  - {id: "OM-RANK", name: "Priority listing eligibility and deterministic ordering", status: "framework_required", architect: "codex_architect_admin", implementer: "cursor_implementation_subagent"}
  - {id: "OM-BILL", name: "Paid priority listings and dynamic pricing", status: "framework_required", architect: "codex_architect_admin", implementer: "cursor_implementation_subagent"}
  - {id: "OM-PRIV", name: "Ad-free hosting benefits and privacy/cookie policy", status: "framework_required", architect: "codex_architect_admin", implementer: "cursor_implementation_subagent"}
  - {id: "OM-MOD", name: "Moderation, audit log, and administrator capabilities", status: "framework_required", architect: "codex_architect_admin", implementer: "cursor_implementation_subagent"}
product_requirements:
  crowdsourced_surface_feedback:
    required: true
    importance: "foundational"
    every_surface_has_report_control: true
    report_kinds: ["bug", "feature"]
    surface_href_captured: true
    storage: "community_reports"
    daily_agent_compilation: true
    human_review_required: true
    users_build_the_product_in_controlled_fashion: true
    security_controls_never_community_owned: true
    security_control_reports: "filtered_to_administrators_only"
  public_browsing: {required: true}
  account_creation: {required: true, identity_verified_by_default: false}
  seller_handling_time:
    required: true
    selection_point: "listing_publish"
    allowed_values: ["same_day", "1_day", "2_days", "3_days"]
    max_days: 3
    semantics: "time until the item is ready to ship or ready for pickup"
    display_on_listing: true
  shipping_tracking_proof:
    required_for_shipping: true
    seller_prompted: true
    accepted_evidence: ["photo", "screenshot"]
    evidence_examples: ["shipping_label", "carrier_tracking_page"]
    proof_bytes_storage: "seller_browser_only"
    registry_fields: ["proof_content_hash", "optional_public_tracking_number"]
    live_carrier_tracking: false
  prepayment_video_chat:
    encouraged: true
    purpose: "allow buyer and seller to visually inspect that goods exist and appear consistent with the listed condition before money moves"
    built_in_video_room: false
    verification_badge: false
    placement: "listing_before_contact_or_payment"
    in_app_checkout: false
  decentralized_hosts:
    required: true
    eligibility_requires: ["high_assurance_identity_verification", "verifiable_hosting_node_operation"]
    permitted_benefits: ["priority_listing_status", "ad_free_experience"]
  social_connect_first_line_of_defense:
    required: true
    importance: "foundational"
    official_connect_only: true
    pull_all_official_provider_fields: true
    more_official_fields_raise_social_credit: true
    first_line_before_verified_buys_sells: true
    not_a_verification_badge: true
    not_a_credit_bureau_score: true
    provider_verified_flags_are_not_marketplace_verified: true
  priority_listings:
    presentation: "yellow_box"
    ordering: "before_regular_listings"
    regular_user_initial_fee_usd: "0.10"
    dynamic_pricing_required: true
    implementation_state: "architecture_required"
security_and_privacy_invariants:
  - "Never commit or log secrets, authentication tokens, cookies, passwords, or private exports."
  - "Never store raw identity documents in Git, shared memory, a public object store, or general marketplace metadata tables."
  - "Listing ownership, administrator status, verification status, host status, and priority eligibility are server-derived."
  - "Listing image bytes remain outside the public metadata registry."
  - "Tracking-proof image bytes remain device-local; only a content hash and optional public tracking number may enter the registry."
  - "A buyer-seller video chat is encouraged communication, not an identity, item, condition, or payment verification guarantee."
  - "Public browsing remains available unless the human owner explicitly changes this requirement."
  - "No destructive administrator capability is added without authorization, audit logging, tests, and a separate task approval."
  - "No production approval is inferred from builds, tests, previews, or subagent reports."
  - "Cybersecurity and access-control surfaces belong only to administrators. Community bug and feature reports that ask to change those controls are filtered out of the daily crowdsource queue."
shared_memory:
  root: "agent-memory"
  protocol: "agent-memory/README.md"
  state: "agent-memory/STATE.md"
  task_registry: "agent-memory/TASKS.md"
  decisions: "agent-memory/DECISIONS.md"
  handoff_template: "agent-memory/HANDOFF_TEMPLATE.md"
  github_citation_required_per_task: true
  citation_minimum:
    - "repository"
    - "canonical_ref_or_commit"
    - "Master_Descriptor.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/STATE.md"
manual_functional_acceptance:
  applies_to: "every user-facing behavior change"
  preview_required: true
  owner_checklist_required: true
  owner_is_test_operator: true
  owner_result_values: ["not_run", "pass", "fail"]
  required_result_before_codex_acceptance: "pass"
  required_result_before_merge: "pass"
  exemptions:
    - "docs_or_governance_only"
    - "tests_only_with_no_behavior_change"
    - "internal_maintenance_with_no_behavior_change"
  exemption_must_be_declared_in_task: true
production_gates:
  - {id: "PG-01", requirement: "all relevant tasks are accepted by Codex"}
  - {id: "PG-02", requirement: "tests, lint, build, artifact validation, and required visual checks pass"}
  - {id: "PG-03", requirement: "Cloudflare bindings, migrations, secrets, and rollback are verified in preview when applicable"}
  - {id: "PG-04", requirement: "security and privacy boundaries are reviewed"}
  - {id: "PG-05", requirement: "human owner manually passes the runnable preview for every user-facing behavior change"}
  - {id: "PG-06", requirement: "human owner gives explicit production approval"}
---

# Open Marketplace Master Descriptor

The YAML front matter is authoritative. The human owner and Codex jointly define architecture; Codex converts decisions into bounded machine-readable task contracts; Cursor implements assigned tasks only.

Crowdsourced surface feedback is a foundational product feature. Every page, section, and control exposes a `!` report action. The community files bugs and feature requests against those exact surfaces. Agents compile the queued reports daily. A human reviews that digest and decides what to adapt. Users help build the application in this limited, controlled way. Cybersecurity and access-control work is never community-owned.

## Project development fact: social Connect is first-line trust

Official social Connect is the first line of defense when a seller has no
verified buys or sells yet. The marketplace must pull every public field the
connected provider already returns after Connect. More official fields raise
Social Credit. Typed usernames and pasted links do not count. A provider
`verified` flag is not an Open Marketplace verification badge. Social Credit
is not a credit-bureau score. After verified buys and sells exist, ratings
and completed sales raise the same number.

Every Cursor task must begin by reading the GitHub-backed shared memory and must end with exact shared-memory references in its handoff. Every user-facing change must remain runnable for the human owner and cannot be accepted or merged until the owner reports a manual functional pass.
