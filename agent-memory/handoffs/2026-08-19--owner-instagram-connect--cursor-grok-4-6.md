---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "owner-instagram-connect"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "blocked"
started_at: "2026-08-19T22:33:00Z"
completed_at: "2026-08-19T22:35:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "38e7f7f18752e9d39ef8917d5bcfe7ce4d1bdde8"
head_commit: "uncommitted"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "38e7f7f18752e9d39ef8917d5bcfe7ce4d1bdde8"
  paths:
    - "AGENTS.md"
    - "Master_Descriptor.md"
    - "agent-memory/README.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/HANDOFF_TEMPLATE.md"
files_changed:
  - "agent-memory/handoffs/2026-08-19--owner-instagram-connect--cursor-grok-4-6.md"
verification:
  - command: "GetMcpTools pattern=browser"
    exit_code: 0
    result: "no Cursor browser MCP tools (browser_navigate, browser_lock, snapshot, click)"
  - command: "GetMcpTools catalog"
    exit_code: 0
    result: "no browser_* tools on any connected server"
  - command: "gh variable list --repo PeterJFrancoIII/Open-Marketplace"
    exit_code: 0
    result: "PAGES_PREVIEW_INSTAGRAM_CLIENT_ID absent; Facebook and TikTok preview client IDs present"
  - command: "gh secret list --repo PeterJFrancoIII/Open-Marketplace"
    exit_code: 0
    result: "PAGES_PREVIEW_INSTAGRAM_CLIENT_SECRET absent; Facebook and TikTok preview secrets present"
functional_preview_required: false
functional_preview:
  status: "not_applicable"
  url: "https://developers.facebook.com/apps/2058991838072366/dashboard/"
  start_command: null
owner_manual_checklist: []
owner_manual_result: "not_run"
blockers:
  - "Cursor browser MCP is unavailable. Required tools browser_navigate, browser_lock, snapshot, and click are not connected in this session. Instagram Login / Business login setup on developers.facebook.com was not started."
remaining_work:
  - "Enable Cursor browser MCP with the owner already signed into developers.facebook.com, then retry this task."
  - "Add official Instagram product (or create Business-type app Open Marketplace Instagram if the existing Facebook app cannot add Instagram)."
  - "Save development callback https://feature-community-surface-re.open-marketplace-demo.pages.dev/api/auth/callback/instagram and live-bookmark callback if the form allows a second URI."
  - "Set GitHub variable PAGES_PREVIEW_INSTAGRAM_CLIENT_ID to the public Instagram App ID and secret PAGES_PREVIEW_INSTAGRAM_CLIENT_SECRET via gh only. Do not print or store the secret in chat, files, or handoffs."
recommended_next_action: "Owner enables Cursor browser MCP (or completes the Meta dashboard Instagram Login steps in the already-open session) and re-runs this agent. Do not request App Review. Do not go live. Do not put credentials on production Pages."
contains_secrets_or_private_data: false
---

# Agent Handoff: owner-instagram-connect

## Objective received
Add official Instagram Login (Business Login for Instagram) on the owner's
already-logged-in Meta Developer dashboard, capture the public Instagram App
ID, and store preview-only GitHub variable/secret. Do not store or print the
Instagram App Secret in any file, chat, or handoff.

## Shared-memory citations
Read local worktree `38e7f7f18752e9d39ef8917d5bcfe7ce4d1bdde8` plus the files
listed above. No `TASKS.md` row exists for this owner-direct Meta dashboard
task.

## Work performed
- Confirmed Cursor browser MCP is not connected. Catalog search for `browser`
  returned no tools. Connected servers include Meta Developer Tools MCP,
  Firecrawl, GitHub, and Cloudflare, but not `browser_navigate` /
  `browser_lock` / snapshot / click.
- Stopped dashboard setup as instructed when browser MCP is unavailable.
  Did not create a Meta app, add the Instagram product, save redirect URIs,
  request App Review, go live, commit, push, merge, or deploy.
- Read-only GitHub check: `PAGES_PREVIEW_INSTAGRAM_CLIENT_ID` is absent;
  `PAGES_PREVIEW_INSTAGRAM_CLIENT_SECRET` is absent.

## Verification evidence
See front-matter `verification`. No Instagram App Secret was observed.

## Deviations and risks
This session cannot click the Meta dashboard. Meta Developer Tools MCP can
inspect granted apps but cannot add the Instagram product or save Business
login redirect URIs. Firecrawl is not a substitute for the owner's logged-in
Cursor browser session.

## Review request
No Meta or GitHub credential changes were made. Retry only after Cursor
browser MCP is available against the owner's signed-in Meta session.
