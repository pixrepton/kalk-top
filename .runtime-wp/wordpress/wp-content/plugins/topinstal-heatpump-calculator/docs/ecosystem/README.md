# Ecosystem documentation (TOP-INSTAL)

> Status: operational
> Owner: TOP-INSTAL ecosystem governance
> Last verified against code/runtime: 2026-04-02 (documentation governance pass)
> Source-of-truth level: L2
> Supersedes: none
> Related docs: `TOPINSTAL_ECOSYSTEM_STATE.md`, `TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md`, `../SOURCE_OF_TRUTH_INDEX.md`

| Document                                                                           | Role                                                            |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [TOPINSTAL_ECOSYSTEM_STATE.md](./TOPINSTAL_ECOSYSTEM_STATE.md)                     | **Living canonical:** contracts, ownership, integrations, risks |
| [TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md](./TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md) | When to edit the state doc                                      |
| [WORKSPACE_GOVERNANCE.md](./WORKSPACE_GOVERNANCE.md)                               | Multi-repo **folder order**, Cursor workspace, archives         |
| [AGENT_BUSINESS_TOOLS.md](./AGENT_BUSINESS_TOOLS.md)                               | Agent tools → REST mapping (Zordon-class agents)                |
| [ECOSYSTEM_MAP.html](./ECOSYSTEM_MAP.html)                                         | **Open in browser** — Mermaid diagrams (visual companion)       |
| [schemas/](./schemas/)                                                             | JSON Schemas for shared DTOs                                    |

Start here for cross-repo questions: **STATE** for truth, **WORKSPACE_GOVERNANCE** for disk layout, **MAP.html** for pictures.

**Local Desktop layout (Windows):** `TOPINSTAL-WORKSPACE/` holds `_archive/` and `TOPINSTAL.code-workspace` — see `WORKSPACE_GOVERNANCE.md` §2.

## Module responsibilities (quick reference)

| Module                                     | Role                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **topinstal-mail-ingress** (separate repo) | Gmail polling, ciepło.app detection, parsing, validation, SQLite transport, dispatch of normalized payloads to `kalk-top`, marking messages processed. |
| **kalk-top** (this repo)                   | `POST /calculate-offer`, WP endpoints after mail dispatch, domain engines, offer handoff to generator, lead persistence, admin/review tooling.         |

