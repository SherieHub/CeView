import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ScoreTiles from './ScoreTiles';
import type { UniquenessResult } from '../../../../../types';

const SCORES: UniquenessResult = {
  overallScore: 68,
  semanticsScore: 42,
  categoryScore: 91,
  semanticPercentile: 68,
  cohortSize: 34,
  cohortMedianScore: 41,
  cohortCategories: ['Adventure & Nature'],
  categoryDensity: 'dense',
  sufficientCohort: true,
  descriptionFeedback: '',
  categoryFeedback: '',
};

describe('ScoreTiles', () => {
  it('labels each value according to what the API measured', () => {
    render(<ScoreTiles scores={SCORES} />);

    expect(screen.getByText('Distinctiveness percentile')).toBeInTheDocument();
    expect(screen.getByText(/rank above 68% of the businesses/)).toBeInTheDocument();
    expect(screen.getByText('Raw distinctiveness')).toBeInTheDocument();
    expect(screen.getByText(/underlying distance measure/)).toBeInTheDocument();
    expect(screen.getByText('Classification confidence')).toBeInTheDocument();
    expect(screen.getByText(/does not affect the score above/)).toBeInTheDocument();
  });
});
