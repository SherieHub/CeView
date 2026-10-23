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
});
