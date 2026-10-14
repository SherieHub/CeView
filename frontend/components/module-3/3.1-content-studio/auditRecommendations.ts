import type { ContentResponse } from '../../../types';
import type { StudioPlatformId } from './contentStudioTypes';

/**
 * The visual-guide recommendations the compliance audit judges the image against.
 *
 * - A staged caption option contributes its own generation metadata (core business
 *   context, localisation, psychology, tone, platform architecture).
 * - The platform's visual guide is added whenever the platform has one, so a caption
 *   the operator typed themselves is still audited against real guidance.
 * - With no generated content for the platform there is nothing to audit against: null.
 *   The audit never runs on an empty set — the backend would reject it with a 424.
 */
export function auditRecommendations(
  content: ContentResponse | null,
  platform: StudioPlatformId,
  selectedOption: number | null,
): Record<string, unknown> | null {
  const captions = content?.captions[platform];
  if (!captions) return null;

  const metadata = selectedOption === null ? undefined : captions.optionMetadata?.[selectedOption];
  const recommendations: Record<string, unknown> = {
    ...(metadata ?? {}),
    ...(captions.guide?.length ? { visual_guide: captions.guide } : {}),
  };
  return Object.keys(recommendations).length > 0 ? recommendations : null;
}
