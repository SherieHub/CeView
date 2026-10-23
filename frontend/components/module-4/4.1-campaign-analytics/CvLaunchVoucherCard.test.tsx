import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../../services/apiClient';
import CvLaunchVoucherCard from './CvLaunchVoucherCard';

vi.mock('../../../services/apiClient', () => ({ apiClient: { vouchers: { list: vi.fn(), redeem: vi.fn() } } }));

beforeEach(() => {
  vi.mocked(apiClient.vouchers.list).mockResolvedValue([{
    attributionCodeId: 'voucher-1', code: 'CVLAUNCH', discountAmount: 50,
    redemptionLimit: 10, redemptionsUsed: 0, redemptionsRemaining: 10, voucherStatus: 'ACTIVE',
  }]);
  vi.mocked(apiClient.vouchers.redeem).mockReset();
});

it('prevents duplicate submissions and allows retry after a failed redemption', async () => {
  let reject!: (error: Error) => void;
  vi.mocked(apiClient.vouchers.redeem).mockReturnValue(new Promise((_, fail) => { reject = fail; }));
  render(<CvLaunchVoucherCard />);
  fireEvent.change(await screen.findByLabelText('Gross booking amount'), { target: { value: '200' } });
  const button = screen.getByRole('button', { name: 'Redeem CVLAUNCH' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(apiClient.vouchers.redeem).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  await act(async () => reject(new Error('Please retry')));
  expect(screen.getByRole('status')).toHaveTextContent('Please retry');
  expect(button).toBeEnabled();
});
