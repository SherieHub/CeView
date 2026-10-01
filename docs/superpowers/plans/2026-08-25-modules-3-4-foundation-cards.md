# Modules 3 & 4 Foundation-Card Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure Modules 3 and 4's task cards so each surface opens with a foundation card that
owns every shared file, cross-surface state lives in its own root card, and every remaining card in
those modules can be built fully in parallel.

**Architecture:** Almost entirely planning-document edits under
`docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/`: `00-index.md` (amended binding rule,
renumbered dependency graph, updated spec map), full rewrites of `04-module-3.md` (14 cards) and
`05-module-4.md` (7 cards), their `diagrams/cards/module-{3,4}/*.mmd` + `pseudocode/module-{3,4}/*.ts`
companions, and the two module-level component diagrams. The one source change is comment-only:
relocating eight unrouted scaffold stubs in `frontend/` to the numbered directory convention Module 2
already uses, with their header comments repointed to the new card IDs.

**Tech Stack:** Markdown + Mermaid `flowchart TD` + typed-outline `.ts` pseudocode, matching every
other card file in this plan directory. Source moves use `git mv`; verification uses
`npm run build` / `npm run test:unit` in `frontend/`.

**Design spec:** [`docs/superpowers/specs/2026-08-25-modules-3-4-foundation-cards-design.md`](../specs/2026-08-25-modules-3-4-foundation-cards-design.md)

**Per this repo's `.claude/CLAUDE.md`:** never run `git commit` / `git push`. Every task below ends at
"stage the files" — commits are the user's to run.

**Card-ID map (old → new)**, for reference while executing:

| Old | New | Old | New |
|---|---|---|---|
| Card 15 | M3-1 | Card 22 | M3-9 |
| Card 16 | M3-2 | Card 23 | M3-10 |
| Card 17 | M3-3 | Card 24 | M4-F |
| Card 18 | M3-4 | Card 25 | M4-1, M4-2, M4-3 |
| Card 19 | M3-5 | Card 26 | M4-4, M4-5 |
| Card 20 | M3-6 | Card 27 | M4-6 |
| Card 21 | M3-7, M3-8 | — | M3-F0…M3-F3 (new) |

---

### Task 1: Amend `00-index.md`'s binding rule, dependency graph, and spec map

**Files:**
- Modify: `docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/00-index.md`

- [ ] **Step 1: Replace the binding rule**

In the "Card template" section's field guide, replace the whole paragraph that begins
`**Binding rule — one prerequisite per module:**` (through `see \`03-module-2.md\` for a worked
example.`) with:

```markdown
**Binding rule — foundation cards gate every module:** every module file must open with a
`Foundation — <Surface>` card for each distinct surface it builds, plus — where state crosses
surfaces — one or more shared-root cards owning that state. Every other card in the module depends on
exactly one of those roots and nothing else within the module (a module's independent tracks, e.g. a
backend track parallel to the frontend track, are their own roots the same way). Sibling cards must
never list the same file under "Project files to add/implement"; if two features would naturally share
a file, the foundation card owns that file (creating typed stubs/slots for the pieces sibling cards
will fill in) and each sibling card fully owns replacing its one assigned stub. State two sibling
cards would both read or write belongs to their shared root, never to one of the siblings. This keeps
every card after the foundations buildable in full parallel — see `03-module-2.md` (single surface)
and `04-module-3.md` (multi-surface, with a shared-store root) for worked examples.
```

- [ ] **Step 2: Replace the dependency-graph intro paragraph**

Replace the paragraph directly under `## Dependency graph` with:

```markdown
Foundation cards have no dependencies and block every screen card. Within a module, cards depend only
on their module's foundation/root card(s). The two cross-surface stores live in `M3-F0`, so Calendar,
Settings, and Module 4's published-post card depend on it directly rather than on a Content Studio
feature card. Modules 2, 3, and 4 use the module-scoped ID scheme end to end; Module 1 below keeps its
legacy local numbers for now — retrofitting it is future work, not done in this pass.
```

- [ ] **Step 3: Replace every Module 3 and Module 4 row in the dependency-graph table**

Delete the rows for Cards 15–27 and insert, after the `M2-B2` row:

```markdown
| M3-F0 | Foundation — Shared Stores | [`04-module-3.md`](04-module-3.md) | Fixture Data Layer |
| M3-F1 | Foundation — Content Studio Shell | [`04-module-3.md`](04-module-3.md) | Shell & Routing, M3-F0 |
| M3-1 | Content Studio — AI Copywriting Matrix (incl. Naver) | [`04-module-3.md`](04-module-3.md) | M3-F1 |
| M3-2 | Content Studio — Visual Direction Board | [`04-module-3.md`](04-module-3.md) | M3-F1 |
| M3-3 | Content Studio — Publish Composer (connection-gated) | [`04-module-3.md`](04-module-3.md) | M3-F1 |
| M3-4 | Content Studio — Compliance Audit Panel | [`04-module-3.md`](04-module-3.md) | M3-F1 |
| M3-5 | Content Studio — Content Board & Publish Action | [`04-module-3.md`](04-module-3.md) | M3-F1 |
| M3-F2 | Foundation — Calendar Shell | [`04-module-3.md`](04-module-3.md) | Shell & Routing, M3-F0 |
| M3-6 | Calendar — Month Grid & Navigation | [`04-module-3.md`](04-module-3.md) | M3-F2 |
| M3-7 | Calendar — List View | [`04-module-3.md`](04-module-3.md) | M3-F2 |
| M3-8 | Calendar — Day-Click Modal | [`04-module-3.md`](04-module-3.md) | M3-F2 |
| M3-F3 | Foundation — Settings Shell | [`04-module-3.md`](04-module-3.md) | Shell & Routing, M3-F0 |
| M3-9 | Settings — Platforms | [`04-module-3.md`](04-module-3.md) | M3-F3 |
| M3-10 | Settings — Workspace | [`04-module-3.md`](04-module-3.md) | M3-F3 |
| M4-F | Foundation — Performance Shell & Ingestion | [`05-module-4.md`](05-module-4.md) | Shell & Routing, Fixture Data Layer |
| M4-1 | Performance — KPI Cards & Flagged Metrics | [`05-module-4.md`](05-module-4.md) | M4-F |
| M4-2 | Performance — PES Gauge | [`05-module-4.md`](05-module-4.md) | M4-F |
| M4-3 | Performance — Customer Journey Funnel | [`05-module-4.md`](05-module-4.md) | M4-F |
| M4-4 | Performance — Trend Charts | [`05-module-4.md`](05-module-4.md) | M4-F |
| M4-5 | Performance — AI Action Plan | [`05-module-4.md`](05-module-4.md) | M4-F |
| M4-6 | Performance — Previously Published & Post Analytics Modal | [`05-module-4.md`](05-module-4.md) | M4-F, M3-F0 |
```

- [ ] **Step 4: Update the Playwright spec ↔ card map**

Replace the last five rows of the "Playwright spec ↔ card map" table (`content-studio.spec.ts`
through `performance.spec.ts`) with:

```markdown
| `e2e/tests/content-studio.spec.ts` | M3-F1, M3-1 – M3-5 |
| `e2e/tests/calendar.spec.ts` | M3-F2, M3-6 – M3-8 |
| `e2e/tests/settings-platforms.spec.ts` | M3-F3, M3-9 |
| `e2e/tests/settings-workspace.spec.ts` | M3-F3, M3-10 |
| `e2e/tests/performance.spec.ts` | M4-F, M4-1 – M4-6 |
```

- [ ] **Step 5: Fix the stale cross-module note in "Decisions this plan assumes"**

In decision 3, the phrase "(Foundation Card 3)" refers to the Fixture Data Layer and stays as is. No
edit needed — this step is a read-only check that decision 3 still reads correctly after the
renumbering.

- [ ] **Step 6: Verify no leftover Module 3/4 legacy numbering in the index**

Run: `grep -nE "Card (1[5-9]|2[0-7])" docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/00-index.md`
Expected: no output.

- [ ] **Step 7: Stage the file**

```bash
git add docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/00-index.md
```

---

### Task 2: Write M3-F0's (Shared Stores) diagram and pseudocode

**Files:**
- Create: `docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/diagrams/cards/module-3/foundation-shared-stores.mmd`
- Create: `docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/pseudocode/module-3/foundation-shared-stores.ts`

- [ ] **Step 1: Write the flow diagram**

Create `diagrams/cards/module-3/foundation-shared-stores.mmd`:

```
flowchart TD
  PMount(["First consumer mounts (Content Studio, Calendar or Performance)"]) --> PSeed["postStore: posts=null (loading) → apiClient.posts.list() → PublishedPost[]"]
  PSeed --> PServe(["usePosts() serves the same array to every subscriber"])
  PServe -->|M3-5 calls publish(draft)| PAppend["append one PublishedPost per selected platform\nstatus='published', date=today, metrics zeroed"]
  PAppend --> PNotify(["all subscribers re-render — no refetch, no reload"])

  CMount(["First consumer mounts (Content Studio or Settings)"]) --> CSeed["connectionsStore: connections=null (loading) → apiClient.connections.list() → PlatformConnection[]"]
  CSeed --> CServe(["useConnections() serves connected/handle per PlatformId"])
  CServe -->|M3-9 calls connect(p)| CConnect["apiClient.connections.connect(p) → mark connected"]
  CServe -->|M3-9 calls disconnect(p)| CDisconnect["apiClient.connections.disconnect(p) → mark disconnected"]
  CDisconnect --> CEmit["emit disconnect event for p"]
  CEmit --> CPrune(["M3-F1's shell drops p from its in-progress publish selection"])
```

- [ ] **Step 2: Write the pseudocode**

Create `pseudocode/module-3/foundation-shared-stores.ts`:

```ts
// ---- services/postStore.ts ----
import type { PublishedPost } from './fixtures/posts'
import type { PlatformId } from '../types'
import { apiClient } from './apiClient'

// Provider + hook pair, same shape as services/profileContext.tsx. One instance per app,
// seeded once, mounted in App.tsx above the AppShell route element so Content Studio,
// Calendar and Performance all read the same array.

export interface PublishDraft {
  caption: string
  mediaDataUrl: string | null
  platforms: PlatformId[]
}

export interface PostStore {
  posts: PublishedPost[] | null                 // null = still loading
  publish(draft: PublishDraft): PublishedPost[] // one new post per platform; returns what it added
  metricsFor(postId: string): PublishedPost | null
}

export function PostStoreProvider(props: { children }): JSX.Element
  on mount → apiClient.posts.list() → setPosts(list)   // failure → setPosts([])
  publish(draft):
    created ← draft.platforms.map(p => ({
      id: 'p-' + Date.now() + '-' + p, date: todayISO(), platform: p,
      caption: draft.caption, status: 'published',
      reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, series: [],
    }))
    setPosts(prev => [...created, ...(prev ?? [])])
    return created
  metricsFor(id): posts?.find(p => p.id === id) ?? null

export function usePosts(): PostStore   // throws outside the provider

// ---- services/connectionsStore.ts ----
import type { PlatformConnection, PlatformId } from '../types'
import { apiClient } from './apiClient'

export interface ConnectionsStore {
  connections: PlatformConnection[] | null      // null = still loading
  isConnected(p: PlatformId): boolean
  connect(p: PlatformId, handle: string): Promise<void>
  disconnect(p: PlatformId): Promise<void>
  onDisconnect(cb: (p: PlatformId) => void): () => void   // returns unsubscribe
}

export function ConnectionsStoreProvider(props: { children }): JSX.Element
  on mount → apiClient.connections.list() → setConnections(list)
  connect(p, handle): await apiClient.connections.connect(p)
    → mark { connected: true, handle, connectedAt: nowISO() } for p
  disconnect(p): await apiClient.connections.disconnect(p)
    → mark { connected: false, handle: null, connectedAt: null } for p
    → notify every onDisconnect listener with p
  onDisconnect(cb): add cb to a listener set; return () => set.delete(cb)

export function useConnections(): ConnectionsStore

// Ownership note: M3-5 is the only caller of publish(); M3-9 the only caller of
// connect()/disconnect(). Every other card is a read-only consumer.
```

- [ ] **Step 3: Stage the files**

```bash
git add docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/diagrams/cards/module-3/foundation-shared-stores.mmd docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/pseudocode/module-3/foundation-shared-stores.ts
```

---

### Task 3: Write M3-F1's (Content Studio Shell) diagram and pseudocode

**Files:**
- Create: `docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/diagrams/cards/module-3/foundation-content-studio-shell.mmd`
- Create: `docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/pseudocode/module-3/foundation-content-studio-shell.ts`

- [ ] **Step 1: Write the flow diagram**

Create `diagrams/cards/module-3/foundation-content-studio-shell.mmd`:

```
flowchart TD
  Mount(["/content mounted"]) --> Init["useContentStudioState():\nactivePlatform='instagram', draft={caption:'', media:null, platforms:[]},\naudit={status:'idle', step:0, result:null}"]
  Init --> Sub["subscribe connectionsStore.onDisconnect(p) → drop p from draft.platforms"]
  Sub --> Render(["Render two-column layout"])
  Render --> Left(["Left column: AIContentMatrixPanel slot + VisualDirectionBoard slot"])
  Render --> Right(["Right column: PublishComposer slot + CompliancePanel slot"])
  Render --> Below(["Full-width below: ContentBoard slot"])
  Left -->|onPlatformChange / onStageCaption| Init
  Right -->|onDraftChange, audit written back| Init
  Below -->|onPublished after postStore.publish| Reset["clear draft + audit back to idle"]
  Render -->|each slot is a stub until its owning card lands| Placeholder(["Slot renders its stub placeholder text"])
```

- [ ] **Step 2: Write the pseudocode**

Create `pseudocode/module-3/foundation-content-studio-shell.ts`:

