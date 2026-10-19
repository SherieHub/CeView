import { describe, expect, it } from 'vitest';
import { buildAdPlan, campaignDates, estimateBudget, shortAdText } from './adPlan';
import type { AdPlanInput } from './adPlan';
import { mockLinks } from '../../../services/fixtures/attributionLinks';
import type { AdCostRates } from '../../../types';

const RATES: AdCostRates = {
  periods: 4,
  totalSpend: 4000,
  totalImpressions: 50000,
  totalClicks: 1000,
  costPerThousandImpressions: 80,
  costPerClick: 4,
};

const TODAY = new Date('2026-10-19T02:00:00Z'); // 10:00 in Manila

function input(overrides: Partial<AdPlanInput> = {}): AdPlanInput {
  return {
    goal: 'reach',
    platform: 'meta',
    target: 5000,
    marketId: 'korea',
    marketName: 'South Korea',
    windowOpenDate: '2026-10-26T00:00:00+08:00',
    caption: '모알보알에서 정어리 떼와 함께 다이빙하세요!\n\n예약 시 코드 KR-DIVE-1026 를 말씀해 주세요.',
    mediaDataUrl: 'data:image/png;base64,AAA',
    link: mockLinks()[0],
    code: 'KR-DIVE-1026',
    rates: RATES,
    today: TODAY,
    ...overrides,
  };
}

describe('campaignDates', () => {
  it('runs across an upcoming surge window, in Manila dates', () => {
    // Midnight in Manila is 16:00 UTC the day before; the date must not slip.
    expect(campaignDates('2026-10-26T00:00:00+08:00', TODAY)).toEqual({
      startDate: '2026-10-26', endDate: '2026-11-09', days: 14,
    });
  });

  it('starts today when the window is already open, and still ends with it', () => {
    expect(campaignDates('2026-10-12T00:00:00+08:00', TODAY)).toMatchObject({
      startDate: '2026-10-19', endDate: '2026-10-26',
    });
  });

  it('gives a closed or undated window a full run from today', () => {
    expect(campaignDates('2026-08-01T00:00:00+08:00', TODAY).days).toBe(14);
    expect(campaignDates(null, TODAY)).toMatchObject({ startDate: '2026-10-19', days: 14 });
  });
});

describe('estimateBudget', () => {
  it('estimates reach from the operator’s own cost per 1,000 views, as a floor', () => {
    // 5,000 views at ₱80 per 1,000 = ₱400; over 14 days, rounded up to ₱30 a day.
    expect(estimateBudget('reach', 5000, RATES, 14)).toMatchObject({ total: 400, daily: 30, atLeast: true });
  });

  it('estimates visits from the operator’s own cost per click', () => {
    expect(estimateBudget('traffic', 100, RATES, 14)).toMatchObject({ total: 400, atLeast: false });
  });

  it('gives no estimate without history, or for messages, rather than inventing one', () => {
    expect(estimateBudget('reach', 5000, null, 14)).toBeNull();
    expect(estimateBudget('reach', 5000, { ...RATES, costPerThousandImpressions: null }, 14)).toBeNull();
    expect(estimateBudget('messages', 20, RATES, 14)).toBeNull();
  });
});

describe('shortAdText', () => {
  it('keeps the opening line and always the code, within the limit', () => {
    const long = 'A'.repeat(140);
    const text = shortAdText(long, 'KR-DIVE-1026');
    expect(text.length).toBeLessThanOrEqual(100);
    expect(text.endsWith('Code KR-DIVE-1026')).toBe(true);
  });
});

describe('buildAdPlan', () => {
  it('fills in a Meta reach plan with the tracked link split into URL and parameters', () => {
    const plan = buildAdPlan(input());
    expect(plan.available).toBe(true);
    expect(plan.objective).toBe('Awareness');
    const fields = plan.steps.flatMap((s) => s.fields);
    const value = (label: string) => fields.find((f) => f.label === label)?.value;
    expect(value('Location')).toBe('South Korea');
    expect(value('Language')).toBe('Korean');
    expect(value('Daily budget')).toBe('30');
    expect(value('Website URL')).toBe(mockLinks()[0].urls.linkUrl);
    expect(value('URL parameters')).toContain('ad={{ad.id}}');
    expect(value('Campaign name')).toContain('KR-DIVE-1026');
    expect(plan.steps.at(-1)?.route).toBe('/settings/platforms');
  });

  it('warns about image media and long text on TikTok, and shortens the text', () => {
    const plan = buildAdPlan(input({ platform: 'tiktok', caption: 'B'.repeat(150) }));
    expect(plan.objective).toBe('Reach');
    expect(plan.warnings.join(' ')).toMatch(/need a video/);
    expect(plan.warnings.join(' ')).toMatch(/limited to about 100 characters/);
    const adText = plan.steps.flatMap((s) => s.fields).find((f) => f.label === 'Ad text')?.value ?? '';
    expect(adText.length).toBeLessThanOrEqual(100);
    expect(plan.steps.flatMap((s) => s.fields).find((f) => f.label === 'Destination URL')?.value)
      .toBe(mockLinks()[0].urls.tiktokAdUrl);
  });

  it('refuses plans it cannot honestly make', () => {
    expect(buildAdPlan(input({ platform: 'tiktok', goal: 'messages' })).available).toBe(false);
    const noLink = buildAdPlan(input({ goal: 'traffic', link: null }));
    expect(noLink.available).toBe(false);
    expect(noLink.unavailableReason).toMatch(/need a link/);
  });

  it('routes message ads to Messenger and explains the missing estimate', () => {
    const plan = buildAdPlan(input({ goal: 'messages' }));
    expect(plan.objective).toBe('Engagement');
    expect(plan.budget).toBeNull();
    expect(plan.budgetNote).toMatch(/no past message-ad results/);
    expect(plan.steps.some((s) => s.fields.some((f) => f.label === 'Website URL'))).toBe(false);
    expect(plan.steps[1].detail).toMatch(/Messaging apps/);
  });
});
