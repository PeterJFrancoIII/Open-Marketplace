---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OM-ACC-010"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-16T13:39:00Z"
completed_at: "2026-08-16T13:42:22Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/account-management-portal"
expected_start_head: "95ee1cfd15f484d7150028e8aedcb509996ee38c"
known_good_facebook_baseline: "6ec638625805750701a571d6708cc1528abe9857"
start_head_matched: true
baseline_is_ancestor: true
head_commit: "8f45c5311707647cdadfba5e54abbfd95fd24c33"
revert_commits:
  - "91934bf"
  - "2f61e9c"
  - "8ce472d"
  - "8490969"
  - "015108c"
  - "7fc4f40"
  - "c24212a"
correction_commit: "8f45c5311707647cdadfba5e54abbfd95fd24c33"
pull_request: 21
pull_request_state: "draft"
force_push: false
remote_reset: false
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "96adc20d240f6dd644e74981778d86eeb1e3808b"
  paths:
    - "Master_Descriptor.md"
    - "AGENTS.md"
    - "agent-memory/README.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "agent-memory/HANDOFF_TEMPLATE.md"
    - "CURSOR_START_HERE.md"
oauth_or_secrets_changed: false
production_changed: false
merged: false
contains_secrets_or_private_data: false
files_changed:
  - "lib/auth.ts"
  - "app/account/page.tsx"
  - "app/privacy/page.tsx"
  - "tests/facebook-connect.test.mjs"
  - "tests/privacy-policy.test.mjs"
  - "tests/om-acc-010-restore.test.mjs"
  - "agent-memory/handoffs/2026-08-16--OM-ACC-010--cursor-grok-4-6.md"
verification:
  - command: "git fetch origin main && git rev-parse origin/main"
    exit_code: 0
    result: "canonical main 96adc20d240f6dd644e74981778d86eeb1e3808b"
  - command: "git rev-parse HEAD at start"
    exit_code: 0
    result: "95ee1cfd15f484d7150028e8aedcb509996ee38c matched expected_start_head"
  - command: "git merge-base --is-ancestor 6ec638625805750701a571d6708cc1528abe9857 HEAD"
    exit_code: 0
    result: "known-good Facebook baseline is an ancestor"
  - command: "git revert --no-edit 6ec6386..HEAD"
    exit_code: 0
    result: "seven forward revert commits; working tree then matched 6ec6386 exactly"
  - command: "git diff --name-only 6ec638625805750701a571d6708cc1528abe9857 HEAD after correction"
    exit_code: 0
    result: "app/account/page.tsx app/privacy/page.tsx lib/auth.ts tests/facebook-connect.test.mjs tests/om-acc-010-restore.test.mjs tests/privacy-policy.test.mjs"
  - command: "git diff --check"
    exit_code: 0
    result: "no whitespace errors"
  - command: "npm run lint"
    exit_code: 0
    result: "eslint passed"
  - command: "npm test"
    exit_code: 0
    result: "40 tests passed, 0 failed"
  - command: "GitHub Actions Deploy to Cloudflare Pages run 31950530604"
    exit_code: 0
    result: "success on feature/account-management-portal at 8f45c5311707647cdadfba5e54abbfd95fd24c33"
  - command: "curl preview /login"
    exit_code: 0
    result: "HTTP 200; Log in to Open Marketplace; email/password only; no Continue with Facebook, Sign in with Facebook, or Connect Facebook"
  - command: "curl preview /account"
    exit_code: 0
    result: "HTTP 307 to /login?returnTo=%2Faccount"
  - command: "curl preview /privacy"
    exit_code: 0
    result: "HTTP 200; present-tense enabled-preview Connect/Disconnect; public_profile only; production unreleased; stale not-yet-enabled wording absent"
  - command: "curl production /privacy and /"
    exit_code: 0
    result: "production /privacy remains 404; production home remains 200"
functional_preview_required: true
functional_preview:
  status: "ready"
  url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
  privacy_url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/privacy"
  deletion_url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/privacy#facebook-data-deletion"
  account_url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/account"
  start_command: null
  environment: "non_production"
  pages_project: "open-marketplace-demo"
  preview_database: "open-marketplace-account-preview-d1"
