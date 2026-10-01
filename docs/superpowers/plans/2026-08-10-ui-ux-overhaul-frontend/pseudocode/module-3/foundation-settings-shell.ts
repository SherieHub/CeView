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
