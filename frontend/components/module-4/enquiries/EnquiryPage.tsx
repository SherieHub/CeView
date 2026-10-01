import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { attributionEnquiries } from '../../../services/attributionEnquiries';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FAILURE = 'We could not send your enquiry. Please try again later or contact the business directly.';
const fieldClass = 'w-full min-w-0 rounded-sm border border-gray-light bg-white p-3 text-base text-text-heading focus:outline-2 focus:outline-navy-primary';

export default function EnquiryPage() {
  const [params] = useSearchParams();
  const clickId = params.get('cv') ?? '';
  return <EnquiryForm key={clickId} clickId={clickId} />;
}

function EnquiryForm({ clickId }: { clickId: string }) {
  const valid = UUID.test(clickId);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [expired, setExpired] = useState(!valid);
  const [sending, setSending] = useState(false);
  const [received, setReceived] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    attributionEnquiries.context(clickId, controller.signal).then((context) => {
      if (!controller.signal.aborted) setBusinessName(context.businessName);
    }).catch(() => {
      if (!controller.signal.aborted) setExpired(true);
    });
    return () => controller.abort();
  }, [clickId, valid]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? '').trim();
    const contactName = text('contactName');
    const contactValue = text('contactValue');
    if (!contactName || !contactValue) {
      setError('Please enter your name and contact details.');
      return;
    }
    const requestedStart = text('requestedStart');
    const requestedEnd = text('requestedEnd');
    if (requestedStart && requestedEnd && requestedEnd < requestedStart) {
      setError('The end date must be on or after the start date.');
      return;
    }
    inFlight.current = true;
    setSending(true);
    setError('');
    try {
      const ack = await attributionEnquiries.submit({
        clickId, contactName, contactValue,
        partySize: text('partySize') ? Number(text('partySize')) : undefined,
        requestedStart: requestedStart || undefined,
        requestedEnd: requestedEnd || undefined,
        message: text('message') || undefined,
      });
      if (!ack.received) throw new Error('Not received');
      setReceived(true);
    } catch {
      setError(FAILURE);
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  return (
    <main className="min-h-dvh bg-mint-pale px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl rounded-md bg-white p-6 shadow-card sm:p-8">
        {expired ? (
          <>
            <h1 className="heading-md">This link has expired</h1>
            <p className="mt-3">Please contact the business directly to make an enquiry.</p>
          </>
        ) : received ? (
          <div role="status">
            <h1 className="heading-md">Your enquiry has been sent</h1>
            <p className="mt-3">The business has received your details and can contact you to discuss your visit.</p>
            <p className="mt-3">This is an enquiry, not a confirmed booking.</p>
          </div>
        ) : businessName === null ? (
          <p role="status">Loading enquiry form...</p>
        ) : (
          <>
            <p className="text-sm font-semibold text-coral-text">PLAN YOUR VISIT</p>
            <h1 className="heading-md mt-2 break-words">Enquire with {businessName}</h1>
            <p className="mt-3">Share your details so the business can contact you about availability. No payment is required.</p>
            <form onSubmit={submit} className="mt-6 grid gap-4" aria-label="Booking enquiry">
              <label className="grid gap-2 text-sm font-semibold text-text-heading">
                Your name (required)
                <input className={fieldClass} name="contactName" autoComplete="name" required maxLength={200} />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-text-heading">
                Email, phone number or social handle (required)
                <input className={fieldClass} name="contactValue" required maxLength={200} />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-text-heading">
                Number of guests (optional)
                <input className={fieldClass} name="partySize" type="number" inputMode="numeric" min={1} max={500} step={1} />
              </label>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <label className="grid min-w-0 gap-2 text-sm font-semibold text-text-heading">
                  Start date (optional)
                  <input className={fieldClass} name="requestedStart" type="date" />
                </label>
                <label className="grid min-w-0 gap-2 text-sm font-semibold text-text-heading">
                  End date (optional)
                  <input className={fieldClass} name="requestedEnd" type="date" />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-text-heading">
                Message (optional)
                <textarea className={fieldClass} name="message" rows={4} maxLength={2000} />
              </label>
              <p className="text-sm">Your details will be shared with this business so they can respond to your enquiry.</p>
              {error && <p role="alert" className="text-critical-text">{error}</p>}
              <button className="btn-cta w-full" type="submit" disabled={sending}>
                {sending ? 'Sending enquiry...' : 'Send enquiry'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
