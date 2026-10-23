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
import { ChevronDown, Megaphone, Send } from 'lucide-react';
import MarketFlagIcon from '../../module-2/2.1-dashboard/MarketFlagIcon';
import PageHead from '../../../layout/PageHead';
import AIContentMatrixPanel from './AIContentMatrixPanel';
import AdPlannerDrawer from './AdPlannerDrawer';
import AdUrlBlock from './AdUrlBlock';
import AttachStage from './AttachStage';
import ValidateStage from './ValidateStage';
import { MOCK_GENERATION_MS, slidesFromCaption } from './captionShots';
import type { ShotsState } from './captionShots';
import CampaignBriefDrawer from './CampaignBriefDrawer';
import DraftsBar from './DraftsBar';
import { quickDraftName, useQuickSaveDraft } from './SaveDraftButton';
import type { SaveMode, SaveOutcome } from './SaveDraftButton';
import { useCooldown } from './useCooldown';
import { AUDIT_STEP_COUNT } from './CompliancePanel';
import DraftsPanel from './DraftsPanel';
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
import { useContentDrafts } from './useContentDrafts';
import { buildPayload, composerFromSaved, isStale, profileFingerprint } from './contentDraftPayload';
import type { ContentDraftPayload } from './contentDraftPayload';
import type { AuditState, PublishDraftState, StudioPlatformId } from './contentStudioTypes';
import type { AttributionLink, ContentResponse, Market, PublishedPost } from '../../../types';
// Publishing has no backend yet — GET /api/posts is deferred to a later spec
// (see docs/superpowers/specs/2026-08-29-frontend-backend-connection-design.md
// §Non-goals). The board therefore starts empty and only shows fixture posts when
// the app runs in fixture mode, where apiClient.posts.list() serves them.
import { apiClient } from '../../../services/apiClient';
import { loadStoredImage } from '../../../services/mediaUpload';
import { ApiError, isMissingDependency } from '../../../services/apiError';
import { seedFromContent } from './captionTranslationStore';
import { useConnections } from '../../../services/connectionsStore';
import { useOptionalPosts } from '../../../services/postStore';
import { useProfile } from '../../../services/profileContext';
import { useTargetSelection } from '../../../services/targetSelectionStore';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';

/**
 * Breathing room between caption generations. It is the heaviest model call in the app (the model
 * may spend thousands of tokens on one run) and its host meters tokens per minute, so generations
 * fired back to back are what trips the limit. 60 s is one metering window; after a refusal 30 s
 * is added on top of whatever the model's own retry window is.
 */
export const CAPTION_COOLDOWN_AFTER_RUN_MS = 60_000;
export const CAPTION_COOLDOWN_AFTER_FAILURE_MS = 30_000;
const CAPTION_COOLDOWN_KEY = 'ceview.cooldown.captionGeneration';

