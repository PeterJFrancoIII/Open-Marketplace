---
schema_version: "1.0"
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
files_changed: []
verification: []
blockers: []
remaining_work: []
recommended_next_action: "replace-with-next-action"
contains_secrets_or_private_data: false
---

# Agent Handoff: TASK-ID

## Objective received

State the assigned objective without expanding it.

## Work performed

List concrete changes and why each was necessary.

## Verification evidence

For each command, add an entry to the front matter using this shape:

```yaml
- command: "npm test"
  exit_code: 0
  result: "21 tests passed; 0 failed"
```

Include relevant manual or visual checks, with URLs or artifact paths when they
contain no sensitive data.

## Deviations and risks

Describe every plan deviation, assumption, compatibility concern, or unresolved
risk. Write `None` only after checking.

## Review request

Tell the Codex architect exactly what should be reviewed. Do not declare the
task accepted or production-ready.
