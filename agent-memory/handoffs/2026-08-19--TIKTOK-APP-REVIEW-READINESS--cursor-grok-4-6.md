---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "TIKTOK-APP-REVIEW-READINESS"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-19T21:25:00Z"
completed_at: "2026-08-19T21:34:11Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "0422f5c1dccae33fcde01ec7fac7d10af6b254a3"
head_commit: "uncommitted"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "a5598425e566888c9d79d5977e6f5ccaf9359e4b"
  paths:
    - "Master_Descriptor.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "agent-memory/handoffs/2026-08-19--TIKTOK-APP-REVIEW-READINESS--gpt.md"
    - "agent-memory/HANDOFF_TEMPLATE.md"
files_changed:
  - "app/account/account-settings.tsx"
  - "app/privacy/page.tsx"
  - "app/terms/page.tsx"
  - "lib/auth.ts"
  - "lib/social-connectors.ts"
  - "tests/privacy-policy.test.mjs"
  - "tests/rendered-html.test.mjs"
  - "tests/social-connectors.test.mjs"
  - "tests/tiktok-connect.test.mjs"
  - "agent-memory/handoffs/2026-08-19--TIKTOK-APP-REVIEW-READINESS--cursor-grok-4-6.md"
verification:
  - command: "npm test"
    exit_code: 0
    result: "128/128 tests passed after vinext build"
  - command: "npm run lint"
    exit_code: 0
    result: "0 errors, 4 pre-existing warnings"
functional_preview_required: true
functional_preview:
  status: "code_uncommitted_not_redeployed"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/"
  start_command: null
owner_manual_checklist:
  - "Do not submit the TikTok application from this handoff."
  - "Do not deploy production."
  - "If the TikTok developer password was pasted into chat, change it."
  - "Add the owner TikTok @handle to Sandbox Target Users."
  - "In the TikTok portal, keep Web + Login Kit only and remove user.info.profile / user.info.stats if they are still selected."
  - "After Codex review and a non-production deploy of this uncommitted tree, record the 18-step sandbox demo video."
owner_manual_result: "not_run"
blockers:
  - "TASKS.md has no registered execution-ready row for TIKTOK-APP-REVIEW-READINESS; work proceeded on human-owner instruction."
  - "Planning packet named reconcile/social-connect-catalog, whose remote and preview are gone; implementation used the current program feature/community-surface-reports."
  - "Reviewer-facing domain is still a Cloudflare Pages preview (*.pages.dev). TikTok rejects apps that are only in development or testing."
  - "Sandbox Target Users is still empty until the owner supplies a TikTok @handle."
  - "This code is uncommitted and not on the live/development preview yet."
  - "Sandbox demo video has not been recorded."
remaining_work:
  - "Codex registers a TASKS.md row and reviews this uncommitted diff."
  - "Owner/Codex choose a reviewer domain that is not a development-only surface."
  - "Owner adds TikTok @handle to sandbox Target Users and confirms portal scopes are user.info.basic only."
  - "Non-production deploy of this tree, then record the 18-step demo video."
  - "Owner submits to TikTok only after those gates and an explicit owner decision."
recommended_next_action: "Codex reviews the uncommitted TikTok review-readiness diff and remaining submission blockers. Do not submit to TikTok or deploy production."
contains_secrets_or_private_data: false
tiktok_submission_authorized: false
production_deploy_authorized: false
---

# Agent Handoff: TIKTOK-APP-REVIEW-READINESS

## Objective received

Follow the ChatGPT planning packet at
`agent-memory/handoffs/2026-08-19--TIKTOK-APP-REVIEW-READINESS--gpt.md`
(commit `a5598425e566888c9d79d5977e6f5ccaf9359e4b`) and set up everything
needed for a future first TikTok Login Kit app review. Do not submit,
deploy production, or mark owner approval.

## Shared-memory citations

- Planning packet: `PeterJFrancoIII/Open-Marketplace` `main`
  `a5598425e566888c9d79d5977e6f5ccaf9359e4b`
  `agent-memory/handoffs/2026-08-19--TIKTOK-APP-REVIEW-READINESS--gpt.md`
- Official docs re-fetched 2026-08-19:
  - https://developers.tiktok.com/doc/app-review-guidelines
  - https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info
- `user.info.basic` fields: `open_id`, `union_id`, `avatar_url`,
  `avatar_url_100`, `avatar_large_url`, `display_name`
- `username` and `profile_deep_link` require `user.info.profile` and
  were not requested
- Named packet source `reconcile/social-connect-catalog` is gone
  (remote deleted; preview 404). Implementation used the current
  program: `feature/community-surface-reports` @
  `0422f5c1dccae33fcde01ec7fac7d10af6b254a3`

## Work performed

- Reduced TikTok Connect to `user.info.basic` only.
- User-info reads now request only basic fields. No username, profile
  link, avatar URL, or stats are stored or shown.
