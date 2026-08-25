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

// ---- components/settings/ConnectPlatformModal.tsx ----
props: { platform, onGranted, onClose }
state: phase ← 'redirecting'|'scope-grant'
on mount → after ~800ms → phase ← 'scope-grant'
render: Modal — phase==='redirecting' ? "Redirecting to <platform>…" :
        (permissions list + "Grant scope" button, calls onGranted)
