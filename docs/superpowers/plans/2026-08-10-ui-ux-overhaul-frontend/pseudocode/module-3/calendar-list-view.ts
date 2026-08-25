// ---- components/module-3/3.2-calendar/CalendarListView.tsx ----
imports: ListViewSlotProps from './calendarTypes'

// The shell (M3-F2) owns the Month/List toggle; this card owns only the list body.

function CalendarListView({ posts }: ListViewSlotProps):
  sorted ← [...posts].sort by date descending (most recent first)
  if sorted.length === 0 → render the empty state ("No posts yet")
  render: one row per post — platform dot, formatted date, single-line caption excerpt,
          status chip ('published' | 'draft')
