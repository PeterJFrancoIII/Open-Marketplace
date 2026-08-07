#!/usr/bin/env bash
# Carve stacked, buildable draft PRs from the social-trust tip.
# Final stage tip tree must exactly match SOURCE. Does not merge to main.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SOURCE="${SOURCE_BRANCH:-codex/social-trust-framework}"
REMOTE="${REMOTE_NAME:-origin}"

# Scaffold required for production build + CI on every stage head.
SCAFFOLD=".github package.json package-lock.json tsconfig.json next.config.ts vite.config.ts postcss.config.mjs eslint.config.mjs .env.example .openai app/layout.tsx app/page.tsx app/globals.css app/marketplace.tsx app/components lib/media-store.ts lib/types.ts lib/social-health.ts db drizzle docs/dependency-advisories.md docs/handoffs scripts/sites-env.sh scripts/build-verified.sh scripts/install-ci.sh scripts/validate-artifact.sh scripts/prove-migrations.mjs scripts/create-staged-prs.sh public tests/rendered-html.test.mjs CURSOR_START_HERE.md README.md"

# Full trust domain early so barrel/index and portable imports resolve.
TRUST_LIB="lib/trust"

STAGE1="$SCAFFOLD $TRUST_LIB tests/trust-domain.test.ts README.md CURSOR_START_HERE.md"
STAGE2="$STAGE1 db drizzle scripts/prove-migrations.mjs lib/trust/transactions.ts app/api/auth app/api/transactions tests/transaction-lifecycle.test.ts tests/merge-gate-remediation.test.ts tests/d1-adversarial.test.ts"
STAGE3="$STAGE2 lib/trust/reviews.ts lib/trust/persist-event.ts lib/trust/signed-events.ts lib/trust/projection-provenance.ts lib/trust/rebuild-projections.ts app/api/reviews tests/double-blind-reviews.test.ts"
STAGE4="$STAGE3 app/components lib/trust/trust-card-model.ts tests/trust-card.test.ts"
STAGE5="$STAGE4 lib/trust/oauth app/api/oauth tests/oauth-adapters.test.ts"
STAGE6="$STAGE5 lib/trust/safety.ts app/api/disputes app/api/appeals app/api/moderation app/api/transparency tests/safety-moderation.test.ts"
STAGE7="$STAGE6 lib/trust/portable app/api/profiles app/api/trust tests/portable-trust.test.ts"
# Stage 8 is an exact SOURCE snapshot (not a path list).

declare -a STAGES=(
  "01-trust-foundation|$STAGE1"
  "02-transactions|$STAGE2"
  "03-reviews-projections|$STAGE3"
  "04-trustcard-ui|$STAGE4"
  "05-oauth|$STAGE5"
  "06-moderation|$STAGE6"
  "07-portable-trust|$STAGE7"
  "08-branding-marketplace|EXACT_SOURCE"
)

git fetch "$REMOTE" main "$SOURCE"
SOURCE_SHA="$(git rev-parse "$REMOTE/$SOURCE")"
PREV_BRANCH="main"
PREV_REF="$REMOTE/main"

for entry in "${STAGES[@]}"; do
  name="${entry%%|*}"
  paths="${entry#*|}"
  branch="codex/stage/${name}"
  echo "==> ${branch} (base ${PREV_BRANCH})"
  git branch -D "$branch" 2>/dev/null || true

  if [[ "$paths" == "EXACT_SOURCE" ]]; then
    # Exact tip match: stage-8 tree == reviewed SOURCE SHA.
    git checkout -B "$branch" "$SOURCE_SHA"
    git push -u "$REMOTE" "$branch" --force-with-lease
  else
    git checkout -B "$branch" "$PREV_REF"
    # shellcheck disable=SC2086
    git checkout "$SOURCE" -- $paths
    git add -A
    if git diff --cached --quiet; then
      echo "No changes for ${branch}; skipping"
      git checkout "$SOURCE"
      continue
    fi
    git commit -m "stage(${name}): carve review unit from ${SOURCE}"
    git push -u "$REMOTE" "$branch" --force-with-lease
  fi

  if [[ "$paths" == "EXACT_SOURCE" ]]; then
    if ! git diff --quiet "$SOURCE_SHA" "$branch"; then
      echo "FATAL: ${branch} does not exactly match ${SOURCE} @ ${SOURCE_SHA}" >&2
      exit 1
    fi
    echo "OK: ${branch} tree matches ${SOURCE_SHA}"
  fi

  existing="$(gh pr list --head "$branch" --json number --jq '.[0].number' 2>/dev/null || true)"
  if [[ -z "${existing}" || "${existing}" == "null" ]]; then
    gh pr create --draft --base "$PREV_BRANCH" --head "$branch" \
      --title "stage/${name}: review unit from social-trust framework" \
      --body "$(cat <<EOF
## Summary
- Staged review unit \`${name}\` carved from \`${SOURCE}\` (\`${SOURCE_SHA}\`).
- Stacked on \`${PREV_BRANCH}\` for sequential review.
- Tracking: \`docs/handoffs/PR-SPLIT-PLAN.md\` and issues #2–#9.

## Test plan
- [ ] \`npm ci && npm run lint && npm test\` on this stage tip
- [ ] CI green on exact stage head
- [ ] Stage 08 tree equals merge-gate SOURCE tip

EOF
)"
  else
    echo "PR #${existing} already exists for ${branch}; updating in place via force-with-lease"
  fi
  PREV_BRANCH="$branch"
  PREV_REF="$branch"
done

git checkout "$SOURCE"
echo "Staged draft PRs updated. Monolithic PR 1 remains for merge-gate Main review until PASS."
echo "SOURCE tip: ${SOURCE_SHA}"
