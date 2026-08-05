# Staged PR split plan

Do **not** merge the monolithic `codex/social-trust-framework` branch (PR 1)
until Main review PASS on the merge-gate tip.

## Immediate review target

- Branch: `codex/social-trust-framework`
- PR: https://github.com/PeterJFrancoIII/Open-Marketplace/pull/1
- Scope for next Main review: merge-gate remediation only (sessions, schemas,
  dual attestation, signed events/projections, OAuth uniqueness, keypair
  fail-closed, migrations, CI, adversarial tests).

## Post-PASS carve order

After Main returns PASS on the merge-gate tip, close or supersede PR 1 and open
stacked draft PRs in this order (each PR bases on the previous stage):

| Stage | Branch | Ownership |
|------|--------|-----------|
| 1 | `codex/stage/01-trust-foundation` | `lib/trust/{types,state-machines,projections,events,compatibility,fixtures}*` + `tests/trust-domain.test.ts` |
| 2 | `codex/stage/02-transactions` | transactions domain + `app/api/transactions/**` |
| 3 | `codex/stage/03-reviews-projections` | reviews, signed/persist events, projection writes |
| 4 | `codex/stage/04-trustcard-ui` | TrustCard + marketplace trust filters |
| 5 | `codex/stage/05-oauth` | `lib/trust/oauth/**` + `app/api/oauth/**` |
| 6 | `codex/stage/06-moderation` | safety/disputes/appeals/moderation/transparency |
| 7 | `codex/stage/07-portable-trust` | portable claims + export/verify/keys |
| 8 | `codex/stage/08-branding-marketplace` | marketplace chrome / branding only |

Shared schema/migrations (`db/`, `drizzle/`) travel with the earliest stage that
introduces each table/index; later stages only add their deltas.

Helper script (run only after PASS, with human review): `scripts/create-staged-prs.sh`

## Tracking issues

- https://github.com/PeterJFrancoIII/Open-Marketplace/issues/2 — stage/01-trust-foundation
- https://github.com/PeterJFrancoIII/Open-Marketplace/issues/3 — stage/02-transactions
- https://github.com/PeterJFrancoIII/Open-Marketplace/issues/4 — stage/03-reviews-projections
- https://github.com/PeterJFrancoIII/Open-Marketplace/issues/5 — stage/04-trustcard-ui
- https://github.com/PeterJFrancoIII/Open-Marketplace/issues/6 — stage/05-oauth
- https://github.com/PeterJFrancoIII/Open-Marketplace/issues/7 — stage/06-moderation
- https://github.com/PeterJFrancoIII/Open-Marketplace/issues/8 — stage/07-portable-trust
- https://github.com/PeterJFrancoIII/Open-Marketplace/issues/9 — stage/08-branding-marketplace
