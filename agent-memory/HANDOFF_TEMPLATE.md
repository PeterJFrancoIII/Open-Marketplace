---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OM-XXX-000"
agent_id: "replace-with-agent-id"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "YYYY-MM-DDTHH:MM:SSZ"
completed_at: "YYYY-MM-DDTHH:MM:SSZ"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "replace-with-branch"
base_commit: "replace-with-full-sha"
head_commit: "replace-with-full-sha-or-uncommitted"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "replace-with-ref-or-full-sha"
  paths:
    - "Master_Descriptor.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
files_changed: []
verification: []
functional_preview_required: false
functional_preview:
  status: "not_applicable"
  url: null
  start_command: null
owner_manual_checklist: []
owner_manual_result: "not_run"
blockers: []
remaining_work: []
recommended_next_action: "replace-with-next-action"
contains_secrets_or_private_data: false
---

# Agent Handoff: TASK-ID

## Objective received
State the assigned objective without expanding it.

## Shared-memory citations
List the exact GitHub ref/commit and canonical files read before work. Do not cite unstored private reasoning.

## Work performed
List concrete changes and why each was necessary.

## Verification evidence
For each command record `command`, `exit_code`, and concise `result` in front matter.

## Runnable preview
When required, give the URL and start command, confirm the server was observed running, and copy the owner checklist from the task. Leave `owner_manual_result: not_run`.

## Deviations and risks
Record every deviation, assumption, compatibility concern, or unresolved risk.

## Review request
Tell Codex exactly what should be reviewed. Do not declare acceptance, merge approval, or production readiness.
