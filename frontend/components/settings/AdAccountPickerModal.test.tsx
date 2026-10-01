import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdAccountPickerModal from './AdAccountPickerModal';
import { ToastProvider } from '../shared/Toast';
import { OverlayStackProvider } from '../shared/useOverlayStack';

const accountsMock = vi.fn();
const selectAccountMock = vi.fn();

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    adConnections: {
      accounts: (...args: unknown[]) => accountsMock(...args),
      selectAccount: (...args: unknown[]) => selectAccountMock(...args),
    },
  },
}));

function renderPicker(onDone = vi.fn()) {
  return render(
    <ToastProvider>
      <OverlayStackProvider>
        <AdAccountPickerModal provider="meta" onClose={vi.fn()} onSelected={onDone} />
      </OverlayStackProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  accountsMock.mockReset();
  selectAccountMock.mockReset();
  selectAccountMock.mockResolvedValue({});
  accountsMock.mockResolvedValue([
    { id: 'act_1', name: 'Cebu Dive Co. Ads', currency: 'PHP' },
    { id: 'act_2', name: 'Personal Test', currency: 'USD' },
  ]);
});

describe('AdAccountPickerModal', () => {
  it('lists the accounts the grant can see, with currency', async () => {
    renderPicker();
    expect(await screen.findByText('Cebu Dive Co. Ads')).toBeInTheDocument();
    expect(screen.getByText(/USD/)).toBeInTheDocument();
  });

  it('submits the chosen account', async () => {
    const onSelected = vi.fn();
    renderPicker(onSelected);
    fireEvent.click(await screen.findByText('Cebu Dive Co. Ads'));
    fireEvent.click(screen.getByRole('button', { name: /use this account/i }));

    await waitFor(() => expect(selectAccountMock).toHaveBeenCalledWith('meta', 'act_1'));
    await waitFor(() => expect(onSelected).toHaveBeenCalled());
  });

  it('keeps the confirm button disabled until something is picked', async () => {
    renderPicker();
    await screen.findByText('Cebu Dive Co. Ads');
    expect(screen.getByRole('button', { name: /use this account/i })).toBeDisabled();
  });

  it('explains an empty list rather than showing a blank modal', async () => {
    // Real and common: a brand-new Meta developer account with no Business
    // Portfolio has no ad accounts at all.
    accountsMock.mockResolvedValue([]);
    renderPicker();
    expect(await screen.findByText(/no ad accounts/i)).toBeInTheDocument();
  });

  it('surfaces a load failure', async () => {
    accountsMock.mockRejectedValue(new Error('502'));
    renderPicker();
    expect(await screen.findByText(/could not load/i)).toBeInTheDocument();
  });
});
