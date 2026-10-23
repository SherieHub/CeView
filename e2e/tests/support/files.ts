import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));

/** A valid 1×1 PNG. */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export const pngFile = (name = 'logo.png') => ({ name, mimeType: 'image/png', buffer: PNG_1X1 });

/** A text file masquerading as nothing an image picker should take. */
export const textFile = (name = 'notes.txt') => ({ name, mimeType: 'text/plain', buffer: Buffer.from('hello') });

/** A photo from the repo's own landing assets — a realistic, valid JPEG/WEBP for upload tests. */
export const SAMPLE_PHOTO = resolve(HERE, '../../../frontend/public/images/landing/cta-aerial-ocean-1200.webp');

/** A file of exactly `bytes` bytes with an image content type (for size-limit tests). */
export const bigFile = (bytes: number, name = 'big.png') => ({
  name,
  mimeType: 'image/png',
  buffer: Buffer.alloc(bytes, 1),
});
