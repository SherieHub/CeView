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
