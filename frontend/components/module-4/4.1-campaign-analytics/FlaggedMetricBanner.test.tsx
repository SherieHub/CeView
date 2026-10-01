import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import FlaggedMetricBanner from './FlaggedMetricBanner';

describe('FlaggedMetricBanner', () => {
  it('renders nothing when there are no flagged metrics', () => {
    const { container } = render(<FlaggedMetricBanner flagged={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names every flagged metric when there are some', () => {
    render(<FlaggedMetricBanner flagged={['CTR', 'CPC', 'ROAS']} />);

    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent('CTR');
    expect(banner).toHaveTextContent('CPC');
    expect(banner).toHaveTextContent('ROAS');
    expect(banner).toHaveTextContent('3');
  });

  it('names a single flagged metric correctly', () => {
    render(<FlaggedMetricBanner flagged={['CAC']} />);
    expect(screen.getByRole('alert')).toHaveTextContent('CAC');
  });
});
