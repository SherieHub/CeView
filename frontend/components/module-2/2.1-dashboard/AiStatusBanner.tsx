/**
 * CARD — Dashboard: AI Status Banner & Refresh Forecast
 * Prototype reference: ui-ux-prototype.html:2368-2373
 *
 * Degraded-mode notice. Sits above the summary tiles so its caveat governs
 * everything below it rather than only the feed.
 *
 * role="status" so the mode change is announced when it appears mid-session,
 * rather than silently altering what every number on the page means.
 */
import { CloudOff } from 'lucide-react';
import type { AiStatusBannerSlotProps } from './dashboardTypes';

export default function AiStatusBanner({ visible }: AiStatusBannerSlotProps) {
  if (!visible) return null;

  return (
    <div className="banner banner--warn mb-4" role="status">
      <CloudOff aria-hidden="true" />
      <div>
        <b>AI Forecast Service Unavailable.</b> The alerts and rankings below are read from your last
        successful forecast run. Refreshing will not produce new predictions until the service
        recovers.
      </div>
    </div>
  );
}
