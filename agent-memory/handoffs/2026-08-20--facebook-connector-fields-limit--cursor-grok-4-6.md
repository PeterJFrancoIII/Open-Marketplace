---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-FACEBOOK-CONNECTOR-FIELDS"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-20T20:15:00Z"
completed_at: "2026-08-20T20:20:00Z"
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
    - "agent-memory/handoffs/2026-08-20--connector-official-details-display--cursor-grok-4-6.md"
files_changed:
  - "lib/official-connector-facts.ts"
  - "app/account/account-settings.tsx"
  - "app/globals.css"
  - "app/privacy/page.tsx"
  - "tests/official-connector-facts.test.mjs"
  - "agent-memory/handoffs/2026-08-20--facebook-connector-fields-limit--cursor-grok-4-6.md"
verification:
  - command: "node --experimental-strip-types --test tests/official-connector-facts.test.mjs"
    exit_code: 0
    result: "4/4 official-connector-facts tests passed"
functional_preview_required: true
functional_preview:
  status: "code_not_on_public_preview"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/"
  start_command: null
owner_manual_checklist:
  - "On Account settings, the Facebook connector should list labeled official fields Facebook actually sent, not a jammed one-line string."
  - "The Facebook note should say Facebook currently sends name, photo, profile link, hometown, and current city, and that bio, cover, locale, website, friends, and work or education are not available to apps."
  - "Do not treat this as proof that Facebook sent extra fields the owner expected from the Facebook.com profile page."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Owner must explicitly authorize commit and push before this labeled display and copy can reach the development Pages preview."
  - "Do not add user_gender or user_age_range unless the owner explicitly requests that reconnect."
  - "Instagram still needs a separate Instagram app; this slice did not start that work."
recommended_next_action: "Codex should review the Facebook field-limit explanation and the labeled official-fact rows. Do not mark accepted until the owner confirms they understand Facebook is not withholding extra Login fields under the current scopes."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-FACEBOOK-CONNECTOR-FIELDS

## Objective received

The owner reported that the Facebook connector only showed a name plus two cities, and believed Facebook must be sending more.

## Shared-memory citations

Read `Master_Descriptor.md`, `agent-memory/README.md`, `agent-memory/STATE.md`, `agent-memory/TASKS.md`, `agent-memory/DECISIONS.md`, and the prior connector-display handoff. There is still no `TASKS.md` row for this Meta work. Authority remains human-owner direct instruction.

## Work performed

- Confirmed current Facebook Login scopes are only `public_profile`, `user_link`, `user_hometown`, and `user_location`.
- Confirmed Meta’s current `public_profile` set is name, picture, and app-scoped id, plus the default name parts. `user_link` adds the profile URL. `user_hometown` and `user_location` add the two cities.
- Confirmed Facebook Graph still requests extras (`about`, `website`, `locale`, `cover`, `gender`, `age_range`) but Meta no longer returns locale, cover, or about to apps. Gender and age range need extra permissions this app does not request.
- Did not add `user_gender` or `user_age_range`. Did not request friends, Pages, Marketplace, Commerce, email, birthday, or phone.
- Updated Account settings and Privacy copy so they no longer promise locale, cover, about, website, gender, or age range as if Facebook currently sends them.
- Account settings now renders labeled official rows (`Name`, `Current city`, `Hometown`, and any other official value that is actually present) instead of one jammed line.
- Did not invent Facebook friends, a join date, work, education, or any field Facebook did not return.

## Verification evidence

`node --experimental-strip-types --test tests/official-connector-facts.test.mjs` exited 0 with 4 passing tests. Full `npm test` was not re-run after this copy and labeling slice.

## Runnable preview

The development Pages URL still serves `a0301d2514da6da6f6bc81f84f852035b95f8335`. This labeled-row and copy change is uncommitted and not on that preview.

## Deviations and risks

- Showing first and last name as separate rows can look like padding when they already appear in the full name. They are official Graph fields, not invented values.
- Requesting `user_gender` or `user_age_range` would force a reconnect and would likely fail Live App Review if used only to decorate a listing.

## Review request

Review that the product now tells the truth about the Facebook Login field set, and that the UI labels official values instead of implying Facebook is withholding extra Login data.
