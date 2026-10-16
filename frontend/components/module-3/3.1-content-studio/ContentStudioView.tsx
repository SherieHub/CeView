/**
 * Route: /content — Module 3.1, Content Studio.
 *
 * Three views under one header (StudioNavigation):
 *  - Quick Post: the original single-post journey — Draft (pick and edit a
 *    caption) -> Attach (media) -> Validate (six-step audit, then publish) —
 *    shown one stage at a time by QuickPostWorkspace.
 *  - Campaigns: frontend-only campaign planning (campaigns/), kept for the
 *    session; its posts open in the Quick Post composer.
 *  - Content Library: the former Content board.
 *
 * Every piece of state — draft, audit, generated content, selection — still
 * lives here, and all three panels stay mounted (just hidden), so switching
 * tabs or stages never resets work or re-runs a request.
 *
 * The shooting reference — visual direction and shot list — lives in a
 * slide-out drawer. This screen renders a labelled <section>, not a <main>:
 * AppShell already owns the page's single main landmark.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Image as ImageIcon, Send, X } from 'lucide-react';
import PageHead from '../../../layout/PageHead';
import AIContentMatrixPanel from './AIContentMatrixPanel';
import AdUrlBlock from './AdUrlBlock';
import CampaignBriefDrawer from './CampaignBriefDrawer';
import type { VisualGuideStatus } from './CampaignBriefDrawer';
import CompliancePanel from './CompliancePanel';
import ContentBoard from './ContentBoard';
import ContentTargetPicker from './ContentTargetPicker';
import PublishComposer from './PublishComposer';
import PublishModal from './PublishModal';
import { auditRecommendations } from './auditRecommendations';
import QuickPostWorkspace from './QuickPostWorkspace';
import StudioNavigation from './StudioNavigation';
import type { StudioView } from './StudioNavigation';
import type { StudioStepId } from './studioSteps';
import CampaignsView from './campaigns/CampaignsView';
import type { CampaignMode } from './campaigns/CampaignsView';
import { formatDate, useCampaignDrafts } from './campaigns/campaignTypes';
import { STUDIO_PLATFORMS } from './contentStudioTypes';
import { useFirstRunDrawer } from './useFirstRunDrawer';
import type { AuditState, PublishDraftState, StudioPlatformId } from './contentStudioTypes';
import type { AttributionLink, ContentResponse, CreativeDirection, Market, PublishedPost } from '../../../types';
// Publishing has no backend yet — GET /api/posts is deferred to a later spec
// (see docs/superpowers/specs/2026-08-29-frontend-backend-connection-design.md
// §Non-goals). The board therefore starts empty and only shows fixture posts when
// the app runs in fixture mode, where apiClient.posts.list() serves them.
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
  const [posts, setPosts] = useState<PublishedPost[]>(initialPosts ?? []);

  useEffect(() => {
    if (initialPosts) return;
    let cancelled = false;
    apiClient.posts
      .list()
      .then((list) => { if (!cancelled) setPosts((current) => (current.length ? current : (list as PublishedPost[]))); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const [attributionLink, setAttributionLink] = useState<AttributionLink | null>(null);

  // Fetched here rather than inside the drawer: the view owns the request so a
  // future consumer does not trigger a second one for the same payload.
  // Generated only on the operator's explicit "Approve & get visual guide" —
  // see approveAndGenerateGuide below.
  const [direction, setDirection] = useState<CreativeDirection | null>(null);
  const [guideStatus, setGuideStatus] = useState<VisualGuideStatus>('idle');
  const [guideError, setGuideError] = useState<unknown | null>(null);

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

  // Navigation only — which view and Quick Post stage are showing. Changing
  // either never touches the draft, audit or generated content above.
  const [view, setView] = useState<StudioView>('quick');
  const [qpStep, setQpStep] = useState<StudioStepId>('draft');

  // Campaigns (frontend-only, this session — see campaigns/campaignTypes.ts).
  const campaignStore = useCampaignDrafts();
  const [campaignMode, setCampaignMode] = useState<CampaignMode>({ kind: 'list' });
  // Set when a campaign's planned post is opened in the Quick Post composer.
  const [campaignContext, setCampaignContext] = useState<{ campaignId: string; postId: string } | null>(null);

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

  // Approval and the direction are both per market, so a guide generated for
  // one market must not linger after switching to another. The ref guards the
  // in-flight request: a response for the old market is dropped on arrival.
  const guideMarket = target?.market.id ?? null;
  const guideRequest = useRef(0);
  useEffect(() => {
    guideRequest.current += 1;
    setDirection(null);
    setGuideError(null);
    setGuideStatus('idle');
  }, [guideMarket]);

  /**
   * The backend generates a direction only from APPROVED captions (400
   * missing_dependency otherwise), so this approves the market's generated set
   * first, then generates. It used to fire generate() on mount with no market
   * — before anything could have been approved — and swallow the 400, which
   * left the Visual Guide permanently blank.
   */
  const approveAndGenerateGuide = async () => {
    if (!guideMarket) return;
    const request = ++guideRequest.current;
    setGuideStatus('loading');
    setGuideError(null);
    try {
      await apiClient.content.approve(guideMarket);
      const result = await apiClient.creativeDirection.generate(guideMarket);
      if (request !== guideRequest.current) return;
      setDirection(result);
      setGuideStatus('ready');
    } catch (e) {
      if (request !== guideRequest.current) return;
      setGuideError(e);
      setGuideStatus('error');
    }
  };

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

  useEffect(() => {
    const category = target?.alert.category;
    const windowStart = target?.alert.windowOpenDate;
    const targetMarket = target?.market.id;
    setAttributionLink(null);
    if (!category || !windowStart || !targetMarket) return;

    let cancelled = false;
    apiClient.attributionLinks.list()
      .then((links) => {
        if (cancelled) return;
        const alertWindow = new Date(windowStart).getTime();
        const match = links.find((link) =>
          link.category === category
          && link.targetMarket.toLowerCase() === targetMarket.toLowerCase()
          && new Date(link.windowStart).getTime() === alertWindow,
        );
        setAttributionLink(match ?? null);
      })
      .catch(() => { if (!cancelled) setAttributionLink(null); });

    return () => { cancelled = true; };
  }, [target]);

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


  const contextCampaign = campaignContext
    ? campaignStore.campaigns.find((c) => c.id === campaignContext.campaignId) ?? null
    : null;
  const contextPost = contextCampaign?.posts.find((p) => p.id === campaignContext?.postId) ?? null;

  const backToCampaign = () => {
    if (campaignContext) setCampaignMode({ kind: 'workspace', id: campaignContext.campaignId });
    setView('campaigns');
  };

  const marketSelect =
    target && markets.length > 0 ? (
      <label className="studio-market">
        <span className="studio-market-label">Target market</span>
        {/* Writes back into the shared target store rather than into local
            state: content generation reads `target.market.id`, so a select
            bound to a private value would look right and change nothing. */}
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
    ) : undefined;

  const campaignBanner = contextCampaign && contextPost && (
    <div className="qp-context" role="note">
      <div>
        <p className="qp-context-eyebrow">Campaign post</p>
        <p className="qp-context-title">
          {contextCampaign.name} · {contextPost.topic || 'Untitled post'}
        </p>
        <p className="qp-context-meta">
          {STUDIO_PLATFORMS.find((p) => p.id === contextPost.platform)?.label} · planned for {formatDate(contextPost.date)}
          {target && <> · captions are generated for {target.market.name}</>}
        </p>
      </div>
      <div className="qp-context-acts">
        <button type="button" className="btn-outline btn-outline--sm" onClick={backToCampaign}>
          <ArrowLeft size={14} aria-hidden="true" /> Back to campaign
        </button>
        <button type="button" className="icon-btn" aria-label="Stop drafting for this campaign" onClick={() => setCampaignContext(null)}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  const quickPost = !target ? (
    // No surge + market picked yet — gate the composer behind the picker. No
    // entry point may skip this by inferring a market on the operator's behalf.
    <>
      {campaignBanner}
      <ContentTargetPicker onPicked={setTarget} />
    </>
  ) : (
    <>
      {marketsError != null && <div className="mb-4"><ApiErrorPanel error={marketsError} label="Markets" /></div>}
      {contentError != null && <div className="mb-4"><ApiErrorPanel error={contentError} label="Content Studio" /></div>}

      <QuickPostWorkspace
        step={qpStep}
        onStepChange={setQpStep}
        complete={{
          draft: Boolean(draft.caption.trim()),
          attach: Boolean(draft.mediaDataUrl),
          validate: audit.result?.status === 'Pass',
        }}
        context={campaignBanner}
        draftStage={
          <>
            <AIContentMatrixPanel
              activePlatform={activePlatform}
              onPlatformChange={setActivePlatform}
              onSelectCaption={stageCaption}
              selectedOption={selectedOption}
              content={content}
              loading={contentLoading}
            />
            <div className="qp-editor">
              <PublishComposer
                draft={draft}
                onDraftChange={patchDraft}
                audit={audit}
                platform={activePlatform}
                stageToken={stageToken}
                onOpenBrief={brief.openDrawer}
                part="caption"
                marketName={target.market.name}
                selectedOption={selectedOption}
              />
            </div>
          </>
        }
        attachStage={
          <PublishComposer
            draft={draft}
            onDraftChange={patchDraft}
            audit={audit}
            platform={activePlatform}
            stageToken={stageToken}
            onOpenBrief={brief.openDrawer}
            part="media"
          />
        }
        validateStage={
          <>
            <div className="qp-summary" aria-label="Post summary">
              {draft.mediaDataUrl ? (
                <img className="qp-summary-media" src={draft.mediaDataUrl} alt="Attached media" />
              ) : (
                <span className="qp-summary-media qp-summary-media--empty">No media yet</span>
              )}
              <div className="qp-summary-text">
                <p className="qp-summary-label">Your caption</p>
                <p className="qp-summary-caption">{draft.caption.trim() || 'No caption yet — choose one in Draft.'}</p>
                <div className="qp-summary-acts">
                  <button type="button" className="link-inline" onClick={() => setQpStep('draft')}>Edit caption</button>
                  <button type="button" className="link-inline" onClick={() => setQpStep('attach')}>Change media</button>
                </div>
              </div>
            </div>

            <CompliancePanel
              draft={draft}
              audit={audit}
              onAuditChange={setAudit}
              recommendations={auditRecommendations(content, activePlatform, selectedOption)}
            />

            {/* Publish appears only after a passing audit (same rule as before);
                it opens the modal, whose Confirm is what actually publishes. */}
            {canPublish && (
              <div className="qp-publish">
                <p className="studio-note">Your post passed the review. Choose where to publish it.</p>
                <button type="button" className="btn-cta" onClick={() => setPublishOpen(true)}>
                  <Send size={16} aria-hidden="true" />
                  Publish{draft.platforms.length ? ` to ${draft.platforms.length} platform${draft.platforms.length === 1 ? '' : 's'}` : ''}
                </button>
              </div>
            )}

            <AdUrlBlock link={attributionLink} onLinkChange={setAttributionLink} />
          </>
        }
      />
    </>
  );

  return (
    <section className="studio-screen" aria-label="Content Studio">
      <PageHead
        title="Content Studio"
        subtitle="Create, plan, and review content for your target markets."
        actions={view === 'quick' ? marketSelect : undefined}
      />

      <StudioNavigation view={view} onChange={setView} counts={{ library: posts.length }} />

      <div id="studio-panel-quick" role="tabpanel" aria-labelledby="studio-tab-quick" hidden={view !== 'quick'} className="studio-panel">
        {quickPost}
      </div>

      <div id="studio-panel-campaigns" role="tabpanel" aria-labelledby="studio-tab-campaigns" hidden={view !== 'campaigns'} className="studio-panel">
        <CampaignsView
          campaigns={campaignStore.campaigns}
          mode={campaignMode}
          onModeChange={setCampaignMode}
          categories={profile.categories}
          onSave={campaignStore.upsert}
          onDelete={campaignStore.remove}
          onPostStatus={campaignStore.setPostStatus}
          onOpenPost={(campaign, postId) => {
            const post = campaign.posts.find((p) => p.id === postId);
            setCampaignContext({ campaignId: campaign.id, postId });
            if (post) setActivePlatform(post.platform);
            setQpStep('draft');
            setView('quick');
          }}
        />
      </div>

      <div id="studio-panel-library" role="tabpanel" aria-labelledby="studio-tab-library" hidden={view !== 'library'} className="studio-panel">
        {/* Publishing moved into Quick Post's Validate stage, next to the
            review it depends on, so the library only lists content. */}
        <ContentBoard draft={draft} posts={posts} canPublish={false} onPublished={() => setPublishOpen(true)} />
      </div>

      {target && view === 'quick' && (
        // Icon only; the name lives in aria-label so it is announced and
        // findable by voice.
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
      )}

      {target && (
        <CampaignBriefDrawer
          open={brief.open}
          onClose={brief.closeDrawer}
          showWelcome={brief.showWelcome}
          direction={direction}
          status={guideStatus}
          error={guideError}
          marketName={target.market.name}
          captionChosen={Boolean(draft.caption.trim())}
          onApprove={approveAndGenerateGuide}
        />
      )}

      {/* Only with a target, as before: the picker-only screen has nothing to
          publish, and the modal joins the overlay stack. */}
      {target && (
        <PublishModal
          open={publishOpen}
          draft={draft}
          onDraftChange={patchDraft}
          onClose={() => setPublishOpen(false)}
          onConfirm={confirmPublish}
        />
      )}
    </section>
  );
}
