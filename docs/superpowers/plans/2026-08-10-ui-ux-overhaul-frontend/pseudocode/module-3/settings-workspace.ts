// ---- components/settings/WorkspaceSettings.tsx ----
// Mounted by SettingsView.tsx (M3-F3) as the 'workspace' tab; this card owns the panel body
// only — no route wiring, no tab state.

function deriveDisplayName(email): string  // local part split on ._- , title-cased
function deriveInitials(name): string       // first letter of first 2 words, uppercased

function WorkspaceSettings():
  state: members ← [], email ← '', role ← 'Editor' (never Owner)
  on mount → apiClient.workspace.members() → setMembers

  handleInvite():
    name ← deriveDisplayName(email)
    optimisticMember ← {name, email, role, initials: deriveInitials(name)}
    members ← [...members, optimisticMember]  // appended optimistically, before network confirmation
    apiClient.workspace.invite(email)
    showToast(`Invited ${email}`)
    email ← ''
    // KNOWN GAP: no invite acceptance/expiry/revocation modeled — flagged, not silently resolved

  render: member list (avatar/initials, name, email, role chip) + invite form (email + role select) +
          Invite button (calls handleInvite)
