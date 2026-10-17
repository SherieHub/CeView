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
 * Layout: the form in one card of titled sections; beside it the business as
 * travellers see it (the dashboard's cover photo, initials, uniqueness), how
 * complete the profile is, and a few writing tips.
 */
import { useCallback, useRef, useState } from 'react';
import {
  Building2, Camera, Check, ChevronRight, FileText, Globe, ImagePlus, Info, Layers, Lightbulb, Link2, Save, Settings2, Star, Tag, Trash2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { BUSINESS_CATEGORIES } from '../module-1/onboarding/steps/BasicInfoStep';
import { useCoverPhoto } from '../module-2/2.1-dashboard/useCoverPhoto';
import { LandingImage } from '../landing/ui';
import { useDismiss } from '../shared/useDismiss';
import { useToast } from '../shared/Toast';
import { MAX_PHOTO_BYTES, readProfilePhoto } from './profilePhoto';
import { apiClient } from '../../services/apiClient';
import { useProfile } from '../../services/profileContext';
import type { BusinessProfile } from '../../types';
import './business-profile.css';

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

/** What "complete" means here: every field this page edits, filled in. */
function checklist(p: BusinessProfile): Array<{ label: string; done: boolean }> {
  return [
    { label: 'Business name', done: Boolean(p.businessName.trim()) },
    { label: 'Core services', done: p.coreServices.length > 0 },
    { label: 'Slogan', done: Boolean(p.slogan.trim()) },
    { label: 'Tourism categories', done: p.categories.length > 0 },
    { label: 'Business description', done: Boolean(p.description.trim()) },
    { label: 'Unique value proposition', done: Boolean(p.uvp.trim()) },
    { label: 'Website', done: Boolean(p.website.trim()) },
  ];
}

const TIPS = [
  {
    title: 'Tips for a stronger profile',
    body: 'Clear and specific information helps travellers find and trust your business, and can improve your uniqueness score.',
  },
  {
    title: 'Name what only you have',
    body: 'A guide team, a house reef, a family recipe — concrete details set you apart from the businesses around you.',
  },
  {
    title: 'Write for the traveller',
    body: 'Say what a visitor will see, eat or do. Short sentences read better in every language your posts go out in.',
  },
];

function Section({ icon, title, sub, aside, id, children }: {
  icon: ReactNode; title: string; sub: string; aside?: ReactNode; id?: string; children: ReactNode;
}) {
  return (
    <section className="bp-sec" aria-labelledby={id}>
      <div className="bp-sec-head">
        <span className="bp-sec-icon" aria-hidden="true">{icon}</span>
        <div className="bp-sec-titles">
          <h2 className="bp-sec-title" id={id}>{title}</h2>
          <p className="bp-sec-sub">{sub}</p>
        </div>
        {aside && <span className="bp-sec-aside">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 40;
  const len = 2 * Math.PI * r;
  return (
    <div className="bp-ring">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} className="bp-ring-track" />
        {pct > 0 && <circle cx="50" cy="50" r={r} className="bp-ring-fill" strokeDasharray={`${(pct / 100) * len} ${len}`} />}
      </svg>
      <span className="num">{pct}%</span>
    </div>
  );
}

/**
 * The profile photo on the identity card: click it to upload or remove. The
 * pick goes into the form, so like every other field it is kept on Save.
 */
function AvatarEditor({ name, photo, unsaved, onChange }: {
  name: string; photo: string | null; unsaved: boolean; onChange: (photo: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(wrapRef, open, close, triggerRef);

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Choose an image file (PNG, JPG or WEBP)');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      showToast('That photo is over 5 MB — choose a smaller one');
      return;
    }
    try {
      onChange(await readProfilePhoto(file));
    } catch {
      showToast('That file could not be used as a photo');
    }
  }

  return (
    <div className="bp-avatar-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="bp-avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={photo ? 'Change profile photo' : 'Add profile photo'}
        onClick={() => setOpen((o) => !o)}
      >
        {photo ? <img src={photo} alt="" /> : <span aria-hidden="true">{initials(name)}</span>}
        <span className="bp-avatar-badge" aria-hidden="true"><Camera size={13} /></span>
      </button>
      {unsaved && <span className="bp-avatar-note">Unsaved — Save changes to keep it</span>}
      {open && (
        <div className="bp-avatar-menu" role="menu" aria-label="Profile photo">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); fileRef.current?.click(); }}>
            <ImagePlus size={15} aria-hidden="true" /> {photo ? 'Upload a new photo' : 'Upload a photo'}
          </button>
          {photo && (
            <button type="button" role="menuitem" onClick={() => { setOpen(false); onChange(null); }}>
              <Trash2 size={15} aria-hidden="true" /> Remove photo
            </button>
          )}
          <p className="bp-avatar-hint">Square images look best. PNG, JPG or WEBP, up to 5 MB.</p>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        data-testid="profile-photo-input"
        onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }}
      />
    </div>
  );
}

