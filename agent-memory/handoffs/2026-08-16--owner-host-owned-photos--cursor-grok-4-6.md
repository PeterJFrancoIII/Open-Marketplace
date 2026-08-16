---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "owner-host-owned-photos"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-16T14:50:23Z"
completed_at: "2026-08-16T14:55:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/account-management-portal"
authority: "human_owner_explicit_request_2026-08-16"
shared_memory_refs:
  repository: "PeterJFrancoIII/Open-Marketplace"
  canonical_ref_or_commit: "96adc20d240f6dd644e74981778d86eeb1e3808b"
  paths:
    - "Master_Descriptor.md"
    - "ARCHITECTURE.md"
    - "agent-memory/STATE.md"
    - "agent-memory/TASKS.md"
    - "agent-memory/DECISIONS.md"
pull_request: 21
pull_request_state: "draft"
production_changed: false
merged: false
contains_secrets_or_private_data: false
files_changed:
  - "lib/image-manifest.ts"
  - "lib/types.ts"
  - "lib/media-store.ts"
  - "lib/media-node.ts"
  - "lib/replica-policy.ts"
  - "lib/replica-host.ts"
  - "app/marketplace.tsx"
  - "app/api/listings/route.ts"
  - "hosting-node/policy.py"
  - "hosting-node/store.py"
  - "hosting-node/server.py"
  - "hosting-node/test_policy.py"
  - "hosting-node/test_server.py"
  - "tests/image-manifest.test.mjs"
  - "tests/listing-photos.test.mjs"
  - "tests/media-node.test.mjs"
  - "tests/replica-policy.test.mjs"
  - "ARCHITECTURE.md"
  - "agent-memory/handoffs/2026-08-16--owner-host-owned-photos--cursor-grok-4-6.md"
verification:
  - command: "python3 -m unittest test_policy test_server"
    exit_code: 0
    result: "13 Python host tests passed, including owner_pinned refuse-closed delete"
  - command: "npm run lint"
    exit_code: 0
    result: "eslint passed"
  - command: "npm test"
    exit_code: 0
    result: "65 tests passed, 0 failed"
functional_preview_required: true
functional_preview:
  status: "ready_after_push"
  url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/"
owner_manual_checklist:
  - "Confirm the Synology host is running as open-marketplace-first-public-database-host with HTTPS and is saved in Account settings."
  - "On the browser that originally had the photos, open one of your listings and click Edit listing. Photos should appear."
  - "Save the listing once so the public host hint is stored. Photo bytes still stay off D1."
  - "Open the same listing on another browser. The edit page and item page should load photos from the host."
  - "Publish a new listing with photos and confirm the host keeps that item even if other hosts later join."
owner_manual_result: "not_run"
recommended_next_action: "Owner retests edit photos after connecting the HTTPS host. Codex may review owner-pin and listing host hints. Do not merge PR #21 or deploy production."
---

# Agent Handoff: host-owned photos and edit display

## Objective received

Human owner reported photos still missing on the edit listing page, and
required that a host's own items always stay on that host so listings remain
available while the host is operational.

## Shared-memory citations

Read GitHub `PeterJFrancoIII/Open-Marketplace` `origin/main` at
`96adc20d240f6dd644e74981778d86eeb1e3808b`.

## Work performed

Root cause: edit loaded photos only from this browser's IndexedDB. Existing
assigned photos were never copied to the NAS, and listings did not advertise
the host origin, so other browsers could not fetch them.

Changes:

- Edit and item views load photos from IndexedDB, the configured host, and
  public HTTPS host hints on the listing manifest.
- Opening or saving a host operator's listing copies every assigned photo to
  the host and writes the host origin onto the manifest as an availability
  hint. Photo bytes still never enter D1.
- The host pins operator-written listings, profiles, and photos and refuses
  to drop them after a later scale-down decree.

## Review request

Review host pinning, manifest host-hint sanitization, and that `/api/listings`
still never accepts image bytes. Do not merge PR #21 or deploy production.
