# Reviewed production dependency advisories

Date: 2026-08-07  
Command: `npm audit --omit=dev`  
Result: 4 high-severity findings under `next@16.2.6` (transitive `postcss`, `sharp`, `nanoid`).

CI enforces this exact allowlist via `scripts/audit-allowlist.mjs` (packages: `next`, `postcss`, `sharp`, `nanoid`).

## Findings

| Package | Severity | Advisories |
|---------|----------|------------|
| `next` 16.2.6 | high | GHSA-6gpp-xcg3-4w24, GHSA-m99w-x7hq-7vfj, GHSA-89xv-2m56-2m9x, GHSA-68g3-v927-f742, GHSA-4633-3j49-mh5q, GHSA-4c39-4ccg-62r3, GHSA-p9j2-gv94-2wf4, GHSA-q8wf-6r8g-63ch, GHSA-955p-x3mx-jcvp |
| `postcss` (via next) | high | GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849, GHSA-fxqj-rqcc-2cmp |
| `sharp` (via next) | high | GHSA-f88m-g3jw-g9cj |
| `nanoid` (via next) | high | GHSA-28wg-ghj8-5hjv, GHSA-2v37-7h3g-55p8 |

`npm audit fix --force` proposes `next@16.3.0`, which is outside the current Vinext-compatible pin (`next@16.2.6`).

## Decision

**Accepted temporary exception** until Vinext documents a compatible Next upgrade path.

Rationale:

1. This app is a description registry + static marketplace UI; it does not use Turbopack middleware, Server Actions forms, Image Optimization API, or custom rewrite destinations controlled by callers.
2. Media bytes never enter the registry; sharp/image-optimization attack surface is unused.
3. `nanoid` is transitive via Next and not called with attacker-controlled size in this app.
4. Forcing `next@16.3.0` risks breaking the Vinext/Cloudflare Worker build before Main PASS.

## Follow-up

- Re-run `npm audit --omit=dev` after the next Vinext release that supports Next ≥ 16.3.
- Update both this document and `ALLOWLIST` in `scripts/audit-allowlist.mjs` together.
- Remove this exception once audit is clean without `--force`.
