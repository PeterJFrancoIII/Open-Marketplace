#!/usr/bin/env bash
# Create stacked draft PRs that carve the social-trust branch into review units.
# Requires: git, gh, network. Does not merge to main.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SOURCE="${SOURCE_BRANCH:-codex/social-trust-framework}"
REMOTE="${REMOTE_NAME:-origin}"

# Cumulative path ownership — each stage includes prior stages' paths.
STAGE1="lib/trust/types.ts lib/trust/state-machines.ts lib/trust/projections.ts lib/trust/events.ts lib/trust/compatibility.ts lib/trust/fixtures.ts lib/trust/index.ts tests/trust-domain.test.ts"
STAGE2="$STAGE1 lib/trust/transactions.ts lib/trust/auth.ts lib/trust/session.ts lib/trust/errors.ts lib/trust/rate-limit.ts lib/trust/idempotency.ts lib/trust/schemas.ts app/api/transactions app/api/auth tests/transaction-lifecycle.test.ts tests/merge-gate-remediation.test.ts"
STAGE3="$STAGE2 lib/trust/reviews.ts lib/trust/persist-event.ts lib/trust/signed-events.ts lib/trust/projection-provenance.ts app/api/reviews drizzle db package.json scripts/prove-migrations.mjs tests/double-blind-reviews.test.ts"
STAGE4="$STAGE3 app/components lib/trust/trust-card-model.ts tests/trust-card.test.ts"
STAGE5="$STAGE4 lib/trust/oauth app/api/oauth tests/oauth-adapters.test.ts"
STAGE6="$STAGE5 lib/trust/safety.ts app/api/disputes app/api/appeals app/api/moderation app/api/transparency app/api/reviews tests/safety-moderation.test.ts"
STAGE7="$STAGE6 lib/trust/portable app/api/profiles app/api/trust tests/portable-trust.test.ts"
STAGE8="$STAGE7 app/marketplace.tsx app/globals.css app/page.tsx app/layout.tsx lib/media-store.ts lib/social-health.ts lib/types.ts .github docs CURSOR_START_HERE.md .env.example scripts/create-staged-prs.sh"

declare -a STAGES=(
  "01-trust-foundation|$STAGE1"
  "02-transactions|$STAGE2"
  "03-reviews-projections|$STAGE3"
  "04-trustcard-ui|$STAGE4"
  "05-oauth|$STAGE5"
  "06-moderation|$STAGE6"
  "07-portable-trust|$STAGE7"
  "08-branding-marketplace|$STAGE8"
)

git fetch "$REMOTE" main "$SOURCE"
PREV_BRANCH="main"
PREV_REF="$REMOTE/main"

for entry in "${STAGES[@]}"; do
  name="${entry%%|*}"
  paths="${entry#*|}"
  branch="codex/stage/${name}"
  echo "==> ${branch} (base ${PREV_BRANCH})"
  git branch -D "$branch" 2>/dev/null || true
  git checkout -B "$branch" "$PREV_REF"

  # shellcheck disable=SC2086
  git checkout "$SOURCE" -- $paths

  # Shared schema/migrations always travel from SOURCE for stages that need DB.
  if [[ "$name" > "02" ]] || [[ "$name" == "02-transactions" ]] || [[ "$name" == "03-reviews-projections" ]]; then
    git checkout "$SOURCE" -- db drizzle 2>/dev/null || true
  fi

  git add -A
  if git diff --cached --quiet; then
    echo "No changes for ${branch}; skipping"
    git checkout "$SOURCE"
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
- Tracking: see \`docs/handoffs/PR-SPLIT-PLAN.md\` and issues #2–#9.

## Test plan
- [ ] \`npm ci && npm run lint && npm test\` on this stage tip
- [ ] Diff stays within stage ownership
- [ ] No media bytes reach the registry

EOF
)"
  else
    echo "PR #${existing} already exists for ${branch}"
  fi
  PREV_BRANCH="$branch"
  PREV_REF="$branch"
done

git checkout "$SOURCE"
echo "Staged draft PRs created. Monolithic PR 1 remains for merge-gate Main review until PASS."
