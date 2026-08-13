// ---- services/postStore.ts ---- (same createContext/useState pattern as profileContext.tsx —
// no new state-management dependency)
imports: createContext/useContext/useState, apiClient, PublishedPost type

interface PostStoreValue { posts, load(), publish(platforms, caption) }

function PostStoreProvider({children}):
  state: posts ← []
  load(): posts ← apiClient.posts.list() result  // seeds from fixture
  publish(platforms, caption):
    newPosts ← one per platform: {id, date:today, platform, caption, status:'published',
                                    reach:0, likes:0, comments:0, shares:0, engagementRate:0, series:[]}
    posts ← [...posts, ...newPosts]  // Calendar (Card 20), Performance (Card 27) both read this
  render: children wrapped in context provider

function usePostStore(): PostStoreValue  // useContext + null-check

// ---- components/module-3/3.1-content-studio/ContentBoard.tsx ----
imports: useState, usePostStore, useToast

type Filter: 'all' | 'draft' | 'published'
props: { publishPlatforms, staged, publishEnabled, onPublished }  // from Card 17's composer

function ContentBoard({publishPlatforms, staged, publishEnabled, onPublished}):
  { posts, publish } ← usePostStore()
  state: filter ← 'all'

  handlePublish():
    if !publishEnabled → no-op
    publish(publishPlatforms, staged)  // one post per selected platform, status 'published'
    onPublished()  // clears composer transient state; approved captions (Card 15) stay intact
    showToast(`Published to N platform(s)`)

  visible ← posts filtered by filter tab
  render: All/Draft/Published tabs + visible.map → card (platform dot, status chip, date, caption
          excerpt, reach/likes footer if published)
