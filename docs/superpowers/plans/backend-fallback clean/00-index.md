# Remove Synthetic Fallbacks — Parallel Execution Plan

> **For co-developers:** this directory reorganizes the 30 remaining tasks of
> [`docs/superpowers/plans/2026-08-30-remove-synthetic-fallbacks/`](../2026-08-30-remove-synthetic-fallbacks/00-index.md)
> — Tasks 1–8, 17, and 18 are already complete — into one blocker-clearing
> trunk task plus three lanes with zero file overlap between them, so three
> people can work simultaneously without coordinating mid-task. Each lane
> file is self-contained: read only the one assigned to you.

**Goal:** same as the parent plan — every value in the CeView UI is real,
computed, or explicitly reported unavailable. This directory only changes
*who does what in what order*, not *what gets built*. Task content (files,
steps, code) is pulled verbatim from the parent plan; do not re-derive it
from memory or from this index.

**Spec:** [`docs/superpowers/specs/2026-08-30-remove-synthetic-fallbacks-design.md`](../../specs/2026-08-30-remove-synthetic-fallbacks-design.md)

---

## Why this split, not the parent plan's phase order

The parent plan's six phases are ordered for *rollout risk* — Tier A
(caption/report deletions) comes after Tier C (provenance) so Module 2 isn't
also broken while Module 3 is being made to fail loudly, and Naver comes
after Tier A so `gemini_client.py`/`content.py` are edited once instead of
twice. Those are good reasons for **one person executing serially**. They
are not file dependencies, and none of them require three people to take
turns.

The actual constraint for parallel work is simpler: **which tasks write to
the same file.** Mapped precisely across all 30 remaining tasks, there is
exactly one cross-lane collision — `frontend/components/module-1/onboarding/obDraft.tsx`,
written by both the Naver frontend task and the fixtures-rehoming task. Every
other remaining task touches files no other remaining task touches. That one
collision is what the trunk task exists to clear.

## Structure

```
01-trunk.md                          Task 28 — do this first, by anyone
02-lane-a-forecasting.md             Tasks 9–16  — Module 2 (Spring + fastapi-transformer + frontend)
03-lane-b-content-and-reports.md     Tasks 19–27, 29 — fastapi-sbert + Spring module3/module4
04-lane-c-fixtures.md                Tasks 30–35 — frontend fixture layer (starts after 01)
05-integration.md                    Tasks 36–40 — after all three lanes merge, not parallel
```

## Dependency graph

```
01-trunk (Task 28)
    │
    ├──────────────┬──────────────────┐
    │               │                  │
    ▼               ▼                  ▼
02-lane-a       03-lane-b          04-lane-c
(no dependency   (no dependency    (needs 01 merged —
 on 01; can       on 01 either;     Task 31 reuses 01's
 start before     independent       PlatformId/obDraft
 01 lands)        of 01 and 02)     changes)
    │               │                  │
    └───────────────┴──────────────────┘
                     │
                     ▼
              05-integration
         (needs all three merged)
```

Lane A and Lane B have **no dependency on the trunk at all** — start them
immediately, in parallel with the trunk. Only Lane C needs the trunk merged
first.

## The one remaining shared file — not a blocker, a merge-order note

`frontend/types.ts` is edited by three different tasks: Lane A's Task 16
(adds `Market.dataAsOf`/`dataStale`), the trunk's Task 28 (narrows
`PlatformId`), and Lane C's Task 35 (deletes `WorkspaceMemberFixture`).
Different regions of the file — no semantic conflict — but three people
touching one file means whoever merges second or third resolves a
non-overlapping diff, not a real conflict. Cheapest order: **trunk merges
first** (it already has to, for Lane C to start), then Lane A and Lane C in
either order. Whoever merges last just rebases past the earlier hunk.

## Assigning the lanes

| Lane | Tasks | File surface | Suggested for |
|---|---|---|---|
| Trunk | 28 | Frontend: `types.ts`, `obDraft.tsx`, platform-label components | Whoever's available first — it's small |
| A — Forecasting | 9–16 | Spring `module2`, `fastapi-transformer/trend_service.py`, frontend `Market`/`StaleDataBanner`/`DashboardView` | A backend dev comfortable with Postgres migrations |
| B — Content & Reports | 19–27, 29 | `fastapi-sbert` (Python), Spring `module3` content DTOs + `module4` report | A backend dev comfortable with Python and Java in the same session |
| C — Fixtures | 30–35 | Frontend `services/fixtures/`, `apiClient.ts`, three screens | A frontend dev; starts once the trunk is merged |

## What "done" means for this whole effort

All four files' own exit criteria pass, **and**:

- [ ] `git log` shows the trunk, then Lane A/B in either order, then Lane C, then integration — five merges (trunk + 3 lanes + integration), not one giant one
- [ ] No file appears in two lanes' diffs except the documented `types.ts` case above
- [ ] The parent plan's own "Whole-plan exit criteria" (`06-guards.md`) pass after Integration lands
