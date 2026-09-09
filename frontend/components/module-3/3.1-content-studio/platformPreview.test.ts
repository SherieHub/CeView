import { describe, expect, it } from 'vitest';
import { PLATFORM_PREVIEWS, truncateForPlatform } from './platformPreview';

describe('platformPreview', () => {
  it('describes every platform the studio offers — Naver is not one of them', () => {
    expect(Object.keys(PLATFORM_PREVIEWS).sort()).toEqual(['facebook', 'instagram', 'tiktok']);
    expect(PLATFORM_PREVIEWS.instagram.aspect).toBe('4 / 5');
    expect(PLATFORM_PREVIEWS.tiktok.aspect).toBe('9 / 16');
    expect(PLATFORM_PREVIEWS.facebook.aspect).toBe('1 / 1');
  });

  it('cuts a caption at the platform fold and flags the remainder', () => {
    const long = 'x'.repeat(400);
    const ig = truncateForPlatform(long, 'instagram');
    expect(ig.visible.length).toBe(125);
    expect(ig.truncated).toBe(true);

    // TikTok shows no fold — the whole caption is the hook.
    const tt = truncateForPlatform('short caption', 'tiktok');
    expect(tt.visible).toBe('short caption');
    expect(tt.truncated).toBe(false);
  });
});
