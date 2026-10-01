/**
 * CARD — Settings: Business Profile
 * Depends on: Foundation — Shell & Routing, Foundation — Fixture Data Layer
 * Prototype reference: ui-ux-prototype.html:4217–4265 (renderSettings()'s profile
 *   panel), :4239–4251 (pfSet / pfSave / pfToggleCategory)
 * Screen doc: docs/module-1/screens/settings-business-profile.md
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
 *
 * Route: /settings/profile — the only place an operator edits their business
 * profile after onboarding. Same field set as onboarding steps 1–3, minus the
 * wizard's step gating: every field is independently editable, one Save.
 *
 * Styling follows BasicInfoStep.tsx's precedent — the existing styles/index.css
 * primitives (.card/.field/.field-label/.opt/.input/.btn-primary) where they
 * exist, hand-rolled Tailwind for the prototype's .chip/.chip-grid/.textarea/
 * .m-avatar, which aren't defined in styles/index.css yet and belong to the
 * Design System card rather than this one.
 */
import { Save } from 'lucide-react';
import { useState } from 'react';
import { BUSINESS_CATEGORIES } from '../module-1/onboarding/steps/BasicInfoStep';
import { useToast } from '../shared/Toast';
import { apiClient } from '../../services/apiClient';
import { useProfile } from '../../services/profileContext';
import type { BusinessProfile } from '../../types';

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

export default function BusinessProfileSettings() {
  const { profile, setProfile } = useProfile();
  const { showToast } = useToast();
  const [form, setForm] = useState<BusinessProfile>(profile);

  /** Mirrors onboarding step 5's rule: removing the last category is blocked with a toast, not a disabled chip. */
  function toggleCategory(name: string) {
    const selected = form.categories.includes(name);
    if (selected && form.categories.length === 1) {
      showToast('At least one category must stay selected');
      return;
    }
    setForm({
      ...form,
      categories: selected
        ? form.categories.filter((c) => c !== name)
        : [...form.categories, name],
    });
  }

  async function handleSave() {
    // KNOWN GAP (card + screen doc, flagged not resolved): saving here does not
    // recompute the uniqueness score, though the copy under Save says it does.
    // Either Save should run step 5's analyze -> uniqueness round-trip, or the
    // copy should be corrected — product/backend call, raise in review.
    //
    await apiClient.businessProfile.save(form);

    setProfile(form); // re-syncs the sidebar identity block without a page reload
    showToast('Business profile saved — embedding refreshed');
  }

  return (
    <div className="card p-6">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-[var(--color-navy-primary)] text-lg font-semibold text-[var(--color-text-inverse)]">
          {initials(profile.businessName)}
        </div>
        <div className="min-w-[180px] flex-1">
          <h3 className="heading-md">{profile.businessName}</h3>
          <p className="body-xs">{profile.industry || 'No industry set'}</p>
        </div>
        {/*
          Only the Uniqueness chip: the prototype also shows Semantics and
          Category chips, but BusinessProfile (types.ts, Fixture Data Layer's
          file) carries no semanticsScore/categoryScore field yet.
        */}
        {profile.uniquenessScore != null && (
          // Stored 0–1 (matches the DB column); formatted to a human 0–100
          // figure only here, at the display edge.
          <span className="rounded-full border border-[var(--color-gray-light)] px-3 py-1 body-xs font-semibold">
            Uniqueness {Math.round(profile.uniquenessScore * 100)}
          </span>
        )}
      </div>

      <label className="field">
        <span className="field-label">Business name</span>
        <input
          className="input"
          value={form.businessName}
          onChange={(e) => setForm({ ...form, businessName: e.target.value })}
        />
      </label>

      <label className="field">
        <span className="field-label">Slogan</span>
        <input
          className="input"
          value={form.slogan}
          onChange={(e) => setForm({ ...form, slogan: e.target.value })}
        />
      </label>

      <div className="field">
        <span className="field-label">
          Tourism categories <span className="opt">At least one</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {BUSINESS_CATEGORIES.map((c) => {
            const selected = form.categories.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleCategory(c)}
                className={`rounded-full border px-3 py-1.5 body-xs ${
                  selected
                    ? 'border-[var(--color-mint-primary)] bg-[var(--color-mint-pale)] font-semibold'
                    : 'border-[var(--color-gray-light)]'
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Read-only here by design — editing core services is not exposed on this screen. */}
      <div className="field">
        <span className="field-label">Core services</span>
        <div className="flex flex-wrap gap-2">
          {form.coreServices.map((s) => (
            <span key={s} className="badge badge--teal">
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Word counts are shown for reference; unlike onboarding step 3 they gate nothing here. */}
      <label className="field">
        <span className="field-label">
          Full description <span className="opt">{wordCount(form.description)} words</span>
        </span>
        <textarea
          className="input min-h-[140px]"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </label>

      <label className="field">
        <span className="field-label">
          Unique value proposition <span className="opt">{wordCount(form.uvp)} words</span>
        </span>
        <textarea
          className="input min-h-[100px]"
          value={form.uvp}
          onChange={(e) => setForm({ ...form, uvp: e.target.value })}
        />
      </label>

      <label className="field">
        <span className="field-label">Website</span>
        <input
          className="input"
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
        />
      </label>

      <button type="button" className="btn-primary" onClick={handleSave}>
        <Save size={16} /> Save changes
      </button>
      <p className="body-xs" style={{ marginTop: 9 }}>
        Saving re-embeds your profile, which changes your uniqueness score against the current Cebu
        MSME corpus.
      </p>
    </div>
  );
}
