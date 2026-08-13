// ---- components/module-3/calendar/CalendarView.tsx ----
imports: useState, usePostStore, CalendarCell

interface GridCell { date, inMonth, isToday }

function buildGrid(year, month): GridCell[]
  // leading cells: prev month's trailing days (greyed, inert, not clickable)
  // one cell per day of target month
  // trailing cells: next month's leading days (greyed, inert), padding to a multiple of 7
  // cell matching today's real date → isToday: true

function CalendarView():
  { posts } ← usePostStore()
  state: year ← current year, month ← current month
  grid ← buildGrid(year, month)

  shiftMonth(delta): month += delta; wraps Dec→Jan and Jan→Dec, adjusting year

  counts ← per-status counts (published/scheduled/draft) across the WHOLE post store, not just
           the visible month

  render: header (prev/next buttons, year-month label, counts) +
          7-col grid: grid.map → CalendarCell(cell, posts matching cell.date if inMonth)

// ---- components/module-3/calendar/CalendarCell.tsx ----
props: { cell, posts }
shown ← posts.slice(0,3)  // up to 3 platform-colored chips (border-left colored by platform)
overflow ← posts.length - shown.length
render: date, shown chips, "+N more" indicator if overflow > 0 (instead of a 4th chip)
