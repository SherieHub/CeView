/**
 * The dashboard's cover photo: the default beach shot, or one the operator
 * uploads. An upload is scaled down (longest side 1800px, JPEG) and kept in
 * this browser's localStorage, keyed by business profile. There is no
 * cover-photo endpoint yet, so it does not follow the operator to another
 * device — when one exists, `setFromFile` is the place to send it.
 */
import { useCallback, useState } from 'react';

const MAX_SIDE = 1800;

function keyFor(profileId: string | null | undefined) {
  return `ceview.coverPhoto.${profileId ?? 'default'}`;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Decodes the file and re-encodes it as a JPEG no larger than MAX_SIDE. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function useCoverPhoto(profileId: string | null | undefined) {
  const key = keyFor(profileId);
  const [custom, setCustom] = useState<string | null>(() => read(key));

  /** Resolves true when the photo was applied (and saved, if storage allows). */
  const setFromFile = useCallback(
    async (file: File): Promise<boolean> => {
      if (!file.type.startsWith('image/')) return false;
      let dataUrl: string;
      try {
        dataUrl = await shrink(file);
      } catch {
        return false;
      }
      setCustom(dataUrl);
      try {
        localStorage.setItem(key, dataUrl);
      } catch {
        // Storage full or blocked: the photo still shows for this visit.
      }
      return true;
    },
    [key],
  );

  const reset = useCallback(() => {
    setCustom(null);
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing stored to remove.
    }
  }, [key]);

  return { custom, setFromFile, reset };
}
