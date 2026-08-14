---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OM-ACC-009"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-14T20:08:00Z"
completed_at: "2026-08-14T20:23:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/account-management-portal"
base_commit: "fd93067d03c24564fc5893fcd5885c66555ec411"
head_commit: "a7ae85d1c58ff00be076f46a95838a5757f25f61"
implementation_commit: "a7ae85d1c58ff00be076f46a95838a5757f25f61"
required_feature_head_ancestor: "fd93067d03c24564fc5893fcd5885c66555ec411"
ancestor_preserved: true
pull_request: 21
pull_request_state: "draft"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "490f1fe370ccd10b9ef75cfe1dbc79d6fc61cff9"
  paths:
    - "Master_Descriptor.md"
    - "AGENTS.md"
    - "agent-memory/README.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "CURSOR_START_HERE.md"
oauth_or_secrets_changed: false
production_changed: false
merged: false
files_changed:
  - "lib/auth.ts"
  - "lib/types.ts"
  - "lib/profile-settings.ts"
  - "app/account/page.tsx"
  - "app/account/account-settings.tsx"
  - "app/api/account/profile/route.ts"
  - ".env.example"
  - ".github/workflows/deploy-cloudflare-pages.yml"
  - "scripts/configure-pages-preview.mjs"
  - "tests/facebook-connect.test.mjs"
  - "tests/auth-live-flow.test.mjs"
  - "tests/rendered-html.test.mjs"
  - "agent-memory/handoffs/2026-08-14--OM-ACC-009--cursor-grok-4-6.md"
verification:
  - command: "gh api repos/PeterJFrancoIII/Open-Marketplace/commits/490f1fe370ccd10b9ef75cfe1dbc79d6fc61cff9 --jq .sha"
    exit_code: 0
    result: "resolved canonical main 490f1fe370ccd10b9ef75cfe1dbc79d6fc61cff9"
  - command: "git merge-base --is-ancestor fd93067d03c24564fc5893fcd5885c66555ec411 HEAD"
    exit_code: 0
    result: "required ancestor preserved"
  - command: "git diff --check"
    exit_code: 0
    result: "no whitespace errors"
  - command: "npm run lint"
    exit_code: 0
    result: "eslint passed"
  - command: "npm test"
    exit_code: 0
    result: "37 tests passed, 0 failed"
  - command: "GitHub Actions Deploy to Cloudflare Pages run 31837515780"
    exit_code: 0
    result: "success on feature/account-management-portal at a7ae85d1c58ff00be076f46a95838a5757f25f61; preview env key names include FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET; production env keys remain RELEASE_MODE only"
  - command: "curl -sS -D - https://feature-account-management-p.open-marketplace-demo.pages.dev/login"
    exit_code: 0
    result: "HTTP 200 text/html; Log in to Open Marketplace; no Continue with Facebook, Sign in with Facebook, or Connect Facebook"
  - command: "curl -sS -D - https://feature-account-management-p.open-marketplace-demo.pages.dev/account"
    exit_code: 0
    result: "HTTP 307 to /login?returnTo=%2Faccount"
  - command: "curl -sS -o /dev/null -w '%{http_code}' https://open-marketplace-demo.pages.dev/privacy"
    exit_code: 0
    result: "production /privacy remains 404"
functional_preview_required: true
functional_preview:
  status: "ready"
  url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/account"
  start_command: null
  environment: "non_production"
owner_manual_checklist:
  - "Open https://feature-account-management-p.open-marketplace-demo.pages.dev/login and confirm there is no Facebook sign-in."
  - "Sign in with an existing Open Marketplace email/password account."
  - "Open Account settings and confirm Connect Facebook is shown."
  - "Connect with consumer Facebook Login. Confirm Meta asks for public_profile only, not email."
  - "After return, confirm Connected plus Facebook name/profile, and that the Open Marketplace email is unchanged."
  - "Disconnect and confirm the marketplace account remains signed in and Facebook no longer reads as Connected."
  - "Do not treat typed Facebook URL history as Connected."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Owner completes Connect → Connected → Disconnect on the preview."
  - "Codex reviews this handoff. Do not merge PR #21 or deploy production."
