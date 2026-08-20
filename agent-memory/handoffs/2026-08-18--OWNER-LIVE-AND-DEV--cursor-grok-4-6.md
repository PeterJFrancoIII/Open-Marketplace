---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-LIVE-AND-DEV"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-18T23:11:00Z"
completed_at: "2026-08-18T23:14:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "2a873308cf5c47bfe65e543e9b7fe38b874e6fcb"
head_commit: "1dff114"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "2a873308cf5c47bfe65e543e9b7fe38b874e6fcb"
  paths:
    - "Master_Descriptor.md"
    - "GOVERNANCE.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
files_changed:
  - "GOVERNANCE.md"
  - "agent-memory/STATE.md"
verification:
  - command: "curl https://feature-account-management-p.open-marketplace-demo.pages.dev/"
    exit_code: 0
    result: "200; Walnut record console present; no community-feedback-root"
  - command: "curl https://open-marketplace-demo.pages.dev/"
    exit_code: 0
    result: "200; same live commit 2a87330; production still canonical b35ce20d"
  - command: "curl https://feature-community-surface-re.open-marketplace-demo.pages.dev/"
    exit_code: 0
    result: "200; Walnut record console present; community-feedback-root present"
  - command: "gh run view 32196187990"
    exit_code: 0
    result: "Live bookmark branch deploy succeeded"
  - command: "gh run view 32196176455"
    exit_code: 0
    result: "Development branch deploy succeeded"
functional_preview_required: true
functional_preview:
  status: "published"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/"
  start_command: null
owner_manual_checklist:
  - "Open the live bookmark and confirm it is the accepted account-management program."
  - "Open the development preview and confirm the ! report controls are present."
  - "Do not treat development as live until the owner promotes it."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Production D1 still has no account schema. Canonical pages.dev shows the live UI but live account APIs remain on the preview database used by the bookmark URL."
  - "Live bookmark and development preview currently share preview D1 8ddff0ae-f810-4d71-955e-4aab40a00e27."
recommended_next_action: "Use the two published URLs as live and development. Do not merge development onto main until the owner says to promote it."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-LIVE-AND-DEV

## Objective received
Use the account-management program at
`https://feature-account-management-p.open-marketplace-demo.pages.dev/`
as the live version, and keep a separate development version.

## Work performed
- Restored GitHub branch `feature/account-management-portal` at live
  commit `2a87330` and republished the bookmark Pages alias.
- Left Cloudflare Pages production on the same live commit.
- Published `feature/community-surface-reports` as the development
  preview. That branch was not merged to `main`.

## Verification evidence
See front matter. Pages now has exactly three deployments: production
`2a87330`, live bookmark `2a87330`, and development `90280c1`/`1dff114`.

## Runnable preview
- Live bookmark: `https://feature-account-management-p.open-marketplace-demo.pages.dev/`
- Canonical production: `https://open-marketplace-demo.pages.dev`
- Development: `https://feature-community-surface-re.open-marketplace-demo.pages.dev/`

## Deviations and risks
- Owner replaced the earlier “only one public version” rule with a
  two-track live/development rule.
- Live bookmark and development share the preview D1 database.
- Production D1 was not migrated.

## Review request
Codex should record the two-track URLs in canonical state after review.
Do not promote development to live without an explicit owner instruction.
