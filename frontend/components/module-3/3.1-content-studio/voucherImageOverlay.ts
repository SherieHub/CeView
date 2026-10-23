import type { AttributionVoucher } from '../../../types';

/** Renders the selected voucher into the exported pixel asset, not only its preview. */
export function composeVoucherOverlay(source: string, voucher: AttributionVoucher): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas is unavailable.'));
      ctx.drawImage(image, 0, 0);
      const margin = Math.round(Math.min(canvas.width, canvas.height) * 0.04);
      const width = Math.round(canvas.width * 0.34); const height = Math.round(width * 0.42);
      const x = canvas.width - width - margin; const y = canvas.height - height - margin;
      ctx.fillStyle = '#102a43'; ctx.fillRect(x, y, width, height);
      ctx.strokeStyle = '#f6c453'; ctx.lineWidth = Math.max(2, Math.round(width * .012)); ctx.strokeRect(x, y, width, height);
      const font = Math.max(16, Math.round(width * .105)); ctx.fillStyle = '#ffffff'; ctx.font = `700 ${font}px sans-serif`;
      ctx.fillText(`PHP ${voucher.discountAmount} OFF`, x + font, y + font * 1.25);
      ctx.font = `600 ${Math.round(font * .6)}px sans-serif`; ctx.fillText(`Use code: ${voucher.code}`, x + font, y + font * 2.25);
      ctx.fillText(voucher.redemptionsRemaining === -1 ? 'Limited offer' : `${voucher.redemptionsRemaining} bookings remaining`, x + font, y + font * 3.05);
      resolve(canvas.toDataURL('image/png'));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('The voucher image could not be exported.'));
      }
    };
    image.onerror = () => reject(new Error('The selected image cannot be prepared for the voucher overlay.'));
    image.src = source;
  });
}
