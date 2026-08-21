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
  github_repository: "PeterJFrancoIII/Open-Marketplace"
  github_url: "https://github.com/PeterJFrancoIII/Open-Marketplace"
  repo_directory: "replace-with-absolute-clone-or-worktree-path-that-handles-this-work"
  assigned_memory_root: "agent-memory/"
  canonical_ref_or_commit: "replace-with-ref-or-full-sha"
  paths:
    - "agent-memory/README.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "Master_Descriptor.md"
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
Always cite the shared-memory space assigned to the GitHub repository directory that handles this work. Required fields: `github_repository`, `github_url`, `repo_directory`, `assigned_memory_root` (`agent-memory/` in this repository), `canonical_ref_or_commit`, and the exact memory paths read. Do not cite another project's memory, chat history, or a different clone as the canonical space. Do not cite unstored private reasoning.

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
