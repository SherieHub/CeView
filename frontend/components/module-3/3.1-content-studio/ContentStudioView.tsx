import { useState } from 'react';
import AIContentMatrixPanel from './AIContentMatrixPanel';
import CompliancePanel from './CompliancePanel';
import ContentBoard from './ContentBoard';
import PublishComposer from './PublishComposer';
import VisualDirectionBoard from './VisualDirectionBoard';
import type { AuditState, PublishDraftState } from './contentStudioTypes';
import type { PlatformId } from '../../../types';
import { MOCK_POSTS, type PublishedPost } from '../../../services/fixtures/posts';

const EMPTY_DRAFT: PublishDraftState = {
  caption: '', mediaDataUrl: null, platforms: [], visibility: 'public',
  commentsEnabled: true, paidPartnership: false, agreementChecked: false,
};
const IDLE_AUDIT: AuditState = { status: 'idle', step: 0, result: null };

export default function ContentStudioView() {
  const [activePlatform, setActivePlatform] = useState<PlatformId>('instagram');
  const [draft, setDraft] = useState<PublishDraftState>(EMPTY_DRAFT);
  const [audit, setAudit] = useState<AuditState>(IDLE_AUDIT);
  const [posts, setPosts] = useState<PublishedPost[]>(MOCK_POSTS);

  const patchDraft = (patch: Partial<PublishDraftState>) => {
    setDraft((current) => ({ ...current, ...patch }));
    if ('caption' in patch || 'mediaDataUrl' in patch || 'platforms' in patch) setAudit(IDLE_AUDIT);
  };
  const canPublish = Boolean(draft.caption.trim() && draft.mediaDataUrl && draft.platforms.length && draft.agreementChecked && audit.result?.status === 'Pass');
  const publish = () => {
    if (!canPublish) return;
    const date = new Date().toISOString().slice(0, 10);
    setPosts((current) => [
      ...draft.platforms.map((platform, index): PublishedPost => ({
        id: `published-${Date.now()}-${index}`, date, platform, caption: draft.caption,
        status: 'published', reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, series: [],
      })),
      ...current,
    ]);
    setDraft(EMPTY_DRAFT);
    setAudit(IDLE_AUDIT);
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6" aria-label="Content Studio">
      <header>
        <p className="eyebrow">Content Studio</p>
        <h1 className="heading-xl">Create content that fits the market</h1>
        <p className="body-sm mt-2">Choose an AI direction, stage your media, then validate it before publishing.</p>
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <AIContentMatrixPanel activePlatform={activePlatform} onPlatformChange={setActivePlatform} onStageCaption={(caption) => patchDraft({ caption, agreementChecked: false })} stagedCaption={draft.caption} />
          <VisualDirectionBoard activePlatform={activePlatform} />
        </div>
        <div className="space-y-6">
          <PublishComposer draft={draft} onDraftChange={patchDraft} audit={audit} />
          <CompliancePanel draft={draft} audit={audit} onAuditChange={setAudit} />
        </div>
      </div>
      <ContentBoard draft={draft} posts={posts} canPublish={canPublish} onPublished={publish} />
    </main>
  );
}
