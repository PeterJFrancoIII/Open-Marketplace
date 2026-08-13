---
schema_version: "1.4"
document_id: "OM-DECISIONS-001"
kind: "decision_registry"
updated_at: "2026-08-13T02:30:00Z"
updated_by: "codex_architect"
decisions:
  - {id: "OM-DEC-001", status: "accepted", title: "Architect and implementation-subagent role split", decision: "Codex owns architecture and administration; Cursor agents execute assigned work packages and return evidence.", authority: "human_owner", decided_on: "2026-08-12"}
  - {id: "OM-DEC-002", status: "accepted", title: "Git-backed shared memory", decision: "Use agent-memory/ for operational state and append-only handoffs, with Master_Descriptor.md as project authority.", authority: "human_owner", decided_on: "2026-08-12"}
  - {id: "OM-DEC-003", status: "accepted", title: "Architect-owned canonical state", decision: "Cursor subagents write task handoffs; Codex alone reconciles canonical state, tasks, and accepted decisions.", authority: "codex_architect_admin", decided_on: "2026-08-12"}
  - {id: "OM-DEC-004", status: "accepted", title: "Sensitive data exclusion", decision: "Secrets, raw identity documents, and private user data are prohibited from Git-backed shared memory.", authority: "codex_architect_admin", decided_on: "2026-08-12"}
  - {id: "OM-DEC-005", status: "accepted", title: "Human production gate", decision: "No agent may infer production approval; the human owner must explicitly authorize a release.", authority: "human_owner", decided_on: "2026-08-12"}
  - id: "OM-DEC-006"
    status: "accepted"
    title: "Human manual functional preview gate"
    decision: "Every user-facing behavior change must provide a runnable preview and a plain-language owner checklist; Codex may not accept or merge the change until the human owner reports pass."
    authority: "human_owner"
    decided_on: "2026-08-12"
  - id: "OM-DEC-007"
    status: "accepted"
    title: "Shared-memory citation on every Cursor task"
    decision: "Each Cursor task must read the canonical GitHub shared-memory set and record repository, ref/commit, and cited shared-memory paths in its handoff."
    authority: "human_owner"
    decided_on: "2026-08-12"
  - id: "OM-DEC-008"
    status: "accepted"
    title: "Owner-mediated Cursor dispatch protocol"
    decision: "Codex prepares and commits the detailed machine-readable task contract to canonical shared memory. When the task is execution-ready, Codex tells the human owner only 'handoff to cursor'; the human owner invokes Cursor. Cursor returns evidence as ready_for_review and never self-accepts."
    authority: "human_owner"
    decided_on: "2026-08-12"
  - id: "OM-DEC-009"
    status: "accepted"
    title: "Owner-reachable preview requirement"
    decision: "A preview is not owner-testable merely because it returns HTTP 200 inside an agent environment. For user-facing work, the handoff must provide an HTTPS URL reachable from the human owner's browser, or explicitly verify that localhost is running on the owner's own machine. Agent-only localhost URLs do not satisfy OM-DEC-006."
    authority: "codex_architect_admin"
    basis: "OM-DEC-006 plus owner-reported localhost reachability failure"
    decided_on: "2026-08-12"
  - id: "OM-DEC-010"
    status: "accepted"
    title: "Snapshot-based launch crypto rails with explicit networks"
    decision: "For the current account-settings launch, interpret the owner's top-five crypto requirement as a five-asset market-cap snapshot including Bitcoin, consistent with the prior Cursor implementation shape. Freeze the 2026-08-13 verified snapshot as BTC, ETH, USDT, BNB, and USDC rather than dynamically re-ranking saved payment fields. Every crypto receive destination must bind the asset to an explicit network. Initial network scope is Bitcoin Mainnet for BTC, Ethereum Mainnet for ETH, Ethereum/ERC-20 for USDT and USDC, and BNB Smart Chain Mainnet for BNB. Additional assets or networks require a separate reviewed task."
    authority: "codex_architect_admin"
    basis:
      - "OM-ACC-004 handoff recovered the owner wording PayPal, Venmo, Cash App, and Bitcoin/top-five crypto requirement but acknowledged the individual crypto list was not directly owner-named."
      - "Architect market-cap verification on 2026-08-13 against CoinGecko and CoinMarketCap placed USDC at #5 and Solana below #5."
      - "Official Tether, Circle, and BNB network guidance establishes that supported crypto assets can exist across multiple chains and that the correct network matters for receipt/recovery."
      - "A fixed launch snapshot preserves meaning for saved account settings when market rankings later move."
    decided_on: "2026-08-13"
---

# Decision Registry

Accepted decisions remain append-only. Superseded decisions remain with `status: superseded` and `superseded_by`.
