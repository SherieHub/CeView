import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CohortContext from './CohortContext';
import type { UniquenessResult } from '../../../../../types';

const SCORES: UniquenessResult = {
  overallScore: 45,
  semanticsScore: 42,
  categoryScore: 91,
  semanticPercentile: 45,
  cohortSize: 34,
  cohortMedianScore: 41,
  cohortCategories: ['Adventure & Nature'],
  categoryDensity: 'dense',
  sufficientCohort: true,
  descriptionFeedback: '',
  categoryFeedback: '',
};

describe('CohortContext', () => {
  it('discloses the cohort size, categories, and median from the result', () => {
    render(<CohortContext scores={{ ...SCORES, cohortSize: 12, cohortMedianScore: 37, cohortCategories: ['Adventure & Nature', 'Coastal & Island'] }} />);

    expect(screen.getByText(/Compared against 12 Adventure & Nature, Coastal & Island businesses in Cebu/)).toBeInTheDocument();
    expect(screen.getByText(/median score in this group is 37/)).toBeInTheDocument();
  });

  it('does not present a ranking when the cohort is insufficient', () => {
    render(<CohortContext scores={{ ...SCORES, cohortSize: 2, sufficientCohort: false }} />);

    expect(screen.getByText(/Only 2 comparable businesses are on record, too few to rank against/)).toBeInTheDocument();
    expect(screen.queryByText(/median score/)).not.toBeInTheDocument();
  });

  it('pluralises a single comparable business', () => {
    render(<CohortContext scores={{ ...SCORES, cohortSize: 1, sufficientCohort: false }} />);

    expect(screen.getByText(/Only 1 comparable business is on record/)).toBeInTheDocument();
  });

  it.each([
    ['dense', "one of Cebu's most crowded categories"],
    ['moderate', 'has a mid-sized cohort'],
    ['sparse', 'has few businesses on record'],
  ] as const)('renders %s density context regardless of score', (categoryDensity, copy) => {
    const { rerender } = render(<CohortContext scores={{ ...SCORES, categoryDensity, overallScore: 20 }} />);
    expect(screen.getByText(new RegExp(copy))).toBeInTheDocument();

    rerender(<CohortContext scores={{ ...SCORES, categoryDensity, overallScore: 90 }} />);
    expect(screen.getByText(new RegExp(copy))).toBeInTheDocument();
  });

  it('always explains that the score does not gate setup', () => {
    render(<CohortContext scores={SCORES} />);
    expect(screen.getByText(/This score does not gate anything/)).toBeInTheDocument();
  });
});
