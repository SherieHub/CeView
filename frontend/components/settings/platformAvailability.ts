import type { AdProvider, PlatformId } from '../../types';

/**
 * Platforms whose connection is still being built. Settings shows them as "In development"
 * instead of offering Connect, while an account that is already connected can still be
 * disconnected. Remove a platform from this list to switch its Connect button back on.
 */
const IN_DEVELOPMENT: ReadonlySet<PlatformId | AdProvider> = new Set(['tiktok']);

export function isInDevelopment(platform: PlatformId | AdProvider): boolean {
  return IN_DEVELOPMENT.has(platform);
}

export const IN_DEVELOPMENT_LABEL = 'In development';
export const IN_DEVELOPMENT_SUBTITLE = 'Coming soon. Facebook and Instagram are available now.';
