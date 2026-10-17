/**
 * Stage 1 — the recommended strategy. One summary, then three short "why"
 * groups (market, platforms, timing and focus). Each shows the recommendation,
 * a sentence of reasoning and an evidence label; figures and limitations sit
 * behind View details, and Edit opens that group's controls in place.
 *
 * The campaign's own fields are the source of truth. When the owner changes
 * one, the group says so and keeps CeView's original recommendation one click
 * away, so overriding never loses it.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, CalendarRange, Megaphone, Pencil, Send, SlidersHorizontal, Target, Undo2 } from 'lucide-react';
import type { BusinessProfile, Market } from '@/types';
import MarketFlagIcon from '../../../module-2/2.1-dashboard/MarketFlagIcon';
import { PlatformIcon } from '../ContentBoard';
import { STUDIO_PLATFORMS } from '../contentStudioTypes';
import { classifyMarket, recommendMarket } from './campaignRecommendations';
import {
  EVIDENCE_LABELS,
  OBJECTIVES,
  OPPORTUNITY_LABELS,
  addDays,
  dateRange,
  daysBetween,
  durationLabel,
  objectiveLabel,
} from './campaignTypes';
import type { CampaignDraft, CampaignObjective, EvidenceKind } from './campaignTypes';

type Group = 'market' | 'platforms' | 'timing';

interface StrategyReviewProps {
  campaign: CampaignDraft;
  onChange: (campaign: CampaignDraft) => void;
  markets: Market[];
  profile: BusinessProfile;
  today: string;
  onContinue: () => void;
}

export function EvidenceChip({ kind }: { kind: EvidenceKind }) {
  return <span className="cp-evidence" data-kind={kind}>{EVIDENCE_LABELS[kind]}</span>;
}

function Details({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <details className="cp-details">
      <summary>View details</summary>
      <ul>
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </details>
  );
}

function WhyGroup({
  icon,
  title,
  headline,
  why,
  evidence,
  details,
  overridden,
  onRestore,
  editing,
  onToggleEdit,
  children,
}: {
  icon: ReactNode;
  title: string;
  headline: ReactNode;
  why: string;
  evidence: EvidenceKind;
  details: string[];
  overridden: string | null;
  onRestore: () => void;
  editing: boolean;
  onToggleEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className="cp-why" aria-label={title}>
      <header className="cp-why-head">
        <span className="cp-why-icon" aria-hidden="true">{icon}</span>
        <h3 className="cp-why-title">{title}</h3>
        <EvidenceChip kind={overridden ? 'owner' : evidence} />
        <button type="button" className="cp-edit" aria-expanded={editing} onClick={onToggleEdit}>
          <Pencil size={13} aria-hidden="true" /> {editing ? 'Done' : 'Edit'}
          <span className="sr-only"> {title.toLowerCase()}</span>
        </button>
      </header>
      <p className="cp-why-value">{headline}</p>
      {overridden ? (
        <p className="cp-why-text">
          You changed this. CeView recommended {overridden}.{' '}
          <button type="button" className="link-inline" onClick={onRestore}>
            <Undo2 size={12} aria-hidden="true" /> Use the recommendation
          </button>
        </p>
      ) : (
        <p className="cp-why-text">{why}</p>
      )}
      <Details lines={details} />
      {editing && <div className="cp-why-edit">{children}</div>}
    </section>
  );
}

export default function StrategyReview({ campaign: c, onChange, markets, profile, today, onContinue }: StrategyReviewProps) {
  const [open, setOpen] = useState<Record<Group, boolean>>({ market: false, platforms: false, timing: false });
  const s = c.strategy;
  if (!s) return null;

  const patch = (p: Partial<CampaignDraft>) => onChange({ ...c, ...p });
  const toggle = (g: Group) => setOpen((o) => ({ ...o, [g]: !o[g] }));
  const customizeAll = () => setOpen({ market: true, platforms: true, timing: true });

  const label = (id: string) => STUDIO_PLATFORMS.find((p) => p.id === id)?.label ?? id;
  const weeks = Math.max(1, Math.round((daysBetween(c.startDate, c.endDate) + 1) / 7));
  const services = profile.coreServices.map((x) => x.trim()).filter(Boolean);

  const marketChanged = c.marketId !== s.market.value.id;
  const platformsChanged = [...c.platforms].sort().join() !== [...s.platforms.value].sort().join();
  const timingChanged =
    c.startDate !== s.timing.value.startDate ||
    c.endDate !== s.timing.value.endDate ||
    c.postsPerWeek !== s.timing.value.postsPerWeek ||
    c.objective !== s.objective.value ||
    c.focus.join() !== s.focus.value.join();

  // Details follow the market actually chosen, so an override shows its own figures.
  const marketRec = (marketChanged && recommendMarket(markets, c.category, today, c.marketId)) || s.market;
  const pickedMarket = markets.find((m) => m.id === c.marketId);
  const opportunity = pickedMarket ? classifyMarket(pickedMarket, today) : s.market.value.opportunity;

  return (
    <section className="cp-stage" aria-labelledby="cp-strategy-title">
      <header className="cp-stage-head">
        <h2 id="cp-strategy-title" className="cp-stage-title">Your Recommended Campaign</h2>
        <p className="cp-stage-sub">
          Here&rsquo;s the strategy CeView recommends for your business. Review it before preparing your content.
        </p>
      </header>

      <div className="cp-summary">
        <label className="cp-summary-name">
          <span className="sr-only">Campaign name</span>
          <input className="cp-name-input" value={c.name} onChange={(e) => patch({ name: e.target.value })} aria-label="Campaign name" />
          <Pencil size={14} aria-hidden="true" />
        </label>
        <dl className="cp-summary-facts">
          <div>
            <dt>Objective</dt>
            <dd>{objectiveLabel(c.objective)}</dd>
          </div>
          <div>
            <dt>Target market</dt>
            <dd className="cp-market">
              <MarketFlagIcon name={c.marketName} /> {c.marketName}
            </dd>
          </div>
          <div>
            <dt>Platforms</dt>
            <dd className="cp-plats">
              {c.platforms.map((p) => <PlatformIcon key={p} platform={p} />)}
              <span>{c.platforms.map(label).join(', ')}</span>
            </dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>
              {durationLabel(c)} <span className="cp-summary-meta">{dateRange(c)}</span>
            </dd>
          </div>
        </dl>
      </div>

      <h3 className="cp-section-title">Why CeView recommends this</h3>
      <div className="cp-why-grid">
        <WhyGroup
          icon={<Target size={17} />}
          title="Market opportunity"
          headline={
            <>
              {c.marketName} <span className="cp-why-tag">{OPPORTUNITY_LABELS[opportunity]}</span>
            </>
          }
          why={s.market.why}
          evidence={s.market.evidence}
          details={marketRec.details}
          overridden={marketChanged ? s.market.value.name : null}
          onRestore={() => patch({ marketId: s.market.value.id, marketName: s.market.value.name })}
          editing={open.market}
          onToggleEdit={() => toggle('market')}
        >
          <label className="cb-field">
            <span>Target market</span>
            <select
              className="input"
              value={c.marketId}
              onChange={(e) => {
                const m = markets.find((x) => x.id === e.target.value);
                if (m) patch({ marketId: m.id, marketName: m.name });
              }}
            >
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {OPPORTUNITY_LABELS[classifyMarket(m, today)].toLowerCase()}
                </option>
              ))}
            </select>
          </label>
        </WhyGroup>

        <WhyGroup
          icon={<Send size={16} />}
          title="Platform choice"
          headline={c.platforms.map(label).join(' + ')}
          why={s.platforms.why}
          evidence={s.platforms.evidence}
          details={s.platforms.details}
          overridden={platformsChanged ? s.platforms.value.map(label).join(' + ') : null}
          onRestore={() => patch({ platforms: s.platforms.value })}
          editing={open.platforms}
          onToggleEdit={() => toggle('platforms')}
        >
          <div className="cb-chips" role="group" aria-label="Campaign platforms">
            {STUDIO_PLATFORMS.map((p) => {
              const on = c.platforms.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="cb-chip"
                  aria-pressed={on}
                  // At least one platform: the plan has to post somewhere.
                  disabled={on && c.platforms.length === 1}
                  onClick={() => patch({ platforms: on ? c.platforms.filter((x) => x !== p.id) : [...c.platforms, p.id] })}
                >
                  <PlatformIcon platform={p.id} />
                  {p.label}
                </button>
              );
            })}
          </div>
        </WhyGroup>

        <WhyGroup
          icon={<CalendarRange size={16} />}
          title="Timing and focus"
          headline={
            <>
              {durationLabel(c)}, {c.postsPerWeek} post{c.postsPerWeek === 1 ? '' : 's'} a week
              {c.focus.length > 0 && <> · featuring {c.focus.join(' and ')}</>}
            </>
          }
          why={`${s.timing.why} ${s.focus.why}`}
          evidence={s.timing.evidence}
          details={[`Objective — ${objectiveLabel(s.objective.value)}: ${s.objective.why}`, ...s.timing.details, ...s.focus.details]}
          overridden={timingChanged ? `${s.timing.value.postsPerWeek} posts a week from ${s.timing.value.startDate}, ${objectiveLabel(s.objective.value).toLowerCase()}` : null}
          onRestore={() =>
            patch({
              startDate: s.timing.value.startDate,
              endDate: s.timing.value.endDate,
              postsPerWeek: s.timing.value.postsPerWeek,
              objective: s.objective.value,
              focus: s.focus.value,
            })
          }
          editing={open.timing}
          onToggleEdit={() => toggle('timing')}
        >
          <div className="cp-edit-grid">
            <label className="cb-field">
              <span>Objective</span>
              <select className="input" value={c.objective} onChange={(e) => patch({ objective: e.target.value as CampaignObjective })}>
                {OBJECTIVES.filter((o) => o.id !== 'offer' || c.offer).map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="cb-field">
              <span>Start date</span>
              <input
                className="input"
                type="date"
                value={c.startDate}
                min={today}
                onChange={(e) => e.target.value && patch({ startDate: e.target.value, endDate: addDays(e.target.value, weeks * 7 - 1) })}
              />
            </label>
            <label className="cb-field">
              <span>Length</span>
              <select className="input" value={weeks} onChange={(e) => patch({ endDate: addDays(c.startDate, Number(e.target.value) * 7 - 1) })}>
                {[1, 2, 3, 4, 5, 6, 8].map((w) => (
                  <option key={w} value={w}>{w} week{w === 1 ? '' : 's'}</option>
                ))}
              </select>
            </label>
            <label className="cb-field">
              <span>Posts a week</span>
              <select className="input" value={c.postsPerWeek} onChange={(e) => patch({ postsPerWeek: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            {services.length > 0 && (
              <div className="cb-field cp-edit-wide" role="group" aria-label="Services to feature">
                <span>Feature</span>
                <div className="cb-chips">
                  {services.map((sv) => {
                    const on = c.focus.includes(sv);
                    return (
                      <button
                        key={sv}
                        type="button"
                        className="cb-chip"
                        aria-pressed={on}
                        onClick={() => patch({ focus: on ? c.focus.filter((x) => x !== sv) : [...c.focus, sv] })}
                      >
                        {sv}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </WhyGroup>
      </div>

      {c.offer && (
        <p className="cp-hint">
          <Megaphone size={14} aria-hidden="true" /> The plan ends on the offer you confirmed: <b>{c.offer}</b>.
        </p>
      )}

      <footer className="cp-foot">
        <button type="button" className="btn-outline btn-outline--sm" onClick={customizeAll}>
          <SlidersHorizontal size={15} aria-hidden="true" /> Customize Strategy
        </button>
        <button type="button" className="btn-primary" onClick={onContinue} disabled={!c.name.trim() || !c.platforms.length}>
          Looks Good — Continue <ArrowRight size={16} aria-hidden="true" />
        </button>
      </footer>
    </section>
  );
}
