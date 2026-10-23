import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AttributionEvidenceSection from './AttributionEvidenceSection';

vi.mock('./LinkAttributionPanel', () => ({ default: () => <div>Link evidence</div> }));
vi.mock('./CodeRedemptionPanel', () => ({ default: () => <div>Log campaign bookings</div> }));
vi.mock('./StatisticalLiftPanel', () => ({ default: () => <div>Compare campaign lift</div> }));
vi.mock('./CvLaunchVoucherCard', () => ({ default: () => <div>Redeem voucher</div> }));

describe('merged attribution evidence', () => {
  it.each(['entry', 'tab'] as const)('keeps all evidence reachable in the %s layout', (layout) => {
    render(<AttributionEvidenceSection layout={layout} />);
    for (const text of ['Link evidence', 'Log campaign bookings', 'Compare campaign lift', 'Redeem voucher']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it.each(['entry', 'tab'] as const)('leaves the code and lift titles to their own panels in the %s layout', (layout) => {
    render(<AttributionEvidenceSection layout={layout} />);
    expect(screen.getByRole('region', { name: 'Code-redemption evidence' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Statistical lift' })).toBeInTheDocument();
    // The panels title themselves; a second heading here repeated each title above its card.
    expect(screen.queryByRole('heading', { name: 'Code-redemption evidence' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Statistical lift' })).not.toBeInTheDocument();
  });
});