```ts
// ---- components/module-3/3.1-content-studio/contentStudioTypes.ts ----
import type { PlatformId } from '../../../types'
import type { OmcsAuditResult } from '../../../services/fixtures/omcs'

export interface PublishDraftState {
  caption: string
  mediaDataUrl: string | null
  platforms: PlatformId[]
  visibility: 'public' | 'private'
  commentsEnabled: boolean
  paidPartnership: boolean
  agreementChecked: boolean
}

export type AuditStatus = 'idle' | 'running' | 'complete'
export interface AuditState { status: AuditStatus; step: number; result: OmcsAuditResult | null }

// M3-1
export interface MatrixSlotProps {
  activePlatform: PlatformId
  onPlatformChange(p: PlatformId): void
  onStageCaption(text: string): void        // "Approve" copies the option's text into the draft
  stagedCaption: string
}
// M3-2
export interface VisualDirectionSlotProps { activePlatform: PlatformId }
// M3-3
export interface ComposerSlotProps {
  draft: PublishDraftState
  onDraftChange(patch: Partial<PublishDraftState>): void
  audit: AuditState
}
// M3-4
export interface ComplianceSlotProps {
  draft: PublishDraftState
  audit: AuditState
  onAuditChange(next: AuditState): void
}
// M3-5
export interface BoardSlotProps {
  draft: PublishDraftState
  canPublish: boolean
  onPublished(): void                        // shell resets draft + audit
}

// ---- components/module-3/3.1-content-studio/ContentStudioView.tsx ----
imports: useState, useEffect, useConnections, contentStudioTypes,
         AIContentMatrixPanel, VisualDirectionBoard, PublishComposer, CompliancePanel, ContentBoard

function useContentStudioState():
  state: activePlatform ← 'instagram'
         draft ← { caption: '', mediaDataUrl: null, platforms: [], visibility: 'public',
                   commentsEnabled: true, paidPartnership: false, agreementChecked: false }
         audit ← { status: 'idle', step: 0, result: null }
  patchDraft(patch): setDraft(d => ({ ...d, ...patch }))
    → if patch touches caption / mediaDataUrl / platforms, reset audit to idle (stale result)
  on connections.onDisconnect(p) → patchDraft({ platforms: draft.platforms.filter(x => x !== p) })
  reset(): draft ← initial, audit ← idle       // called after a successful publish
  returns { activePlatform, setActivePlatform, draft, patchDraft, audit, setAudit, reset }

function ContentStudioView():
  { activePlatform, setActivePlatform, draft, patchDraft, audit, setAudit, reset } ← useContentStudioState()
  canPublish ← draft.caption !== '' && draft.mediaDataUrl !== null
               && draft.platforms.length > 0 && draft.agreementChecked
               && audit.status === 'complete' && audit.result?.status === 'Pass'
  render:
    left column:  <AIContentMatrixPanel activePlatform onPlatformChange={setActivePlatform}
                    onStageCaption={t => patchDraft({ caption: t })} stagedCaption={draft.caption}/>
                  <VisualDirectionBoard activePlatform={activePlatform}/>
    right column: <PublishComposer draft={draft} onDraftChange={patchDraft} audit={audit}/>
                  <CompliancePanel draft={draft} audit={audit} onAuditChange={setAudit}/>
    below:        <ContentBoard draft={draft} canPublish={canPublish} onPublished={reset}/>

// ---- 3.1-content-studio/AIContentMatrixPanel.tsx (stub) ----
// ---- 3.1-content-studio/VisualDirectionBoard.tsx (stub) ----
// ---- 3.1-content-studio/PublishComposer.tsx (stub) ----
// ---- 3.1-content-studio/CompliancePanel.tsx (stub) ----
// ---- 3.1-content-studio/ContentBoard.tsx (stub) ----
each: typed against its Slot interface in contentStudioTypes.ts; renders the same
"Not implemented yet — see CARD M3-<n>" placeholder style the current stubs use.
Ownership of each transfers whole to the sibling card named in the comment above its interface.
```

- [ ] **Step 3: Stage the files**

```bash
git add docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/diagrams/cards/module-3/foundation-content-studio-shell.mmd docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/pseudocode/module-3/foundation-content-studio-shell.ts
```

---

### Task 4: Write M3-F2's (Calendar Shell) companions and re-scope the Calendar siblings

**Files:**
- Create: `diagrams/cards/module-3/foundation-calendar-shell.mmd`, `pseudocode/module-3/foundation-calendar-shell.ts`
- Modify: `diagrams/cards/module-3/calendar-month-grid-navigation.mmd`, `pseudocode/module-3/calendar-month-grid-navigation.ts`
- Create: `diagrams/cards/module-3/calendar-list-view.mmd`, `pseudocode/module-3/calendar-list-view.ts`, `diagrams/cards/module-3/calendar-day-modal.mmd`, `pseudocode/module-3/calendar-day-modal.ts`
- Delete: `diagrams/cards/module-3/calendar-list-view-day-click-modal.mmd`, `pseudocode/module-3/calendar-list-view-day-click-modal.ts`

All paths in this task are relative to `docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/`.

- [ ] **Step 1: Write the M3-F2 flow diagram**

Create `diagrams/cards/module-3/foundation-calendar-shell.mmd`:

```
flowchart TD
  Mount(["/calendar mounted"]) --> State["useCalendarState():\nyear/month = today, view='month', modalDate=null"]
  State --> Read["usePosts() → PublishedPost[] | null (loading)"]
  Read --> Grid["buildGrid(year, month) → GridCell[] (leading/in-month/trailing/isToday)"]
  Grid --> Render(["Render header (month label, prev/next, Month/List toggle, status counts)"])
  Render -->|view='month'| MonthSlot(["CalendarMonthGrid slot"])
  Render -->|view='list'| ListSlot(["CalendarListView slot"])
  MonthSlot -->|onDayClick(date) with posts.length > 0| SetModal["modalDate = date"]
  MonthSlot -->|onDayClick(date) with no posts| NoOp(["no-op"])
  SetModal --> ModalSlot(["DayPostsModal slot"])
  ModalSlot -->|onClose| ClearModal["modalDate = null"]
  Render -->|each slot is a stub until its owning card lands| Placeholder(["Slot renders its stub placeholder text"])
```

- [ ] **Step 2: Write the M3-F2 pseudocode**

Create `pseudocode/module-3/foundation-calendar-shell.ts`:

```ts
// ---- components/module-3/3.2-calendar/calendarTypes.ts ----
import type { PublishedPost } from '../../../services/fixtures/posts'

export interface GridCell { date: string; inMonth: boolean; isToday: boolean }
export type CalendarViewMode = 'month' | 'list'

// M3-6
export interface MonthGridSlotProps {
  cells: GridCell[]
  postsByDate: Record<string, PublishedPost[]>
  onDayClick(date: string): void
}
// M3-7
export interface ListViewSlotProps { posts: PublishedPost[] }
// M3-8
export interface DayModalSlotProps {
  date: string
  posts: PublishedPost[]
  onClose(): void
}

// ---- components/module-3/3.2-calendar/CalendarView.tsx ----
imports: useState, useMemo, usePosts, calendarTypes,
         CalendarMonthGrid, CalendarListView, DayPostsModal

function buildGrid(year: number, month: number): GridCell[]
  // leading cells: prev month's trailing days (inMonth: false, inert)
  // one cell per day of the target month
  // trailing cells: next month's leading days, padding to a multiple of 7
  // the cell matching today's real date → isToday: true

function useCalendarState():
  state: year ← current year, month ← current month, view ← 'month', modalDate ← null
  shiftMonth(delta): month += delta, wrapping Dec→Jan / Jan→Dec and adjusting year
  returns { year, month, shiftMonth, view, setView, modalDate, setModalDate }

function CalendarView():
  { posts } ← usePosts()
  { year, month, shiftMonth, view, setView, modalDate, setModalDate } ← useCalendarState()
  cells ← useMemo(() => buildGrid(year, month), [year, month])
  postsByDate ← group (posts ?? []) by post.date
  counts ← per-status counts across the WHOLE store, not just the visible month
  openDay(date): if (postsByDate[date]?.length ?? 0) > 0 → setModalDate(date)   // else no-op

  render:
    header: month label, prev/next (shiftMonth ±1), Month/List segmented toggle, counts
    view === 'month'
      ? <CalendarMonthGrid cells={cells} postsByDate={postsByDate} onDayClick={openDay}/>
      : <CalendarListView posts={posts ?? []}/>
    modalDate && <DayPostsModal date={modalDate} posts={postsByDate[modalDate] ?? []}
                                onClose={() => setModalDate(null)}/>

// ---- 3.2-calendar/CalendarMonthGrid.tsx (stub) ----
// ---- 3.2-calendar/CalendarListView.tsx (stub) ----
// ---- 3.2-calendar/DayPostsModal.tsx (stub) ----
each: typed against its Slot interface in calendarTypes.ts; same "Not implemented yet —
see CARD M3-<n>" placeholder style. Ownership transfers whole to the named sibling card.
```

- [ ] **Step 3: Re-scope M3-6's pseudocode to the month-grid slot**

Overwrite `pseudocode/module-3/calendar-month-grid-navigation.ts` with:

```ts
// ---- components/module-3/3.2-calendar/CalendarMonthGrid.tsx ----
imports: MonthGridSlotProps from './calendarTypes', CalendarCell

// The shell (M3-F2) owns year/month, buildGrid() and the day-click gate; this card owns
// only the rendering of the 7-column grid and its cells.

function CalendarMonthGrid({ cells, postsByDate, onDayClick }: MonthGridSlotProps):
  render: 7-column grid, one CalendarCell per cell —
    <CalendarCell cell={cell} posts={cell.inMonth ? (postsByDate[cell.date] ?? []) : []}
                  onClick={cell.inMonth ? () => onDayClick(cell.date) : undefined}/>
  // out-of-month cells render greyed and inert (no onClick)

// ---- components/module-3/3.2-calendar/CalendarCell.tsx ----
props: { cell: GridCell; posts: PublishedPost[]; onClick?: () => void }
shown ← posts.slice(0, 3)          // platform-colored chips (border-left colored by platform)
overflow ← posts.length - shown.length
render: day number (ringed when cell.isToday), shown chips,
        "+N more" indicator when overflow > 0 instead of a 4th chip
```

- [ ] **Step 4: Re-scope M3-6's flow diagram**

Overwrite `diagrams/cards/module-3/calendar-month-grid-navigation.mmd` with:

```
flowchart TD
  Props(["CalendarMonthGrid receives cells + postsByDate from the shell"]) --> Loop["for each GridCell"]
  Loop -->|cell.inMonth = false| Inert(["render greyed, inert cell — no onClick"])
  Loop -->|cell.inMonth = true| Cell["CalendarCell: posts = postsByDate[cell.date] ?? []"]
  Cell --> Today{"cell.isToday?"}
  Today -->|yes| Ring(["day number rendered with today ring"])
  Today -->|no| Plain(["day number rendered plain"])
  Cell --> Chips{"posts.length > 3?"}
  Chips -->|yes| Overflow(["3 chips + '+N more'"])
  Chips -->|no| All(["one chip per post"])
  Cell -->|click| Emit(["onDayClick(cell.date) — shell decides whether to open the modal"])
```

- [ ] **Step 5: Write M3-7's (List View) companions**

Create `pseudocode/module-3/calendar-list-view.ts`:

```ts
// ---- components/module-3/3.2-calendar/CalendarListView.tsx ----
imports: ListViewSlotProps from './calendarTypes'

// The shell (M3-F2) owns the Month/List toggle; this card owns only the list body.

function CalendarListView({ posts }: ListViewSlotProps):
  sorted ← [...posts].sort by date descending (most recent first)
  if sorted.length === 0 → render the empty state ("No posts yet")
  render: one row per post — platform dot, formatted date, single-line caption excerpt,
          status chip ('published' | 'draft')
```

Create `diagrams/cards/module-3/calendar-list-view.mmd`:

```
flowchart TD
  Props(["CalendarListView receives the full post list from the shell"]) --> Empty{"posts.length === 0?"}
  Empty -->|yes| EmptyState(["render 'No posts yet' empty state"])
  Empty -->|no| Sort["sort by date descending"]
  Sort --> Rows(["one row per post: platform dot, date, caption excerpt, status chip"])
```

- [ ] **Step 6: Write M3-8's (Day Modal) companions**

Create `pseudocode/module-3/calendar-day-modal.ts`:

```ts
// ---- components/module-3/3.2-calendar/DayPostsModal.tsx ----
imports: DayModalSlotProps from './calendarTypes', Modal from '../../shared/Modal'

// The shell (M3-F2) owns modalDate and the "no posts → no-op" gate, so this component is
// only ever mounted with a non-empty posts array.

function DayPostsModal({ date, posts, onClose }: DayModalSlotProps):
  render: <Modal open title={formatted date} onClose={onClose}> listing every post that day —
    caption, platform, status chip; published posts additionally show reach / likes /
    engagementRate inline; draft posts show a "Draft" chip and no metrics
```

Create `diagrams/cards/module-3/calendar-day-modal.mmd`:

```
flowchart TD
  Mount(["DayPostsModal mounted with date + non-empty posts"]) --> Rows["one row per post"]
  Rows --> Status{"post.status"}
  Status -->|published| Metrics(["caption + reach / likes / engagementRate"])
  Status -->|draft| Chip(["caption + Draft chip, no metrics"])
  Mount -->|scrim / Esc / close button| Close(["onClose() — shell clears modalDate"])
```

- [ ] **Step 7: Delete the superseded combined companions**

```bash
git rm docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/diagrams/cards/module-3/calendar-list-view-day-click-modal.mmd docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/pseudocode/module-3/calendar-list-view-day-click-modal.ts
```

- [ ] **Step 8: Stage the files**

```bash
git add docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/diagrams/cards/module-3/ docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/pseudocode/module-3/
```

---

### Task 5: Write M3-F3's (Settings Shell) companions and re-scope the Settings siblings

**Files:**
- Create: `diagrams/cards/module-3/foundation-settings-shell.mmd`, `pseudocode/module-3/foundation-settings-shell.ts`
- Modify: `pseudocode/module-3/settings-platforms.ts`, `pseudocode/module-3/settings-workspace.ts`

- [ ] **Step 1: Write the M3-F3 flow diagram**

Create `diagrams/cards/module-3/foundation-settings-shell.mmd`:

