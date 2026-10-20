import { describe, expect, it } from 'vitest';
import type { BusinessProfile, Market, PublishedPost } from '@/types';
import { MOCK_MARKETS } from '../../../../services/fixtures/markets';
import { MOCK_CONTENT } from '../../../../services/fixtures/content';
import { MOCK_POSTS } from '../../../../services/fixtures/posts';
import {
  buildPostPlan,
  buildStrategy,
  campaignFromStrategy,
  classifyMarket,
  forecastDirection,
  postAuditRecommendations,
  profileReadiness,
  recommendFocus,
  recommendMarket,
  recommendObjective,
  recommendPlatforms,
  recommendTiming,
} from './campaignRecommendations';
import { EMPTY_PREFERENCES } from './campaignTypes';

const TODAY = '2026-10-16';

const PROFILE: BusinessProfile = {
  businessProfileId: 'bp-1',
  businessName: 'Sunset Cove',
  categories: ['Coastal & Island'],
  coreServices: ['Guided dives', 'Island hopping tours'],
  description: 'A small dive resort in Moalboal.',
  uvp: 'The only eco-certified resort on this stretch of coast.',
  imagePreview: null,
  uniquenessScore: null,
  slogan: '',
  industry: '',
  vibes: [],
  website: '',
  logo: null,
  socials: {},
};

const calm = (m: Market): Market => ({
  ...m,
  surgeLevel: null,
  upliftPct: null,
  windowOpenDate: null,
  spikeIndicator: false,
  lowConfidence: false,
  seasonalityScore: 0.5,
  // Flat: recent weeks and forecast weeks at the same level.
  chartData: Array.from({ length: 12 }, (_, i) => ({
    week: `W${i}`,
    weekStartDate: null,
    history: i < 6 ? 50 : null,
    forecast: i >= 6 ? 50 : null,
    seasonality: null,
    spike: 0 as const,
  })),
});

const post = (platform: PublishedPost['platform'], engagementRate: number, status: PublishedPost['status'] = 'published'): PublishedPost => ({
  id: `${platform}-${engagementRate}-${Math.random()}`,
  date: '2026-09-01',
  platform,
  caption: '',
  status,
  reach: status === 'published' ? 1000 : 0,
  likes: 0,
  comments: 0,
  shares: 0,
  engagementRate,
  series: [],
});

describe('market recommendation', () => {
  it('does not describe an isolated measured spike as forecast growth', () => {
    expect(classifyMarket({ ...calm(MOCK_MARKETS[0]), spikeIndicator: true }, TODAY)).toBe('ranked');
  });
  it('classifies from the backend surge level first', () => {
    const korea = MOCK_MARKETS.find((m) => m.id === 'korea')!;
    expect(classifyMarket(korea, TODAY)).toBe('surge');
  });

  it('calls a rising forecast emerging, but not when its confidence is low', () => {
    const usa = MOCK_MARKETS.find((m) => m.id === 'usa')!;
    expect(forecastDirection(usa)!.changePct).toBeGreaterThan(5);
    expect(classifyMarket({ ...usa, lowConfidence: false }, TODAY)).toBe('emerging');
    expect(classifyMarket({ ...usa, lowConfidence: true }, TODAY)).not.toBe('emerging');
  });

  it('calls an upcoming peak month seasonal only with a moderate seasonality score', () => {
    const base = calm(MOCK_MARKETS[0]);
    expect(classifyMarket({ ...base, peakMonths: ['Nov'], seasonalityScore: 0.8 }, TODAY)).toBe('seasonal');
    expect(classifyMarket({ ...base, peakMonths: ['Nov'], seasonalityScore: 0.6 }, TODAY)).toBe('ranked');
    expect(classifyMarket({ ...base, peakMonths: ['Jun'], seasonalityScore: 0.9 }, TODAY)).toBe('ranked');
  });

  it('prefers a critical surge over a higher-ranked calm market', () => {
    const [a, b] = MOCK_MARKETS;
    const markets = [{ ...calm(a), rank: 1 }, { ...b, rank: 2, surgeLevel: 'CRITICAL' as const }];
    const rec = recommendMarket(markets, 'Coastal & Island', TODAY)!;
    expect(rec.value.id).toBe(b.id);
    expect(rec.evidence).toBe('demand');
    expect(rec.details.some((d) => /not confirmed bookings/.test(d))).toBe(true);
  });

  it('falls back to the backend rank as a general recommendation', () => {
    const markets = MOCK_MARKETS.map((m, i) => ({ ...calm(m), rank: i + 1 }));
    const rec = recommendMarket(markets, 'Coastal & Island', TODAY)!;
    expect(rec.value).toMatchObject({ id: markets[0].id, opportunity: 'ranked' });
    expect(rec.evidence).toBe('general');
  });

  it('honours the owner’s choice and labels it as theirs', () => {
    const rec = recommendMarket(MOCK_MARKETS, 'Coastal & Island', TODAY, 'usa')!;
    expect(rec.value.id).toBe('usa');
    expect(rec.evidence).toBe('owner');
  });

  it('returns nothing rather than inventing a market', () => {
    expect(recommendMarket([], 'Coastal & Island', TODAY)).toBeNull();
  });
});

