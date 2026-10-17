/**
 * The two reads the campaign planner makes, both through existing endpoints:
 * the category's market ranking (the same read Content Studio and the
 * dashboard use) and the caption generator (the same call Quick Post makes).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../../services/apiClient';
import type { BusinessProfile, ContentResponse, Market } from '@/types';
import type { MarketOpportunity } from './campaignTypes';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export function useCategoryMarkets(category: string) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!category) return;
    let cancelled = false;
    setState('loading');
    setError(null);
    apiClient.markets
      .forCategory(category)
      .then((list) => {
        if (cancelled) return;
        setMarkets(list);
        setState('ready');
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e);
        setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [category, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { markets, state, error, retry };
}

/**
 * Generated caption sets per campaign, kept for the session. Each campaign
 * holds a pool: the first set fills the plan, and later sets — fetched only
 * when the owner asks for a caption the pool has run out of — add to it, so
 * regenerating one post never disturbs the others.
 */
export function useCaptionPool() {
  const [pools, setPools] = useState<Record<string, ContentResponse[]>>({});
  const poolsRef = useRef(pools);
  poolsRef.current = pools;

  const generate = useCallback(
    async (campaignId: string, input: { marketId: string; opportunity: MarketOpportunity; profile: BusinessProfile }) => {
      const result = await apiClient.content.generate({
        market: input.marketId,
        businessName: input.profile.businessName,
        description: input.profile.description,
        categories: input.profile.categories,
        // The same two values Quick Post sends: is this market surging now.
        trend: input.opportunity === 'surge' ? 'surging' : 'steady',
      });
      setPools((p) => ({ ...p, [campaignId]: [...(p[campaignId] ?? []), result] }));
      return result;
    },
    [],
  );

  const reset = useCallback((campaignId: string) => {
    setPools((p) => ({ ...p, [campaignId]: [] }));
  }, []);

  /** Every generated set for a campaign merged into one, for lookups. */
  const merged = useCallback((campaignId: string): ContentResponse | null => {
    const list = poolsRef.current[campaignId] ?? [];
    if (!list.length) return null;
    const [first, ...rest] = list;
    const captions = { ...first.captions };
    for (const r of rest) {
      for (const key of Object.keys(captions) as (keyof ContentResponse['captions'])[]) {
        captions[key] = {
          optionNames: [...captions[key].optionNames, ...r.captions[key].optionNames],
          options: [...captions[key].options, ...r.captions[key].options],
          optionMetadata: [...captions[key].optionMetadata, ...r.captions[key].optionMetadata],
          guide: [...new Set([...captions[key].guide, ...r.captions[key].guide])],
        };
      }
    }
    return { ...first, captions };
  }, []);

  return { pools, generate, reset, merged };
}