```
flowchart TD
  Route(["/settings/:tab mounted (replaces RoutePlaceholder)"]) --> Parse["tab = useParams().tab"]
  Parse --> Valid{"tab in SETTINGS_TABS?"}
  Valid -->|no| Redirect(["<Navigate to='/settings/profile' replace/>"])
  Valid -->|yes| Shell(["render tab rail + active panel"])
  Shell -->|tab='profile'| Profile(["BusinessProfileSettings (M1 Card 9, already built)"])
  Shell -->|tab='platforms'| Platforms(["PlatformsSettings slot — stub until M3-9"])
  Shell -->|tab='workspace'| Workspace(["WorkspaceSettings slot — stub until M3-10"])
  Shell -->|tab click| Nav(["navigate('/settings/<tab>') — URL is the only tab state"])
```

- [ ] **Step 2: Write the M3-F3 pseudocode**

Create `pseudocode/module-3/foundation-settings-shell.ts`:

```ts
// ---- components/settings/settingsTypes.ts ----
export type SettingsTabId = 'profile' | 'platforms' | 'workspace'

export interface SettingsTab {
  id: SettingsTabId
  label: string
  element: JSX.Element
}

// M3-9 and M3-10 each own one tab component; neither owns the registry or the shell.
export interface PlatformsSettingsProps { /* none — reads connectionsStore directly */ }
export interface WorkspaceSettingsProps { /* none — reads apiClient.workspace directly */ }

// ---- components/settings/SettingsView.tsx ----
imports: useParams, useNavigate, Navigate, settingsTypes,
         BusinessProfileSettings, PlatformsSettings, WorkspaceSettings

const SETTINGS_TABS: SettingsTab[] = [
  { id: 'profile',   label: 'Business profile', element: <BusinessProfileSettings/> },
  { id: 'platforms', label: 'Platforms',        element: <PlatformsSettings/> },
  { id: 'workspace', label: 'Workspace',        element: <WorkspaceSettings/> },
]

function SettingsView():
  tab ← useParams().tab
  active ← SETTINGS_TABS.find(t => t.id === tab)
  if !active → <Navigate to="/settings/profile" replace/>
  render: page head + tab rail (SETTINGS_TABS.map → button, navigate('/settings/' + t.id),
          aria-current on the active one) + active.element
  // Tab state lives only in the URL — Sidebar.tsx's existing settings sub-nav already
  // navigates to these same paths, so no new nav wiring is needed.

// App.tsx change (owned by this card):
//   { path: 'settings/:tab', element: <SettingsView/> }   // was <RoutePlaceholder navId="settings"/>

// ---- components/settings/PlatformsSettings.tsx (stub, ownership → M3-9) ----
// ---- components/settings/WorkspaceSettings.tsx (stub, ownership → M3-10) ----
// Both files already exist as scaffold stubs; this card re-types them against
// settingsTypes.ts and mounts them, it does not implement them.
```

- [ ] **Step 3: Re-scope M3-9's pseudocode to read the shared connections store**

In `pseudocode/module-3/settings-platforms.ts`, replace every reference to local connection
state or `apiClient.connections.*` with the shared store, and drop the cross-screen pruning
(now owned by M3-F0 + M3-F1). The file's first section becomes:

```ts
// ---- components/settings/PlatformsSettings.tsx ----
imports: useState, useConnections from '../../services/connectionsStore', ConnectPlatformModal

// M3-F0 owns the store and the disconnect event; M3-F1's shell owns the pruning of an
// in-progress publish selection. This card owns the Settings UI only.

function PlatformsSettings():
  { connections, connect, disconnect } ← useConnections()
  state: connecting ← null   // PlatformId currently going through ConnectPlatformModal
  if connections === null → render the loading state
  render: one row per PlatformId —
    connected  → handle, connectedAt, "Verified" badge, Disconnect button → disconnect(p)
    otherwise  → Connect button → connecting = p
  connecting && <ConnectPlatformModal platform={connecting}
                  onGranted={handle => { connect(connecting, handle); connecting = null }}
                  onCancel={() => connecting = null}/>
```

Leave the file's `ConnectPlatformModal.tsx` section (redirecting-spinner → scope-grant flow)
unchanged.

- [ ] **Step 4: Re-scope M3-10's pseudocode header**

At the top of `pseudocode/module-3/settings-workspace.ts`, replace the first `// ----` header
line's path comment block with:

```ts
// ---- components/settings/WorkspaceSettings.tsx ----
// Mounted by SettingsView.tsx (M3-F3) as the 'workspace' tab; this card owns the panel body
// only — no route wiring, no tab state.
```

The rest of the file (member list, invite form, optimistic row) is unchanged.

- [ ] **Step 5: Stage the files**

```bash
git add docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/diagrams/cards/module-3/ docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/pseudocode/module-3/
```

---

### Task 6: Re-scope the five Content Studio sibling companions to their slots

**Files:**
- Modify: `pseudocode/module-3/ai-copywriting-matrix.ts`, `visual-direction-board.ts`, `publish-composer.ts`, `compliance-audit-panel.ts`, `content-board-publish-action.ts`
- Modify: `diagrams/cards/module-3/publish-composer.mmd`, `content-board-publish-action.mmd`

- [ ] **Step 1: Re-head M3-1's pseudocode against `MatrixSlotProps`**

Replace the `props:` line at the top of `pseudocode/module-3/ai-copywriting-matrix.ts` with:

```ts
props: MatrixSlotProps from './contentStudioTypes'
       { activePlatform, onPlatformChange, onStageCaption, stagedCaption }
// The shell (M3-F1) owns activePlatform and the staged draft; this card owns the tabs' and
// option cards' own rendering plus per-platform approval state. "Approve" calls
// onStageCaption(option.text) rather than writing any shared state itself.
```

- [ ] **Step 2: Re-head M3-2's pseudocode against `VisualDirectionSlotProps`**

Replace the `props:` line at the top of `pseudocode/module-3/visual-direction-board.ts` with:

```ts
props: VisualDirectionSlotProps from './contentStudioTypes'  // { activePlatform }
// activePlatform arrives from the shell (M3-F1), not from AIContentMatrixPanel — this card
// no longer depends on M3-1.
```

- [ ] **Step 3: Rewrite M3-3's pseudocode against `ComposerSlotProps`**

Overwrite `pseudocode/module-3/publish-composer.ts` with:

```ts
// ---- components/module-3/3.1-content-studio/PublishComposer.tsx ----
imports: ComposerSlotProps + PublishDraftState from './contentStudioTypes',
         useConnections from '../../../services/connectionsStore'

// The shell (M3-F1) owns the draft and the audit state; M3-F0 owns connection state and the
// disconnect event. This card owns the composer UI and the block-reason ladder only.

type BlockReason = 'caption'|'media'|'platform'|'agreement'|'audit-running'|'audit-missing'|'audit-failed'|null

function PublishComposer({ draft, onDraftChange, audit }: ComposerSlotProps):
  { isConnected } ← useConnections()

  setPubmatFile(file): onDraftChange({ mediaDataUrl: dataUrlOf(file) })
    // the shell resets a stale audit when media/caption/platforms change

  togglePlatform(id):
    if !isConnected(id) → no-op          // deviation from prototype v1 — not freely selectable
    else → onDraftChange({ platforms: toggled(draft.platforms, id) })

  toggleAgreement(): onDraftChange({ agreementChecked: !draft.agreementChecked })
    // M3-4 watches agreementChecked and runs the audit; this card never runs it

  blockReason ← first unmet gate, in priority order:
    1. !draft.caption → 'caption'
    2. !draft.mediaDataUrl → 'media'
    3. draft.platforms.length === 0 → 'platform'
    4. !draft.agreementChecked → 'agreement'
    5. audit.status === 'running' → 'audit-running'
    6. audit.result === null → 'audit-missing'
    7. audit.result.status !== 'Pass' → 'audit-failed'
    else → null

  render: staged caption textarea (onChange → onDraftChange({caption})) + char count for
          activePlatform's limit + pubmat dropzone + platform picker (rows for unconnected
          platforms render disabled with an inline Connect link to /settings/platforms) +
          3 config switches (visibility / comments / paid, no gate) + agreement checkbox +
          Publish button (disabled unless blockReason === null;
          tooltip = BLOCK_REASON_TEXT[blockReason])
  // The Publish button's click handler lives in M3-5 (ContentBoard); this card only reports
  // readiness through the shell's canPublish computation.
```

- [ ] **Step 4: Update M3-3's flow diagram's gating source**

In `diagrams/cards/module-3/publish-composer.mmd`, replace any node or edge label naming
"Card 22" / "Settings — Platforms" as the connection source with `connectionsStore (M3-F0)`,
and replace any node describing local `omcs` / `auditRunning` state with
`audit prop from the shell (M3-F1)`. Leave the block-reason ladder nodes unchanged.

- [ ] **Step 5: Re-head M3-4's pseudocode against `ComplianceSlotProps`**

Replace the `props:` line at the top of `pseudocode/module-3/compliance-audit-panel.ts` with:

```ts
props: ComplianceSlotProps from './contentStudioTypes'  // { draft, audit, onAuditChange }
// The shell (M3-F1) owns audit state; this card drives it: on draft.agreementChecked
// becoming true with a caption and media staged, it walks the 6 steps calling
// onAuditChange({status:'running', step:n, result:null}) and finishes with
// onAuditChange({status:'complete', step:6, result: MOCK_OMCS}).
// It reads nothing from PublishComposer and no longer depends on M3-3.
```

- [ ] **Step 6: Rewrite M3-5's pseudocode against `BoardSlotProps`**

Overwrite `pseudocode/module-3/content-board-publish-action.ts` with:

```ts
// ---- components/module-3/3.1-content-studio/ContentBoard.tsx ----
imports: useState, BoardSlotProps from './contentStudioTypes',
         usePosts from '../../../services/postStore', Toast

// M3-F0 owns the post store and the publish() action; the shell (M3-F1) owns the draft and
// computes canPublish. This card owns the board UI and the Publish click handler.

function ContentBoard({ draft, canPublish, onPublished }: BoardSlotProps):
  { posts, publish } ← usePosts()
  state: filter ← 'all' | 'draft' | 'published'
  visible ← (posts ?? []).filter(p => filter === 'all' || p.status === filter)

  handlePublish():
    if !canPublish → no-op
    created ← publish({ caption: draft.caption, mediaDataUrl: draft.mediaDataUrl,
                        platforms: draft.platforms })
    toast('Published to ' + created.length + ' platform(s)')
    onPublished()        // shell clears the draft and resets the audit

  render: All/Draft/Published tabs + one card per visible post (platform, caption excerpt,
          date, status chip) + the Publish button wired to handlePublish, disabled unless
          canPublish
  // Calendar (M3-6..M3-8) and Performance (M4-6) read the same store, so newly created posts
  // appear there without a refetch or reload.
```

- [ ] **Step 7: Update M3-5's flow diagram's store source**

In `diagrams/cards/module-3/content-board-publish-action.mmd`, replace any node describing
this card as creating `services/postStore.ts` with one describing it calling
`postStore.publish(draft)` from M3-F0, and add a terminal node
`onPublished() → shell clears draft + audit`.

- [ ] **Step 8: Stage the files**

```bash
git add docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/diagrams/cards/module-3/ docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/pseudocode/module-3/
```

---

### Task 7: Write M4-F's companions and split the Module 4 siblings

**Files:**
- Rewrite: `pseudocode/module-4/ingestion-form-entry-state.ts` → becomes `pseudocode/module-4/foundation-performance-shell.ts` (git mv + rewrite)
- Rewrite: `diagrams/cards/module-4/ingestion-form-entry-state.mmd` → `diagrams/cards/module-4/foundation-performance-shell.mmd` (git mv + rewrite)
- Rewrite: `pseudocode/module-4/kpi-cards-pes-gauge-funnel.ts` into three: `kpi-cards.ts`, `pes-gauge.ts`, `customer-journey-funnel.ts`
- Split: `diagrams/cards/module-4/kpi-cards-pes-gauge-funnel.mmd` into three matching `.mmd` files
- Rewrite: `pseudocode/module-4/trend-charts-ai-action-plan.ts` into two: `trend-charts.ts`, `ai-action-plan.ts`
- Split: `diagrams/cards/module-4/trend-charts-ai-action-plan.mmd` into two matching `.mmd` files
- Modify: `pseudocode/module-4/previously-published-post-analytics-modal.ts` (postStore import path)

All paths in this task are relative to `docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/`.

- [ ] **Step 1: Rename the ingestion-form companion files to `foundation-performance-shell`**

```bash
git mv docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/pseudocode/module-4/ingestion-form-entry-state.ts \
       docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/pseudocode/module-4/foundation-performance-shell.ts
git mv docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/diagrams/cards/module-4/ingestion-form-entry-state.mmd \
       docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/diagrams/cards/module-4/foundation-performance-shell.mmd
```

- [ ] **Step 2: Overwrite `foundation-performance-shell.ts` with the promoted M4-F scope**

Overwrite `pseudocode/module-4/foundation-performance-shell.ts`:

```ts
// ---- components/module-4/4.1-campaign-analytics/campaignTypes.ts ----
import type { CampaignInput, CampaignHistoryEntry, PrescriptiveReport } from '../../../services/fixtures/campaign'

export interface Metrics { ctr: number; cpc: number; convRate: number; roas: number; cac: number }
export type FlaggedMetric = 'CTR' | 'CPC' | 'Conversion rate' | 'ROAS' | 'CAC'

// M4-1
export interface KpiSlotProps { metrics: Metrics; flagged: FlaggedMetric[] }
// M4-2
export interface PesGaugeSlotProps { score: number; label: string; metrics: Metrics }
// M4-3
export interface FunnelSlotProps { input: CampaignInput }
// M4-4
export interface TrendSlotProps { window: CampaignHistoryEntry[]; weeks: 4 | 8; onWeeksChange(w: 4 | 8): void }
// M4-5
export interface ActionPlanSlotProps { report: PrescriptiveReport }

// ---- components/module-4/4.1-campaign-analytics/campaignMetrics.ts ----
function computeMetrics(input: CampaignInput): { metrics: Metrics; flagged: FlaggedMetric[] }
  // each metric guards against a zero denominator by recording its name in `flagged`
  // instead of dividing by zero
  ctr ← impressions===0 ? (flag 'CTR', 0) : clicks/impressions*100
  cpc ← clicks===0 ? (flag 'CPC', 0) : adSpend/clicks
  convRate ← clicks===0 ? (flag 'Conversion rate', 0) : bookings/clicks*100
  roas ← adSpend===0 ? (flag 'ROAS', 0) : revenue/adSpend
  cac ← newCustomers===0 ? (flag 'CAC', 0) : adSpend/newCustomers

function computePes(metrics: Metrics): { score: number; label: string }
  // normalize ROAS/convRate/CAC/CTR/CPC against fixed Cebu-MSME bounds; CAC and CPC inverted
  // (lower raw value → higher normalized score); weights: ROAS 35%, convRate 30%, CAC 15%,
  // CTR 15%, CPC 5%
  score ← weighted sum of normalized values, in [0,1]
  label ← score>=0.8 Excellent : score>=0.6 Good : score>=0.4 Fair : Poor

// ---- components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx ----
imports: useState, useEffect, apiClient, campaignTypes, campaignMetrics,
         IngestionForm, KpiCard, FlaggedMetricBanner, PesGauge, CustomerJourneyFunnel,
         PesTrendChart, EfficiencyTrendChart, CostTrendChart, AiActionPlan,
         PreviouslyPublished

function CampaignAnalyticsView():
  state: campaign ← null (local/session, not persisted), weeks ← 4
         history ← null, report ← null   // both fetched once campaign is set
  handleSubmit(input): campaign ← input
  handleNewSubmission(): campaign ← null   // "New submission" ghost button, rendered here
  on campaign becoming non-null → apiClient.campaign.history() → setHistory,
                                   apiClient.campaign.report() → setReport
  if !campaign → render <IngestionForm onSubmit={handleSubmit}/>

  { metrics, flagged } ← computeMetrics(campaign)
  { score, label } ← computePes(metrics)
  windowSlice ← (history ?? []).slice(-weeks)

  else → render full view:
    <FlaggedMetricBanner flagged={flagged}/>
    5× <KpiCard .../> from metrics, composed via <KpiCard metrics={metrics} flagged={flagged}/> slot
    <PesGauge score={score} label={label} metrics={metrics}/>
    <CustomerJourneyFunnel input={campaign}/>
    <PesTrendChart window={windowSlice} weeks={weeks} onWeeksChange={setWeeks}/>
    <EfficiencyTrendChart window={windowSlice}/>
    <CostTrendChart window={windowSlice}/>
    {report && <AiActionPlan report={report}/>}
    <PreviouslyPublished/>
    "New submission" ghost button → handleNewSubmission

// ---- components/module-4/4.1-campaign-analytics/IngestionForm.tsx ----
const FIELDS: 7 entries — impressions, clicks, adSpend, revenue, conversions, bookings,
                          newCustomers (each with a label + inline hint)

function IngestionForm({ onSubmit }: { onSubmit(input: CampaignInput): void }):
  state: values ← {}, error ← null, submitting ← false
  handleSubmit():
    parsed ← Number() each field
    if any field is not finite or < 0 → error ← "All fields must be non-negative numbers."; stop
    else:
      error ← null; submitting ← true   // "Computing analytics…" spinner label
      (short simulated delay)
      submitting ← false
      onSubmit(parsed)
  render: error banner if set + 7 numeric fields (label + hint) + Submit button

// ---- 4.1-campaign-analytics/KpiCard.tsx (stub) ----
// ---- 4.1-campaign-analytics/FlaggedMetricBanner.tsx (stub) ----
// ---- 4.1-campaign-analytics/PesGauge.tsx (stub) ----
// ---- 4.1-campaign-analytics/CustomerJourneyFunnel.tsx (stub) ----
// ---- 4.1-campaign-analytics/PesTrendChart.tsx (stub) ----
// ---- 4.1-campaign-analytics/EfficiencyTrendChart.tsx (stub) ----
// ---- 4.1-campaign-analytics/CostTrendChart.tsx (stub) ----
// ---- 4.1-campaign-analytics/AiActionPlan.tsx (stub) ----
// ---- 4.1-campaign-analytics/PreviouslyPublished.tsx (stub) ----
// ---- 4.1-campaign-analytics/PostAnalyticsModal.tsx (stub) ----
each: typed against its Slot interface in campaignTypes.ts (PreviouslyPublished/
PostAnalyticsModal take no shell props — they read usePosts() directly, see M4-6); same
"Not implemented yet — see CARD M4-<n>" placeholder style. Ownership transfers whole to the
named sibling card.
```

- [ ] **Step 3: Overwrite `foundation-performance-shell.mmd`**

Overwrite `diagrams/cards/module-4/foundation-performance-shell.mmd`:

```
flowchart TD
  Mount(["/performance mounted"]) --> State["campaign=null, weeks=4"]
  State --> Entry(["render IngestionForm slot only"])
  Entry -->|onSubmit(input)| SetCampaign["campaign = input"]
  SetCampaign --> Fetch["fetch history + report (apiClient.campaign.history/report)"]
  Fetch --> Compute["computeMetrics(campaign) → metrics + flagged\ncomputePes(metrics) → score + label"]
  Compute --> Full(["render full view: KpiCard slot, PesGauge slot, Funnel slot,\n3 trend-chart slots, AiActionPlan slot, PreviouslyPublished slot"])
  Full -->|weeks toggle 4↔8| Compute
  Full -->|New submission| State
  Full -->|each slot is a stub until its owning card lands| Placeholder(["Slot renders its stub placeholder text"])
```

- [ ] **Step 4: Write M4-1's (KPI Cards) companions**

Create `pseudocode/module-4/kpi-cards.ts`:

```ts
// ---- components/module-4/4.1-campaign-analytics/KpiCard.tsx ----
props: { label: string; value: number; inverseGood?: boolean }   // CPC/CAC: lower is better
render: label, formatted value, trend arrow (direction accounts for inverseGood)

// ---- components/module-4/4.1-campaign-analytics/FlaggedMetricBanner.tsx ----
import type { KpiSlotProps } from './campaignTypes'
function FlaggedMetricBanner({ flagged }: Pick<KpiSlotProps, 'flagged'>):
  if flagged.length === 0 → render nothing
  else → banner naming every flagged metric, noting weight was redistributed in PES

// Both mounted by the shell (M4-F) against the same KpiSlotProps { metrics, flagged } —
// five <KpiCard> instances (one per metric) plus one <FlaggedMetricBanner>.
```

Create `diagrams/cards/module-4/kpi-cards.mmd`:

```
flowchart TD
  Props(["KpiCard × 5 + FlaggedMetricBanner receive metrics + flagged from the shell"]) --> Flag{"flagged.length > 0?"}
  Flag -->|yes| Banner(["FlaggedMetricBanner renders naming every flagged metric"])
  Flag -->|no| NoBanner(["FlaggedMetricBanner renders nothing"])
  Props --> Cards["one KpiCard per metric — CTR, CPC, Conversion rate, ROAS, CAC"]
  Cards --> Inverse{"metric is CPC or CAC?"}
  Inverse -->|yes| DownGood(["trend arrow: lower value shown as improvement"])
  Inverse -->|no| UpGood(["trend arrow: higher value shown as improvement"])
```

- [ ] **Step 5: Write M4-2's (PES Gauge) companions**

Create `pseudocode/module-4/pes-gauge.ts`:

```ts
// ---- components/module-4/4.1-campaign-analytics/PesGauge.tsx ----
import type { PesGaugeSlotProps } from './campaignTypes'
function PesGauge({ score, label, metrics }: PesGaugeSlotProps):
  render: radial gauge (score + label) + contribution-breakdown bar per weighted metric
          (ROAS 35%, convRate 30%, CAC 15%, CTR 15%, CPC 5%) + the weighted-sum formula
          shown verbatim
  // score/label already computed by computePes() in the shell (M4-F); this card only renders.
```

Create `diagrams/cards/module-4/pes-gauge.mmd`:

```
flowchart TD
  Props(["PesGauge receives score, label, metrics from the shell"]) --> Gauge(["radial gauge shows score in [0,1] + label"])
  Props --> Bars(["one contribution bar per weighted metric — ROAS 35% / convRate 30% / CAC 15% / CTR 15% / CPC 5%"])
  Props --> Formula(["weighted-sum formula rendered verbatim below the gauge"])
```

- [ ] **Step 6: Write M4-3's (Customer Journey Funnel) companions**

Create `pseudocode/module-4/customer-journey-funnel.ts`:

```ts
// ---- components/module-4/4.1-campaign-analytics/CustomerJourneyFunnel.tsx ----
import type { FunnelSlotProps } from './campaignTypes'
function CustomerJourneyFunnel({ input }: FunnelSlotProps):
  stages ← Impressions → Clicks → Conversions → Bookings
  for each stage after the first:
    dropOff ← prev.value > 0 ? (prev - curr) / prev * 100 : null   // render nothing if null
  render: 4 stages, each (after the first) showing its drop-off percentage
```

Create `diagrams/cards/module-4/customer-journey-funnel.mmd`:

```
flowchart TD
  Props(["CustomerJourneyFunnel receives the raw campaign input from the shell"]) --> Stages["Impressions → Clicks → Conversions → Bookings"]
  Stages --> Loop["for each stage after the first"]
  Loop --> Prev{"previous stage value > 0?"}
  Prev -->|yes| DropOff(["show drop-off %"])
  Prev -->|no| NoDropOff(["render nothing for that stage's drop-off"])
```

- [ ] **Step 7: Write M4-4's (Trend Charts) companions**

Create `pseudocode/module-4/trend-charts.ts`:

```ts
// ---- components/module-4/4.1-campaign-analytics/PesTrendChart.tsx ----
import type { TrendSlotProps } from './campaignTypes'
function PesTrendChart({ window, weeks, onWeeksChange }: TrendSlotProps):
  render: PES-over-time line for `window` + dashed horizontal reference lines at
          0.40/0.60/0.80 + a 4WK/8WK toggle calling onWeeksChange
  // window is already sliced to `weeks` by the shell; this card owns the toggle control but
  // the shell (M4-F) owns the actual slicing.

// ---- components/module-4/4.1-campaign-analytics/EfficiencyTrendChart.tsx ----
function EfficiencyTrendChart({ window }: Pick<TrendSlotProps, 'window'>):
  render: ROAS, CTR, conversion rate plotted together over `window`

// ---- components/module-4/4.1-campaign-analytics/CostTrendChart.tsx ----
// identical shape to EfficiencyTrendChart, plots CPC and CAC together instead
function CostTrendChart({ window }: Pick<TrendSlotProps, 'window'>): ...
```

Create `diagrams/cards/module-4/trend-charts.mmd`:

```
flowchart TD
  Props(["PesTrendChart / EfficiencyTrendChart / CostTrendChart receive window from the shell"]) --> Pes(["PesTrendChart: PES line + 0.40/0.60/0.80 reference lines"])
  Props --> Eff(["EfficiencyTrendChart: ROAS + CTR + conversion rate"])
  Props --> Cost(["CostTrendChart: CPC + CAC"])
  Pes -->|4WK/8WK toggle| Emit(["onWeeksChange(w) — shell re-slices window and re-renders all three"])
```

- [ ] **Step 8: Write M4-5's (AI Action Plan) companions**

Create `pseudocode/module-4/ai-action-plan.ts`:

```ts
// ---- components/module-4/4.1-campaign-analytics/AiActionPlan.tsx ----
import type { ActionPlanSlotProps } from './campaignTypes'
function AiActionPlan({ report }: ActionPlanSlotProps):
  render: executive summary text +
          report.funnelDiagnostics.map (rendered AS-GIVEN — already ranked
          Weakest→Moderate→Alright by business impact, NOT re-sorted by raw drop-off
          percentage) → diagnostic stage/rank/insight paired with report.recommendations[i]
          (title, action text, urgency chip: Most Urgent/Urgent/Not Very Urgent)
```

Create `diagrams/cards/module-4/ai-action-plan.mmd`:

```
flowchart TD
  Props(["AiActionPlan receives report from the shell"]) --> Summary(["render executive summary"])
  Props --> Diagnostics["report.funnelDiagnostics — already ranked Weakest → Moderate → Alright"]
  Diagnostics --> Pair["zip each diagnostic with report.recommendations[i]"]
  Pair --> Cards(["one card per pair: stage, rank, insight, recommendation title/action, urgency chip"])
```

- [ ] **Step 9: Delete the two superseded combined companions**

```bash
git rm docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/diagrams/cards/module-4/kpi-cards-pes-gauge-funnel.mmd \
       docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/pseudocode/module-4/kpi-cards-pes-gauge-funnel.ts \
       docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/diagrams/cards/module-4/trend-charts-ai-action-plan.mmd \
       docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/pseudocode/module-4/trend-charts-ai-action-plan.ts
```

- [ ] **Step 10: Re-scope M4-6's pseudocode to the shared store's real import path**

In `pseudocode/module-4/previously-published-post-analytics-modal.ts`, replace the header
import block and the `{ posts }` destructure source with:

```ts
// ---- components/module-4/4.1-campaign-analytics/PreviouslyPublished.tsx ----
imports: useState, usePosts from '../../../services/postStore', PlatformId type, PostAnalyticsModal

// M3-F0 owns the shared post store; this card is a read-only consumer. No dependency on
// Content Studio's feature cards — only on M3-F0 and M4-F.

type Filter: 'all' | PlatformId

function PreviouslyPublished():
  { posts } ← usePosts()
  ... (unchanged below)
```

Leave the rest of the file (filter tabs, `PostAnalyticsModal`) unchanged — only the import
source and the introductory comment change.

- [ ] **Step 11: Stage the files**

```bash
git add docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/diagrams/cards/module-4/ docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/pseudocode/module-4/
```

---

### Task 8: Rewrite `04-module-3.md` with all 14 cards

**Files:**
- Modify: `docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md`

- [ ] **Step 1: Overwrite the file**

Overwrite `docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md` in full with:

