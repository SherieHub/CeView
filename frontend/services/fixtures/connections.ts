/**
 * Connected publishing accounts for the Platforms screen.
 *
 * Was declared inline in apiClient.ts while every other fixture lived here —
 * moved so the whole mock layer is one directory.
 */
import type { PlatformConnection } from '../../types';

export const MOCK_CONNECTIONS: PlatformConnection[] = [
  { platform: 'instagram', connected: true, handle: '@cebu.dive', connectedAt: '2026-05-01T00:00:00Z' },
  { platform: 'tiktok', connected: false, handle: null, connectedAt: null },
  { platform: 'facebook', connected: true, handle: 'Cebu Dive Co.', connectedAt: '2026-04-12T00:00:00Z' },
  { platform: 'naver', connected: false, handle: null, connectedAt: null },
];
