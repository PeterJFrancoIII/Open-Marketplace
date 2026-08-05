# Staged PR split plan (pre-merge)

Do **not** merge the monolithic `codex/social-trust-framework` branch until Main review PASS.
Split into reviewable PRs before merge:

| Stage | Scope | Suggested path prefix |
|------|--------|------------------------|
| 1 | Trust domain foundation (types, state machines, projections, events) | `lib/trust/{types,state-machines,projections,events}*` + domain tests |
| 2 | Transaction lifecycle API | `lib/trust/transactions*` + `app/api/transactions/**` |
| 3 | Double-blind reviews + projections persistence | `lib/trust/reviews*` + `app/api/**/reviews/**` + `trust_projections` |
| 4 | TrustCard UI + filters | `app/components/TrustCard*` + marketplace trust filters |
| 5 | Facebook OAuth + encrypted grants | `lib/trust/oauth/**` + `app/api/oauth/**` |
| 6 | Disputes / appeals / moderation / transparency | `lib/trust/safety*` + safety API routes |
| 7 | Portable signed trust claims / VC export | `lib/trust/portable/**` + export/verify/keys routes |
| 8 | Branding / copy / non-trust UI polish | marketplace chrome only |

Merge-gate remediation (session auth, strict schemas, dual attestation, signed events,
provider uniqueness, keypair guard, migration `0007` repair, CI) lands first as a
blocking prerequisite PR on top of the current branch, then stage 1–8 can be carved
from the remaining history for review.
