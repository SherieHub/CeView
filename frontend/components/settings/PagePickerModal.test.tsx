import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PagePickerModal from './PagePickerModal';
import { ToastProvider } from '../shared/Toast';
import { OverlayStackProvider } from '../shared/useOverlayStack';

const metaPagesMock = vi.fn();
const selectMetaPageMock = vi.fn();

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    connections: {
      metaPages: (...args: unknown[]) => metaPagesMock(...args),
      selectMetaPage: (...args: unknown[]) => selectMetaPageMock(...args),
    },
  },
}));

function renderPicker(onSelected = vi.fn(), onClose = vi.fn()) {
  return render(
    <ToastProvider>
      <OverlayStackProvider>
        <PagePickerModal onClose={onClose} onSelected={onSelected} />
      </OverlayStackProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  metaPagesMock.mockReset().mockResolvedValue([
    { id: '111', name: 'Cebu Dive Co.', instagramUsername: 'cebu.dive' },
    { id: '222', name: 'Mactan Cafe', instagramUsername: null },
  ]);
  selectMetaPageMock.mockReset().mockResolvedValue([]);
});

describe('PagePickerModal', () => {
  it('lists the Pages with their linked Instagram account, or a hint when there is none', async () => {
    renderPicker();

    expect(await screen.findByText('Cebu Dive Co.')).toBeInTheDocument();
    expect(screen.getByText('Instagram: @cebu.dive')).toBeInTheDocument();
    expect(screen.getByText('Mactan Cafe')).toBeInTheDocument();
    expect(screen.getByText('No Instagram account linked')).toBeInTheDocument();
  });

  it('keeps the confirm button disabled until a Page is picked', async () => {
    renderPicker();
    await screen.findByText('Cebu Dive Co.');

    expect(screen.getByRole('button', { name: /use this page/i })).toBeDisabled();
  });

  it('submits the chosen Page and reports success', async () => {
    const onSelected = vi.fn();
    renderPicker(onSelected);

    fireEvent.click(await screen.findByText('Cebu Dive Co.'));
    fireEvent.click(screen.getByRole('button', { name: /use this page/i }));

    await waitFor(() => expect(selectMetaPageMock).toHaveBeenCalledWith('111'));
    await waitFor(() => expect(onSelected).toHaveBeenCalled());
  });

  it('shows a helpful message when the account administers no Pages', async () => {
    metaPagesMock.mockResolvedValue([]);
    renderPicker();

    expect(await screen.findByText(/no facebook pages/i)).toBeInTheDocument();
  });

  it('shows a reconnect hint when loading the Pages fails', async () => {
    metaPagesMock.mockRejectedValue(new Error('boom'));
    renderPicker();

    expect(await screen.findByText(/could not load your pages/i)).toBeInTheDocument();
  });

  it('does not close when saving fails, and lets the user try again', async () => {
    selectMetaPageMock.mockRejectedValue(new Error('nope'));
    const onSelected = vi.fn();
    renderPicker(onSelected);

    fireEvent.click(await screen.findByText('Cebu Dive Co.'));
    fireEvent.click(screen.getByRole('button', { name: /use this page/i }));

    await waitFor(() => expect(selectMetaPageMock).toHaveBeenCalled());
    expect(onSelected).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: /use this page/i })).toBeEnabled());
  });
});
