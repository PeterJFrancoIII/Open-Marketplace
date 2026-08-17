---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OM-UNASSIGNED-005"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-17T21:46:00Z"
completed_at: "2026-08-17T21:53:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/account-management-portal"
worktree: ".worktrees/om-acc-004"
base_commit: "2f224524e5dc5181a90b2df33e4e560e60103bea"
head_commit: "uncommitted"
authority: "human_owner_override_2026-08-17"
canonical_task_status: "not_in_TASKS_md; owner overrode paste-and-save social for Connect-only"
supersedes_decision_note: "OM-DEC-014 said social paste-and-save and OAuth Connect were out of scope. Human owner now requires Connect and forbids typed social links."
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "f9bcb4c6f4f75c2e0c150b37cd1616e25c2fc589"
  paths:
    - "Master_Descriptor.md"
    - "AGENTS.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
pull_request: 21
pull_request_state: "draft"
force_push: false
remote_reset: false
oauth_or_secrets_changed: false
production_changed: false
merged: false
contains_secrets_or_private_data: false
files_changed:
  - "app/account/account-settings.tsx"
  - "app/api/listings/route.ts"
  - "app/marketplace.tsx"
  - "lib/facebook-listing-proof.ts"
  - "lib/profile-settings.ts"
  - "tests/auth-live-flow.test.mjs"
  - "tests/facebook-connect.test.mjs"
  - "tests/facebook-listing-proof.test.mjs"
  - "tests/social-connect-only.test.mjs"
  - "agent-memory/handoffs/2026-08-17--owner-social-connect-only--cursor-grok-4-6.md"
verification:
  - {command: "npm run lint", exit_code: 0, result: "0 errors; 4 pre-existing warnings"}
  - {command: "npm test", exit_code: 0, result: "102 passed, 0 failed"}
functional_preview_required: true
functional_preview:
  status: "pending_pages_deploy_after_push"
  url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
  start_command: null
owner_manual_checklist:
  - "Open Account settings. Confirm there is no username, profile URL, created-date, or follower field for Facebook, Instagram, or TikTok."
  - "Facebook still offers Connect / Connected / Disconnect only."
  - "Instagram and TikTok say official Connect is not available yet and cannot be typed in."
  - "A previously pasted social link no longer appears on live listings."
  - "After Facebook Connect, listings may show Connected Facebook; spoofed pasted URLs do not."
owner_manual_result: "not_run"
remaining_work:
  - "Instagram official Connect is not implemented. Needs Codex task, Meta app credentials, scopes, and privacy updates."
  - "TikTok official Connect is not implemented. Needs Codex task, TikTok Login Kit credentials, and privacy updates."
recommended_next_action: "Owner hard-refreshes the account-portal preview after Pages deploy and confirms typed social fields are gone. Codex should author Instagram/TikTok Connect tasks if those providers must be attachable. Do not merge PR #21 or deploy production."
---

# Agent Handoff: social Connect-only

Owner asked to remove typed social-media entry so sellers cannot
spoof fake profile links. Social profiles must come from Connect.

## Work performed

- Removed the Account settings form that accepted usernames, URLs,
  created dates, and follower counts.
- Removed the post-Connect Facebook URL field and Save Facebook
  profile button.
- Server rejects any client-supplied `socialAccounts` payload except
  an empty list.
- Stored and public social proofs keep only `metricsSource: oauth`.
- Listing publish/edit no longer downgrades connected proofs to
  self-reported.
- Live listing cards hide pasted/self-reported social. Demo catalog
  listings are unchanged.

## Deviations and risks

- Facebook Connect already existed and remains the only working
  social Connect. Instagram and TikTok Connect are not built; those
  rows are honest unavailable states, not paste fields.
- Payment destinations remain typed public contacts. Owner asked
  only about social media accounts.
- OM-DEC-014 still says paste-and-save social in canonical memory.
  Human owner instruction outranks that decision; Codex should
  supersede OM-DEC-014 after review.
- No new OAuth providers, scopes, or secrets were added.
