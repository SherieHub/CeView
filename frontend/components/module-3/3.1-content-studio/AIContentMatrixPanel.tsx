import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ContentResponse } from '../../../types';
import { STUDIO_PLATFORMS } from './contentStudioTypes';
import type { StudioPlatformId } from './contentStudioTypes';
import CaptionOptionGrid from './CaptionOptionGrid';

export const PLATFORM_CHAR_LIMITS: Record<StudioPlatformId, number> = {
  instagram: 2200,
  tiktok: 300,
  facebook: 500,
};

export interface AIContentMatrixPanelProps {
  /** Optional controlled tab state supplied by ContentStudioView. */
  activePlatform?: StudioPlatformId;
  onPlatformChange?: (platform: StudioPlatformId) => void;
  /** Called when an option is chosen, to stage it in the composer below. */
  onSelectCaption?: (index: number, text: string) => void;
  /** Index of the staged option for the active platform, or null. */
  selectedOption?: number | null;
  /** Generated content from POST /api/content/generate, owned by ContentStudioView. */
  content?: ContentResponse | null;
  /** True while ContentStudioView's generate() call is in flight. */
  loading?: boolean;
}

/**
 * Platform tabs plus the caption options for the active one.
 *
 * Renders a FRAGMENT, not a card: it shares one card with PublishComposer under
 * a single "Post composer" header, because choosing the copy and attaching the
 * media it publishes with are one piece of work. See ContentStudioView.
 */
export default function AIContentMatrixPanel({
  activePlatform,
  onPlatformChange,
  onSelectCaption,
  selectedOption,
  content,
  loading,
}: AIContentMatrixPanelProps) {
  const [uncontrolledPlatform, setUncontrolledPlatform] = useState<StudioPlatformId>('instagram');
  const platform = activePlatform ?? uncontrolledPlatform;
  const captions = content?.captions[platform];

  const selectPlatform = (next: StudioPlatformId) => {
    if (activePlatform === undefined) setUncontrolledPlatform(next);
    onPlatformChange?.(next);
  };

  return (
    <>
      {/* .seg — the dashboard's segmented control — instead of hand-rolled
          underline tabs. Keeps role="tab"/aria-selected, which is the correct
          semantic for a tab set; the stylesheet matches both that and
          aria-pressed. */}
      <div className="seg seg--wrap" role="tablist" aria-label="Content platform">
        {STUDIO_PLATFORMS.map((item) => {
          const selected = platform === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => selectPlatform(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <p className="studio-note mt-4">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Generating localised captions…
        </p>
      )}

      {!loading && captions && (
        <div className="mt-4">
          <CaptionOptionGrid
            captions={captions}
            selectedIndex={selectedOption ?? null}
            onSelect={(index, text) => onSelectCaption?.(index, text)}
          />
        </div>
      )}

      {!loading && !captions && (
        <p className="studio-note studio-note--line mt-4">
          No generated content yet for this platform.
        </p>
      )}
    </>
  );
}
