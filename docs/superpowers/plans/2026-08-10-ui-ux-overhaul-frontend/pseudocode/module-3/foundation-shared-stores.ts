// ---- services/postStore.ts ----
import type { PublishedPost } from './fixtures/posts'
import type { PlatformId } from '../types'
import { apiClient } from './apiClient'

// Provider + hook pair, same shape as services/profileContext.tsx. One instance per app,
// seeded once, mounted in App.tsx above the AppShell route element so Content Studio,
// Calendar and Performance all read the same array.

export interface PublishDraft {
  caption: string
  mediaDataUrl: string | null
  platforms: PlatformId[]
}

export interface PostStore {
  posts: PublishedPost[] | null                 // null = still loading
  publish(draft: PublishDraft): PublishedPost[] // one new post per platform; returns what it added
  metricsFor(postId: string): PublishedPost | null
}

export function PostStoreProvider(props: { children }): JSX.Element
  on mount → apiClient.posts.list() → setPosts(list)   // failure → setPosts([])
  publish(draft):
    created ← draft.platforms.map(p => ({
      id: 'p-' + Date.now() + '-' + p, date: todayISO(), platform: p,
      caption: draft.caption, status: 'published',
      reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, series: [],
    }))
    setPosts(prev => [...created, ...(prev ?? [])])
    return created
  metricsFor(id): posts?.find(p => p.id === id) ?? null

export function usePosts(): PostStore   // throws outside the provider

// ---- services/connectionsStore.ts ----
import type { PlatformConnection, PlatformId } from '../types'
import { apiClient } from './apiClient'

export interface ConnectionsStore {
  connections: PlatformConnection[] | null      // null = still loading
  isConnected(p: PlatformId): boolean
  connect(p: PlatformId, handle: string): Promise<void>
  disconnect(p: PlatformId): Promise<void>
  onDisconnect(cb: (p: PlatformId) => void): () => void   // returns unsubscribe
}

export function ConnectionsStoreProvider(props: { children }): JSX.Element
  on mount → apiClient.connections.list() → setConnections(list)
  connect(p, handle): await apiClient.connections.connect(p)
    → mark { connected: true, handle, connectedAt: nowISO() } for p
  disconnect(p): await apiClient.connections.disconnect(p)
    → mark { connected: false, handle: null, connectedAt: null } for p
    → notify every onDisconnect listener with p
  onDisconnect(cb): add cb to a listener set; return () => set.delete(cb)

export function useConnections(): ConnectionsStore

// Ownership note: M3-5 is the only caller of publish(); M3-9 the only caller of
// connect()/disconnect(). Every other card is a read-only consumer.