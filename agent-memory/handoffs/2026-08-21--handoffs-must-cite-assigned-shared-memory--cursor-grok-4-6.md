---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-HANDOFF-CITE-ASSIGNED-SHARED-MEMORY"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-21T21:19:00Z"
completed_at: "2026-08-21T21:32:00Z"
authority: "human_owner_direct_instruction"
gpt_architect_review:
  policy: "accepted"
  repository_implementation: "request_changes_not_yet_verified_at_e84c215"
  paypal_issue: "not_accepted"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "e84c215b8a5eec88c97ba4b8b24d70ef639c9aeb"
head_commit: "this_persistence_commit"
shared_memory_refs:
  github_repository: "PeterJFrancoIII/Open-Marketplace"
  github_url: "https://github.com/PeterJFrancoIII/Open-Marketplace"
  repo_directory: "/Users/computer/App Development/Marketplace/open-exchange-cursor-project/.worktrees/om-crowd-001"
  assigned_memory_root: "agent-memory/"
  canonical_ref_or_commit: "e84c215b8a5eec88c97ba4b8b24d70ef639c9aeb"
  persistence_note: "e84c215 is the parent PayPal implementation commit only. It does not contain this standing-rule update. This file is the persistence slice."
  paths:
    - "agent-memory/README.md"
    - "agent-memory/HANDOFF_TEMPLATE.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "agent-memory/handoffs/2026-08-21--connect-paypal-escalated-to-gpt--cursor-grok-4-6.md"
    - "Master_Descriptor.md"
    - ".cursor/rules/shared-memory.mdc"
files_changed:
  - "agent-memory/HANDOFF_TEMPLATE.md"
  - "agent-memory/README.md"
  - ".cursor/rules/shared-memory.mdc"
  - "agent-memory/handoffs/2026-08-21--connect-paypal-escalated-to-gpt--cursor-grok-4-6.md"
  - "agent-memory/handoffs/2026-08-21--handoffs-must-cite-assigned-shared-memory--cursor-grok-4-6.md"
verification: []
functional_preview_required: false
functional_preview:
  status: "not_applicable"
  url: null
  start_command: null
owner_manual_checklist: []
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "After this commit is on origin, GPT should verify GitHub contains the standing-rule text."
recommended_next_action: "GPT verifies the new commit SHA. Do not mark the PayPal issue accepted. Do not merge or deploy."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-HANDOFF-CITE-ASSIGNED-SHARED-MEMORY

## Objective received
Human owner: these handoffs must always cite the shared memory space that is assigned to the GitHub repo directory that handles it.

GPT architect review at 2026-08-21T21:27:00-04:00: standing rule ACCEPTED; persistence at `e84c215` NOT VERIFIED; commit and push only the documentation/memory files that implement the rule.

## Shared-memory citations
Assigned shared-memory space for the GitHub repository directory that handles this work:

- GitHub repository: `PeterJFrancoIII/Open-Marketplace`
- GitHub URL: https://github.com/PeterJFrancoIII/Open-Marketplace
- Repo directory: `/Users/computer/App Development/Marketplace/open-exchange-cursor-project/.worktrees/om-crowd-001`
- Assigned memory root: `agent-memory/`
- Parent / read-basis commit: `e84c215b8a5eec88c97ba4b8b24d70ef639c9aeb`

`e84c215` is the PayPal callback commit. It does **not** contain this governance update. This persistence slice is a later commit on `feature/community-surface-reports` that changes only the files listed above.

Do not cite another project's memory, chat history, or a different clone as the canonical space.

## Standing rule
Every handoff must explicitly identify:

- GitHub repository
- assigned repo directory/worktree
- assigned shared-memory directory (`agent-memory/`)
- exact ref/commit used
- relevant shared-memory paths actually read

## Work performed
- `agent-memory/HANDOFF_TEMPLATE.md` requires `github_repository`, `github_url`, `repo_directory`, and `assigned_memory_root`.
- `agent-memory/README.md` start-of-task and end-of-task protocol now require that citation.
- `.cursor/rules/shared-memory.mdc` now requires the same citation on every handoff.
- `agent-memory/handoffs/2026-08-21--connect-paypal-escalated-to-gpt--cursor-grok-4-6.md` now cites this assigned space.

No PayPal implementation code was changed in this slice. The PayPal issue is not accepted.

## Review request
GPT should verify this commit on GitHub contains the standing-rule text. Do not declare PayPal acceptance, merge approval, or production readiness.
