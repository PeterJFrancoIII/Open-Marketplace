---
schema_version: "1.0"
document_id: "OM-MEMORY-PROTOCOL-001"
kind: "shared_memory_protocol"
status: "active"
updated_at: "2026-08-12T19:27:59Z"
owner_role: "codex_architect_admin"
---

# Agent Shared Memory

This directory is the Git-backed coordination space for Codex and Cursor
agents. It contains project facts and task evidence, not private chain-of-thought
or hidden reasoning.

## File map

| File | Purpose | Canonical writer |
|---|---|---|
| `STATE.md` | Current repositories, branches, deployments, validation, and blockers | Codex |
| `TASKS.md` | Machine-readable assignments, dependencies, scope, and acceptance gates | Codex |
| `DECISIONS.md` | Accepted architecture and governance decisions | Codex |
| `HANDOFF_TEMPLATE.md` | Required structure for subagent reports | Codex |
| `handoffs/*.md` | Append-only task evidence from agents | Assigned agent |

`Master_Descriptor.md` remains the project-wide authority. This directory
stores changing operational state beneath that stable contract.

## Start-of-task protocol

Every agent must:

1. Read `../AGENTS.md` and `../Master_Descriptor.md`.
2. Read `STATE.md`, `TASKS.md`, and `DECISIONS.md`.
3. Locate the assigned task ID and verify status, dependencies, branch, base
   commit, allowed paths, forbidden actions, and acceptance checks.
4. Read relevant prior handoffs.
5. Inspect repository state before making changes.

If required information is absent or contradictory, create a blocked handoff.
Do not manufacture missing requirements.

## End-of-task protocol

The assigned implementation agent creates a new handoff using
`HANDOFF_TEMPLATE.md`. The handoff must include:

- task and agent identifiers;
- start and completion timestamps in UTC;
- repository, branch, and commit state;
- exact changed paths;
- verification commands, exit codes, and concise results;
- deviations, risks, blockers, and remaining work;
- a recommended next action.

Subagents use `ready_for_review`, `partial`, or `blocked`. Codex independently
reviews the work and is the only agent that may update the canonical task to
`accepted`.

## Handoff naming

Use:

`YYYY-MM-DD--TASK-ID--agent-id.md`

Example:

`2026-08-12--OM-ACC-001--cursor-grok-4-5.md`

Never overwrite or rename another agent's handoff. Corrections are a new file
that references the superseded handoff.

## Concurrency rules

- One implementation agent owns a task at a time unless `TASKS.md` explicitly
  lists non-overlapping subtasks.
- Agents must not edit the same implementation paths concurrently.
- `STATE.md`, `TASKS.md`, `DECISIONS.md`, and `Master_Descriptor.md` are
  architect-owned to prevent conflicting canonical updates.
- A handoff is evidence, not proof of correctness. Codex must inspect and verify.

## Prohibited memory content

Never write any of the following to this directory or Git history:

- passwords, API keys, access tokens, session cookies, or private keys;
- raw identity documents, document numbers, biometric data, or verification
  provider payloads containing personal data;
- private user exports or production database rows;
- unverified claims presented as facts;
- hidden chain-of-thought or private internal reasoning.

Use redacted identifiers and source locations. Store sensitive operational data
only in approved secret or protected-data systems defined by a future task.