recommended_next_action: "Owner runs the Facebook Connect manual checklist on the account preview. Codex reviews public_profile-only linking and does not accept, merge, or ship production."
contains_secrets_or_private_data: false
---

# Agent Handoff: OM-ACC-009

## Objective received
Implement Facebook identity-only Connect on authenticated account settings for the non-production preview: Connect → Connected → Disconnect, consumer Facebook Login, `public_profile` only. Keep the existing Open Marketplace account/email primary. No Facebook sign-in, email permission, Marketplace APIs, scraping, verification claims, other providers, merge, or production deploy.

## Shared-memory citations
Read `PeterJFrancoIII/Open-Marketplace` `main` at `490f1fe370ccd10b9ef75cfe1dbc79d6fc61cff9`. Cited `Master_Descriptor.md`, `AGENTS.md`, `agent-memory/README.md`, `agent-memory/STATE.md`, `agent-memory/TASKS.md`, `agent-memory/DECISIONS.md`, and `CURSOR_START_HERE.md`.

## Work performed
Added Better Auth Facebook linking in `lib/auth.ts` when both preview `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET` are present: `disableDefaultScope`, `scope: ["public_profile"]`, `disableSignUp`, `disableImplicitSignUp`, `disableIdTokenSignIn`, and explicit account linking (`disableImplicitLinking`, `allowDifferentEmails`, `updateUserInfoOnLink: false`, `trustedProviders: ["facebook"]`). A `hooks.before` middleware rejects Facebook `/sign-in/social` and blocks `/get-access-token` plus `/refresh-token` so tokens stay server-side.

Account settings now show Connect Facebook, Connected plus provider-supplied name/picture, and Disconnect. Typed Facebook URLs remain self-reported audit data and never render as Connected. Instagram/TikTok stay typed URL fields. Zelle, Apple Cash, and the five crypto rails are unchanged. PayPal/Venmo/Cash App remain unresolved typed contacts, not Connected.

Preview CI wiring reads GitHub `PAGES_PREVIEW_FACEBOOK_CLIENT_ID` / `PAGES_PREVIEW_FACEBOOK_CLIENT_SECRET` into Worker `FACEBOOK_*` keys for non-`main` deploys only. Production Pages env in `configure-pages-preview.mjs` still has `RELEASE_MODE` only.

## Verification evidence
`git diff --check`, `npm run lint`, and `npm test` passed (37/37). Signed-in `POST /api/auth/link-social` returns a Facebook OAuth URL whose scope is only `public_profile`. Unsigned Facebook sign-in is rejected and creates no user. Disconnect removes the Facebook `auth_accounts` row and leaves the marketplace user. Preview config builder never adds `FACEBOOK_*` to production. Pages CI run `31837515780` succeeded. HTTPS GET of preview `/login` is email/password only. Signed-out preview `/account` redirects to login. Production `/privacy` remains 404.

## Runnable preview
https://feature-account-management-p.open-marketplace-demo.pages.dev/account

`owner_manual_result` remains `not_run`.

## Deviations and risks
Did not merge `main` into the feature branch; the task required citing the resolved main commit, not rebasing governance history into PR #21. Did not edit `/privacy`; that page still says Facebook Connect is not yet enabled because `app/privacy/**` was outside the allowed path set. Better Auth rejects callback URLs that include a hash, so Connect returns to `/account` rather than `/account#account-settings`. Facebook `getUserInfo` still requests Graph field `email` internally; without the email permission Graph omits it, and the profile API never returns email or tokens. `accountInfo` name/picture requires a live Graph call and may show Connected without a name if Graph fails.

## Review request
Codex should confirm public_profile-only linking, no Facebook sign-in, no production/secret leakage, and that PR #21 stays draft. Do not accept, merge, or deploy production. Owner must run Connect → Connected → Disconnect on the preview.
