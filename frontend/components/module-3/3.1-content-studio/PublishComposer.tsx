import { ImagePlus, Link2, Lock, Trash2 } from 'lucide-react';
import PanelHead from './PanelHead';
import type { PlatformId } from '../../../types';
import { PLATFORM_CHAR_LIMITS } from './AIContentMatrixPanel';
import type { ComposerSlotProps, PublishDraftState } from './contentStudioTypes';
import { useConnections } from '../../../services/connectionsStore';

const PLATFORM_LABELS: Record<PlatformId, string> = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' };

function blockReason(draft: PublishDraftState, audit: ComposerSlotProps['audit']) {
  if (!draft.caption.trim()) return 'Approve or write a caption first.';
  if (!draft.mediaDataUrl) return 'Add a PNG, JPG, or WEBP image first.';
  if (!draft.platforms.length) return 'Choose at least one connected platform.';
  if (!draft.agreementChecked) return 'Confirm publishing authorisation first.';
  if (audit.status === 'running') return 'The compliance audit is still running.';
  if (!audit.result) return 'Complete the compliance audit first.';
  if (audit.result.status !== 'Pass') return 'The current audit needs changes before publishing.';
  return null;
}

export default function PublishComposer({ draft, onDraftChange, audit }: ComposerSlotProps) {
  // Real connection state (Settings -> Platforms), not a hardcoded list — a
  // disconnected platform must not be selectable here (docs/module-3/screens/
  // settings-platforms.md, "State: shared across the app").
  const { isConnected } = useConnections();
  const limit = draft.platforms.length === 1 ? PLATFORM_CHAR_LIMITS[draft.platforms[0]] : 5000;
  const reason = blockReason(draft, audit);
  const updatePlatforms = (platform: PlatformId) => onDraftChange({
    platforms: draft.platforms.includes(platform) ? draft.platforms.filter((item) => item !== platform) : [...draft.platforms, platform],
    agreementChecked: false,
  });
  const readImage = (file: File | undefined) => {
    if (!file || !file.type.match(/^image\/(png|jpeg|webp)$/) || file.size > 20 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => onDraftChange({ mediaDataUrl: String(reader.result), agreementChecked: false });
    reader.readAsDataURL(file);
  };

  return (
    <section className="card" aria-labelledby="publish-composer-title">
      <PanelHead
        icon={<Link2 />}
        titleId="publish-composer-title"
        title="Publish composer"
        subtitle="Prepare the final caption and publishing details."
      />
      <label className="field-label mt-4" htmlFor="staged-caption">Staged caption</label>
      <textarea id="staged-caption" className={`textarea ${draft.caption.length > limit ? 'is-invalid' : ''}`} value={draft.caption} onChange={(event) => onDraftChange({ caption: event.target.value, agreementChecked: false })} placeholder="Approve a matrix option or write your own caption." />
      <p className={`mt-1 text-right text-xs ${draft.caption.length > limit ? 'text-critical' : 'text-[var(--color-text-muted)]'}`}>{draft.caption.length.toLocaleString()} / {limit.toLocaleString()} characters</p>

      <div className="mt-5"><span className="field-label">Publication media</span>{draft.mediaDataUrl ? <div className="relative overflow-hidden rounded-lg border border-gray-light"><img src={draft.mediaDataUrl} alt="Publication media preview" className="h-44 w-full object-cover" /><button type="button" className="icon-btn absolute right-2 top-2 bg-white shadow" onClick={() => onDraftChange({ mediaDataUrl: null, agreementChecked: false })} aria-label="Remove media"><Trash2 size={16} /></button></div> : <label className="upload-zone"><ImagePlus className="upload-glyph" /><span className="font-semibold text-navy-dark">Upload PNG, JPG, or WEBP</span><span className="mt-1 block text-sm text-[var(--color-text-muted)]">Up to 20 MB</span><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => readImage(event.target.files?.[0])} /></label>}</div>

      <fieldset className="mt-5"><legend className="field-label">Publish to</legend><div className="grid grid-cols-2 gap-2">{(Object.keys(PLATFORM_LABELS) as PlatformId[]).map((platform) => <label key={platform} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-light p-3 text-sm font-semibold text-navy-dark"><input type="checkbox" checked={draft.platforms.includes(platform)} disabled={!isConnected(platform)} onChange={() => updatePlatforms(platform)} />{PLATFORM_LABELS[platform]}</label>)}</div></fieldset>
      <div className="mt-5 grid gap-2 sm:grid-cols-3"><label className="text-sm text-navy-dark">Visibility<select className="input mt-1" value={draft.visibility} onChange={(event) => onDraftChange({ visibility: event.target.value as PublishDraftState['visibility'] })}><option value="public">Public</option><option value="private">Private</option></select></label><label className="flex items-center gap-2 pt-6 text-sm text-navy-dark"><input type="checkbox" checked={draft.commentsEnabled} onChange={(event) => onDraftChange({ commentsEnabled: event.target.checked })} />Comments on</label><label className="flex items-center gap-2 pt-6 text-sm text-navy-dark"><input type="checkbox" checked={draft.paidPartnership} onChange={(event) => onDraftChange({ paidPartnership: event.target.checked })} />Paid partnership</label></div>
      <label className="mt-5 flex gap-3 rounded-lg bg-mint-pale p-3 text-sm leading-5 text-navy-dark"><input className="mt-1" type="checkbox" checked={draft.agreementChecked} onChange={(event) => onDraftChange({ agreementChecked: event.target.checked })} /><span><Lock size={15} className="mr-1 inline" />I confirm I am authorised to publish this media and caption. Checking this starts the compliance audit when all inputs are ready.</span></label>
      {reason && <p className="mt-3 text-sm text-[var(--color-text-muted)]" role="status">{reason}</p>}
    </section>
  );
}
