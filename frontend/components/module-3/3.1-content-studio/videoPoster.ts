import { MAX_POSTER_CHARS } from './contentDraftPayload';

/**
 * Reads a video file's first frame as a JPEG data URL, plus its dimensions and
 * length. The poster stands in for the video everywhere that expects an image
 * (the compliance audit, thumbnails); the dimensions go to the API so publishers
 * can check aspect ratio and duration later.
 */
export interface VideoInfo {
  posterDataUrl: string;
  width: number;
  height: number;
  durationSeconds: number;
}

const MAX_POSTER_WIDTH = 960;
const MIN_POSTER_WIDTH = 320;
/** Tried in order at each size: a smaller file at lower quality before a smaller picture. */
const JPEG_QUALITIES = [0.85, 0.7, 0.55];
/** A file the browser can't decode can leave the element silent forever. */
const READ_TIMEOUT_MS = 15_000;

/**
 * Draws the current frame and encodes it small enough to be saved inside a draft
 * ({@link MAX_POSTER_CHARS}); without that the draft drops the poster and a restored video
 * cannot be previewed. Steps down in quality, then in size; if nothing fits it returns the
 * smallest attempt, which the draft will simply not keep.
 */
function encodePoster(video: HTMLVideoElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): string {
  const aspect = video.videoHeight / video.videoWidth;
  let width = Math.max(1, Math.round(Math.min(video.videoWidth, MAX_POSTER_WIDTH)));
  let smallest: string | null = null;
  for (;;) {
    canvas.width = width;
    canvas.height = Math.max(1, Math.round(width * aspect));
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    for (const quality of JPEG_QUALITIES) {
      const url = canvas.toDataURL('image/jpeg', quality);
      if (url.length <= MAX_POSTER_CHARS) return url;
      if (smallest === null || url.length < smallest.length) smallest = url;
    }
    if (width <= MIN_POSTER_WIDTH) return smallest ?? '';
    width = Math.max(MIN_POSTER_WIDTH, Math.round(width * 0.75));
  }
}

export function captureVideoPoster(file: File): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('That video took too long to read.'));
    }, READ_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('That video could not be read.'));
    };
    video.onloadedmetadata = () => {
      // A hair past 0 avoids the blank first frame some encoders emit.
      video.currentTime = Number.isFinite(video.duration) ? Math.min(0.1, video.duration / 2) : 0;
    };
    video.onseeked = () => {
      try {
        if (!video.videoWidth || !video.videoHeight) throw new Error('That video could not be read.');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas is not available.');
        const info: VideoInfo = {
          posterDataUrl: encodePoster(video, canvas, ctx),
          width: video.videoWidth,
          height: video.videoHeight,
          durationSeconds: Number.isFinite(video.duration) ? Math.round(video.duration) : 0,
        };
        cleanup();
        resolve(info);
      } catch (err) {
        cleanup();
        reject(err instanceof Error ? err : new Error('That video could not be read.'));
      }
    };

    video.src = url;
  });
}