- Fail-closed TikTok status: a stored auth row is not enough. Invalid
  or revoked authorization shows **Needs reconnect** with Disconnect
  and Connect TikTok.
- Disconnect removes the TikTok link and leaves the Open Marketplace
  user intact.
- TikTok is excluded from public listing social proofs and from Social
  Credit input. The Social Credit formula file was not changed.
- Expanded `/terms` into a public Terms of Service covering the packet
  legal topics plus TikTok Connect.
- Generalized `/privacy` with a TikTok Login Kit section, deletion
  behavior, no sale of TikTok data, and an 19 August 2026 date.
- Homepage footer already exposes Terms and Privacy without opening a
  menu; tests now lock that in.
- Added/updated automated coverage for scopes, state rejection, token
  non-leakage, identity isolation, fail-closed reconnect, disconnect,
  listing-proof exclusion, Terms, Privacy, and visible legal links.

## TikTok configuration snapshot

- Products selected: Web, Login Kit only
- Scopes selected in code: `user.info.basic`
- Redirect URI (development preview, not a final review domain):
  `https://feature-community-surface-re.open-marketplace-demo.pages.dev/api/auth/callback/tiktok`
- Public Website URL (current non-production tracks; not production):
  - Development: `https://feature-community-surface-re.open-marketplace-demo.pages.dev/`
  - Live bookmark: `https://feature-account-management-p.open-marketplace-demo.pages.dev/`
- Terms URL target: `https://[FINAL-REVIEW-DOMAIN]/terms`
- Privacy URL target: `https://[FINAL-REVIEW-DOMAIN]/privacy`
- Sandbox: Open Marketplace Dev on app Open Marketplace
  (App ID `7675494970317998100`). Target Users still empty.
- Demo-video checklist: not recorded (all 18 steps pending)

## Reviewer-facing copy (do not submit until the review build matches)

Description (120-character field):

A peer-to-peer marketplace where people buy and sell items and optionally connect social profiles.

App Review explanation:

> Open Marketplace is a web-based peer-to-peer marketplace. TikTok integration is optional account linking for users who already have an Open Marketplace account. In Account Settings, the user selects Connect TikTok and authorizes TikTok Login Kit with user.info.basic. Our server exchanges the authorization code and uses the TikTok app-scoped open_id plus approved basic profile data only to confirm and display the linked TikTok identity. TikTok is not used to create or sign in to an Open Marketplace account. We do not post content, read videos or messages, or request follower statistics. Tokens remain server-side and are not published. Users can disconnect TikTok at any time, removing the linked authorization. The demo shows the complete sandbox flow on the submitted web domain: Open Marketplace sign-in → Connect TikTok → TikTok consent → Connected → Disconnect.

## Acceptance criteria

| Criterion | Result |
| --- | --- |
| TikTok operational on the authorized current program | **Blocked** — code is ready on this branch but uncommitted and not redeployed; named packet branch is gone |
| Only `user.info.basic` is requested | **Implemented** |
| Connect → authorization → Connected works in TikTok Sandbox | **Blocked** — needs portal Target User, basic-only portal scopes, and a deploy of this tree |
| Disconnect works | **Implemented** (automated) |
| Revoked/invalid authorization fails closed | **Implemented** (automated) |
| No TikTok social sign-in | **Implemented** |
| No overwrite of core Open Marketplace identity | **Implemented** |
| No public listing social proof introduced | **Implemented** |
| No Social Credit change introduced | **Implemented** |
| `/terms` is public | **Implemented** |
| `/privacy` is generalized and TikTok-aware | **Implemented** |
| Terms/Privacy links visible publicly | **Implemented** |
| Reviewer domain and TikTok configuration match | **Blocked** — `*.pages.dev` preview is not a settled review domain |
| Sandbox demo video complete | **Not implemented** |
| Lint/tests/diff check pass | **Implemented** — 128/128 tests; lint 0 errors / 4 pre-existing warnings; uncommitted |
| Reviewer-facing copy matches actual behavior | **Implemented** as draft copy; revise if the review build differs |

## Remaining rejection risks

- TikTok may reject a `*.pages.dev` preview as an unfinished development or testing site.
- Terms and Privacy must stay visible on the submitted Website URL without opening a menu.
- If the TikTok portal still has `user.info.profile` selected, reviewers will see extra scope.
- Empty Target Users blocks a real sandbox demo.
- Submitting before this uncommitted tree is deployed would show the older Facebook-oriented legal pages and the previous basic+profile copy.

## Review request

Codex should review the uncommitted diff against the GPT planning packet,
register a `TASKS.md` row if this workstream should remain canonical,
and decide the reviewer domain with the owner. Do not declare TikTok
submission-ready, do not mark owner approval, and do not deploy
production.
