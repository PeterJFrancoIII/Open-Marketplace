---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "OWNER-CONNECT-PAYPAL-CONSENT-RETURN"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "blocked"
started_at: "2026-08-21T21:09:00Z"
completed_at: "2026-08-21T21:10:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/community-surface-reports"
base_commit: "e84c215b8a5eec88c97ba4b8b24d70ef639c9aeb"
head_commit: "e84c215b8a5eec88c97ba4b8b24d70ef639c9aeb"
authority: "human_owner_direct_instruction"
escalated_to: "gpt_main_agent"
community_surface:
  label: "PayPal input"
  href: "/account/settings?surface=paypal-input#surface-paypal-input"
shared_memory_refs:
  github_repository: "PeterJFrancoIII/Open-Marketplace"
  github_url: "https://github.com/PeterJFrancoIII/Open-Marketplace"
  repo_directory: "/Users/computer/App Development/Marketplace/open-exchange-cursor-project/.worktrees/om-crowd-001"
  assigned_memory_root: "agent-memory/"
  canonical_ref_or_commit: "e84c215b8a5eec88c97ba4b8b24d70ef639c9aeb"
  paths:
    - "agent-memory/README.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
    - "agent-memory/HANDOFF_TEMPLATE.md"
    - "Master_Descriptor.md"
files_changed:
  - "agent-memory/handoffs/2026-08-21--connect-paypal-escalated-to-gpt--cursor-grok-4-6.md"
verification: []
functional_preview_required: true
functional_preview:
  status: "reachable"
  url: "https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings?surface=paypal-input#surface-paypal-input"
  start_command: null
owner_manual_checklist:
  - "After GPT's fix is deployed, hard-refresh Account settings while signed in."
  - "Click Log in with PayPal and continue until Open Marketplace reloads."
  - "The PayPal row must say Linked."
  - "The PayPal input should show paypal.me if PayPal sent it, or a saved paypal.me."
  - "Open Marketplace name and email must stay unchanged."
  - "Do not mark this owner manual test passed."
owner_manual_result: "not_run"
blockers:
  - "Human owner retested after e84c215 and reported the same failure: PayPal Login page works, Open Marketplace still does not show PayPal connected and does not auto-fill paypal.me."
  - "Cursor Grok implementation path has failed this owner-visible outcome across multiple preview deploys. Owner directed escalation to the main GPT agent."
remaining_work:
  - "Prove whether /api/paypal/callback is reached after live Login, and why Linked is not stored."
  - "Make the Open Marketplace account show PayPal connected after a completed official Login."
  - "Populate paypal.me only from official PayPal data or an explicit post-Login save. Do not invent a handle."
recommended_next_action: "Main GPT agent owns the connector fix. Cursor Grok must not continue implementing this path. Do not mark accepted. Do not change the live bookmark. Do not put PayPal keys on production Pages."
contains_secrets_or_private_data: false
---

# Agent Handoff: OWNER-CONNECT-PAYPAL-CONSENT-RETURN

## Objective received
Owner: the connector takes the user to the correct PayPal page and logs the user in, but Open Marketplace does not show PayPal connected and does not populate paypal.me automatically. Owner then said to give the issue to the main agent and hand off to GPT.

## Shared-memory citations
Assigned shared-memory space for the GitHub repository directory that handles this work:

- GitHub repository: `PeterJFrancoIII/Open-Marketplace`
- GitHub URL: https://github.com/PeterJFrancoIII/Open-Marketplace
- Repo directory: `/Users/computer/App Development/Marketplace/open-exchange-cursor-project/.worktrees/om-crowd-001`
- Assigned memory root: `agent-memory/`
- Canonical commit: `e84c215b8a5eec88c97ba4b8b24d70ef639c9aeb`

Read `Master_Descriptor.md`, `agent-memory/README.md`, `agent-memory/STATE.md`, `agent-memory/TASKS.md`, `agent-memory/DECISIONS.md`, and the 2026-08-21 PayPal handoffs under `agent-memory/handoffs/`. Human-owner instruction outranks OM-DEC-014 for this connector. There is no TASKS.md row for this PayPal work; authority is human-owner direct instruction. Do not use another project's memory, chat history, or a different clone as the canonical space.

## Work performed
Cursor Grok implemented and preview-deployed several connector revisions on `feature/community-surface-reports`. Latest head `e84c215`. Owner retested and reported the same failure. This record escalates the issue; it does not change implementation code.

## Owner-visible failure
- Surface: `/account/settings?surface=paypal-input#surface-paypal-input`
- Development preview: `https://feature-community-surface-re.open-marketplace-demo.pages.dev/account/settings?surface=paypal-input#surface-paypal-input`
- Live bookmark, do not overwrite: `https://feature-account-management-p.open-marketplace-demo.pages.dev/`
- PayPal Login page works.
- After return, Open Marketplace still does not show the PayPal service as connected.
- paypal.me is not auto-filled.

## Product rules still in force
- Connect-only. No PayPal sign-in on `/login`.
- Do not overwrite Open Marketplace email, name, or image.
- Tokens stay server-side. `/api/auth/get-access-token` stays blocked.
- PayPal is a payment connector, not a Better Auth social sign-in provider.
- Official Log in with PayPal is required.
- Do not publish PayPal emails on listings.
- Do not put PayPal keys on production Pages.
- Do not invent a paypal.me handle from email or name.
- End users are personal PayPal users.
- Preview-only bindings are allowed.

## Verified connector facts
- Live authorize URL is `https://www.paypal.com/connect` with `scope=openid` only.
- Requesting `email`, `profile`, or `https://uri.paypal.com/services/paypalattributes` on this live app returned `(invalid scope)`.
- Official PayPal scope table has no paypal.me attribute. `openid` is Basic Authentication / no user attributes.
- Official token response documents `access_token`, not a required `id_token`.
- Callback is `GET /api/paypal/callback`. It upserts `authAccounts.providerId = "paypal"` and writes a pay-to only when email or paypal.me is present.
- `e84c215` already persists a link when a token is issued even if userinfo is empty, and allows a missing OAuth cookie when signed state matches the session.
- Tests at `e84c215`: `npm test` 145/145. Those tests do not prove the live PayPal return reaches this callback.

## Likely remaining causes for GPT to prove
1. The user finishes PayPal Login but never reaches `/api/paypal/callback` with `code` and `state` (remembered/consent SPA, back-button, or Return URL mismatch).
2. Token exchange fails against live `api-m.paypal.com` (`redirect_uri` or secret mismatch).
3. Session is missing on return (`error=paypal-session`).
4. Owner is reading development settings after PayPal redirected to a different registered Return URL.
5. Linked is stored but the empty paypal.me input is what the owner treats as “not connected.”

## Constraints for the GPT agent
- Shared-memory space assigned to this GitHub repo directory: `agent-memory/` in `PeterJFrancoIII/Open-Marketplace` at `/Users/computer/App Development/Marketplace/open-exchange-cursor-project/.worktrees/om-crowd-001`
- Worktree: `/Users/computer/App Development/Marketplace/open-exchange-cursor-project/.worktrees/om-crowd-001`
- Branch: `feature/community-surface-reports`
- Do not request live extra scopes unless you first prove PayPal now accepts them.
- Do not change the live bookmark.
- Do not put PayPal secrets, client IDs, tokens, or personal emails in repo memory or chat.
- Report `ready_for_review`, `partial`, or `blocked`. Do not self-accept.
- Owner is UI-only. A fix is not owner-testable until the development preview is redeployed.

## Review request
Main GPT agent should take the connector. Cursor Grok should stop this implementation path. Do not declare acceptance, merge approval, or production readiness.
