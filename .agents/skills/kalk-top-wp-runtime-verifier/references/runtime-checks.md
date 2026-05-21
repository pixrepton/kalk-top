# Runtime Checks

- Prefer `npm run test:rest` for REST-boundary verification
- Prefer `npm run test:mail-ingress-workflow` for workflow logic
- Prefer `npm run test:mail-ingress-live` only when live access is intended
- Use `/wp-json/topinstal/v1/mail-ingress/workflow-preflight` for runtime preflight evidence
