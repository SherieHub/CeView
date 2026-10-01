// ---- components/module-3/3.1-content-studio/ContentBoard.tsx ----
imports: useState, BoardSlotProps from './contentStudioTypes',
         usePosts from '../../../services/postStore', Toast

// M3-F0 owns the post store and the publish() action; the shell (M3-F1) owns the draft and
// computes canPublish. This card owns the board UI and the Publish click handler.

function ContentBoard({ draft, canPublish, onPublished }: BoardSlotProps):
  { posts, publish } ← usePosts()
  state: filter ← 'all' | 'draft' | 'published'
  visible ← (posts ?? []).filter(p => filter === 'all' || p.status === filter)

  handlePublish():
    if !canPublish → no-op
    created ← publish({ caption: draft.caption, mediaDataUrl: draft.mediaDataUrl,
                        platforms: draft.platforms })
    toast('Published to ' + created.length + ' platform(s)')
    onPublished()        // shell clears the draft and resets the audit

  render: All/Draft/Published tabs + one card per visible post (platform, caption excerpt,
          date, status chip) + the Publish button wired to handlePublish, disabled unless
          canPublish
  // Calendar (M3-6..M3-8) and Performance (M4-6) read the same store, so newly created posts
  // appear there without a refetch or reload.
