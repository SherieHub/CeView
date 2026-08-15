// ---- components/module-2/2.1-dashboard/DashboardView.tsx ----
imports: useEffect, useState, apiClient, useProfile, DemandAlert type, AlertCard

function DashboardView():
  { profile } ← useProfile()
  state: notifications ← null (loading), selectedId ← null

  on mount → apiClient.notifications.list() → setNotifications

  visible ← notifications filtered to profile.categories.includes(n.category)
    // no undifferentiated "all alerts" view

  selectAlert(alert):
    mark that notification isRead = true (side effect of the click itself)
    setSelectedId(alert.id)  // consumed by Card 11's markets reveal

  render: visible.map → AlertCard (selected = matches selectedId, onClick = selectAlert)

// ---- components/module-2/2.1-dashboard/AlertCard.tsx ----
props: { alert, selected, onClick }
render: unread dot if !alert.isRead, date, title, message, chips (market/category/trend),
        surge chip if alertLevel === 'WARNING'
