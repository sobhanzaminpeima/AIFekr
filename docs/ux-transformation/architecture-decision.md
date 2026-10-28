# Architecture Decision — Navigation

| Criterion | A. Feature-based (today) | B. Role-based | C. Goal-based | D. Hybrid adaptive workspaces + goal search |
|---|---|---|---|---|
| Beginner usability | Low (40 items) | Medium | High | High |
| Discoverability | Medium | Low (hides other tools) | Medium | High (workspace + "All tools" + goal search) |
| Multi-persona users | Good | Poor | Good | Good (multiple workspaces, instant switch) |
| Scalability | Poor | Medium | Medium | Good (registry-driven) |
| Mobile | Poor (long drawer) | Good | Good | Good |
| Complexity / maintenance | Low | Medium | Medium | Medium — reuses `destinations.ts` |
| Compatibility | — | Needs entitlement coupling | Needs relabeling | Additive; classic menu remains |

**Decision: D.** Workspaces decide only what is shown first; they never grant or remove access (pages/APIs keep their own checks, admin module switches still apply). Goal search covers everything else without AI cost. Users with no workspace keep the classic menu, so nothing changes for existing users until they choose.

Rollback: Admin → Customer Growth → Settings → turn off "Adaptive workspaces" (classic navigation for everyone, no deploy).
