import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './apiError';
import { apiClient } from './apiClient';
import { saveTokens } from './authStorage';
import { loadStoredImage } from './mediaUpload';

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('apiClient.media.content', () => {
  it('reads the file through the API with the operator’s token', async () => {
    saveTokens({ accessToken: 'tok-123', profileCompleted: true, emailVerified: true, email: 'a@example.com' } as never);
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['abc'])) });
    vi.stubGlobal('fetch', fetchSpy);

    const blob = await apiClient.media.content('m1');

    expect(blob.size).toBe(3);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/media\/m1\/content$/);
    expect(init.headers.Authorization).toBe('Bearer tok-123');
  });

  it('rejects with the status when the file cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(apiClient.media.content('gone')).rejects.toMatchObject({ status: 404 });
    await expect(apiClient.media.content('gone')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('loadStoredImage', () => {
  it('turns the stored image into a data URL, like a freshly picked picture', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['abc'], { type: 'image/png' })),
    }));

    expect((await loadStoredImage('m1')).startsWith('data:image/png;base64,')).toBe(true);
  });

  it('rejects when the file cannot be read, so the caller can fall back', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    await expect(loadStoredImage('m1')).rejects.toBeInstanceOf(ApiError);
  });
});
