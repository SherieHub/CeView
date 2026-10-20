/**
 * Which Facebook Page should CeView publish to?
 *
 * One Meta login can administer several Pages, and the Instagram business account CeView
 * publishes to is the one linked to the chosen Page — so the operator picks, rather than
 * the code assuming the first is right.
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../shared/Modal';
import { useToast } from '../shared/Toast';
import { apiClient } from '../../services/apiClient';
import type { MetaPageOption } from '../../types';

export default function PagePickerModal({
  onClose,
  onSelected,
}: {
  onClose: () => void;
  onSelected: () => void;
}) {
  const [pages, setPages] = useState<MetaPageOption[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  // The modal can be dismissed (Cancel, Escape, scrim) while saving is in flight.
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiClient.connections
      .metaPages()
      .then((list) => {
        if (!cancelled) setPages(list);
      })
      .catch(() => {
        if (!cancelled) {
          setPages([]);
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function confirm() {
    if (!selected) return;
    setSaving(true);
    try {
      await apiClient.connections.selectMetaPage(selected);
      if (cancelledRef.current) return;
      showToast('Facebook Page connected');
      onSelected();
    } catch {
      if (cancelledRef.current) return;
      showToast('Could not save that Page. Try again.');
    } finally {
      if (!cancelledRef.current) setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Choose a Facebook Page">
      {pages === null && (
        <div className="flex items-center gap-2 py-6">
          <Loader2 className="animate-spin" size={16} aria-hidden="true" />
          <span className="body-sm">Loading your Pages…</span>
        </div>
      )}

      {loadFailed && (
        <p className="body-sm py-4">
          Could not load your Pages. The connection may have expired — reconnect Facebook and try again.
        </p>
      )}

      {pages !== null && !loadFailed && pages.length === 0 && (
        <p className="body-sm py-4">
          No Facebook Pages are available on this login. You need to be an admin of a Page to publish to
          it — create one or ask for access, then reconnect.
        </p>
      )}

      {pages !== null && pages.length > 0 && (
        <div className="flex flex-col gap-2 py-2" role="radiogroup" aria-label="Facebook Pages">
          {pages.map((page) => (
            <button
              key={page.id}
              type="button"
              role="radio"
              aria-checked={selected === page.id}
              onClick={() => setSelected(page.id)}
              className={`flex items-center justify-between rounded-lg border p-3 text-left ${
                selected === page.id
                  ? 'border-[var(--color-mint-primary)]'
                  : 'border-[var(--color-gray-light)]'
              }`}
            >
              <span className="font-semibold text-navy-dark">{page.name}</span>
              <span className="body-xs text-[var(--color-text-muted)]">
                {page.instagramUsername ? `Instagram: @${page.instagramUsername}` : 'No Instagram account linked'}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-3">
        <button type="button" className="btn-outline--sm" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn-primary" onClick={confirm} disabled={!selected || saving}>
          Use this Page
        </button>
      </div>
    </Modal>
  );
}
