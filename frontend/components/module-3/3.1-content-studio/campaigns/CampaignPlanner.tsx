/**
 * The guided flow for one campaign: Strategy -> Content plan -> Prepare &
 * approve, one stage at a time. The campaign is kept in the session store
 * from the moment it is generated, so leaving (another tab, Quick Post) and
 * coming back resumes exactly where the owner was.
 *
 * Accepting the strategy is what asks the existing caption generator for the
 * campaign's market; the plan is then assembled by campaignRecommendations. If that
 * request fails, the owner keeps everything and can retry, or continue with a
 * plan that has no captions yet — failed output is never replaced with
 * invented captions.
 */
import { useState } from 'react';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import type { BusinessProfile, Market } from '@/types';
import { ApiErrorPanel } from '../../../shared/ApiErrorPanel';
import ContentPlanReview from './ContentPlanReview';
import PreparePosts from './PreparePosts';
import StrategyReview from './StrategyReview';
import { buildPostPlan, classifyMarket, unusedCaption } from './campaignRecommendations';
import { getTranslation } from '../captionTranslationStore';
import { planBasis } from './campaignTypes';
import type { CampaignDraft, CampaignStage, PlannedPost } from './campaignTypes';
import type { useCaptionPool } from './useCampaignData';

const STAGES: { id: Exclude<CampaignStage, 'done'>; label: string; hint: string }[] = [
  { id: 'strategy', label: 'Review strategy', hint: 'Market, platforms, timing' },
  { id: 'plan', label: 'Content plan', hint: 'What to post and when' },
  { id: 'prepare', label: 'Prepare & approve', hint: 'Photos, audit, sign-off' },
];

interface CampaignPlannerProps {
  campaign: CampaignDraft;
  onChange: (campaign: CampaignDraft) => void;
  onPatchPost: (postId: string, patch: Partial<PlannedPost>) => void;
  markets: Market[];
  profile: BusinessProfile;
  today: string;
  pool: ReturnType<typeof useCaptionPool>;
  onBack: () => void;
  onFinalize: () => void;
  onReject: () => void;
}