export default function BusinessProfileSettings() {
  const { profile, setProfile } = useProfile();
  const { showToast } = useToast();
  const [form, setForm] = useState<BusinessProfile>(profile);
  const [tip, setTip] = useState(0);
  const cover = useCoverPhoto(profile.businessProfileId);
  const websiteRef = useRef<HTMLInputElement>(null);
  const sloganRef = useRef<HTMLInputElement>(null);

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

  // The checklist follows the form as it is typed into; the identity card
  // shows the saved profile, so it changes only on Save.
  const items = checklist(form);
  const pct = Math.round((items.filter((i) => i.done).length / items.length) * 100);
  const focus = (el: HTMLInputElement | null) => {
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus({ preventScroll: true });
  };

  return (
    <div className="bp">
      <header className="bp-head">
        <p className="bp-eyebrow">My business</p>
        <h1 className="bp-heading">Business Profile</h1>
        <p className="bp-subhead">Tell your story and help travellers discover what makes your business special.</p>
      </header>

      <div className="bp-layout">
        <div className="bp-card bp-form">
          <Section icon={<Building2 size={18} />} title="Basic Information" sub="This is how your business appears on CeView.">
            <div className="bp-two">
              <label className="bp-field">
                <span className="bp-label">Business name</span>
                <input
                  className="bp-input"
                  value={form.businessName}
                  onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                />
              </label>
              <label className="bp-field">
                <span className="bp-label">Slogan <span className="bp-opt">(optional)</span></span>
                <input
                  ref={sloganRef}
                  className="bp-input"
                  value={form.slogan}
                  placeholder="Add a short slogan for your business…"
                  onChange={(e) => setForm({ ...form, slogan: e.target.value })}
                />
              </label>
            </div>
          </Section>

          <Section
            icon={<Tag size={18} />}
            title="Tourism Categories"
            sub="Select all categories that apply to your business."
            aside="At least one"
          >
            <div className="bp-chips">
              {BUSINESS_CATEGORIES.map((c) => {
                const selected = form.categories.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    className="bp-chip"
                    aria-pressed={selected}
                    onClick={() => toggleCategory(c)}
                  >
                    {selected && <Check size={14} aria-hidden="true" />}
                    {c}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Read-only here by design — editing core services is not exposed on this screen. */}
          <Section icon={<Settings2 size={18} />} title="Core Services" sub="What are your main products or services?">
            {form.coreServices.length ? (
              <ul className="bp-chips">
                {form.coreServices.map((s) => (
                  <li key={s} className="bp-chip bp-chip--static">
                    <Check size={14} aria-hidden="true" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="bp-empty">No core services yet — they come from onboarding.</p>
            )}
          </Section>

          {/* Word counts are shown for reference; unlike onboarding step 3 they gate nothing here. */}
          <Section
            id="bp-story"
            icon={<FileText size={18} />}
            title="Brand Story"
            sub="Tell travellers about your business, what you offer, and what makes it special."
            aside={<><span className="num">{wordCount(form.description)}</span> words</>}
          >
            <textarea
              className="bp-input bp-textarea"
              aria-labelledby="bp-story"
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Section>

          <Section
            id="bp-uvp"
            icon={<Star size={18} />}
            title="Unique Value Proposition"
            sub="What makes your business unique? Keep it concise and specific."
            aside={<><span className="num">{wordCount(form.uvp)}</span> words</>}
          >
            <textarea
              className="bp-input bp-textarea bp-textarea--short"
              aria-labelledby="bp-uvp"
              rows={2}
              value={form.uvp}
              onChange={(e) => setForm({ ...form, uvp: e.target.value })}
            />
          </Section>

          <section className="bp-sec bp-sec--inline">
            <div className="bp-sec-head">
              <span className="bp-sec-icon" aria-hidden="true"><Link2 size={18} /></span>
              <div className="bp-sec-titles">
                <h2 className="bp-sec-title">
                  <label htmlFor="bp-website">Website</label>
                </h2>
                <p className="bp-sec-sub">Add your website so travellers can learn more (optional).</p>
              </div>
            </div>
            <div className="bp-url">
              <Globe size={16} aria-hidden="true" />
              <input
                id="bp-website"
                ref={websiteRef}
                className="bp-input"
                type="url"
                placeholder="https://"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>
          </section>

          <div className="bp-foot">
            <button type="button" className="bp-save" onClick={handleSave}>
              <Save size={16} aria-hidden="true" /> Save changes
            </button>
            <p className="bp-foot-note">
              Saving re-embeds your profile, which changes your uniqueness score against the current Cebu
              MSME corpus.
            </p>
          </div>
        </div>

        <aside className="bp-aside">
          <div className="bp-card bp-id">
            <div className="bp-cover" aria-hidden="true">
              {cover.custom ? (
                <img src={cover.custom} alt="" />
              ) : (
                <LandingImage slot="product-malapascua-beach" fill decorative sizes="360px" />
              )}
            </div>
            <div className="bp-id-body">
              <AvatarEditor
                name={profile.businessName}
                photo={form.imagePreview}
                unsaved={form.imagePreview !== profile.imagePreview}
                onChange={(imagePreview) => setForm({ ...form, imagePreview })}
              />
              <div className="bp-id-row">
                <div className="bp-id-names">
                  <h2 className="bp-id-name">{profile.businessName}</h2>
                  <p className="bp-id-industry">{profile.industry || 'No industry set'}</p>
                </div>
                {/*
                  Only the Uniqueness chip: the prototype also shows Semantics and
                  Category chips, but BusinessProfile (types.ts, Fixture Data Layer's
                  file) carries no semanticsScore/categoryScore field yet.
                */}
                {profile.uniquenessScore != null && (
                  // Stored 0–1 (matches the DB column); formatted to a human 0–100
                  // figure only here, at the display edge.
                  <span
                    className="bp-score"
                    title="How distinct your profile reads against other Cebu tourism businesses, 0–100."
                  >
                    Uniqueness {Math.round(profile.uniquenessScore * 100)}
                    <Info size={13} aria-hidden="true" />
                  </span>
                )}
              </div>
            </div>
            <ul className="bp-facts">
              <li>
                <Globe size={16} aria-hidden="true" />
                <span className="bp-fact-text">
                  {profile.website ? profile.website.replace(/^https?:\/\//, '') : <>Website <em>(not set)</em></>}
                </span>
                {!profile.website && (
                  <button type="button" className="bp-add" onClick={() => focus(websiteRef.current)}>
                    + Add<span className="sr-only"> your site</span>
                  </button>
                )}
              </li>
              <li>
                <Tag size={16} aria-hidden="true" />
                <span className="bp-fact-text">
                  {profile.categories.length} tourism categor{profile.categories.length === 1 ? 'y' : 'ies'}
                </span>
              </li>
              <li>
                <Layers size={16} aria-hidden="true" />
                <span className="bp-fact-text">
                  {profile.coreServices.length} core service{profile.coreServices.length === 1 ? '' : 's'}
                </span>
              </li>
              {!profile.slogan && (
                <li>
                  <Star size={16} aria-hidden="true" />
                  <span className="bp-fact-text">Slogan <em>(not set)</em></span>
                  <button type="button" className="bp-add" onClick={() => focus(sloganRef.current)}>+ Add</button>
                </li>
              )}
            </ul>
          </div>

          <div className="bp-card bp-complete">
            <div className="bp-complete-head">
              <Ring pct={pct} />
              <div>
                <h2 className="bp-side-title">Profile completeness</h2>
                <p className="bp-side-sub">
                  {pct === 100
                    ? 'Every field is filled in. Keep it current as your business changes.'
                    : 'Add more information to make your business stand out to travellers.'}
                </p>
              </div>
            </div>
            <ul className="bp-checks">
              {items.map((i) => (
                <li key={i.label} data-done={i.done || undefined}>
                  <span className="bp-check" aria-hidden="true">{i.done && <Check size={12} strokeWidth={3} />}</span>
                  {i.label}
                  <span className="sr-only">{i.done ? ' (done)' : ' (to do)'}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bp-card bp-tips" aria-roledescription="carousel" aria-label="Profile tips">
            <span className="bp-tip-icon" aria-hidden="true"><Lightbulb size={20} /></span>
            <div className="bp-tip-body" aria-live="polite">
              <h2 className="bp-side-title">{TIPS[tip].title}</h2>
              <p className="bp-side-sub">{TIPS[tip].body}</p>
            </div>
            <button type="button" className="bp-tip-next" onClick={() => setTip((tip + 1) % TIPS.length)} aria-label="Next tip">
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            <div className="bp-dots">
              {TIPS.map((t, i) => (
                <button
                  key={t.title}
                  type="button"
                  aria-label={`Show tip ${i + 1}`}
                  aria-current={i === tip || undefined}
                  onClick={() => setTip(i)}
                />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
