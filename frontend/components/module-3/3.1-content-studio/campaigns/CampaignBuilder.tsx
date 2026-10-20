/**
 * Manual campaign planning — the fallback to CeView's recommended campaign,
 * for owners who want to start from scratch (or when recommendations can't be
 * generated). Three steps: Brief, Content plan, Review. Frontend-only (see
 * campaignTypes.ts): "Save campaign" keeps the plan for this session; nothing
 * is persisted, scheduled or published.
 *
 * Posts are prepared afterwards in the campaign workspace, with the same
 * media upload and Compliance Audit the recommended flow uses.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Info, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../../../../services/apiClient';
import { STUDIO_PLATFORMS } from '../contentStudioTypes';
import type { StudioPlatformId } from '../contentStudioTypes';
import { PlatformIcon } from '../ContentBoard';
import type { Market } from '@/types';
import { OBJECTIVES, blankPost, dateRange, formatDate, objectiveLabel, sortedPosts } from './campaignTypes';
import type { CampaignDraft, CampaignObjective, PlannedPost } from './campaignTypes';

const STEPS = [
  { id: 'brief', label: 'Brief' },
  { id: 'plan', label: 'Content plan' },
  { id: 'review', label: 'Review' },
] as const;
type StepId = (typeof STEPS)[number]['id'];

interface CampaignBuilderProps {
  initial: CampaignDraft;
  categories: string[];
  /** True when editing a campaign already kept this session. */
  editing: boolean;
  onCancel: () => void;
  /** Keep the plan for this session and open its workspace. */
  onSave: (campaign: CampaignDraft) => void;
}

function briefProblem(c: CampaignDraft): string | null {
  if (!c.name.trim()) return 'Give your campaign a name.';
  if (!c.platforms.length) return 'Choose at least one platform.';
  if (!c.startDate || !c.endDate) return 'Set a start and end date.';
  if (c.endDate < c.startDate) return 'The end date must be on or after the start date.';
  return null;
}

