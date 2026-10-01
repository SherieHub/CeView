// ---- components/module-2/2.1-dashboard/AlertFeed.tsx ----
// Replaces the M2-F stub. Implements AlertFeedSlotProps from dashboardTypes.ts.
// Owns all 3 of the feed's own states: loading, empty (no notifications ever),
// and zero-matching (categories set but none match) — the ai-down banner is M2-3's
// AiStatusBanner, a sibling slot, not this file.
props: { notifications, profileCategories, selectedId, onSelect }
imports: apiClient, AlertCard

visible ← notifications?.filter(n => profileCategories.includes(n.category)) ?? []

selectAlert(alert):
  apiClient.notifications.markRead(alert.id)   // mark-read side effect of the click itself
  onSelect(alert.id)

render:
  notifications === null → 3 skeleton cards
  notifications !== null AND notifications.length === 0 → "No notifications yet"
  visible.length === 0 (notifications exist, none match profile categories) →
    "No surge alerts for <profileCategories.join(', ')> yet — widen coverage in Settings"
  else → visible.map → AlertCard (selected = matches selectedId, onClick = () => selectAlert(alert))

// ---- components/module-2/2.1-dashboard/AlertCard.tsx ----
props: { alert, selected, onClick }
render: unread dot if !alert.isRead, date, title, message, chips (market/category/trend),
        surge chip if alertLevel === 'WARNING'
