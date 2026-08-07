#!/usr/bin/env bash
# Carve stacked, buildable, ancestral draft PRs from the social-trust tip.
# Stage 08 commits on top of stage 07 with a SOURCE-identical tree (ancestral).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SOURCE="${SOURCE_BRANCH:-codex/social-trust-framework}"
REMOTE="${REMOTE_NAME:-origin}"

# Minimal scaffold for build + CI on every stage head (no full trust domain).
SCAFFOLD=".github package.json package-lock.json tsconfig.json next.config.ts vite.config.ts postcss.config.mjs eslint.config.mjs .env.example .openai app/layout.tsx app/page.tsx app/globals.css app/marketplace.tsx app/components lib/media-store.ts lib/types.ts lib/social-health.ts lib/trust/trust-card-model.ts db drizzle docs/dependency-advisories.md docs/handoffs scripts/sites-env.sh scripts/build-verified.sh scripts/install-ci.sh scripts/validate-artifact.sh scripts/prove-migrations.mjs scripts/audit-allowlist.mjs scripts/create-staged-prs.sh public tests/rendered-html.test.mjs CURSOR_START_HERE.md README.md"

# Lean stage 1: foundation domain only (not oauth/moderation/portable).
STAGE1="$SCAFFOLD lib/trust/types.ts lib/trust/state-machines.ts lib/trust/projections.ts lib/trust/events.ts lib/trust/compatibility.ts lib/trust/fixtures.ts lib/trust/index.stage1.ts tests/trust-domain.test.ts"
# Transaction routes atomically rebuild projections, so event/projection modules
# and reviews domain must be present from stage 02 for a production build.
STAGE2="$STAGE1 lib/trust/index.ts lib/trust/transactions.ts lib/trust/auth.ts lib/trust/session.ts lib/trust/errors.ts lib/trust/rate-limit.ts lib/trust/idempotency.ts lib/trust/schemas.ts lib/trust/prior-hash.ts lib/trust/reviews.ts lib/trust/persist-event.ts lib/trust/signed-events.ts lib/trust/projection-provenance.ts lib/trust/rebuild-projections.ts lib/trust/portable app/api/auth app/api/transactions tests/transaction-lifecycle.test.ts tests/d1-adversarial.test.ts"
# Review report route imports safety helpers — ship safety.ts with reviews APIs.
STAGE3="$STAGE2 lib/trust/safety.ts app/api/reviews tests/double-blind-reviews.test.ts tests/merge-gate-remediation.test.ts"
STAGE4="$STAGE3 tests/trust-card.test.ts"
STAGE5="$STAGE4 lib/trust/oauth app/api/oauth tests/oauth-adapters.test.ts"
STAGE6="$STAGE5 app/api/disputes app/api/appeals app/api/moderation app/api/transparency tests/safety-moderation.test.ts"
STAGE7="$STAGE6 app/api/profiles app/api/trust tests/portable-trust.test.ts"
# Stage 8: ancestral commit whose tree equals SOURCE (not a tip reset).

declare -a STAGES=(
  "01-trust-foundation|$STAGE1"
  "02-transactions|$STAGE2"
  "03-reviews-projections|$STAGE3"
  "04-trustcard-ui|$STAGE4"
  "05-oauth|$STAGE5"
  "06-moderation|$STAGE6"
  "07-portable-trust|$STAGE7"
  "08-branding-marketplace|ANCESTRAL_SOURCE_TREE"
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
  git checkout -B "$branch" "$PREV_REF"

  if [[ "$paths" == "ANCESTRAL_SOURCE_TREE" ]]; then
    # Keep ancestry from stage 07; make the tree exactly SOURCE.
    git rm -rf --quiet . >/dev/null 2>&1 || true
    git checkout "$SOURCE_SHA" -- .
    # Stage-1 temporary index helper must not remain if SOURCE has full index.
    git add -A
    if git diff --cached --quiet && [[ "$(git rev-parse HEAD)" == "$SOURCE_SHA" ]]; then
      echo "Already at SOURCE tree"
    else
      # If tree already matches SOURCE after checkout, commit only when needed.
      if ! git diff --cached --quiet || ! git diff --quiet; then
        git commit -m "stage(${name}): complete ancestral stack to ${SOURCE} tip"
      fi
    fi
    # Verify tree equality with SOURCE tip.
    if ! git diff --quiet "$SOURCE_SHA"; then
      echo "FATAL: ${branch} tree does not match ${SOURCE} @ ${SOURCE_SHA}" >&2
      git diff --stat "$SOURCE_SHA" | head -40 >&2
      exit 1
    fi
    echo "OK: ${branch} tree matches ${SOURCE_SHA} (parent=$(git rev-parse HEAD^ 2>/dev/null || echo none))"
  else
    # shellcheck disable=SC2086
    git checkout "$SOURCE" -- $paths
    # Stage 1 uses a lean index barrel so oauth/portable are not required yet.
    if [[ "$name" == "01-trust-foundation" ]]; then
      git checkout "$SOURCE" -- lib/trust/index.stage1.ts 2>/dev/null || true
      if [[ -f lib/trust/index.stage1.ts ]]; then
        cp lib/trust/index.stage1.ts lib/trust/index.ts
        git add lib/trust/index.ts
      fi
    fi
    git add -A
    if git diff --cached --quiet; then
      echo "No changes for ${branch}; skipping"
      git checkout "$SOURCE"
      continue
    fi
    git commit -m "stage(${name}): carve review unit from ${SOURCE}"
  fi

  git push -u "$REMOTE" "$branch" --force-with-lease

  existing="$(gh pr list --head "$branch" --json number --jq '.[0].number' 2>/dev/null || true)"
  if [[ -z "${existing}" || "${existing}" == "null" ]]; then
    gh pr create --draft --base "$PREV_BRANCH" --head "$branch" \
      --title "stage/${name}: review unit from social-trust framework" \
      --body "$(cat <<EOF
## Summary
- Staged review unit \`${name}\` carved from \`${SOURCE}\` (\`${SOURCE_SHA}\`).
- Stacked on \`${PREV_BRANCH}\` (ancestral; stage 08 does not reset to SOURCE SHA).
- Tracking: \`docs/handoffs/PR-SPLIT-PLAN.md\` and issues #2–#9.

## Test plan
- [ ] \`npm ci && npm run lint && npm test\` on this stage tip
- [ ] CI green on exact stage head
- [ ] Stage 08 parent is stage 07; tree equals SOURCE tip

EOF
)"
  else
    echo "PR #${existing} already exists for ${branch}; updated via force-with-lease"
  fi
  PREV_BRANCH="$branch"
  PREV_REF="$branch"
done

git checkout "$SOURCE"
echo "Staged draft PRs updated. Monolithic PR 1 remains for merge-gate Main review until PASS."
echo "SOURCE tip: ${SOURCE_SHA}"