export default function CampaignBuilder({ initial, categories, editing, onCancel, onSave }: CampaignBuilderProps) {
  const [c, setC] = useState<CampaignDraft>(initial);
  const [step, setStep] = useState<StepId>('brief');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketsState, setMarketsState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const patch = (p: Partial<CampaignDraft>) => setC((cur) => ({ ...cur, ...p }));

  // The market list for the chosen category — the same read the studio uses.
  useEffect(() => {
    if (!c.category) return;
    let cancelled = false;
    setMarketsState('loading');
    apiClient.markets
      .forCategory(c.category)
      .then((list) => {
        if (cancelled) return;
        setMarkets(list);
        setMarketsState('ready');
      })
      .catch(() => {
        if (!cancelled) setMarketsState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [c.category]);

  const problem = briefProblem(c);
  const index = STEPS.findIndex((s) => s.id === step);
  const posts = useMemo(() => sortedPosts(c.posts), [c.posts]);

  const togglePlatform = (id: StudioPlatformId) =>
    patch({ platforms: c.platforms.includes(id) ? c.platforms.filter((p) => p !== id) : [...c.platforms, id] });

  const addPost = () => patch({ posts: [...c.posts, blankPost(c)] });
  const updatePost = (id: string, p: Partial<PlannedPost>) =>
    patch({ posts: c.posts.map((post) => (post.id === id ? { ...post, ...p } : post)) });
  const removePost = (id: string) => patch({ posts: c.posts.filter((post) => post.id !== id) });

  // Steps after the brief need a valid brief; the plan can be empty.
  const canGo = (target: StepId) => target === 'brief' || problem == null;

  return (
    <div className="cb">
      <div className="cb-top">
        <button type="button" className="link-back" onClick={onCancel}>
          <ArrowLeft size={15} aria-hidden="true" /> {editing ? 'Back to campaign' : 'Back to campaigns'}
        </button>
        <nav className="cb-steps" aria-label="Campaign builder progress">
          <ol>
            {STEPS.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  data-state={s.id === step ? 'current' : i < index ? 'done' : 'todo'}
                  aria-current={s.id === step ? 'step' : undefined}
                  disabled={!canGo(s.id)}
                  onClick={() => setStep(s.id)}
                >
                  <span className="cb-step-no" aria-hidden="true">{i + 1}</span>
                  {s.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {step === 'brief' && (
        <section className="cb-panel" aria-labelledby="cb-brief-title">
          <header className="cb-head">
            <h2 id="cb-brief-title" className="cb-title">Plan Your Campaign</h2>
            <p className="cb-sub">Define who you want to reach and what you want to achieve.</p>
          </header>

          <fieldset className="cb-group">
            <legend>Campaign identity</legend>
            <div className="cb-grid">
              <label className="cb-field">
                <span>Campaign name</span>
                <input className="input" value={c.name} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. Golden Week Escapes" />
              </label>
              <label className="cb-field">
                <span>Objective</span>
                <select className="input" value={c.objective} onChange={(e) => patch({ objective: e.target.value as CampaignObjective })}>
                  {OBJECTIVES.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset className="cb-group">
            <legend>Audience &amp; market</legend>
            <div className="cb-grid">
              <label className="cb-field">
                <span>Tourism category</span>
                <select
                  className="input"
                  value={c.category}
                  onChange={(e) => patch({ category: e.target.value, marketId: '', marketName: '' })}
                >
                  {categories.length === 0 && <option value="">No categories on your profile</option>}
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </label>
              <label className="cb-field">
                <span>Target market <em className="cb-opt">optional</em></span>
                <select
                  className="input"
                  value={c.marketId}
                  disabled={marketsState !== 'ready'}
                  onChange={(e) => {
                    const m = markets.find((x) => x.id === e.target.value);
                    patch({ marketId: m?.id ?? '', marketName: m?.name ?? '' });
                  }}
                >
                  <option value="">
                    {marketsState === 'loading' ? 'Loading markets…' : marketsState === 'error' ? 'Markets unavailable' : 'Any market'}
                  </option>
                  {markets.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset className="cb-group">
            <legend>Distribution</legend>
            <div className="cb-grid">
              <div className="cb-field" role="group" aria-label="Platforms">
                <span>Platforms</span>
                <div className="cb-chips">
                  {STUDIO_PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="cb-chip"
                      aria-pressed={c.platforms.includes(p.id)}
                      onClick={() => togglePlatform(p.id)}
                    >
                      <PlatformIcon platform={p.id} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="cb-dates">
                <label className="cb-field">
                  <span>Start date</span>
                  <input className="input" type="date" value={c.startDate} onChange={(e) => patch({ startDate: e.target.value })} />
                </label>
                <label className="cb-field">
                  <span>End date</span>
                  <input className="input" type="date" value={c.endDate} min={c.startDate} onChange={(e) => patch({ endDate: e.target.value })} />
                </label>
              </div>
            </div>
            <label className="cb-field cb-field--wide">
              <span>Campaign message <em className="cb-opt">optional</em></span>
              <textarea
                className="textarea"
                rows={3}
                value={c.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="What should travelers take away from this campaign?"
              />
            </label>
          </fieldset>
        </section>
      )}

      {step === 'plan' && (
        <section className="cb-panel" aria-labelledby="cb-plan-title">
          <header className="cb-head cb-head--row">
            <div>
              <h2 id="cb-plan-title" className="cb-title">Build Your Content Plan</h2>
              <p className="cb-sub">Organize posts around your campaign timeline and target audience.</p>
            </div>
            <button type="button" className="btn-outline btn-outline--sm" onClick={addPost}>
              <Plus size={15} aria-hidden="true" /> Add post
            </button>
          </header>

          <p className="cb-summary">
            <b>{c.name}</b> · {objectiveLabel(c.objective)} · {c.marketName || 'Any market'} · {dateRange(c)}
          </p>
          <p className="cb-note">
            <Info size={15} aria-hidden="true" /> Add the posts you plan to make. Want CeView to plan them for you? Go
            back and choose Generate My Campaign.
          </p>

          {c.posts.length === 0 ? (
            <div className="cb-empty">
              <p className="cb-empty-title">No posts planned yet</p>
              <p className="cb-empty-sub">Add a post for each moment in your campaign, then pick its platform and topic.</p>
            </div>
          ) : (
            <ol className="cb-plan">
              {posts.map((post, i) => (
                <li key={post.id} className="cb-plan-row">
                  <span className="cb-plan-no" aria-hidden="true">{i + 1}</span>
                  <label className="cb-field">
                    <span className="sr-only">Planned date for post {i + 1}</span>
                    <input
                      className="input"
                      type="date"
                      value={post.date}
                      min={c.startDate}
                      max={c.endDate}
                      onChange={(e) => updatePost(post.id, { date: e.target.value })}
                    />
                  </label>
                  <label className="cb-field">
                    <span className="sr-only">Platform for post {i + 1}</span>
                    <select className="input" value={post.platform} onChange={(e) => updatePost(post.id, { platform: e.target.value as StudioPlatformId })}>
                      {STUDIO_PLATFORMS.filter((p) => c.platforms.includes(p.id) || p.id === post.platform).map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="cb-field cb-plan-topic">
                    <span className="sr-only">Content direction for post {i + 1}</span>
                    <input
                      className="input"
                      value={post.topic}
                      onChange={(e) => updatePost(post.id, { topic: e.target.value })}
                      placeholder="Content direction, e.g. Sunrise dive teaser"
                    />
                  </label>
                  <button type="button" className="icon-btn" aria-label={`Remove post ${i + 1}`} onClick={() => removePost(post.id)}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {step === 'review' && (
        <section className="cb-panel" aria-labelledby="cb-review-title">
          <header className="cb-head">
            <h2 id="cb-review-title" className="cb-title">Review Your Campaign</h2>
            <p className="cb-sub">See your content plan and prepare the next steps.</p>
          </header>
          <dl className="cb-facts">
            <div><dt>Objective</dt><dd>{objectiveLabel(c.objective)}</dd></div>
            <div><dt>Market</dt><dd>{c.marketName || 'Any market'}</dd></div>
            <div><dt>Category</dt><dd>{c.category || '—'}</dd></div>
            <div><dt>Dates</dt><dd>{dateRange(c)}</dd></div>
            <div>
              <dt>Platforms</dt>
              <dd className="cb-plats">{c.platforms.map((p) => <PlatformIcon key={p} platform={p} />)}</dd>
            </div>
          </dl>
          {posts.length > 0 && (
            <ul className="cb-review-list">
              {posts.map((post) => (
                <li key={post.id}>
                  <span className="num">{formatDate(post.date)}</span>
                  <PlatformIcon platform={post.platform} />
                  <span className="cb-review-topic">{post.topic || 'Untitled post'}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="cb-note">
            <Info size={15} aria-hidden="true" /> Nothing here is scheduled or published automatically. Saving keeps
            this plan for this session only. You&rsquo;ll add photos, run the audit and approve each post in the
            campaign workspace.
          </p>
        </section>
      )}

      <div className="cb-foot">
        {index > 0 ? (
          <button type="button" className="btn-outline btn-outline--sm" onClick={() => setStep(STEPS[index - 1].id)}>
            <ArrowLeft size={15} aria-hidden="true" /> Back
          </button>
        ) : (
          <button type="button" className="btn-outline btn-outline--sm" onClick={onCancel}>Cancel</button>
        )}
        <div className="cb-foot-right">
          {step === 'brief' && problem && <span className="cb-problem" role="status">{problem}</span>}
          {index < STEPS.length - 1 ? (
            <button
              type="button"
              className="btn-primary btn-primary--sm"
              disabled={!canGo(STEPS[index + 1].id)}
              onClick={() => setStep(STEPS[index + 1].id)}
            >
              Continue <ArrowRight size={15} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary btn-primary--sm"
              disabled={problem != null}
              onClick={() => onSave({ ...c, stage: 'done', posts: c.posts.map((p) => (p.status === 'suggested' ? { ...p, status: 'accepted' } : p)) })}
            >
              Save campaign
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
