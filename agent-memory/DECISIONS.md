---
schema_version: "1.0"
document_id: "OM-DECISIONS-001"
kind: "decision_registry"
updated_at: "2026-08-12T19:27:59Z"
updated_by: "codex_architect"
decisions:
  - id: "OM-DEC-001"
    status: "accepted"
    title: "Architect and implementation-subagent role split"
    decision: "Codex owns architecture and administration; Cursor agents execute assigned work packages and return evidence."
    authority: "human_owner"
    decided_on: "2026-08-12"
  - id: "OM-DEC-002"
    status: "accepted"
    title: "Git-backed shared memory"
    decision: "Use agent-memory/ for operational state and append-only handoffs, with Master_Descriptor.md as project authority."
    authority: "human_owner"
    decided_on: "2026-08-12"
  - id: "OM-DEC-003"
    status: "accepted"
    title: "Architect-owned canonical state"
    decision: "Cursor subagents write task handoffs; Codex alone reconciles canonical state, tasks, and accepted decisions."
    authority: "codex_architect_admin"
    decided_on: "2026-08-12"
  - id: "OM-DEC-004"
    status: "accepted"
    title: "Sensitive data exclusion"
    decision: "Secrets, raw identity documents, and private user data are prohibited from Git-backed shared memory."
    authority: "codex_architect_admin"
    decided_on: "2026-08-12"
  - id: "OM-DEC-005"
    status: "accepted"
    title: "Human production gate"
    decision: "No agent may infer production approval; the human owner must explicitly authorize a release."
    authority: "human_owner"
    decided_on: "2026-08-12"
---

# Decision Registry

Accepted decisions remain in this file. Superseded decisions are retained with
`status: superseded` and a `superseded_by` field so agents can reconstruct why a
rule changed.
