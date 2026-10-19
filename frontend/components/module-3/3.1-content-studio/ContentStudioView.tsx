/**
 * Route: /content — Module 3.1, Content Studio.
 *
 * Three views under one header (StudioNavigation):
 *  - Quick Post: the original single-post journey — Draft (pick and edit a
 *    caption) -> Attach (media) -> Validate (six-step audit, then publish) —
 *    shown one stage at a time by QuickPostWorkspace.
 *  - Campaigns: CeView's recommended campaigns (campaigns/) — strategy,
 *    content plan, then preparation with the same upload and audit. Kept for
 *    the session; nothing is persisted, scheduled or published from there.
 *  - Content Library: the former Content board.
 *
 * Every piece of state — draft, audit, generated content, selection — still
 * lives here, and all three panels stay mounted (just hidden), so switching
 * tabs or stages never resets work or re-runs a request.
 *
 * The shooting reference — the chosen caption's shots — lives in a
 * slide-out drawer. This screen renders a labelled <section>, not a <main>:
 * AppShell already owns the page's single main landmark.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Send } from 'lucide-react';
import MarketFlagIcon from '../../module-2/2.1-dashboard/MarketFlagIcon';
import PageHead from '../../../layout/PageHead';
import AIContentMatrixPanel from './AIContentMatrixPanel';
import AdUrlBlock from './AdUrlBlock';
import AttachStage from './AttachStage';
import ValidateStage from './ValidateStage';
import { MOCK_GENERATION_MS, slidesFromCaption } from './captionShots';
import type { ShotsState } from './captionShots';
import CampaignBriefDrawer from './CampaignBriefDrawer';
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
import { useCampaignDrafts } from './campaigns/campaignTypes';
import { useFirstRunDrawer } from './useFirstRunDrawer';
import type { AuditState, PublishDraftState, StudioPlatformId } from './contentStudioTypes';
import type { AttributionLink, ContentResponse, Market, PublishedPost } from '../../../types';
// Publishing has no backend yet — GET /api/posts is deferred to a later spec
// (see docs/superpowers/specs/2026-08-29-frontend-backend-connection-design.md
// §Non-goals). The board therefore starts empty and only shows fixture posts when
// the app runs in fixture mode, where apiClient.posts.list() serves them.
import { apiClient } from '../../../services/apiClient';
import { getTranslation, seedFromContent } from './captionTranslationStore';
import { useConnections } from '../../../services/connectionsStore';
import { useOptionalPosts } from '../../../services/postStore';
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
  // Posts live in the app-wide store, so what is published or scheduled here
  // is what the Calendar and Performance read. Injected posts (tests) and a
  // screen rendered without the provider keep a local list instead.
  const store = useOptionalPosts();
  const shared = initialPosts ? null : store;
  const [localPosts, setLocalPosts] = useState<PublishedPost[]>(initialPosts ?? []);
  const posts = shared ? shared.posts ?? [] : localPosts;
  const addPosts = (created: PublishedPost[]) => {
    if (shared) shared.add(created);
    else setLocalPosts((current) => [...created, ...current]);
  };

  useEffect(() => {
    if (initialPosts || store) return;
    let cancelled = false;
    apiClient.posts
      .list()
      .then((list) => { if (!cancelled) setLocalPosts((current) => (current.length ? current : (list as PublishedPost[]))); })
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
  const onDraft = view === 'quick' && qpStep === 'draft';

  // Campaigns (frontend-only, this session — see campaigns/campaignTypes.ts).
  const campaignStore = useCampaignDrafts();
  const [campaignMode, setCampaignMode] = useState<CampaignMode>({ kind: 'list' });

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
      .then((c) => {
        if (cancelled) return;
        seedFromContent(c);
        setContent(c);
      })
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
    setDraft((current) => {
      const next = { ...current, ...patch };
      // A translation describes one exact caption: changing the text without
      // supplying its new English leaves the old one pointing at words that are gone.
      if ('caption' in patch && !('captionEn' in patch) && patch.caption !== current.caption) next.captionEn = null;
      return next;
    });
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
    patchDraft({
      caption: text,
      captionEn: content?.captions[activePlatform]?.optionsEn?.[index] || null,
      agreementChecked: false,
    });
  };

  // The Visual guide's four shots for the chosen caption (captionShots.ts) —
  // mock inspiration for now, where generated AI shots will appear. They're
  // revealed by "Generate AI shots", and a new caption needs new shots, so the
  // state returns to idle whenever the shots themselves change.
  const platformGuide = content?.captions[activePlatform]?.guide ?? [];
  const shotSlides = slidesFromCaption(draft.caption, platformGuide, [profile.businessName]);
  const shotsKey = shotSlides.map((s) => `${s.id}:${s.quote ?? ''}`).join('|');
  const [shotsState, setShotsState] = useState<ShotsState>('idle');
  const shotsTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(shotsTimer.current);
    setShotsState('idle');
  }, [shotsKey]);
  useEffect(() => () => window.clearTimeout(shotsTimer.current), []);
  const generateShots = () => {
    // MOCK: stands in for the generation request (see MOCK_GENERATION_MS).
    setShotsState('loading');
    window.clearTimeout(shotsTimer.current);
    shotsTimer.current = window.setTimeout(() => setShotsState('ready'), MOCK_GENERATION_MS);
  };

  // Stable between renders: CompliancePanel's step timer restarts whenever this
  // changes identity, so a fresh object each render stalled the audit.
  const recommendations = useMemo(
    () => auditRecommendations(content, activePlatform, selectedOption),
    [content, activePlatform, selectedOption],
  );

  // Reveals the Publish button. Platform choice and the authorisation tick are
  // the modal's job now, so they gate "Confirm & Publish" in there rather than
  // the button that opens it.
  const mediaUploadSettled = draft.mediaUpload?.status !== 'uploading' && draft.mediaUpload?.status !== 'failed';
  const canPublish = Boolean(draft.caption.trim() && draft.mediaDataUrl && mediaUploadSettled && audit.result?.status === 'Pass');

  // The library's open post, and the ones just published (flagged in its list).
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [justPublished, setJustPublished] = useState<string[]>([]);
  // Opened only once the publish modal has gone: both sit on the one overlay
  // stack, and opening the detail in the same render the publish modal closes
  // in had its entry popped along with the publish modal's — so it shut at once.
  const [pendingOpen, setPendingOpen] = useState<string | null>(null);
  useEffect(() => {
    if (publishOpen || !pendingOpen) return;
    setOpenPostId(pendingOpen);
    setPendingOpen(null);
  }, [publishOpen, pendingOpen]);

  const publish = (): PublishedPost[] => {
    if (!canPublish) return [];
    // A scheduled post is dated for when it goes out, not for today.
    const scheduledFor = draft.scheduledFor ?? null;
    const date = scheduledFor ? scheduledFor.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const created = draft.platforms.map((platform, index): PublishedPost => ({
      id: `published-${Date.now()}-${index}`, date, platform, caption: draft.caption,
      captionEn: draft.captionEn ?? getTranslation(draft.caption) ?? null,
      status: scheduledFor ? 'scheduled' : 'published',
      reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, series: [],
      mediaUrl: draft.mediaDataUrl,
      scheduledFor,
    }));
    addPosts(created);
    if (draft.localVideoUrl) URL.revokeObjectURL(draft.localVideoUrl);
    setDraft(EMPTY_DRAFT);
    setAudit(IDLE_AUDIT);
    setSelectedOption(null);
    return created;
  };

  // Straight to the Content Library, with the new (or newly scheduled) post
  // open — the post is the result, so that is where the owner lands. Quick Post resets to Draft for
  // the next one.
  const confirmPublish = () => {
    const created = publish();
    setPublishOpen(false);
    if (!created.length) return;
    setJustPublished(created.map((p) => p.id));
    setPendingOpen(created[0].id);
    setQpStep('draft');
    setView('library');
  };


  const marketSelect =
    target && markets.length > 0 ? (
      <label className="studio-market">
        <span className="studio-market-label">Target market</span>
        {/* Writes back into the shared target store rather than into local
            state: content generation reads `target.market.id`, so a select
            bound to a private value would look right and change nothing. */}
        {/* The same green pill as the market switcher elsewhere: the current
            market's flag sits inside it, over a native select. */}
        <span className="studio-select-wrap">
          <MarketFlagIcon name={target.market.name} />
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
          <ChevronDown className="studio-select-caret" size={18} strokeWidth={2} aria-hidden="true" />
        </span>
      </label>
    ) : undefined;

  const quickPost = !target ? (
    // No surge + market picked yet — gate the composer behind the picker. No
    // entry point may skip this by inferring a market on the operator's behalf.
    <ContentTargetPicker onPicked={setTarget} />
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
          <AttachStage
            draft={draft}
            onDraftChange={patchDraft}
            audit={audit}
            platform={activePlatform}
            stageToken={stageToken}
            marketName={target.market.name}
            slides={shotSlides}
            shotsState={shotsState}
            onGenerateShots={generateShots}
            onOpenGuide={brief.openDrawer}
            onChooseCaption={() => setQpStep('draft')}
          />
        }
        validateStage={
          <ValidateStage
            draft={draft}
            audit={audit}
            onAuditChange={setAudit}
            onDraftChange={patchDraft}
            recommendations={recommendations}
            onEditCaption={() => setQpStep('draft')}
            onManageMedia={() => setQpStep('attach')}
            footer={<AdUrlBlock link={attributionLink} onLinkChange={setAttributionLink} />}
          />
        }
        // Publish appears only after a passing audit (same rule as before); it
        // opens the modal, whose Confirm is what actually publishes.
        finish={
          canPublish ? (
            <button type="button" className="btn-cta qp-publish-btn" onClick={() => setPublishOpen(true)}>
              <Send size={16} aria-hidden="true" />
              Publish{draft.platforms.length ? ` to ${draft.platforms.length} platform${draft.platforms.length === 1 ? '' : 's'}` : ''}
            </button>
          ) : (
            <p className="qp-finish-hint">
              {draft.mediaUpload?.status === 'uploading'
                ? 'Uploading your media… Publish unlocks when it finishes.'
                : draft.mediaUpload?.status === 'failed'
                  ? 'Media upload failed — go back to Attach to retry.'
                  : 'Run the audit — Publish unlocks when your post passes.'}
            </p>
          )
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
          profile={profile}
          posts={posts}
          onSave={campaignStore.upsert}
          onDelete={campaignStore.remove}
          onPatchPost={campaignStore.patchPost}
          active={view === 'campaigns'}
        />
      </div>

      <div id="studio-panel-library" role="tabpanel" aria-labelledby="studio-tab-library" hidden={view !== 'library'} className="studio-panel">
        {/* Publishing moved into Quick Post's Validate stage, next to the
            review it depends on, so the library only lists content. */}
        <ContentBoard
          draft={draft}
          posts={posts}
          canPublish={false}
          onPublished={() => setPublishOpen(true)}
          openPostId={openPostId}
          onOpenPost={setOpenPostId}
          justPublished={justPublished}
        />
      </div>

      {/* No floating trigger: the guide opens from the "Review Visual Guide"
          link beside the upload control. Not on Draft either — choosing a
          caption is its own job, and the shot list is media guidance, so a
          first-run auto-open waits until Attach. */}
      {target && (
        <CampaignBriefDrawer
          open={view === 'quick' && brief.open && !onDraft}
          onClose={brief.closeDrawer}
          showWelcome={brief.showWelcome}
          marketName={target.market.name}
          slides={shotsState === 'ready' ? shotSlides : []}
          shotsPending={shotSlides.length > 0 && shotsState !== 'ready'}
          platformGuide={platformGuide}
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
          accountName={profile.businessName || undefined}
        />
      )}
    </section>
  );
}
