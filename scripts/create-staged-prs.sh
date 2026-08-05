#!/usr/bin/env bash
# Create stacked draft PRs that carve the social-trust branch into review units.
# Requires: git, gh, network. Does not merge.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SOURCE="${SOURCE_BRANCH:-codex/social-trust-framework}"
REMOTE="${REMOTE_NAME:-origin}"

declare -a STAGES=(
  "01-trust-foundation|lib/trust/types.ts lib/trust/state-machines.ts lib/trust/projections.ts lib/trust/events.ts lib/trust/compatibility.ts lib/trust/fixtures.ts lib/trust/index.ts tests/trust-domain.test.ts"
  "02-transactions|lib/trust/transactions.ts lib/trust/auth.ts lib/trust/session.ts lib/trust/errors.ts lib/trust/rate-limit.ts lib/trust/idempotency.ts app/api/transactions tests/transaction-lifecycle.test.ts"
  "03-reviews-projections|lib/trust/reviews.ts lib/trust/persist-event.ts lib/trust/signed-events.ts app/api/reviews app/api/transactions/[id]/reviews app/api/transactions/[id]/review-eligibility tests/double-blind-reviews.test.ts"
  "04-trustcard-ui|app/components lib/trust/trust-card-model.ts tests/trust-card.test.ts"
  "05-oauth|lib/trust/oauth app/api/oauth tests/oauth-adapters.test.ts"
  "06-moderation|lib/trust/safety.ts app/api/disputes app/api/appeals app/api/moderation app/api/transparency app/api/reviews/[id]/report tests/safety-moderation.test.ts"
  "07-portable-trust|lib/trust/portable app/api/profiles app/api/trust tests/portable-trust.test.ts"
  "08-branding-marketplace|app/marketplace.tsx app/globals.css app/page.tsx app/layout.tsx"
)

git fetch "$REMOTE" main "$SOURCE" >/dev/null
BASE_SHA="$(git rev-parse "$REMOTE/main")"
PREV_BRANCH="main"
PREV_REF="$BASE_SHA"

for entry in "${STAGES[@]}"; do
  name="${entry%%|*}"
  paths="${entry#*|}"
  branch="codex/stage/${name}"
  echo "==> ${branch} (base ${PREV_BRANCH})"
  git branch -D "$branch" 2>/dev/null || true
  git checkout -B "$branch" "$PREV_REF"
  # Cumulative: take all prior stage files plus this stage from SOURCE tip.
  # shellcheck disable=SC2086
  git checkout "$SOURCE" -- db drizzle lib/trust app/api app/components app/marketplace.tsx app/globals.css package.json tests docs .env.example CURSOR_START_HERE.md scripts 2>/dev/null || true
  git add -A
  if git diff --cached --quiet; then
    echo "No changes for ${branch}; skipping"
    continue
  fi
  git commit -m "stage(${name}): carve review unit from ${SOURCE}"
  git push -u "$REMOTE" "$branch" --force-with-lease
  existing="$(gh pr list --head "$branch" --json number --jq '.[0].number' 2>/dev/null || true)"
  if [[ -z "${existing}" || "${existing}" == "null" ]]; then
    gh pr create --draft --base "$PREV_BRANCH" --head "$branch" \
      --title "stage/${name}: review unit from social-trust framework" \
      --body "$(cat <<EOF
## Summary
- Staged review unit \`${name}\` carved from \`${SOURCE}\`.
- Stacked on \`${PREV_BRANCH}\` for sequential review.

## Test plan
- [ ] \`npm ci && npm run lint && npm test\`
- [ ] Confirm no media bytes reach the registry
- [ ] Confirm this stage stays within its ownership boundary

EOF
)"
  else
    echo "PR #${existing} already exists for ${branch}"
  fi
  PREV_BRANCH="$branch"
  PREV_REF="$branch"
done

echo "Staged draft PRs created. Keep PR 1 closed or superseded after Main PASS on merge-gate tip."
