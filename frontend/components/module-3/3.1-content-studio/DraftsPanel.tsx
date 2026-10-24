/**
 * The Drafts drawer: save the current captions and direction under a name, and open,
 * rename or delete the ones saved earlier for this market. Replacing the caption being
 * worked on, and deleting, each ask first.
 */
import { useId, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import Drawer from '../../shared/Drawer';
import type { ContentDraftSummary } from '../../../types';

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Whether a draft can be published as it stands: an attached image and a passing audit. Shown
 * as a badge so the operator can see which drafts are finished without opening each one.
 */
export function DraftReadiness({ draft }: { draft: ContentDraftSummary }) {
  const { hasMedia, auditStatus, auditScore } = draft;
  // A backend that predates saved media sends none of these; say nothing rather than guess.
  if (hasMedia === undefined && auditStatus === undefined) return null;

  if (hasMedia && auditStatus === 'Pass') {
    return <p className="ds-ready" data-ready="true">Ready to publish{auditScore != null ? ` · ${auditScore}` : ''}</p>;
  }
  const missing: string[] = [];
  if (!hasMedia) missing.push('No image');
  if (auditStatus === 'Fail') missing.push(`Audit failed${auditScore != null ? ` · ${auditScore}` : ''}`);
  else if (!auditStatus) missing.push('No audit yet');
  return <p className="ds-ready" data-ready="false">{missing.join(' · ')}</p>;
}

export default function DraftsPanel({
  open,
  onClose,
  marketName,
  drafts,
  loadFailed,
  hasWork,
  canSave,
  currentDraftId = null,
  onSave,
  onOpen,
  onRename,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  marketName: string;
  drafts: ContentDraftSummary[];
  loadFailed: boolean;
  /** A caption is in the composer — opening a draft would replace it. */
  hasWork: boolean;
  /** There is something to save (captions have been generated). */
  canSave: boolean;
  /** The saved draft the work on screen is, if any — tagged "Current" in the list. */
  currentDraftId?: string | null;
  /** Saves a separate copy. Resolves with `alreadySavedAs` when identical work was already saved. */
  onSave: (name: string) => Promise<{ alreadySavedAs?: string } | void>;
  onOpen: (id: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const ids = useId();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const run = async (task: () => Promise<void>, failure: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await task();
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      const result = await onSave(name.trim());
      if (result && result.alreadySavedAs) {
        // Nothing was added: this exact work is already a saved draft.
        setNotice(`This is already saved as “${result.alreadySavedAs}”, so nothing new was added.`);
        return;
      }
      setName('');
    }, 'Couldn’t save this draft. You may have reached the limit of 20 drafts for this market.');

  const openDraft = (id: string) =>
    run(async () => {
      await onOpen(id);
      setConfirmOpen(null);
      onClose();
    }, 'Couldn’t open that draft.');

  return (
    <Drawer open={open} onClose={onClose} label="Drafts">
      <div className="ds-panel">
        <div className="pr-12">
          <h2 className="heading-md">Drafts</h2>
          <p className="body-sm mt-1">
            Save the captions and content direction you’re working on for {marketName}, and come back to them later.
          </p>
        </div>

        <form
          className="ds-save"
          onSubmit={(e) => { e.preventDefault(); if (name.trim() && canSave) void save(); }}
        >
          <label className="pubx-field" htmlFor={`${ids}-name`}>
            <span>Save current as</span>
            <input
              id={`${ids}-name`}
              value={name}
              maxLength={120}
              placeholder="e.g. Golden hour dive promo"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary btn-primary--sm" disabled={busy || !name.trim() || !canSave}>
            Save draft
          </button>
        </form>
        {!canSave && <p className="pubx-hint">Captions appear here to save once they’re generated.</p>}

        {notice && <p className="ds-notice" role="status">{notice}</p>}
        {error && <p className="ds-error" role="alert">{error}</p>}
        {loadFailed && <p className="ds-error" role="alert">Couldn’t load your saved drafts.</p>}

        <h3 className="heading-sm">Saved drafts for {marketName}</h3>
        {drafts.length === 0 ? (
          <p className="body-sm ds-empty">No saved drafts yet.</p>
        ) : (
          <ul className="ds-list">
            {drafts.map((d) => (
              <li key={d.id} className="ds-item">
                {renaming?.id === d.id ? (
                  <form
                    className="ds-rename"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!renaming.name.trim()) return;
                      void run(async () => { await onRename(d.id, renaming.name.trim()); setRenaming(null); }, 'Couldn’t rename that draft.');
                    }}
                  >
                    <input
                      aria-label={`New name for ${d.name}`}
                      value={renaming.name}
                      maxLength={120}
                      autoFocus
                      onChange={(e) => setRenaming({ id: d.id, name: e.target.value })}
                    />
                    <button type="submit" className="btn-primary btn-primary--sm" disabled={busy}>Save</button>
                    <button type="button" className="link-inline" onClick={() => setRenaming(null)}>Cancel</button>
                  </form>
                ) : (
                  <>
                    {d.mediaUrl && <img className="ds-item-thumb" src={d.mediaUrl} alt="" loading="lazy" />}
                    <div className="ds-item-main">
                      <p className="ds-item-name">
                        {d.name}
                        {d.id === currentDraftId && <span className="ds-current">Current</span>}
                      </p>
                      <DraftReadiness draft={d} />
                      <p className="ds-item-meta">{when(d.updatedAt)}</p>
                      {d.captionPreview && <p className="ds-item-preview">{d.captionPreview}</p>}
                    </div>
                    <div className="ds-item-acts">
                      {confirmOpen === d.id ? (
                        <span className="ds-confirm" role="group" aria-label={`Replace caption with ${d.name}`}>
                          <span>Replace your current caption?</span>
                          <button type="button" className="btn-primary btn-primary--sm" disabled={busy} onClick={() => void openDraft(d.id)}>
                            Replace
                          </button>
                          <button type="button" className="link-inline" onClick={() => setConfirmOpen(null)}>Cancel</button>
                        </span>
                      ) : confirmDelete === d.id ? (
                        <span className="ds-confirm" role="group" aria-label={`Delete ${d.name}`}>
                          <span>Delete this draft?</span>
                          <button
                            type="button"
                            className="btn-outline btn-outline--sm"
                            disabled={busy}
                            onClick={() => void run(async () => { await onRemove(d.id); setConfirmDelete(null); }, 'Couldn’t delete that draft.')}
                          >
                            Delete
                          </button>
                          <button type="button" className="link-inline" onClick={() => setConfirmDelete(null)}>Cancel</button>
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-outline btn-outline--sm"
                            aria-label={`Open ${d.name}`}
                            disabled={busy}
                            onClick={() => (hasWork ? setConfirmOpen(d.id) : void openDraft(d.id))}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Rename ${d.name}`}
                            onClick={() => setRenaming({ id: d.id, name: d.name })}
                          >
                            <Pencil size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Delete ${d.name}`}
                            onClick={() => setConfirmDelete(d.id)}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Drawer>
  );
}
