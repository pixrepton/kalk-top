# Decision Criteria

Use these criteria when comparing architecture options in Plan Mode or review work.

## Prefer the option that

- keeps backend calculation canonical
- preserves clean layer ownership
- minimizes contract drift
- keeps rollback possible via config or flags
- gives better verification and evidence paths
- reduces duplicated logic across UI, WP runtime, and downstream repos
- is easier to explain and maintain after the change

## Reject options that

- move logic into the wrong layer
- require silent downstream assumptions
- hide correctness behind UI state tricks
- introduce runtime complexity without diagnostics
- remove a safe rollback path

## Evidence expectations

- architectural claim -> cite boundaries or contracts
- runtime claim -> show what was run
- UI claim -> use browser verification if visible behavior changed
