/**
 * "Edit cover photo" — a small menu on the dashboard banner: upload a photo,
 * go back to the default, and (while the default is showing) its credit,
 * which its CC BY licence requires to be available to viewers.
 */
import { useCallback, useRef, useState } from 'react';
import { ImagePlus, RotateCcw, Upload } from 'lucide-react';
import { imageFor } from '../../../content/image-credits';
import { useDismiss } from '../../shared/useDismiss';
import { useToast } from '../../shared/Toast';

const DEFAULT_COVER = imageFor('product-malapascua-beach');

interface CoverPhotoMenuProps {
  isCustom: boolean;
  onPick: (file: File) => Promise<boolean>;
  onReset: () => void;
}

export default function CoverPhotoMenu({ isCustom, onPick, onReset }: CoverPhotoMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(wrapRef, open, close, triggerRef);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const ok = await onPick(file);
    showToast(ok ? 'Cover photo updated' : 'That file could not be used as a photo');
  }

  return (
    <div className="cover-edit" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="cover-edit-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <ImagePlus size={16} strokeWidth={1.75} aria-hidden="true" />
        Edit cover photo
      </button>

      {open && (
        <div className="cover-edit-menu" role="menu" aria-label="Cover photo">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              fileRef.current?.click();
            }}
          >
            <Upload size={16} strokeWidth={1.75} aria-hidden="true" />
            Upload a new photo
          </button>
          {isCustom && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onReset();
                close();
                showToast('Cover photo reset to the default');
              }}
            >
              <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
              Use the default photo
            </button>
          )}
          {!isCustom && (
            <p className="cover-edit-credit">
              Current photo:{' '}
              <a href={DEFAULT_COVER.sourceUrl} target="_blank" rel="noopener noreferrer">
                {DEFAULT_COVER.photographer}
              </a>
              , {DEFAULT_COVER.license}
            </p>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        data-testid="cover-photo-input"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
