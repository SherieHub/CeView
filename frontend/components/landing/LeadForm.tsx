/**
 * Demo request form.
 *
 * Sending depends on what's configured (SITE in content/landing.ts):
 *   - VITE_LEAD_FORM_ENDPOINT → POSTs JSON there.
 *   - otherwise VITE_CONTACT_EMAIL → opens the visitor's email app with the
 *     request filled in, and says that's what happened.
 *   - neither → says plainly that online requests aren't open yet.
 * It never shows "thanks, we'll be in touch" for a request that went nowhere:
 * a fake confirmation would silently lose a real lead.
 *
 * Plan pre-selection: pricing CTAs link to `#demo?plan=<id>`. The plan is
 * shown on the form and sent as an optional `plan` field, alongside the
 * existing extra `source` field; the Partner Plan also pre-selects that
 * "help with" option.
 */
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { CircleAlert, CircleCheck, LoaderCircle, Mail } from 'lucide-react';
import { DEMO, PARTNER_HELP, PRICING, SITE } from '../../content/landing';
import { Button } from './ui';
import { track } from '../../services/analytics';

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

/** Plan from a `#demo?plan=<id>` link, if it names one we offer (or the Partner Plan). */
export function planFromHash(hash: string): string {
  const query = hash.startsWith('#demo?') ? hash.slice('#demo?'.length) : '';
  const id = new URLSearchParams(query).get('plan') ?? '';
  if (id === 'partner') return 'partner';
  return PRICING.plans.some((p) => p.id === id) ? id : '';
}

function planName(id: string): string {
  if (id === 'partner') return PRICING.partner.eyebrow;
  return PRICING.plans.find((p) => p.id === id)?.name ?? '';
}

