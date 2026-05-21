# Required Response Format for Larger Tasks

When completing a task that touches contracts, integrations, or cross-repo boundaries, append this section to your response:

---

## Ecosystem impact (required for larger tasks)

| Field                    | Value                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| **Local impact**         | _(Brief: what changed in this repo)_                                                                    |
| **Cross-repo impact**    | _(None / kalk-top / top-instal-generator / topinstal-mail-ingress / rag-chat-asystent — list affected)_ |
| **Ownership check**      | _(Change stays within this repo's role: yes/no)_                                                        |
| **Contract impact**      | _(DTO, envelope, REST, trace, auth changed: yes/no)_                                                    |
| **Ecosystem doc update** | _(yes/no) + (why, per update protocol)_                                                                 |

---

### When to use

- Use for: DTO changes, new/removed integrations, REST contract changes, ownership shifts, legacy removal
- Skip for: trivial bug fixes, local refactors, tests, docs with no contract impact

### Example

| Field                    | Value                                                                       |
| ------------------------ | --------------------------------------------------------------------------- |
| **Local impact**         | Added `preferences.includeBuffer` to CalcRequestDTO                         |
| **Cross-repo impact**    | top-instal-generator (from-offer-dto may need update if buffer affects doc) |
| **Ownership check**      | yes                                                                         |
| **Contract impact**      | yes — CalcRequestDTO                                                        |
| **Ecosystem doc update** | yes — new field in CalcRequestDTO; update Section 2                         |
