/**
 * Route: /content — Module 3.1, Content Studio.
 *
 * ARRANGEMENT: one column enforcing a linear journey — Draft (pick a caption)
 * -> Attach (media) -> Validate (run the audit) -> publish. A numbered step
 * rail runs as a single horizontal row above the first card and tracks scroll
 * position through those three sections.
 *
 * The shooting reference — visual direction and shot list — lives in a
 * slide-out drawer rather than in the column, so the column stays a sequence
 * of actions rather than a mixture of actions and reading.
 *
 * This screen renders a labelled <section>, not a <main>: AppShell already
 * owns the page's single main landmark.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, Image as ImageIcon, PenLine } from 'lucide-react';
import PageHead from '../../../layout/PageHead';
import AIContentMatrixPanel from './AIContentMatrixPanel';
import CampaignBriefDrawer from './CampaignBriefDrawer';
import CompliancePanel from './CompliancePanel';
import ContentBoard from './ContentBoard';
import ContentTargetPicker from './ContentTargetPicker';
import PublishComposer from './PublishComposer';
import PublishModal from './PublishModal';
import StudioStepRail from './StudioStepRail';
import { STUDIO_STEPS } from './studioSteps';
import { useFirstRunDrawer } from './useFirstRunDrawer';
import type { AuditState, PublishDraftState, StudioPlatformId } from './contentStudioTypes';
import type { ContentResponse, CreativeDirection, Market, PublishedPost } from '../../../types';
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

const [STEP_DRAFT, STEP_ATTACH, STEP_VALIDATE] = STUDIO_STEPS;

interface ContentStudioViewProps {
  /**
   * Dev-preview only — seeds the composer so the audit panel is reachable
   * without staging a real image by hand. Mirrors DashboardView's `forceMode`.
   * The authenticated app never passes it and starts at EMPTY_DRAFT.
   */
  initialDraft?: PublishDraftState;
  /** Dev-preview only — a fuller board than MOCK_POSTS, to judge the grid. */
  initialPosts?: PublishedPost[];
}

