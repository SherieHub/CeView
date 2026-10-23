/**
 * Settings → Platforms: the business's own daily and total spending ceilings for CeView-created Meta
 * ads. Paid ads are blocked in the Publish window until these exist, so this form has to make the
 * two numbers hard to get wrong: positive, total at least the daily amount, saved in the ad
 * account's currency as minor units.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdSpendLimitsSection from './AdSpendLimitsSection';
import { ToastProvider } from '../shared/Toast';
import type { AdConnection, AdSpendLimits } from '../../types';

const getMock = vi.fn();
const saveMock = vi.fn();

vi.mock('../../services/apiClient', () => ({
  apiClient: { adConnections: { limits: { get: () => getMock(), save: (...a: unknown[]) => saveMock(...a) } } },
}));

const META: AdConnection = {
  provider: 'meta', configured: true, status: 'ACTIVE', accountName: 'Cebu Dive Ads', currency: 'PHP',
  campaignId: null, campaignName: null, connectedAt: null, lastSyncedAt: null,
};
const UNSET: AdSpendLimits = { configured: false, currency: 'PHP', maxDailyMinor: null, maxTotalMinor: null, committedMinor: 0 };
const SET: AdSpendLimits = { configured: true, currency: 'PHP', maxDailyMinor: 50_000, maxTotalMinor: 1_000_000, committedMinor: 120_000 };

function renderSection(meta: AdConnection | null = META) {
  return render(<ToastProvider><AdSpendLimitsSection meta={meta} /></ToastProvider>);
}
const daily = () => screen.getByLabelText(/daily limit/i) as HTMLInputElement;
const total = () => screen.getByLabelText(/total limit/i) as HTMLInputElement;
const save = () => screen.getByRole('button', { name: /save limits/i });

beforeEach(() => {
  getMock.mockReset().mockResolvedValue(UNSET);
  saveMock.mockReset().mockImplementation(async (d: number, t: number) => ({ ...SET, maxDailyMinor: d, maxTotalMinor: t }));
});

describe('AdSpendLimitsSection', () => {
  it('asks the operator to connect a Meta ad account first, and shows no form', () => {
    renderSection(null);
    expect(screen.getByText(/connect a meta ad account/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/daily limit/i)).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('says paid ads are blocked until limits are saved, and starts empty', async () => {
    renderSection();
    expect(await screen.findByText(/paid ads stay blocked until/i)).toBeInTheDocument();
    expect(daily().value).toBe('');
    expect(total().value).toBe('');
    expect(save()).toBeDisabled();
  });

  it('shows saved limits in major units, with what active ads already commit', async () => {
    getMock.mockResolvedValue(SET);
    renderSection();
    await waitFor(() => expect(daily().value).toBe('500'));
    expect(total().value).toBe('10000');
    expect(screen.getByText(/already committed/i)).toHaveTextContent('1,200');
    expect(screen.queryByText(/paid ads stay blocked/i)).toBeNull();
  });

  it('saves the amounts as minor units of the ad account currency', async () => {
    renderSection();
    await screen.findByText(/paid ads stay blocked/i);
    await userEvent.type(daily(), '500');
    await userEvent.type(total(), '10000.50');
    await userEvent.click(save());

    expect(saveMock).toHaveBeenCalledWith(50_000, 1_000_050);
    expect(await screen.findByText(/limits saved/i)).toBeInTheDocument();
  });

  it('will not save a total below the daily limit, a zero, or a non-number', async () => {
    renderSection();
    await screen.findByText(/paid ads stay blocked/i);

    await userEvent.type(daily(), '500');
    await userEvent.type(total(), '400');
    expect(save()).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/total limit must be at least the daily limit/i);

    await userEvent.clear(total());
    await userEvent.type(total(), '0');
    expect(save()).toBeDisabled();

    await userEvent.clear(total());
    await userEvent.type(total(), '500');
    expect(save()).toBeEnabled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps Save off until something changes from what is saved', async () => {
    getMock.mockResolvedValue(SET);
    renderSection();
    await waitFor(() => expect(daily().value).toBe('500'));
    expect(save()).toBeDisabled();
    await userEvent.type(daily(), '5');
    expect(save()).toBeEnabled();
  });

  it('reports a failed save without losing what was typed', async () => {
    saveMock.mockRejectedValue(new Error('boom'));
    renderSection();
    await screen.findByText(/paid ads stay blocked/i);
    await userEvent.type(daily(), '500');
    await userEvent.type(total(), '1000');
    await userEvent.click(save());

    expect(await screen.findByText(/could not save/i)).toBeInTheDocument();
    expect(daily().value).toBe('500');
  });

  it('uses the currency\'s own decimals: a currency without cents saves whole units', async () => {
    getMock.mockResolvedValue({ ...UNSET, currency: 'JPY' });
    renderSection({ ...META, currency: 'JPY' });
    await screen.findByText(/paid ads stay blocked/i);
    await userEvent.type(daily(), '5000');
    await userEvent.type(total(), '50000');
    await userEvent.click(save());
    expect(saveMock).toHaveBeenCalledWith(5000, 50_000);
  });
});
