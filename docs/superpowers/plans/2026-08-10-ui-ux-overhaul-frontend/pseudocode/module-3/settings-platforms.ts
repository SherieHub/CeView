// ---- components/settings/PlatformsSettings.tsx ----
imports: useEffect, useState, apiClient, useToast, PlatformConnection + PlatformId types,
         ConnectPlatformModal

props: { onDisconnect }  // Card 17's composer prunes this platform from its selection

function PlatformsSettings({onDisconnect}):
  state: connections ← [], connectingPlatform ← null
  on mount → apiClient.connections.list() → setConnections

  handleDisconnect(platform):
    apiClient.connections.disconnect(platform)  // immediate, no confirmation modal
    mark that connection disconnected
    showToast(`${platform} disconnected`)
    onDisconnect(platform)  // NEW rule: prune from Content Studio's in-progress selection

  handleConnected(platform):
    mark that connection connected
    connectingPlatform ← null
    showToast(`${platform} connected`)

  render: one row per connection (Verified+Disconnect if connected, else Connect button) +
          ConnectPlatformModal if connectingPlatform set

// ---- components/settings/ConnectPlatformModal.tsx ----
props: { platform, onGranted, onClose }
state: phase ← 'redirecting'|'scope-grant'
on mount → after ~800ms → phase ← 'scope-grant'
render: Modal — phase==='redirecting' ? "Redirecting to <platform>…" :
        (permissions list + "Grant scope" button, calls onGranted)
