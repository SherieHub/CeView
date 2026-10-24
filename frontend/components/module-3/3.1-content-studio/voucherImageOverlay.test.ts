import { afterEach, expect, it, vi } from 'vitest';
import { composeVoucherOverlay } from './voucherImageOverlay';
import type { AttributionVoucher } from '../../../types';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('rejects canvas export failures instead of leaving composition pending', async () => {
  let loaded!: () => void;
  vi.stubGlobal('Image', class {
    naturalWidth = 1000;
    naturalHeight = 1000;
    set onload(callback: () => void) { loaded = callback; }
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => { throw new Error('Canvas export denied'); });
  const result = composeVoucherOverlay('data:image/png;base64,image', {
    code: 'CVLAUNCH', discountAmount: 50, redemptionsRemaining: 10,
  } as AttributionVoucher);
  const rejection = expect(result).rejects.toThrow('Canvas export denied');
  loaded();
  await rejection;
});