```markdown
# Module 3 — Content Studio, Calendar, Platforms, Workspace

All paths in this file are relative to `frontend/` (see `00-index.md`'s "Target directory" note).
`components/settings/` is the consolidated Settings directory shared with Module 1's Card 9 — see
M3-F3 below for why. Any DoD item below referencing a Playwright spec passing is deferred until
`frontend/` is wired into `e2e/` — see `00-index.md`'s Testing Strategy; treat it as a manual
verification step for now.

Screen docs: [`content-studio.md`](../../../module-3/screens/content-studio.md),
[`calendar.md`](../../../module-3/screens/calendar.md),
[`settings-platforms.md`](../../../module-3/screens/settings-platforms.md),
[`docs/shared/workspace.md`](../../../shared/workspace.md). Spec files:
`e2e/tests/content-studio.spec.ts` (M3-F1, M3-1–M3-5), `e2e/tests/calendar.spec.ts` (M3-F2, M3-6–
M3-8), `e2e/tests/settings-platforms.spec.ts` (M3-F3, M3-9), `e2e/tests/settings-workspace.spec.ts`
(M3-F3, M3-10).

**Component diagram:** [`diagrams/module-3.mmd`](diagrams/module-3.mmd)

**Reminder:** Content Studio builds prototype **v1** (`screen-content`/`renderContent()`) only.
`screen-content2` is a superseded draft — not built, not referenced by any card below.

**Parallelism:** Module 3 has four independent roots, not one — Content Studio, Calendar, and
Settings are separate surfaces with separate shells, and state that crosses those surfaces
(`postStore`, `connectionsStore`) lives in its own root, `M3-F0`, so no surface's foundation depends
on another surface's feature card. Once `M3-F0` merges, `M3-F1`/`M3-F2`/`M3-F3` can all be built in
parallel; once each of those merges, its own siblings can all be built in parallel. `M3-3` (Publish
Composer) and `M3-9` (Settings — Platforms) are true siblings of each other — both depend only on
`M3-F0`, neither on the other.

---

### CARD — Foundation: Shared Stores

**Depends on:** Foundation — Fixture Data Layer
**Summary:** The two stores that cross Module 3's surface boundaries — published posts and platform
connections — so Content Studio, Calendar, Settings, and Module 4's published-post card each depend
on this instead of on each other's feature cards.
**Prototype reference:** none — pure state layer; the shapes it seeds from are
`ui-ux-prototype.html:1468–1475` (posts) and `:4131–4202` (connections).

**Project files to add/implement:**
- `services/postStore.ts` — typed post list seeded from `services/fixtures/posts.ts`'s
  `MOCK_POSTS`, with the publish/append action and a per-post metrics accessor
- `services/connectionsStore.ts` — typed platform-connection state seeded from
  `apiClient.connections.list()`, with connect/disconnect actions and a disconnect-event
  subscription

**Related files:**
- `services/apiClient.ts` (Foundation — Fixture Data Layer) — `posts.list()`,
  `connections.list/connect/disconnect`
- `services/fixtures/posts.ts` — `MOCK_POSTS`, `PublishedPost`, the post store's seed data and type
- `types.ts` — `PlatformConnection`, `PlatformId`

**Flow:** [`diagrams/cards/module-3/foundation-shared-stores.mmd`](diagrams/cards/module-3/foundation-shared-stores.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/foundation-shared-stores.ts`](pseudocode/module-3/foundation-shared-stores.ts)

**Milestone (finished state):** Both providers mount above `AppShell` in `App.tsx`; any two
components under the same route tree that call `usePosts()` (or `useConnections()`) see the same
array and the same updates, with no prop drilling and no refetch on write.

**Definition of Done:**
- [ ] `postStore.test.ts` covers seeding, `publish()` appending one post per platform, and
      `metricsFor()`
- [ ] `connectionsStore.test.ts` covers seeding, connect/disconnect state transitions, and that
      `onDisconnect` listeners fire exactly once per disconnect
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- postStore connectionsStore
```

---

### CARD — Foundation: Content Studio Shell

**Depends on:** Foundation — Shell & Routing, Foundation — Shared Stores
**Summary:** The `/content` two-column page shell, the shared draft/audit state every Content Studio
sibling reads or writes, and the disconnect-prunes-selection wiring to `connectionsStore`.
**Prototype reference:** screen-content / `renderContent()` (shell only) —
`ui-ux-prototype.html:2794–2975`

**Project files to add/implement:**
- `components/module-3/3.1-content-studio/ContentStudioView.tsx` — two-column layout; owns
  `activePlatform`, the staged publish draft, and `auditStatus`/`auditResult`; composes 5 named slot
  components by fixed import path
- `components/module-3/3.1-content-studio/contentStudioTypes.ts` — the 5 slot prop contracts
  (`MatrixSlotProps`, `VisualDirectionSlotProps`, `ComposerSlotProps`, `ComplianceSlotProps`,
  `BoardSlotProps`)
- `components/module-3/3.1-content-studio/AIContentMatrixPanel.tsx`, `VisualDirectionBoard.tsx`,
  `PublishComposer.tsx`, `CompliancePanel.tsx`, `ContentBoard.tsx` — **stub placeholders only**;
  ownership of each transfers whole to one sibling card below

**Related files:**
- `services/fixtures/content.ts` (Foundation — Fixture Data Layer) — `MOCK_CONTENT.captions`, the
  per-platform option text/metadata a sibling card renders
- `services/connectionsStore.ts` (Foundation — Shared Stores) — `onDisconnect`, which this card
  subscribes to for pruning `draft.platforms`
- `types.ts` — `PlatformId`

**Flow:** [`diagrams/cards/module-3/foundation-content-studio-shell.mmd`](diagrams/cards/module-3/foundation-content-studio-shell.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/foundation-content-studio-shell.ts`](pseudocode/module-3/foundation-content-studio-shell.ts)

**Milestone (finished state):** `/content` renders the shell with all 5 slot placeholders visible;
disconnecting a platform that's staged in the (as-yet-stubbed) composer's selection removes it from
the shared draft state, observable in a state inspector — before any sibling fills in real content.

**Definition of Done:**
- [ ] `ContentStudioView.test.tsx` covers `useContentStudioState()`'s draft-patch/audit-reset
      transitions and the disconnect-prunes-selection subscription
- [ ] `content-studio.spec.ts` shell coverage — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- ContentStudioView
```

---

### CARD — Content Studio: AI Copywriting Matrix (incl. Naver)

**Depends on:** Foundation — Content Studio Shell
**Summary:** Left-column caption matrix — platform tabs, archetype options, Naver's 2-option branch,
"Why this caption" disclosure, Approve.
**Prototype reference:** screen-content / `renderContent()` (matrix section) + `csApprove()` —
`ui-ux-prototype.html:2794–2839`, `:2945–2958`, `:2692–2699`

**Project files to add/implement:**
- `components/module-3/3.1-content-studio/AIContentMatrixPanel.tsx` — replaces the Foundation stub;
  platform tabs + the option cards for the active platform
- `components/module-3/3.1-content-studio/CaptionOptionCard.tsx` — one archetype option (editable
  textarea, char counter, "Why this caption" disclosure, Approve button)

**Related files:**
- `components/module-3/3.1-content-studio/contentStudioTypes.ts` (Foundation — Content Studio Shell)
  — `MatrixSlotProps`, the contract this card implements
- `services/fixtures/content.ts` (Foundation — Fixture Data Layer) — `MOCK_CONTENT.captions`, the
  per-platform option text/metadata this card renders
- `types.ts` — `PlatformId`, the char-limit lookup keyed by it

**Flow:** [`diagrams/cards/module-3/ai-copywriting-matrix.mmd`](diagrams/cards/module-3/ai-copywriting-matrix.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/ai-copywriting-matrix.ts`](pseudocode/module-3/ai-copywriting-matrix.ts)

**Milestone (finished state):** Switching platform tabs shows that platform's own options (2 for
Naver, 3 for the rest); approving one option stages its text into the shell's shared draft via
`onStageCaption` without this card reading or writing any other sibling's state.

**Definition of Done:**
- [ ] `AIContentMatrixPanel.test.tsx` covers per-platform independence and the Naver 2-option branch
- [ ] `content-studio.spec.ts` → "AI Copywriting Matrix" — deferred, not wired for `frontend/` yet
      (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- AIContentMatrixPanel
```

---

### CARD — Content Studio: Visual Direction Board

**Depends on:** Foundation — Content Studio Shell
**Summary:** Numbered shot-list guidance for the active platform tab.
**Prototype reference:** screen-content / `renderContent()` (visual direction section) —
`ui-ux-prototype.html:2961–2975` (card immediately below the caption matrix)

**Project files to add/implement:**
- `components/module-3/3.1-content-studio/VisualDirectionBoard.tsx` — replaces the Foundation stub;
  numbered shot-list card

**Related files:**
- `components/module-3/3.1-content-studio/contentStudioTypes.ts` (Foundation — Content Studio Shell)
  — `VisualDirectionSlotProps`, the contract this card implements; `activePlatform` arrives from the
  shell, not from the AI Copywriting Matrix card
- `services/fixtures/content.ts` (Foundation — Fixture Data Layer) —
  `MOCK_CONTENT.captions[platform].guide`, the shot-list array this card renders

**Flow:** [`diagrams/cards/module-3/visual-direction-board.mmd`](diagrams/cards/module-3/visual-direction-board.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/visual-direction-board.ts`](pseudocode/module-3/visual-direction-board.ts)

**Milestone (finished state):** Switching platform tabs swaps the shot-list content to match, purely
by re-reading the shell's `activePlatform` prop.

**Definition of Done:**
- [ ] `VisualDirectionBoard.test.tsx` covers the platform-tab wiring
- [ ] `content-studio.spec.ts` → "Visual Direction Board" — deferred, not wired for `frontend/` yet
      (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- VisualDirectionBoard
```

---

### CARD — Content Studio: Publish Composer (connection-gated)

**Depends on:** Foundation — Content Studio Shell
**Summary:** Right-column composer — staged caption, pubmat, connection-gated platform picker, config
switches, agreement checkbox, the block-reason ladder. Reads live connection state from
`connectionsStore`, not from Settings — Platforms directly, so this card and Settings — Platforms are
buildable in parallel.
**Prototype reference:** screen-content / `renderContent()` (composer section) + `csPublishReady()` +
`csPublishBlockReason()` — `ui-ux-prototype.html:2701–2730`, `:2755–2770`

**Project files to add/implement:**
- `components/module-3/3.1-content-studio/PublishComposer.tsx` — replaces the Foundation stub;
  staged caption, pubmat, platform picker, config switches, agreement checkbox

**Related files:**
- `components/module-3/3.1-content-studio/contentStudioTypes.ts` (Foundation — Content Studio Shell)
  — `ComposerSlotProps`, the contract this card implements
- `services/connectionsStore.ts` (Foundation — Shared Stores) — `isConnected()`, the connection state
  gating the platform picker
- `components/shared/Toast.tsx` (Foundation — Shell & Routing) — used for the publish confirmation
  (triggered here on Publish; the click handler itself lives in Content Board & Publish Action)

**Flow:** [`diagrams/cards/module-3/publish-composer.mmd`](diagrams/cards/module-3/publish-composer.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/publish-composer.ts`](pseudocode/module-3/publish-composer.ts)

**Milestone (finished state):** A disconnected platform cannot be added to "Publish to" without first
completing Connect (via an inline link to Settings — Platforms); the Publish button's tooltip text
always matches the single blocking reason in the documented priority order.

**Definition of Done:**
- [ ] `PublishComposer.test.tsx` covers the full block-reason ladder, one case per rung, and the
      connection-gated picker against a mocked `connectionsStore`
- [ ] `content-studio.spec.ts` → "Publish Composer" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- PublishComposer
```

---

### CARD — Content Studio: Compliance Audit Panel

**Depends on:** Foundation — Content Studio Shell
**Summary:** The six-step OMCS audit animation and its result display, triggered by the shell's
`draft.agreementChecked` becoming true.
**Prototype reference:** screen-content / `renderContent()` (compliance section) + `runOmcsAudit()` —
`ui-ux-prototype.html:2841–2895`, `:2731–2753`

**Project files to add/implement:**
- `components/module-3/3.1-content-studio/CompliancePanel.tsx` — replaces the Foundation stub; all 3
  states (empty/auditing/complete)
- `components/module-3/3.1-content-studio/OmcsGauge.tsx` — the radial score gauge

**Related files:**
- `components/module-3/3.1-content-studio/contentStudioTypes.ts` (Foundation — Content Studio Shell)
  — `ComplianceSlotProps`, the contract this card implements; writes `AuditState` back to the shell
  via `onAuditChange`, and reads nothing from the Publish Composer card directly
- `services/fixtures/omcs.ts` (Foundation — Fixture Data Layer) — `MOCK_OMCS`, the audit result this
  panel renders; `OMCS_RUBRIC_LABELS` for the rubric table's row labels

**Flow:** [`diagrams/cards/module-3/compliance-audit-panel.mmd`](diagrams/cards/module-3/compliance-audit-panel.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/compliance-audit-panel.ts`](pseudocode/module-3/compliance-audit-panel.ts)

**Milestone (finished state):** Ticking the agreement checkbox with a caption + media staged runs the
full 6-step animation and lands on a pass/fail result matching the fixture `MOCK_OMCS` data.

**Definition of Done:**
- [ ] `CompliancePanel.test.tsx` covers all 3 states (empty/auditing/complete) and the pass/fail color
      branch
- [ ] `content-studio.spec.ts` → "Compliance Audit Panel" — deferred, not wired for `frontend/` yet
      (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- CompliancePanel
```

---

### CARD — Content Studio: Content Board & Publish Action

**Depends on:** Foundation — Content Studio Shell, Foundation — Shared Stores
**Summary:** All/Draft/Published tabs over the post list, and the Publish action that calls
`postStore.publish()` to populate the shared post store Calendar and Performance read from.
**Prototype reference:** screen-content / `renderContent()` (board section) + `csPublish()` —
`ui-ux-prototype.html:2897–2917`, `:2772–2789`

**Project files to add/implement:**
- `components/module-3/3.1-content-studio/ContentBoard.tsx` — replaces the Foundation stub;
  All/Draft/Published tabs + post cards + the Publish button's click handler

**Related files:**
- `components/module-3/3.1-content-studio/contentStudioTypes.ts` (Foundation — Content Studio Shell)
  — `BoardSlotProps`, the contract this card implements; calls `onPublished()` on success so the
  shell clears the draft and resets the audit
- `services/postStore.ts` (Foundation — Shared Stores) — `usePosts().publish()`, which this card
  calls; it does not create or seed the store itself

**Flow:** [`diagrams/cards/module-3/content-board-publish-action.mmd`](diagrams/cards/module-3/content-board-publish-action.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/content-board-publish-action.ts`](pseudocode/module-3/content-board-publish-action.ts)