describe('platform recommendation', () => {
  it('does not declare a winner when both platforms have zero engagement', () => {
    const posts = [...[0, 0, 0].map((r) => post('instagram', r)), ...[0, 0, 0].map((r) => post('facebook', r))];
    expect(recommendPlatforms(posts).value).toHaveLength(2);
  });
  it('ignores invalid engagement metrics', () => {
    expect(recommendPlatforms([post('instagram', NaN), post('facebook', Infinity)]).evidence).toBe('limited');
  });
  it('is an honest cold start when there are too few published posts', () => {
    const rec = recommendPlatforms(MOCK_POSTS);
    expect(rec.evidence).toBe('limited');
    expect(rec.why).toMatch(/doesn’t have enough of your published posts/);
  });

  it('picks the platform with the clearly higher median engagement rate, not the bigger reach', () => {
    const posts = [
      ...[9, 10, 11].map((r) => post('instagram', r)),
      ...[4, 5, 6].map((r) => ({ ...post('tiktok', r), reach: 99_000 })),
    ];
    const rec = recommendPlatforms(posts);
    expect(rec).toMatchObject({ value: ['instagram'], evidence: 'performance' });
    expect(rec.details.join(' ')).toMatch(/isn’t specific to one market/);
  });

  it('keeps both platforms when neither clearly leads', () => {
    const posts = [...[10, 10, 10].map((r) => post('instagram', r)), ...[9.5, 9.5, 9.5].map((r) => post('facebook', r))];
    expect(recommendPlatforms(posts).value).toEqual(['instagram', 'facebook']);
  });

  it('ignores drafts and posts without results', () => {
    const posts = [...[1, 2, 3].map((r) => post('tiktok', r, 'draft')), ...[9, 9, 9].map((r) => post('instagram', r))];
    expect(recommendPlatforms(posts).evidence).toBe('limited');
  });
});

