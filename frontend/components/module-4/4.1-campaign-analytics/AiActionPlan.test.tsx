import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import AiActionPlan from './AiActionPlan';
import { MOCK_REPORT } from '../../../services/fixtures/campaign';
import type { PrescriptiveReport } from '@/types';

describe('AiActionPlan', () => {
  it('renders the executive summary and recommended platform', () => {
    render(<AiActionPlan report={MOCK_REPORT} />);

    expect(screen.getByText(MOCK_REPORT.executiveSummary)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(MOCK_REPORT.recommendedPlatform))).toBeInTheDocument();
  });

  it('renders the 3 diagnostics in report order, not re-sorted by raw drop rate', () => {
    // MOCK_REPORT's own array order (Weakest/Moderate/Alright) already
    // disagrees with a raw-dropRate sort (93.4% < 97.1%, with 39.5% smallest
    // of all) — a component that re-sorted by dropRate would produce a
    // different sequence than the one asserted here.
    const dropRates = MOCK_REPORT.funnelDiagnostics.map((d) => d.dropRate);
    expect(dropRates).toEqual(['93.4%', '39.5%', '97.1%']);
    expect([...dropRates].sort()).not.toEqual(dropRates);

    render(<AiActionPlan report={MOCK_REPORT} />);

    const stageHeadings = screen.getAllByRole('heading', { level: 3 });
    expect(stageHeadings.map((el) => el.textContent)).toEqual(
      MOCK_REPORT.funnelDiagnostics.map((d) => d.stage)
    );
  });

  it('pairs each diagnostic with its same-index recommendation in one card', () => {
    render(<AiActionPlan report={MOCK_REPORT} />);

    MOCK_REPORT.funnelDiagnostics.forEach((diagnostic, index) => {
      const recommendation = MOCK_REPORT.recommendations[index];
      const card = screen.getByTestId(`action-plan-card-${index}`);
      const scoped = within(card);

      expect(scoped.getByText(diagnostic.stage)).toBeInTheDocument();
      expect(scoped.getByText(diagnostic.rank)).toBeInTheDocument();
      expect(scoped.getByText(diagnostic.insight)).toBeInTheDocument();
      expect(scoped.getByText(recommendation.title)).toBeInTheDocument();
      expect(scoped.getByText(recommendation.action)).toBeInTheDocument();
      expect(scoped.getByText(recommendation.urgency)).toBeInTheDocument();
    });
  });

  it('uses a distinct chip treatment per urgency tier', () => {
    render(<AiActionPlan report={MOCK_REPORT} />);

    const mostUrgent = screen.getByText('Most Urgent');
    const urgent = screen.getByText('Urgent');
    const notVeryUrgent = screen.getByText('Not Very Urgent');

    expect(mostUrgent.className).not.toEqual(urgent.className);
    expect(urgent.className).not.toEqual(notVeryUrgent.className);
    expect(mostUrgent.className).not.toEqual(notVeryUrgent.className);
  });

  it('does not render a recommendation block when no paired recommendation exists', () => {
    const oddReport: PrescriptiveReport = {
      ...MOCK_REPORT,
      recommendations: MOCK_REPORT.recommendations.slice(0, 2),
    };

    render(<AiActionPlan report={oddReport} />);

    const lastDiagnostic = MOCK_REPORT.funnelDiagnostics[2];
    const card = screen.getByTestId('action-plan-card-2');
    expect(within(card).getByText(lastDiagnostic.stage)).toBeInTheDocument();
    expect(within(card).queryByText(MOCK_REPORT.recommendations[2].title)).not.toBeInTheDocument();
  });
});
