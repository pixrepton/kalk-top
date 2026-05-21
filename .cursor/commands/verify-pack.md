# verify-pack

Run a **tiered** local verification pack. Do not run full `npm run verify` unless the user asked for a broad gate.

1. `npm run test:contract`
2. `npm run test:fixtures`
3. `npm run verify:js`
4. If `TOPINSTAL_REST_BASE_URL` is set: `npm run test:rest`; else note REST skipped
5. Optional MCP: `runtime_preflight_reference` on `kalk-top-repo-assistant`
6. Report each step: **confirmed locally** / **skipped** / **failed**
