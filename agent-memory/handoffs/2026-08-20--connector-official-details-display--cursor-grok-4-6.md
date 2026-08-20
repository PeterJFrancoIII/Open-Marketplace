---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-CONNECTOR-DETAILS-DISPLAY"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-20T20:07:00Z"
completed_at: "2026-08-20T20:12:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "a0301d2514da6da6f6bc81f84f852035b95f8335"
head_commit: "uncommitted"
authority: "human_owner_direct_instruction"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "a0301d2514da6da6f6bc81f84f852035b95f8335"
  paths:
    - "Master_Descriptor.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "agent-memory/handoffs/2026-08-20--facebook-url-blocked-redirect-fixed--cursor-grok-4-6.md"
files_changed:
  - "lib/types.ts"
  - "lib/official-connector-facts.ts"
  - "lib/facebook-listing-proof.ts"
  - "lib/social-connectors.ts"
  - "lib/social-health.ts"
  - "lib/auth.ts"
  - "app/account/account-settings.tsx"
  - "app/marketplace.tsx"
  - "app/globals.css"
  - "app/privacy/page.tsx"
  - "tests/official-connector-facts.test.mjs"
  - "tests/facebook-listing-proof.test.mjs"
  - "tests/facebook-connect.test.mjs"
  - "agent-memory/handoffs/2026-08-20--connector-official-details-display--cursor-grok-4-6.md"
verification:
  - command: "npm test"
    exit_code: 0
    result: "133/133 tests passed after vinext build"
  - command: "npm run lint"
    exit_code: 0
    result: "0 errors; 4 pre-existing warnings in messages-client.tsx and marketplace.tsx"
functional_preview_required: true
functional_preview:
  status: "code_not_on_public_preview"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/"
  start_command: null
  note: "This slice is uncommitted. Development Pages still serves a0301d2 until the owner or Codex authorizes commit and a non-production preview deploy."
owner_manual_checklist:
  - "After this branch is preview-deployed, sign in on development and open Account settings."
  - "Confirm Facebook still shows the official name, photo, hometown, location, locale, gender, age range, about, website, and cover when Facebook sends them."
  - "Open one of your listings on the development homepage and confirm the Facebook chip shows those same official details, not only Connected with Facebook Login."
  - "Confirm Open Marketplace name and email did not change."
  - "Confirm Facebook still does not show a friends count or a fake join date."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Commit and preview-deploy only if the owner or Codex authorizes it. Do not deploy production or overwrite the live bookmark."
  - "Owner checks Account settings and a listing after the development preview includes this code."
  - "Instagram app creation remains separate and is still waiting."
recommended_next_action: "Codex review OWNER-CONNECTOR-DETAILS-DISPLAY. After review, authorize commit and a non-production development preview deploy so the owner can confirm listing chips match Account settings. Do not switch the Facebook app to Live and do not submit App Review."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-CONNECTOR-DETAILS-DISPLAY

## Objective received

Make sure every official field pulled from social connectors is shown to users in the same style as the current Account settings connector cards.

## Shared-memory citations

Read local `a0301d2514da6da6f6bc81f84f852035b95f8335` plus STATE, TASKS, DECISIONS, AGENTS, and the 2026-08-20 Facebook URL-blocked-fixed handoff. No TASKS.md row exists. Authority is human-owner direct instruction.

## Work performed

- Account settings already fetched official Facebook and other connector fields, but listings only stored boolean flags. Facebook listing health also dropped those values on recheck.
- Persisted the official public values on `SocialProof` (name, photo, bio, location, hometown, website, banner, locale, gender, age range, account type, created date, and public counts the provider actually returns).
- Account settings and listing chips now share `officialConnectorDisplay`, so buyers see the same official details Account settings already showed.
- Facebook still does not invent friends or a join date. Provider emails still are not published. Open Marketplace name and email are still not overwritten.

## Verification evidence

`npm test` 133/133. `npm run lint` 0 errors. This slice is uncommitted.

## Runnable preview

Development Account settings and homepage remain `https://feature-community-surface-re.open-marketplace-demo.pages.dev/`. They will not show this listing-display change until the branch is committed and the development Pages alias is redeployed.

## Deviations and risks

- No TASKS.md row. Scope stayed on displaying already-pulled official connector fields.
- Facebook Graph photo and cover URLs can expire. Account settings still refetches them live; stored listing image URLs may later go stale.
- Existing connected Facebook data is rewritten the next time Account settings loads after this code is deployed.

## Review request

Codex should review the SocialProof persist change and the shared listing/Account settings display. Do not mark accepted until the owner reports a listing-chip pass on the development preview.