**Milestone (finished state):** Publishing to 2 platforms adds 2 new posts to the board immediately,
visible under the "Published" filter without a reload, and also visible in Calendar/Performance
without either of those needing to be open.

**Definition of Done:**
- [ ] `ContentBoard.test.tsx` covers the filter tabs and the publish-appends-N-posts behavior against
      a mocked `postStore`
- [ ] `content-studio.spec.ts` → "Content Board & Publish Action" — deferred, not wired for
      `frontend/` yet (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- ContentBoard
```

---

### CARD — Foundation: Calendar Shell

**Depends on:** Foundation — Shell & Routing, Foundation — Shared Stores
**Summary:** The `/calendar` page shell — month grid state, the Month/List view toggle, and the
day-click → modal-open gate — so its three siblings can be built fully in parallel.
**Prototype reference:** screen-calendar / `renderCalendar()` (shell only) —
`ui-ux-prototype.html:3685–3747`. **Does not** reuse or extend
`ceview/old-components/CalendarView.tsx` (legacy, untouched per `.claude/CLAUDE.md`).

**Project files to add/implement:**
- `components/module-3/3.2-calendar/CalendarView.tsx` — page shell; owns the visible month, the
  Month/List toggle, and the day-click → modal-open state; reads `postStore`. Composes 3 named slots
- `components/module-3/3.2-calendar/calendarTypes.ts` — the 3 slot prop contracts
  (`MonthGridSlotProps`, `ListViewSlotProps`, `DayModalSlotProps`)
- `components/module-3/3.2-calendar/CalendarMonthGrid.tsx`, `CalendarListView.tsx`,
  `DayPostsModal.tsx` — **stub placeholders only**; ownership of each transfers whole to one sibling
  card below

**Related files:**
- `services/postStore.ts` (Foundation — Shared Stores) — `usePosts()`, the post list this shell reads
  per day
- `components/shared/Modal.tsx` (Foundation — Shell & Routing) — the overlay primitive
  `DayPostsModal` is built on

**Flow:** [`diagrams/cards/module-3/foundation-calendar-shell.mmd`](diagrams/cards/module-3/foundation-calendar-shell.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/foundation-calendar-shell.ts`](pseudocode/module-3/foundation-calendar-shell.ts)

**Milestone (finished state):** `/calendar` shows the current month with today ringed and all 3 slot
placeholders visible; a post published from Content Studio appears in the grid's cell data (observable
even before `CalendarMonthGrid` is built) without a reload.

**Definition of Done:**
- [ ] `CalendarView.test.tsx` covers `buildGrid()`'s month-boundary cell distribution
      (leading/trailing/today), the Month/List toggle, and the day-click no-op-vs-open-modal gate
- [ ] `calendar.spec.ts` shell coverage — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- CalendarView
```

---

### CARD — Calendar: Month Grid & Navigation

**Depends on:** Foundation — Calendar Shell
**Summary:** The 7-column month grid and its per-day post chips.
**Prototype reference:** screen-calendar / `renderCalendar()` (grid) — `ui-ux-prototype.html:3685–3747`

**Project files to add/implement:**
- `components/module-3/3.2-calendar/CalendarMonthGrid.tsx` — replaces the Foundation stub; the
  7-column grid
- `components/module-3/3.2-calendar/CalendarCell.tsx` — one day cell with its post chips

**Related files:**
- `components/module-3/3.2-calendar/calendarTypes.ts` (Foundation — Calendar Shell) —
  `MonthGridSlotProps`, the contract this card implements

**Flow:** [`diagrams/cards/module-3/calendar-month-grid-navigation.mmd`](diagrams/cards/module-3/calendar-month-grid-navigation.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/calendar-month-grid-navigation.ts`](pseudocode/module-3/calendar-month-grid-navigation.ts)

**Milestone (finished state):** The grid renders leading/trailing days greyed and inert, today ringed,
and up to 3 post chips per day with a "+N more" indicator beyond that.

**Definition of Done:**
- [ ] `CalendarMonthGrid.test.tsx` covers month-boundary cell distribution and the chip-overflow
      indicator
- [ ] `calendar.spec.ts` → "Month Grid & Navigation" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- CalendarMonthGrid
```

---

### CARD — Calendar: List View

**Depends on:** Foundation — Calendar Shell
**Summary:** The flat reverse-chronological post list, the sibling of Month Grid under the shell's
view-mode toggle.
**Prototype reference:** screen-calendar / `renderCalendar()` (list view) —
`ui-ux-prototype.html:3713–3722`

**Project files to add/implement:**
- `components/module-3/3.2-calendar/CalendarListView.tsx` — replaces the Foundation stub; flat
  reverse-chronological post list

**Related files:**
- `components/module-3/3.2-calendar/calendarTypes.ts` (Foundation — Calendar Shell) —
  `ListViewSlotProps`, the contract this card implements

**Flow:** [`diagrams/cards/module-3/calendar-list-view.mmd`](diagrams/cards/module-3/calendar-list-view.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/calendar-list-view.ts`](pseudocode/module-3/calendar-list-view.ts)

**Milestone (finished state):** Toggling to List view (owned by the shell) shows every post, most
recent first, independent of which month the grid was on.

**Definition of Done:**
- [ ] `CalendarListView.test.tsx` covers the sort order and the empty state
- [ ] `calendar.spec.ts` → "List View" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- CalendarListView
```

---

### CARD — Calendar: Day-Click Modal

**Depends on:** Foundation — Calendar Shell
**Summary:** The day-click detail modal — a sibling of Month Grid and List View, mounted only when the
shell has a non-empty day selected.
**Prototype reference:** screen-calendar / `calendarDayClick()` — `ui-ux-prototype.html:3731–3734`

**Project files to add/implement:**
- `components/module-3/3.2-calendar/DayPostsModal.tsx` — replaces the Foundation stub; the day-click
  detail modal

**Related files:**
- `components/module-3/3.2-calendar/calendarTypes.ts` (Foundation — Calendar Shell) —
  `DayModalSlotProps`, the contract this card implements; the shell's day-click gate means this card
  is only ever mounted with a non-empty `posts` array
- `components/shared/Modal.tsx` (Foundation — Shell & Routing) — the overlay primitive this card is
  built on

**Flow:** [`diagrams/cards/module-3/calendar-day-modal.mmd`](diagrams/cards/module-3/calendar-day-modal.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/calendar-day-modal.ts`](pseudocode/module-3/calendar-day-modal.ts)

**Milestone (finished state):** The modal lists every post for the clicked day with correct per-post
detail — published posts show metrics inline, drafts show a Draft chip and no metrics.

**Definition of Done:**
- [ ] `DayPostsModal.test.tsx` covers the published-vs-draft row branches
- [ ] `calendar.spec.ts` → "Day-Click Modal" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- DayPostsModal
```

---

### CARD — Foundation: Settings Shell

**Depends on:** Foundation — Shell & Routing, Foundation — Shared Stores
**Summary:** The `/settings/:tab` shell — tab rail, tab routing, invalid-tab redirect — replacing
today's `RoutePlaceholder` route and mounting the already-implemented `BusinessProfileSettings.tsx`
(Module 1's Card 9) as the `profile` tab alongside two new stubs.
**Prototype reference:** screen-settings (tab shell) — `ui-ux-prototype.html:4103–4212`

**Project files to add/implement:**
- `components/settings/SettingsView.tsx` — the `/settings/:tab` shell: tab rail, `useParams()`-driven
  routing, redirect to `/settings/profile` on an unknown tab
- `components/settings/settingsTypes.ts` — the `SettingsTabId` union and the tab registry type

**Project files to modify:**
- `App.tsx` — `{ path: 'settings/:tab', element: <RoutePlaceholder navId="settings"/> }` becomes
  `{ path: 'settings/:tab', element: <SettingsView/> }`

**Related files:**
- `components/settings/BusinessProfileSettings.tsx` (Module 1 — Card 9, already implemented) — mounted
  here as the `profile` tab, unmodified
- `components/settings/PlatformsSettings.tsx`, `WorkspaceSettings.tsx` — remain stubs; ownership
  transfers whole to the two sibling cards below
- `layout/Sidebar.tsx` — its existing settings sub-nav already links to `/settings/<tab>`; no change
  needed here, this card just makes those routes resolve to real content

**Flow:** [`diagrams/cards/module-3/foundation-settings-shell.mmd`](diagrams/cards/module-3/foundation-settings-shell.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/foundation-settings-shell.ts`](pseudocode/module-3/foundation-settings-shell.ts)

**Milestone (finished state):** `/settings/profile` shows the real business-profile form;
`/settings/platforms` and `/settings/workspace` show their stub placeholders under a working tab
rail; `/settings/anything-else` redirects to `/settings/profile`.

**Definition of Done:**
- [ ] `SettingsView.test.tsx` covers tab routing, the active-tab indicator, and the invalid-tab
      redirect
- [ ] `settings-business-profile.spec.ts` still passes unmodified (Module 1's Card 9 coverage)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- SettingsView
```

---

### CARD — Settings: Platforms

**Depends on:** Foundation — Settings Shell
**Summary:** `/settings/platforms` — connect/disconnect the four publishing destinations, reading and
writing the shared `connectionsStore` so Content Studio's Publish Composer reflects changes without a
reload.
**Prototype reference:** screen-settings (platforms tab) / `connectPlatform()` + `grantScope()` +
`finishConnect()` + `disconnectPlatform()` — `ui-ux-prototype.html:4131–4202`

**Project files to add/implement:**
- `components/settings/PlatformsSettings.tsx` — replaces the Foundation Settings Shell's stub; one
  row per platform, Verified+Disconnect or Connect
- `components/settings/ConnectPlatformModal.tsx` — the redirecting-spinner → scope-grant flow

**Related files:**
- `services/connectionsStore.ts` (Foundation — Shared Stores) — `useConnections()`, the store this
  card reads and writes; it does not call `apiClient.connections.*` directly

**Flow:** [`diagrams/cards/module-3/settings-platforms.mmd`](diagrams/cards/module-3/settings-platforms.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/settings-platforms.ts`](pseudocode/module-3/settings-platforms.ts)

**Milestone (finished state):** Connecting a platform here immediately unlocks it in Content Studio's
picker without a reload (shared store, not a re-fetch); disconnecting a platform selected mid-publish
removes it from that selection via the store's disconnect event.

**Definition of Done:**
- [ ] `PlatformsSettings.test.tsx` covers connect/disconnect against a mocked `connectionsStore` and
      that disconnect fires the store's `onDisconnect` event
- [ ] `settings-platforms.spec.ts` → "Platforms" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- PlatformsSettings
```

---

### CARD — Settings: Workspace

**Depends on:** Foundation — Settings Shell
**Summary:** `/settings/workspace` — member list + invite-by-email form.
**Prototype reference:** screen-settings (workspace tab) / `sendInvite()` —
`ui-ux-prototype.html:4203–4212`

**Project files to add/implement:**
- `components/settings/WorkspaceSettings.tsx` — replaces the Foundation Settings Shell's stub; member
  list + invite form

**Related files:**
- `services/apiClient.ts` (Foundation — Fixture Data Layer) — `workspace.members/invite`
- [`docs/shared/workspace.md`](../../../shared/workspace.md) — the modeled-vs-unmodeled invite
  lifecycle behavior this card must match

**Flow:** [`diagrams/cards/module-3/settings-workspace.mmd`](diagrams/cards/module-3/settings-workspace.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/settings-workspace.ts`](pseudocode/module-3/settings-workspace.ts)

**Milestone (finished state):** Sending an invite immediately shows the pending member row with the
derived display name and a confirmation toast.

**Definition of Done:**
- [ ] `WorkspaceSettings.test.tsx` covers the invite-submit → optimistic-row behavior
- [ ] `settings-workspace.spec.ts` → "Workspace" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved (including explicit sign-off on the gaps flagged in
      `docs/shared/workspace.md`)

**Verification:**
```
cd frontend && npm run test:unit -- WorkspaceSettings
```
```

- [ ] **Step 2: Verify internal consistency**

Run:
```bash
grep -nE "Card (1[5-9]|2[0-3])\b" docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md
```
Expected: no output. Then confirm every `Flow:` and `Steps (pseudocode):` link target exists:
```bash
grep -oE '\(diagrams/cards/module-3/[a-z0-9-]+\.mmd\)|\(pseudocode/module-3/[a-z0-9-]+\.ts\)' \
  docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md | tr -d '()' | sort -u | \
  while read f; do test -f "docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/$f" || echo "MISSING: $f"; done
```
Expected: no `MISSING:` lines.

- [ ] **Step 3: Stage the file**

```bash
git add docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md
```

---

### Task 9: Rewrite `05-module-4.md` with all 7 cards

**Files:**
- Modify: `docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md`

- [ ] **Step 1: Overwrite the file**

Overwrite `docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md` in full with:

```markdown
# Module 4 — Campaign Analytics & Reporting

