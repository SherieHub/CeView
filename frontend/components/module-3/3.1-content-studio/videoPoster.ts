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
/** A file the browser can't decode can leave the element silent forever. */
const READ_TIMEOUT_MS = 15_000;

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
        const scale = Math.min(1, MAX_POSTER_WIDTH / (video.videoWidth || MAX_POSTER_WIDTH));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas is not available.');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const info: VideoInfo = {
          posterDataUrl: canvas.toDataURL('image/jpeg', 0.85),
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
