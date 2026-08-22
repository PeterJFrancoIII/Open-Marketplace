---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-NEXT-CONNECTORS"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "partial"
started_at: "2026-08-22T20:21:00Z"
completed_at: "2026-08-22T20:35:00Z"
authority: "human_owner_direct_instruction"
implementation_change_authorized: false
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "cd83e2dc53a781c139d03780cbad02aaf78dc779"
head_commit: "this_publication_commit"
github_publication:
  inter_agent_review_handoff: true
  program_and_memory_pushed: true
  github_url: "https://github.com/PeterJFrancoIII/Open-Marketplace"
  handling_branch: "feature/community-surface-reports"
  pushed_commit: "this_publication_commit"
shared_memory_refs:
  github_repository: "PeterJFrancoIII/Open-Marketplace"
  github_url: "https://github.com/PeterJFrancoIII/Open-Marketplace"
  repo_directory: "/Users/computer/App Development/Marketplace/open-exchange-cursor-project/.worktrees/om-crowd-001"
  assigned_memory_root: "agent-memory/"
  canonical_ref_or_commit: "this_publication_commit"
  paths:
    - "agent-memory/README.md"
    - "agent-memory/HANDOFF_TEMPLATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "Master_Descriptor.md"
    - "AGENTS.md"
    - "lib/social-connectors.ts"
    - "agent-memory/handoffs/2026-08-19--owner-instagram-connect-create-app--cursor-grok-4-6.md"
files_changed:
  - "agent-memory/handoffs/2026-08-22--next-connectors-instagram--cursor-grok-4-6.md"
verification:
  - command: "gh variable list / gh secret list presence check"
    exit_code: 0
    result: "Preview Facebook and TikTok client ID/secret present. Instagram, X, LinkedIn, Reddit, Discord absent. PayPal sandbox ID present."
  - command: "Cloudflare Pages preview env_vars summarize"
    exit_code: 0
    result: "Preview has FACEBOOK_*, TIKTOK_*, PAYPAL_* (sandbox). Production has RELEASE_MODE only."
  - command: "devtools_app_list / basic_settings"
    exit_code: 0
    result: "Only Meta app Open Marketplace 2058991838072366. Type None, development mode. Facebook OAuth redirects already include the development Facebook callback."
  - command: "Safari Meta create-app wizard"
    exit_code: 0
    result: "Started OM Social Proof with Instagram use case and verified Open Marketplace business. Meta password reauth dialog is open. App not created."
functional_preview_required: true
functional_preview:
  status: "blocked_meta_password_reauth"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings"
  start_command: null
owner_manual_checklist:
  - "In the already-open Safari Meta dialog, re-enter the Facebook/Meta password. Do not paste that password into chat."
  - "After Submit succeeds, tell Cursor to continue Instagram."
  - "Facebook and TikTok Connect are already available on development Account settings. Instagram is next."
  - "Instagram Connect needs a Professional Instagram account (Business or Creator), not a personal consumer account."
  - "Do not request Meta App Review or switch the new app to Live."
  - "Do not put Instagram keys on production Pages."
owner_manual_result: "not_run"
blockers:
  - "Meta asked the owner to re-enter their password before creating OM Social Proof. Instagram App ID/secret do not exist yet."
remaining_work:
  - "Finish creating OM Social Proof after password reauth."
  - "Save development callback https://feature-community-surface-re.open-marketplace-demo.pages.dev/api/auth/callback/instagram"
  - "Store preview-only GitHub PAGES_PREVIEW_INSTAGRAM_CLIENT_ID and PAGES_PREVIEW_INSTAGRAM_CLIENT_SECRET. Do not print the secret."
  - "Redeploy the development preview only, then owner Connects Instagram."
  - "Then continue official Connect in order: X, LinkedIn, Reddit, Discord."
recommended_next_action: "Owner completes the Meta password dialog in Safari, then tells Cursor to continue Instagram. Do not mark accepted. Do not merge or deploy production."
contains_secrets_or_private_data: false
---

# Agent Handoff: Next official connectors; Instagram blocked on Meta password

## Objective received

Owner: connect the next connectors in order of importance.

## Shared-memory citations

Assigned shared-memory space for the GitHub repository directory that handles this work:

- GitHub repository: `PeterJFrancoIII/Open-Marketplace`
- GitHub URL: https://github.com/PeterJFrancoIII/Open-Marketplace
- Repo directory: `/Users/computer/App Development/Marketplace/open-exchange-cursor-project/.worktrees/om-crowd-001`
- Assigned memory root: `agent-memory/`
- Program head at start: `cd83e2dc53a781c139d03780cbad02aaf78dc779`

Official social Connect order in `lib/social-connectors.ts` is Facebook, TikTok, Instagram, X, LinkedIn, Reddit, Discord. No `TASKS.md` row exists; authority is human-owner direct instruction.

## Work performed

- Confirmed Facebook and TikTok preview credentials are already bound on GitHub and Cloudflare Pages preview. Production Pages still has no social or PayPal keys.
- Confirmed Instagram, X, LinkedIn, Reddit, and Discord preview credentials are absent, so those Connect buttons stay unavailable.
- Confirmed the existing Meta app Open Marketplace is type None and only offers Instagram Graph API, not Instagram Login App ID/secret. A separate Instagram-use-case app is required.
- In the owner's Safari Meta session, started Create app for `OM Social Proof`, selected Manage messaging & content on Instagram, connected the verified Open Marketplace business, and reached Overview. Meta then required password reauth. The password was not entered and was not requested in chat.
- Did not request App Review, go live, bind credentials, merge, or change production.

## Verification evidence

See front-matter `verification`. No Instagram App Secret was observed.

## Runnable preview

Development Account settings: https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings

Facebook and TikTok Connect should already appear there. Instagram will appear only after preview credentials exist and the branch is redeployed.

## Deviations and risks

PayPal official Login remains pending PayPal review and is a payment connector, not part of the social catalog. Venmo, Cash App, Zelle, and Apple Cash stay typed public contacts; they have no official consumer Login equivalent to implement next.

Instagram Login only authorizes Professional Instagram accounts.

## Review request

No program change. Resume Instagram dashboard setup after the owner submits the Meta password dialog. Do not mark accepted.