All paths in this file are relative to `frontend/` (see `00-index.md`'s "Target directory" note). Any
DoD item below referencing a Playwright spec passing is deferred until `frontend/` is wired into
`e2e/` — see `00-index.md`'s Testing Strategy; treat it as a manual verification step for now.

Screen doc: [`docs/module-4/screens/performance.md`](../../../module-4/screens/performance.md).
Component doc: [`_components/post-analytics-modal.md`](../../../module-4/screens/_components/post-analytics-modal.md).
Spec file: `e2e/tests/performance.spec.ts` (M4-F, M4-1–M4-6).

**Component diagram:** [`diagrams/module-4.mmd`](diagrams/module-4.mmd)

**Parallelism:** M4-F is the only card every other Module 4 card depends on — M4-1 through M4-5 can
all be built simultaneously once M4-F merges, since each owns disjoint files and reads only
already-computed values from `campaignMetrics.ts`. M4-6 additionally depends on Module 3's
`Foundation — Shared Stores` for the post list it reads, but not on any Content Studio feature card.

---

### CARD — Foundation: Performance Shell & Ingestion

**Depends on:** Foundation — Shell & Routing, Foundation — Fixture Data Layer
**Summary:** The `/performance` shell — the entry↔full-view transition, the 7-field ingestion form,
the submitted campaign state, the 4/8-week trend toggle, and the metrics/PES computation every other
card renders from.
**Prototype reference:** screen-performance / `renderPerformance()` + `submitCampaign()` +
`computeMetrics()` + `computePes()` — `ui-ux-prototype.html:3882–3910`, `:3796–3837`, `:3760–3794`

**Project files to add/implement:**
- `components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx` — the `/performance` screen
  shell; owns the entry↔full-view transition, the submitted campaign input, and the 4/8-week trend
  toggle; composes 9 named slot components by fixed import path
- `components/module-4/4.1-campaign-analytics/IngestionForm.tsx` — the 7-field campaign-input form
- `components/module-4/4.1-campaign-analytics/campaignMetrics.ts` — `computeMetrics()` /
  `computePes()` and the flagged-denominator detection
- `components/module-4/4.1-campaign-analytics/campaignTypes.ts` — the 9 slot prop contracts
  (`KpiSlotProps`, `PesGaugeSlotProps`, `FunnelSlotProps`, `TrendSlotProps`, `ActionPlanSlotProps`,
  plus the two no-prop consumer components below)
- `components/module-4/4.1-campaign-analytics/KpiCard.tsx`, `FlaggedMetricBanner.tsx`,
  `PesGauge.tsx`, `CustomerJourneyFunnel.tsx`, `PesTrendChart.tsx`, `EfficiencyTrendChart.tsx`,
  `CostTrendChart.tsx`, `AiActionPlan.tsx`, `PreviouslyPublished.tsx`, `PostAnalyticsModal.tsx` —
  **stub placeholders only**; ownership of each transfers whole to one sibling card below

**Related files:**
- `services/fixtures/campaign.ts` (Foundation — Fixture Data Layer) — `DEFAULT_CAMPAIGN_INPUT`
  (pre-fills the form's placeholder values), `CampaignInput`, `MOCK_HISTORY`, `MOCK_REPORT` — the
  types and data this card fetches via `apiClient.campaign.history()` / `.report()` once a campaign
  is submitted

**Flow:** [`diagrams/cards/module-4/foundation-performance-shell.mmd`](diagrams/cards/module-4/foundation-performance-shell.mmd)

**Steps (pseudocode):** [`pseudocode/module-4/foundation-performance-shell.ts`](pseudocode/module-4/foundation-performance-shell.ts)

**Milestone (finished state):** `/performance` with no campaign submitted shows only the ingestion
form; submitting valid values transitions to the full view with all 9 slot placeholders visible, and
a zero-denominator input (e.g. `adSpend: 0`) still produces a `computePes()` value in `[0, 1]` with
the corresponding metric flagged — before any sibling fills in real content.

**Definition of Done:**
- [ ] `CampaignAnalyticsView.test.tsx` covers form validation, the submit→full-view transition, and
      the 4/8-week toggle re-slicing `MOCK_HISTORY`
- [ ] `campaignMetrics.test.ts` covers `computeMetrics()`'s flagged-denominator branch for each of the
      5 metrics and `computePes()`'s weighted-sum formula and label thresholds
- [ ] `performance.spec.ts` shell coverage — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- CampaignAnalyticsView campaignMetrics
```

---

### CARD — Performance: KPI Cards & Flagged Metrics

**Depends on:** Foundation — Performance Shell & Ingestion
**Summary:** The five KPI cards and the zero-denominator warning banner.
**Prototype reference:** screen-performance / KPI card row — `ui-ux-prototype.html:3760–3794`

**Project files to add/implement:**
- `components/module-4/4.1-campaign-analytics/KpiCard.tsx` — replaces the Foundation stub; one KPI
  card with a trend arrow
- `components/module-4/4.1-campaign-analytics/FlaggedMetricBanner.tsx` — replaces the Foundation
  stub; the zero-denominator warning

**Related files:**
- `components/module-4/4.1-campaign-analytics/campaignTypes.ts` (Foundation — Performance Shell &
  Ingestion) — `KpiSlotProps`, the contract this card implements; `metrics`/`flagged` arrive
  already computed by `campaignMetrics.ts`, this card only renders them

**Flow:** [`diagrams/cards/module-4/kpi-cards.mmd`](diagrams/cards/module-4/kpi-cards.mmd)

**Steps (pseudocode):** [`pseudocode/module-4/kpi-cards.ts`](pseudocode/module-4/kpi-cards.ts)

**Milestone (finished state):** Submitting the ingestion form with a zero denominator (e.g.
`adSpend: 0`) shows the flagged banner naming the correct metric(s), and the corresponding KPI card
still renders a value (`0`) rather than `NaN`/`Infinity`.

**Definition of Done:**
- [ ] `KpiCard.test.tsx` / `FlaggedMetricBanner.test.tsx` cover the inverse-good trend-arrow branch
      and the flagged-vs-empty banner branch
- [ ] `performance.spec.ts` → "KPI Cards & Flagged Metrics" — deferred, not wired for `frontend/` yet
      (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- KpiCard FlaggedMetricBanner
```

---

### CARD — Performance: PES Gauge

**Depends on:** Foundation — Performance Shell & Ingestion
**Summary:** The PES radial gauge and its per-metric contribution breakdown.
**Prototype reference:** screen-performance / `computePes()` render — `ui-ux-prototype.html:3760–3794`

**Project files to add/implement:**
- `components/module-4/4.1-campaign-analytics/PesGauge.tsx` — replaces the Foundation stub; radial
  gauge + contribution bars

**Related files:**
- `components/module-4/4.1-campaign-analytics/campaignTypes.ts` (Foundation — Performance Shell &
  Ingestion) — `PesGaugeSlotProps`, the contract this card implements; `score`/`label` arrive
  already computed by `computePes()`, this card only renders them

**Flow:** [`diagrams/cards/module-4/pes-gauge.mmd`](diagrams/cards/module-4/pes-gauge.mmd)

**Steps (pseudocode):** [`pseudocode/module-4/pes-gauge.ts`](pseudocode/module-4/pes-gauge.ts)

**Milestone (finished state):** The gauge always renders a value in `[0, 1]` with the matching label
band (Excellent/Good/Fair/Poor), and its contribution bars sum to the weights the shell's formula
uses (ROAS 35% / convRate 30% / CAC 15% / CTR 15% / CPC 5%).

**Definition of Done:**
- [ ] `PesGauge.test.tsx` covers all 4 label bands and the contribution-bar weights
- [ ] `performance.spec.ts` → "PES Gauge" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- PesGauge
```

---

### CARD — Performance: Customer Journey Funnel

**Depends on:** Foundation — Performance Shell & Ingestion
**Summary:** The 4-stage customer journey funnel with per-stage drop-off.
**Prototype reference:** screen-performance / funnel section — `ui-ux-prototype.html:3760–3794`

**Project files to add/implement:**
- `components/module-4/4.1-campaign-analytics/CustomerJourneyFunnel.tsx` — replaces the Foundation
  stub; the 4-stage funnel

**Related files:**
- `components/module-4/4.1-campaign-analytics/campaignTypes.ts` (Foundation — Performance Shell &
  Ingestion) — `FunnelSlotProps`, the contract this card implements

**Flow:** [`diagrams/cards/module-4/customer-journey-funnel.mmd`](diagrams/cards/module-4/customer-journey-funnel.mmd)

**Steps (pseudocode):** [`pseudocode/module-4/customer-journey-funnel.ts`](pseudocode/module-4/customer-journey-funnel.ts)

**Milestone (finished state):** Each of the 3 drop-off transitions (Impressions→Clicks→Conversions→
Bookings) shows its percentage when the previous stage is non-zero, and renders nothing for that
transition when it is zero.

**Definition of Done:**
- [ ] `CustomerJourneyFunnel.test.tsx` covers the zero-previous-stage no-drop-off branch
- [ ] `performance.spec.ts` → "Customer Journey Funnel" — deferred, not wired for `frontend/` yet
      (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- CustomerJourneyFunnel
```

---

### CARD — Performance: Trend Charts

**Depends on:** Foundation — Performance Shell & Ingestion
**Summary:** The PES/efficiency/cost trend charts sharing the shell's 4/8-week toggle.
**Prototype reference:** screen-performance / `renderPerformance()` (trend section) —
`ui-ux-prototype.html:3876–3879`

**Project files to add/implement:**
- `components/module-4/4.1-campaign-analytics/PesTrendChart.tsx` — replaces the Foundation stub;
  PES-over-time with the 4/8-week toggle control
- `components/module-4/4.1-campaign-analytics/EfficiencyTrendChart.tsx` — replaces the Foundation
  stub; ROAS/CTR/CR over time
- `components/module-4/4.1-campaign-analytics/CostTrendChart.tsx` — replaces the Foundation stub;
  CPC/CAC over time

**Related files:**
- `components/module-4/4.1-campaign-analytics/campaignTypes.ts` (Foundation — Performance Shell &
  Ingestion) — `TrendSlotProps`, the contract this card implements; the shell owns slicing
  `MOCK_HISTORY` to the current `weeks`, this card only owns the toggle control and rendering

**Flow:** [`diagrams/cards/module-4/trend-charts.mmd`](diagrams/cards/module-4/trend-charts.mmd)

**Steps (pseudocode):** [`pseudocode/module-4/trend-charts.ts`](pseudocode/module-4/trend-charts.ts)

**Milestone (finished state):** Toggling 4↔8 weeks updates all three trend charts consistently, since
they all read the same `window` slice the shell recomputes.

**Definition of Done:**
- [ ] `PesTrendChart.test.tsx` / `EfficiencyTrendChart.test.tsx` / `CostTrendChart.test.tsx` cover
      rendering against a 4-week and an 8-week window
- [ ] `performance.spec.ts` → "Trend Charts" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- PesTrendChart EfficiencyTrendChart CostTrendChart
```

---

### CARD — Performance: AI Action Plan

**Depends on:** Foundation — Performance Shell & Ingestion
**Summary:** The AI prescriptive report — executive summary, ranked diagnostics, recommendations.
**Prototype reference:** screen-performance / report section — data shape in
`services/fixtures/campaign.ts`'s `MOCK_REPORT`

**Project files to add/implement:**
- `components/module-4/4.1-campaign-analytics/AiActionPlan.tsx` — replaces the Foundation stub;
  executive summary + ranked diagnostics + recommendations

**Related files:**
- `components/module-4/4.1-campaign-analytics/campaignTypes.ts` (Foundation — Performance Shell &
  Ingestion) — `ActionPlanSlotProps`, the contract this card implements

**Flow:** [`diagrams/cards/module-4/ai-action-plan.mmd`](diagrams/cards/module-4/ai-action-plan.mmd)

**Steps (pseudocode):** [`pseudocode/module-4/ai-action-plan.ts`](pseudocode/module-4/ai-action-plan.ts)

**Milestone (finished state):** The 3 diagnostics render in Weakest→Moderate→Alright order exactly as
given in `report.funnelDiagnostics`, regardless of each stage's raw drop percentage.

**Definition of Done:**
- [ ] `AiActionPlan.test.tsx` covers diagnostics rendered in report order (not re-sorted by raw drop)
      and the diagnostic↔recommendation pairing
- [ ] `performance.spec.ts` → "AI Action Plan" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- AiActionPlan
```

---

### CARD — Performance: Previously Published & Post Analytics Modal

**Depends on:** Foundation — Performance Shell & Ingestion, Module 3's Foundation — Shared Stores
**Summary:** Platform-filtered published-post list and the per-post analytics modal, reading the same
shared post store Content Studio's Publish Action writes to.
**Prototype reference:** screen-performance / `openPostAnalytics()` — `ui-ux-prototype.html:3843–3874`

**Project files to add/implement:**
- `components/module-4/4.1-campaign-analytics/PreviouslyPublished.tsx` — replaces the Foundation
  stub; filter tabs + published-post list
- `components/module-4/4.1-campaign-analytics/PostAnalyticsModal.tsx` — replaces the Foundation
  stub; per-post analytics detail

**Related files:**
- `services/postStore.ts` (Module 3's Foundation — Shared Stores) — `usePosts()`, the shared post
  list this section filters and reads per-post metrics from; this card is a read-only consumer and
  does not depend on any Content Studio feature card
- `components/shared/Modal.tsx` (Foundation — Shell & Routing) — the overlay primitive
  `PostAnalyticsModal` is built on
- `styles/index.css` (Foundation — Design System) — this card uses Recharts for its chart, not the
  prototype's hand-rolled SVG `miniLine()` helper, per the Design System card's decision to keep
  Recharts

**Flow:** [`diagrams/cards/module-4/previously-published-post-analytics-modal.mmd`](diagrams/cards/module-4/previously-published-post-analytics-modal.mmd)

**Steps (pseudocode):** [`pseudocode/module-4/previously-published-post-analytics-modal.ts`](pseudocode/module-4/previously-published-post-analytics-modal.ts)

**Milestone (finished state):** Clicking a published post opens its analytics modal with the correct
fixture data; clicking a draft post (in Calendar or the Content Board) does not offer this modal.

**Definition of Done:**
- [ ] `PostAnalyticsModal.test.tsx` covers the has-data vs. no-data-yet branch
- [ ] `performance.spec.ts` → "Previously Published & Post Analytics Modal" — deferred, not wired for
      `frontend/` yet (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- PostAnalyticsModal
```
```

- [ ] **Step 2: Verify internal consistency**

Run:
```bash
grep -nE "Card (24|25|26|27)\b" docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md
```
Expected: no output. Then confirm every `Flow:` and `Steps (pseudocode):` link target exists:
```bash
grep -oE '\(diagrams/cards/module-4/[a-z0-9-]+\.mmd\)|\(pseudocode/module-4/[a-z0-9-]+\.ts\)' \
  docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md | tr -d '()' | sort -u | \
  while read f; do test -f "docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/$f" || echo "MISSING: $f"; done
```
Expected: no `MISSING:` lines.

- [ ] **Step 3: Stage the file**

```bash
git add docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md
```

---

### Task 10: Redraw `diagrams/module-3.mmd` and `diagrams/module-4.mmd` around the shells

**Files:**
- Modify: `docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/diagrams/module-3.mmd`
- Modify: `docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/diagrams/module-4.mmd`

- [ ] **Step 1: Overwrite `diagrams/module-3.mmd`**

```
%% Module 3 — Content Studio, Calendar, Platforms, Workspace
%% Content Studio (M3-F1, M3-1..M3-5), Calendar (M3-F2, M3-6..M3-8), Settings (M3-F3, M3-9..M3-10),
%% shared cross-surface state (M3-F0). See 04-module-3.md.
flowchart TD
  classDef foundation fill:#eee,stroke:#999,color:#333;
  classDef shell fill:#e6eefc,stroke:#3b6fd6,color:#0f2c4a;
  classDef newfile fill:#e6f6ec,stroke:#2f9e5c,color:#0f3d22;
  classDef store fill:#fff2d6,stroke:#c8901f,color:#4a3308;

  PostStore["services/postStore.ts (M3-F0)"]:::store
  ConnStore["services/connectionsStore.ts (M3-F0)"]:::store

  subgraph ContentStudio["components/module-3/3.1-content-studio/ (route: /content)"]
    Shell1["ContentStudioView.tsx (M3-F1)\nowns activePlatform, draft, audit"]:::shell
    Matrix["AIContentMatrixPanel.tsx (M3-1)"]:::newfile
    CaptionCard["CaptionOptionCard.tsx (M3-1)"]:::newfile
    VisualBoard["VisualDirectionBoard.tsx (M3-2)"]:::newfile
    Composer["PublishComposer.tsx (M3-3)"]:::newfile
    Compliance["CompliancePanel.tsx (M3-4)"]:::newfile
    Gauge["OmcsGauge.tsx (M3-4)"]:::newfile
    Board["ContentBoard.tsx (M3-5)"]:::newfile
  end
  Shell1 --> Matrix & VisualBoard & Composer & Compliance & Board
  Matrix --> CaptionCard
  Compliance --> Gauge
  CaptionCard -.->|onStageCaption writes back to| Shell1
  Composer -.->|reads connection state| ConnStore
  Composer -.->|reads/writes draft via| Shell1
  Compliance -.->|writes audit state via| Shell1
  Board -.->|onPublished resets draft via| Shell1
  Board -.->|calls publish()| PostStore

  subgraph Calendar["components/module-3/3.2-calendar/ (route: /calendar)"]
    Shell2["CalendarView.tsx (M3-F2)\nowns month, view mode, modal-open"]:::shell
    CalGrid["CalendarMonthGrid.tsx (M3-6)"]:::newfile
    CalCell["CalendarCell.tsx (M3-6)"]:::newfile
    CalList["CalendarListView.tsx (M3-7)"]:::newfile
    DayModal["DayPostsModal.tsx (M3-8)"]:::newfile
  end
  Shell2 --> CalGrid & CalList & DayModal
  CalGrid --> CalCell
  Shell2 -.->|reads| PostStore
  CalGrid -.->|onDayClick| Shell2

  subgraph SettingsMod3["components/settings/ (M3-F3, M3-9..M3-10)"]
    Shell3["SettingsView.tsx (M3-F3)\ntab rail + routing"]:::shell
    Profile["BusinessProfileSettings.tsx (Module 1 — Card 9, already built)"]:::foundation
    PlatSettings["PlatformsSettings.tsx (M3-9)"]:::newfile
    ConnectModal["ConnectPlatformModal.tsx (M3-9)"]:::newfile
    WorkSettings["WorkspaceSettings.tsx (M3-10)"]:::newfile
  end
  Shell3 --> Profile & PlatSettings & WorkSettings
  PlatSettings --> ConnectModal
  PlatSettings -.->|reads/writes| ConnStore
  ConnStore -.->|onDisconnect prunes selection in| Shell1

  Matrix -.->|MOCK_CONTENT.captions| Fixtures["services/fixtures/content.ts"]:::foundation
  Compliance -.->|MOCK_OMCS, OMCS_RUBRIC_LABELS| OmcsFixture["services/fixtures/omcs.ts"]:::foundation
  PostStore -.->|seeds from| PostsFixture["services/fixtures/posts.ts"]:::foundation
  ConnStore -.->|seeds from| ApiClient["services/apiClient.ts"]:::foundation
  WorkSettings -.->|workspace.members/invite| ApiClient
  Composer -.->|Toast on publish| Toast["components/shared/Toast.tsx"]:::foundation
  DayModal -.->|built on| ModalPrimitive["components/shared/Modal.tsx"]:::foundation
  ConnectModal -.->|built on| ModalPrimitive
```

- [ ] **Step 2: Overwrite `diagrams/module-4.mmd`**

Read the current file first to preserve its header comment style, then overwrite with:

```
%% Module 4 — Campaign Analytics & Reporting
%% Performance shell (M4-F) + 6 fully-parallel siblings (M4-1..M4-6). See 05-module-4.md.
flowchart TD
  classDef foundation fill:#eee,stroke:#999,color:#333;
  classDef shell fill:#e6eefc,stroke:#3b6fd6,color:#0f2c4a;
  classDef newfile fill:#e6f6ec,stroke:#2f9e5c,color:#0f3d22;
  classDef store fill:#fff2d6,stroke:#c8901f,color:#4a3308;

  subgraph Performance["components/module-4/4.1-campaign-analytics/ (route: /performance)"]
    Shell["CampaignAnalyticsView.tsx (M4-F)\nowns campaign input, weeks toggle"]:::shell
    Form["IngestionForm.tsx (M4-F)"]:::newfile
    Metrics["campaignMetrics.ts (M4-F)\ncomputeMetrics / computePes"]:::shell
    Kpi["KpiCard.tsx (M4-1)"]:::newfile
    Flag["FlaggedMetricBanner.tsx (M4-1)"]:::newfile
    Pes["PesGauge.tsx (M4-2)"]:::newfile
    Funnel["CustomerJourneyFunnel.tsx (M4-3)"]:::newfile
    PesTrend["PesTrendChart.tsx (M4-4)"]:::newfile
    EffTrend["EfficiencyTrendChart.tsx (M4-4)"]:::newfile
    CostTrend["CostTrendChart.tsx (M4-4)"]:::newfile
    Plan["AiActionPlan.tsx (M4-5)"]:::newfile
    Prev["PreviouslyPublished.tsx (M4-6)"]:::newfile
    PostModal["PostAnalyticsModal.tsx (M4-6)"]:::newfile
  end
  Shell --> Form
  Shell -->|campaign submitted| Metrics
  Metrics --> Kpi & Flag & Pes
  Shell --> Funnel & PesTrend & EffTrend & CostTrend & Plan & Prev
  Prev --> PostModal

  PostStore["services/postStore.ts (Module 3's Foundation — Shared Stores)"]:::store
  Prev -.->|reads| PostStore
  PostModal -.->|reads per-post metrics| PostStore

  Form -.->|DEFAULT_CAMPAIGN_INPUT| CampaignFixture["services/fixtures/campaign.ts"]:::foundation
  Shell -.->|campaign.history/report| ApiClient["services/apiClient.ts"]:::foundation
  PostModal -.->|built on| ModalPrimitive["components/shared/Modal.tsx"]:::foundation
```

- [ ] **Step 3: Stage the files**

```bash
git add docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/diagrams/module-3.mmd \
        docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/diagrams/module-4.mmd
```

---

### Task 11: Move the frontend scaffold stubs to the numbered directories and repoint headers

**Files:**
- Move: 6 files under `frontend/components/module-3/{calendar,content-studio}/` →
  `frontend/components/module-3/{3.1-content-studio,3.2-calendar}/`
- Move: 2 files under `frontend/components/module-4/performance/` →
  `frontend/components/module-4/4.1-campaign-analytics/`
- Modify: header comments in all 8 moved files, plus `components/settings/PlatformsSettings.tsx` and
  `WorkspaceSettings.tsx` (headers only, no move)

- [ ] **Step 1: Confirm nothing imports these stubs yet**

Run:
```bash
cd frontend && grep -rn "module-3/calendar\|module-3/content-studio\|module-4/performance" --include=*.tsx --include=*.ts . --exclude-dir=node_modules --exclude-dir=dist
```
Expected: no output (or only self-references inside the files being moved) — `App.tsx` currently
routes `/content`, `/calendar`, and `/performance` to `RoutePlaceholder`, confirmed at
`frontend/App.tsx:99-101`.

- [ ] **Step 2: Move the Content Studio stubs**

```bash
cd frontend
git mv components/module-3/content-studio/AIContentMatrixPanel.tsx components/module-3/3.1-content-studio/AIContentMatrixPanel.tsx
git mv components/module-3/content-studio/CompliancePanel.tsx components/module-3/3.1-content-studio/CompliancePanel.tsx
git mv components/module-3/content-studio/ContentBoard.tsx components/module-3/3.1-content-studio/ContentBoard.tsx
git mv components/module-3/content-studio/PublishComposer.tsx components/module-3/3.1-content-studio/PublishComposer.tsx
git mv components/module-3/content-studio/VisualDirectionBoard.tsx components/module-3/3.1-content-studio/VisualDirectionBoard.tsx
rmdir components/module-3/content-studio 2>/dev/null || true
```

- [ ] **Step 3: Move the Calendar stub**

```bash
cd frontend
git mv components/module-3/calendar/CalendarView.tsx components/module-3/3.2-calendar/CalendarView.tsx
rmdir components/module-3/calendar 2>/dev/null || true
```

- [ ] **Step 4: Move the Performance stubs**

```bash
cd frontend
git mv components/module-4/performance/CampaignAnalyticsView.tsx components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx
git mv components/module-4/performance/PostAnalyticsModal.tsx components/module-4/4.1-campaign-analytics/PostAnalyticsModal.tsx
rmdir components/module-4/performance 2>/dev/null || true
```

- [ ] **Step 5: Repoint each moved file's header comment to its new card ID**

For each file below, replace its header comment's `CARD —` line, `Depends on:` line, and `Plan:`
line (leaving the rest of the header's TODO list untouched — that content still describes real,
unbuilt work and stays correct after the ID rename):

`components/module-3/3.1-content-studio/AIContentMatrixPanel.tsx`:
```
/**
 * CARD — Content Studio: AI Copywriting Matrix (incl. Naver)
 * Depends on: Foundation — Content Studio Shell (M3-F1)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md (M3-1)
```

`components/module-3/3.1-content-studio/VisualDirectionBoard.tsx`:
```
/**
 * CARD — Content Studio: Visual Direction Board
 * Depends on: Foundation — Content Studio Shell (M3-F1)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md (M3-2)
```

`components/module-3/3.1-content-studio/PublishComposer.tsx`:
```
/**
 * CARD — Content Studio: Publish Composer (connection-gated)
 * Depends on: Foundation — Content Studio Shell (M3-F1)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md (M3-3)
```

`components/module-3/3.1-content-studio/CompliancePanel.tsx`:
```
/**
 * CARD — Content Studio: Compliance Audit Panel
 * Depends on: Foundation — Content Studio Shell (M3-F1)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md (M3-4)
```

`components/module-3/3.1-content-studio/ContentBoard.tsx`:
```
/**
 * CARD — Content Studio: Content Board & Publish Action
 * Depends on: Foundation — Content Studio Shell (M3-F1), Foundation — Shared Stores (M3-F0)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md (M3-5)
```

`components/module-3/3.2-calendar/CalendarView.tsx`:
```
/**
 * CARD — Foundation: Calendar Shell
 * Depends on: Foundation — Shell & Routing, Foundation — Shared Stores (M3-F0)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md (M3-F2)
```

`components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx`:
```
/**
 * CARD — Foundation: Performance Shell & Ingestion
 * Depends on: Foundation — Shell & Routing, Foundation — Fixture Data Layer
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-F)
```

`components/module-4/4.1-campaign-analytics/PostAnalyticsModal.tsx`:
```
/**
 * CARD — Performance: Previously Published & Post Analytics Modal
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F), Module 3's Foundation — Shared Stores (M3-F0)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-6)
```

Use the Edit tool for each file — read the file first, then replace exactly the 3 header lines shown
above (matching the file's current wording for those lines) with the block shown, leaving every other
line in the header comment unchanged.

- [ ] **Step 6: Repoint the two Settings stub headers (no move)**

`frontend/components/settings/PlatformsSettings.tsx` — replace its `Depends on:` / `Plan:` /
"Not implemented yet — see CARD" lines with:
```
 * Depends on: Foundation — Settings Shell (M3-F3)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md (M3-9)
```
and update the body's placeholder text from `"Not implemented yet — see CARD — Settings: Platforms in
04-module-3.md."` to `"Not implemented yet — see CARD — Settings: Platforms (M3-9) in
04-module-3.md."`.

`frontend/components/settings/WorkspaceSettings.tsx` — same pattern:
```
 * Depends on: Foundation — Settings Shell (M3-F3)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md (M3-10)
```
and update the body's placeholder text to `"Not implemented yet — see CARD — Settings: Workspace
(M3-10) in 04-module-3.md."`.

- [ ] **Step 7: Verify the frontend still builds and tests pass**

```bash
cd frontend && npm run build
cd frontend && npm run test:unit
```
Expected: both succeed with no new failures (the moved files are unrouted stubs, so this should be a
no-op for behavior — it only proves the moves didn't break any import path).

- [ ] **Step 8: Stage the files**

```bash
cd frontend && git add components/module-3 components/module-4 components/settings
```

---

## Self-review notes

- **Spec coverage:** every decision in the design spec (M3-F0..M3-F3 shape, M4-F promotion,
  renumbering, binding-rule amendment, companion-artifact depth, directory convention, stub-header
  updates) has a corresponding task above (Tasks 1, 2–7, 8–9, 10, 11 respectively).
- **Type consistency:** `PublishDraftState`, `AuditState`, `MatrixSlotProps` .. `BoardSlotProps`
  (Task 3) are the exact names re-imported in Task 6's per-sibling pseudocode rewrites and referenced
  in Task 8's card bodies. `GridCell`, `MonthGridSlotProps` .. `DayModalSlotProps` (Task 4) match
  Task 4's sibling re-scopes and Task 8's Calendar cards. `Metrics`, `FlaggedMetric`, `KpiSlotProps`
  .. `ActionPlanSlotProps` (Task 7) match Task 7's sibling splits and Task 9's card bodies.
  `PostStore`/`usePosts()` and `ConnectionsStore`/`useConnections()` (Task 2) match every later
  reference in Tasks 3, 5, 6, 7, 8, 9.
- **No placeholders:** every step above either shows complete pseudocode/diagram content or a
  complete, runnable shell command — no "TBD", no "similar to Task N" without the actual content
  repeated in full.
