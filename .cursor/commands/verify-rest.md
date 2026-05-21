# verify-rest

Run REST e2e for `calculate-offer` when a local/base URL is available.

1. Ensure `TOPINSTAL_REST_BASE_URL` is set (see `docs/runbooks/manual-runtime-setup.md`).
2. From repo root: `npm run test:rest`
3. If env is missing, report **not run** and point to runtime setup runbook — do not imply REST passed.