describe('objective, focus and timing', () => {
  it('builds toward an offer only when the owner gave one', () => {
    expect(recommendObjective('surge', 'Japan', '').value).toBe('inquiries');
    expect(recommendObjective('surge', 'Japan', 'Free snorkel gear').value).toBe('offer');
  });

  it('features only services from the profile, category matches first', () => {
    const rec = recommendFocus(PROFILE, 'Coastal & Island');
    expect(rec.value[0]).toBe('Island hopping tours');
    expect(rec.value.every((v) => PROFILE.coreServices.includes(v))).toBe(true);
  });

  it('says so when the profile lists no services', () => {
    const rec = recommendFocus({ ...PROFILE, coreServices: [] }, 'Coastal & Island');
    expect(rec).toMatchObject({ value: [], evidence: 'limited' });
  });

  it('starts a surge campaign tomorrow and never claims an optimal posting time', () => {
    const korea = MOCK_MARKETS.find((m) => m.id === 'korea')!;
    const rec = recommendTiming(korea, 'surge', TODAY);
    expect(rec.value.startDate).toBe('2026-10-17');
    expect(rec.value.endDate).toBe('2026-10-30');
    expect(rec.details.join(' ')).toMatch(/don’t tell it the best day or hour/);
  });

  it('starts a seasonal campaign about two weeks before the peak month', () => {
    const m = { ...calm(MOCK_MARKETS[0]), peakMonths: ['Dec'], seasonalityScore: 0.8 };
    expect(recommendTiming(m, 'seasonal', TODAY).value.startDate).toBe('2026-11-17');
  });
});

describe('profile readiness', () => {
  it('blocks only on what generation needs', () => {
    expect(profileReadiness(PROFILE)).toEqual({ missing: [], limited: [] });
    expect(profileReadiness({ ...PROFILE, description: '' }).missing).toEqual(['Business description']);
    expect(profileReadiness({ ...PROFILE, coreServices: [], uvp: '' }).limited).toHaveLength(2);
  });
});

describe('content plan', () => {
  const strategy = buildStrategy({
    profile: PROFILE,
    category: 'Coastal & Island',
    markets: MOCK_MARKETS,
    posts: MOCK_POSTS,
    prefs: EMPTY_PREFERENCES,
    today: TODAY,
  })!;
  const campaign = campaignFromStrategy(strategy, 'Coastal & Island', EMPTY_PREFERENCES);

  it('runs from an introduction to a call to action, inside the campaign dates', () => {
    const posts = buildPostPlan({ campaign, profile: PROFILE, content: MOCK_CONTENT });
    expect(posts[0].purpose).toBe('Introduce');
    expect(posts.at(-1)!.purpose).toBe('Encourage action');
    expect(posts.every((p) => p.date >= campaign.startDate && p.date <= campaign.endDate)).toBe(true);
    expect(posts.every((p) => campaign.platforms.includes(p.platform))).toBe(true);
  });

  it('never repeats a generated caption, and leaves the rest blank rather than inventing one', () => {
    const posts = buildPostPlan({ campaign: { ...campaign, postsPerWeek: 5 }, profile: PROFILE, content: MOCK_CONTENT });
    const captions = posts.map((p) => p.caption).filter(Boolean);
    expect(new Set(captions).size).toBe(captions.length);
    expect(posts.filter((p) => p.captionOrigin === 'none').every((p) => p.caption === '')).toBe(true);
  });

  it('plans without captions when generation was unavailable', () => {
    const posts = buildPostPlan({ campaign, profile: PROFILE, content: null });
    expect(posts.every((p) => p.caption === '' && p.captionOrigin === 'none')).toBe(true);
    expect(posts.every((p) => p.visual.trim().length > 0)).toBe(true);
  });

  it('mentions an offer only when the owner confirmed one', () => {
    const plain = buildPostPlan({ campaign, profile: PROFILE, content: null });
    expect(plain.some((p) => /offer/i.test(p.topic))).toBe(false);
    const withOffer = buildPostPlan({ campaign: { ...campaign, offer: 'Free snorkel gear' }, profile: PROFILE, content: null });
    expect(withOffer.at(-1)!.topic).toBe('Your offer: Free snorkel gear');
  });

  it('gives the audit the caption option’s own recommendations plus the post’s visual', () => {
    const [first] = buildPostPlan({ campaign, profile: PROFILE, content: MOCK_CONTENT });
    const rec = postAuditRecommendations(MOCK_CONTENT, first)!;
    expect(rec.visual_guide).toContain(first.visual);
    expect(rec).toHaveProperty('core_business_context');
  });
});
