import { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, Copy, ExternalLink, Megaphone } from 'lucide-react';
import Drawer from '../../shared/Drawer';
import { apiClient } from '../../../services/apiClient';
import type { AdCostRates, AttributionLink, DemandAlert, Market } from '../../../types';
import { buildAdPlan, GOAL_LABEL, PLATFORM_LABEL } from './adPlan';
import type { AdGoal, AdPlatform } from './adPlan';

export interface AdPlannerDrawerProps {
  open: boolean;
  onClose: () => void;
  alert: DemandAlert;
  market: Market;
  caption: string;
  mediaDataUrl: string | null;
  link: AttributionLink | null;
}

/** A sensible first target per goal — the expert's example was 5,000 people. */
const DEFAULT_TARGET: Record<AdGoal, number> = { reach: 5000, traffic: 100, messages: 20 };

const peso = (n: number) => `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

/**
 * "Promote as an ad" (CVW-43): for operators who have never used Meta or
 * TikTok Ads Manager. They say what they want in plain terms; CeView fills in
 * every Ads Manager field and walks them through it, one copyable value at a
 * time. A drawer, not a modal, so it can stay open beside Ads Manager.
 */
export default function AdPlannerDrawer({ open, onClose, alert, market, caption, mediaDataUrl, link }: AdPlannerDrawerProps) {
  const ids = useId();
  const [goal, setGoal] = useState<AdGoal>('reach');
  const [platform, setPlatform] = useState<AdPlatform>('meta');
  const [target, setTarget] = useState(String(DEFAULT_TARGET.reach));
  const [rates, setRates] = useState<AdCostRates | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  // Both lookups are optional context: without them the plan still works, it
  // just has no budget estimate or no code in the campaign name.
  useEffect(() => {
    if (!open) return;
    let live = true;
    apiClient.campaign
      .costRates()
      .then((r) => live && setRates(r))
      .catch(() => live && setRates(null));
    apiClient.attribution
      .codes()
      .then((codes) => {
        if (!live) return;
        const opens = alert.windowOpenDate ? new Date(alert.windowOpenDate).getTime() : null;
        const match = codes.find((c) =>
          c.category === alert.category
          && c.targetMarket.toLowerCase() === market.id.toLowerCase()
          && (opens === null || new Date(c.windowStart).getTime() === opens));
        setCode(match?.code ?? null);
      })
      .catch(() => live && setCode(null));
    return () => {
      live = false;
    };
  }, [open, alert.category, alert.windowOpenDate, market.id]);

  const plan = useMemo(
    () => buildAdPlan({
      goal,
      platform,
      target: Math.max(0, Number(target) || 0),
      marketId: market.id,
      marketName: market.name,
      windowOpenDate: alert.windowOpenDate,
      caption,
      mediaDataUrl,
      link,
      code,
      rates,
    }),
    [goal, platform, target, market.id, market.name, alert.windowOpenDate, caption, mediaDataUrl, link, code, rates],
  );

  // A different goal or platform is a different walkthrough.
  useEffect(() => setDone(new Set()), [goal, platform]);

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1600);
    } catch {
      setCopied(null);
    }
  };

  const toggleDone = (index: number) =>
    setDone((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  return (
    <Drawer open={open} onClose={onClose} label="Promote as an ad">
      <div className="flex flex-col gap-6">
        {/* pr-12 keeps the intro clear of the drawer's floating Close button. */}
        <div className="flex items-start gap-3 pr-12">
          <span className="conn-ico shrink-0" aria-hidden="true"><Megaphone /></span>
          <div>
            <h2 className="heading-md">Promote as an ad</h2>
            <p className="body-sm mt-1">
              Say what you want. CeView fills in every Ads Manager field for {market.name} — you copy each one in.
            </p>
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="field-label">What do you want?</legend>
          {(Object.keys(GOAL_LABEL) as AdGoal[]).map((g) => (
            <label
              key={g}
              className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border px-3 py-2.5 ${goal === g ? 'border-[var(--color-mint-primary)] bg-[var(--color-mint-pale-alt)]' : 'border-gray-light'}`}
            >
              <input
                type="radio"
                name={`${ids}-goal`}
                value={g}
                checked={goal === g}
                onChange={() => {
                  setGoal(g);
                  setTarget(String(DEFAULT_TARGET[g]));
                }}
                className="mt-1 accent-[var(--color-mint-primary)]"
              />
              <span className="flex flex-col">
                <span className="body-sm font-semibold text-navy-dark">{GOAL_LABEL[g].title}</span>
                <span className="body-xs text-[var(--color-text-muted)]">{GOAL_LABEL[g].hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${ids}-target`} className="field-label">
              How many {GOAL_LABEL[goal].unit} in {market.name}?
            </label>
            <input
              id={`${ids}-target`}
              className="input"
              type="number"
              min={1}
              step={1}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          <fieldset>
            <legend className="field-label">Where?</legend>
            <div className="flex gap-2" role="group">
              {(Object.keys(PLATFORM_LABEL) as AdPlatform[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={platform === p}
                  onClick={() => setPlatform(p)}
                  className={platform === p ? 'btn-primary btn-primary--sm' : 'btn-outline btn-outline--sm'}
                >
                  {PLATFORM_LABEL[p]}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {!plan.available ? (
          <p role="status" className="body-sm rounded-[var(--radius-sm)] bg-[var(--color-mint-pale-alt)] px-4 py-3">
            {plan.unavailableReason}
          </p>
        ) : (
          <>
            <section aria-label="Your ad plan" className="rounded-[var(--radius-md)] border border-gray-light p-4">
              <h3 className="heading-sm">Your ad plan</h3>
              <dl className="body-sm mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                <dt className="text-[var(--color-text-muted)]">Objective</dt>
                <dd className="font-semibold text-navy-dark">{plan.objective}</dd>
                <dt className="text-[var(--color-text-muted)]">Runs</dt>
                <dd>{plan.startDate} → {plan.endDate} ({plan.days} days, the surge window)</dd>
                <dt className="text-[var(--color-text-muted)]">Budget</dt>
                <dd>
                  {plan.budget ? (
                    <>
                      <span className="font-semibold text-navy-dark">{peso(plan.budget.daily)} a day</span>
                      {' '}— {plan.budget.atLeast ? 'at least' : 'about'} {peso(plan.budget.total)} in total
                      <span className="body-xs block text-[var(--color-text-muted)]">
                        {plan.budget.basis}
                        {plan.budget.atLeast && ' People often see an ad more than once, so reaching them all can cost more.'}
                      </span>
                    </>
                  ) : (
                    <span className="body-xs text-[var(--color-text-muted)]">{plan.budgetNote}</span>
                  )}
                </dd>
                {code && (
                  <>
                    <dt className="text-[var(--color-text-muted)]">Code</dt>
                    <dd className="font-mono font-semibold text-navy-dark">{code}</dd>
                  </>
                )}
              </dl>
              {plan.warnings.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {plan.warnings.map((w) => (
                    <li key={w} className="body-xs flex items-start gap-1.5 text-[var(--color-critical-text)]">
                      <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-label="Step-by-step guide" className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="heading-sm">Step by step in {PLATFORM_LABEL[platform]}</h3>
                <span className="body-xs text-[var(--color-text-muted)]">{done.size} of {plan.steps.length} done</span>
              </div>
              <ol className="flex flex-col gap-3">
                {plan.steps.map((step, i) => {
                  const isDone = done.has(i);
                  return (
                    <li
                      key={step.title}
                      className={`rounded-[var(--radius-sm)] border px-4 py-3 ${isDone ? 'border-[var(--color-mint-primary)] bg-[var(--color-mint-pale-alt)]' : 'border-gray-light'}`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => toggleDone(i)}
                          aria-label={`Mark "${step.title}" done`}
                          className="mt-1 accent-[var(--color-mint-primary)]"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="body-sm font-semibold text-navy-dark">{i + 1}. {step.title}</p>
                          <p className="body-xs mt-0.5">{step.detail}</p>
                          {step.fields.length > 0 && (
                            <dl className="mt-2 flex flex-col gap-1.5">
                              {step.fields.map((f) => {
                                const key = `${i}-${f.label}`;
                                return (
                                  <div key={f.label} className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-white px-3 py-1.5">
                                    <dt className="body-xs w-28 shrink-0 text-[var(--color-text-muted)]">{f.label}</dt>
                                    <dd className="body-xs min-w-0 flex-1 whitespace-pre-wrap break-words text-navy-dark">{f.value}</dd>
                                    {f.copy && (
                                      <button
                                        type="button"
                                        onClick={() => copy(key, f.value)}
                                        aria-label={`Copy ${f.label}`}
                                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-mint-pale)]"
                                      >
                                        {copied === key ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </dl>
                          )}
                          {step.href && (
                            <a
                              href={step.href}
                              target="_blank"
                              rel="noreferrer"
                              className="body-xs mt-2 inline-flex items-center gap-1 font-semibold text-navy-dark underline-offset-2 hover:underline"
                            >
                              Open {platform === 'meta' ? 'Meta' : 'TikTok'} Ads Manager <ExternalLink size={12} aria-hidden="true" />
                            </a>
                          )}
                          {step.route && (
                            <Link
                              to={step.route}
                              className="body-xs mt-2 inline-flex items-center gap-1 font-semibold text-navy-dark underline-offset-2 hover:underline"
                            >
                              Open Settings → Platforms
                            </Link>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="body-xs text-[var(--color-text-muted)]">
                Ads Manager screens change from time to time. If a field has moved, look for the same name nearby.
              </p>
            </section>
          </>
        )}
      </div>
    </Drawer>
  );
}
