---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "owner-override-restore-listing-tools"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-16T13:59:00Z"
completed_at: "2026-08-16T14:01:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/account-management-portal"
authority: "human_owner_explicit_override_2026-08-16"
overrides: "OM-ACC-010 restore-contract prohibition on retaining the unreviewed range"
kept_from_OM-ACC-010:
  - "Facebook fillEmptyProfileFromFacebook remains removed"
  - "updateUserInfoOnLink remains false"
  - "/privacy remains present-tense enabled-preview Connect/Disconnect"
head_commit: "pending_this_handoff"
pull_request: 21
pull_request_state: "draft"
force_push: false
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "96adc20d240f6dd644e74981778d86eeb1e3808b"
  paths:
    - "Master_Descriptor.md"
    - "AGENTS.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
oauth_or_secrets_changed: false
production_changed: false
merged: false
contains_secrets_or_private_data: false
files_changed:
  - "forward reapply commits 1e0c475..727d9e5"
  - "tests/om-acc-010-restore.test.mjs"
  - "agent-memory/handoffs/2026-08-16--owner-restore-listing-tools--cursor-grok-4-6.md"
verification:
  - command: "git revert --no-edit 91934bf^..c24212a"
    exit_code: 0
    result: "seven forward reapply commits; account/page.tsx conflict resolved without restoring fillEmptyProfileFromFacebook"
  - command: "git diff --check"
    exit_code: 0
    result: "no whitespace errors"
  - command: "npm run lint"
    exit_code: 0
    result: "eslint passed"
  - command: "npm test"
    exit_code: 0
    result: "54 tests passed, 0 failed"
functional_preview_required: true
functional_preview:
  status: "ready_after_push"
  url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
  environment: "non_production"
owner_manual_checklist:
  - "Hard-refresh the preview."
  - "Confirm List an item and Edit listing do not show Social trust profile fields."
  - "Confirm My listings titles open the listing popup and Edit opens the editor with assigned photos."
  - "Confirm listing detail shows Pay the seller and shipping estimate/calculator controls."
  - "Confirm Account settings still has payment/shipping connectors and Facebook Connect."
  - "Confirm Facebook Connect still does not change the Open Marketplace email/core name."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Codex records this owner override against OM-ACC-010."
  - "Human owner UI-checks the restored preview."
recommended_next_action: "Owner tests the preview. Codex updates canonical TASKS/STATE to match the owner override. Do not merge PR #21 or deploy production."
---

# Agent Handoff: owner restore of listing tools

## Objective received

Human owner instruction on 2026-08-16: bring back the Friday listing/account tools and test them, but do not restore Social trust profile editing on create/edit. Social trust on listings must come from OAuth or connect-style social connections and must not be typed or spoofed on the listing form.

This overrides the OM-ACC-010 instruction to leave the unreviewed range removed. Human owner authority outranks that task contract.

## Work performed

Forward-reapplied the seven OM-ACC-010 revert commits. Kept the Facebook connection-scoped identity fix and present-tense `/privacy` page. Create/edit still has no Social trust profile editor. POST/PATCH ignore browser-supplied `socialProofs` and copy account connector social only.

## Verification evidence

`npm run lint` passed. `npm test` passed 54/54, including owner-edit, photos, pay-to, shipping quotes, Facebook boundary, privacy present-tense, and no compose social editor.

## Deviations and risks

Instagram and TikTok Account settings fields remain typed URLs until those provider apps exist. They are not editable on the listing form. Facebook Connected identity remains the only OAuth social connector.

Codex previously rejected buyer postal persistence and a hard-coded USD→GBP quote factor. Those shipping behaviors are restored because the owner asked for the Friday tools back; they still need a later architect redesign if Codex keeps that objection.

## Review request

Review the owner override, the reapply commits, the preserved Facebook/privacy corrections, and the 54-test run. Do not merge PR #21. Do not deploy production.
