/**
 * Campaign entry: one action — Generate My Campaign — over what CeView already
 * knows. The business profile supplies the business context, so nothing it
 * holds is asked for again; the optional preferences are overrides, never
 * required inputs. When the profile is missing something generation needs,
 * this says exactly what and links to where to add it.
 */
import './campaign-entry.css';
import '@fontsource/caveat/500.css';
import { AppLink } from '../../../../layout/shellContext';
import { ArrowLeft, ArrowRight, Building2, Check, ChevronDown, CircleAlert, FileText, PenLine, Sparkles, Store, Tag, Waves } from 'lucide-react';
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
    { label: 'Business', value: profile.businessName, icon: Building2 },
    { label: 'Services', value: services.length ? services.join(', ') : '', icon: Waves },
    { label: 'Category', value: category, icon: Tag },
    { label: 'Description', value: profile.description ? 'On your profile' : '', icon: FileText },
  ];

  return (
    <div className="cp-entry cp-entry--coastal">
      {canGoBack && (
        <button type="button" className="link-back" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden="true" /> All campaigns
        </button>
      )}

      <section className="cp-hero" aria-labelledby="cp-entry-title">
        <div className="cp-coastal-art" aria-hidden="true">
          <p className="cp-coastal-script">Turn your<br />local story into<br /><span>a bigger reach.</span></p>
          <div className="cp-coastal-postcard"><img src="/images/landing/how-lagoon-1000.webp" alt="" /></div>
          <span className="cp-coastal-caption">More travelers.<br />Brighter tomorrows.</span>
          <Sparkles className="cp-coastal-sparkle" size={30} />
        </div>
        <div className="cp-hero-intro">
        <span className="cp-planner-badge"><Sparkles size={17} aria-hidden="true" /> AI-powered campaign planner</span>
        <h2 id="cp-entry-title" className="cp-hero-title">Let&rsquo;s plan your next campaign.</h2>
        <p className="cp-hero-sub">
          CeView uses your business profile, tourism demand insights, and available content performance to recommend a
          campaign.
        </p>

        </div>
        <div className="cp-profile-card">
          <div className="cp-profile-heading">
            <h3><Store size={21} aria-hidden="true" /> Your business profile</h3>
            <span className="cp-profile-source"><Check size={14} aria-hidden="true" /> Pulled from your profile</span>
          </div>
        <ul className="cp-known" aria-label="What CeView will use">
          {known.map((k) => (
            <li key={k.label} data-ok={Boolean(k.value)}>
              <span className="cp-profile-icon">{k.value ? <k.icon size={23} aria-hidden="true" /> : <CircleAlert size={23} aria-hidden="true" />}</span>
              <span className="cp-known-label">{k.label}</span>
              <span className="cp-known-value">{k.value || 'Missing'}</span>
            </li>
          ))}
        </ul>
        </div>

        {missing.length > 0 && (
          <div className="cp-callout" role="alert">
            <p>
              <b>CeView needs a little more about your business first:</b> {missing.join(', ')}.
            </p>
            <AppLink to="/settings/profile" className="btn-outline btn-outline--sm">Complete your Business Profile</AppLink>
          </div>
        )}
        {missing.length === 0 && limited.length > 0 && (
          <p className="cp-hint">
            Your profile doesn&rsquo;t include {limited.join(' or ').toLowerCase()} yet, so some recommendations will be
            more general. <AppLink to="/settings/profile" className="link-inline">Add them</AppLink>
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
            <span className="cp-prefs-icon"><Sparkles size={25} aria-hidden="true" /></span>
            <span className="cp-prefs-copy"><span>Have something specific in mind? <span className="cp-opt">Optional</span></span>
              <span className="cp-prefs-description">Share a theme, audience, promotion, or any idea you&rsquo;d like to explore.</span>
            </span>
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
            <ArrowRight size={21} aria-hidden="true" />
          </button>
          <p className="cp-hero-note">You can review and change every recommendation before proceeding.</p>
        </div>
      </section>

      <p className="cp-manual">
        Prefer to start from scratch?{' '}
        <button type="button" className="link-inline" onClick={onManual}>
          <PenLine size={14} aria-hidden="true" /> Plan a campaign manually <ArrowRight size={16} aria-hidden="true" />
        </button>
      </p>
    </div>
  );
}
