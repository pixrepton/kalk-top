# Change Surface Checklist

Use this before multi-file, architectural, or contract-touching changes.

## 1. Ownership

- Which layer owns this change?
- Is any part of the proposed logic drifting into the wrong layer?
- Does this cross into another repo's responsibility?

## 2. Canonical source of truth

- Is backend still canonical?
- Could this accidentally recreate a frontend-only source of truth?
- Are we editing the repo root and not `.runtime-wp/`?

## 3. Contracts

- Does this touch `CalcRequestDTO`?
- Does this touch `OfferDTO`?
- Does this change REST request or response shape?
- Does this change auth or trace semantics?

## 4. Runtime

- Does this affect preflight, diagnostics, workflow state, or environment wiring?
- Is Browser or Debug Mode needed for evidence?

## 5. Downstream impact

- Does `topinstal-mail-ingress` need to change?
- Does `top-instal-generator` need to change?
- Does ecosystem state documentation need updating?

## 6. Verification

- Which harness is the lightest valid check?
- Is visual verification required?
- Is there a safe rollback path?
