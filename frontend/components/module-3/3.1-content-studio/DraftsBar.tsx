/**
 * The strip above Quick Post: where the draft stands ("Draft saved · 2 min ago") and, at the top
 * right, Regenerate (caption step only), Drafts and Save draft. Also the notice shown when a
 * restored draft was made for an earlier surge window or an older profile.
 */
import { useEffect, useState } from 'react';
import { FolderOpen, RefreshCw } from 'lucide-react';
import SaveDraftButton from './SaveDraftButton';
import type { SaveStatus } from './useContentDrafts';

type QuickSaveProps = Omit<Parameters<typeof SaveDraftButton>[0], 'className'>;

function savedAgo(at: Date, now = Date.now()): string {
  const minutes = Math.floor((now - at.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return at.toLocaleDateString();
}

export default function DraftsBar({
  status,
  savedAt,
  namedCount,
  stale,
  hasWork,
  regenerating,
  showRegenerate = true,
  cooldownSeconds = 0,
  quickSave,
  onOpenDrafts,
  onRegenerate,
  onRetry,
}: {
  status: SaveStatus;
  savedAt: Date | null;
  namedCount: number;
  stale: boolean;
  /** The operator has a caption in the composer, so regenerating would replace the options they chose from. */
  hasWork: boolean;
  regenerating: boolean;
  /** Regenerate belongs to the caption step; on the others it (and the notice pointing at it) is hidden. */
  showRegenerate?: boolean;
  /** Seconds left before captions may be generated again; Regenerate waits while above zero. */
  cooldownSeconds?: number;
  /** The one-click Save draft, shown as the primary action at the far right when provided. */
  quickSave?: QuickSaveProps;
  onOpenDrafts: () => void;
  onRegenerate: () => void;
  onRetry: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const cooling = cooldownSeconds > 0;

  // Leaving the caption step (or starting a wait) abandons a half-answered "Replace these captions?".
  useEffect(() => {
    if (!showRegenerate || cooling) setConfirming(false);
  }, [showRegenerate, cooling]);

  const regenerate = () => {
    if (hasWork && !confirming) { setConfirming(true); return; }
    setConfirming(false);
    onRegenerate();
  };

  return (
    <div className="ds-wrap">
      <div className="ds-bar">
        <p className="ds-status" role="status" aria-live="polite" data-status={status}>
          {status === 'saving' && 'Saving draft…'}
          {status === 'error' && (
            <>
              Couldn’t save your draft.{' '}
              <button type="button" className="link-inline" onClick={onRetry}>Retry</button>
            </>
          )}
          {(status === 'saved' || status === 'idle') && (savedAt ? `Draft saved · ${savedAgo(savedAt)}` : 'Your work saves automatically')}
        </p>
        <div className="ds-actions">
          {showRegenerate && (confirming ? (
            <span className="ds-confirm" role="group" aria-label="Confirm regenerate">
              <span>Replace these captions?</span>
              <button type="button" className="btn-outline btn-outline--sm" onClick={regenerate}>Regenerate</button>
              <button type="button" className="link-inline" onClick={() => setConfirming(false)}>Cancel</button>
            </span>
          ) : (
            <button
              type="button"
              className="btn-outline btn-outline--sm"
              onClick={regenerate}
              disabled={regenerating || cooling}
              title={cooling ? 'Caption generation is spaced out so the AI model’s rate limit isn’t hit' : undefined}
            >
              <RefreshCw size={15} aria-hidden="true" />
              {regenerating ? 'Generating…' : `Regenerate captions${cooling ? ` (${cooldownSeconds}s)` : ''}`}
            </button>
          ))}
          <button type="button" className="btn-outline btn-outline--sm" onClick={onOpenDrafts}>
            <FolderOpen size={15} aria-hidden="true" />
            Drafts{namedCount > 0 ? ` (${namedCount})` : ''}
          </button>
          {quickSave && <SaveDraftButton {...quickSave} />}
        </div>
      </div>
      {stale && showRegenerate && (
        <p className="ds-stale" role="note">
          These captions were generated for an earlier surge window or an older version of your profile. Keep editing
          them, or regenerate for the latest.
        </p>
      )}
    </div>
  );
}