export default function ContentStudioView({ initialDraft, initialPosts }: ContentStudioViewProps = {}) {
  const { profile } = useProfile();
  const [activePlatform, setActivePlatform] = useState<StudioPlatformId>('instagram');
  const [draft, setDraft] = useState<PublishDraftState>(initialDraft ?? EMPTY_DRAFT);
  const [audit, setAudit] = useState<AuditState>(IDLE_AUDIT);
  const [posts, setPosts] = useState<PublishedPost[]>(initialPosts ?? MOCK_POSTS);

  // Content Studio has no market selector of its own — Module 2 owns "which
  // surge / which market" — so this view never infers one on the operator's
  // behalf. It renders nothing until both are explicitly picked, either via
  // ContentTargetPicker below or by arriving from the Dashboard's "Target
  // this market" flow (DashboardView writes the pick into this same store).
  const { target, setTarget } = useTargetSelection();
  const { onDisconnect } = useConnections();

  // The markets the header selector offers, scoped to the PICKED ALERT's
  // category rather than to the operator's overall ranking. The screen still
  // never infers a market — `target` is the source of truth and only
  // ContentTargetPicker (or the Dashboard hand-off) can establish one — but
  // once a surge is chosen, swapping between the markets that surge actually
  // reaches is a move worth having on the title's baseline instead of behind
  // a full re-pick.
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketsError, setMarketsError] = useState<unknown | null>(null);

  const [content, setContent] = useState<ContentResponse | null>(null);
  const [contentError, setContentError] = useState<unknown | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  // Fetched here rather than inside the drawer: the view owns the request so a
  // future consumer does not trigger a second one for the same payload.
  const [direction, setDirection] = useState<CreativeDirection | null>(null);

  // Which option is staged for the ACTIVE platform. Held here because the
  // caption itself lives in `draft`, so the grid's highlight and the composer's
  // contents cannot disagree.
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [stageToken, setStageToken] = useState(0);

  const brief = useFirstRunDrawer();

  // Publishing happens in a full-screen modal rather than inline: it is the one
  // irreversible action here, and the destinations and authorisation it needs
  // are decisions worth making beside a live preview of the result.
  const [publishOpen, setPublishOpen] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    apiClient.creativeDirection
      .generate()
      .then((result) => { if (!cancelled) setDirection(result); })
      .catch(() => { if (!cancelled) setDirection(null); });
    return () => { cancelled = true; };
  }, []);

  // Depended on directly rather than through `target`, so re-picking the same
  // category (a different market on the same surge) does not refetch a list
  // that cannot have changed.
  const targetCategory = target?.alert.category ?? null;

  useEffect(() => {
    if (!targetCategory) return;
    let cancelled = false;
    apiClient.markets
      .forCategory(targetCategory)
      .then((list) => { if (!cancelled) setMarkets(list); })
      .catch((e) => { if (!cancelled) setMarketsError(e); });
    return () => { cancelled = true; };
  }, [targetCategory]);

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

  // A different platform has a different option set, so a stale index would
  // highlight the wrong card.
  useEffect(() => { setSelectedOption(null); }, [activePlatform]);

  const patchDraft = (patch: Partial<PublishDraftState>) => {
    setDraft((current) => ({ ...current, ...patch }));
    // Caption and media ONLY. The audit scores those two against each other, so
    // editing either invalidates its verdict — but the destination list does
    // not, and resetting on it was a dead end: the modal is where platforms are
    // chosen, so ticking one there cleared the very pass that had unlocked the
    // modal, and "Confirm & Publish" then silently did nothing.
    if ('caption' in patch || 'mediaDataUrl' in patch) setAudit(IDLE_AUDIT);
  };

  const stageCaption = (index: number, text: string) => {
    setSelectedOption(index);
    setStageToken((t) => t + 1);
    patchDraft({ caption: text, agreementChecked: false });
  };

  // Reveals the Publish button. Platform choice and the authorisation tick are
  // the modal's job now, so they gate "Confirm & Publish" in there rather than
  // the button that opens it.
  const canPublish = Boolean(draft.caption.trim() && draft.mediaDataUrl && audit.result?.status === 'Pass');

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
    setSelectedOption(null);
  };

  const confirmPublish = () => {
    publish();
    setPublishOpen(false);
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
    <section className="studio-screen" aria-label="Content Studio">
      {/* No eyebrow: the sidebar's active row already says Content Studio, and
          repeating it above the title pushed the market selector up level with
          a label rather than with the heading it scopes. */}
      <PageHead
        title="Create content that fits the market"
        subtitle="Choose an AI direction, stage your media, then validate it before publishing."
        actions={
          markets.length > 0 ? (
            <label className="studio-market">
              <span className="studio-market-label">Target market</span>
              {/* Writes back into the shared target store rather than into
                  local state: content generation reads `target.market.id`, so
                  a select bound to a private value would look right and change
                  nothing. */}
              <select
                className="studio-select"
                value={target.market.id}
                onChange={(event) => {
                  const next = markets.find((m) => m.id === event.target.value);
                  if (next) setTarget(target.alert, next);
                }}
              >
                {markets.map((market) => (
                  <option key={market.id} value={market.id}>{market.name}</option>
                ))}
              </select>
            </label>
          ) : undefined
        }
      />

      {marketsError != null && <div className="mb-4"><ApiErrorPanel error={marketsError} label="Markets" /></div>}

      {stubbed && (
        <div className="banner banner--warn mb-4" role="status">
          <AlertTriangle aria-hidden="true" />
          <div>
            <b>Showing stubbed content.</b> The AI service returned placeholder captions instead of
            a real generation — nothing below reflects an actual model output.
          </div>
        </div>
      )}

      {contentError != null && <div className="mb-4"><ApiErrorPanel error={contentError} label="Content Studio" /></div>}

      <div className="studio-flow">
        <StudioStepRail />

        {/* Steps 1 and 2 share ONE card. Choosing the copy and attaching the
            media it publishes with are one piece of work, and two stacked cards
            put a border and 48px of canvas through the middle of it. The rail
            still tracks both: the card is step 1's anchor and the media block
            inside it is step 2's, so each remains a real place to scroll to. */}
        <section id={STEP_DRAFT.sectionId} className="studio-section">
          <div className="card" role="group" aria-labelledby="post-composer-title">
            <div className="studio-head">
              <span className="conn-ico" aria-hidden="true"><PenLine /></span>
              <div className="studio-head-text">
                <h2 id="post-composer-title" className="heading-md">Post composer</h2>
                <p className="body-sm">Choose a localised caption, then stage the media it publishes with.</p>
              </div>
            </div>

            <AIContentMatrixPanel
              activePlatform={activePlatform}
              onPlatformChange={setActivePlatform}
              onSelectCaption={stageCaption}
              selectedOption={selectedOption}
              content={content}
              loading={contentLoading}
            />

            <div id={STEP_ATTACH.sectionId} className="studio-section studio-attach">
              <PublishComposer
                draft={draft}
                onDraftChange={patchDraft}
                audit={audit}
                platform={activePlatform}
                stageToken={stageToken}
                onOpenBrief={brief.openDrawer}
              />
            </div>
          </div>
        </section>

        <section id={STEP_VALIDATE.sectionId} className="studio-section">
          <CompliancePanel draft={draft} audit={audit} onAuditChange={setAudit} />
        </section>

        <div className="studio-board">
          {/* Publish opens the modal; the modal's own Confirm is what actually
              publishes, once destinations and authorisation are set there. */}
          <ContentBoard
            draft={draft}
            posts={posts}
            canPublish={canPublish}
            onPublished={() => setPublishOpen(true)}
          />
        </div>
      </div>

      {/* A SIBLING of .studio-flow, never a descendant — the flow carries a
          margin offset above 1280px, and nesting a fixed element inside a
          container that may one day be transformed is how "fixed" silently
          stops meaning fixed. */}
      {/* Icon only. With its label the tab was wide enough to sit over the
          content it floats above; the icon alone stays clear of it, and the
          name lives in aria-label so it is still announced and still findable
          by voice. An image glyph rather than a camera: it opens guidance
          about the media, and the media is what the operator is looking for. */}
      <button
        type="button"
        className="brief-trigger"
        aria-label="Visual Guide"
        data-hidden={brief.open}
        data-pulse={brief.showTooltip}
        onClick={brief.openDrawer}
      >
        <ImageIcon size={18} aria-hidden="true" />
        {brief.showTooltip && <span className="brief-tip">Your shot list and visual direction live here</span>}
      </button>

      <CampaignBriefDrawer
        open={brief.open}
        onClose={brief.closeDrawer}
        showWelcome={brief.showWelcome}
        direction={direction}
      />

      <PublishModal
        open={publishOpen}
        draft={draft}
        onDraftChange={patchDraft}
        onClose={() => setPublishOpen(false)}
        onConfirm={confirmPublish}
      />
    </section>
  );
}
