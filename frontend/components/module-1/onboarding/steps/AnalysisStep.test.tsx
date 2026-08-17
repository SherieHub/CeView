import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AnalysisStep, {
  fakeClassify,
  calculateUniquenessScore,
  DEFAULT_DEMO_DRAFT,
} from './AnalysisStep';
import { ToastProvider } from '../../../shared/Toast';

// Helper wrapper with ToastProvider
function renderWithToast(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('AnalysisStep Unit Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs fakeClassify deterministically and sums percentages to 100', () => {
    const categories = fakeClassify(DEFAULT_DEMO_DRAFT);
    expect(categories.length).toBe(7);
    const sum = categories.reduce((acc, c) => acc + c.percentage, 0);
    expect(sum).toBe(100);
    // Initial top 2 selected
    expect(categories.filter((c) => c.selected).length).toBe(2);
  });

  it('calculates uniqueness score correctly', () => {
    const categories = fakeClassify(DEFAULT_DEMO_DRAFT);
    const score = calculateUniquenessScore(DEFAULT_DEMO_DRAFT, categories);
    expect(score.overallScore).toBeGreaterThanOrEqual(0);
    expect(score.overallScore).toBeLessThanOrEqual(100);
    expect(score.semanticsScore).toBeGreaterThanOrEqual(35);
    expect(score.categoryScore).toBeGreaterThanOrEqual(0);
  });

  it('transitions from analyzing to categories sub-phase after timer', async () => {
    renderWithToast(<AnalysisStep obDraft={DEFAULT_DEMO_DRAFT} />);

    // Initially in analyzing state
    expect(
      screen.getByText('Analyzing your business profile')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Running multilingual E5 embedding/i)
    ).toBeInTheDocument();

    // Fast-forward timer to complete analysis
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    // Should now render categories phase
    expect(
      screen.getByText('Confirm how CeView reads your business')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Compute uniqueness score/i })
    ).toBeInTheDocument();
  });

  it('enforces >= 1 category selected rule with a toast block when attempting to deselect the last remaining category', () => {
    // Only 1 category selected
    const initialCategories = [
      { name: 'Coastal & Island', percentage: 60, selected: true },
      { name: 'Adventure & Nature', percentage: 40, selected: false },
    ];

    renderWithToast(
      <AnalysisStep
        obPhase="categories"
        categories={initialCategories}
        obDraft={DEFAULT_DEMO_DRAFT}
      />
    );

    // Find the selected category button
    const coastalButton = screen.getByRole('button', {
      name: /Coastal & Island/i,
    });
    expect(coastalButton).toHaveAttribute('aria-pressed', 'true');

    // Click to attempt deselecting the only selected category
    fireEvent.click(coastalButton);

    // Toast warning should be visible
    expect(
      screen.getByText('At least one category must stay selected')
    ).toBeInTheDocument();
    // Category should remain selected
    expect(coastalButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders pass banner (>= 70) vs warning banner (< 70)', () => {
    const passScores = {
      overallScore: 85,
      semanticsScore: 82,
      categoryScore: 88,
    };
    const { rerender } = renderWithToast(
      <AnalysisStep
        obPhase="scored"
        scores={passScores}
        categories={fakeClassify(DEFAULT_DEMO_DRAFT)}
        obDraft={DEFAULT_DEMO_DRAFT}
      />
    );

    expect(screen.getByText('Well differentiated.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Strengthen my UVP/i })
    ).not.toBeInTheDocument();

    // Re-render with low score (< 70)
    const warningScores = {
      overallScore: 62,
      semanticsScore: 60,
      categoryScore: 64,
    };
    rerender(
      <ToastProvider>
        <AnalysisStep
          obPhase="scored"
          scores={warningScores}
          categories={fakeClassify(DEFAULT_DEMO_DRAFT)}
          obDraft={DEFAULT_DEMO_DRAFT}
        />
      </ToastProvider>
    );

    expect(screen.getByText('Room to sharpen.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Strengthen my UVP/i })
    ).toBeInTheDocument();
  });
});
