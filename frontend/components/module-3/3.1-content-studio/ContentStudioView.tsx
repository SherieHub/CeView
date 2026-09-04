import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import PageHead from '../../../layout/PageHead';
import AIContentMatrixPanel from './AIContentMatrixPanel';
import CompliancePanel from './CompliancePanel';
import ContentBoard from './ContentBoard';
import ContentTargetPicker from './ContentTargetPicker';
import PublishComposer from './PublishComposer';
import VisualDirectionBoard from './VisualDirectionBoard';
import type { AuditState, PublishDraftState } from './contentStudioTypes';
import type { ContentResponse, PlatformId, PublishedPost } from '../../../types';
// Publishing has no backend yet — GET /api/posts is deferred to a later spec
// (see docs/superpowers/specs/2026-08-29-frontend-backend-connection-design.md
// §Non-goals). This board stays fixture-backed until that lands.
import { MOCK_POSTS } from '../../../services/fixtures/posts';
import { apiClient } from '../../../services/apiClient';
import { useConnections } from '../../../services/connectionsStore';
import { useProfile } from '../../../services/profileContext';
import { useTargetSelection } from '../../../services/targetSelectionStore';
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
  // surge / which market" — so this view never infers one on the operator's
  // behalf. It renders nothing until both are explicitly picked, either via
  // ContentTargetPicker below or by arriving from the Dashboard's "Target
  // this market" flow (DashboardView writes the pick into this same store).
  const { target, setTarget, clearTarget } = useTargetSelection();

  const [content, setContent] = useState<ContentResponse | null>(null);
  const [contentError, setContentError] = useState<unknown | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  // Settings -> Platforms rule (docs/module-3/screens/settings-platforms.md,
  // "Disconnect"): disconnecting a platform mid-publish here removes it from
  // the in-progress "Publish to" selection, since it can no longer be
  // published to. Historical published posts for that platform are untouched.
  const { onDisconnect } = useConnections();
  useEffect(() => {
    return onDisconnect((platform) => {
      setDraft((current) =>
        current.platforms.includes(platform)
          ? { ...current, platforms: current.platforms.filter((p) => p !== platform) }
          : current,
      );
      setAudit(IDLE_AUDIT);
    });
  }, [onDisconnect]);

  // No dedicated "trend" field ships on Market — spikeIndicator is the closest
  // live signal for "is this market surging right now".
  const marketTrend = target ? (target.market.spikeIndicator ? 'surging' : 'steady') : 'steady';

  useEffect(() => {
    // The backend 400s on a blank market and needs the profile fields, so don't
    // fire until both are present.
    if (!target || !profile.businessName) return;

    let cancelled = false;
    setContentLoading(true);
    setContentError(null);

    apiClient.content
      .generate({
        market: target.market.id,
        businessName: profile.businessName,
        description: profile.description,
        categories: profile.categories,
        trend: marketTrend,
      })
      .then((c) => { if (!cancelled) setContent(c); })
      .catch((e) => { if (!cancelled) setContentError(e); })
      .finally(() => { if (!cancelled) setContentLoading(false); });

    return () => { cancelled = true; };
  }, [target, profile, marketTrend]);

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

  // No surge + market picked yet — gate everything below behind the picker.
  // No entry point (sidebar nav, a stale/empty store) may skip this by
  // inferring a market on the operator's behalf.
  if (!target) {
    return (
      <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6" aria-label="Content Studio">
        <header>
          <p className="eyebrow">Content Studio</p>
          <h1 className="heading-xl">Create content that fits the market</h1>
        </header>
        <ContentTargetPicker onPicked={setTarget} />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6" aria-label="Content Studio">
      {/* PageHead, not a hand-rolled block: this screen was the only one still
          writing its own, at .heading-xl (40px) where every other screen's <h1>
          renders at 28px — so the studio's title outsized the dashboard's and
          the panels beneath it had to shout to keep up. Target market moves
          into the actions slot, on the title's baseline, where the dashboard
          puts Refresh forecast — it is the control the whole screen reads
          from, not a field buried under the subtitle. */}
      <PageHead
        eyebrow="Content Studio"
        title="Create content that fits the market"
        subtitle="Choose an AI direction, stage your media, then validate it before publishing."
        actions={
          markets.length > 0 && (
            <label className="studio-market">
              <span className="field-label">Target market</span>
              <select
                className="input"
                value={selectedMarketId ?? ''}
                onChange={(event) => setSelectedMarketId(event.target.value)}
              >
                {markets.map((market) => (
                  <option key={market.id} value={market.id}>{market.name}</option>
                ))}
              </select>
            </label>
          )
        }
      />
      {marketsError != null && <ApiErrorPanel error={marketsError} label="Markets" />}

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
