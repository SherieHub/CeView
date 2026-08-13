// ---- components/module-3/calendar/CalendarView.tsx (additions) ----
imports: useState, CalendarListView, DayPostsModal

state additions: view ← 'month'|'list', modalDate ← null

handleDayClick(cell, dayPosts):
  if dayPosts.length === 0 → no-op
  else → modalDate ← cell.date  // opens DayPostsModal

render additions: Month/List segmented toggle in header +
                   view==='month' ? grid (cell onClick → handleDayClick) : CalendarListView(posts) +
                   modalDate ? DayPostsModal(date, posts matching date, onClose) : nothing

// ---- components/module-3/calendar/CalendarListView.tsx ----
props: { posts }
sorted ← posts sorted by date descending (most recent first)
render: one row per post — platform dot, date, single-line caption excerpt, status chip

// ---- components/module-3/calendar/DayPostsModal.tsx ----
props: { date, posts, onClose }
render: Modal(open=true, title=date) listing every post that day; published posts show
        reach/likes/engagement inline alongside caption
