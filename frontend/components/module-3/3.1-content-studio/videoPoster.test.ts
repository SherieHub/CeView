import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_POSTER_CHARS } from './contentDraftPayload';
import { captureVideoPoster } from './videoPoster';

/** A video element stand-in that the test drives by hand. */
function fakeVideo(props: Partial<{ duration: number; videoWidth: number; videoHeight: number }> = {}) {
  const video: Record<string, unknown> = {
    duration: 12.4,
    videoWidth: 1920,
    videoHeight: 1080,
    currentTime: 0,
    removeAttribute: vi.fn(),
    load: vi.fn(),
    ...props,
  };
  return video as typeof video & {
    onloadedmetadata: () => void;
    onseeked: () => void;
    onerror: () => void;
    removeAttribute: ReturnType<typeof vi.fn>;
    currentTime: number;
  };
}

function stubDom(video: ReturnType<typeof fakeVideo>) {
  const ctx = { drawImage: vi.fn() };
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => ctx), toDataURL: vi.fn(() => 'data:image/jpeg;base64,FRAME') };
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag === 'video') return video;
    if (tag === 'canvas') return canvas;
    return realCreate(tag);
  }) as typeof document.createElement);
  return { canvas, ctx };
}

const file = new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' });

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:clip');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('captureVideoPoster', () => {
  it('seeks a hair in, then returns the frame, dimensions and rounded duration', async () => {
    const video = fakeVideo();
    const { canvas } = stubDom(video);

    const pending = captureVideoPoster(file);
    video.onloadedmetadata();
    expect(video.currentTime).toBe(0.1);
    video.onseeked();

    await expect(pending).resolves.toEqual({
      posterDataUrl: 'data:image/jpeg;base64,FRAME', width: 1920, height: 1080, durationSeconds: 12,
    });
    // Scaled down to the 960px poster width.
    expect(canvas.width).toBe(960);
    expect(canvas.height).toBe(540);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:clip');
  });

  describe('keeping the poster small enough to be saved with the draft', () => {
    const encoded = (chars: number) => `data:image/jpeg;base64,${'A'.repeat(chars - 'data:image/jpeg;base64,'.length)}`;

    it('lowers the JPEG quality before shrinking the frame', async () => {
      const video = fakeVideo();
      const { canvas } = stubDom(video);
      canvas.toDataURL.mockImplementation(((_type: string, quality: number) =>
        encoded(quality >= 0.85 ? MAX_POSTER_CHARS + 5_000 : MAX_POSTER_CHARS - 5_000)) as () => string);

      const pending = captureVideoPoster(file);
      video.onloadedmetadata();
      video.onseeked();

      const { posterDataUrl } = await pending;
      expect(posterDataUrl.length).toBeLessThanOrEqual(MAX_POSTER_CHARS);
      expect(canvas.toDataURL).toHaveBeenLastCalledWith('image/jpeg', 0.7);
      expect(canvas.width).toBe(960);
    });

    it('shrinks the frame when no quality is small enough', async () => {
      const video = fakeVideo();
      const { canvas } = stubDom(video);
      // Too big at the first size whatever the quality; fine once the frame is smaller.
      canvas.toDataURL.mockImplementation((() =>
        encoded(canvas.width >= 960 ? MAX_POSTER_CHARS + 5_000 : MAX_POSTER_CHARS - 5_000)) as () => string);

      const pending = captureVideoPoster(file);
      video.onloadedmetadata();
      video.onseeked();

      const { posterDataUrl } = await pending;
      expect(posterDataUrl.length).toBeLessThanOrEqual(MAX_POSTER_CHARS);
      expect(canvas.width).toBe(720);
      expect(canvas.height).toBe(405);
    });

    it('gives up at a floor size and returns the smallest frame it made', async () => {
      const video = fakeVideo();
      const { canvas } = stubDom(video);
      // Never small enough, but smaller as the frame shrinks.
      canvas.toDataURL.mockImplementation((() => encoded(MAX_POSTER_CHARS + canvas.width * 10)) as () => string);

      const pending = captureVideoPoster(file);
      video.onloadedmetadata();
      video.onseeked();

      const { posterDataUrl, width } = await pending;
      // 960 → 720 → 540 → 405 → 320 (the floor); the last, smallest encoding is the one kept.
      expect(canvas.width).toBe(320);
      expect(posterDataUrl.length).toBe(MAX_POSTER_CHARS + 320 * 10);
      // The reported dimensions are the video's, not the poster's.
      expect(width).toBe(1920);
    });
  });

  it('uses a safe seek target and zero duration when the duration is not finite', async () => {
    const video = fakeVideo({ duration: Infinity });
    stubDom(video);

    const pending = captureVideoPoster(file);
    video.onloadedmetadata();
    expect(video.currentTime).toBe(0);
    video.onseeked();

    await expect(pending).resolves.toMatchObject({ durationSeconds: 0 });
  });

  it('rejects, and cleans up, when the decoded frame has no dimensions', async () => {
    const video = fakeVideo({ videoWidth: 0, videoHeight: 0 });
    stubDom(video);

    const pending = captureVideoPoster(file);
    video.onloadedmetadata();
    video.onseeked();

    await expect(pending).rejects.toThrow(/could not be read/);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:clip');
  });

  it('rejects, and cleans up, when the video takes longer than 15 s', async () => {
    vi.useFakeTimers();
    const video = fakeVideo();
    stubDom(video);

    const pending = captureVideoPoster(file);
    const assertion = expect(pending).rejects.toThrow('That video took too long to read.');
    await vi.advanceTimersByTimeAsync(15_000);

    await assertion;
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:clip');
    expect(video.removeAttribute).toHaveBeenCalledWith('src');
  });

  it('does not time out after succeeding', async () => {
    vi.useFakeTimers();
    const video = fakeVideo();
    stubDom(video);

    const pending = captureVideoPoster(file);
    video.onloadedmetadata();
    video.onseeked();
    await pending;
    (URL.revokeObjectURL as ReturnType<typeof vi.fn>).mockClear();

    await vi.advanceTimersByTimeAsync(20_000);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});
