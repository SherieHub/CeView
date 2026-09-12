/**
 * Which ad account should CeView report on?
 *
 * A Meta login commonly exposes several ad accounts — personal, agency, a test
 * account — and TikTok exposes every advertiser the grant covers. Auto-picking
 * the first is silently wrong for anyone with more than one, and the platforms
 * do not document their ordering as stable, so the operator chooses.
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../shared/Modal';
import { useToast } from '../shared/Toast';
import { apiClient } from '../../services/apiClient';
import type { AdAccountOption, AdProvider } from '../../types';

const PROVIDER_LABELS: Record<AdProvider, string> = {
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
};

export default function AdAccountPickerModal({
  provider,
  onClose,
  onSelected,
}: {
  provider: AdProvider;
  onClose: () => void;
  onSelected: () => void;
}) {
  const [accounts, setAccounts] = useState<AdAccountOption[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  // Guards state updates in confirm() against the modal being dismissed
  // (Cancel, Escape, scrim click — none of which are disabled while saving)
  // while selectAccount() is still in flight.
  const cancelledRef = useRef(false);
  useEffect(
    () => () => {
      cancelledRef.current = true;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    apiClient.adConnections
      .accounts(provider)
      .then((list) => {
        if (!cancelled) setAccounts(list);
      })
      .catch(() => {
        if (!cancelled) {
          setAccounts([]);
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  async function confirm() {
    if (!selected) return;
    setSaving(true);
    try {
      await apiClient.adConnections.selectAccount(provider, selected);
      if (cancelledRef.current) return;
      showToast(`${PROVIDER_LABELS[provider]} connected`);
      onSelected();
    } catch {
      if (cancelledRef.current) return;
      showToast('Could not save that ad account. Try again.');
    } finally {
      if (!cancelledRef.current) setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Choose a ${PROVIDER_LABELS[provider]} account`}>
      {accounts === null && (
        <div className="flex items-center gap-2 py-6">
          <Loader2 className="animate-spin" size={16} aria-hidden="true" />
          <span className="body-sm">Loading your ad accounts…</span>
        </div>
      )}

      {loadFailed && (
        <p className="body-sm py-4">
          Could not load your ad accounts. The connection may have expired — disconnect and
          connect again.
        </p>
      )}

      {accounts !== null && !loadFailed && accounts.length === 0 && (
        <p className="body-sm py-4">
          No ad accounts are available on this connection. Create one in the platform’s Ads
          Manager first, then reconnect.
        </p>
      )}

      {accounts !== null && accounts.length > 0 && (
        <div className="flex flex-col gap-2 py-2" role="radiogroup" aria-label="Ad accounts">
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              role="radio"
              aria-checked={selected === account.id}
              onClick={() => setSelected(account.id)}
              className={`flex items-center justify-between rounded-lg border p-3 text-left ${
                selected === account.id
                  ? 'border-[var(--color-mint-primary)]'
                  : 'border-[var(--color-gray-light)]'
              }`}
            >
              <span className="font-semibold text-navy-dark">{account.name ?? account.id}</span>
              <span className="body-xs text-[var(--color-text-muted)]">
                {account.currency ?? '—'}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-3">
        <button type="button" className="btn-outline--sm" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={confirm}
          disabled={!selected || saving}
        >
          Use this account
        </button>
      </div>
    </Modal>
  );
}