/** The model said no (rate limit, or unavailable) — as opposed to, say, the network dropping. */
function isModelRefusal(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 429 || error.status === 503 || isMissingDependency(error));
}

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
  const [adPlannerOpen, setAdPlannerOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);

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

  // Saved drafts (server-side, per market). Off for the dev-preview props, which
  // seed their own composer and have no signed-in operator behind them.
  const draftsEnabled = !initialDraft;
  const marketId = target?.market.id ?? null;
  const drafts = useContentDrafts(marketId, draftsEnabled);
  const { scheduleSave } = drafts;
  const captionCooldown = useCooldown(CAPTION_COOLDOWN_KEY);
  const startCaptionCooldown = captionCooldown.start;
  const [draftsOpen, setDraftsOpen] = useState(false);
  // The saved draft the work on screen IS, once it has been saved or opened — so saving again
  // updates it instead of adding a copy. `snapshot` is the payload as last saved, to tell whether
  // anything has changed since; null means "take the next payload built as the snapshot" (right
  // after opening a draft, so a restored draft that is unchanged does not look edited).
  const [linked, setLinked] = useState<{ id: string; name: string; snapshot: string | null } | null>(null);
  const [staleDraft, setStaleDraft] = useState(false);
  const [regenCount, setRegenCount] = useState(0);
  const handledRegen = useRef(0);
  // Which `${market}|${alert}` the captions on screen belong to. The ref is what the
  // generate effect reads (changing it must not restart a request in flight); the state
  // mirrors it for the auto-save effect.
  const contentKeyRef = useRef<string | null>(null);
  const [contentKey, setContentKeyState] = useState<string | null>(null);
  const markContent = (key: string | null) => { contentKeyRef.current = key; setContentKeyState(key); };
  const fingerprint = profileFingerprint(profile, marketTrend);

  // A different market is a different piece of work: never leave the previous
  // market's captions or caption under it while the new ones load.
  const previousMarket = useRef<string | null>(null);
  // Changes whenever the work on screen is replaced (another market, a loaded draft), so the
  // composers re-mount and drop what they remember about the previous image.
  const [composerSession, setComposerSession] = useState(0);
  useEffect(() => {
    if (previousMarket.current !== null && marketId !== null && marketId !== previousMarket.current) {
      markContent(null);
      setContent(null);
      setComposerSession((n) => n + 1);
      setDraft(EMPTY_DRAFT);
      setSelectedOption(null);
      setAudit(IDLE_AUDIT);
      setQpStep('draft');
      setStaleDraft(false);
      setLinked(null);
    }
    // Remembered across "Change target market", when the pick is briefly null: clearing and then
    // choosing a different market must still count as a change of market.
    if (marketId !== null) previousMarket.current = marketId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId]);

  /**
   * Reads a restored draft's picture back as a data URL — what a freshly picked one is, so the
   * preview, the voucher overlay, the publish modal and the audit all treat it the same. Written
   * with setDraft, not patchDraft, so the audit that came with the draft is not reset. Ignored
   * if the draft's image has changed since. If the file cannot be read, the saved public URL is
   * the fallback: it shows the picture wherever that URL is reachable.
   */
  const restoreImage = (mediaId: string, publicUrl: string) => {
    const isStillThisImage = (d: PublishDraftState) =>
      d.mediaUpload?.status === 'ready' && d.mediaUpload.mediaId === mediaId;
    loadStoredImage(mediaId)
      .then((dataUrl) => setDraft((d) => (isStillThisImage(d) ? { ...d, mediaDataUrl: dataUrl } : d)))
      .catch(() => setDraft((d) => (isStillThisImage(d) && !d.mediaDataUrl ? { ...d, mediaDataUrl: publicUrl } : d)));
  };

  // Puts a saved draft's captions, direction and edits back on screen.
  const skipSelectionReset = useRef(false);
  const applyPayload = (saved: ContentDraftPayload) => {
    setComposerSession((n) => n + 1);
    seedFromContent(saved.content);
    setContent(saved.content);
    // The effect that clears the highlighted option on a platform change must not
    // clear the one being restored.
    if (saved.activePlatform !== activePlatform) skipSelectionReset.current = true;
    setActivePlatform(saved.activePlatform);
    setSelectedOption(saved.selectedOption);
    // The attached image and its audit come back with the draft, so it can be published as is.
    // Set directly rather than through patchDraft, which would reset the audit on a media change.
    const restored = composerFromSaved(saved.draft, saved.media);
    const image = saved.media?.kind === 'image' ? saved.media : null;
    // An image's public URL is for outsiders (the social platforms) and may not load from here, so
    // the picture is read back through the API instead; until it arrives there is no preview
    // rather than a broken one.
    setDraft(image ? { ...restored, mediaDataUrl: null } : restored);
    if (image) restoreImage(image.mediaId, image.publicUrl);
    setAudit(saved.audit ? { status: 'complete', step: AUDIT_STEP_COUNT, result: saved.audit } : IDLE_AUDIT);
    setQpStep(saved.qpStep);
  };

  useEffect(() => {
    // The backend 400s on a blank market and needs the profile fields, so don't
    // fire until both are present.
    if (!target || !profile.businessName) return;
    // Hold off while the market's saved draft is being looked up: if there is one,
    // its captions are used and nothing is generated.
    if (draftsEnabled && drafts.restoring) return;

    const key = `${target.market.id}|${target.alert.id}`;
    const forced = regenCount !== handledRegen.current;
    if (!forced && contentKeyRef.current === key) return;

    const sameMarket = contentKeyRef.current?.startsWith(`${target.market.id}|`) ?? false;
    if (!forced && !sameMarket && draftsEnabled && drafts.restored) {
      applyPayload(drafts.restored);
      markContent(key);
      setStaleDraft(isStale(drafts.restored, target.alert.id, fingerprint));
      return;
    }

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
        // Pins the caption's attribution code to this alert's window. The backend
        // ignores it when the picked market differs from the alert's own.
        demandAlertId: target.alert.id,
      })
      .then((c) => {
        if (cancelled) return;
        handledRegen.current = regenCount;
        startCaptionCooldown(CAPTION_COOLDOWN_AFTER_RUN_MS);
        seedFromContent(c);
        setContent(c);
        // Fresh options replace whatever was highlighted from the old ones.
        if (forced) setSelectedOption(null);
        setStaleDraft(false);
        markContent(key);
      })
      .catch((e) => {
        if (cancelled) return;
        setContentError(e);
        // Only a refusal earns a wait; a dropped connection should be retryable at once.
        if (isModelRefusal(e)) startCaptionCooldown(CAPTION_COOLDOWN_AFTER_FAILURE_MS);
      })
      .finally(() => { if (!cancelled) setContentLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, profile, marketTrend, drafts.restoring, drafts.restored, regenCount]);

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
  useEffect(() => {
    if (skipSelectionReset.current) { skipSelectionReset.current = false; return; }
    setSelectedOption(null);
  }, [activePlatform]);

  // Auto-save: whenever the captions, the chosen option or the operator's edits change.
  // Held back until the captions on screen are this target's (not a previous market's).
  useEffect(() => {
    if (!draftsEnabled || !target || !content) return;
    if (contentKey !== `${target.market.id}|${target.alert.id}`) return;
    scheduleSave(
      target.market.id,
      target.alert.id,
      buildPayload({
        content, activePlatform, selectedOption, qpStep, draft, audit,
        alertId: target.alert.id,
        windowOpenDate: target.alert.windowOpenDate,
        fingerprint,
      }),
    );
  }, [draftsEnabled, target, content, contentKey, activePlatform, selectedOption, qpStep, draft, audit, fingerprint, scheduleSave]);

  const currentPayload = (): ContentDraftPayload | null =>
    target && content
      ? buildPayload({
          content, activePlatform, selectedOption, qpStep, draft, audit,
          alertId: target.alert.id,
          windowOpenDate: target.alert.windowOpenDate,
          fingerprint,
        })
      : null;

  // The payload as it stands, as JSON: what "has anything changed since it was saved" compares.
  const payloadJson = useMemo(
    () => (target && content
      ? JSON.stringify(buildPayload({
          content, activePlatform, selectedOption, qpStep, draft, audit,
          alertId: target.alert.id,
          windowOpenDate: target.alert.windowOpenDate,
          fingerprint,
        }))
      : null),
    [target, content, activePlatform, selectedOption, qpStep, draft, audit, fingerprint],
  );
  useEffect(() => {
    if (linked && linked.snapshot === null && payloadJson) setLinked({ ...linked, snapshot: payloadJson });
  }, [linked, payloadJson]);
  const saveMode: SaveMode = !linked ? 'new' : linked.snapshot !== null && linked.snapshot === payloadJson ? 'clean' : 'update';

  /** Saves the work as a NEW draft and links to it. If identical work is already saved, the server
   *  creates nothing and answers with that draft, which is what we link to. */
  const createDraft = async (name: string, payload: ContentDraftPayload): Promise<SaveOutcome> => {
    if (!target) throw new Error('nothing to save');
    const saved = await drafts.saveAs(name, target.alert.id, payload);
    if (!saved) throw new Error('could not save the draft');
    setLinked({ id: saved.id, name: saved.name, snapshot: JSON.stringify(payload) });
    return { kind: saved.existing ? 'existing' : 'created', name: saved.name };
  };

  // The Save draft button: updates the draft this work already is, else saves a new one.
  const saveCurrent = async (): Promise<SaveOutcome> => {
    const payload = currentPayload();
    if (!payload || !target) throw new Error('nothing to save');
    if (linked) {
      try {
        await drafts.update(linked.id, payload);
        setLinked({ ...linked, snapshot: JSON.stringify(payload) });
        return { kind: 'updated', name: linked.name };
      } catch (err) {
        // The draft was deleted elsewhere (another tab); save a fresh one rather than fail.
        if (!(err instanceof ApiError && err.status === 404)) throw err;
        setLinked(null);
      }
    }
    return createDraft(quickDraftName(target.market.name), payload);
  };
  const quickSave = useQuickSaveDraft(saveCurrent);

  // The drawer's "Save current as…": an explicit separate copy under a name the operator chose.
  const saveDraftAs = async (name: string) => {
    const payload = currentPayload();
    if (!payload) return;
    const outcome = await createDraft(name, payload);
    return outcome.kind === 'existing' ? { alreadySavedAs: outcome.name } : undefined;
  };

  const renameDraft = async (id: string, name: string) => {
    await drafts.rename(id, name);
    setLinked((current) => (current?.id === id ? { ...current, name } : current));
  };

  const removeDraft = async (id: string) => {
    await drafts.remove(id);
    setLinked((current) => (current?.id === id ? null : current));
  };

  const openSavedDraft = async (id: string) => {
    const saved = await drafts.open(id);
    if (!saved || !target) throw new Error('unreadable draft');
    applyPayload(saved);
    markContent(`${target.market.id}|${target.alert.id}`);
    setStaleDraft(isStale(saved, target.alert.id, fingerprint));
    // What is on screen is now this saved draft: saving updates it rather than copying it.
    setLinked({ id, name: drafts.named.find((d) => d.id === id)?.name ?? 'this draft', snapshot: null });
  };

  const patchDraft = (patch: Partial<PublishDraftState>) => {
    if (publishing) return;
    requestId.current = null;
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
  // A restored video may have no poster image (one too large to be saved with the draft is
  // dropped); it is still attached once its upload is ready, and its audit came back with it.
  const hasMedia = Boolean(draft.mediaDataUrl)
    || (draft.mediaType === 'video' && draft.mediaUpload?.status === 'ready');
  const canPublish = Boolean(draft.caption.trim() && hasMedia && mediaUploadSettled && audit.result?.status === 'Pass');

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

  const confirmPublish = async () => {
    if (publishing || !canPublish || !draft.agreementChecked) return;
    if (draft.mediaUpload?.status !== 'ready') { setPublishError('Upload your media before publishing.'); return; }
    setPublishing(true);
    setPublishError(null);
    requestId.current ??= crypto.randomUUID();
    try {
      const platforms = [...draft.platforms, ...(draft.paidPartnership ? ['meta_ads'] : [])];
      const created = await apiClient.posts.publish({
        requestId: requestId.current, platforms,
        captionsByPlatform: Object.fromEntries(platforms.map((p) => [p, draft.caption])),
        mediaId: draft.mediaUpload.mediaId, market: target?.market.id,
        visibility: draft.visibility, approved: true,
        scheduledFor: draft.scheduledFor ? new Date(draft.scheduledFor).toISOString() : undefined,
        ad: draft.paidPartnership ? draft.ad : undefined,
      });
      addPosts(created);
      if (draft.mediaType === 'video' && created.some((p) => p.status === 'inbox')) {
        try { await navigator.clipboard.writeText(draft.caption); } catch { /* Copy remains available in post detail. */ }
      }
      setPublishOpen(false);
      setJustPublished(created.map((p) => p.id));
      setPendingOpen(created[0]?.id ?? null);
      setView('library');
      if (!created.some((p) => p.status === 'failed')) {
        if (draft.localVideoUrl) URL.revokeObjectURL(draft.localVideoUrl);
        setDraft(EMPTY_DRAFT); setAudit(IDLE_AUDIT); setSelectedOption(null); setQpStep('draft'); setLinked(null);
        requestId.current = null;
      }
    } catch (err) { setPublishError(err instanceof Error ? err.message : 'Publishing failed. Please retry.'); }
    finally { setPublishing(false); }
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

      {draftsEnabled && (
        <DraftsBar
          status={drafts.status}
          savedAt={drafts.savedAt}
          namedCount={drafts.named.length}
          stale={staleDraft}
          hasWork={Boolean(draft.caption.trim())}
          regenerating={contentLoading}
          showRegenerate={qpStep === 'draft'}
          cooldownSeconds={captionCooldown.secondsLeft}
          quickSave={{
            state: quickSave.state,
            mode: saveMode,
            outcome: quickSave.outcome,
            linkedName: linked?.name,
            onSave: () => { void quickSave.run(); },
            canSave: content !== null,
          }}
          onOpenDrafts={() => setDraftsOpen(true)}
          onRegenerate={() => { setLinked(null); setRegenCount((c) => c + 1); }}
          onRetry={() => { void drafts.retry(); }}
        />
      )}

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
              loading={contentLoading || (draftsEnabled && drafts.restoring)}
            />
            <div className="qp-editor">
              <PublishComposer
                key={composerSession}
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
            key={composerSession}
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
          <div className="qp-finish">
            <button type="button" className="btn-outline qp-ad-btn" onClick={() => setAdPlannerOpen(true)}>
              <Megaphone size={16} aria-hidden="true" />
              Promote as an ad
            </button>
            {canPublish ? (
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
            )}
          </div>
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

      {shared?.error && <p role="alert">Unable to refresh your posts: {shared.error}</p>}
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
      {draftsEnabled && target && (
        <DraftsPanel
          open={draftsOpen}
          onClose={() => setDraftsOpen(false)}
          marketName={target.market.name}
          drafts={drafts.named}
          loadFailed={drafts.namedError}
          hasWork={Boolean(draft.caption.trim())}
          canSave={content !== null}
          currentDraftId={linked?.id ?? null}
          onSave={saveDraftAs}
          onOpen={openSavedDraft}
          onRename={renameDraft}
          onRemove={removeDraft}
        />
      )}
      {target && view === 'quick' && adPlannerOpen && <AdPlannerDrawer
        open={view === 'quick' && adPlannerOpen}
        onClose={() => setAdPlannerOpen(false)}
        alert={target.alert}
        market={target.market}
        caption={draft.caption}
        mediaDataUrl={draft.mediaDataUrl}
        link={attributionLink}
      />}
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
          busy={publishing}
          error={publishError}
          attributionLinkId={attributionLink?.linkId}
          market={target.market.id}
          windowOpenDate={target.alert.windowOpenDate}
          interestSeeds={[...profile.categories, ...profile.coreServices]}
          accountName={profile.businessName || undefined}
        />
      )}
    </section>
  );
}
