---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "owner-tiktok-connect"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "partial"
started_at: "2026-08-18T23:18:00Z"
completed_at: "2026-08-18T23:24:42Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "1dff1142311541c85114c50c0c9f75b524b4cd6d"
head_commit: "uncommitted"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "1dff1142311541c85114c50c0c9f75b524b4cd6d"
  paths:
    - "Master_Descriptor.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "agent-memory/handoffs/2026-08-17--owner-social-connectors--cursor-grok-4-6.md"
    - "agent-memory/HANDOFF_TEMPLATE.md"
files_changed:
  - "app/account/account-settings.tsx"
  - "app/privacy/page.tsx"
  - "lib/auth.ts"
  - "lib/social-connectors.ts"
  - "tests/social-connectors.test.mjs"
  - "tests/tiktok-connect.test.mjs"
  - "agent-memory/handoffs/2026-08-18--owner-tiktok-connect--cursor-grok-4-6.md"
verification:
  - command: "npm test"
    exit_code: 0
    result: "121/121 tests passed after vinext build"
  - command: "npm run lint"
    exit_code: 0
    result: "0 errors, 4 pre-existing warnings"
functional_preview_required: true
functional_preview:
  status: "code_ready_credentials_missing"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/"
  start_command: null
owner_manual_checklist:
  - "Log in to TikTok for Developers at https://developers.tiktok.com/apps/ and tell Cursor to continue."
  - "After credentials are wired on development only, sign in on the development preview and open Account settings."
  - "Confirm Social media order is Facebook, TikTok, Instagram, X, LinkedIn, Reddit, Discord."
  - "Confirm Connect TikTok is available and Connect Instagram / X / LinkedIn / Reddit / Discord stay unavailable."
  - "Connect TikTok with a sandbox tester account and confirm the public profile appears."
  - "Confirm login still has no TikTok sign-in."
owner_manual_result: "not_run"
blockers:
  - "TikTok for Developers portal was signed out. No PAGES_PREVIEW_TIKTOK_CLIENT_KEY or PAGES_PREVIEW_TIKTOK_CLIENT_SECRET exists in GitHub. Connect TikTok cannot start until those preview-only credentials are created and a development deploy picks them up."
remaining_work:
  - "Owner logs into TikTok for Developers so Cursor can create the Login Kit web app, register the development callback, enable sandbox, and store preview-only GitHub var/secret."
  - "Redeploy development only after those preview credentials exist. Do not write TikTok secrets onto production Pages."
  - "Next connectors after TikTok, same most-to-least order: Instagram, X, LinkedIn, Reddit, Discord."
recommended_next_action: "Owner logs into https://developers.tiktok.com/apps/ and tells Cursor to finish TikTok credential wiring on the development preview. Do not merge to main or change live 2a87330."
contains_secrets_or_private_data: false
---

# Agent Handoff: owner-tiktok-connect

## Objective received
Set up official social media connectors from most to least important. The human owner said TikTok is next after Facebook.

## Shared-memory citations
Read `1dff1142311541c85114c50c0c9f75b524b4cd6d` plus `Master_Descriptor.md`, `agent-memory/STATE.md`, `agent-memory/TASKS.md`, `agent-memory/DECISIONS.md`, and `agent-memory/handoffs/2026-08-17--owner-social-connectors--cursor-grok-4-6.md`.

Verified GitHub repo `PeterJFrancoIII/Open-Marketplace` currently has preview Facebook credentials only. Instagram, TikTok, X, LinkedIn, Reddit, Discord, and PayPal workflow keys are wired but empty.

## Work performed
- Kept work on development branch `feature/community-surface-reports`. Live `2a87330` was not changed.
- Reordered the official catalog to Facebook, TikTok, Instagram, X, LinkedIn, Reddit, Discord.
- Tightened TikTok Login Kit scopes to `user.info.basic` and `user.info.profile`. `user.info.stats` was removed so sandbox Connect does not request an unapproved follower-count scope.
- TikTok user-info reads now request only those Login Kit fields and persist the official name, username, avatar URL, and profile link.
- Better Auth TikTok Connect now uses custom `getUserInfo`, `disableSignUp`, and `disableImplicitSignUp`. Login stays email/password.
- Account settings and the public privacy page now describe TikTok Login Kit and Disconnect.
- Added `tests/tiktok-connect.test.mjs` and catalog/availability tests. Full suite is 121/121.

## Verification evidence
`npm test` exit 0, 121/121. `npm run lint` exit 0, 0 errors, 4 pre-existing warnings.

## Runnable preview
Development URL remains `https://feature-community-surface-re.open-marketplace-demo.pages.dev/`. These TikTok code changes are uncommitted and not deployed. The Connect TikTok button will stay unavailable until preview TikTok credentials exist.

TikTok app fields to register after the owner is signed in:

- Redirect URI: `https://feature-community-surface-re.open-marketplace-demo.pages.dev/api/auth/callback/tiktok`
- Privacy: `https://feature-community-surface-re.open-marketplace-demo.pages.dev/privacy`
- Terms: `https://feature-community-surface-re.open-marketplace-demo.pages.dev/terms`
- Product: Login Kit for Web
- Mode: Sandbox, with the owner's TikTok username as a target user

## Deviations and risks
- No canonical `TASKS.md` row existed for this connector setup. Work followed the human owner's direct instruction and stayed inside official Connect / preview-only credentials.
- Better Auth warns if TikTok has no `clientId`; the provider still uses `clientKey`. Both are now set from `TIKTOK_CLIENT_KEY`.
- TikTok does not support localhost callbacks. Local `npm run dev` cannot complete TikTok OAuth.
- Production Pages must not receive TikTok secrets.

## Review request
Codex should review the catalog order, Login Kit scope reduction, Connect-only TikTok wiring, and the remaining credential blocker. Do not accept, merge, or production-release from this handoff.
