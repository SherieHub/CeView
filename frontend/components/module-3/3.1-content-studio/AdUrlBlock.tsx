import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Link2 } from 'lucide-react';
import type { AttributionLink } from '../../../types';
import { apiClient } from '../../../services/apiClient';

interface AdUrlBlockProps {
  link: AttributionLink | null;
  onLinkChange: (link: AttributionLink) => void;
}

type DestinationMode = 'operator' | 'hosted';
type CopyKey = 'bare' | 'meta' | 'tiktok';

export default function AdUrlBlock({ link, onLinkChange }: AdUrlBlockProps) {
  const [mode, setMode] = useState<DestinationMode>(link?.hosted ? 'hosted' : 'operator');
  const [destinationUrl, setDestinationUrl] = useState(link?.destinationUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<CopyKey | null>(null);

  useEffect(() => {
    setMode(link?.hosted ? 'hosted' : 'operator');
    setDestinationUrl(link?.destinationUrl ?? '');
    setError(null);
  }, [link?.linkId, link?.hosted, link?.destinationUrl]);

  if (!link) return null;

  const copy = async (key: CopyKey, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1800);
  };

  const saveDestination = async () => {
    setError(null);
    const nextDestination = mode === 'hosted' ? null : destinationUrl.trim();
    if (nextDestination && !isAbsoluteWebUrl(nextDestination)) {
      setError('Enter a full http or https URL, such as https://your-site.com/book.');
      return;
    }
    if (mode === 'operator' && !nextDestination) {
      setError('Enter the page visitors should open, or choose CeView’s booking form.');
      return;
    }

    setSaving(true);
    try {
      const updated = await apiClient.attributionLinks.setDestination(link.linkId, nextDestination);
      onLinkChange(updated);
    } catch {
      setError('CeView could not save that destination. Check the URL and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="ad-url-block" aria-labelledby="ad-url-title">
      <div className="ad-url-head">
        <span className="ad-url-icon" aria-hidden="true"><Link2 /></span>
        <div>
          <p className="eyebrow">Track each creative</p>
          <h3 id="ad-url-title" className="heading-sm">Ad URL</h3>
          <p className="body-sm">Use the platform URL so CeView can tell which ad produced a booking.</p>
        </div>
      </div>

      <div className="ad-url-list">
        <UrlRow
          label="Bare link"
          hint="For a caption or link-in-bio"
          value={link.urls.linkUrl}
          secondary
          copied={copied === 'bare'}
          onCopy={() => copy('bare', link.urls.linkUrl)}
        />
        <UrlRow
          label="Meta ad URL"
          hint="Keeps Meta’s campaign, ad set and ad ID macros"
          value={link.urls.metaAdUrl}
          copied={copied === 'meta'}
          onCopy={() => copy('meta', link.urls.metaAdUrl)}
        />
        <UrlRow
          label="TikTok ad URL"
          hint="Keeps TikTok’s campaign, ad group and creative ID macros"
          value={link.urls.tiktokAdUrl}
          copied={copied === 'tiktok'}
          onCopy={() => copy('tiktok', link.urls.tiktokAdUrl)}
        />
      </div>

      <p className="ad-url-instruction">
        <strong>Paste the Meta or TikTok ad URL into your ad&apos;s Website URL field in Ads Manager — not into the caption.</strong>
      </p>
      <p className="body-sm">
        Meta also has a separate &ldquo;URL parameters&rdquo; field; it takes only the part after the ?, not the whole link.
        The Ad Planner shows the two pieces split for you.
      </p>
      <p className="body-sm ad-url-instagram">
        Instagram captions do not make links tappable. Use the ad&apos;s CTA button or put the bare link in your bio.
      </p>

      <div className="destination-control">
        <div className="destination-head">
          <div>
            <h4 className="heading-sm">Where visitors go</h4>
            <p className="body-sm">
              Current destination: {link.hosted ? "CeView's booking form" : 'your own page'}
            </p>
          </div>
          <ExternalLink aria-hidden="true" />
        </div>

        <fieldset className="destination-options">
          <legend className="sr-only">Choose the link destination</legend>
          <label className="destination-option">
            <input
              type="radio"
              name={`destination-${link.linkId}`}
              checked={mode === 'operator'}
              onChange={() => setMode('operator')}
            />
            <span>Send visitors to my own page</span>
          </label>
          <label className="destination-option">
            <input
              type="radio"
              name={`destination-${link.linkId}`}
              checked={mode === 'hosted'}
              onChange={() => setMode('hosted')}
            />
            <span>Use CeView&apos;s booking form</span>
          </label>
        </fieldset>

        {mode === 'operator' && (
          <label className="destination-field">
            <span>Destination URL</span>
            <input
              className="input"
              type="url"
              value={destinationUrl}
              placeholder="https://your-site.com/book"
              onChange={(event) => setDestinationUrl(event.target.value)}
            />
          </label>
        )}

        {error && <p className="destination-error" role="alert">{error}</p>}
        <button type="button" className="btn-outline btn-outline--sm" disabled={saving} onClick={saveDestination}>
          {saving ? 'Saving…' : 'Save destination'}
        </button>
      </div>
    </section>
  );
}

interface UrlRowProps {
  label: string;
  hint: string;
  value: string;
  secondary?: boolean;
  copied: boolean;
  onCopy: () => void;
}

function UrlRow({ label, hint, value, secondary = false, copied, onCopy }: UrlRowProps) {
  return (
    <div className="ad-url-row" data-secondary={secondary}>
      <div className="ad-url-label">
        <strong>{label}</strong>
        <span>{hint}</span>
      </div>
      <code>{value}</code>
      <button type="button" className={secondary ? 'btn-outline btn-outline--sm' : 'btn-primary btn-primary--sm'} aria-label={secondary ? 'Copy bare link' : `Copy ${label}`} onClick={onCopy}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function isAbsoluteWebUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}
