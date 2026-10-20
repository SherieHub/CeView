/**
 * Campaigns tab. By mode:
 *  - list: the owner's campaigns, or — with none yet — straight to the entry.
 *  - generate: "Let's plan your next campaign" — one action over the profile.
 *  - planner: the recommended campaign's three review stages.
 *  - builder: the manual fallback.
 *  - workspace: one campaign's Overview | Posts | Calendar | Results.
 *
 * ContentStudioView owns the campaign list and the mode, and this panel stays
 * mounted while hidden, so switching tabs never loses a campaign in progress.
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Info, Plus, Search } from 'lucide-react';
import type { BusinessProfile, PublishedPost } from '@/types';
import CampaignBuilder from './CampaignBuilder';
import CampaignCard from './CampaignCard';
import './campaign-list.css';
import CampaignGenerate from './CampaignGenerate';
import CampaignPlanner from './CampaignPlanner';
import CampaignWorkspace from './CampaignWorkspace';
import { buildStrategy, campaignFromStrategy } from './campaignRecommendations';
import { EMPTY_PREFERENCES, emptyCampaign, isoToday } from './campaignTypes';
import type { CampaignDraft, CampaignPreferences, PlannedPost } from './campaignTypes';
import { useCaptionPool, useCategoryMarkets } from './useCampaignData';

export type CampaignMode =
  | { kind: 'list' }
  | { kind: 'generate' }
  | { kind: 'planner'; id: string }
  | { kind: 'builder'; draft: CampaignDraft; editing: boolean }
  | { kind: 'workspace'; id: string };

interface CampaignsViewProps {
  campaigns: CampaignDraft[];
  mode: CampaignMode;
  onModeChange: (mode: CampaignMode) => void;
  profile: BusinessProfile;
  /** Published posts — the platform recommendation's evidence. */
  posts: PublishedPost[];
  onSave: (campaign: CampaignDraft) => void;
  onDelete: (id: string) => void;
  onPatchPost: (campaignId: string, postId: string, patch: Partial<PlannedPost>) => void;
  /** False while the Campaigns tab is hidden — nothing is fetched until it is first shown. */
  active?: boolean;
  /** Injectable for tests; defaults to today in Philippine time. */
  today?: string;
}

function PreviewNotice() {
  return (
    <p className="cb-note cb-note--banner" role="note">
      <Info size={15} aria-hidden="true" />
      Campaigns are kept for this session only. They aren&rsquo;t saved, scheduled or published yet.
    </p>
  );
}

