/**
 * One campaign: header plus Overview | Posts | Calendar | Results.
 * Frontend-only (see campaignTypes.ts). Calendar lists the plan's dates and
 * links to the real Calendar — planned posts are not written to it. Results
 * explains that campaign reporting isn't available rather than showing
 * numbers it does not have.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, CalendarDays, PenLine, Pencil, Trash2 } from 'lucide-react';
import { PlatformIcon } from '../ContentBoard';
import {
  POST_STATUSES,
  dateRange,
  formatDate,
  objectiveLabel,
  postStatusLabel,
  sortedPosts,
} from './campaignTypes';
import type { CampaignDraft, PlannedPostStatus } from './campaignTypes';

type Tab = 'overview' | 'posts' | 'calendar' | 'results';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'posts', label: 'Posts' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'results', label: 'Results' },
];

interface CampaignWorkspaceProps {
  campaign: CampaignDraft;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenPost: (postId: string) => void;
  onPostStatus: (postId: string, status: PlannedPostStatus) => void;
}

export default function CampaignWorkspace({ campaign: c, onBack, onEdit, onDelete, onOpenPost, onPostStatus }: CampaignWorkspaceProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const posts = sortedPosts(c.posts);
  const total = posts.length;
  const reviewed = posts.filter((p) => p.status === 'reviewed').length;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = posts.filter((p) => p.date >= today).slice(0, 3);

  const byMonth = posts.reduce<Record<string, typeof posts>>((acc, p) => {
    const key = p.date.slice(0, 7);
    (acc[key] ??= []).push(p);
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
            <span className="chip chip--muted">Unsaved draft</span>
          </div>
          <p className="cw-meta">
            {objectiveLabel(c.objective)} · {c.marketName || 'Any market'} · {dateRange(c)}
          </p>
          <div className="cw-plats" aria-label={`Platforms: ${c.platforms.join(', ')}`}>
            {c.platforms.map((p) => <PlatformIcon key={p} platform={p} />)}
          </div>
        </div>
        <div className="cw-actions">
          <button type="button" className="btn-outline btn-outline--sm" onClick={onEdit}>
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
              <h3 className="cw-card-title">Campaign details</h3>
              <dl className="cb-facts">
                <div><dt>Objective</dt><dd>{objectiveLabel(c.objective)}</dd></div>
                <div><dt>Target market</dt><dd>{c.marketName || 'Any market'}</dd></div>
                <div><dt>Category</dt><dd>{c.category || '—'}</dd></div>
                <div><dt>Dates</dt><dd>{dateRange(c)}</dd></div>
              </dl>
              {c.description && <p className="cw-message">{c.description}</p>}
            </div>
            <div className="cw-card">
              <h3 className="cw-card-title">Progress</h3>
              <p className="cw-progress-line">
                <b className="num">{reviewed}</b> of <b className="num">{total}</b> posts reviewed
              </p>
              <span className="bar" aria-hidden="true">
                <i style={{ width: `${total ? (reviewed / total) * 100 : 0}%` }} />
              </span>
              <div className="cb-tally cb-tally--sm">
                {POST_STATUSES.map((s) => (
                  <div key={s.id}>
                    <b className="num">{posts.filter((p) => p.status === s.id).length}</b>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="cw-card cw-card--wide">
              <h3 className="cw-card-title">Coming up</h3>
              {upcoming.length === 0 ? (
                <p className="cw-empty-line">No upcoming posts in this plan.</p>
              ) : (
                <ul className="cb-review-list">
                  {upcoming.map((p) => (
                    <li key={p.id}>
                      <span className="num">{formatDate(p.date)}</span>
                      <PlatformIcon platform={p.platform} />
                      <span className="cb-review-topic">{p.topic || 'Untitled post'}</span>
                      <span className="chip chip--muted">{postStatusLabel(p.status)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === 'posts' &&
          (total === 0 ? (
            <div className="cb-empty">
              <p className="cb-empty-title">No posts in this campaign</p>
              <p className="cb-empty-sub">Use Edit plan to add posts to your content plan.</p>
            </div>
          ) : (
            <table className="cw-table">
              <thead>
                <tr>
                  <th scope="col">Planned date</th>
                  <th scope="col">Content</th>
                  <th scope="col">Platform</th>
                  <th scope="col">Progress</th>
                  <th scope="col"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id}>
                    <td className="num">{formatDate(p.date)}</td>
                    <td className="cw-topic">{p.topic || 'Untitled post'}</td>
                    <td><PlatformIcon platform={p.platform} /></td>
                    <td>
                      <label>
                        <span className="sr-only">Progress for {p.topic || 'this post'}</span>
                        <select
                          className="input input--sm"
                          value={p.status}
                          onChange={(e) => onPostStatus(p.id, e.target.value as PlannedPostStatus)}
                        >
                          {POST_STATUSES.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>
                      </label>
                    </td>
                    <td>
                      <button type="button" className="btn-outline btn-outline--sm" onClick={() => onOpenPost(p.id)}>
                        <PenLine size={14} aria-hidden="true" /> Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}

        {tab === 'calendar' && (
          <div className="cw-cal">
            <p className="cb-note">
              <CalendarDays size={15} aria-hidden="true" /> Your plan by date. Planned campaign posts aren&rsquo;t added to
              your publishing Calendar yet.{' '}
              <Link to="/calendar" className="link-inline">Open Calendar</Link>
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
                      <li key={p.id}>
                        <span className="num">{formatDate(p.date)}</span>
                        <PlatformIcon platform={p.platform} />
                        <span className="cb-review-topic">{p.topic || 'Untitled post'}</span>
                        <span className="chip chip--muted">{postStatusLabel(p.status)}</span>
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
            <p className="cb-empty-title">Campaign reporting isn&rsquo;t available yet</p>
            <p className="cb-empty-sub">
              Results for individual published posts and ad campaigns are in Performance.
            </p>
            <Link to="/performance" className="btn-outline btn-outline--sm mt-3">Go to Performance</Link>
          </div>
        )}
      </section>
    </div>
  );
}
