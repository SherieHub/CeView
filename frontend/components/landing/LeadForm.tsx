/**
 * Demo request form.
 *
 * Sending depends on what's configured (SITE in landingContent.ts):
 *   - VITE_LEAD_FORM_ENDPOINT → POSTs JSON there.
 *   - otherwise VITE_CONTACT_EMAIL → opens the visitor's email app with the
 *     request filled in, and says that's what happened.
 *   - neither → says plainly that online requests aren't open yet.
 * It never shows "thanks, we'll be in touch" for a request that went nowhere:
 * a fake confirmation would silently lose a real lead.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, CircleCheck, LoaderCircle, Mail } from 'lucide-react';
import { BUSINESS_CATEGORIES, DEMO, SITE } from './landingContent';

type Status = 'idle' | 'sending' | 'sent' | 'mailto' | 'error' | 'unavailable';

export interface LeadFields {
  name: string;
  email: string;
  business: string;
  businessType: string;
  help: string;
}

type Required = 'name' | 'email' | 'business' | 'businessType';
type Errors = Partial<Record<Required, string>>;

const EMPTY: LeadFields = { name: '', email: '', business: '', businessType: '', help: '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORDER: Required[] = ['name', 'email', 'business', 'businessType'];

export function validateLead(f: LeadFields): Errors {
  const errors: Errors = {};
  if (!f.name.trim()) errors.name = 'Please enter your full name.';
  if (!f.email.trim()) errors.email = 'Please enter your work email.';
  else if (!EMAIL_RE.test(f.email.trim())) errors.email = 'Please enter a valid email address, like name@business.com.';
  if (!f.business.trim()) errors.business = 'Please enter your business name.';
  if (!f.businessType) errors.businessType = 'Please choose the closest type of business.';
  return errors;
}

function mailtoFor(f: LeadFields): string {
  const subject = `CeView demo request — ${f.business.trim()}`;
  const body = [
    `Name: ${f.name.trim()}`,
    `Email: ${f.email.trim()}`,
    `Business: ${f.business.trim()}`,
    `Type of business: ${f.businessType}`,
    f.help ? `Would most like help with: ${f.help}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return `mailto:${SITE.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function LeadForm() {
  const [fields, setFields] = useState<LeadFields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>('idle');

  function set<K extends keyof LeadFields>(key: K, value: LeadFields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
    if (status === 'error' || status === 'unavailable') setStatus('idle');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateLead(fields);
    setErrors(found);
    const first = ORDER.find((k) => found[k]);
    if (first) {
      // Land keyboard and screen-reader users on the first problem.
      document.getElementById(`lead-${first}`)?.focus();
      return;
    }

    if (SITE.leadFormEndpoint) {
      setStatus('sending');
      try {
        const res = await fetch(SITE.leadFormEndpoint, {
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
      return;
    }

    if (SITE.contactEmail) {
      window.location.href = mailtoFor(fields);
      setStatus('mailto');
      return;
    }

    setStatus('unavailable');
  }

  if (status === 'sent') {
    return (
      <div className="lp-form lp-form--done" role="status">
        <span className="lp-form-done-icon" aria-hidden="true">
          <CircleCheck size={30} />
        </span>
        <h3 className="lp-h3">Thanks — your request is in.</h3>
        <p className="lp-body">We’ll reach out to arrange a walkthrough that fits your business.</p>
      </div>
    );
  }

  const describedBy = (key: Required) => (errors[key] ? `lead-${key}-error` : undefined);
  const errorText = (key: Required) =>
    errors[key] ? (
      <p className="lp-field-error" id={`lead-${key}-error`}>
        {errors[key]}
      </p>
    ) : null;

  return (
    <form className="lp-form" onSubmit={onSubmit} noValidate aria-labelledby="lp-form-title">
      <h3 className="lp-h3" id="lp-form-title">
        Request your demo
      </h3>
      <p className="lp-form-sub">Takes about a minute. Every field is required unless marked optional.</p>

      <div className="lp-form-grid">
        <div className="lp-field">
          <label className="lp-label" htmlFor="lead-name">
            Full name
          </label>
          <input
            id="lead-name"
            className="lp-input"
            autoComplete="name"
            value={fields.name}
            onChange={(e) => set('name', e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describedBy('name')}
          />
          {errorText('name')}
        </div>

        <div className="lp-field">
          <label className="lp-label" htmlFor="lead-email">
            Work email
          </label>
          <input
            id="lead-email"
            type="email"
            className="lp-input"
            autoComplete="email"
            inputMode="email"
            value={fields.email}
            onChange={(e) => set('email', e.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy('email')}
          />
          {errorText('email')}
        </div>

        <div className="lp-field lp-field--wide">
          <label className="lp-label" htmlFor="lead-business">
            Business name
          </label>
          <input
            id="lead-business"
            className="lp-input"
            autoComplete="organization"
            value={fields.business}
            onChange={(e) => set('business', e.target.value)}
            aria-invalid={Boolean(errors.business)}
            aria-describedby={describedBy('business')}
          />
          {errorText('business')}
        </div>

        <div className="lp-field lp-field--wide">
          <label className="lp-label" htmlFor="lead-businessType">
            Type of tourism business
          </label>
          <select
            id="lead-businessType"
            className="lp-input lp-select"
            value={fields.businessType}
            onChange={(e) => set('businessType', e.target.value)}
            aria-invalid={Boolean(errors.businessType)}
            aria-describedby={describedBy('businessType')}
          >
            <option value="">Choose the closest match…</option>
            {BUSINESS_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="Other">Something else</option>
          </select>
          {errorText('businessType')}
        </div>

        <div className="lp-field lp-field--wide">
          <label className="lp-label" htmlFor="lead-help">
            What would you most like help with? <span className="lp-optional">(optional)</span>
          </label>
          <select id="lead-help" className="lp-input lp-select" value={fields.help} onChange={(e) => set('help', e.target.value)}>
            <option value="">No preference</option>
            {DEMO.helpOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>

      {status === 'mailto' && (
        <div className="lp-form-notice" role="status">
          <Mail size={18} aria-hidden="true" />
          <p>
            Your email app should open with your request filled in — just press send. If it didn’t, email us at{' '}
            <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
          </p>
        </div>
      )}
      {status === 'error' && (
        <div className="lp-form-notice lp-form-notice--error" role="alert">
          <p>
            We couldn’t send your request just now. Please try again
            {SITE.contactEmail ? (
              <>
                , or email us at <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
              </>
            ) : null}
            .
          </p>
        </div>
      )}
      {status === 'unavailable' && (
        <div className="lp-form-notice" role="status">
          <p>
            Online demo requests aren’t open just yet, so nothing was sent. Please check back soon.
            {import.meta.env.DEV && (
              <span className="lp-dev-note"> Developer: set VITE_LEAD_FORM_ENDPOINT or VITE_CONTACT_EMAIL.</span>
            )}
          </p>
        </div>
      )}

      <button type="submit" className="btn-cta lp-form-submit" disabled={status === 'sending'} aria-busy={status === 'sending'}>
        {status === 'sending' ? (
          <>
            <LoaderCircle size={18} className="lp-spin" aria-hidden="true" /> Sending…
          </>
        ) : (
          <>
            Request My Demo <ArrowRight size={18} aria-hidden="true" />
          </>
        )}
      </button>
      <p className="lp-consent">{DEMO.consent}</p>
    </form>
  );
}
