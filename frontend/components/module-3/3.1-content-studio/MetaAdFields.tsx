/**
 * The Meta ad details in the Publish window: objective, who the ad is aimed at, budget and schedule.
 *
 * The audience follows the forecast: the country (and the language, where the market has one) come
 * from the market the operator is writing for and are shown, not edited. What the operator adds is
 * interests, picked from Meta's own catalogue. Every rule is checked as the operator goes (see
 * `adProblems`); the server checks them again.
 */
import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
import {
  AD_DURATION_PRESETS, AD_OBJECTIVES, MAX_AD_INTERESTS, adEndTime, adTotalMinor, formatMinor, marketAudience, minorFactor,
} from './adRules';
import type {
  AdInterest, AdInterestOption, AdMinimumBudget, AdSpendLimits, AttributionLink, PublishAd,
} from '../../../types';

export interface MetaAdFieldsProps {
  ad: PublishAd;
  onChange: (patch: Partial<PublishAd>) => void;
  /** The forecast market the post is for; decides the country and language. */
  market?: string;
  currency: string | null;
  limits: AdSpendLimits | null;
  minimum: AdMinimumBudget | null;
  links: AttributionLink[];
  /** The business's categories and services: what suggested interests are searched from. */
  interestSeeds: string[];
  /** Everything wrong with the ad as it stands. */
  problems: string[];
  /** A load failure (the ad settings could not be read at all). */
  setupError: string | null;
}

const SUGGESTION_SEEDS = 3;
const SUGGESTIONS_PER_SEED = 2;
const SEARCH_DEBOUNCE_MS = 300;

