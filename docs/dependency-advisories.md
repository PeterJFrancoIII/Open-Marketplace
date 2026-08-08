# Reviewed production dependency advisories

Date: 2026-08-08  
Command: `npm audit --omit=dev`  
Result: high-severity findings under `next@16.2.6` (transitive `postcss`, `sharp`, `nanoid`).

CI enforces an **advisory-exact** allowlist via `scripts/audit-allowlist.mjs`.
Package names alone are insufficient — each row binds package, severity, GHSA id, and affected range.

## Allowlist entries (exact)

| package | severity | advisory | affected_range |
|---------|----------|----------|----------------|
| `nanoid` | high | GHSA-28wg-ghj8-5hjv | `<3.3.16` |
| `nanoid` | high | GHSA-2v37-7h3g-55p8 | `<3.3.17` |
| `next` | high | GHSA-6gpp-xcg3-4w24 | `>=16.0.0 <16.2.11` |
| `next` | high | GHSA-m99w-x7hq-7vfj | `>=16.0.0 <16.2.11` |
| `next` | high | GHSA-89xv-2m56-2m9x | `>=16.0.0 <16.2.11` |
| `next` | high | GHSA-p9j2-gv94-2wf4 | `>=16.0.0 <16.2.11` |
| `postcss` | high | GHSA-6g55-p6wh-862q | `<=8.5.11` |
| `postcss` | high | GHSA-r28c-9q8g-f849 | `<=8.5.17` |
| `sharp` | high | GHSA-f88m-g3jw-g9cj | `<0.35.0` |

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
- Update both this document and CI allowlist parsing together.
- Remove this exception once audit is clean without `--force`.
