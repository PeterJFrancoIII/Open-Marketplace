---
schema_version: "1.1"
document_id: "OM-MEMORY-PROTOCOL-001"
kind: "shared_memory_protocol"
status: "active"
updated_at: "2026-08-12T20:22:00Z"
owner_role: "codex_architect_admin"
---

# Agent Shared Memory

This directory is the Git-backed coordination space. It stores facts, contracts, and evidence, never hidden reasoning or secrets.

## Start-of-task protocol

Every Cursor agent must, before edits:

1. Fetch/read the repository's canonical GitHub ref specified by the task, defaulting to `main`.
2. Read `AGENTS.md`, `Master_Descriptor.md`, `agent-memory/README.md`, `STATE.md`, `TASKS.md`, and `DECISIONS.md`.
3. Locate the exact assigned task ID and verify status, dependencies, branch/base/head constraints, allowed paths, authorized actions, forbidden actions, and acceptance checks.
4. Record the GitHub repository, ref/commit, and shared-memory file paths actually read.
5. Read relevant prior handoffs and inspect working-tree state.

Missing or contradictory data => stop and write a `blocked` handoff. Do not improvise requirements.

## End-of-task protocol

Create one append-only handoff using `HANDOFF_TEMPLATE.md` and include:

- task/agent identifiers and UTC timestamps;
- repository, branch, base/head commits;
- `shared_memory_refs` with repository + canonical ref/commit + cited paths;
- exact changed paths;
- verification commands, exit codes, concise results;
- runnable preview metadata when `functional_preview_required: true`;
- owner checklist copied from the task without silently changing it;
- `owner_manual_result: not_run` unless Codex later records the human owner's result;
- deviations, risks, blockers, remaining work, recommended next action.

Subagents report only `ready_for_review`, `partial`, or `blocked`. Codex alone changes canonical state to `accepted`.

## Functional-preview rule

For every user-facing behavior change, the implementation task must produce a runnable preview for the human owner. Automated tests do not replace the human functional check. Cursor must never claim the owner passed a preview.

Docs/governance-only, test-only, or non-behavioral maintenance changes may be exempt only when `TASKS.md` explicitly says `functional_preview_required: false`.

## Memory safety

Never write passwords, API keys, tokens, cookies, private keys, raw identity documents, biometric data, private user exports, production rows, or hidden chain-of-thought into Git-backed memory.