export default function MetaAdFields({
  ad, onChange, market, currency, limits, minimum, links, interestSeeds, problems, setupError,
}: MetaAdFieldsProps) {
  const audience = marketAudience(market);
  const factor = minorFactor(currency);
  const [budgetText, setBudgetText] = useState(ad.dailyBudgetMinor ? String(ad.dailyBudgetMinor / factor) : '');
  // The currency arrives after the panel opens; if it changes the scale (centavos vs whole yen), show
  // the saved budget in the right units without remounting the panel and losing what is being typed.
  useEffect(() => {
    setBudgetText(ad.dailyBudgetMinor ? String(ad.dailyBudgetMinor / factor) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factor]);
  const [customDays, setCustomDays] = useState(!(AD_DURATION_PRESETS as readonly number[]).includes(ad.durationDays));
  const [daysText, setDaysText] = useState(String(ad.durationDays));

  const dailyLimit = limits?.configured ? limits.maxDailyMinor : null;
  const remaining = limits?.configured && limits.maxTotalMinor != null ? Math.max(0, limits.maxTotalMinor - limits.committedMinor) : null;
  const minimumMinor = minimum && currency && minimum.currency.toUpperCase() === currency.toUpperCase() ? minimum.minDailyMinor : null;
  const total = adTotalMinor(ad);
  const validDays = Number.isInteger(ad.durationDays) && ad.durationDays >= 1;

  return (
    <fieldset className="pubx-group">
      <legend>Meta ad details</legend>
      {setupError && <p className="pubx-ad-callout" role="alert">{setupError}</p>}
      <div className="pubx-ad">
        <label className="pubx-field pubx-field--wide">
          <span>Objective</span>
          <select value={ad.objective} onChange={(e) => onChange({ objective: e.target.value as PublishAd['objective'] })}>
            {AD_OBJECTIVES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <small className="pubx-sub">{AD_OBJECTIVES.find((o) => o.value === ad.objective)?.hint}</small>
        </label>

        <div className="pubx-audience pubx-field--wide" role="group" aria-label="Audience">
          <p className="pubx-audience-title">Audience</p>
          <p className="pubx-audience-line">
            <span>Country</span>
            <strong>{audience ? audience.countryName : 'No forecast market'}</strong>
          </p>
          <p className="pubx-audience-line">
            <span>Language</span>
            <strong>{!audience ? '—' : audience.language ? `People using Facebook in ${audience.language}` : 'No language limit'}</strong>
          </p>
          <p className="pubx-sub">
            Set by the forecast for this market, so the ad reaches the travellers the forecast is about.
          </p>
          <InterestPicker selected={ad.interests} onChange={(interests) => onChange({ interests })} seeds={interestSeeds} />
          <label className="pubx-check">
            <input type="checkbox" checked={ad.advantageAudience} onChange={(e) => onChange({ advantageAudience: e.target.checked })} />
            <span>Let Meta find more people (Advantage+ audience). Your interests become suggestions Meta may go beyond.</span>
          </label>
        </div>

        <label className="pubx-field pubx-field--wide">
          <span>Daily budget{currency ? ` (${currency})` : ''}</span>
          <input
            type="number" inputMode="decimal" min={1 / factor} step={1 / factor} placeholder="0" value={budgetText}
            onChange={(e) => {
              setBudgetText(e.target.value);
              const minor = Math.round(Number(e.target.value) * factor);
              onChange({ dailyBudgetMinor: Number.isFinite(minor) ? minor : 0 });
            }}
          />
          <small className="pubx-sub">
            {[
              minimumMinor != null && currency ? `Meta's minimum: more than ${formatMinor(minimumMinor, currency)}` : null,
              dailyLimit != null && currency ? `Your daily limit: ${formatMinor(dailyLimit, currency)}` : null,
            ].filter(Boolean).join(' · ')}
          </small>
        </label>

        <label className="pubx-field pubx-field--wide">
          <span>Ad starts</span>
          <input
            type="datetime-local"
            value={new Date(Date.parse(ad.startTime) - new Date(ad.startTime).getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
            onChange={(e) => e.target.value && onChange({ startTime: new Date(e.target.value).toISOString() })}
          />
        </label>

        <fieldset className="pubx-length pubx-field--wide">
          <legend>How long it runs</legend>
          <div className="pubx-length-options">
            {AD_DURATION_PRESETS.map((days) => (
              <label key={days} className="pubx-pill-radio">
                <input
                  type="radio" name="ad-length" checked={!customDays && ad.durationDays === days}
                  onChange={() => { setCustomDays(false); setDaysText(String(days)); onChange({ durationDays: days }); }}
                />
                <span>{days} days</span>
              </label>
            ))}
            <label className="pubx-pill-radio">
              <input type="radio" name="ad-length" checked={customDays} onChange={() => setCustomDays(true)} />
              <span>Custom</span>
            </label>
            {customDays && (
              <input
                className="pubx-days" type="number" inputMode="numeric" min={1} step={1} aria-label="Number of days"
                value={daysText}
                onChange={(e) => { setDaysText(e.target.value); onChange({ durationDays: e.target.value === '' ? Number.NaN : Number(e.target.value) }); }}
              />
            )}
          </div>
          {validDays && (
            <small className="pubx-sub">
              Ends {new Date(adEndTime(ad.startTime, ad.durationDays)).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              {currency && total > 0 ? ` · About ${formatMinor(total, currency)} in total` : ''}
              {currency && remaining != null ? ` · ${formatMinor(remaining, currency)} left of your total limit` : ''}
            </small>
          )}
        </fieldset>

        <label className="pubx-field pubx-field--wide">
          <span>Campaign tracking link</span>
          <select value={ad.attributionLinkId} onChange={(e) => onChange({ attributionLinkId: e.target.value })}>
            <option value="">Choose a campaign</option>
            {ad.attributionLinkId && !links.some((l) => l.linkId === ad.attributionLinkId) && <option value={ad.attributionLinkId}>Current market campaign</option>}
            {links.map((link) => <option key={link.linkId} value={link.linkId}>{link.targetMarket} · {link.category} · {link.windowStart.slice(0, 10)}</option>)}
          </select>
        </label>
        <p className="pubx-hint pubx-field--wide">Use the tracking link created in Content Studio. The ad remains paused until you launch it in Ads Manager.</p>
        <label className="pubx-check pubx-field--wide">
          <input type="checkbox" checked={ad.pinCampaign} onChange={(e) => onChange({ pinCampaign: e.target.checked })} />
          <span>Use this campaign in Performance reports</span>
        </label>

        {problems.length > 0 && (
          <div className="pubx-hint pubx-field--wide" data-error role="alert">
            <ul className="pubx-problems">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}
      </div>
    </fieldset>
  );
}

/** Interests chosen from Meta's own search, with suggestions drawn from the business's own words. */
function InterestPicker({ selected, onChange, seeds }: { selected: AdInterest[]; onChange: (next: AdInterest[]) => void; seeds: string[] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdInterestOption[]>([]);
  const [suggestions, setSuggestions] = useState<AdInterestOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const seedKey = seeds.join('|');
  const full = selected.length >= MAX_AD_INTERESTS;

  useEffect(() => {
    let cancelled = false;
    const picked = seeds.filter(Boolean).slice(0, SUGGESTION_SEEDS);
    Promise.allSettled(picked.map((seed) => apiClient.adConnections.searchInterests(seed))).then((settled) => {
      if (cancelled) return;
      const seen = new Set<string>();
      const found = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value.slice(0, SUGGESTIONS_PER_SEED) : []))
        .filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
      setSuggestions(found);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) { setResults([]); setSearchError(false); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      apiClient.adConnections.searchInterests(text)
        .then((found) => { if (!cancelled) { setResults(found); setSearchError(false); } })
        .catch(() => { if (!cancelled) { setResults([]); setSearchError(true); } })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, SEARCH_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const chosen = new Set(selected.map((i) => i.id));
  const add = (option: AdInterestOption) => {
    if (full || chosen.has(option.id)) return;
    onChange([...selected, { id: option.id, name: option.name }]);
  };
  const offer = (list: AdInterestOption[]) => list.filter((i) => !chosen.has(i.id));

  return (
    <div className="pubx-interests">
      <p className="pubx-audience-title">Interests <span className="pubx-sub">(optional, up to {MAX_AD_INTERESTS})</span></p>
      {selected.length > 0 && (
        <ul className="pubx-chips" aria-label="Chosen interests">
          {selected.map((i) => (
            <li key={i.id} className="pubx-chip">
              {i.name}
              <button type="button" aria-label={`Remove ${i.name}`} onClick={() => onChange(selected.filter((x) => x.id !== i.id))}>
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {offer(suggestions).length > 0 && !full && (
        <div className="pubx-suggest">
          <span className="pubx-sub">Suggested for your business</span>
          <ul className="pubx-chips">
            {offer(suggestions).map((i) => (
              <li key={i.id}><button type="button" className="pubx-chip pubx-chip--add" title={i.path} onClick={() => add(i)}>+ {i.name}</button></li>
            ))}
          </ul>
        </div>
      )}
      <label className="pubx-search">
        <Search size={14} aria-hidden="true" />
        <input
          type="search" aria-label="Search Meta interests" placeholder="Search Meta interests, e.g. scuba diving" value={query}
          onChange={(e) => setQuery(e.target.value)} disabled={full}
        />
      </label>
      {full && <p className="pubx-sub">You have chosen the most Meta allows ({MAX_AD_INTERESTS}). Remove one to add another.</p>}
      {searching && <p className="pubx-sub" role="status">Searching Meta…</p>}
      {searchError && <p className="pubx-sub" data-error role="status">Could not search Meta interests. Try again in a moment.</p>}
      {!searching && !searchError && query.trim().length >= 2 && results.length === 0 && <p className="pubx-sub" role="status">No interests found.</p>}
      {offer(results).length > 0 && !full && (
        <ul className="pubx-results" aria-label="Interest results">
          {offer(results).map((i) => (
            <li key={i.id}>
              <button type="button" aria-label={`Add ${i.name}`} onClick={() => add(i)}>
                <span>{i.name}</span>
                {i.path && <small>{i.path}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
