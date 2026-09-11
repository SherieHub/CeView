/**
 * Connected publishing accounts for the Platforms screen.
 *
 * Was declared inline in apiClient.ts while every other fixture lived here —
 * moved so the whole mock layer is one directory.
 */
import type { PlatformConnection } from '../../types';

export const MOCK_CONNECTIONS: PlatformConnection[] = [
  { platform: 'instagram', connected: true, handle: '@sunsetcove.ph', connectedAt: '2026-05-01T00:00:00Z' },
  // Connected, not just entered at onboarding (see demoBusiness.ts's socials) —
  // MOCK_POSTS already has a published TikTok post (p2), which would be a
  // contradiction if this platform showed as unconnected.
  { platform: 'tiktok', connected: true, handle: '@sunsetcove', connectedAt: '2026-07-15T00:00:00Z' },
  { platform: 'facebook', connected: true, handle: 'SunsetCoveMoalboal', connectedAt: '2026-04-12T00:00:00Z' },
];
