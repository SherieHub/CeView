/**
 * Campaign entry: one action — Generate My Campaign — over what CeView already
 * knows. The business profile supplies the business context, so nothing it
 * holds is asked for again; the optional preferences are overrides, never
 * required inputs. When the profile is missing something generation needs,
 * this says exactly what and links to where to add it.
 */
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, CircleAlert, PenLine, Sparkles } from 'lucide-react';
import type { BusinessProfile, Market } from '@/types';
import { ApiErrorPanel } from '../../../shared/ApiErrorPanel';
import { PlatformIcon } from '../ContentBoard';
import { STUDIO_PLATFORMS } from '../contentStudioTypes';
import { profileReadiness } from './campaignRecommendations';
import type { CampaignPreferences } from './campaignTypes';
import type { LoadState } from './useCampaignData';

interface CampaignGenerateProps {
  profile: BusinessProfile;
  category: string;
  onCategoryChange: (category: string) => void;
  markets: Market[];
  marketsState: LoadState;
  marketsError: unknown;
  onRetryMarkets: () => void;
  prefs: CampaignPreferences;
  onPrefsChange: (prefs: CampaignPreferences) => void;
  onGenerate: () => void;
  onManual: () => void;
  onBack: () => void;
  /** True when there are campaigns to go back to. */
  canGoBack: boolean;
}

