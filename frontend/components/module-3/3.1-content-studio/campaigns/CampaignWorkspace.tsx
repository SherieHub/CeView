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
import { AppLink } from '../../../../layout/shellContext';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CheckCircle2,
  ImageIcon,
  Layers,
  Lightbulb,
  Megaphone,
  PenLine,
  Pencil,
  ShieldCheck,
  Target,
  Trash2,
  Undo2,
  Users,
  Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { ContentResponse } from '@/types';
import MarketFlagIcon from '../../../module-2/2.1-dashboard/MarketFlagIcon';
import { LandingImage } from '../../../landing/ui';
import { BrandMark, PlatformIcon } from '../ContentBoard';
import './campaign-workspace.css';
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
import type { CampaignDraft, PlannedPost, PrepState } from './campaignTypes';

/** The icon that says what the next step involves. */
const NEXT_ICON: Partial<Record<PrepState, ReactNode>> = {
  'needs-media': <ImageIcon size={18} />,
  'needs-caption': <PenLine size={18} />,
  'needs-audit': <ShieldCheck size={18} />,
  'audit-failed': <ShieldCheck size={18} />,
  ready: <CheckCircle2 size={18} />,
};

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="cw2-fact">
      <span className="cw2-fact-icon" aria-hidden="true">{icon}</span>
      <div>
        <dt>{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}

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
      {/* A banner rather than a plain header: the campaign's name over a
          photo of the coast it is selling — the screen's anchor. */}
      <header className="cw2-hero">
        <div className="cw2-hero-photo" aria-hidden="true">
          <LandingImage slot="how-lagoon" fill decorative sizes="(max-width: 767px) 100vw, 60vw" />
        </div>
        <div className="cw2-hero-body">
          <button type="button" className="cw2-back" onClick={onBack}>
            <ArrowLeft size={14} aria-hidden="true" /> All campaigns
          </button>
          <div className="cw2-hero-title-row">
            <h2 className="cw2-hero-title">{c.name}</h2>
            <span className="cw2-hero-chip">Session draft</span>
          </div>
          <p className="cw2-hero-meta">
            {objectiveLabel(c.objective)} · {c.marketName || 'Any market'} · {dateRange(c)}
          </p>
        </div>
        <div className="cw2-hero-actions">
          <button type="button" className="cw2-hero-btn" onClick={onEditPlan}>
            <Pencil size={14} aria-hidden="true" /> Edit plan
          </button>
          <button
            type="button"
            className="cw2-hero-icon"
            aria-label="Delete campaign"
            onClick={() => {
              if (window.confirm(`Delete “${c.name}”? This can’t be undone.`)) onDelete();
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="studio-subtabs cw2-tabs" role="tablist" aria-label="Campaign sections">
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
          <div className="cw2-overview">
            <section className="cw2-card" aria-labelledby="cw2-campaign-title">
              <header className="cw2-card-head">
                <span className="cw2-card-icon" aria-hidden="true"><Megaphone size={20} /></span>
                <div>
                  <h3 id="cw2-campaign-title" className="cw2-card-title">Campaign</h3>
                  <p className="cw2-card-sub">Key details for this campaign at a glance.</p>
                </div>
              </header>
              <dl className="cw2-facts">
                <Fact icon={<Target size={18} />} label="Objective">{objectiveLabel(c.objective)}</Fact>
                <Fact icon={<Users size={18} />} label="Target market">
                  <span className="cw2-inline"><MarketFlagIcon name={c.marketName} /> {c.marketName || 'Any market'}</span>
                </Fact>
                <Fact icon={<CalendarDays size={18} />} label="Duration">{durationLabel(c)} · {dateRange(c)}</Fact>
                <Fact icon={<Layers size={18} />} label="Platforms">
                  <span className="cw2-inline">
                    {c.platforms.map((p) => <BrandMark key={p} platform={p} />)}
                    <span>{platforms}</span>
                  </span>
                </Fact>
              </dl>
              {c.description && <p className="cw-message">{c.description}</p>}
            </section>

            <section className="cw2-card" aria-labelledby="cw2-progress-title">
              <header className="cw2-card-head">
                <span className="cw2-card-icon" aria-hidden="true"><ChartNoAxesColumnIncreasing size={20} /></span>
                <div>
                  <h3 id="cw2-progress-title" className="cw2-card-title">Progress</h3>
                  <p className="cw2-card-sub">Track your content approvals for this campaign.</p>
                </div>
              </header>
              <p className="cw2-progress-line">
                <b className="num">{approved}</b> of <b className="num">{total}</b> posts approved
              </p>
              <span className="cw2-bar" aria-hidden="true">
                <i style={{ width: `${total ? (approved / total) * 100 : 0}%` }} />
              </span>
              <div className="cw2-next">
                <p className="cw2-next-title">
                  <Zap size={15} aria-hidden="true" /> Next action
                </p>
                {nextPost ? (
                  <button type="button" className="cw2-next-btn" onClick={() => open(nextPost.id)}>
                    <span className="cw2-next-icon" aria-hidden="true">{NEXT_ICON[prepState(nextPost)] ?? <PenLine size={18} />}</span>
                    <span className="cw2-next-text">
                      <span><b>{PREP_ACTION[prepState(nextPost)]}</b> — {nextPost.topic || 'Untitled post'}</span>
                      <em>{formatDate(nextPost.date)}</em>
                    </span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                ) : (
                  <p className="cw-empty-line">{total ? 'Every post is approved.' : 'Add posts with Edit plan.'}</p>
                )}
              </div>
            </section>

            {c.strategy && (
              <section className="cw2-why" aria-labelledby="cw2-why-title">
                <header className="cw2-card-head">
                  <span className="cw2-why-icon" aria-hidden="true"><Lightbulb size={19} /></span>
                  <div>
                    <h3 id="cw2-why-title" className="cw2-card-title">Why this campaign</h3>
                    <p className="cw2-card-sub">Insights based on market demand and your current content.</p>
                  </div>
                </header>
                <ul className="cw2-why-list">
                  {[c.strategy.market, c.strategy.platforms, c.strategy.timing].map((rec) => (
                    <li key={rec.why}>
                      <EvidenceChip kind={rec.evidence} />
                      <p>{rec.why}</p>
                    </li>
                  ))}
                </ul>
              </section>
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
              Calendar yet. <AppLink to="/calendar" className="link-inline">Open Calendar</AppLink>
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
            <AppLink to="/performance" className="btn-outline btn-outline--sm mt-3">Go to Performance</AppLink>
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
