/**
 * One campaign after the guided flow: Overview | Posts | Calendar | Results.
 * Frontend-only (see campaignTypes.ts).
 *
 * Every status shown is derived from what the post actually has (prepState),
 * and the calendar keeps Scheduled and Published visibly separate from the
 * planned dates — nothing here has reached either, because campaign
 * scheduling and publishing are not connected. Results shows no numbers it
 * does not have.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BarChart3, Lightbulb, Pencil, Trash2, Undo2 } from 'lucide-react';
import type { ContentResponse } from '@/types';
import MarketFlagIcon from '../../../module-2/2.1-dashboard/MarketFlagIcon';
import { PlatformIcon } from '../ContentBoard';
import { STUDIO_PLATFORMS } from '../contentStudioTypes';
import PreparePostDrawer from './PreparePostDrawer';
import { PREP_ACTION } from './PreparePosts';
import { EvidenceChip } from './StrategyReview';
import {
  CALENDAR_LABELS,
  PREP_LABELS,
  activePosts,
  calendarState,
  dateRange,
  durationLabel,
  formatDate,
  formatShortDate,
  objectiveLabel,
  prepState,
  sortedPosts,
} from './campaignTypes';
import type { CampaignDraft, PlannedPost } from './campaignTypes';

type Tab = 'overview' | 'posts' | 'calendar' | 'results';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'posts', label: 'Posts' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'results', label: 'Results' },
];

interface CampaignWorkspaceProps {
  campaign: CampaignDraft;
  content: ContentResponse | null;
  onBack: () => void;
  onEditPlan: () => void;
  onDelete: () => void;
  onPatchPost: (postId: string, patch: Partial<PlannedPost>) => void;
}

export default function CampaignWorkspace({ campaign: c, content, onBack, onEditPlan, onDelete, onPatchPost }: CampaignWorkspaceProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [openId, setOpenId] = useState<string | null>(null);
  const [shownId, setShownId] = useState<string | null>(null);

  const all = sortedPosts(c.posts);
  const posts = activePosts(all);
  const total = posts.length;
  const approved = posts.filter((p) => p.status === 'approved').length;
  const nextPost = posts.find((p) => prepState(p) !== 'approved') ?? null;
  const shown = c.posts.find((p) => p.id === shownId) ?? null;
  const platforms = c.platforms.map((p) => STUDIO_PLATFORMS.find((s) => s.id === p)?.label ?? p).join(', ');

  const open = (id: string) => {
    setShownId(id);
    setOpenId(id);
  };

  const byMonth = posts.reduce<Record<string, PlannedPost[]>>((acc, p) => {
    (acc[p.date.slice(0, 7)] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="cw">
      <button type="button" className="link-back" onClick={onBack}>
        <ArrowLeft size={15} aria-hidden="true" /> All campaigns
      </button>

      <header className="cw-head">
        <div className="cw-head-main">
          <div className="cw-title-row">
            <h2 className="cw-title">{c.name}</h2>
            <span className="chip chip--muted">Session draft</span>
          </div>
          <p className="cw-meta">
            {objectiveLabel(c.objective)} · {c.marketName || 'Any market'} · {dateRange(c)}
          </p>
        </div>
        <div className="cw-actions">
          <button type="button" className="btn-outline btn-outline--sm" onClick={onEditPlan}>
            <Pencil size={14} aria-hidden="true" /> Edit plan
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Delete campaign"
            onClick={() => {
              if (window.confirm(`Delete “${c.name}”? This can’t be undone.`)) onDelete();
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="studio-subtabs" role="tablist" aria-label="Campaign sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`cw-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`cw-panel-${t.id}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section role="tabpanel" id={`cw-panel-${tab}`} aria-labelledby={`cw-tab-${tab}`} className="cw-panel">
        {tab === 'overview' && (
          <div className="cw-overview">
            <div className="cw-card">
              <h3 className="cw-card-title">Campaign</h3>
              <dl className="cb-facts">
                <div><dt>Objective</dt><dd>{objectiveLabel(c.objective)}</dd></div>
                <div><dt>Target market</dt><dd className="cp-market"><MarketFlagIcon name={c.marketName} /> {c.marketName || 'Any market'}</dd></div>
                <div>
                  <dt>Platforms</dt>
                  <dd className="cp-plats">{c.platforms.map((p) => <PlatformIcon key={p} platform={p} />)} <span>{platforms}</span></dd>
                </div>
                <div><dt>Duration</dt><dd>{durationLabel(c)} · {dateRange(c)}</dd></div>
              </dl>
              {c.description && <p className="cw-message">{c.description}</p>}
            </div>

            <div className="cw-card">
              <h3 className="cw-card-title">Progress</h3>
              <p className="cw-progress-line">
                <b className="num">{approved}</b> of <b className="num">{total}</b> posts approved
              </p>
              <span className="bar" aria-hidden="true">
                <i style={{ width: `${total ? (approved / total) * 100 : 0}%` }} />
              </span>
              <div className="cw-next">
                <p className="cp-box-label">Next action</p>
                {nextPost ? (
                  <button type="button" className="cw-next-btn" onClick={() => open(nextPost.id)}>
                    <span>
                      <b>{PREP_ACTION[prepState(nextPost)]}</b> — {nextPost.topic || 'Untitled post'}
                      <em>{formatDate(nextPost.date)}</em>
                    </span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <p className="cw-empty-line">{total ? 'Every post is approved.' : 'Add posts with Edit plan.'}</p>
                )}
              </div>
            </div>

            {c.strategy && (
              <div className="cw-card cw-card--wide">
                <h3 className="cw-card-title">
                  <Lightbulb size={15} aria-hidden="true" /> Why this campaign
                </h3>
                <ul className="cw-why">
                  <li><EvidenceChip kind={c.strategy.market.evidence} /> {c.strategy.market.why}</li>
                  <li><EvidenceChip kind={c.strategy.platforms.evidence} /> {c.strategy.platforms.why}</li>
                  <li><EvidenceChip kind={c.strategy.timing.evidence} /> {c.strategy.timing.why}</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === 'posts' &&
          (all.length === 0 ? (
            <div className="cb-empty">
              <p className="cb-empty-title">No posts in this campaign</p>
              <p className="cb-empty-sub">Use Edit plan to add posts.</p>
            </div>
          ) : (
            <table className="cw-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Post</th>
                  <th scope="col">Platform</th>
                  <th scope="col">Preparation</th>
                  <th scope="col">Review</th>
                  <th scope="col"><span className="sr-only">Next action</span></th>
                </tr>
              </thead>
              <tbody>
                {all.map((p) => {
                  const st = prepState(p);
                  return (
                    <tr key={p.id} data-prep={st}>
                      <td className="num">{formatShortDate(p.date)}</td>
                      <td className="cw-topic">{p.topic || 'Untitled post'}</td>
                      <td><PlatformIcon platform={p.platform} /></td>
                      <td><span className="cp-status" data-prep={st}>{PREP_LABELS[st]}</span></td>
                      <td className="cw-review">{st === 'approved' ? 'Approved' : st === 'skipped' ? '—' : 'Not approved'}</td>
                      <td>
                        {st === 'skipped' ? (
                          <button type="button" className="btn-outline btn-outline--sm" onClick={() => onPatchPost(p.id, { status: 'accepted' })}>
                            <Undo2 size={13} aria-hidden="true" /> Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-outline btn-outline--sm"
                            onClick={() => open(p.id)}
                            aria-label={`${PREP_ACTION[st]}: ${p.topic || 'post'}`}
                          >
                            {PREP_ACTION[st]}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}

        {tab === 'calendar' && (
          <div className="cw-cal">
            <ul className="cw-legend" aria-label="Calendar states">
              {(['planned', 'prepared', 'approved'] as const).map((s) => (
                <li key={s} data-cal={s}>
                  <i aria-hidden="true" /> {CALENDAR_LABELS[s]}
                </li>
              ))}
              <li data-cal="off"><i aria-hidden="true" /> Scheduled — not connected yet</li>
              <li data-cal="off"><i aria-hidden="true" /> Published — not connected yet</li>
            </ul>
            <p className="cb-note">
              These are planned dates, not automatic schedules. Campaign posts aren&rsquo;t added to your publishing
              Calendar yet. <Link to="/calendar" className="link-inline">Open Calendar</Link>
            </p>
            {total === 0 ? (
              <p className="cw-empty-line">No dates planned yet.</p>
            ) : (
              Object.entries(byMonth).map(([month, list]) => (
                <div key={month} className="cw-month">
                  <h3 className="cw-card-title">
                    {new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </h3>
                  <ul className="cb-review-list">
                    {list.map((p) => (
                      <li key={p.id} data-cal={calendarState(p)}>
                        <span className="num">{formatShortDate(p.date)}</span>
                        <PlatformIcon platform={p.platform} />
                        <span className="cb-review-topic">{p.topic || 'Untitled post'}</span>
                        <span className="cp-cal-chip" data-cal={calendarState(p)}>{CALENDAR_LABELS[calendarState(p)]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'results' && (
          <div className="cb-empty">
            <span className="lib-empty-glyph" aria-hidden="true"><BarChart3 size={20} strokeWidth={1.75} /></span>
            <p className="cb-empty-title">No campaign results yet</p>
            <p className="cb-empty-sub">
              Campaign posts aren&rsquo;t published from here yet, so there&rsquo;s nothing to measure. Results for posts
              you&rsquo;ve published and your ad campaigns are in Performance.
            </p>
            <Link to="/performance" className="btn-outline btn-outline--sm mt-3">Go to Performance</Link>
          </div>
        )}
      </section>

      <PreparePostDrawer
        post={shown}
        open={openId != null}
        onClose={() => setOpenId(null)}
        onPatch={(patch) => shown && onPatchPost(shown.id, patch)}
        content={content}
      />
    </div>
  );
}
