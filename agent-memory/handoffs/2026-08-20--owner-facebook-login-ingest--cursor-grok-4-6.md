---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-FACEBOOK-LOGIN-INGEST"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-20T17:57:00Z"
completed_at: "2026-08-20T18:06:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "38e7f7f18752e9d39ef8917d5bcfe7ce4d1bdde8"
head_commit: "uncommitted"
authority: "human_owner_direct_instruction"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "38e7f7f18752e9d39ef8917d5bcfe7ce4d1bdde8"
  paths:
    - "Master_Descriptor.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "agent-memory/handoffs/2026-08-19--social-pull-all-official-fields--cursor-grok-4-6.md"
    - "agent-memory/handoffs/2026-08-19--owner-instagram-connect-create-app--cursor-grok-4-6.md"
files_changed:
  - "lib/auth.ts"
  - "lib/facebook-listing-proof.ts"
  - "lib/social-connectors.ts"
  - "lib/types.ts"
  - "app/account/account-settings.tsx"
  - "app/privacy/page.tsx"
  - "tests/facebook-connect.test.mjs"
  - "tests/privacy-policy.test.mjs"
  - "tests/social-connectors.test.mjs"
  - "agent-memory/handoffs/2026-08-20--owner-facebook-login-ingest--cursor-grok-4-6.md"
verification:
  - command: "npm test"
    exit_code: 0
    result: "130/130 tests passed after vinext build"
  - command: "npm run lint"
    exit_code: 0
    result: "0 errors; 4 pre-existing warnings in messages-client.tsx and marketplace.tsx"
meta_developer_tools:
  app_id: "2058991838072366"
  app_name: "Open Marketplace"
  app_status: "dev_mode"
  is_live: false
  business_verification_passes: true
  can_submit_app_review: true
  privileges: []
  submission_status: "NO_SUBMISSION"
  compliance: "compliant"
  instagram_app_present: false
functional_preview_required: true
functional_preview:
  status: "code_not_on_public_preview"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings"
  start_command: null
  note: "This slice is uncommitted. Public live and development Pages URLs still serve the prior Facebook Login scopes."
owner_manual_checklist:
  - "After this branch is preview-deployed, open Account settings while signed in."
  - "Disconnect Facebook, then Connect Facebook again so Meta can grant user_hometown and user_location."
  - "Confirm Facebook still does not sign you into Open Marketplace and does not replace the Open Marketplace name or email."
  - "If Facebook returns hometown, location, locale, gender, age range, or cover, confirm they appear only on the Facebook connector."
  - "Confirm no Facebook email, birthday, phone, friends, Pages, Marketplace, or Commerce prompt appears."
owner_manual_result: "not_run"
blockers:
  - "Instagram Login ingest cannot start: Meta app list still contains only 2058991838072366 (app type None). Official Instagram Login needs a separate Instagram app and preview INSTAGRAM_CLIENT_ID / INSTAGRAM_CLIENT_SECRET. Cursor browser MCP is not connected."
remaining_work:
  - "Codex review of the four Facebook Login scopes and Graph field fallbacks."
  - "Commit and preview-deploy only if the owner or Codex authorizes it. Do not deploy production."
  - "Owner reconnect of Facebook after the preview includes this code."
  - "Create a separate Meta Instagram app (name must not contain Instagram/Insta/Gram), store preview-only Instagram credentials, then continue Instagram Connect."
  - "Do not submit Meta App Review and do not switch the Facebook app to Live unless the owner explicitly asks."
recommended_next_action: "Codex review OWNER-FACEBOOK-LOGIN-INGEST. After review, authorize commit and a non-production preview deploy so the owner can Disconnect and Connect Facebook. Do not treat business verification as App Review or Live access. Do not create Instagram credentials in this slice."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-FACEBOOK-LOGIN-INGEST

## Objective received

Owner reported that the Meta Developer business account was approved and asked to initiate full Login account-details ingestions now that that authorization exists.

## Shared-memory citations

Read `Master_Descriptor.md`, `agent-memory/STATE.md`, `agent-memory/TASKS.md`, `agent-memory/DECISIONS.md`, and the 2026-08-19 social-field and Instagram create-app handoffs. No `TASKS.md` row exists for this slice. Authority is human-owner direct instruction on `feature/community-surface-reports` at `38e7f7f18752e9d39ef8917d5bcfe7ce4d1bdde8`.

## Work performed

- Confirmed with Meta Developer Tools MCP on app `2058991838072366` that `business_verification_passes` is true, the app remains Development / not Live, App Review privileges are still empty, and compliance is clean. Business verification is not Advanced Access.
- Facebook Connect now requests official Login scopes `public_profile`, `user_link`, `user_hometown`, and `user_location`. Existing tokens will not gain hometown/location until the owner Disconnects and Connects again after this code is on a preview.
- Graph `/me` now also asks for `locale`, `cover`, `age_range`, and `gender` as fields. Those stay connection-scoped. Meta documents `locale` and `cover` as deprecated and `age_range` / gender as App Review items, so they may come back empty. Graph reads try the full field set, then hometown/location extras, then the core public-profile set, so a rejected extra field cannot drop hometown and location.
- Still forbidden: Facebook `email` field, `user_birthday`, `user_mobile_phone`, `user_friends`, Pages, Marketplace, Commerce, posting, and DMs. Facebook data does not replace Open Marketplace email, name, or image. `/api/auth/get-access-token` stays blocked.
- Account Settings and Privacy describe the new scopes and stored fields. Privacy effective date is 20 August 2026. Exclusions now also name birthday and mobile phone.
- Instagram Login was not started. The only granted Meta app is still the existing Facebook app.

## Verification evidence

`npm test` exit 0: 130/130. `npm run lint` exit 0: 0 errors, 4 pre-existing warnings.

## Runnable preview

Public development URL `https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings` does not include this uncommitted slice. Owner reconnect cannot ingest the new Facebook fields until Codex or the owner authorizes commit and a non-production preview deploy.

## Deviations and risks

- Interpreted “full login account details” as official Facebook Login public fields that testers can grant in Development after business verification. Did not add `user_gender`, `user_age_range`, `email`, birthday, phone, or friends scopes.
- Did not submit App Review and did not switch the app to Live.
- Cursor browser MCP is unavailable, so the separate Instagram app still cannot be created from this session.

## Review request

Codex should review the four Facebook Login scopes, the three-tier Graph field fallback, connection-scoped storage of hometown/location/locale/gender/age range/cover, and the privacy copy. Do not mark accepted, merge, or deploy production from this handoff.
