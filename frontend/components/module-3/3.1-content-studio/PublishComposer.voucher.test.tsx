import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PublishComposer from './PublishComposer';
import { composeVoucherOverlay } from './voucherImageOverlay';
import { apiClient } from '../../../services/apiClient';
import { uploadMedia } from '../../../services/mediaUpload';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import type { PublishDraftState } from './contentStudioTypes';

vi.mock('./voucherImageOverlay', () => ({ composeVoucherOverlay: vi.fn() }));
vi.mock('../../../services/apiClient', () => ({ apiClient: { vouchers: { list: vi.fn() } } }));
vi.mock('../../../services/mediaUpload', () => ({
  uploadMedia: vi.fn(), MEDIA_LIMITS: { image: 8 * 1024 * 1024 }, mediaKindOf: () => 'image',
}));

function Harness({ video = false }: { video?: boolean }) {
  const [draft, setDraft] = useState<PublishDraftState>({
    caption: 'Book now', mediaDataUrl: 'data:image/png;base64,ORIGINAL', mediaType: video ? 'video' : 'image',
    platforms: [], visibility: 'public', commentsEnabled: true, paidPartnership: false, agreementChecked: false,
    mediaUpload: { status: 'ready', mediaId: 'original', publicUrl: '/original' },
  });
  return <OverlayStackProvider>
    <PublishComposer draft={draft} onDraftChange={(patch) => setDraft((old) => ({ ...old, ...patch }))}
      audit={{ status: 'idle', step: 0, result: null }} platform="instagram" />
    <output data-testid="draft">{JSON.stringify(draft)}</output>
  </OverlayStackProvider>;
}

beforeEach(() => {
  vi.mocked(apiClient.vouchers.list).mockResolvedValue([{
    attributionCodeId: 'v1', code: 'CVLAUNCH', discountAmount: 50, redemptionLimit: 10,
    redemptionsUsed: 0, redemptionsRemaining: 10, voucherStatus: 'ACTIVE',
  }]);
  vi.mocked(composeVoucherOverlay).mockReset().mockResolvedValue('data:image/png;base64,COMPOSED');
  vi.mocked(uploadMedia).mockReset().mockResolvedValue({ mediaId: 'composed', publicUrl: '/composed', kind: 'image' });
  vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob(['pixels'], { type: 'image/png' }) })));
});
afterEach(() => vi.unstubAllGlobals());

it('uploads the composed image and restores and uploads the source when disabled', async () => {
  render(<Harness />);
  const toggle = await screen.findByLabelText('Add voucher to image');
  fireEvent.click(toggle);
  await waitFor(() => expect(screen.getByTestId('draft')).toHaveTextContent('COMPOSED'));
  await waitFor(() => expect(screen.getByTestId('draft')).toHaveTextContent('"mediaId":"composed"'));
  expect(fetch).toHaveBeenCalledWith('data:image/png;base64,COMPOSED');
  fireEvent.click(toggle);
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('data:image/png;base64,ORIGINAL'));
  await waitFor(() => expect(uploadMedia).toHaveBeenCalledTimes(2));
});

it('does not resurrect media removed while composition is pending', async () => {
  let resolve!: (value: string) => void;
  vi.mocked(composeVoucherOverlay).mockReturnValue(new Promise((done) => { resolve = done; }));
  render(<Harness />);
  fireEvent.click(await screen.findByLabelText('Add voucher to image'));
  fireEvent.click(screen.getByRole('button', { name: /Remove/ }));
  await act(async () => resolve('data:image/png;base64,STALE'));
  expect(screen.getByTestId('draft')).toHaveTextContent('"mediaDataUrl":null');
  expect(uploadMedia).not.toHaveBeenCalled();
});

it('preserves the image and reports composition failure', async () => {
  vi.mocked(composeVoucherOverlay).mockRejectedValue(new Error('Canvas export failed'));
  render(<Harness />);
  fireEvent.click(await screen.findByLabelText('Add voucher to image'));
  expect((await screen.findAllByText('Canvas export failed')).length).toBeGreaterThan(0);
  expect(screen.getByTestId('draft')).toHaveTextContent('ORIGINAL');
  expect(uploadMedia).not.toHaveBeenCalled();
});

it('does not offer a still-image voucher overlay on videos', async () => {
  render(<Harness video />);
  await act(async () => {});
  expect(screen.queryByLabelText('Add voucher to image')).not.toBeInTheDocument();
});
