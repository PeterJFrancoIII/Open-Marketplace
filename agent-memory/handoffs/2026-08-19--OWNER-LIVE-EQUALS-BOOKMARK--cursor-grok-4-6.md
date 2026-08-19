---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-LIVE-EQUALS-BOOKMARK"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-19T21:26:00Z"
completed_at: "2026-08-19T21:32:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "2dbda209030d8f27126da44ba7bd6226f19af889"
head_commit: "f4876b4b2652fae84c1ea89f89186677b725100d"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "a4a78df3f3573f7d5d25a19f046a28503c9931fd"
  paths:
    - "Master_Descriptor.md"
    - "GOVERNANCE.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "agent-memory/HANDOFF_TEMPLATE.md"
files_changed:
  - "GOVERNANCE.md"
  - "agent-memory/handoffs/2026-08-19--OWNER-LIVE-EQUALS-BOOKMARK--cursor-grok-4-6.md"
verification:
  - command: "git ls-remote origin refs/heads/main refs/heads/feature/account-management-portal refs/heads/feature/community-surface-reports"
    exit_code: 0
    result: "main and feature/account-management-portal are a4a78df; development is f4876b4."
  - command: "gh run view 32303994694"
    exit_code: 0
    result: "Production deploy of 2dbda20 succeeded."
  - command: "curl https://open-marketplace-demo.pages.dev/ and the live bookmark"
    exit_code: 0
    result: "Both 200, Walnut record console present, community-feedback-root present."
functional_preview_required: true
functional_preview:
  status: "published"
  url: "https://open-marketplace-demo.pages.dev"
  start_command: null
owner_manual_checklist:
  - "Open https://open-marketplace-demo.pages.dev and confirm it matches the live bookmark."
  - "Open https://feature-account-management-p.open-marketplace-demo.pages.dev/ and confirm the same program, including ! report controls."
  - "Open https://feature-community-surface-re.open-marketplace-demo.pages.dev/ as the development copy."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Production D1 still has only _cf_KV. Live UI works; live registry APIs still fail until migrations are authorized."
  - "Uncommitted TikTok Connect work remains local on the development worktree and is not on live."
recommended_next_action: "Codex should record the two-track live/development URLs in canonical STATE. Do not merge development onto live unless the owner promotes it."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-LIVE-EQUALS-BOOKMARK

## Objective received
Use
`https://feature-account-management-p.open-marketplace-demo.pages.dev/`
as the live version as well, and keep exactly two versions: live and
development.

## Shared-memory citations
Read the live bookmark commit `2dbda20` and the files listed above.

## Work performed
- Production `main` was still `a559842` (TikTok handoff only on top of
  `2a87330`) and did not include community reports.
- Forced `main` to the live bookmark product, then recorded the
  two-URL live rule in `GOVERNANCE.md` as `a4a78df`.
- Kept `feature/account-management-portal` on that same live commit so
  the bookmark URL stays the live program.
- Kept `feature/community-surface-reports` as development (`f4876b4`),
  including the preserved TikTok review handoff.

## Verification evidence
See front matter. Cloudflare production canonical was `2dbda20` after
the first promotion deploy. A follow-up live deploy of `a4a78df` is
docs-only.

## Runnable preview
- Live production: `https://open-marketplace-demo.pages.dev`
- Live bookmark: `https://feature-account-management-p.open-marketplace-demo.pages.dev/`
- Development: `https://feature-community-surface-re.open-marketplace-demo.pages.dev/`

## Deviations and risks
- Owner instruction outranks the earlier “do not push main” note in
  `2026-08-19--owner-promote-dev-to-live`.
- Live and development currently share preview D1
  `8ddff0ae-f810-4d71-955e-4aab40a00e27` for account/community APIs.
- Production D1 was not migrated.

## Review request
Codex should confirm the two live URLs serve `a4a78df` and that
development remains a separate branch. Do not mark this accepted.
