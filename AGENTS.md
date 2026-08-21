# Open Marketplace Agent Rules

These rules apply to Codex, Cursor IDE agents, Cursor Cloud agents, and any
other automated contributor working in this repository.

## Authority and roles

Authority is ordered as follows:

1. The human project owner has final authority.
2. Codex is the architect and administrator.
3. Cursor IDE and Cursor Cloud agents are implementation subagents.

Codex owns architecture, task decomposition, machine-readable specifications,
security and production gates, subagent assignments, review, integration, and
administrative actions. Codex should normally create contracts, skeletons,
acceptance tests, and handoffs rather than bulk feature implementations.

Cursor agents implement only an assigned task package. They do not redefine
architecture, expand scope, or mark their own work accepted. A subagent reports
work as `ready_for_review`; Codex reviews evidence and changes canonical state.

## Required reading before work

Read these files in order before inspecting or changing implementation code:

1. `Master_Descriptor.md`
2. `agent-memory/README.md`
3. `agent-memory/STATE.md`
4. `agent-memory/TASKS.md`
5. `agent-memory/DECISIONS.md`
6. The relevant file under `agent-memory/handoffs/`, if one exists
7. `CURSOR_START_HERE.md`, `README.md`, `ARCHITECTURE.md`, and `POLICY.md`

If these sources disagree, stop and report the conflict. Do not choose the
most convenient instruction. The precedence order is the human owner,
`Master_Descriptor.md`, accepted entries in `agent-memory/DECISIONS.md`,
`agent-memory/STATE.md`, then task-specific handoffs and other documentation.

## Task gate

Do not change implementation code without a task ID in
`agent-memory/TASKS.md` whose status permits execution and whose owner or
assigned agent matches the current worker.

Before editing:

- verify the repository, branch, base commit, and allowed paths;
- confirm dependencies and required inputs are satisfied;
- inspect the relevant code and existing tests;
- keep changes inside the task's stated scope.

If the branch, files, or required external state do not match the task, write a
blocked handoff instead of improvising.

## Shared-memory protocol

The `agent-memory/` directory is the repository-backed coordination space.

- Codex may update canonical state, task assignments, decisions, and the master
  descriptor after reviewing evidence.
- Cursor subagents may create task-specific handoffs in
  `agent-memory/handoffs/` and may update other memory files only when the task
  explicitly lists those paths under `allowed_paths`.
- Handoffs are append-only records. Never overwrite another agent's handoff.
- Use UTC ISO-8601 timestamps and stable IDs from `agent-memory/TASKS.md`.
- Record facts, commands, exit codes, changed paths, blockers, and remaining
  work. Clearly distinguish verified evidence from inference.
- Never store secrets, passwords, API tokens, cookies, raw identity documents,
  personal exports, or sensitive user data in shared memory or Git history.

Use `agent-memory/HANDOFF_TEMPLATE.md` for every implementation handoff.

A handoff to another agent for review is incomplete until the assigned
shared-memory space is fully on GitHub and the GitHub repository has the
latest program for that work. Reviewing agents have no other way to read
those documents or that program. Before completing such a handoff: commit
the current program and the full `agent-memory/` space, push them to
`PeterJFrancoIII/Open-Marketplace` on the handling branch, and cite that
pushed commit. Local-only or chat-only files do not count. This standing
owner rule authorizes that commit and push. It does not authorize merge,
production deploy, or Cloudflare production changes.

## GitHub, Cloudflare, and production safety

- Subagents must not merge, deploy, modify Cloudflare state, create
  credentials, or change production data unless the assigned task
  explicitly authorizes that exact action. Commit and push are required
  before an inter-agent review handoff so GitHub has the latest program
  and the full assigned `agent-memory/` space. Other commits and pushes
  still need explicit task or owner authorization.
- Codex performs repository administration and external-state changes only
  within the human owner's authorization.
- Preserve the existing `open-marketplace-demo` Pages project as the
  host. Do not treat `https://open-marketplace-demo.pages.dev` as a
  public live URL. The public live link must stay constant and must be
  the owner-chosen custom domain once purchased.
- A successful build or preview is not production approval.
- Production changes require every gate in `Master_Descriptor.md` plus explicit
  human approval.

## Crowdsourced development

`GOVERNANCE.md` makes community surface reports a foundational feature.

- Every user-facing page, section, and control must keep a `!` report
  action that captures that surface’s link.
- Store community reports as `bug` or `feature` in `community_reports`.
- At the end of each day, compile queued reports for human review. Do
  not implement a community request unless a human authorizes that
  adaptation.
- Cybersecurity and access-control surfaces belong only to
  administrators. Filter those requests out of the community queue.
  Never treat them as community-owned work.

## Engineering boundaries

- Keep public browsing available unless the master descriptor changes that
  requirement.
- Never accept browser-supplied ownership, administrator status, verification
  status, or hosting rewards as authoritative.
- Never place listing image bytes or identity documents in the public metadata
  registry.
- Preserve restricted-item, social-link, SSRF, and local-media safeguards.
- Use established authentication and cryptographic libraries; do not invent
  password, session, signature, or encryption schemes.
- Add or update tests for behavior changes and report exact verification output.
- Do not weaken a failing test merely to produce a green run.

## Completion language

Subagents report `ready_for_review`, `partial`, or `blocked`. Only Codex may mark
a task `accepted`, and only after inspecting the diff and running appropriate
verification. Only the human owner may authorize a production release.
