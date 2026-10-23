import { describe, expect, it } from 'vitest';
import { resultFindings } from './resultFindings';
import type { Metrics } from './campaignTypes';

const base: Metrics = { roas: 4, convRate: 12, cac: 300, ctr: 6, cpc: 10 };

function run(metrics: Partial<Metrics>, label = 'Good Performance', flagged: Parameters<typeof resultFindings>[0]['flagged'] = []) {
  return resultFindings({ metrics: { ...base, ...metrics }, flagged, label, money: '₱', periodLabel: 'Oct 5 – Oct 11, 2026' });
}

describe('resultFindings', () => {
  it('names the strongest result from the real metrics', () => {
    const good = run({ convRate: 15 }).find((f) => f.tone === 'good');
    expect(good?.title).toBe('Strongest: Conversion rate');
    expect(good?.text).toContain('15.00%');
  });

  it('says a good score is not profit when ROAS is under 1×', () => {
    const concern = run({ roas: 0.12 }).find((f) => f.tone === 'concern');
    expect(concern?.title).toMatch(/aren.t paying for themselves/);
    expect(concern?.text).toContain('Good Performance');
    expect(concern?.text).toContain('0.12×');
  });

  it('does not make that claim when the overall score is not good', () => {
    const findings = run({ roas: 0.12 }, 'Fair Performance');
    expect(findings.some((f) => /paying for themselves/.test(f.title))).toBe(false);
  });

  it('leaves out a metric that could not be worked out, and says why', () => {
    const findings = run({ roas: 0 }, 'Good Performance', ['ROAS']);
    expect(findings.some((f) => /Return on ad spend|paying for themselves/.test(f.title))).toBe(false);
    expect(findings.find((f) => f.tone === 'note')?.text).toMatch(/ROAS needs a figure that was zero/);
  });

  it('states what period the figures cover', () => {
    const note = run({}).find((f) => f.tone === 'note');
    expect(note?.text).toContain('Oct 5 – Oct 11, 2026');
    expect(note?.text).toMatch(/last 4 saved periods/);
  });
});
