/**
 * CARD — Onboarding: Step 2 Brand Identity
 * Depends on: Card 4 (Wizard Shell & Step 1)
 * Prototype reference: obStepBrand() — ui-ux-prototype.html:2038-2074
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
 *
 * Step 2 of the onboarding wizard — vibe multi-select plus a core-services tag
 * input. No per-chip minimum is enforced here; the >=1 vibe / >=1 service gate
 * lives in obDraft.ts's stepValid() (out of this card's file scope — see the
 * card's flagged gap).
 */
import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useObDraft } from '../obDraft';

const VIBES = [
  'Serene & Restorative',
  'Adventurous',
  'Luxury & Exclusive',
  'Family-Friendly',
  'Eco-Conscious',
  'Local & Authentic',
  'Youthful & Social',
  'Romantic',
];

export default function BrandIdentityStep() {
  const { draft, setDraft } = useObDraft();
  const [tagInput, setTagInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function toggleVibe(vibe: string) {
    const vibes = draft.vibes.includes(vibe)
      ? draft.vibes.filter((v) => v !== vibe)
      : [...draft.vibes, vibe];
    setDraft({ ...draft, vibes });
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = tagInput.trim();
    if (!value || draft.coreServices.includes(value)) return;
    setDraft({ ...draft, coreServices: [...draft.coreServices, value] });
    setTagInput('');
    inputRef.current?.focus();
  }

  function removeService(service: string) {
    setDraft({ ...draft, coreServices: draft.coreServices.filter((s) => s !== service) });
  }

  return (
    <>
      <p className="ob-step-eyebrow">Step 2 — Required</p>
      <h2 className="heading-lg" style={{ margin: '6px 0 8px' }}>
        How should you sound and what do you sell?
      </h2>
      <p className="body-sm" style={{ marginBottom: 24, maxWidth: '56ch' }}>
        Vibe sets the tone of every generated caption. Core services are sorted by the AI into
        primary offerings and unexpected differentiators before any copy is written.
      </p>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="body-xs font-semibold">
            Vibe <span className="text-[var(--color-text-muted)] font-normal">— Pick one or more</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {VIBES.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={draft.vibes.includes(v)}
                onClick={() => toggleVibe(v)}
                className="rounded-full border border-[var(--color-gray-light)] px-3 py-1.5 body-sm aria-pressed:border-[var(--color-mint-primary)] aria-pressed:bg-[var(--color-mint-pale)] aria-pressed:font-semibold"
              >
                {v}
              </button>
            ))}
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="body-xs font-semibold">
            Core services <span className="text-[var(--color-text-muted)] font-normal">— At least one</span>
          </span>
          <div
            className="field-row flex flex-wrap"
            onClick={() => inputRef.current?.focus()}
          >
            {draft.coreServices.map((s) => (
              <span key={s} className="flex items-center gap-1 rounded-full bg-[var(--color-white)] px-2.5 py-1 body-xs">
                {s}
                <button
                  type="button"
                  aria-label={`Remove ${s}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeService(s);
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              type="text"
              className="input min-w-[160px] flex-1"
              placeholder="Type a service and press Enter…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
            />
          </div>
          <span className="body-xs text-[var(--color-text-muted)]">
            e.g. Scuba Diving, Island Hopping, Sunset Cruise, Farm-to-table Dining
          </span>
        </label>
      </div>
    </>
  );
}
