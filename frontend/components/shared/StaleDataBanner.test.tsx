import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StaleDataBanner } from './StaleDataBanner';

describe('StaleDataBanner', () => {
  it('states the age in whole days', () => {
    render(
      <StaleDataBanner
        dataAsOf="2026-08-24T03:00:00Z"
        now={new Date('2026-08-30T03:00:00Z')}
        cause="429 Too Many Requests"
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Data is 6 days old');
  });

  it('shows the last successful fetch date', () => {
    render(
      <StaleDataBanner
        dataAsOf="2026-08-24T03:00:00Z"
        now={new Date('2026-08-30T03:00:00Z')}
        cause="429 Too Many Requests"
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('2026-08-24');
  });

  it('names the cause of the failed refresh', () => {
    render(
      <StaleDataBanner
        dataAsOf="2026-08-24T03:00:00Z"
        now={new Date('2026-08-30T03:00:00Z')}
        cause="429 Too Many Requests"
      />,
    );

    expect(screen.getByTestId('stale-cause')).toHaveTextContent('429 Too Many Requests');
  });

  it('renders nothing without a timestamp', () => {
    const { container } = render(<StaleDataBanner dataAsOf={null} now={new Date()} />);

    expect(container).toBeEmptyDOMElement();
  });
});
