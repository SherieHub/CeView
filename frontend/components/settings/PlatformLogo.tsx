/**
 * A platform's own mark in its own colour, for the Settings -> Platforms rows.
 * Each row shows one platform, so recognisable beats uniform here.
 */
import { Facebook, Infinity as MetaMark, Instagram } from 'lucide-react';
import { TikTokGlyph } from '../shared/PlatformGlyphs';
import type { AdProvider, PlatformId } from '../../types';

export function PlatformLogo({ platform }: { platform: PlatformId | AdProvider }) {
  return (
    <span className="pf-logo" data-platform={platform} aria-hidden="true">
      {platform === 'instagram' ? <Instagram size={22} />
        : platform === 'facebook' ? <Facebook size={22} fill="currentColor" strokeWidth={0} />
          : platform === 'meta' ? <MetaMark size={26} strokeWidth={2.6} />
            : <TikTokGlyph size={20} />}
    </span>
  );
}

