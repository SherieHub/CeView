/**
 * Reads a picked profile photo as a data URL, centre-cropped to a square and
 * scaled down so it stays small enough to save with the profile. If the
 * browser can't decode or redraw it, the original file's data URL is used.
 */
const SIDE = 320;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('unreadable')));
    reader.onerror = () => reject(reader.error ?? new Error('unreadable'));
    reader.readAsDataURL(file);
  });
}

async function squareDown(dataUrl: string): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  if (!side) throw new Error('empty image');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(SIDE, side);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.drawImage(
    img,
    (img.naturalWidth - side) / 2,
    (img.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas.toDataURL('image/jpeg', 0.86);
}

export async function readProfilePhoto(file: File): Promise<string> {
  const original = await readAsDataUrl(file);
  try {
    return await squareDown(original);
  } catch {
    return original;
  }
}
