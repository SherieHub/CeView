/**
 * Campaigns tab: the campaign list (or its empty state), and — by mode — the
 * builder or one campaign's workspace. ContentStudioView owns the campaign
 * list and the mode, so leaving for the Quick Post composer and coming back
 * returns to the same campaign.
 */
import { useMemo, useState } from 'react';
import { CalendarRange, FolderKanban, Info, Plus, Search } from 'lucide-react';
import { PlatformIcon } from '../ContentBoard';
import CampaignBuilder from './CampaignBuilder';
import CampaignWorkspace from './CampaignWorkspace';
import { dateRange, emptyCampaign, objectiveLabel } from './campaignTypes';
import type { CampaignDraft, PlannedPostStatus } from './campaignTypes';

export type CampaignMode =
  | { kind: 'list' }
  | { kind: 'builder'; draft: CampaignDraft; editing: boolean }
  | { kind: 'workspace'; id: string };

interface CampaignsViewProps {
  campaigns: CampaignDraft[];
  mode: CampaignMode;
  onModeChange: (mode: CampaignMode) => void;
  categories: string[];
  onSave: (campaign: CampaignDraft) => void;
  onDelete: (id: string) => void;
  onPostStatus: (campaignId: string, postId: string, status: PlannedPostStatus) => void;
  onOpenPost: (campaign: CampaignDraft, postId: string) => void;
}

function PreviewNotice() {
  return (
    <p className="cb-note cb-note--banner" role="note">
      <Info size={15} aria-hidden="true" />
      Campaign planning is a preview: plans are kept for this session only and aren&rsquo;t saved, scheduled or
      published yet.
    </p>
  );
}

export default function CampaignsView({
  campaigns,
  mode,
  onModeChange,
  categories,
  onSave,
  onDelete,
  onPostStatus,
  onOpenPost,
}: CampaignsViewProps) {
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState('');

  const marketOptions = useMemo(
    () => [...new Set(campaigns.map((c) => c.marketName || 'Any market'))],
    [campaigns],
  );
  const visible = campaigns.filter(
    (c) =>
      c.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (!market || (c.marketName || 'Any market') === market),
  );

  const startNew = () => onModeChange({ kind: 'builder', draft: emptyCampaign(categories[0] ?? ''), editing: false });

  if (mode.kind === 'builder') {
    return (
      <>
        <PreviewNotice />
        <CampaignBuilder
          initial={mode.draft}
          categories={categories}
          editing={mode.editing}
          onCancel={() => onModeChange(mode.editing ? { kind: 'workspace', id: mode.draft.id } : { kind: 'list' })}
          onSave={(c) => {
            onSave(c);
            onModeChange({ kind: 'workspace', id: c.id });
          }}
          onOpenPost={(c, postId) => {
            onSave(c);
            onOpenPost(c, postId);
          }}
        />
      </>
    );
  }

  if (mode.kind === 'workspace') {
    const campaign = campaigns.find((c) => c.id === mode.id);
    if (campaign) {
      return (
        <>
          <PreviewNotice />
          <CampaignWorkspace
            campaign={campaign}
            onBack={() => onModeChange({ kind: 'list' })}
            onEdit={() => onModeChange({ kind: 'builder', draft: campaign, editing: true })}
            onDelete={() => {
              onDelete(campaign.id);
              onModeChange({ kind: 'list' });
            }}
            onOpenPost={(postId) => onOpenPost(campaign, postId)}
            onPostStatus={(postId, status) => onPostStatus(campaign.id, postId, status)}
          />
        </>
      );
    }
  }

  return (
    <div className="cv">
      <div className="cv-head">
        <div>
          <h2 className="heading-md">Your Campaigns</h2>
          <p className="body-sm">Plan and manage coordinated content around your marketing goals.</p>
        </div>
        <button type="button" className="btn-primary btn-primary--sm" onClick={startNew}>
          <Plus size={15} aria-hidden="true" /> New Campaign
        </button>
      </div>

      <PreviewNotice />

      {campaigns.length === 0 ? (
        <div className="cb-empty cb-empty--lg">
          <span className="lib-empty-glyph" aria-hidden="true"><FolderKanban size={22} strokeWidth={1.75} /></span>
          <p className="cb-empty-title">Your next campaign starts here.</p>
          <p className="cb-empty-sub">Organize multiple posts around one market, goal, and marketing schedule.</p>
          <button type="button" className="btn-primary btn-primary--sm mt-3" onClick={startNew}>
            <Plus size={15} aria-hidden="true" /> New Campaign
          </button>
        </div>
      ) : (
        <>
          <div className="cv-filters">
            <label className="cv-search">
              <Search size={15} aria-hidden="true" />
              <span className="sr-only">Search campaigns</span>
              <input className="input input--sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search campaigns" />
            </label>
            <label>
              <span className="sr-only">Filter by market</span>
              <select className="input input--sm" value={market} onChange={(e) => setMarket(e.target.value)}>
                <option value="">All markets</option>
                {marketOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>

          {visible.length === 0 ? (
            <p className="cw-empty-line">No campaigns match those filters.</p>
          ) : (
            <ul className="cv-list">
              {visible.map((c) => {
                const reviewed = c.posts.filter((p) => p.status === 'reviewed').length;
                return (
                  <li key={c.id} className="cv-card">
                    <div className="cv-card-main">
                      <div className="cw-title-row">
                        <h3 className="cv-card-title">{c.name}</h3>
                        <span className="chip chip--muted">Unsaved draft</span>
                      </div>
                      <p className="cw-meta">
                        {objectiveLabel(c.objective)} · {c.marketName || 'Any market'} · {c.category}
                      </p>
                      <div className="cv-card-facts">
                        <span className="cw-plats">{c.platforms.map((p) => <PlatformIcon key={p} platform={p} />)}</span>
                        <span><CalendarRange size={14} aria-hidden="true" /> {dateRange(c)}</span>
                        <span className="num">{c.posts.length} planned post{c.posts.length === 1 ? '' : 's'}</span>
                        <span className="num">{reviewed}/{c.posts.length} reviewed</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-outline btn-outline--sm"
                      onClick={() => onModeChange({ kind: 'workspace', id: c.id })}
                      aria-label={`Open ${c.name}`}
                    >
                      Open
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