export default function CampaignsView({
  campaigns,
  mode,
  onModeChange,
  profile,
  posts,
  onSave,
  onDelete,
  onPatchPost,
  active = true,
  today = isoToday(),
}: CampaignsViewProps) {
  const [opened, setOpened] = useState(active);
  useEffect(() => {
    if (active) setOpened(true);
  }, [active]);
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState('');
  const [prefs, setPrefs] = useState<CampaignPreferences>(EMPTY_PREFERENCES);
  const [pickedCategory, setPickedCategory] = useState('');
  const category = profile.categories.includes(pickedCategory) ? pickedCategory : profile.categories[0] ?? '';
  const markets = useCategoryMarkets(opened ? category : '');
  const pool = useCaptionPool();

  const marketOptions = useMemo(() => [...new Set(campaigns.map((c) => c.marketName || 'Any market'))], [campaigns]);
  const visible = campaigns.filter(
    (c) =>
      c.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (!market || (c.marketName || 'Any market') === market),
  );

  const startNew = () => onModeChange({ kind: 'generate' });
  const startManual = () => onModeChange({ kind: 'builder', draft: emptyCampaign(category, today), editing: false });

  const generate = () => {
    const strategy = buildStrategy({ profile, category, markets: markets.markets, posts, prefs, today });
    if (!strategy) return;
    const campaign = campaignFromStrategy(strategy, category, prefs);
    onSave(campaign);
    setPrefs(EMPTY_PREFERENCES);
    onModeChange({ kind: 'planner', id: campaign.id });
  };

  const open = (c: CampaignDraft) =>
    onModeChange(c.stage === 'done' ? { kind: 'workspace', id: c.id } : { kind: 'planner', id: c.id });

  // Mount on first visit, then retain the planner when switching studio tabs.
  if (!opened) return null;

  if (mode.kind === 'builder') {
    return (
      <>
        <PreviewNotice />
        <CampaignBuilder
          initial={mode.draft}
          categories={profile.categories}
          editing={mode.editing}
          onCancel={() => onModeChange(mode.editing ? { kind: 'workspace', id: mode.draft.id } : { kind: 'generate' })}
          onSave={(c) => {
            onSave(c);
            onModeChange({ kind: 'workspace', id: c.id });
          }}
        />
      </>
    );
  }

  const current = mode.kind === 'planner' || mode.kind === 'workspace' ? campaigns.find((c) => c.id === mode.id) : undefined;

  if (mode.kind === 'planner' && current) {
    return (
      <>
        <PreviewNotice />
        <CampaignPlanner
          campaign={current}
          onChange={onSave}
          onPatchPost={(postId, patch) => onPatchPost(current.id, postId, patch)}
          markets={markets.markets}
          profile={profile}
          today={today}
          pool={pool}
          onBack={() => onModeChange({ kind: 'list' })}
          onReject={() => {
            onDelete(current.id);
            pool.reset(current.id);
            onModeChange({ kind: 'list' });
          }}
          onFinalize={() => {
            onSave({ ...current, stage: 'done' });
            onModeChange({ kind: 'workspace', id: current.id });
          }}
        />
      </>
    );
  }

  if (mode.kind === 'workspace' && current) {
    return (
      <>
        <PreviewNotice />
        <CampaignWorkspace
          campaign={current}
          content={pool.merged(current.id)}
          onBack={() => onModeChange({ kind: 'list' })}
          onEditPlan={() =>
            current.strategy
              ? (onSave({ ...current, stage: 'plan' }), onModeChange({ kind: 'planner', id: current.id }))
              : onModeChange({ kind: 'builder', draft: current, editing: true })
          }
          onDelete={() => {
            onDelete(current.id);
            onModeChange({ kind: 'list' });
          }}
          onPatchPost={(postId, patch) => onPatchPost(current.id, postId, patch)}
        />
      </>
    );
  }

  // With nothing planned yet, the entry *is* the campaigns page.
  if (mode.kind === 'generate' || campaigns.length === 0) {
    return (
      <>
        <PreviewNotice />
        <CampaignGenerate
          profile={profile}
          category={category}
          onCategoryChange={setPickedCategory}
          markets={markets.markets}
          marketsState={markets.state}
          marketsError={markets.error}
          onRetryMarkets={markets.retry}
          prefs={prefs}
          onPrefsChange={setPrefs}
          onGenerate={generate}
          onManual={startManual}
          onBack={() => onModeChange({ kind: 'list' })}
          canGoBack={campaigns.length > 0}
        />
      </>
    );
  }

  return (
    <div className="cv cl">
      <div className="cl-head">
        <div>
          <h2 className="cl-heading">Your Campaigns</h2>
          <p className="cl-sub">Plan and manage coordinated content around your marketing goals.</p>
        </div>
        <button type="button" className="cl-new" onClick={startNew}>
          <Plus size={16} aria-hidden="true" /> New Campaign
        </button>
      </div>

      <PreviewNotice />

      <div className="cl-filters">
        <label className="cl-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search campaigns</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search campaigns" />
        </label>
        <label className="cl-select">
          <span className="sr-only">Filter by market</span>
          <select value={market} onChange={(e) => setMarket(e.target.value)}>
            <option value="">All markets</option>
            {marketOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <ChevronDown size={15} aria-hidden="true" />
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="cw-empty-line">No campaigns match those filters.</p>
      ) : (
        <ul className="cl-grid">
          {visible.map((c) => (
            <CampaignCard key={c.id} campaign={c} onOpen={() => open(c)} />
          ))}
        </ul>
      )}

      <p className="cp-manual">
        <button type="button" className="link-inline" onClick={startManual}>
          <Plus size={13} aria-hidden="true" /> Plan a campaign manually
        </button>
      </p>
    </div>
  );
}
