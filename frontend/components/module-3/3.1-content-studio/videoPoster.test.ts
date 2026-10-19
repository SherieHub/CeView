import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
