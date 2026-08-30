import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import AIContentMatrixPanel from './AIContentMatrixPanel';
import CompliancePanel from './CompliancePanel';
import ContentBoard from './ContentBoard';
import PublishComposer from './PublishComposer';
import VisualDirectionBoard from './VisualDirectionBoard';
import type { AuditState, PublishDraftState } from './contentStudioTypes';
import type { ContentResponse, Market, PlatformId, PublishedPost } from '../../../types';
// Publishing has no backend yet — GET /api/posts is deferred to a later spec
// (see docs/superpowers/specs/2026-08-29-frontend-backend-connection-design.md
// §Non-goals). This board stays fixture-backed until that lands.
import { MOCK_POSTS } from '../../../services/fixtures/posts';
import { apiClient } from '../../../services/apiClient';
import { useProfile } from '../../../services/profileContext';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';

const EMPTY_DRAFT: PublishDraftState = {
  caption: '', mediaDataUrl: null, platforms: [], visibility: 'public',
  commentsEnabled: true, paidPartnership: false, agreementChecked: false,
};
const IDLE_AUDIT: AuditState = { status: 'idle', step: 0, result: null };

export default function ContentStudioView() {
  const { profile } = useProfile();
  const [activePlatform, setActivePlatform] = useState<PlatformId>('instagram');
  const [draft, setDraft] = useState<PublishDraftState>(EMPTY_DRAFT);
  const [audit, setAudit] = useState<AuditState>(IDLE_AUDIT);
  const [posts, setPosts] = useState<PublishedPost[]>(MOCK_POSTS);

  // Content Studio has no market selector of its own — Module 2 owns "which
  // market is selected" and nothing in this codebase persists that choice
  // across routes yet (see Task 25 context). Rather than block generation on
  // a cross-module wiring that doesn't exist, this view fetches the
  // operator's ranked markets and defaults to the top one, same as opening
  // the dashboard fresh would surface first.
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [marketsError, setMarketsError] = useState<unknown | null>(null);

  const [content, setContent] = useState<ContentResponse | null>(null);
  const [contentError, setContentError] = useState<unknown | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient.markets
      .list()
      .then((list) => {
        if (cancelled) return;
        setMarkets(list);
        setSelectedMarketId((current) => current ?? list[0]?.id ?? null);
      })
      .catch((e) => { if (!cancelled) setMarketsError(e); });
    return () => { cancelled = true; };
  }, []);

  const selectedMarket = markets.find((m) => m.id === selectedMarketId) ?? null;
  // No dedicated "trend" field ships on Market — spikeIndicator is the closest
  // live signal for "is this market surging right now".
  const marketTrend = selectedMarket ? (selectedMarket.spikeIndicator ? 'surging' : 'steady') : 'steady';

  useEffect(() => {
    // The backend 400s on a blank market and needs the profile fields, so don't
    // fire until both are present.
    if (!selectedMarketId || !profile.businessName) return;

    let cancelled = false;
    setContentLoading(true);
    setContentError(null);

    apiClient.content
      .generate({
        market: selectedMarketId,
        businessName: profile.businessName,
        description: profile.description,
        categories: profile.categories,
        trend: marketTrend,
      })
      .then((c) => { if (!cancelled) setContent(c); })
      .catch((e) => { if (!cancelled) setContentError(e); })
      .finally(() => { if (!cancelled) setContentLoading(false); });

    return () => { cancelled = true; };
  }, [selectedMarketId, profile, marketTrend]);

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

  const stubbed = content?.source === 'fallback' || content?.source === 'template';

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6" aria-label="Content Studio">
      <header>
        <p className="eyebrow">Content Studio</p>
        <h1 className="heading-xl">Create content that fits the market</h1>
        <p className="body-sm mt-2">Choose an AI direction, stage your media, then validate it before publishing.</p>
        {markets.length > 0 && (
          <label className="mt-4 block max-w-xs text-sm text-navy-dark">
            Target market
            <select
              className="input mt-1"
              value={selectedMarketId ?? ''}
              onChange={(event) => setSelectedMarketId(event.target.value)}
            >
              {markets.map((market) => (
                <option key={market.id} value={market.id}>{market.name}</option>
              ))}
            </select>
          </label>
        )}
        {marketsError != null && <div className="mt-4"><ApiErrorPanel error={marketsError} label="Markets" /></div>}
      </header>

      {stubbed && (
        <div className="banner banner--warn" role="status">
          <AlertTriangle aria-hidden="true" />
          <div>
            <b>Showing stubbed content.</b> The AI service returned placeholder captions instead of
            a real generation — nothing below reflects an actual model output.
          </div>
        </div>
      )}

      {contentError != null && <ApiErrorPanel error={contentError} label="Content Studio" />}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <AIContentMatrixPanel
            activePlatform={activePlatform}
            onPlatformChange={setActivePlatform}
            onStageCaption={(caption) => patchDraft({ caption, agreementChecked: false })}
            stagedCaption={draft.caption}
            content={content}
            loading={contentLoading}
          />
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
