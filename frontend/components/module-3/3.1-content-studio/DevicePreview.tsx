/**
 * Stylised device frame showing the staged post as the chosen platform would
 * render it: the platform's aspect ratio, its caption fold, and a hint of its
 * own UI furniture.
 *
 * Was PhonePreview. It renders a browser frame in `desktop` mode now, so a name
 * that promised a phone had stopped being true.
 *
 * Approximate by design. It exists to catch "the crop eats the subject" and
 * "the hook is below the fold" before publishing, not to be a pixel-accurate
 * emulator of three apps on three form factors.
 */
import { forwardRef } from 'react';
import { Battery, Bookmark, Heart, MessageCircle, MoreHorizontal, Send, Signal, Wifi } from 'lucide-react';
import { PLATFORM_PREVIEWS, truncateForPlatform } from './platformPreview';
import type { StudioPlatformId } from './contentStudioTypes';

export type PreviewDevice = 'mobile' | 'tablet' | 'desktop';

export const PREVIEW_DEVICES: Array<{ id: PreviewDevice; label: string }> = [
  { id: 'mobile', label: 'Mobile' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'desktop', label: 'Desktop' },
];

export interface DevicePreviewProps {
  platform: StudioPlatformId;
  caption: string;
  mediaDataUrl: string | null;
  device?: PreviewDevice;
  /** The account the post appears under — the business name. */
  accountName?: string;
}

const APP_NAME: Record<StudioPlatformId, string> = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' };

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '•';
}

/**
 * Forwards a ref to the frame so the modal can measure its LAYOUT size and
 * scale it to fit the canvas — see PublishModal's `fit`.
 */
const DevicePreview = forwardRef<HTMLDivElement, DevicePreviewProps>(function DevicePreview(
  { platform, caption, mediaDataUrl, device = 'mobile', accountName = 'Your business' },
  ref,
) {
  const spec = PLATFORM_PREVIEWS[platform];
  const { visible, truncated } = truncateForPlatform(caption, platform);
  const isDesktop = device === 'desktop';

  return (
    <div ref={ref} className="device-frame" data-device={device} data-chrome={spec.chrome}>
      {/* A browser gets a title bar with traffic lights; a handheld gets a
          notch. Same box, different furniture — which is the whole signal that
          the form factor changed. */}
      {isDesktop ? (
        <div className="device-titlebar" aria-hidden="true">
          <span /><span /><span />
        </div>
      ) : (
        <div className="device-notch" aria-hidden="true" />
      )}

      <div className="device-screen">
        {/* Handheld furniture — status bar and the app's own top bar — so the
            post reads as sitting in the app rather than floating in a box. */}
        {!isDesktop && (
          <>
            <div className="device-status" aria-hidden="true">
              <span>9:41</span>
              <span className="device-status-icons"><Signal size={11} /><Wifi size={11} /><Battery size={13} /></span>
            </div>
            <div className="device-appbar" aria-hidden="true">{APP_NAME[platform]}</div>
          </>
        )}
        <div className="device-account" aria-hidden="true">
          <span className="device-avatar">{initials(accountName)}</span>
          <span className="device-account-name">{accountName}</span>
          <MoreHorizontal size={15} />
        </div>

        {/* The ratio is inline because it is data, not style: it comes from
            PLATFORM_PREVIEWS and changes per platform. */}
        <div className="device-media" style={{ aspectRatio: spec.aspect }}>
          {mediaDataUrl ? (
            <img src={mediaDataUrl} alt="" />
          ) : (
            <span className="device-media-empty" data-testid="device-media-empty">No media staged</span>
          )}
        </div>

        <div className="device-actions" aria-hidden="true">
          <Heart size={16} /><MessageCircle size={16} /><Send size={16} />
          <Bookmark size={16} className="device-actions-end" />
        </div>

        <p className="device-caption" data-testid="device-caption">
          {visible}
          {truncated && <span className="device-more">… more</span>}
        </p>
      </div>
    </div>
  );
});

export default DevicePreview;
