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
