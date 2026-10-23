/**
 * Browser side of the media upload: ask the API for a slot, PUT the file to
 * storage, then tell the API it is there. Mirrors MediaPolicy on the backend.
 */
import { ApiError } from './apiError';
import { API_BASE_URL, apiClient } from './apiClient';

const GENERIC_FAILURE = 'Upload failed — check your connection and try again.';

export type MediaKind = 'image' | 'video';

/** Bytes. Keep in step with MediaPolicy.java. */
export const MEDIA_LIMITS: Record<MediaKind, number> = {
  image: 8 * 1024 * 1024,
  video: 250 * 1024 * 1024,
};

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime']);

export function mediaKindOf(contentType: string): MediaKind | null {
  if (IMAGE_TYPES.has(contentType)) return 'image';
  if (VIDEO_TYPES.has(contentType)) return 'video';
  return null;
}

export interface MediaDimensions {
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export interface UploadedMedia {
  mediaId: string;
  publicUrl: string;
  kind: MediaKind;
}

/**
 * Uploads `file` and resolves once the API has verified it is stored.
 * No Authorization header on the PUT: an S3 presigned URL is signed already
 * (extra headers would break it) and the local-dev endpoint is keyed by media id.
 */
export async function uploadMedia(file: File, dims: MediaDimensions = {}): Promise<UploadedMedia> {
  try {
    const slot = await apiClient.media.requestUpload(file.type, file.size);

    // Fixture mode hands back a '#…' URL and has nothing to upload to.
    if (!slot.uploadUrl.startsWith('#')) {
      const target = slot.uploadUrl.startsWith('/') ? `${API_BASE_URL}${slot.uploadUrl}` : slot.uploadUrl;
      const res = await fetch(target, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status}). Please try again.`);
    }

    await apiClient.media.complete(slot.mediaId, dims);
    return { mediaId: slot.mediaId, publicUrl: slot.publicUrl, kind: slot.kind };
  } catch (err) {
    // Already worded for the operator: our own status message, or one the API sent.
    if (err instanceof Error && err.message.startsWith('Upload failed')) throw err;
    if (err instanceof ApiError && typeof (err.body as { message?: unknown } | undefined)?.message === 'string') throw err;
    // Network/CORS failures surface as a bare TypeError("Failed to fetch").
    throw new Error(GENERIC_FAILURE);
  }
}

/**
 * A previously uploaded image as a data URL — the form a freshly picked picture is held in, so a
 * restored one behaves identically everywhere (preview, voucher overlay, publish, the audit).
 * Read through the API rather than the asset's public URL, which the browser may not be able to
 * load. Rejects if the file cannot be read.
 */
export async function loadStoredImage(mediaId: string): Promise<string> {
  const blob = await apiClient.media.content(mediaId);
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
