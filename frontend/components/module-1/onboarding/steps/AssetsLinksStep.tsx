/**
 * CARD — Onboarding: Step 4 Assets & Links
 * Depends on: Card 4 (Wizard Shell & Step 1)
 * Prototype reference: obStepAssets() — ui-ux-prototype.html:2110–2158
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
 *
 * Structure, field order and copy follow the prototype; all visual treatment
 * follows the tourism-app-branding skill (see
 * docs/superpowers/plans/2026-08-15-frontend-branding-alignment.md for the
 * precedence rule).
 *
 * Every field on this step is optional — there is no validity gate, so
 * Continue stays enabled regardless of what is filled in.
 */
import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import type { ComponentType } from "react";
import { Facebook, ImageUp, Instagram } from "lucide-react";
import { TikTokGlyph } from "../../../shared/PlatformGlyphs";
import { useObDraft } from "../obDraft";
import type { PlatformId } from "../../../../types";

interface PlatformMeta {
  platform: PlatformId;
  label: string;
  /** Widened from LucideIcon so the local brand glyphs fit the same shape. */
  icon: ComponentType<{ size?: number }>;
}

/**
 * Transcribed from ui-ux-prototype.html:1086–1091 (PLATFORM_META).
 *
 * TikTok uses a local mark from shared/PlatformGlyphs — lucide has no icon for
 * it, so the prototype stood in `music`, which is not the logo.
 *
 * KNOWN FOLLOW-UP: Instagram and Facebook are still lucide's brand icons,
 * which are deprecated and due for removal in lucide v1.0. They are at least
 * the correct marks today; when they go, add them to PlatformGlyphs the same
 * way.
 */
const PLATFORM_META: PlatformMeta[] = [
  { platform: "instagram", label: "Instagram", icon: Instagram },
  { platform: "tiktok", label: "TikTok", icon: TikTokGlyph },
  { platform: "facebook", label: "Facebook", icon: Facebook },
];

export default function AssetsLinksStep() {
  const { draft, setDraft } = useObDraft();
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setDraft({
        ...draft,
        logo: typeof reader.result === "string" ? reader.result : null,
      });
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handlePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      <div className="ob-step-intro">
        <p className="ob-step-eyebrow">Step 4 · All optional</p>
        <h2 className="heading-lg">Assets and links</h2>
        {/* No 56ch prose cap here — this is a one-line intro, not running
            prose, and the cap forced an awkward two-line wrap. It still wraps
            naturally below the content width on narrow screens. */}
        <p className="body-sm">
          Connect the accounts you publish to. You can add or change any of this later in Settings
          → Platforms.
        </p>
      </div>

      <div className="field">
        <span className="field-label">Social profiles</span>
        {PLATFORM_META.map(({ platform, label, icon: Icon }) => (
          <div key={platform} className="field-row mb-3">
            <span className="conn-ico">
              <Icon size={18} aria-hidden="true" />
            </span>
            <input
              className="input"
              value={draft.socials[platform]}
              placeholder={`${label} handle or page name`}
              aria-label={`${label} handle or page name`}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  socials: { ...draft.socials, [platform]: e.target.value },
                })
              }
            />
          </div>
        ))}
      </div>

      <div className="grid gap-12 md:grid-cols-2">
        <div className="field">
          <span className="field-label">
            <span>Logo</span>
            <span className="opt">Optional</span>
          </span>
          <div
            className="upload-zone"
            data-drag={dragOver}
            role="button"
            tabIndex={0}
            aria-label="Upload logo"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {draft.logo ? (
              <>
                <img
                  src={draft.logo}
                  alt="Logo preview"
                  className="mx-auto mb-2 max-h-[78px] rounded-sm"
                />
                <p className="text-meta">Logo added — click to replace</p>
              </>
            ) : (
              <>
                <span className="upload-glyph">
                  <ImageUp size={20} aria-hidden="true" />
                </span>
                <p className="heading-sm">Drop your logo</p>
                <p className="text-meta mt-2">PNG, JPG or SVG</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            data-testid="logo-input"
            onChange={handlePick}
          />
        </div>

        <label className="field">
          <span className="field-label">
            <span>Website</span>
            <span className="opt">Optional</span>
          </span>
          <input
            className="input"
            value={draft.website}
            placeholder="https://"
            onChange={(e) => setDraft({ ...draft, website: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
