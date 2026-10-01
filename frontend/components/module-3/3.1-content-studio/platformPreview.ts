/**
 * Per-platform preview treatment for the publishing modal's phone frame.
 *
 * The fold values are not invented: MOCK_CONTENT's own optionMetadata states
 * them for each platform — Instagram "hook lands inside the first 125
 * characters before the fold", Facebook "hook inside ~250 chars", TikTok "the
 * entire caption is the hook because TikTok shows no fold".
 *
 * Approximate by design. The frame exists to catch "the crop eats the subject"
 * and "the hook is below the fold" before publishing — not to be a
 * pixel-accurate emulator of four apps.
 */
import type { StudioPlatformId } from './contentStudioTypes';

export interface PlatformPreview {
  label: string;
  /** CSS aspect-ratio for the media inside the bezel. */
  aspect: string;
  /** Characters visible before the platform's "more" link. */
  fold: number;
  /** Which UI overlay the frame draws. */
  chrome: 'grid' | 'feed' | 'post';
}

export const PLATFORM_PREVIEWS: Record<StudioPlatformId, PlatformPreview> = {
  instagram: { label: 'Instagram Grid', aspect: '4 / 5', fold: 125, chrome: 'grid' },
  tiktok: { label: 'TikTok Feed', aspect: '9 / 16', fold: 300, chrome: 'feed' },
  facebook: { label: 'Facebook Post', aspect: '1 / 1', fold: 250, chrome: 'post' },
};

export interface TruncatedCaption {
  visible: string;
  truncated: boolean;
}

export function truncateForPlatform(caption: string, platform: StudioPlatformId): TruncatedCaption {
  const { fold } = PLATFORM_PREVIEWS[platform];
  if (caption.length <= fold) return { visible: caption, truncated: false };
  return { visible: caption.slice(0, fold), truncated: true };
}