export default function CampaignPlanner({
  campaign: c,
  onChange,
  onPatchPost,
  markets,
  profile,
  today,
  pool,
  onBack,
  onFinalize,
  onReject,
}: CampaignPlannerProps) {
  const [planState, setPlanState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [planError, setPlanError] = useState<unknown>(null);
  const generated = c.strategy != null;
  const stageIndex = STAGES.findIndex((s) => s.id === c.stage);
  const content = pool.merged(c.id);

  const opportunity = () => {
    const m = markets.find((x) => x.id === c.marketId);
    return m ? classifyMarket(m, today) : c.strategy?.market.value.opportunity ?? 'ranked';
  };

  /** Generates captions for the campaign's market, then lays out the plan. */
  const buildPlan = async (withCaptions = true) => {
    setPlanState('loading');
    setPlanError(null);
    pool.reset(c.id);
    let result = null;
    if (withCaptions) {
      try {
        result = await pool.generate(c.id, { marketId: c.marketId, opportunity: opportunity(), profile });
      } catch (e) {
        setPlanError(e);
        setPlanState('error');
        return;
      }
    }
    onChange({ ...c, stage: 'plan', planBasis: planBasis(c), posts: buildPostPlan({ campaign: c, profile, content: result }) });
    setPlanState('idle');
  };

  const regenerateCaption = async (postId: string): Promise<boolean> => {
    const used = new Set(c.posts.map((p) => p.caption).filter(Boolean));
    const post = c.posts.find((p) => p.id === postId);
    if (!post) return false;
    let next = unusedCaption(pool.merged(c.id), post.platform, used);
    if (!next) {
      // The pool has run out for this platform: ask the generator for a fresh set.
      try {
        const fresh = await pool.generate(c.id, { marketId: c.marketId, opportunity: opportunity(), profile });
        next = unusedCaption(fresh, post.platform, used);
      } catch {
        return false;
      }
    }
    if (!next) return false;
    onPatchPost(postId, { caption: next, captionEn: getTranslation(next) ?? null, captionOrigin: 'generated' });
    return true;
  };

  const regenerateVisual = (postId: string) => {
    const post = c.posts.find((p) => p.id === postId);
    const guide = content?.captions[post?.platform ?? 'instagram']?.guide ?? [];
    if (!post || !guide.length) return;
    const i = guide.indexOf(post.visual);
    onPatchPost(postId, { visual: guide[(i + 1) % guide.length] });
  };

  return (
    <div className={`cp${c.stage === 'strategy' ? ' cp--strategy' : c.stage === 'plan' ? ' cp--plan' : ''}`}>
      <div className="cp-top">
        <button type="button" className="link-back" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden="true" /> All campaigns
        </button>
        <nav className="cp-rail" aria-label="Campaign progress">
          <ol>
            {STAGES.map((s, i) => {
              // Earlier stages stay reachable; later ones open as they are reached.
              const reachable = i <= stageIndex && (s.id !== 'strategy' || generated);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    data-state={i === stageIndex ? 'current' : i < stageIndex ? 'done' : 'todo'}
                    aria-current={i === stageIndex ? 'step' : undefined}
                    disabled={!reachable || i === stageIndex}
                    onClick={() => onChange({ ...c, stage: s.id })}
                  >
                    <span className="cp-rail-no" aria-hidden="true">{i + 1}</span>
                    <span className="cp-rail-copy">
                      <span className="cp-rail-label">{s.label}</span>
                      <span className="cp-rail-hint">{s.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <button type="button" className="link-inline" disabled={planState === 'loading'} onClick={() => {
          if (window.confirm('Discard this campaign and its posts?')) onReject();
        }}>Discard campaign</button>
      </div>

      {planState === 'loading' && (
        <div className="cp-loading" role="status">
          <LoaderCircle className="animate-spin" size={22} aria-hidden="true" />
          <p>Preparing your content plan for {c.marketName}…</p>
          <span>CeView is drafting captions and visual ideas for each post.</span>
        </div>
      )}

      {planState === 'error' && (
        <div className="cp-error">
          <ApiErrorPanel error={planError} label="Content plan" />
          <div className="cp-error-acts">
            <button type="button" className="btn-primary btn-primary--sm" onClick={() => buildPlan(true)}>Try again</button>
            <button type="button" className="btn-outline btn-outline--sm" onClick={() => buildPlan(false)}>
              Continue without captions
            </button>
          </div>
          <p className="cp-foot-note">Your strategy is kept. Without captions, you can write each one yourself.</p>
        </div>
      )}

      {planState === 'idle' && c.stage === 'strategy' && (
        <StrategyReview
          campaign={c}
          onChange={onChange}
          markets={markets}
          profile={profile}
          today={today}
          onContinue={() => {
            // Already planned for this strategy: just move on, keeping edits.
            // Planned for a different one: offer to rebuild, never silently.
            const stale = c.posts.length > 0 && c.planBasis !== planBasis(c);
            if (!c.posts.length) void buildPlan(true);
            else if (stale && window.confirm('Your strategy changed. Rebuild the content plan to match? Edits to your posts will be replaced.')) void buildPlan(true);
            else onChange({ ...c, stage: 'plan' });
          }}
        />
      )}

      {planState === 'idle' && c.stage === 'plan' && (
        <ContentPlanReview
          campaign={c}
          onChange={onChange}
          generated={generated}
          onRegenerateCaption={regenerateCaption}
          onRegenerateVisual={regenerateVisual}
          onRegeneratePlan={() => void buildPlan(true)}
          onAccept={() =>
            onChange({
              ...c,
              stage: 'prepare',
              posts: c.posts.map((p) => (p.status === 'suggested' ? { ...p, status: 'accepted' } : p)),
            })
          }
        />
      )}

      {planState === 'idle' && c.stage === 'prepare' && (
        <PreparePosts campaign={c} onPatchPost={onPatchPost} content={content} onFinalize={onFinalize} />
      )}
    </div>
  );
}