owner_manual_checklist:
  - "Hard-refresh the HTTPS preview and sign in with email/password. /login must remain email/password only."
  - "Open Account settings and confirm Facebook Connect is available as a connector, not a marketplace sign-in."
  - "Choose Connect and confirm the Facebook consent wording/permission set is consumer Facebook Login public_profile only."
  - "Confirm Connected displays provider-supplied Facebook name/profile identity."
  - "Confirm the Open Marketplace email and core name/photo do not change to Facebook values."
  - "Confirm Disconnect removes the Facebook connection and Connected display, stops future Facebook access, and leaves the Open Marketplace account/session intact."
  - "Open /privacy and #facebook-data-deletion and confirm they describe enabled preview Connect/Disconnect in the present tense and do not say the feature is not yet implemented."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Codex reviews this handoff and the forward-only revert plus Facebook/privacy correction."
  - "Human owner performs Connect -> consent -> Connected -> Disconnect on the corrected preview."
recommended_next_action: "Codex accepts or rejects OM-ACC-010 from this evidence. If accepted, the human owner runs the Facebook Connected -> Disconnect checklist. Do not merge PR #21 or deploy production."
---

# Agent Handoff: OM-ACC-010

## Objective received

Restore `feature/account-management-portal` to authorized Facebook-only preview scope by forward-reverting the seven unassigned commits after `6ec6386`, keep the no-email `public_profile` Facebook fetch, stop copying Facebook name/photo into the core Open Marketplace user, synchronize `/privacy` to present-tense preview Connect/Disconnect, and redeploy preview only.

## Shared-memory citations

Read from GitHub `PeterJFrancoIII/Open-Marketplace` `origin/main` `96adc20d240f6dd644e74981778d86eeb1e3808b` before edits:

- `Master_Descriptor.md`
- `AGENTS.md`
- `agent-memory/README.md`
- `agent-memory/STATE.md`
- `agent-memory/TASKS.md`
- `agent-memory/DECISIONS.md` (`OM-DEC-016`, `OM-DEC-017`)
- `agent-memory/HANDOFF_TEMPLATE.md`
- `CURSOR_START_HERE.md`

Start-head `95ee1cfd15f484d7150028e8aedcb509996ee38c` matched. Baseline `6ec638625805750701a571d6708cc1528abe9857` was an ancestor.

## Work performed

1. Forward-reverted the seven unassigned commits after `6ec6386` with `git revert --no-edit`. No force-push, reset, or squash. After those reverts the tree matched `6ec6386` exactly.
2. Removed `fillEmptyProfileFromFacebook` and every write of Facebook name/photo into `auth_users`. `getUserInfo` still uses the custom Graph `public_profile` field set and does not request email. `updateUserInfoOnLink` remains `false`. Connected identity stays connection-scoped via `getFacebookConnection`.
3. Updated `/privacy` and `#facebook-data-deletion` to present-tense enabled-preview wording. Production remains unreleased. No privacy email, phone, or postal address was invented.
4. Added restore-invariant and connection-boundary tests.

## Verification evidence

Recorded in front matter. Lint passed. `npm test` passed 40/40. Pages run `31950530604` succeeded. Preview `/login` is email/password only. Signed-out `/account` redirects to login. Preview `/privacy` describes enabled Connect/Disconnect. Production `/privacy` remains 404.

`git diff --name-only 6ec6386..HEAD` contains only the authorized Facebook/privacy correction, tests, and this handoff after the handoff commit.

## Runnable preview

https://feature-account-management-p.open-marketplace-demo.pages.dev/

Owner checklist is copied above. `owner_manual_result` remains `not_run`.

## Deviations and risks

- Friday listing-edit, photo-management, pay-to/shipping, and compose social-trust removal are gone because OM-ACC-010 required removing the entire unreviewed range. Those ideas need later architect tasks if the owner still wants them.
- Listing compose again shows the Social trust profile fields that existed at `6ec6386`. That is restore behavior, not a new product decision.
- `GET /api/shipping/quotes` on preview returned HTTP 405 after the route was removed. There is no Parcel Monkey quote handler in the restored tree.
- Facebook tokens were not printed, inspected, or copied.

## Review request

Review the seven forward reverts, the Facebook connection-data boundary, the privacy present-tense sync, the 40-test run, Pages deploy `31950530604`, and the HTTPS probes. Do not accept the owner Facebook gate from this handoff. Do not merge PR #21. Do not deploy production.