function mailtoFor(f: LeadFields, plan: string): string {
  const subject = `CeView demo request — ${f.business.trim()}`;
  const body = [
    `Name: ${f.name.trim()}`,
    `Email: ${f.email.trim()}`,
    `Business: ${f.business.trim()}`,
    `Type of business: ${f.businessType}`,
    f.help ? `Would most like help with: ${f.help}` : '',
    plan ? `Plan of interest: ${planName(plan)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return `mailto:${SITE.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function LeadForm() {
  const [fields, setFields] = useState<LeadFields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [plan, setPlan] = useState('');
  const [announce, setAnnounce] = useState('');

  // Pick up `#demo?plan=…` on load and on later clicks; the browser can't
  // scroll to that hash by itself, so bring the form into view too.
  useEffect(() => {
    const read = () => {
      if (!window.location.hash.startsWith('#demo?')) return;
      const p = planFromHash(window.location.hash);
      setPlan(p);
      if (p === 'partner') setFields((f) => (f.help ? f : { ...f, help: PARTNER_HELP }));
      document.getElementById('demo')?.scrollIntoView({ block: 'start' });
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

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
      const n = ORDER.filter((k) => found[k]).length;
      setAnnounce(`${n} ${n === 1 ? 'field needs' : 'fields need'} attention.`);
      // Land keyboard and screen-reader users on the first problem.
      document.getElementById(`lead-${first}`)?.focus();
      return;
    }
    setAnnounce('');

    if (SITE.leadFormEndpoint) {
      setStatus('sending');
      try {
        const res = await fetch(SITE.leadFormEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...fields, ...(plan ? { plan } : {}), source: 'landing-page' }),
        });
        if (!res.ok) throw new Error(String(res.status));
        setStatus('sent');
        // Only once the endpoint has accepted the request.
        track('request_demo_submitted');
        setFields(EMPTY);
      } catch {
        setStatus('error');
      }
      return;
    }

    if (SITE.contactEmail) {
      window.location.href = mailtoFor(fields, plan);
      setStatus('mailto');
      return;
    }

    setStatus('unavailable');
  }

  if (status === 'sent') {
    return (
      <div className="cv-form cv-form--done" role="status">
        <span className="cv-form-done-icon" aria-hidden="true">
          <CircleCheck size={40} strokeWidth={1.5} />
        </span>
        <h3 className="cv-form-title">{DEMO.form.doneTitle}</h3>
        <p className="cv-form-sub">{DEMO.form.doneBody}</p>
        <a href="#faq" className="cv-form-done-link">
          {DEMO.form.doneLink}
        </a>
      </div>
    );
  }

  const describedBy = (key: Required) => (errors[key] ? `lead-${key}-error` : undefined);
  const errorText = (key: Required) =>
    errors[key] ? (
      <p className="cv-field-error" id={`lead-${key}-error`}>
        <CircleAlert size={15} strokeWidth={2} aria-hidden="true" />
        {errors[key]}
      </p>
    ) : null;
  const sending = status === 'sending';

  return (
    <form className="cv-form" onSubmit={onSubmit} noValidate aria-labelledby="lp-form-title">
      <h3 className="cv-form-title" id="lp-form-title">
        {DEMO.form.title}
      </h3>
      <p className="cv-form-sub">{DEMO.form.sub}</p>
      {plan && (
        <p className="cv-form-plan">
          {DEMO.form.planNote} <strong>{planName(plan)}</strong>
        </p>
      )}
      <p className="cv-sr-live" aria-live="polite">
        {announce}
      </p>

      <div className="cv-form-grid">
        <div className="cv-field">
          <label className="cv-label" htmlFor="lead-name">
            Full name
          </label>
          <input
            id="lead-name"
            className="cv-input"
            autoComplete="name"
            value={fields.name}
            onChange={(e) => set('name', e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describedBy('name')}
          />
          {errorText('name')}
        </div>

        <div className="cv-field">
          <label className="cv-label" htmlFor="lead-email">
            Work email
          </label>
          <input
            id="lead-email"
            type="email"
            className="cv-input"
            autoComplete="email"
            inputMode="email"
            value={fields.email}
            onChange={(e) => set('email', e.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy('email')}
          />
          {errorText('email')}
        </div>

        <div className="cv-field cv-field--wide">
          <label className="cv-label" htmlFor="lead-business">
            Business name
          </label>
          <input
            id="lead-business"
            className="cv-input"
            autoComplete="organization"
            value={fields.business}
            onChange={(e) => set('business', e.target.value)}
            aria-invalid={Boolean(errors.business)}
            aria-describedby={describedBy('business')}
          />
          {errorText('business')}
        </div>

        <div className="cv-field cv-field--wide">
          <label className="cv-label" htmlFor="lead-businessType">
            Type of tourism business
          </label>
          <select
            id="lead-businessType"
            className="cv-input cv-select"
            value={fields.businessType}
            onChange={(e) => set('businessType', e.target.value)}
            aria-invalid={Boolean(errors.businessType)}
            aria-describedby={describedBy('businessType')}
          >
            <option value="">Choose the closest match…</option>
            {DEMO.businessTypes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {errorText('businessType')}
        </div>

        <div className="cv-field cv-field--wide">
          <label className="cv-label" htmlFor="lead-help">
            What would you most like help with? <span className="cv-optional">(optional)</span>
          </label>
          <select
            id="lead-help"
            className="cv-input cv-select"
            value={fields.help}
            onChange={(e) => set('help', e.target.value)}
          >
            <option value="">{DEMO.noPreference}</option>
            {DEMO.helpOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>

      {status === 'mailto' && (
        <div className="cv-form-notice" role="status">
          <Mail size={18} aria-hidden="true" />
          <p>
            Your email app should open with your request filled in — just press send. If it didn’t, email us at{' '}
            <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
          </p>
        </div>
      )}
      {status === 'error' && (
        <div className="cv-form-notice" data-tone="error" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
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
        <div className="cv-form-notice" role="status">
          <p>
            Online demo requests aren’t open just yet, so nothing was sent. Please check back soon.
            {import.meta.env.DEV && (
              <span className="cv-dev-note"> Developer: set VITE_LEAD_FORM_ENDPOINT or VITE_CONTACT_EMAIL.</span>
            )}
          </p>
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        block
        arrow={!sending}
        disabled={sending}
        aria-busy={sending}
        className="cv-form-submit"
      >
        {sending ? (
          <>
            <LoaderCircle size={18} className="cv-spin" aria-hidden="true" /> {DEMO.form.sending}
          </>
        ) : (
          DEMO.form.submit
        )}
      </Button>
      <p className="cv-form-consent">{DEMO.consent}</p>
    </form>
  );
}
