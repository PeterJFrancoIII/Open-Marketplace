---
schema_version: "1.1"
kind: "agent_handoff"
task_id: "owner-full-database-host"
agent_id: "cursor-grok-4-6"
agent_role: "cursor_implementation_subagent"
status: "ready_for_review"
started_at: "2026-08-16T14:32:55Z"
completed_at: "2026-08-16T14:40:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
branch: "feature/account-management-portal"
authority: "human_owner_explicit_request_2026-08-16"
architecture_mode: "trusted-device full public replica with replica floor and Main decree"
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
  - "hosting-node/policy.py"
  - "hosting-node/store.py"
  - "hosting-node/server.py"
  - "hosting-node/test_policy.py"
  - "hosting-node/test_server.py"
  - "hosting-node/Dockerfile"
  - "hosting-node/compose.yaml"
  - "hosting-node/README.md"
  - "lib/replica-policy.ts"
  - "lib/replica-host.ts"
  - "lib/media-node.ts"
  - "app/account/account-settings.tsx"
  - "app/marketplace.tsx"
  - "tests/replica-policy.test.mjs"
  - "tests/media-node.test.mjs"
  - "ARCHITECTURE.md"
  - "README.md"
  - "CURSOR_START_HERE.md"
  - ".gitignore"
  - "agent-memory/handoffs/2026-08-16--owner-full-database-host--cursor-grok-4-6.md"
verification:
  - command: "python3 -m unittest test_policy test_server"
    exit_code: 0
    result: "12 Python host tests passed, including refuse-closed delete and rejected single-host shard decree"
  - command: "npm run lint"
    exit_code: 0
    result: "eslint passed"
  - command: "npm test"
    exit_code: 0
    result: "62 tests passed, 0 failed"
functional_preview_required: true
functional_preview:
  status: "ready_after_push"
  url: "https://feature-account-management-p.open-marketplace-demo.pages.dev/account"
owner_manual_checklist:
  - "On the Synology, run hosting-node/ as an Arch Linux container (compose.yaml or python server.py inside the existing Arch container)."
  - "Set a write token in the container environment. Do not paste it into Git or chat."
  - "Put HTTPS in front of port 8788. The preview page is HTTPS and will block plain LAN http."
  - "Confirm GET /health shows role full-replica, hostId synology-nas-001, minReplicas 3, mode full."
  - "On Account settings → First database host, save the https origin and write token, then Test connection."
  - "Publish or re-save a listing and confirm the host catalog/object counts increase."
  - "Open the listing from another browser that has the same host URL and confirm listing text and photos load from the host."
  - "Do not expect scale-down yet. Main cannot issue a sharded decree until at least three hosts are live."
owner_manual_result: "not_run"
recommended_next_action: "Owner deploys the Arch Linux host on the Synology and connects it in Account settings. Codex may later assign OM-NODE for public host registration and signed Main decrees. Do not merge PR #21 or deploy production."
---

# Agent Handoff: first full database host

## Objective received

Human owner asked to make the Synology NAS Arch Linux container the first full
host of the marketplace database, automatically reduce single-host load as more
hosts join, keep a safe minimum number of duplicate copies, and let Main issue
a decree that shrinks host databases only after that floor is met.

## Shared-memory citations

Read GitHub `PeterJFrancoIII/Open-Marketplace` `origin/main` at
`96adc20d240f6dd644e74981778d86eeb1e3808b` plus `Master_Descriptor.md`,
`ARCHITECTURE.md`, `agent-memory/STATE.md`, `agent-memory/TASKS.md`, and
`agent-memory/DECISIONS.md`. Canonical TASKS still has no execution-ready
OM-NODE task. This slice is an explicit human-owner override. OM-TRUST-001
remains backlog.

## Work performed

Expanded `hosting-node/` from photo-only storage to a full public replica:

- Host id `synology-nas-001`, role `full-replica`, Arch Linux image.
- Stores listings, public seller profiles, and SHA-256 photos.
- Strips passwords, tokens, emails, and other secret-looking fields.
- Replica floor is 3. Mode stays `full` until at least 3 hosts exist.
- Read routing uses `hash(objectId) % hostCount` so added hosts take load.
- `PUT /v1/decree` is how Main later shards. A single-host shard decree is
  rejected. `DELETE` and `POST /v1/scale-down` refuse any drop below the floor.
- The preview app copies public listing/profile snapshots to the host on
  publish and can merge the host catalog when D1 is empty or incomplete.
- Cloudflare D1 remains the public preview registry. The NAS is the first
  complete duplicate, not a replacement of production D1.

Auth tables, Facebook tokens, and identity documents are not replicated.

## Verification evidence

See front matter. Python host tests and `npm test` (62) passed.

## Runnable preview

Owner-reachable URL:
https://feature-account-management-p.open-marketplace-demo.pages.dev/account

The Synology container itself is not started by this agent. The owner must
deploy it on the NAS and point Account settings at the HTTPS origin.

## Deviations and risks

- No Codex OM-NODE contract existed. Owner instruction outranked that gap.
- The Cloudflare Worker cannot reach a private LAN NAS. Public internet users
  still read D1 until hosts have public HTTPS URLs.
- Registry pull copies the newest 100 public listings only; `/api/listings`
  has no cursor yet. Browser publish still copies each listing the owner saves.
- Minimum replica count is explicitly 3. The owner did not name a number.
- Main decree is an authenticated `PUT /v1/decree` with the host write token.
  It is not a separately signed Codex control-plane document yet.
- HTTPS in front of the NAS is still required from the live preview.

## Review request

Review the replica-floor rules, secret stripping, Arch host protocol, and that
photo bytes still never enter `/api/listings`. Do not merge PR #21 or deploy
production. Leave `owner_manual_result: not_run` until the human owner tests
the Synology host in the UI.
