# TOP-INSTAL Ecosystem — Update Protocol

> Status: canonical
> Owner: TOP-INSTAL ecosystem governance
> Last verified against code/runtime: 2026-04-02 (documentation governance pass)
> Source-of-truth level: L1
> Supersedes: none
> Related docs: `TOPINSTAL_ECOSYSTEM_STATE.md`, `../DOC_GOVERNANCE.md`, `../SOURCE_OF_TRUTH_INDEX.md`

When MUST the agent update `TOPINSTAL_ECOSYSTEM_STATE.md`? When MUST it NOT?

---

## YES — Update required

| Case                        | What to update                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------- |
| **DTO/envelope change**     | Add or modify field in CalcRequestDTO, OfferDTO, cieplo_app_lead_v1, OfferDocumentRequestDTO | Section 2 (Cross-repo contracts)    |
| **Schema version bump**     | New schemaVersion for any contract                                                           | Section 2                           |
| **Ownership change**        | Module X now owns what module Y owned                                                        | Section 1 (Ownership matrix)        |
| **New integration**         | New call path between modules (A → B)                                                        | Section 3 (Integrations)            |
| **Removed integration**     | Integration deprecated or removed                                                            | Section 3                           |
| **Legacy path removed**     | Legacy code path that affected cross-repo flow is deleted                                    | Section 6 (Legacy seams)            |
| **Trace/auth/retry change** | New convention for trace_id, auth, retry semantics                                           | Section 4                           |
| **New system risk**         | Discovered risk that affects multiple modules                                                | Section 5 (Active risks)            |
| **Risk mitigated**          | Risk from Section 5 is resolved                                                              | Section 5 (remove or mark resolved) |

---

## NO — Update not required

| Case                         | Why                                                              |
| ---------------------------- | ---------------------------------------------------------------- |
| **Local refactor**           | No change to contracts, integrations, or ownership               |
| **Bug fix in single module** | No cross-repo impact                                             |
| **New internal feature**     | Stays within one repo's boundaries                               |
| **Test or doc update**       | No runtime contract change                                       |
| **Config/env change**        | Unless it changes auth or endpoint URL in a way others depend on |
| **Performance optimization** | No contract change                                               |
| **Code style / lint**        | No functional cross-repo impact                                  |

---

## Decision flow

1. Did you change a DTO, envelope, REST contract, or integration? → **YES**
2. Did you change who owns what? → **YES**
3. Did you remove legacy that other modules relied on? → **YES**
4. Did you discover a risk affecting multiple modules? → **YES**
5. Otherwise → **NO**

---

## How to update

- Edit `TOPINSTAL_ECOSYSTEM_STATE.md` in the relevant section
- Add a brief note: what changed, when, why
- Update "Last updated" at bottom
- Keep entries concise; avoid essays