export default function CampaignGenerate({
  profile,
  category,
  onCategoryChange,
  markets,
  marketsState,
  marketsError,
  onRetryMarkets,
  prefs,
  onPrefsChange,
  onGenerate,
  onManual,
  onBack,
  canGoBack,
}: CampaignGenerateProps) {
  const { missing, limited } = profileReadiness(profile);
  const services = profile.coreServices.map((s) => s.trim()).filter(Boolean);
  const patch = (p: Partial<CampaignPreferences>) => onPrefsChange({ ...prefs, ...p });
  const ready = missing.length === 0 && marketsState === 'ready' && markets.length > 0;

  const known = [
    { label: 'Business', value: profile.businessName },
    { label: 'Category', value: category },
    { label: 'Services', value: services.length ? services.join(', ') : '' },
    { label: 'Description', value: profile.description ? 'On your profile' : '' },
  ];

  return (
    <div className="cp-entry">
      {canGoBack && (
        <button type="button" className="link-back" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden="true" /> All campaigns
        </button>
      )}

      <section className="cp-hero" aria-labelledby="cp-entry-title">
        <span className="cp-hero-glyph" aria-hidden="true"><Sparkles size={22} /></span>
        <h2 id="cp-entry-title" className="cp-hero-title">Let&rsquo;s plan your next campaign.</h2>
        <p className="cp-hero-sub">
          CeView uses your business profile, tourism demand insights, and available content performance to recommend a
          campaign.
        </p>

        <ul className="cp-known" aria-label="What CeView will use">
          {known.map((k) => (
            <li key={k.label} data-ok={Boolean(k.value)}>
              {k.value ? <Check size={14} aria-hidden="true" /> : <CircleAlert size={14} aria-hidden="true" />}
              <span className="cp-known-label">{k.label}</span>
              <span className="cp-known-value">{k.value || 'Missing'}</span>
            </li>
          ))}
        </ul>

        {missing.length > 0 && (
          <div className="cp-callout" role="alert">
            <p>
              <b>CeView needs a little more about your business first:</b> {missing.join(', ')}.
            </p>
            <Link to="/settings/profile" className="btn-outline btn-outline--sm">Complete your Business Profile</Link>
          </div>
        )}
        {missing.length === 0 && limited.length > 0 && (
          <p className="cp-hint">
            Your profile doesn&rsquo;t include {limited.join(' or ').toLowerCase()} yet, so some recommendations will be
            more general. <Link to="/settings/profile" className="link-inline">Add them</Link>
          </p>
        )}

        {marketsState === 'error' && (
          <div className="cp-error">
            <ApiErrorPanel error={marketsError} label="Market forecasts" />
            <div className="cp-error-acts">
              <button type="button" className="btn-outline btn-outline--sm" onClick={onRetryMarkets}>Try again</button>
              <button type="button" className="link-inline" onClick={onManual}>Plan it myself instead</button>
            </div>
          </div>
        )}
        {marketsState === 'ready' && markets.length === 0 && (
          <p className="cp-hint" role="status">
            CeView has no market forecasts for {category} yet, so it can&rsquo;t recommend a market.{' '}
            <button type="button" className="link-inline" onClick={onManual}>Plan it myself instead</button>
          </p>
        )}

        <details className="cp-prefs">
          <summary>
            Have something specific in mind? <span className="cp-opt">Optional</span>
            <ChevronDown size={16} aria-hidden="true" className="cp-prefs-caret" />
          </summary>
          <div className="cp-prefs-grid">
            {profile.categories.length > 1 && (
              <label className="cb-field">
                <span>Tourism category</span>
                <select className="input" value={category} onChange={(e) => onCategoryChange(e.target.value)}>
                  {profile.categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="cb-field">
              <span>Campaign length</span>
              <select
                className="input"
                value={prefs.weeks ?? ''}
                onChange={(e) => patch({ weeks: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Let CeView decide</option>
                {[1, 2, 3, 4, 6, 8].map((w) => (
                  <option key={w} value={w}>{w} week{w === 1 ? '' : 's'}</option>
                ))}
              </select>
            </label>
            <label className="cb-field">
              <span>Target market</span>
              <select
                className="input"
                value={prefs.marketId}
                disabled={marketsState !== 'ready'}
                onChange={(e) => patch({ marketId: e.target.value })}
              >
                <option value="">{marketsState === 'loading' ? 'Loading markets…' : 'Let CeView decide'}</option>
                {markets.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
            <label className="cb-field">
              <span>Product or service to feature</span>
              <select className="input" value={prefs.focus} onChange={(e) => patch({ focus: e.target.value })}>
                <option value="">Let CeView decide</option>
                {services.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="cb-field">
              <span>An offer you&rsquo;re running</span>
              <input
                className="input"
                value={prefs.offer}
                onChange={(e) => patch({ offer: e.target.value })}
                placeholder="e.g. Free snorkel gear with every booking"
              />
              <em className="cp-field-hint">Only offers you&rsquo;re actually running — CeView never invents one.</em>
            </label>
            <div className="cb-field" role="group" aria-label="Preferred platforms">
              <span>Platforms</span>
              <div className="cb-chips">
                {STUDIO_PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="cb-chip"
                    aria-pressed={prefs.platforms.includes(p.id)}
                    onClick={() =>
                      patch({
                        platforms: prefs.platforms.includes(p.id)
                          ? prefs.platforms.filter((x) => x !== p.id)
                          : [...prefs.platforms, p.id],
                      })
                    }
                  >
                    <PlatformIcon platform={p.id} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="cb-field cp-prefs-wide">
              <span>Notes or restrictions</span>
              <textarea
                className="textarea"
                rows={2}
                value={prefs.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                placeholder="e.g. Closed for renovation in the second week"
              />
              <em className="cp-field-hint">Kept with the campaign for you to refer to.</em>
            </label>
          </div>
        </details>

        <div className="cp-hero-acts">
          <button type="button" className="btn-cta" disabled={!ready} onClick={onGenerate}>
            <Sparkles size={17} aria-hidden="true" />
            {marketsState === 'loading' ? 'Loading market data…' : 'Generate My Campaign'}
          </button>
          <p className="cp-hero-note">You can review and change every recommendation before proceeding.</p>
        </div>
      </section>

      <p className="cp-manual">
        Prefer to start from scratch?{' '}
        <button type="button" className="link-inline" onClick={onManual}>
          <PenLine size={13} aria-hidden="true" /> Plan a campaign manually
        </button>
      </p>
    </div>
  );
}
