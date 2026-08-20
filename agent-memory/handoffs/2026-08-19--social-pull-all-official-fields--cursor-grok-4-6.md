---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "SOCIAL-PULL-ALL-OFFICIAL-FIELDS"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-19T22:20:00Z"
completed_at: "2026-08-19T22:27:00Z"
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
    - "agent-memory/handoffs/2026-08-19--social-first-line-credit--cursor-grok-4-6.md"
    - "agent-memory/handoffs/2026-08-19--tiktok-scopes-basic-profile-stats--cursor-grok-4-6.md"
files_changed:
  - "lib/social-connectors.ts"
  - "lib/social-credit.ts"
  - "lib/types.ts"
  - "lib/auth.ts"
  - "lib/facebook-listing-proof.ts"
  - "app/account/account-settings.tsx"
  - "app/privacy/page.tsx"
  - "tests/facebook-connect.test.mjs"
  - "tests/social-connectors.test.mjs"
  - "tests/tiktok-connect.test.mjs"
  - "agent-memory/handoffs/2026-08-19--social-pull-all-official-fields--cursor-grok-4-6.md"
verification:
  - command: "npm test"
    exit_code: 0
    result: "128/128 tests passed after vinext build"
  - command: "npm run lint"
    exit_code: 0
    result: "0 errors; 4 pre-existing warnings in messages-client.tsx and marketplace.tsx"
functional_preview_required: false
functional_preview:
  status: "not_applicable"
  url: null
  start_command: null
owner_manual_checklist: []
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Codex review of OfficialSocialProfile extras and Facebook Graph field fallback"
  - "Sandbox can keep basic+profile for Add account; add user.info.stats after testers exist if live counts are required"
  - "Uncommitted work is not on public preview URLs until pushed"
recommended_next_action: "Codex review SOCIAL-PULL-ALL-OFFICIAL-FIELDS. Do not add video.list or extra OAuth scopes. Do not deploy production or submit the TikTok app."
contains_secrets_or_private_data: false
---

# Agent Handoff: SOCIAL-PULL-ALL-OFFICIAL-FIELDS

## Objective received

Owner asked to pull more info from Connect users by default: “I want everything.”

Interpreted as: persist every official public field the current Connect tokens already return. Do not add new OAuth scopes that break authorize, do not import videos or messages, and do not copy provider emails onto Open Marketplace identity.

## Shared-memory citations

Read `Master_Descriptor.md`, `agent-memory/STATE.md`, `agent-memory/TASKS.md`, `agent-memory/DECISIONS.md`, and prior TikTok / social-first handoffs. No `TASKS.md` row exists for this slice. Work continued on human-owner instruction after TikTok Login succeeded.

## Work performed

- TikTok Login Kit user.info fields now include `is_verified`. That value is stored as a provider mark (`providerVerified` / `hasProviderBadge`), never as an Open Marketplace verification badge. Official TikTok user.info fields are exhausted without new scopes.
- Facebook Graph `/me` now requests `about`, `website`, `hometown`, and `location` as fields on the existing `public_profile` / `user_link` token, with fallback to the core field set if Graph rejects the extras. No `email`, `user_birthday`, `user_location`, or `user_hometown` scopes.
- Instagram, X, LinkedIn, Reddit, and Discord readers persist remaining official public fields already returned by their current tokens: bio, website, banner, location, locale, account type, listed count, karma/friends, and provider verified marks where applicable. Discord email-verified and Reddit `has_verified_email` are not treated as badges.
- Account Settings shows bio, website, banner, location, account type, listed count, and a provider-verified note that is not an Open Marketplace badge.
- Facebook Connect tests now allow Graph `location` / `hometown` as fields and still forbid email and birthday.

## Verification evidence

- `npm test` exit 0: 128/128 after `vinext` build.
- `npm run lint` exit 0: 0 errors.

## Runnable preview

Not required. Public preview URLs still serve the last pushed commit, not this uncommitted slice.

## Deviations and risks

- “Everything” does not include DMs, friend lists, videos, posting, or extra OAuth scopes. TikTok `video.list` still breaks sandbox Add account / authorize.
- Facebook `hometown` / `location` are extra Graph fields. If a live token cannot return them, the core-field fallback still connects.
- TikTok sandbox should keep basic + profile for Add account until testers exist; app code already requests basic + profile + stats.
- Work is uncommitted. No commit, push, merge, deploy, or TikTok app submission was performed.

## Review request

Codex should review the OfficialSocialProfile / SocialProof extras, Facebook Graph field fallback, and the provider-verified-is-not-OM-verified rule. Do not mark accepted from this handoff.
