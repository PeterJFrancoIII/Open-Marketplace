---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "owner-social-connectors"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-17T22:00:00Z"
completed_at: "2026-08-17T22:15:44Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/account-management-portal"
base_commit: "cbe64b5804abb7907e6570fc6fdde1fd153bf951"
head_commit: "d0484dfc9187fa7569802b1c2627ab8634502778"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "cbe64b5804abb7907e6570fc6fdde1fd153bf951"
  paths:
    - "Master_Descriptor.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "agent-memory/handoffs/2026-08-17--owner-social-connect-only--cursor-grok-4-6.md"
files_changed:
  - ".env.example"
  - ".github/workflows/deploy-cloudflare-pages.yml"
  - "app/account/account-settings.tsx"
  - "app/account/settings/page.tsx"
  - "app/api/account/profile/route.ts"
  - "app/api/listings/route.ts"
  - "app/marketplace.tsx"
  - "app/privacy/page.tsx"
  - "lib/auth.ts"
  - "lib/conversations.ts"
  - "lib/profile-settings.ts"
  - "lib/social-connectors.ts"
  - "lib/social-credit.ts"
  - "lib/social-health.ts"
  - "lib/types.ts"
  - "scripts/configure-pages-preview.mjs"
  - "tests/auth-live-flow.test.mjs"
  - "tests/chat-sale-credit.test.mjs"
  - "tests/facebook-connect.test.mjs"
  - "tests/om-acc-010-restore.test.mjs"
  - "tests/social-connect-only.test.mjs"
  - "tests/social-connectors.test.mjs"
  - "agent-memory/handoffs/2026-08-17--owner-social-connectors--cursor-grok-4-6.md"
verification:
  - command: "npm test"
    exit_code: 0
    result: "109/109 tests passed after vinext build"
  - command: "npm run lint"
    exit_code: 0
    result: "0 errors, 4 pre-existing warnings"
functional_preview_required: true
functional_preview:
  status: "preview_push_submitted"
  url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
  start_command: null
owner_manual_checklist:
  - "Sign in on the preview, open Account settings, and confirm Facebook / Instagram / TikTok / X / LinkedIn / Reddit / Discord rows exist."
  - "Confirm there are no typed username, URL, created-date, or follower fields."
  - "Connect Facebook if preview Facebook credentials are still present."
  - "Confirm other Connect buttons stay unavailable until preview secrets are set."
  - "Confirm login still has no social sign-in."
  - "Confirm a listing shows only oauth Connected proofs and Social Credit can rise after Connect."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "Owner or Codex must add preview-only provider credentials before Instagram, TikTok, X, LinkedIn, Reddit, or Discord Connect will start."
  - "Instagram has no built-in Better Auth provider; genericOAuth uses Instagram Login URLs and may fail until a Meta app is configured."
recommended_next_action: "Wait for the non-production Pages preview of d0484df, then Codex review. Do not merge PR #21 or deploy production. Supersede OM-DEC-014 paste-and-save if this Connect-only catalog is accepted."
contains_secrets_or_private_data: false
---

# Agent Handoff: owner-social-connectors

## Objective received
Add every available social-media connector, harden anti-spoofing, persist every official field those connectors can return, and let more linked data raise Social Credit.

## Shared-memory citations
Read `Master_Descriptor.md`, `agent-memory/STATE.md`, `agent-memory/TASKS.md`, `agent-memory/DECISIONS.md`, and the prior Connect-only handoff at `cbe64b5804abb7907e6570fc6fdde1fd153bf951` on `feature/account-management-portal`. Canonical `TASKS.md` in this worktree is stale and still describes paste-and-save. The human owner overrode that for Connect-only. Cursor did not edit `STATE.md`, `TASKS.md`, `DECISIONS.md`, or `Master_Descriptor.md`.

## Work performed
- Added `lib/social-connectors.ts` for Facebook, Instagram, TikTok, X, LinkedIn, Reddit, and Discord. GitHub, Google, Apple, Slack, and PayPal stay out of this catalog. PayPal remains a payment connector.
- Wired Better Auth providers behind preview env pairs. Instagram uses `genericOAuth` because Better Auth has no built-in Instagram provider. Every provider has `disableSignUp` / `disableImplicitSignUp`. `/sign-in/social` and `/sign-in/oauth2` stay blocked. Tokens stay server-side.
- Persist only provider-returned public fields: handle, allowlisted HTTPS profile URL, account-created date, and public connection count when the official API sends one. Provider emails and image CDN URLs are not written to public `socialAccountsJson`.
- Client-typed `socialAccounts` still return `SOCIAL_CONNECT_ONLY_ERROR`. Listing GET/POST/PATCH publish only currently linked oauth proofs.
- Social Credit keeps the published rating formula when `connectedSocial` is omitted. Official links add up to 25 bonus points. Existing rating tests stay green.
- Account settings render the full catalog as Connect / Connected / Disconnect. Unavailable providers say official Connect is not on this copy. No typed social fields.
- Privacy policy adds an Other social Connect section and keeps the 16 August 2026 date.
- Preview Pages config and the non-`main` workflow can accept the new env pairs. Production Pages env remains `RELEASE_MODE` only.

## Verification evidence
- `npm test` exit 0: 109/109.
- `npm run lint` exit 0: 0 errors, 4 pre-existing warnings.

## Runnable preview
Pushed `d0484df` to `feature/account-management-portal`. Preview URL: `https://feature-account-management-p.open-marketplace-demo.pages.dev/`. `owner_manual_result: not_run`.

## Deviations and risks
- Human instruction outranks `OM-DEC-014` paste-and-save. Codex should supersede that decision if this catalog is accepted.
- Instagram Login may fail even with credentials because Meta deprecated Basic Display.
- TikTok, X, LinkedIn, Reddit, and Discord Connect will not start until preview secrets exist.
- Facebook still does not request email, friends, birthday, or government-ID claims.
- No production D1, secrets, DNS, or Pages production settings were changed.

## Review request
Review the connector catalog, Better Auth wiring, oauth-only persist path, Social Credit bonus, privacy copy, and production isolation. Do not mark accepted, merge PR #21, or deploy production from this handoff.
