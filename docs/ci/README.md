# CI

Installed workflow: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)  
Template source: [`docs/ci/github-actions.ci.yml`](github-actions.ci.yml)

Runs: `npm ci`, lint, test (includes build), build, production `npm audit --omit=dev`
(with reviewed exception file if audit is non-zero), and `npm run test:migrations`.
