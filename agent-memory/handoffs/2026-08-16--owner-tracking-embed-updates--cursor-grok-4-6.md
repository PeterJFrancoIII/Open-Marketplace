---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "owner-tracking-embed-updates"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-16T21:35:00Z"
completed_at: "2026-08-16T21:39:27Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/account-management-portal"
base_commit: "fa76a6254643dadef8aa349c29a8015382e232b5"
head_commit: "uncommitted_at_handoff_write"
authority: "human_owner_explicit_request_2026-08-16"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "96adc20d240f6dd644e74981778d86eeb1e3808b"
  paths:
    - "Master_Descriptor.md"
    - "agent-memory/README.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
pull_request: 21
pull_request_state: "draft"
production_changed: false
merged: false
contains_secrets_or_private_data: false
files_changed:
  - "app/account/messages/messages-client.tsx"
  - "app/globals.css"
  - "lib/tracking-embed.ts"
  - "tests/chat-sale-credit.test.mjs"
  - "tests/tracking-embed.test.mjs"
  - "agent-memory/handoffs/2026-08-16--owner-tracking-embed-updates--cursor-grok-4-6.md"
verification:
  - command: "npm run lint"
    exit_code: 0
    result: "eslint passed with the existing SaleProof no-img-element warning"
  - command: "npm test"
    exit_code: 0
    result: "97 tests passed, 0 failed; includes carrier detection, official-host allowlist, and Messages source contract for Tracking updates"
functional_preview_required: true
functional_preview:
  status: "ready_after_push"
  url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
  start_command: null
owner_manual_checklist:
  - "Hard-refresh the preview after the latest Pages deploy."
  - "Open Messages and enter a real UPS, USPS, FedEx, or DHL tracking number under Sale proof."
  - "Confirm Tracking updates appear under that field, with an official carrier link and AfterShip link."
  - "Confirm the 17TRACK embed shows status/details in the chat window, or the 17TRACK iframe fallback if the script is blocked."
  - "Enter PICKUP and confirm no carrier embed is shown."
  - "Confirm the homepage / public listing JSON still does not include the tracking number."
owner_manual_result: "not_run"
blockers: []
remaining_work:
  - "A branded AfterShip iframe would need an AfterShip account; not added."
  - "Official UPS/USPS/FedEx/DHL sites generally block iframe embedding; they are linked, not framed."
recommended_next_action: "Owner tests Tracking updates under the Messages tracking field on the preview URL. Codex may review. Do not merge PR #21 or deploy production."
---

# Agent Handoff: owner-tracking-embed-updates

## Objective received

The human owner asked that tracking updates and details appear inside the
chat window, attached to the tracking-number field, and that this connect
to the most stable tracking systems that offer embeds if possible.

## Shared-memory citations

Read from this worktree plus canonical `origin/main`
`96adc20d240f6dd644e74981778d86eeb1e3808b`:

- `Master_Descriptor.md`
- `agent-memory/README.md`
- `agent-memory/STATE.md`
- `agent-memory/TASKS.md`
- `agent-memory/DECISIONS.md`

Canonical TASKS/STATE remain stale versus this branch. No Codex task ID
covers this slice. Authority is the human owner's explicit request.

Master Descriptor still says `live_carrier_tracking: false`. This slice
is an owner override: live updates are shown only inside the private
conversation, not on public listings.

## Work performed

- Detect UPS, USPS, FedEx, and DHL from the tracking number and link to
  that carrier's official HTTPS tracking page.
- Attach a **Tracking updates** panel under the Sale proof tracking
  field for both seller and buyer.
- Embed 17TRACK's official website plugin
  (`https://www.17track.net/externalcall.js`, `YQV5.trackSingle`),
  documented at `https://extcall.17track.net/en`. This is the stable
  no-key multi-carrier embed. AfterShip's iframe requires a branded
  AfterShip account, so AfterShip is a link only.
- If the 17TRACK script does not load, fall back to an iframe of
  `https://t.17track.net/en/track?nums=...`.
- `PICKUP` shows "In-person pickup" and no embed.
- No server-side carrier scrape, no new D1 columns, no API keys.
  Tracking stays conversation-private.

## Verification evidence

- `npm run lint` exit 0.
- `npm test` exit 0, **97/97**.

## Runnable preview

https://feature-account-management-p.open-marketplace-demo.pages.dev/

Hard-refresh after Pages deploys this push. `owner_manual_result` stays
`not_run`.

## Deviations and risks

- 17TRACK, not the carrier site, is the in-window embed. Carrier sites
  are the source of truth via outbound links.
- 17TRACK may rate-limit some USPS lookups.
- The official 17TRACK script runs in the Messages page. The iframe
  fallback is used only if that script fails.
- Viewing tracking sends the number to 17TRACK and, if clicked,
  AfterShip or the carrier. It is not published on `GET /api/listings`.

## Review request

Codex should review the host allowlist, the 17TRACK embed, and that
tracking stays off the public registry. Do not mark accepted, merge
PR #21, or deploy production until the human owner reports a functional
pass.
