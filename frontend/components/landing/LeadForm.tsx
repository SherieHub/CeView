/**
 * Demo request form.
 *
 * Posts JSON to LINKS.leadFormDestination. Until that destination is
 * confirmed, the form still validates but does NOT pretend to send: it says
 * plainly that requests aren't connected yet and points to the contact
 * channel instead. A fake "thanks, we'll be in touch" would lose real leads.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, CircleCheck } from 'lucide-react';
import { AUDIENCE, CTA, LINKS, MARKETS, isPlaceholder } from './landingContent';
import { MaybeLink, Placeholder } from './landingParts';

type Status = 'idle' | 'sending' | 'sent' | 'error' | 'unconfigured';

interface Fields {
  name: string;
  business: string;
  email: string;
  businessType: string;
  markets: string[];
  message: string;
}

type Errors = Partial<Record<'name' | 'business' | 'email' | 'businessType', string>>;

const EMPTY: Fields = { name: '', business: '', email: '', businessType: '', markets: [], message: '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLead(f: Fields): Errors {
  const errors: Errors = {};
  if (!f.name.trim()) errors.name = 'Please enter your name.';
  if (!f.business.trim()) errors.business = 'Please enter your business name.';
  if (!f.email.trim()) errors.email = 'Please enter your email address.';
  else if (!EMAIL_RE.test(f.email.trim())) errors.email = 'Please enter a valid email address.';
  if (!f.businessType) errors.businessType = 'Please choose the option closest to your business.';
  return errors;
}

export default function LeadForm() {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>('idle');

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function toggleMarket(m: string) {
    set('markets', fields.markets.includes(m) ? fields.markets.filter((x) => x !== m) : [...fields.markets, m]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateLead(fields);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Move focus to the first problem so keyboard and screen-reader users land on it.
      const first = (['name', 'business', 'email', 'businessType'] as const).find((k) => found[k]);
      if (first) document.getElementById(`lead-${first}`)?.focus();
      return;
    }

    if (isPlaceholder(LINKS.leadFormDestination)) {
      setStatus('unconfigured');
      return;
    }

    setStatus('sending');
    try {
      const res = await fetch(LINKS.leadFormDestination, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, source: 'landing-page' }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus('sent');
      setFields(EMPTY);
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="lp-form-card lp-form-done" role="status">
        <span className="lp-form-done-icon">
          <CircleCheck size={28} aria-hidden="true" />
        </span>
        <h3 className="heading-md">Thanks — your request is in.</h3>
        <p className="body-sm">We’ll reach out to arrange a walkthrough that fits your business.</p>
      </div>
    );
  }

  const describedBy = (key: keyof Errors) => (errors[key] ? `lead-${key}-error` : undefined);

  return (
    <form className="lp-form-card" onSubmit={onSubmit} noValidate aria-labelledby="lp-form-title">
      <h3 className="heading-md" id="lp-form-title">
        Request your demo
      </h3>
      <p className="text-meta lp-form-sub">It takes about a minute. Fields marked * are required.</p>

      <div className="lp-form-grid">
        <div className="field">
          <label className="field-label" htmlFor="lead-name">
            Your name *
          </label>
          <input
            id="lead-name"
            className="input"
            autoComplete="name"
            value={fields.name}
            onChange={(e) => set('name', e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describedBy('name')}
          />
          {errors.name && (
            <p className="lp-field-error" id="lead-name-error">
              {errors.name}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="lead-business">
            Business name *
          </label>
          <input
            id="lead-business"
            className="input"
            autoComplete="organization"
            value={fields.business}
            onChange={(e) => set('business', e.target.value)}
            aria-invalid={Boolean(errors.business)}
            aria-describedby={describedBy('business')}
          />
          {errors.business && (
            <p className="lp-field-error" id="lead-business-error">
              {errors.business}
            </p>
          )}
        </div>

        <div className="field lp-span-2">
          <label className="field-label" htmlFor="lead-email">
            Work email *
          </label>
          <input
            id="lead-email"
            type="email"
            className="input"
            autoComplete="email"
            inputMode="email"
            value={fields.email}
            onChange={(e) => set('email', e.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy('email')}
          />
          {errors.email && (
            <p className="lp-field-error" id="lead-email-error">
              {errors.email}
            </p>
          )}
        </div>

        <div className="field lp-span-2">
          <label className="field-label" htmlFor="lead-businessType">
            What kind of business do you run? *
          </label>
          <select
            id="lead-businessType"
            className="input lp-select"
            value={fields.businessType}
            onChange={(e) => set('businessType', e.target.value)}
            aria-invalid={Boolean(errors.businessType)}
            aria-describedby={describedBy('businessType')}
          >
            <option value="">Choose one…</option>
            {AUDIENCE.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="Other">Something else</option>
          </select>
          {errors.businessType && (
            <p className="lp-field-error" id="lead-businessType-error">
              {errors.businessType}
            </p>
          )}
        </div>

        <fieldset className="field lp-span-2 lp-fieldset">
          <legend className="field-label">Which travelers do you most want to reach?</legend>
          <div className="lp-check-row">
            {MARKETS.map((m) => {
              const checked = fields.markets.includes(m);
              return (
                <label key={m} className="lp-check" data-checked={checked}>
                  <input type="checkbox" checked={checked} onChange={() => toggleMarket(m)} />
                  {m}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="field lp-span-2">
          <label className="field-label" htmlFor="lead-message">
            Anything you’d like us to know? <span className="lp-optional">(optional)</span>
          </label>
          <textarea
            id="lead-message"
            className="input lp-textarea"
            rows={3}
            value={fields.message}
            onChange={(e) => set('message', e.target.value)}
          />
        </div>
      </div>

      {status === 'unconfigured' && (
        <div className="lp-form-notice" role="status">
          <p>
            Online demo requests aren’t connected yet (<Placeholder value={LINKS.leadFormDestination} />
            ). Nothing was sent — please contact us directly at <Placeholder value={LINKS.contactEmail} /> for now.
          </p>
        </div>
      )}
      {status === 'error' && (
        <div className="lp-form-notice lp-form-notice--error" role="alert">
          <p>
            We couldn’t send your request just now. Please try again, or contact us at{' '}
            <MaybeLink href={isPlaceholder(LINKS.contactEmail) ? LINKS.contactEmail : `mailto:${LINKS.contactEmail}`}>
              {isPlaceholder(LINKS.contactEmail) ? '' : LINKS.contactEmail}
            </MaybeLink>
            .
          </p>
        </div>
      )}

      <button type="submit" className="btn-cta lp-btn-lg lp-form-submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : CTA.primary}
        {status !== 'sending' && <ArrowRight size={18} aria-hidden="true" />}
      </button>

      <p className="text-meta lp-consent">
        By requesting a demo you agree to be contacted about CeView. Read our{' '}
        <MaybeLink href={LINKS.privacyPolicy}>privacy policy</MaybeLink>.
      </p>
    </form>
  );
}
