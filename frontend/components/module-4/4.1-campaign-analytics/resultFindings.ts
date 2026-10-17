/**
 * "What your results mean" — a few plain-language findings worked out from
 * this period's own metrics: the strongest result, the one that needs the
 * most attention, and what the numbers can't tell you. Rule-based on the
 * same normalisation the Performance Score uses (computeContributions), so a
 * finding never disagrees with the score; nothing here is AI-written.
 */
import { computeContributions } from './PesGauge';
import type { FlaggedMetric, Metrics } from './campaignTypes';

export interface Finding {
  tone: 'good' | 'concern' | 'note';
  title: string;
  text: string;
}

type Key = 'roas' | 'cr' | 'cac' | 'ctr' | 'cpc';

const NAMES: Record<Key, string> = {
  roas: 'Return on ad spend',
  cr: 'Conversion rate',
  cac: 'Customer acquisition cost',
  ctr: 'Click-through rate',
  cpc: 'Cost per click',
};

const FLAG_FOR: Record<Key, FlaggedMetric> = {
  roas: 'ROAS', cr: 'Conversion rate', cac: 'CAC', ctr: 'CTR', cpc: 'CPC',
};

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function describe(key: Key, m: Metrics, money: string): string {
  switch (key) {
    case 'roas': return `${fmt(m.roas)}× — ${money}${fmt(m.roas)} back for every ${money}1 spent on ads.`;
    case 'cr': return `${fmt(m.convRate)}% — bookings per 100 ad clicks.`;
    case 'cac': return `${money}${fmt(m.cac)} of ad spend per new customer.`;
    case 'ctr': return `${fmt(m.ctr)}% — clicks per 100 times your ads were shown.`;
    case 'cpc': return `${money}${fmt(m.cpc)} per ad click.`;
  }
}

export function resultFindings({ metrics, flagged, label, money, periodLabel }: {
  metrics: Metrics;
  flagged: FlaggedMetric[];
  label: string;
  money: string;
  periodLabel: string | null;
}): Finding[] {
  const scored = computeContributions(metrics)
    .map((c) => ({ key: c.key as Key, normalized: c.normalized }))
    // A metric that divided by zero reads as 0 — neither a strength nor a weakness.
    .filter((c) => !flagged.includes(FLAG_FOR[c.key]));

  const findings: Finding[] = [];
  if (scored.length) {
    const best = scored.reduce((a, b) => (b.normalized > a.normalized ? b : a));
    const worst = scored.reduce((a, b) => (b.normalized < a.normalized ? b : a));

    if (best.normalized >= 0.5) {
      findings.push({ tone: 'good', title: `Strongest: ${NAMES[best.key]}`, text: describe(best.key, metrics, money) });
    }

    // A good overall score can sit on top of ads that lose money; say so
    // plainly rather than let the label imply a profitable campaign.
    const goodOverall = /good|excellent/i.test(label);
    const roasCounted = !flagged.includes('ROAS');
    if (goodOverall && roasCounted && metrics.roas < 1) {
      findings.push({
        tone: 'concern',
        title: 'Your ads aren’t paying for themselves yet',
        text: `Your overall score is rated ${label}, but return on ad spend is ${fmt(metrics.roas)}× — under ${money}1 back for every ${money}1 spent.`,
      });
    } else if (worst.normalized < 0.5 && worst.key !== best.key) {
      findings.push({ tone: 'concern', title: `Needs attention: ${NAMES[worst.key]}`, text: describe(worst.key, metrics, money) });
    }
  }

  if (flagged.length) {
    findings.push({
      tone: 'note',
      title: 'Some figures couldn’t be worked out',
      text: `${flagged.join(', ')} ${flagged.length === 1 ? 'needs' : 'need'} a figure that was zero this period, so ${flagged.length === 1 ? 'it counts' : 'they count'} as 0 in the score.`,
    });
  } else {
    findings.push({
      tone: 'note',
      title: 'What this covers',
      text: `These figures are for ${periodLabel ?? 'the period you submitted'} only. The AI action plan looks at your last 4 saved periods together, so its numbers can differ.`,
    });
  }
  return findings;
}
