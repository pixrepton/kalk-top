# Adapter migration execution (cieplo.app ingress -> kalk-top)

Date: 2026-03-09

## Scope implemented in this step

1. Stage A/B kickoff executed in `kalk-top`.
2. Incoming process-state storage added for `message_id` idempotency.
3. Deterministic detector added before expensive pipeline stages.
4. Orchestrator integrated with incoming registry status updates.
5. Settings surface extended for detector domain/pattern rules.

## Code changes

- Added:
  - `wp-adapter/agents/IncomingMessageRepositoryWp.php`
  - `wp-adapter/agents/CieploMessageDetector.php`
- Updated:
  - `wp-adapter/agents/bootstrap.php`
  - `wp-adapter/agents/CieploOrchestrator.php`
  - `heatpump-calculator.php`

## Operational behavior after this step

1. Worker checks incoming registry by `message_id` before processing.
2. Terminal statuses are duplicate-skipped.
3. Detector gates message as `MATCH/NO_MATCH/AMBIGUOUS`.
4. Registry stores processing status transitions and errors.
5. Gmail label result updates registry as `marked_processed` or `mark_processed_error`.

## Not yet done (next stages)

1. Full status-by-stage mapping (`parsed/validated/dispatched`) from deep pipeline internals.
2. Full parity matrix against legacy RAG-side ingress code.
3. Production cutover and decommission of RAG ingress owner role.
4. Extended integration tests for registry and detector behavior on full WP runtime.

## Rollback (this step)

1. Remove include entries in `wp-adapter/agents/bootstrap.php`.
2. Remove new classes `IncomingMessageRepositoryWp.php` and `CieploMessageDetector.php`.
3. Revert `CieploOrchestrator.php` loop to legacy path.
