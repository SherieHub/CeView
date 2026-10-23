import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requestUpload = vi.fn();
const complete = vi.fn();
vi.mock('./apiClient', () => ({
  API_BASE_URL: 'http://api.test',
  apiClient: { media: { requestUpload: (...a: unknown[]) => requestUpload(...a), complete: (...a: unknown[]) => complete(...a) } },
}));

import { ApiError } from './apiError';
import { MEDIA_LIMITS, mediaKindOf, uploadMedia } from './mediaUpload';

const fetchMock = vi.fn();

beforeEach(() => {
  requestUpload.mockReset();
  complete.mockReset().mockResolvedValue({});
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const jpeg = () => new File([new Uint8Array([1, 2, 3])], 'a.jpg', { type: 'image/jpeg' });

describe('mediaKindOf', () => {
  it('classifies the accepted types', () => {
    expect(mediaKindOf('image/png')).toBe('image');
    expect(mediaKindOf('image/jpeg')).toBe('image');
    expect(mediaKindOf('image/webp')).toBe('image');
    expect(mediaKindOf('video/mp4')).toBe('video');
    expect(mediaKindOf('video/quicktime')).toBe('video');
  });

  it('rejects everything else', () => {
    expect(mediaKindOf('image/gif')).toBeNull();
    expect(mediaKindOf('')).toBeNull();
  });

  it('mirrors the backend limits', () => {
    expect(MEDIA_LIMITS.image).toBe(8 * 1024 * 1024);
    expect(MEDIA_LIMITS.video).toBe(250 * 1024 * 1024);
  });
});

describe('uploadMedia', () => {
  it('PUTs to an absolute (S3) URL without an Authorization header, then completes', async () => {
    requestUpload.mockResolvedValue({ mediaId: 'm1', uploadUrl: 'https://s3.example/obj?sig=1', publicUrl: 'https://cdn/m1.jpg', kind: 'image' });

    const result = await uploadMedia(jpeg(), { width: 800, height: 600 });

    expect(requestUpload).toHaveBeenCalledWith('image/jpeg', 3);
    expect(fetchMock).toHaveBeenCalledWith('https://s3.example/obj?sig=1',
      expect.objectContaining({ method: 'PUT', headers: { 'Content-Type': 'image/jpeg' } }));
    expect(complete).toHaveBeenCalledWith('m1', { width: 800, height: 600 });
    expect(result).toEqual({ mediaId: 'm1', publicUrl: 'https://cdn/m1.jpg', kind: 'image' });
  });

  it('resolves a relative (local dev) upload URL against the API origin', async () => {
    requestUpload.mockResolvedValue({ mediaId: 'm2', uploadUrl: '/api/media/local/m2', publicUrl: 'http://localhost:8080/media/x.jpg', kind: 'image' });

    await uploadMedia(jpeg());

    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/media/local/m2');
  });

  it('skips the PUT in fixture mode', async () => {
    requestUpload.mockResolvedValue({ mediaId: 'fx', uploadUrl: '#fixture-no-upload', publicUrl: 'https://example.invalid/fx', kind: 'image' });

    const result = await uploadMedia(jpeg());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.mediaId).toBe('fx');
  });

  it('fails clearly when storage rejects the PUT, without completing', async () => {
    requestUpload.mockResolvedValue({ mediaId: 'm3', uploadUrl: 'https://s3.example/obj', publicUrl: 'u', kind: 'image' });
    fetchMock.mockResolvedValue({ ok: false, status: 403 });

    await expect(uploadMedia(jpeg())).rejects.toThrow(/403/);
    expect(complete).not.toHaveBeenCalled();
  });

  it('turns a network/CORS failure into a plain connection message', async () => {
    requestUpload.mockResolvedValue({ mediaId: 'm4', uploadUrl: 'https://s3.example/obj', publicUrl: 'u', kind: 'image' });
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(uploadMedia(jpeg())).rejects.toThrow('Upload failed — check your connection and try again.');
    expect(complete).not.toHaveBeenCalled();
  });

  it('keeps the API’s own message when requesting the slot fails with one', async () => {
    requestUpload.mockRejectedValue(new ApiError({ status: 400, method: 'POST', path: '/media', body: { message: 'Video is too long.' } }));

    await expect(uploadMedia(jpeg())).rejects.toThrow('Video is too long.');
  });

  it('uses the generic message for an API error that carries no message of its own', async () => {
    requestUpload.mockRejectedValue(new ApiError({ status: 500, method: 'POST', path: '/media' }));

    await expect(uploadMedia(jpeg())).rejects.toThrow('Upload failed — check your connection and try again.');
  });
});
